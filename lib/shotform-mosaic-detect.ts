import type { PlacedStudioOverlay } from "@/lib/shotform-studio-overlay-catalog"
import { pctBoxToMosaicOverlay } from "@/lib/mvp-mosaic-overlay-utils"

export type MosaicDetectFrameInput = {
  timeSec: number
  imageBase64: string
}

export type DetectedChineseMosaicBox = {
  center_x_pct: number
  center_y_pct: number
  width_pct: number
  height_pct: number
  text?: string
}

type FrameDetectRow = {
  timeSec: number
  boxes: DetectedChineseMosaicBox[]
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

async function visionDetectBatch(
  apiKey: string,
  frames: MosaicDetectFrameInput[]
): Promise<FrameDetectRow[]> {
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
  const out: FrameDetectRow[] = []

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

type Track = {
  centerXPct: number
  centerYPct: number
  widthPct: number
  heightPct: number
  text?: string
  startSec: number
  endSec: number
}

function trackDistance(box: DetectedChineseMosaicBox, track: Track): number {
  return Math.hypot(box.center_x_pct - track.centerXPct, box.center_y_pct - track.centerYPct)
}

function mergeFrameRows(rows: FrameDetectRow[]): Track[] {
  const tracks: Track[] = []
  const gapToleranceSec = 0.55
  const positionTolerance = 14

  for (const row of rows.sort((a, b) => a.timeSec - b.timeSec)) {
    for (const box of row.boxes) {
      let matched: Track | null = null
      for (const track of tracks) {
        if (row.timeSec - track.endSec > gapToleranceSec) continue
        if (trackDistance(box, track) > positionTolerance) continue
        if (
          box.text &&
          track.text &&
          box.text !== track.text &&
          trackDistance(box, track) > positionTolerance * 0.45
        ) {
          continue
        }
        matched = track
        break
      }

      if (matched) {
        matched.endSec = row.timeSec
        matched.centerXPct = (matched.centerXPct + box.center_x_pct) / 2
        matched.centerYPct = (matched.centerYPct + box.center_y_pct) / 2
        matched.widthPct = Math.max(matched.widthPct, box.width_pct)
        matched.heightPct = Math.max(matched.heightPct, box.height_pct)
        if (box.text) matched.text = box.text
      } else {
        tracks.push({
          centerXPct: box.center_x_pct,
          centerYPct: box.center_y_pct,
          widthPct: box.width_pct,
          heightPct: box.height_pct,
          text: box.text,
          startSec: row.timeSec,
          endSec: row.timeSec,
        })
      }
    }
  }

  return tracks
}

function tracksToOverlays(tracks: Track[], durationSec: number): PlacedStudioOverlay[] {
  const pad = 0.18
  return tracks.map((t, i) =>
    pctBoxToMosaicOverlay({
      id: `ov-ai-${i + 1}`,
      centerXPct: t.centerXPct,
      centerYPct: t.centerYPct,
      widthPct: Math.min(98, t.widthPct + 4),
      heightPct: Math.min(40, t.heightPct + 3),
      startSec: Math.max(0, t.startSec - pad),
      endSec: Math.min(durationSec, t.endSec + pad + 0.35),
      detectedText: t.text,
    })
  )
}

export async function detectChineseMosaicOverlays(args: {
  apiKey: string
  frames: MosaicDetectFrameInput[]
  durationSec: number
  onProgress?: (phase: string, ratio: number) => void
}): Promise<PlacedStudioOverlay[]> {
  const { apiKey, frames, durationSec, onProgress } = args
  if (!frames.length) return []

  const batchSize = 6
  const allRows: FrameDetectRow[] = []

  for (let i = 0; i < frames.length; i += batchSize) {
    const batch = frames.slice(i, i + batchSize)
    onProgress?.("vision", Math.min(0.92, (i + batch.length) / frames.length))
    const rows = await visionDetectBatch(apiKey, batch)
    allRows.push(...rows)
  }

  const tracks = mergeFrameRows(allRows)
  onProgress?.("merge", 0.98)
  return tracksToOverlays(tracks, durationSec)
}
