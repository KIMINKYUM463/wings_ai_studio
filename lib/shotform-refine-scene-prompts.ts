import type { GeneratedShoppingScene } from "@/lib/shotform-generate-shopping-script"
import {
  normalizeVisualFocus,
  visualFocusInstruction,
  type ShotformVisualFocus,
} from "@/lib/shotform-script-templates"

/**
 * 대본 생성·재작성이 함께 쓰는 IMAGE/MOTION 규칙.
 * 영상 단계(generateVideoWithSeedance)가 camera_fixed로 카메라를 고정하므로
 * MOTION에 카메라 이동을 쓰면 무시되거나 제품이 뭉개진다 — 피사체 동작만 쓴다.
 */
export const SHOPPING_SCENE_VISUAL_RULES = `IMAGE 필수 규칙:
- 그 장면 나레이션이 말하는 상황·장소·행동을 그대로 보여줄 것 (나레이션이 지하철이면 지하철, 통화면 통화)
- 화면 안 글자·자막·로고·텍스트 오버레이·말풍선·UI 금지 (자막은 편집 단계에서 따로 얹음). 마지막 CTA 장면도 텍스트 대신 제품 히어로 컷
- 연속한 장면은 샷 크기(클로즈업/미디엄/와이드)를 바꿔 단조롭지 않게

MOTION 필수 규칙 (English, 12~22 words):
- 카메라는 고정. zoom, pan, tilt, orbit, track, dolly, pull back, reveal, fade, text 같은 카메라·편집 단어 금지
- 피사체의 작고 자연스러운 동작 1개 + 주변의 미세한 움직임 1개
  예: "fingers gently press the earbud, soft light glints on the case, steady locked camera, high quality, commercial look"
- 끝은 항상 "steady locked camera, high quality, commercial look"`

/**
 * 장면 IMAGE(한)·MOTION(영)을 벤치마크 숏폼 공식으로 재작성
 */
export async function refineSceneVisualPrompts(opts: {
  openaiApiKey: string
  productName: string
  detailInsightsText?: string
  productImageUrls?: string[]
  visualFocus?: ShotformVisualFocus | string | null
  scenes: GeneratedShoppingScene[]
}): Promise<GeneratedShoppingScene[]> {
  const scenes = opts.scenes.filter((s) => s.narration.trim())
  if (!scenes.length) return opts.scenes

  const urls = (opts.productImageUrls || [])
    .filter((u) => typeof u === "string" && /^https?:\/\//i.test(u))
    .slice(0, 2)

  const productName = opts.productName.trim() || "제품"
  const visualFocus = normalizeVisualFocus(opts.visualFocus)
  const focusBlock = visualFocusInstruction(visualFocus)

  const sceneBlock = scenes
    .map(
      (s, i) =>
        `[${i}] id=${s.id}
나레이션: ${s.narration}
기존 IMAGE: ${s.imagePrompt || "(없음)"}
기존 MOTION: ${s.motionPrompt || "(없음)"}`
    )
    .join("\n\n")

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "low" | "high" } }
  > = [
    {
      type: "text",
      text: `상품명(IMAGE에 풀네임으로 반복): ${productName}
상세 인사이트:
${opts.detailInsightsText?.trim() || "(없음)"}

아래 장면들의 IMAGE/MOTION만 벤치마크 공식으로 다시 작성하세요. 나레이션은 바꾸지 마세요.
비주얼 포커스(${visualFocus})를 IMAGE/MOTION에 최우선 반영하세요.
IMAGE: 한국어 1~2문장(약 120~220자). 제품 형태·색은 전 장면 동일.
인물이 나오면 한국인 기본 + 전 장면 동일 인물(얼굴·헤어·연령대). 제품 유지와 같은 수준으로 지킬 것.
${urls.length ? "첨부 사진은 실물입니다. 형태·색을 사진과 다르게 쓰지 말고, 제품 풀네임으로 고정하세요." : ""}

${focusBlock}

장면 목록:
${sceneBlock}`,
    },
  ]

  for (const url of urls) {
    content.push({
      type: "image_url",
      image_url: { url, detail: "high" },
    })
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.35,
      max_tokens: 4500,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `당신은 쇼핑 숏폼 비주얼 디렉터입니다. JSON만 반환합니다.
중간 길이 IMAGE + 짧은 MOTION. 비주얼 포커스를 반드시 지키세요.

${focusBlock}

스키마:
{
  "scenes": [
    {
      "index": number,
      "imagePrompt": string,   // 한국어 120~220자, 1~2문장
      "motionPrompt": string   // English 12~22 words
    }
  ]
}

IMAGE: 샷, 앵글, 주체(포커스에 맞게), 제품 풀네임+색+위치, 액션, 배경, 자연광·얕은 심도·라이프스타일 스틸 컷.
제품 풀네임 반복, 실물 형태 보존, f값/렌즈 mm 금지. 역할 태그는 본문에 쓰지 말 것.
인물 컷: Korean person / East Asian features, 시리즈 전체 동일 인물 앵커 유지.

${SHOPPING_SCENE_VISUAL_RULES}`,
        },
        { role: "user", content },
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    console.warn("[refine-scene-prompts]", res.status, errText.slice(0, 160))
    return opts.scenes
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const raw = data.choices?.[0]?.message?.content || "{}"
  let parsed: { scenes?: unknown } = {}
  try {
    parsed = JSON.parse(raw) as { scenes?: unknown }
  } catch {
    return opts.scenes
  }

  const refined = Array.isArray(parsed.scenes) ? parsed.scenes : []
  const byIndex = new Map<number, { imagePrompt: string; motionPrompt: string }>()
  for (const row of refined) {
    if (!row || typeof row !== "object") continue
    const o = row as Record<string, unknown>
    const index = Math.floor(Number(o.index))
    if (!Number.isFinite(index)) continue
    const imagePrompt = String(o.imagePrompt || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 900)
    const motionPrompt = String(o.motionPrompt || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 280)
    if (imagePrompt || motionPrompt) {
      byIndex.set(index, { imagePrompt, motionPrompt })
    }
  }

  return scenes.map((s, i) => {
    const hit = byIndex.get(i)
    if (!hit) return s
    return {
      ...s,
      imagePrompt: hit.imagePrompt || s.imagePrompt,
      motionPrompt: hit.motionPrompt || s.motionPrompt,
    }
  })
}
