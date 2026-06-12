import fs from "fs/promises"
import type { VideoProductFit } from "@/lib/shotform-auto-edit-types"
import {
  descriptionSuggestsProductInUse,
  type SceneContentType,
} from "@/lib/shotform-auto-edit-product-filter"
import { extractVideoKeyframes } from "@/lib/shotform-auto-edit-ffmpeg"

type FrameVisionResult = {
  timeSec: number
  content_type: SceneContentType
  caption?: string
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
          content: `쇼핑 숏폼 영상 프레임 분류기. JSON만 출력.
각 프레임마다 content_type + caption(한국어 30~70자, **이 프레임에 실제로 보이는** 배경·제품·행동만. 제목·추측·이전 장면 맥락 금지).
content_type:
- product_only: 제품만 클로즈업·와이드 (사람 없음)
- product_in_use: **제품을 사용·시연·조작**하는 장면. 손·팔·몸·얼굴 일부가 보여도 **제품 사용이 화면 주제**면 이 타입
- person_presenting: 카메라를 보며 **소개·讲解·口播** (제품 사용이 아닌 말하기)
- talking_head: 얼굴 클로즈업·口播·립싱크 중심
- mixed: 제품과 인물이 함께이지만 **사용/시연 중**이면 product_in_use 로 분류
- text_overlay: 로고·문구·CTA 버튼만 있고 **실제 제품 영상이 없는** 화면 (검은 배경 엔딩, 记得点赞, 获取更多, 팔로우 버튼 등)

**분류 참고**: text_overlay는 제품 없이 텍스트·로고·버튼만 보일 때. 제품 시연 위 작은 자막은 product_in_use.`,
        },
        {
          role: "user" as const,
          content: [
            {
              type: "text",
              text: `제목: ${title || "(없음)"}
프레임 ${images.length}장, index 0=앞 구간 순.

JSON: {"frames":[{"index":0,"content_type":"product_only","caption":"[클로즈업] 손에 든 검은색 핸디청소기, 빨간 풍선이 노즐에 붙어 있음. 실내 바닥 배경."}]}`,
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
    const caption = String((row || rowFallback)?.caption || "").trim().slice(0, 120)
    if (
      (ct === "mixed" || ct === "person_presenting" || ct === "talking_head") &&
      caption &&
      descriptionSuggestsProductInUse(caption)
    ) {
      ct = "product_in_use"
    }
    out.push({
      timeSec: frames[i]!.timeSec,
      content_type: CONTENT_TYPES.includes(ct) ? ct : "other",
      ...(caption ? { caption } : {}),
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

/** 여러 소스 키프레임 — Vision API 1회 (벤치마킹 속도) */
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
          content: `쇼핑 숏폼 프레임 분류기. JSON만 출력.
각 이미지마다 srcIndex, timeSec, content_type, caption(한국어 30~70자).
content_type: product_only|product_in_use|person_presenting|talking_head|mixed|text_overlay|other
text_overlay: 로고·문구·CTA 버튼만 있고 실제 제품 영상이 없는 화면 (검은 배경 엔딩카드, 记得点赞, 获取更多 등)
인물·제품·시연 장면은 편집에 사용 가능 — 화면에 실제 보이는 것만 caption에 기술.
JSON: {"frames":[{"imageIndex":0,"srcIndex":0,"timeSec":1.2,"content_type":"product_in_use","caption":"..."}]}`,
        },
        {
          role: "user" as const,
          content: [
            {
              type: "text",
              text: `${labelLines}\n이미지 ${images.length}장, imageIndex 0부터 순서대로.\n각 caption은 해당 프레임에 실제 보이는 것만.`,
            },
            ...images.map((img) => ({
              type: "image_url" as const,
              image_url: { url: `data:image/jpeg;base64,${img.b64}`, detail: "low" as const },
            })),
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(flat.length <= 4 ? 22_000 : flat.length <= 8 ? 40_000 : 75_000),
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
  const out: Array<FrameVisionResult & { srcIndex: number }> = []

  for (let i = 0; i < flat.length; i++) {
    const f = flat[i]!
    const row = raw.find((r) => (r as Record<string, unknown>)?.imageIndex === i) as
      | Record<string, unknown>
      | undefined
    const rowFallback = raw[i] as Record<string, unknown> | undefined
    const srcIndex = Number((row || rowFallback)?.srcIndex ?? f.srcIndex)
    const timeSec = Number((row || rowFallback)?.timeSec ?? f.timeSec)
    const ctRaw = String((row || rowFallback)?.content_type || "other")
    let ct = ctRaw as SceneContentType
    if (ctRaw === "subtitle") ct = "text_overlay"
    const caption = String((row || rowFallback)?.caption || "").trim().slice(0, 120)
    if (
      (ct === "mixed" || ct === "person_presenting" || ct === "talking_head") &&
      caption &&
      descriptionSuggestsProductInUse(caption)
    ) {
      ct = "product_in_use"
    }
    out.push({
      srcIndex: Number.isFinite(srcIndex) ? srcIndex : f.srcIndex,
      timeSec: Number.isFinite(timeSec) ? timeSec : f.timeSec,
      content_type: CONTENT_TYPES.includes(ct) ? ct : "other",
      ...(caption ? { caption } : {}),
    })
  }
  return out
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
