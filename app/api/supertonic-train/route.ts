import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"
import { spawn } from "child_process"
import { type NextRequest, NextResponse } from "next/server"
import { getSupertonicBaseUrl } from "@/lib/supertonic-local"
import {
  recordedVoiceId,
  recordedVoiceLabel,
  type RecordedSupertonicVoice,
} from "@/lib/supertonic-recorded"

export const runtime = "nodejs"
export const maxDuration = 300

function sanitizeName(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/\.json$/i, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48)
  return cleaned
}

async function allocateShortVoiceName(): Promise<{ id: string; label: string }> {
  const registryPath = path.join(process.cwd(), "voices", "supertonic", "recorded.json")
  let voices: RecordedSupertonicVoice[] = []
  try {
    const raw = await readFile(registryPath, "utf-8")
    const parsed = JSON.parse(raw) as { voices?: RecordedSupertonicVoice[] }
    voices = Array.isArray(parsed.voices) ? parsed.voices : []
  } catch {
    voices = []
  }
  const used = new Set(
    voices.map((v) => Number(/^n(\d+)$/i.exec(v.id)?.[1] || 0)).filter(Boolean)
  )
  let idx = 1
  while (used.has(idx)) idx += 1
  return { id: recordedVoiceId(idx), label: recordedVoiceLabel(idx) }
}

async function appendRecordedRegistry(id: string, label: string) {
  const registryPath = path.join(process.cwd(), "voices", "supertonic", "recorded.json")
  await mkdir(path.dirname(registryPath), { recursive: true })
  let voices: RecordedSupertonicVoice[] = []
  try {
    const raw = await readFile(registryPath, "utf-8")
    const parsed = JSON.parse(raw) as { voices?: RecordedSupertonicVoice[] }
    voices = Array.isArray(parsed.voices) ? parsed.voices : []
  } catch {
    voices = []
  }
  if (!voices.some((v) => v.id === id)) {
    voices.push({ id, label, createdAt: new Date().toISOString() })
    await writeFile(registryPath, JSON.stringify({ voices }, null, 2), "utf-8")
  }
}

function runPythonExtract(args: {
  wavPath: string
  name: string
  outJson: string
  baseUrl: string
}): Promise<{ ok: boolean; stdout: string; stderr: string; code: number }> {
  const script = path.join(process.cwd(), "scripts", "supertonic_extract_style.py")
  const py = process.env.PYTHON || process.env.SUPERTONIC_PYTHON || "python"
  return new Promise((resolve) => {
    const child = spawn(
      py,
      [
        script,
        "--wav",
        args.wavPath,
        "--name",
        args.name,
        "--out",
        args.outJson,
        "--base-url",
        args.baseUrl,
      ],
      {
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
        windowsHide: true,
      }
    )
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (d) => {
      stdout += String(d)
    })
    child.stderr.on("data", (d) => {
      stderr += String(d)
    })
    child.on("close", (code) => {
      resolve({ ok: code === 0, stdout, stderr, code: code ?? 1 })
    })
    child.on("error", (err) => {
      resolve({ ok: false, stdout, stderr: String(err.message || err), code: 1 })
    })
  })
}

async function importStyleJson(name: string, jsonBytes: Buffer, fileName: string) {
  const base = getSupertonicBaseUrl()
  const out = new FormData()
  out.append(
    "file",
    new Blob([jsonBytes], { type: "application/json" }),
    fileName || `${name}.json`
  )
  out.append("name", name)

  let res: Response
  try {
    res = await fetch(`${base}/v1/styles/import?overwrite=true`, {
      method: "POST",
      body: out,
      signal: AbortSignal.timeout(120000),
    })
  } catch (e) {
    throw new Error(
      e instanceof Error
        ? `로컬 Supertonic 연결 실패: ${e.message}. \`supertonic serve --host 127.0.0.1 --port 7788 --model supertonic-3\` 를 실행하세요.`
        : "로컬 Supertonic 연결 실패"
    )
  }

  const text = await res.text().catch(() => "")
  let data: Record<string, unknown> = {}
  try {
    data = JSON.parse(text) as Record<string, unknown>
  } catch {
    data = { raw: text.slice(0, 300) }
  }
  if (!res.ok) {
    throw new Error(
      `import 실패 (${res.status}): ${String(data.detail || data.message || text).slice(0, 300)}`
    )
  }
  return {
    name: String(data.name || name),
    stored_at: data.stored_at,
  }
}

/**
 * 학습용 녹음 → JSON 생성 → 로컬 Supertonic 3 등록
 *
 * - styleJson 이 있으면 그걸 그대로 import (권장·고품질)
 * - 없으면 로컬 추출 스크립트로 JSON 생성 후 import
 */
