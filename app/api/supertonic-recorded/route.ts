import { mkdir, readFile, unlink, writeFile } from "fs/promises"
import path from "path"
import { type NextRequest, NextResponse } from "next/server"
import {
  isRecordedVoiceId,
  type RecordedSupertonicVoice,
  recordedVoiceId,
  recordedVoiceLabel,
} from "@/lib/supertonic-recorded"
import { getSupertonicBaseUrl } from "@/lib/supertonic-local"
import os from "os"

export const runtime = "nodejs"

function recordedPath() {
  return path.join(process.cwd(), "voices", "supertonic", "recorded.json")
}

async function readRegistry(): Promise<RecordedSupertonicVoice[]> {
  try {
    const raw = await readFile(recordedPath(), "utf-8")
    const parsed = JSON.parse(raw) as { voices?: RecordedSupertonicVoice[] }
    return Array.isArray(parsed.voices) ? parsed.voices : []
  } catch {
    return []
  }
}

async function writeRegistry(voices: RecordedSupertonicVoice[]) {
  const dir = path.dirname(recordedPath())
  await mkdir(dir, { recursive: true })
  await writeFile(
    recordedPath(),
    JSON.stringify({ voices }, null, 2),
    "utf-8"
  )
}

function customStylesDir(): string {
  const env = process.env.SUPERTONIC_CUSTOM_STYLES_DIR
  if (env) return env
  return path.join(os.homedir(), ".cache", "supertonic3", "custom_styles")
}

async function safeUnlink(filePath: string) {
  try {
    await unlink(filePath)
  } catch {
    /* ignore missing */
  }
}

/** 녹음 보이스 목록 (+ 다음 할당 id) */
export async function GET() {
  let voices = await readRegistry()

  // 디스크에 남은 myvoice_* / n* 를 레지스트리에 동기화
  try {
    const { readdir } = await import("fs/promises")
    const stylesDir = customStylesDir()
    const files = await readdir(stylesDir).catch(() => [] as string[])
    const existingIds = new Set(voices.map((v) => v.id))
    let maxN = voices.reduce((m, v) => {
      const n = Number(/^n(\d+)$/i.exec(v.id)?.[1] || 0)
      return Math.max(m, n)
    }, 0)

    for (const f of files) {
      if (!f.endsWith(".json")) continue
      const id = f.replace(/\.json$/i, "")
      if (!isRecordedVoiceId(id) || existingIds.has(id)) continue
      maxN += 1
      const label = /^n(\d+)$/i.test(id)
        ? recordedVoiceLabel(Number(/^n(\d+)$/i.exec(id)![1]))
        : recordedVoiceLabel(maxN)
      const entry: RecordedSupertonicVoice = {
        id,
        label: /^n\d+$/i.test(id) ? label : recordedVoiceLabel(maxN),
        createdAt: new Date().toISOString(),
      }
      // myvoice_* 도 짧은 라벨만 UI에 붙임 (id는 그대로)
      if (/^myvoice_/i.test(id)) {
        entry.label = recordedVoiceLabel(maxN)
      }
      voices.push(entry)
      existingIds.add(id)
    }
    if (voices.length) await writeRegistry(voices)
  } catch {
    /* ignore sync errors */
  }

  const used = new Set(
    voices.map((v) => Number(/^n(\d+)$/i.exec(v.id)?.[1] || 0)).filter(Boolean)
  )
  let nextIndex = 1
  while (used.has(nextIndex)) nextIndex += 1

  return NextResponse.json({
    success: true,
    voices,
    nextId: recordedVoiceId(nextIndex),
    nextLabel: recordedVoiceLabel(nextIndex),
  })
}

/** 녹음 보이스 삭제 (파일 + 레지스트리). serve 메모리까지 지우려면 재시작 필요 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const name = String(searchParams.get("name") || "").trim()
    if (!name || !isRecordedVoiceId(name)) {
      return NextResponse.json(
        { success: false, error: "삭제할 수 있는 녹음 보이스 id가 아닙니다." },
        { status: 400 }
      )
    }

    const voices = await readRegistry()
    const next = voices.filter((v) => v.id !== name)
    await writeRegistry(next)

    const stylesDir = customStylesDir()
    await safeUnlink(path.join(stylesDir, `${name}.json`))
    await safeUnlink(path.join(process.cwd(), "voices", "supertonic", `${name}.json`))
    for (const ext of ["wav", "webm", "mp3"]) {
      await safeUnlink(
        path.join(process.cwd(), "voices", "supertonic", "samples", `${name}.${ext}`)
      )
    }

    return NextResponse.json({
      success: true,
      name,
      baseUrl: getSupertonicBaseUrl(),
      note: "목록·파일에서 삭제했습니다. 로컬 serve가 예전 목록을 들고 있으면 serve를 한 번 재시작해 주세요.",
    })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "삭제 실패" },
      { status: 500 }
    )
  }
}

/** 레지스트리에 기록 (train API에서도 호출 가능) */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      id?: string
      label?: string
    }
    const id = String(body.id || "").trim()
    if (!id || !isRecordedVoiceId(id)) {
      return NextResponse.json({ success: false, error: "잘못된 id" }, { status: 400 })
    }
    const voices = await readRegistry()
    if (voices.some((v) => v.id === id)) {
      return NextResponse.json({ success: true, voices, existed: true })
    }
    const idx = Number(/^n(\d+)$/i.exec(id)?.[1] || voices.length + 1)
    const entry: RecordedSupertonicVoice = {
      id,
      label: String(body.label || recordedVoiceLabel(idx)).slice(0, 8),
      createdAt: new Date().toISOString(),
    }
    voices.push(entry)
    await writeRegistry(voices)
    return NextResponse.json({ success: true, voices, entry })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "저장 실패" },
      { status: 500 }
    )
  }
}
