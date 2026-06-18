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

const MOSAIC_VISION_SYSTEM = `You are a high-recall OCR/localization model for burned-in Chinese text in vertical short-form videos (9:16).

Your goal is to find EVERY visible Chinese character overlay — missing text is worse than a slightly oversized box.

Detect ALL Chinese characters (Simplified or Traditional) that appear as:
- hard subtitles, burned captions, floating on-screen text overlays, product title cards, price tags, corner stickers
- white, yellow, red, or outlined text on ANY background (floor, sofa, wall, product, sky)
- even 1–3 character labels (e.g. 地刷, 推荐, 爆款) — use a small tight box
- faint, semi-transparent, or motion-blurred Chinese if still readable
- multiple lines = separate boxes per line (never merge stacked lines into one tall box)

DO NOT include: Korean/English TTS narration subtitles (usually a dark bar at TOP, top_pct < 18%), tiny packaging micro-text on product labels, logos without Chinese, faces.

Korean TTS subtitles sit in a dark bar at the TOP — never mark that band as Chinese.
Chinese burned-in subtitles are VERY COMMON at bottom-center (top_pct 72–90%) as 1–2 white/yellow outlined lines — ALWAYS check this band.
Chinese also appears MID-FRAME (top_pct 28–72%): captions on floor, sofa, wall, product — scan the entire frame systematically top-to-bottom.
Check ALL four corners for small Chinese stickers/tags.

For each Chinese text region return a TIGHT bounding box covering the glyph pixels with ~1% margin.
- The "text" field MUST match the Chinese visible inside the box — never OCR text with a box on blank floor/wall.
- ONE line height ≈ 3–8% of frame height — do not include large blank margins above/below glyphs.
- Small corner tags = small tight boxes at that corner only.
- Do NOT return one box covering the entire lower-third safe area.

Coordinates are percentages of the FULL image frame (0=left/top, 100=right/bottom).
Prefer left_pct, top_pct, right_pct, bottom_pct.
Or center_x_pct, center_y_pct, width_pct, height_pct.

When unsure whether faint pixels are Chinese, include the box with your best OCR guess.
If no Chinese overlay text in a frame, return empty boxes array.`

function clampPct(n: number): number {
  return Math.min(100, Math.max(0, n))
}

function padBox(box: DetectedChineseMosaicBox, padPct = 0.85): DetectedChineseMosaicBox {
  const rect = {
    left: box.center_x_pct - box.width_pct / 2,
    top: box.center_y_pct - box.height_pct / 2,
    right: box.center_x_pct + box.width_pct / 2,
    bottom: box.center_y_pct + box.height_pct / 2,
  }
  const left = clampPct(rect.left - padPct)
  const top = clampPct(rect.top - padPct)
  const right = clampPct(rect.right + padPct)
  const bottom = clampPct(rect.bottom + padPct)
  return {
    center_x_pct: (left + right) / 2,
    center_y_pct: (top + bottom) / 2,
    width_pct: Math.max(2, right - left),
    height_pct: Math.max(1.5, bottom - top),
    text: box.text,
  }
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
  if (w < 0.6 || h < 0.4) return null
  // OCR 있는데 bbox만 화면 최하단 여백(글자 없음) — 좌표 불일치
  if (text && CHINESE_RE.test(text) && cy > 92 && h < 5) return null
  // 상단 한국어 TTS 띠만 제외 (하단 넓은 중국어 자막은 허용)
  if (cy < 20 && w > 55 && h > 7) return null

  return padBox({
    center_x_pct: clampPct(cx),
    center_y_pct: clampPct(cy),
    width_pct: clampPct(w),
    height_pct: clampPct(h),
    text,
  })
}

export async function visionDetectMosaicBatch(
  apiKey: string,
  frames: MosaicDetectFrameInput[],
  options?: { highDetail?: boolean; recallMode?: boolean }
): Promise<MosaicFrameDetectRow[]> {
  const highDetail = options?.highDetail ?? frames.length <= 2
  const recallMode = options?.recallMode === true
  const model = recallMode ? "gpt-4o" : "gpt-4o-mini"
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
      model,
      temperature: 0,
      max_tokens: recallMode ? 4096 : 3200,
      response_format: { type: "json_object" as const },
      messages: [
        {
          role: "system" as const,
          content: `${MOSAIC_VISION_SYSTEM}

JSON: {"frames":[{"index":0,"boxes":[{"left_pct":10,"top_pct":76,"right_pct":90,"bottom_pct":84,"text":"一般我清理地毯会直接调三档"}]}]}`,
        },
        {
          role: "user" as const,
          content: [
            {
              type: "text",
              text: recallMode
                ? `프레임 ${images.length}장 (9:16 세로). index 순 = timeSec 순.
각 프레임을 위→아래 전체 스캔하며 보이는 중국어 자막/오버레이를 빠짐없이 boxes에 넣으세요.
하단 72–90% 흰/노란 자막, 중앙 바닥·소파·벽 위 자막, 모서리 짧은 태그(2~4자)도 반드시 포함.
흐릿해도 읽히면 포함. text와 box는 같은 글자 줄. 바닥 여백만 덮는 box 금지.`
                : `프레임 ${images.length}장 (9:16 세로). index 순 = timeSec 순.
각 프레임마다 보이는 중국어 자막/오버레이만 글자 픽셀에 딱 맞게 boxes에 넣으세요.
바닥·소파·벽 위 흰색/노란 중국어 자막도 빠짐없이. text와 box는 반드시 같은 글자 줄. 바닥 여백만 덮는 box 금지.`,
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
    signal: AbortSignal.timeout(recallMode ? 90_000 : 55_000),
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
