import type { PlacedStudioOverlay } from "@/lib/shotform-studio-overlay-catalog"
import {
  mergeMosaicRowsToOverlays,
  type DetectedChineseMosaicBox,
  type MosaicFrameDetectRow,
} from "@/lib/mvp-mosaic-merge"

export type { DetectedChineseMosaicBox, MosaicFrameDetectRow }
export { mergeMosaicRowsToOverlays }

export type MosaicDetectFrameInput = {
  timeSec: number
  imageBase64: string
}

const CHINESE_RE = /[\u4e00-\u9fff\u3400-\u4dbf]/

const MOSAIC_VISION_SYSTEM = `You detect burned-in Chinese text (Simplified or Traditional) in short-form product videos.
Focus on: hard subtitles, on-screen captions, floating Chinese labels overlaid on video.
Ignore: tiny packaging text, watermarks under 3% frame height, Korean/English TTS subtitles if separate.
Return tight bounding boxes around each distinct Chinese text region.
Coordinates: center_x_pct, center_y_pct, width_pct, height_pct — all 0-100 relative to full frame.
If no Chinese overlay text in a frame, return empty boxes array.`

function clampPct(n: number): number {
  return Math.min(100, Math.max(0, n))
}

function parseBox(raw: unknown): DetectedChineseMosaicBox | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const cx = Number(o.center_x_pct ?? o.x_pct ?? o.x)
  const cy = Number(o.center_y_pct ?? o.y_pct ?? o.y)
  const w = Number(o.width_pct ?? o.w_pct ?? o.w)
  const h = Number(o.height_pct ?? o.h_pct ?? o.h)
  if (![cx, cy, w, h].every(Number.isFinite)) return null
  const text = typeof o.text === "string" ? o.text.trim() : undefined
  if (text && !CHINESE_RE.test(text)) return null
  if (w < 2 || h < 1.5) return null
  return {
    center_x_pct: clampPct(cx),
    center_y_pct: clampPct(cy),
    width_pct: clampPct(w),
    height_pct: clampPct(h),
    text,
  }
}

export async function visionDetectMosaicBatch(
  apiKey: string,
  frames: MosaicDetectFrameInput[]
): Promise<MosaicFrameDetectRow[]> {
  const images = frames.map((f) => ({
    timeSec: f.timeSec,
    b64: f.imageBase64.replace(/^data:image\/\w+;base64,/, ""),
  }))

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.05,
      max_tokens: 2400,
      response_format: { type: "json_object" as const },
      messages: [
        {
          role: "system" as const,
          content: `${MOSAIC_VISION_SYSTEM}

JSON: {"frames":[{"index":0,"boxes":[{"center_x_pct":50,"center_y_pct":86,"width_pct":88,"height_pct":11,"text":"无需打孔"}]}]}`,
        },
        {
          role: "user" as const,
          content: [
            {
              type: "text",
              text: `프레임 ${images.length}장. index 0 = timeSec ${images[0]?.timeSec ?? 0}s 순.
각 프레임의 중국어 오버레이 텍스트 영역만 boxes에 넣으세요.`,
            },
            ...images.map((img, index) => ({
              type: "text" as const,
              text: `index ${index} · timeSec ${img.timeSec}`,
            })),
            ...images.map((img) => ({
              type: "image_url" as const,
              image_url: { url: `data:image/jpeg;base64,${img.b64}`, detail: "low" as const },
            })),
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  })

  if (!res.ok) {
    const t = await res.text().catch(() => "")
    throw new Error(`AI 모자이크 감지 실패 (${res.status}): ${t.slice(0, 160)}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error("AI 응답이 비어 있습니다.")

  const parsed = JSON.parse(content) as { frames?: unknown }
  const rawFrames = Array.isArray(parsed.frames) ? parsed.frames : []
  const out: MosaicFrameDetectRow[] = []

  for (let i = 0; i < frames.length; i++) {
    const row = rawFrames.find((r) => (r as Record<string, unknown>)?.index === i) as
      | Record<string, unknown>
      | undefined
    const rowFallback = rawFrames[i] as Record<string, unknown> | undefined
    const boxesRaw = (row || rowFallback)?.boxes
    const boxes: DetectedChineseMosaicBox[] = []
    if (Array.isArray(boxesRaw)) {
      for (const b of boxesRaw) {
        const box = parseBox(b)
        if (box) boxes.push(box)
      }
    }
    out.push({ timeSec: frames[i]!.timeSec, boxes })
  }

  return out
}

/** API·서버 일괄 처리 — 요청당 프레임 수는 작게 유지 */
export async function detectChineseMosaicOverlays(args: {
  apiKey: string
  frames: MosaicDetectFrameInput[]
  durationSec: number
  batchSize?: number
  onProgress?: (phase: string, ratio: number) => void
}): Promise<PlacedStudioOverlay[]> {
  const { apiKey, frames, durationSec, batchSize = 4, onProgress } = args
  if (!frames.length) return []

  const allRows: MosaicFrameDetectRow[] = []

  for (let i = 0; i < frames.length; i += batchSize) {
    const batch = frames.slice(i, i + batchSize)
    onProgress?.("vision", Math.min(0.92, (i + batch.length) / frames.length))
    const rows = await visionDetectMosaicBatch(apiKey, batch)
    allRows.push(...rows)
  }

  onProgress?.("merge", 0.98)
  return mergeMosaicRowsToOverlays(allRows, durationSec)
}
