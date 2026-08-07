import {
  normalizeVisualFocus,
  sceneCountForSeconds,
  targetCharCountForSeconds,
  visualFocusInstruction,
  type ShotformScriptTemplate,
  type ShotformVisualFocus,
} from "@/lib/shotform-script-templates"
import { buildShoppingResearchContent } from "@/lib/shotform-shopping-research-content"
import { refineSceneVisualPrompts } from "@/lib/shotform-refine-scene-prompts"

export type GeneratedShoppingScene = {
  id: string
  narration: string
  imagePrompt: string
  motionPrompt: string
}

export type GeneratedShoppingScript = {
  title: string
  spokenScript: string
  scenes: GeneratedShoppingScene[]
}

function normalizeScenes(
  raw: unknown,
  expectedCount: number
): GeneratedShoppingScene[] {
  const arr = Array.isArray(raw) ? raw : []
  const out: GeneratedShoppingScene[] = []
  for (let i = 0; i < arr.length; i++) {
    const s = arr[i] as Record<string, unknown>
    const narration = String(s.narration || s.script || "")
      .replace(/\s+/g, " ")
      .trim()
    if (!narration) continue
    out.push({
      id: String(s.id || `m${out.length + 1}s1`).slice(0, 32),
      narration: narration.slice(0, 400),
      imagePrompt: String(s.imagePrompt || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 2200),
      motionPrompt: String(s.motionPrompt || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 600),
    })
  }

  // 부족하면 나레이션을 쪼개 채우지 않고 있는 것만 사용. 0이면 빈 배열.
  if (out.length === 0) return []

  // 너무 많으면 자름
  const capped = out.slice(0, Math.max(expectedCount + 2, expectedCount))
  return capped.map((s, i) => ({
    ...s,
    id: `m${i + 1}s1`,
  }))
}

export async function generateShoppingScriptFromTemplate(opts: {
  openaiApiKey: string
  template: ShotformScriptTemplate
  productName: string
  targetSeconds: number
  detailInsightsText?: string
  reviewInsightsText?: string
  reviewSamples?: string[]
  productPrice?: string
  productDelivery?: string
  extraNotes?: string
  /** 제품 사진 URL — IMAGE 디테일 보정용 */
  productImageUrls?: string[]
  /** 이미지·영상 프롬프트 비주얼 포커스 */
  visualFocus?: ShotformVisualFocus | string | null
}): Promise<GeneratedShoppingScript> {
  const seconds = Math.max(10, Math.min(60, Math.round(opts.targetSeconds || 30)))
  const sceneCount = sceneCountForSeconds(seconds)
  const charTarget = targetCharCountForSeconds(seconds)
  const visualFocus = normalizeVisualFocus(opts.visualFocus)
  const focusBlock = visualFocusInstruction(visualFocus)

  const researchContent = buildShoppingResearchContent({
    template: opts.template,
    productName: opts.productName,
    targetSeconds: seconds,
    detailInsightsText: opts.detailInsightsText,
    reviewInsightsText: opts.reviewInsightsText,
    reviewSamples: opts.reviewSamples,
    productPrice: opts.productPrice,
    productDelivery: opts.productDelivery,
    extraNotes: opts.extraNotes,
  })

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.65,
      max_tokens: 6000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `당신은 쇼핑 숏폼 대본 작가 + 비주얼 디렉터입니다. JSON만 반환합니다.

스키마:
{
  "title": string,
  "spokenScript": string,
  "scenes": [
    {
      "id": "m1s1",
      "narration": string,
      "imagePrompt": string,
      "motionPrompt": string
    }
  ]
}

대본 규칙:
- spokenScript 공백 제외 약 ${charTarget}자, 장면 ${sceneCount}개 전후
- scenes[].narration을 이으면 spokenScript와 맞게
- 화자 태그/URL/JSON을 spoken에 넣지 말 것
- 선택 템플릿 계약 최우선, 자료에 없는 사실 창작 금지
- spoken에는 제품명 직접 반복 최소화

${focusBlock}

이미지 장면 IMAGE (한국어, 장면당 1~2문장, 약 120~220자. 벤치마크 숏폼 공식 필수):
위 비주얼 포커스를 최우선으로 반영한 뒤, 아래 순서로 한 문단:
1) 샷 타입 2) 앵글 3) 주체(인물 또는 제품/손 — 포커스에 맞게) 4) 제품 풀네임·색·위치 5) 액션 6) 배경 7) 자연광·얕은 심도·라이프스타일 스틸 컷
제품 형태·색·구조는 전 장면 동일. 왜곡 금지. f값·렌즈 mm 메타 문구 금지.

MOTION (English only, 12~22 words):
[camera move] + [action matching visual focus] + "high quality, commercial look"
IMAGE를 장황 번역하지 말 것.`,
        },
        {
          role: "user",
          content: `다음 자료를 분석하여 대본 1개와 장면별 IMAGE/MOTION을 생성해주세요.
비주얼 포커스: ${visualFocus}

## 제공된 자료
---자료 시작---
${researchContent}
---자료 끝---`,
        },
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    throw new Error(`대본 생성 실패 (${res.status}) ${errText.slice(0, 200)}`)
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const raw = data.choices?.[0]?.message?.content || "{}"
  let parsed: Record<string, unknown> = {}
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>
  } catch {
    throw new Error("대본 JSON 파싱 실패")
  }

  const scenes = normalizeScenes(parsed.scenes, sceneCount)
  let spokenScript = String(parsed.spokenScript || "")
    .replace(/\s+/g, " ")
    .trim()

  if (!spokenScript && scenes.length) {
    spokenScript = scenes.map((s) => s.narration).join(" ")
  }

  if (!spokenScript) {
    throw new Error("생성된 대본이 비어 있습니다.")
  }

  let finalScenes = scenes
  if (!finalScenes.length) {
    const parts = spokenScript
      .split(/(?<=[.!?。！？]|요|다|네요|거든요)\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 4)
    const n = Math.min(sceneCount, Math.max(1, parts.length))
    const chunk = Math.max(1, Math.ceil(parts.length / n))
    finalScenes = []
    for (let i = 0; i < n; i++) {
      const narration = parts.slice(i * chunk, (i + 1) * chunk).join(" ")
      if (!narration) continue
      finalScenes.push({
        id: `m${finalScenes.length + 1}s1`,
        narration,
        imagePrompt: "",
        motionPrompt: "",
      })
    }
  }

  // 2차: IMAGE/MOTION만 상업용 수준으로 재작성 (제품 사진 있으면 비전 반영)
  try {
    finalScenes = await refineSceneVisualPrompts({
      openaiApiKey: opts.openaiApiKey,
      productName: opts.productName,
      detailInsightsText: opts.detailInsightsText,
      productImageUrls: opts.productImageUrls,
      visualFocus,
      scenes: finalScenes,
    })
  } catch (e) {
    console.warn("[generate-script] refine prompts skipped", e)
  }

  return {
    title: String(parsed.title || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120),
    spokenScript,
    scenes: finalScenes,
  }
}
