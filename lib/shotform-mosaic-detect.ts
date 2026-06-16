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

const MOSAIC_VISION_SYSTEM = `You are a precise OCR/localization model for burned-in Chinese text in vertical short-form videos.

Detect ONLY Chinese characters (Simplified or Traditional) that appear as:
- hard subtitles, burned captions, floating on-screen text overlays

DO NOT include: Korean/English TTS subtitles, product packaging micro-text, logos, faces, backgrounds.

For each Chinese text region return a TIGHT bounding box covering the glyphs with ~2% margin—not the entire lower third.
Multiple lines = separate boxes.

Prefer left_pct, top_pct, right_pct, bottom_pct (0-100 of full frame).
Or center_x_pct, center_y_pct, width_pct, height_pct.

If no Chinese overlay text in a frame, return empty boxes array.`

function clampPct(n: number): number {
  return Math.min(100, Math.max(0, n))
}

function parseBox(raw: unknown): DetectedChineseMosaicBox | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>

  const left = Number(o.left_pct ?? o.x1_pct)
  const top = Number(o.top_pct ?? o.y1_pct)
  const right = Number(o.right_pct ?? o.x2_pct)
  const bottom = Number(o.bottom_pct ?? o.y2_pct)

  let cx: number
  let cy: number
  let w: number
  let h: number

  if ([left, top, right, bottom].every(Number.isFinite) && right > left && bottom > top) {
    cx = (left + right) / 2
    cy = (top + bottom) / 2
    w = right - left
    h = bottom - top
  } else {
    cx = Number(o.center_x_pct ?? o.x_pct ?? o.x)
    cy = Number(o.center_y_pct ?? o.y_pct ?? o.y)
    w = Number(o.width_pct ?? o.w_pct ?? o.w)
    h = Number(o.height_pct ?? o.h_pct ?? o.h)
  }

  if (![cx, cy, w, h].every(Number.isFinite)) return null
  const text = typeof o.text === "string" ? o.text.trim() : undefined
  if (text && !CHINESE_RE.test(text)) return null
  if (w < 1.2 || h < 0.8) return null

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
  frames: MosaicDetectFrameInput[],
  options?: { highDetail?: boolean }
): Promise<MosaicFrameDetectRow[]> {
  const highDetail = options?.highDetail ?? frames.length <= 2
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
      temperature: 0,
      max_tokens: 3200,
      response_format: { type: "json_object" as const },
      messages: [
        {
          role: "system" as const,
          content: `${MOSAIC_VISION_SYSTEM}

JSON: {"frames":[{"index":0,"boxes":[{"left_pct":8,"top_pct":82,"right_pct":92,"bottom_pct":91,"text":"无需打孔"}]}]}`,
        },
        {
          role: "user" as const,
          content: [
            {
              type: "text",
              text: `프레임 ${images.length}장 (9:16 세로). index 순 = timeSec 순.
각 프레임마다 보이는 중국어 자막/오버레이만 글자에 딱 맞게 boxes에 넣으세요. 큰 띠 박스 금지.`,
            },
            ...images.flatMap((img, index) => [
              { type: "text" as const, text: `index ${index} · timeSec ${img.timeSec}s` },
              {
                type: "image_url" as const,
                image_url: {
                  url: `data:image/jpeg;base64,${img.b64}`,
                  detail: highDetail ? ("high" as const) : ("auto" as const),
                },
              },
            ]),
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

export async function detectChineseMosaicOverlays(args: {
  apiKey: string
  frames: MosaicDetectFrameInput[]
  durationSec: number
  batchSize?: number
  highDetail?: boolean
  onProgress?: (phase: string, ratio: number) => void
}): Promise<PlacedStudioOverlay[]> {
  const { apiKey, frames, durationSec, batchSize = 2, highDetail, onProgress } = args
  if (!frames.length) return []

  const allRows: MosaicFrameDetectRow[] = []

  for (let i = 0; i < frames.length; i += batchSize) {
    const batch = frames.slice(i, i + batchSize)
    onProgress?.("vision", Math.min(0.92, (i + batch.length) / frames.length))
    const rows = await visionDetectMosaicBatch(apiKey, batch, { highDetail })
    allRows.push(...rows)
  }

  onProgress?.("merge", 0.98)
  return mergeMosaicRowsToOverlays(allRows, durationSec)
}
