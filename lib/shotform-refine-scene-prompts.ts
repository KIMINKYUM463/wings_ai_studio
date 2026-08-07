import type { GeneratedShoppingScene } from "@/lib/shotform-generate-shopping-script"
import {
  normalizeVisualFocus,
  visualFocusInstruction,
  type ShotformVisualFocus,
} from "@/lib/shotform-script-templates"

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
MOTION: 영어 12~22 words. "… high quality, commercial look" 패턴.
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

MOTION: [camera move] + [action matching focus] + "high quality, commercial look"`,
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
