import { NextResponse } from "next/server"
import { geminiChatText } from "@/lib/longform-v2/gemini"
import {
  motionVideoSeedanceDurationSec,
  type MotionVideoResolution,
} from "@/lib/longform-v2/motion-video"

export const runtime = "nodejs"
export const maxDuration = 300

const REPLICATE_API = "https://api.replicate.com/v1"
const MODEL_PREDICTIONS = `${REPLICATE_API}/models/bytedance/seedance-1-pro-fast/predictions`

const FALLBACK_MOTION_PROMPT =
  "subtle natural motion, gentle ambient movement, cinematic smooth camera drift, lifelike scene animation"

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function extractVideoUrl(output: unknown): string | null {
  if (typeof output === "string" && /^https?:\/\//i.test(output)) return output
  if (Array.isArray(output)) {
    for (const x of output) {
      if (typeof x === "string" && /^https?:\/\//i.test(x)) return x
    }
  }
  if (output && typeof output === "object") {
    const o = output as Record<string, unknown>
    if (typeof o.url === "string" && /^https?:\/\//i.test(o.url)) return o.url
  }
  return null
}

async function bufferFromImageSource(source: string): Promise<{ buf: Buffer; filename: string }> {
  const src = source.trim()
  if (src.startsWith("data:")) {
    const m = src.match(/^data:([^;,]+)?(;base64)?,(.*)$/s)
    if (!m) throw new Error("이미지 data URL 형식이 올바르지 않습니다.")
    const mime = m[1] || "image/jpeg"
    const isB64 = Boolean(m[2])
    const data = m[3] || ""
    const buf = isB64 ? Buffer.from(data, "base64") : Buffer.from(decodeURIComponent(data), "utf8")
    const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg"
    return { buf, filename: `scene.${ext}` }
  }
  if (src.startsWith("http://") || src.startsWith("https://")) {
    const res = await fetch(src)
    if (!res.ok) throw new Error(`이미지 다운로드 실패 (${res.status})`)
    const mime = res.headers.get("content-type") || "image/jpeg"
    const buf = Buffer.from(await res.arrayBuffer())
    const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg"
    return { buf, filename: `scene.${ext}` }
  }
  throw new Error("지원하지 않는 이미지 URL입니다.")
}

async function uploadToReplicate(buf: Buffer, filename: string, token: string): Promise<string> {
  const mime =
    filename.endsWith(".png") ? "image/png" : filename.endsWith(".webp") ? "image/webp" : "image/jpeg"
  const form = new FormData()
  form.append("content", new Blob([new Uint8Array(buf)], { type: mime }), filename)
  const r = await fetch(`${REPLICATE_API}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  const j = (await r.json()) as { urls?: { get?: string }; detail?: string; error?: string }
  if (!r.ok) throw new Error(j.detail || j.error || `Replicate 파일 업로드 실패 (${r.status})`)
  const u = j.urls?.get
  if (!u?.startsWith("http")) throw new Error("Replicate 파일 URL을 받지 못했습니다.")
  return u
}

async function pollPrediction(id: string, token: string): Promise<string> {
  for (let i = 0; i < 180; i++) {
    const r = await fetch(`${REPLICATE_API}/predictions/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const p = (await r.json()) as { status?: string; output?: unknown; error?: unknown }
    if (!r.ok) throw new Error(`폴링 실패 (${r.status})`)
    if (p.status === "succeeded") {
      const url = extractVideoUrl(p.output)
      if (url) return url
      throw new Error("Replicate 응답에 비디오 URL이 없습니다.")
    }
    if (p.status === "failed" || p.status === "canceled") {
      throw new Error(typeof p.error === "string" ? p.error : "Replicate 예측 실패")
    }
    await sleep(2500)
  }
  throw new Error("Replicate 처리 시간 초과(약 7분).")
}

async function buildMotionPrompt(
  geminiApiKey: string,
  sceneText: string,
  promptEn?: string
): Promise<string> {
  const script = sceneText.trim()
  const imagePrompt = (promptEn || "").trim()
  const userBlock = [
    "You write English image-to-video motion prompts for ByteDance Seedance.",
    "Given the scene narration and still-image prompt, describe ONLY subtle natural motion:",
    "- gentle camera drift or slow push-in/pull-back when appropriate",
    "- ambient movement (wind, light, water, smoke, fabric, clouds)",
    "- minimal character micro-motion if people are present — no sudden actions",
    "Do NOT change the scene subject, style, or composition. No on-screen text.",
    "Output ONE line, 20–45 English words. No quotes, no markdown.",
    "",
    script ? `Scene narration (Korean): ${script}` : "",
    imagePrompt ? `Still image prompt: ${imagePrompt}` : "",
  ]
    .filter(Boolean)
    .join("\n")

  if (geminiApiKey.trim()) {
    try {
      const raw = await geminiChatText(geminiApiKey, userBlock, { temperature: 0.55 })
      const line = raw
        .trim()
        .replace(/^["'`]+|["'`]+$/g, "")
        .replace(/\s+/g, " ")
        .slice(0, 420)
      if (line.length >= 12) return line
    } catch {
      /* fallback */
    }
  }
  if (imagePrompt) return `${imagePrompt.slice(0, 200)}, ${FALLBACK_MOTION_PROMPT}`
  return FALLBACK_MOTION_PROMPT
}

/**
 * Seedance 1 Pro Fast — 정지 이미지 → 무음 AI 움직임 영상
 * WingsStudio detailModeMotionVideoService 와 동일 모델
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const imageUrl = String(body.imageUrl || "").trim()
    const sceneText = String(body.sceneText || "").trim()
    const promptEn = String(body.promptEn || body.prompt || "").trim()
    const replicateApiKey = String(body.replicateApiKey || "").trim()
    const geminiApiKey = String(body.geminiApiKey || "").trim()
    const ttsDurationSec =
      typeof body.ttsDurationSec === "number" && body.ttsDurationSec > 0
        ? body.ttsDurationSec
        : undefined
    const resolution = (String(body.resolution || "480p") as MotionVideoResolution) || "480p"

    if (!imageUrl) {
      return NextResponse.json({ success: false, error: "이미지가 필요합니다." }, { status: 400 })
    }
    if (!replicateApiKey) {
      return NextResponse.json(
        { success: false, error: "Replicate API 키가 필요합니다." },
        { status: 400 }
      )
    }

    const seedanceDurationSec = motionVideoSeedanceDurationSec(ttsDurationSec)
    const motionPrompt = await buildMotionPrompt(geminiApiKey, sceneText, promptEn || undefined)

    const { buf, filename } = await bufferFromImageSource(imageUrl)
    if (buf.length < 64) {
      return NextResponse.json({ success: false, error: "이미지 파일이 비어 있습니다." }, { status: 400 })
    }

    const uploaded = await uploadToReplicate(buf, filename, replicateApiKey)
    const duration = Math.max(2, Math.min(12, Math.round(seedanceDurationSec)))

    const r = await fetch(MODEL_PREDICTIONS, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${replicateApiKey}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({
        input: {
          image: uploaded,
          prompt: motionPrompt,
          resolution: ["480p", "720p", "1080p"].includes(resolution) ? resolution : "480p",
          duration,
          fps: 24,
          camera_fixed: false,
        },
      }),
    })

    const pred = (await r.json()) as {
      id?: string
      status?: string
      output?: unknown
      error?: unknown
      detail?: string
    }

    if (!r.ok) {
      return NextResponse.json(
        { success: false, error: pred.detail || (typeof pred.error === "string" ? pred.error : `예측 실패 (${r.status})`) },
        { status: 502 }
      )
    }

    let videoRemoteUrl: string | null = null
    if (pred.status === "succeeded") {
      videoRemoteUrl = extractVideoUrl(pred.output)
    } else if (pred.id) {
      videoRemoteUrl = await pollPrediction(pred.id, replicateApiKey)
    } else {
      return NextResponse.json(
        { success: false, error: "Replicate 예측 ID를 받지 못했습니다." },
        { status: 502 }
      )
    }

    if (!videoRemoteUrl) {
      return NextResponse.json(
        { success: false, error: "영상 URL을 받지 못했습니다." },
        { status: 502 }
      )
    }

    // 브라우저·IDB 저장용으로 data URL 변환 (용량 클 수 있음)
    let videoUrl = videoRemoteUrl
    try {
      const vRes = await fetch(videoRemoteUrl)
      if (vRes.ok) {
        const arr = Buffer.from(await vRes.arrayBuffer())
        if (arr.length > 0 && arr.length < 45 * 1024 * 1024) {
          videoUrl = `data:video/mp4;base64,${arr.toString("base64")}`
        }
      }
    } catch {
      /* remote URL 유지 */
    }

    return NextResponse.json({
      success: true,
      videoUrl,
      remoteUrl: videoRemoteUrl,
      durationSec: duration,
      seedanceDurationSec: duration,
      motionPrompt,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI 영상 생성 실패"
    console.error("[longform-v2/motion-video]", message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