export async function POST(request: NextRequest) {
  try {
    const form = await request.formData()
    let name = sanitizeName(String(form.get("name") || ""))
    // 긴 이름·빈 이름 → n1, n2 … (UI: 내1)
    if (!name || name.length > 4 || /^myvoice_/i.test(name) || /^voice_/i.test(name)) {
      const alloc = await allocateShortVoiceName()
      name = alloc.id
    }
    const shortLabel = /^n(\d+)$/i.test(name)
      ? recordedVoiceLabel(Number(/^n(\d+)$/i.exec(name)![1]))
      : name.slice(0, 2)
    const audio = form.get("audio")
    const styleJson = form.get("styleJson") ?? form.get("file")

    const samplesDir = path.join(process.cwd(), "voices", "supertonic", "samples")
    const voicesDir = path.join(process.cwd(), "voices", "supertonic")
    await mkdir(samplesDir, { recursive: true })
    await mkdir(voicesDir, { recursive: true })

    const jsonPath = path.join(voicesDir, `${name}.json`)
    let method: "voice-builder-json" | "nearest-builtin-spectral" = "voice-builder-json"
    let extractMeta: Record<string, unknown> | null = null

    if (styleJson instanceof File && styleJson.size > 0) {
      const jsonText = await styleJson.text()
      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(jsonText) as Record<string, unknown>
      } catch {
        return NextResponse.json(
          { success: false, error: "유효한 JSON 파일이 아닙니다." },
          { status: 400 }
        )
      }
      if (!parsed.style_ttl || !parsed.style_dp) {
        return NextResponse.json(
          {
            success: false,
            error: "보이스 스타일 JSON이 아닙니다. style_ttl / style_dp 가 필요합니다.",
          },
          { status: 400 }
        )
      }
      const jsonBuf = Buffer.from(jsonText, "utf-8")
      await writeFile(jsonPath, jsonBuf)

      if (audio instanceof File && audio.size > 0) {
        const ext = audio.name.toLowerCase().endsWith(".wav")
          ? "wav"
          : audio.name.toLowerCase().endsWith(".mp3")
            ? "mp3"
            : "webm"
        await writeFile(
          path.join(samplesDir, `${name}.${ext}`),
          Buffer.from(await audio.arrayBuffer())
        )
      }

      const imported = await importStyleJson(name, jsonBuf, `${name}.json`)
      await appendRecordedRegistry(String(imported.name || name), shortLabel)
      return NextResponse.json({
        success: true,
        name: imported.name,
        voice_id: imported.name,
        label: shortLabel,
        stored_at: imported.stored_at,
        method,
        savedJsonPath: `voices/supertonic/${name}.json`,
      })
    }

    if (!(audio instanceof File) || audio.size < 1000) {
      return NextResponse.json(
        { success: false, error: "학습용 녹음 오디오가 필요합니다." },
        { status: 400 }
      )
    }

    const wavPath = path.join(samplesDir, `${name}.wav`)
    await writeFile(wavPath, Buffer.from(await audio.arrayBuffer()))

    const base = getSupertonicBaseUrl()
    const extract = await runPythonExtract({
      wavPath,
      name,
      outJson: jsonPath,
      baseUrl: base,
    })
    if (!extract.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            extract.stderr.trim().slice(0, 400) ||
            extract.stdout.trim().slice(0, 400) ||
            "보이스 JSON 자동 생성에 실패했습니다. 로컬 supertonic serve 가 켜져 있는지 확인하세요.",
          detail: extract.stdout.slice(-500),
        },
        { status: 500 }
      )
    }

    method = "nearest-builtin-spectral"
    try {
      const lines = extract.stdout.trim().split(/\r?\n/)
      const last = lines[lines.length - 1]
      extractMeta = JSON.parse(last) as Record<string, unknown>
    } catch {
      extractMeta = { raw: extract.stdout.slice(-300) }
    }

    const jsonBuf = Buffer.from(await readFile(jsonPath))
    const imported = await importStyleJson(name, jsonBuf, `${name}.json`)
    await appendRecordedRegistry(String(imported.name || name), shortLabel)

    return NextResponse.json({
      success: true,
      name: imported.name,
      voice_id: imported.name,
      label: shortLabel,
      stored_at: imported.stored_at,
      method,
      extract: extractMeta,
      savedJsonPath: `voices/supertonic/${name}.json`,
    })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "보이스 등록 실패" },
      { status: 500 }
    )
  }
}
