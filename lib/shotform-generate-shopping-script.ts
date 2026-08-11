import { looksLikeDescriptiveSceneNarration } from "@/lib/shotform-cut-narration"
import { personConsistencyPlanningBlock } from "@/lib/shotform-person-consistency"
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

function splitSpokenIntoParts(spoken: string): string[] {
  return spoken
    .split(/(?<=[.!?。！？]|요|다|네요|거든요)\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4 && !looksLikeDescriptiveSceneNarration(s))
}

function redistributeSpokenToScenes(
  spokenScript: string,
  sceneCount: number,
  existing: GeneratedShoppingScene[]
): GeneratedShoppingScene[] {
  const parts = splitSpokenIntoParts(spokenScript)
  if (!parts.length) return existing

  const n = Math.min(
    Math.max(sceneCount, existing.length || 1),
    Math.max(1, parts.length)
  )
  const chunk = Math.max(1, Math.ceil(parts.length / n))
  const out: GeneratedShoppingScene[] = []
  for (let i = 0; i < n; i++) {
    const narration = parts.slice(i * chunk, (i + 1) * chunk).join(" ")
    if (!narration) continue
    const prev = existing[i]
    out.push({
      id: `m${out.length + 1}s1`,
      narration: narration.slice(0, 400),
      imagePrompt: prev?.imagePrompt || "",
      motionPrompt: prev?.motionPrompt || "",
    })
  }
  return out.length ? out : existing
}

function normalizeScenes(
  raw: unknown,
  expectedCount: number
): GeneratedShoppingScene[] {
  const arr = Array.isArray(raw) ? raw : []
  const out: GeneratedShoppingScene[] = []
  for (let i = 0; i < arr.length; i++) {
    const s = arr[i] as Record<string, unknown>
    let narration = String(s.narration || s.script || "")
      .replace(/\s+/g, " ")
      .trim()
    let imagePrompt = String(s.imagePrompt || "")
      .replace(/\s+/g, " ")
      .trim()
    const motionPrompt = String(s.motionPrompt || "")
      .replace(/\s+/g, " ")
      .trim()

    // 나레이션에 연출문이 들어오면 IMAGE로 옮기고, 말할 대사는 비움(이후 spoken으로 복구)
    if (narration && looksLikeDescriptiveSceneNarration(narration)) {
      if (!imagePrompt) {
        imagePrompt = narration
      }
      narration = ""
    }

    // 둘 다 비면 스킵
    if (!narration && !imagePrompt && !motionPrompt) continue

    out.push({
      id: String(s.id || `m${out.length + 1}s1`).slice(0, 32),
      narration: narration.slice(0, 400),
      imagePrompt: imagePrompt.slice(0, 2200),
      motionPrompt: motionPrompt.slice(0, 600),
    })
  }

  if (out.length === 0) return []

  const capped = out.slice(0, Math.max(expectedCount + 2, expectedCount))
  return capped.map((s, i) => ({
    ...s,
    id: `m${i + 1}s1`,
  }))
}

async function repairDirectionLeakScenes(opts: {
  openaiApiKey: string
  productName: string
  charTarget: number
  sceneCount: number
  title: string
  spokenScript: string
  scenes: GeneratedShoppingScene[]
}): Promise<{ spokenScript: string; scenes: GeneratedShoppingScene[] } | null> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.4,
      max_tokens: 4000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `너는 쇼핑 숏폼 대본 교정 작가다. 입력 JSON의 제품 사실·장면 수는 유지하되 필드를 교정한다.

반드시 지킬 규칙:
- narration / spokenScript = 성우가 그대로 읽는 자연스러운 한국어 구어체 대사만
- narration에 인물 외모·헤어·의상·연령·「동일 인물」·「모습」·「장면」·클로즈업·카메라·연출 설명을 절대 쓰지 않는다
- 그런 시각 설명은 imagePrompt(한국어)로만 옮긴다
- motionPrompt는 영어 카메라/액션 프롬프트로 유지·보완
- spokenScript는 모든 narration을 이은 전체 대본 (공백 제외 약 ${opts.charTarget}자, 장면 약 ${opts.sceneCount}개)
- 확인되지 않은 사실은 추가하지 않는다

나쁜 narration: "좁은 집에서 노트북 사용의 불편함을 느끼는 20대 후반 한국 여성, 단발 흑발이 고민하는 모습."
좋은 narration: "좁은 집에서 노트북 쓰려니 목이 너무 아팠거든요."

JSON만 출력:
{"spokenScript":"전체 말할 대본","scenes":[{"id":"m1s1","narration":"말할 대사","imagePrompt":"이미지 장면","motionPrompt":"english motion"}]}`,
        },
        {
          role: "user",
          content: `상품명: ${opts.productName}\n\n교정할 JSON:\n${JSON.stringify({
            title: opts.title,
            spokenScript: opts.spokenScript,
            scenes: opts.scenes,
          })}`,
        },
      ],
    }),
  })

  if (!res.ok) return null

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  try {
    const repaired = JSON.parse(
      String(data.choices?.[0]?.message?.content || "{}")
    ) as Record<string, unknown>
    const scenes = normalizeScenes(repaired.scenes, opts.sceneCount)
    let spokenScript = String(repaired.spokenScript || "")
      .replace(/\s+/g, " ")
      .trim()
    if (!spokenScript && scenes.some((s) => s.narration)) {
      spokenScript = scenes
        .map((s) => s.narration)
        .filter(Boolean)
        .join(" ")
    }
    if (!scenes.length || !spokenScript) return null
    if (scenes.every((s) => looksLikeDescriptiveSceneNarration(s.narration))) {
      return null
    }
    return { spokenScript, scenes }
  } catch {
    return null
  }
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

