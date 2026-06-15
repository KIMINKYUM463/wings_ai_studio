import fs from "fs/promises"
import type { VideoProductFit } from "@/lib/shotform-auto-edit-types"
import {
  descriptionSuggestsProductInUse,
  type SceneContentType,
} from "@/lib/shotform-auto-edit-product-filter"
import {
  ACTION_VISION_FRAME_SYSTEM_PROMPT,
  parseActionFrameFromVisionRow,
} from "@/lib/shotform-scene-understanding"
import { extractVideoKeyframes } from "@/lib/shotform-auto-edit-ffmpeg"

type FrameVisionResult = {
  timeSec: number
  content_type: SceneContentType
  caption?: string
  shot_type?: string
  hand_action?: string
  product?: string
  product_use?: string
  ocr_text?: string
  scene_hint?: string
}

export type VideoVisionScreenResult = {
  product_fit: VideoProductFit
  product_fit_reason: string
  frames: FrameVisionResult[]
}

  const CONTENT_TYPES: SceneContentType[] = [
  "product_only",
  "product_in_use",
  "person_presenting",
  "talking_head",
  "mixed",
  "text_overlay",
  "other",
]

export async function visionClassifyFrames(
  apiKey: string,
  title: string,
  frames: Array<{ path: string; timeSec: number }>
): Promise<FrameVisionResult[]> {
  const images = await Promise.all(
    frames.map(async (f) => {
      const buf = await fs.readFile(f.path)
      return { timeSec: f.timeSec, b64: buf.toString("base64") }
    })
  )

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.1,
      max_tokens: 2800,
      response_format: { type: "json_object" as const },
      messages: [
        {
          role: "system" as const,
          content: ACTION_VISION_FRAME_SYSTEM_PROMPT + `

JSON: {"frames":[{"index":0,"content_type":"product_in_use","shot_type":"클로즈업","hand_action":"손이 벽에 거치대를 눌러 붙이는 중","product":"칫솔 거치대","product_use":"무타공 벽면 부착","ocr_text":"无需打孔","scene_hint":"설치"}]}`,
        },
        {
          role: "user" as const,
          content: [
            {
              type: "text",
              text: `제목: ${title || "(없음)"}
프레임 ${images.length}장, index 0=앞 구간 순.

JSON: {"frames":[{"index":0,"content_type":"product_in_use","shot_type":"클로즈업","hand_action":"손이 벽에 거치대를 눌러 붙이는 중","product":"칫솔 거치대","product_use":"무타공 벽면 부착","ocr_text":"","scene_hint":"설치"}]}`,
            },
            ...images.map((img) => ({
              type: "image_url" as const,
              image_url: { url: `data:image/jpeg;base64,${img.b64}`, detail: "low" as const },
            })),
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(90_000),
  })

  if (!res.ok) {
    const t = await res.text().catch(() => "")
    throw new Error(`Vision 분류 실패 (${res.status}): ${t.slice(0, 120)}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error("Vision 응답 비어 있음")

  const parsed = JSON.parse(content) as { frames?: unknown }
  const raw = Array.isArray(parsed.frames) ? parsed.frames : []
  const out: FrameVisionResult[] = []

  for (let i = 0; i < frames.length; i++) {
    const row = raw.find((r) => (r as Record<string, unknown>)?.index === i) as
      | Record<string, unknown>
      | undefined
    const rowFallback = raw[i] as Record<string, unknown> | undefined
    const ctRaw = String((row || rowFallback)?.content_type || "other")
    let ct = ctRaw as SceneContentType
    if (ctRaw === "subtitle") ct = "text_overlay"
    const parsed = parseActionFrameFromVisionRow(
      (row || rowFallback || {}) as Record<string, unknown>,
      frames[i]!.timeSec,
      CONTENT_TYPES.includes(ct) ? ct : "other"
    )
    if (
      (parsed.content_type === "mixed" ||
        parsed.content_type === "person_presenting" ||
        parsed.content_type === "talking_head") &&
      parsed.hand_action &&
      descriptionSuggestsProductInUse(parsed.hand_action)
    ) {
      parsed.content_type = "product_in_use"
    }
    out.push({
      timeSec: frames[i]!.timeSec,
      content_type: parsed.content_type,
      ...(parsed.caption ? { caption: parsed.caption } : {}),
      ...(parsed.shot_type ? { shot_type: parsed.shot_type } : {}),
      ...(parsed.hand_action ? { hand_action: parsed.hand_action } : {}),
      ...(parsed.product ? { product: parsed.product } : {}),
      ...(parsed.product_use ? { product_use: parsed.product_use } : {}),
      ...(parsed.ocr_text ? { ocr_text: parsed.ocr_text } : {}),
      ...(parsed.scene_hint ? { scene_hint: parsed.scene_hint } : {}),
    })
  }

  if (!out.length) {
    return frames.map((f) => ({ timeSec: f.timeSec, content_type: "other" as SceneContentType }))
  }
  return out
}

export type LabeledVisionFrame = {
  srcIndex: number
  path: string
  timeSec: number
}

const VISION_BATCH_CHUNK_SIZE = 8

function mapVisionBatchRows(
  flat: LabeledVisionFrame[],
  raw: unknown[],
  imageIndexOffset: number
): Array<FrameVisionResult & { srcIndex: number }> {
  const out: Array<FrameVisionResult & { srcIndex: number }> = []
  for (let i = 0; i < flat.length; i++) {
    const f = flat[i]!
    const globalIndex = imageIndexOffset + i
    const row = raw.find((r) => (r as Record<string, unknown>)?.imageIndex === globalIndex) as
      | Record<string, unknown>
      | undefined
    const rowFallback = raw.find((r) => (r as Record<string, unknown>)?.imageIndex === i) as
      | Record<string, unknown>
      | undefined
    const rowByOrder = raw[i] as Record<string, unknown> | undefined
    const picked = row || rowFallback || rowByOrder
    const srcIndex = Number(picked?.srcIndex ?? f.srcIndex)
    const timeSec = Number(picked?.timeSec ?? f.timeSec)
    const ctRaw = String(picked?.content_type || "other")
    let ct = ctRaw as SceneContentType
    if (ctRaw === "subtitle") ct = "text_overlay"
    const parsed = parseActionFrameFromVisionRow(
      (picked || {}) as Record<string, unknown>,
      Number.isFinite(timeSec) ? timeSec : f.timeSec,
      CONTENT_TYPES.includes(ct) ? ct : "other"
    )
    if (
      (parsed.content_type === "mixed" ||
        parsed.content_type === "person_presenting" ||
        parsed.content_type === "talking_head") &&
      parsed.hand_action &&
      descriptionSuggestsProductInUse(parsed.hand_action)
    ) {
      parsed.content_type = "product_in_use"
    }
    out.push({
      srcIndex: Number.isFinite(srcIndex) ? srcIndex : f.srcIndex,
      timeSec: Number.isFinite(timeSec) ? timeSec : f.timeSec,
      content_type: parsed.content_type,
      ...(parsed.caption ? { caption: parsed.caption } : {}),
      ...(parsed.shot_type ? { shot_type: parsed.shot_type } : {}),
      ...(parsed.hand_action ? { hand_action: parsed.hand_action } : {}),
      ...(parsed.product ? { product: parsed.product } : {}),
      ...(parsed.product_use ? { product_use: parsed.product_use } : {}),
      ...(parsed.ocr_text ? { ocr_text: parsed.ocr_text } : {}),
      ...(parsed.scene_hint ? { scene_hint: parsed.scene_hint } : {}),
    })
  }
  return out
}

async function visionClassifyFramesBatchOnce(
  apiKey: string,
  labelLines: string,
  flat: LabeledVisionFrame[],
  images: Array<LabeledVisionFrame & { b64: string }>,
  imageIndexOffset: number
): Promise<Array<FrameVisionResult & { srcIndex: number }>> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.1,
      max_tokens: Math.min(3200, 600 + flat.length * 180),
      response_format: { type: "json_object" as const },
      messages: [
        {
          role: "system" as const,
          content: ACTION_VISION_FRAME_SYSTEM_PROMPT + `

imageIndex·srcIndex·timeSec 매핑 필수.
JSON: {"frames":[{"imageIndex":${imageIndexOffset},"srcIndex":0,"timeSec":1.2,"content_type":"product_in_use","shot_type":"클로즈업","hand_action":"손이 칫솔을 거치대에 꽂는 중","product":"칫솔 거치대","product_use":"칫솔 수납","ocr_text":"","scene_hint":"수납"}]}`,
        },
        {
          role: "user" as const,
          content: [
            {
              type: "text",
              text: `${labelLines}\n이미지 ${images.length}장, imageIndex ${imageIndexOffset}부터 순서대로.\n각 caption은 해당 프레임에 실제 보이는 것만.`,
            },
            ...images.map((img) => ({
              type: "image_url" as const,
              image_url: { url: `data:image/jpeg;base64,${img.b64}`, detail: "low" as const },
            })),
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(flat.length <= 4 ? 28_000 : 50_000),
  })

  if (!res.ok) {
    const t = await res.text().catch(() => "")
    throw new Error(`Vision 배치 실패 (${res.status}): ${t.slice(0, 120)}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error("Vision 배치 응답 비어 있음")

  const parsed = JSON.parse(content) as { frames?: unknown }
  const raw = Array.isArray(parsed.frames) ? parsed.frames : []
  return mapVisionBatchRows(flat, raw, imageIndexOffset)
}

/** 여러 소스 키프레임 — Vision API (8장 단위 청크로 타임아웃·실패 완화) */
export async function visionClassifyFramesBatch(
  apiKey: string,
  sources: Array<{ srcIndex: number; title: string; frames: Array<{ path: string; timeSec: number }> }>
): Promise<Array<FrameVisionResult & { srcIndex: number }>> {
  const flat: LabeledVisionFrame[] = []
  for (const s of sources) {
    for (const f of s.frames) {
      flat.push({ srcIndex: s.srcIndex, path: f.path, timeSec: f.timeSec })
    }
  }
  if (!flat.length) return []

  const images = await Promise.all(
    flat.map(async (f) => {
      const buf = await fs.readFile(f.path)
      return { ...f, b64: buf.toString("base64") }
    })
  )

  const labelLines = sources
    .map((s) => `소스${s.srcIndex}: ${s.title || "(제목 없음)"} — 프레임 ${s.frames.length}장`)
    .join("\n")

  if (flat.length <= VISION_BATCH_CHUNK_SIZE) {
    return visionClassifyFramesBatchOnce(apiKey, labelLines, flat, images, 0)
  }

  const merged: Array<FrameVisionResult & { srcIndex: number }> = []
  for (let off = 0; off < flat.length; off += VISION_BATCH_CHUNK_SIZE) {
    const chunkFlat = flat.slice(off, off + VISION_BATCH_CHUNK_SIZE)
    const chunkImages = images.slice(off, off + VISION_BATCH_CHUNK_SIZE)
    const chunk = await visionClassifyFramesBatchOnce(
      apiKey,
      labelLines,
      chunkFlat,
      chunkImages,
      off
    )
    merged.push(...chunk)
  }
  return merged
}

function decideProductFit(frames: FrameVisionResult[], _title: string): VideoVisionScreenResult {
  if (!frames.length) {
    return {
      product_fit: "rejected",
      product_fit_reason: "분석할 프레임이 없습니다.",
      frames,
    }
  }

  const safe = frames.filter(
    (f) => f.content_type === "product_only" || f.content_type === "product_in_use"
  )

  if (safe.length >= frames.length * 0.4) {
    return {
      product_fit: "approved",
      product_fit_reason: "편집 가능한 장면이 확인되었습니다.",
      frames,
    }
  }

  return {
    product_fit: "approved",
    product_fit_reason: "인물·제품 장면 모두 편집에 사용합니다.",
    frames,
  }
}

/** 짜집기 편집 컷마다 해당 소스 시각 프레임을 캡션 (실제 화면 기준) */
export async function captionEditPlanCuts(args: {
  apiKey: string
  title: string
  sourcePath: string
  workDir: string
  duration: number
  cuts: Array<{ source_start: number; source_end: number }>
}): Promise<Map<string, string>> {
  const { apiKey, title, sourcePath, workDir, duration, cuts } = args
  await fs.mkdir(workDir, { recursive: true })
  const { extractVideoKeyframeAtTime } = await import("@/lib/shotform-auto-edit-ffmpeg")

  const uniqueTimes: number[] = []
  const timeKeys = new Set<string>()
  for (const cut of cuts) {
    const mid = Math.max(0.05, Math.min(duration - 0.1, (cut.source_start + cut.source_end) / 2))
    const key = mid.toFixed(2)
    if (!timeKeys.has(key)) {
      timeKeys.add(key)
      uniqueTimes.push(mid)
    }
  }

  if (!uniqueTimes.length) return new Map()

  const frames: Array<{ path: string; timeSec: number }> = []
  for (let i = 0; i < uniqueTimes.length; i++) {
    frames.push(
      await extractVideoKeyframeAtTime(sourcePath, workDir, duration, uniqueTimes[i]!, `cut_${i}`)
    )
  }

  const classified = await visionClassifyFrames(apiKey, title, frames)
  const out = new Map<string, string>()
  for (const row of classified) {
    if (row.caption?.trim()) out.set(row.timeSec.toFixed(2), row.caption.trim())
  }
  return out
}

export async function screenVideoForProductContent(args: {
  apiKey: string
  title: string
  sourcePath: string
  workDir: string
  duration: number
}): Promise<VideoVisionScreenResult> {
  const { apiKey, title, sourcePath, workDir, duration } = args
  await fs.mkdir(workDir, { recursive: true })
  const keyframes = await extractVideoKeyframes(sourcePath, workDir, duration, 8)
  const frames = await visionClassifyFrames(apiKey, title, keyframes)
  return decideProductFit(frames, title)
}