필드 구분 (가장 중요):
- narration / spokenScript = 성우가 실제로 읽을 완성된 한국어 구어체 대사만
- imagePrompt = 화면/인물/제품/배경 설명 (IMAGE용). 여기는 연출 노트 OK
- motionPrompt = 영문 카메라·액션 프롬프트
- narration에 "모습", "장면", "동일 인물", "클로즈업", "카메라", 연령·헤어·의상 묘사를 쓰지 말 것
- 나쁜 narration: "좁은 집에서 노트북 사용의 불편함을 느끼고 있는 20대 후반 한국 여성, 단발 흑발이 고민하는 모습."
- 좋은 narration: "좁은 집에서 노트북 쓰려니 목이 너무 아팠거든요."
- 인물·공간·제품 비주얼은 imagePrompt에만 쓰고, narration은 그 장면에서 말할 한두 문장으로

대본 규칙:
- spokenScript 공백 제외 약 ${charTarget}자, 장면 ${sceneCount}개 전후
- scenes[].narration을 이으면 spokenScript와 맞게
- 화자 태그/URL/JSON을 spoken·narration에 넣지 말 것
- 선택 템플릿 계약 최우선, 자료에 없는 사실 창작 금지
- spoken·narration에는 제품명 직접 반복 최소화

${focusBlock}

이미지 장면 IMAGE (한국어, 장면당 1~2문장, 약 120~220자. 벤치마크 숏폼 공식 필수):
위 비주얼 포커스를 최우선으로 반영한 뒤, 아래 순서로 한 문단:
1) 샷 타입 2) 앵글 3) 주체(인물 또는 제품/손 — 포커스에 맞게) 4) 제품 풀네임·색·위치 5) 액션 6) 배경 7) 자연광·얕은 심도·라이프스타일 스틸 컷
제품 형태·색·구조는 전 장면 동일. 왜곡 금지. f값·렌즈 mm 메타 문구 금지.

${personConsistencyPlanningBlock()}

MOTION (English only, 12~22 words):
[camera move] + [action matching visual focus] + "high quality, commercial look"
IMAGE를 장황 번역하지 말 것.`,
        },
        {
          role: "user",
          content: `다음 자료를 분석하여 말할 대본(spokenScript·narration) 1세트와 장면별 IMAGE/MOTION을 생성해주세요.
비주얼 포커스(${visualFocus})는 imagePrompt·motionPrompt에만 반영하세요. narration에는 넣지 마세요.

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

  let scenes = normalizeScenes(parsed.scenes, sceneCount)
  let spokenScript = String(parsed.spokenScript || "")
    .replace(/\s+/g, " ")
    .trim()

  // spokenScript가 연출문이면 폐기
  if (spokenScript && looksLikeDescriptiveSceneNarration(spokenScript)) {
    spokenScript = ""
  }

  const spokenOk =
    Boolean(spokenScript) && !looksLikeDescriptiveSceneNarration(spokenScript)
  const descriptiveCount = scenes.filter((s) =>
    looksLikeDescriptiveSceneNarration(s.narration)
  ).length
  const emptyNarrationCount = scenes.filter((s) => !s.narration.trim()).length
  const badNarrationMajority =
    scenes.length > 0 &&
    descriptiveCount + emptyNarrationCount >= Math.ceil(scenes.length / 2)

  // 1) spoken이 정상이면 장면 나레이션을 spoken에서 재분할
  if (spokenOk && (badNarrationMajority || scenes.every((s) => !s.narration))) {
    scenes = redistributeSpokenToScenes(spokenScript, sceneCount, scenes)
  }

  // 2) 여전히 나쁘면 repair completion
  if (
    scenes.length &&
    (scenes.filter((s) => looksLikeDescriptiveSceneNarration(s.narration)).length +
      scenes.filter((s) => !s.narration.trim()).length) >=
      Math.ceil(scenes.length / 2)
  ) {
    try {
      const repaired = await repairDirectionLeakScenes({
        openaiApiKey: opts.openaiApiKey,
        productName: opts.productName,
        charTarget,
        sceneCount,
        title: String(parsed.title || ""),
        spokenScript,
        scenes,
      })
      if (repaired) {
        spokenScript = repaired.spokenScript
        scenes = repaired.scenes
      }
    } catch (e) {
      console.warn("[generate-script] narration repair skipped", e)
    }
  }

  // spoken 폴백: 정상 narration만 join (연출문 join 금지)
  if (!spokenScript && scenes.length) {
    const spokenParts = scenes
      .map((s) => s.narration)
      .filter((n) => n && !looksLikeDescriptiveSceneNarration(n))
    spokenScript = spokenParts.join(" ")
  }

  if (!spokenScript) {
    throw new Error("생성된 대본이 비어 있습니다.")
  }

  let finalScenes = scenes
  if (!finalScenes.length || finalScenes.every((s) => !s.narration.trim())) {
    finalScenes = redistributeSpokenToScenes(spokenScript, sceneCount, finalScenes)
  }

  // 장면 narration이 비어 있거나 연출문이면 spoken으로 한 번 더 맞춤
  if (
    finalScenes.some(
      (s) => !s.narration.trim() || looksLikeDescriptiveSceneNarration(s.narration)
    )
  ) {
    finalScenes = redistributeSpokenToScenes(spokenScript, sceneCount, finalScenes)
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
