"use server"

import type {
  StoryBeat,
  StorySafetyCheck,
  StoryShoppingBlueprint,
  StoryShoppingBrief,
  StoryShoppingScene,
} from "./story-types"

const BEATS: StoryBeat[] = ["hook", "setup", "conflict", "product", "proof", "cta"]

const clampScore = (value: unknown) =>
  Math.max(0, Math.min(100, Math.round(Number(value) || 0)))

const cleanStringArray = (value: unknown, max: number) =>
  Array.isArray(value)
    ? value
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .slice(0, max)
    : []

export async function generateStoryShoppingBlueprint(
  brief: StoryShoppingBrief,
  apiKey?: string
): Promise<StoryShoppingBlueprint> {
  const key =
    apiKey ||
    process.env.OPENAI_API_KEY ||
    process.env.GPT_API_KEY ||
    process.env.CHATGPT_API_KEY
  if (!key) throw new Error("OpenAI API 키가 설정되지 않았습니다.")
  if (!brief.productName.trim()) throw new Error("상품명을 입력해주세요.")
  if (!brief.problem.trim() || !brief.storySource.trim()) {
    throw new Error("시청자의 문제와 이야기 소재를 입력해주세요.")
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.8,
      max_tokens: 3200,
      messages: [
        {
          role: "system",
          content: `당신은 한국형 썰 채널과 커머스를 결합하는 유튜브 쇼츠 전문 기획자입니다.
결과는 광고 나열이 아니라 실제 커뮤니티 사연처럼 흘러가야 하며, 상품은 갈등을 해결하는 과정에 자연스럽게 등장해야 합니다.

핵심 제작 규칙:
- 전체 ${brief.durationSec}초, 9:16, 약 2.5~4초마다 장면 변화
- 0~3초: 결과·위기·반전을 먼저 보여 스크롤을 멈추게 함
- Hook → Setup → Conflict → Product Reveal → Proof → CTA/Open Loop 구조
- 장면마다 메시지는 하나만, 화면 자막은 공백 제외 약 8~12자
- 제품 설명보다 문제와 스토리를 먼저 제시
- 상품은 최소 3개 장면에서 자연스럽게 확인 가능
- 마지막 CTA는 하나만 사용하고 첫 장면과 이어지는 열린 결말을 만듦
- 하단과 우측 플랫폼 UI 안전 영역에는 핵심 텍스트를 배치하지 않음
- 근거 없는 효능, 치료, 수익, 품절, 최저가 표현 금지
- 제공되지 않은 수치·후기·사실을 창작하지 않음
- 다른 콘텐츠의 문장·제목을 그대로 복제하지 않음

JSON 형식:
{
  "conceptTitle": "기획명",
  "conceptSummary": "왜 시청·구매로 이어지는지 2문장",
  "hookTitle": "상단 굵은 훅 제목, 18자 이내",
  "subTitle": "훅 아래 설명, 24자 이내",
  "channelLabel": "짧은 채널명",
  "openingHooks": ["서로 다른 유형의 후킹 5개"],
  "ctaCandidates": ["CTA 3개"],
  "scenes": [{
    "beat": "hook|setup|conflict|product|proof|cta",
    "startSec": 0,
    "endSec": 3,
    "narration": "실제로 읽을 한 문장",
    "caption": "한 줄 화면 자막",
    "visualDirection": "촬영·구도·행동",
    "productPlacement": "상품 노출 방식",
    "imagePrompt": "저작권 안전한 세로형 생성 프롬프트"
  }],
  "scores": {
    "productFit": 0,
    "visualProof": 0,
    "storyPower": 0,
    "hookPower": 0,
    "conversion": 0
  },
  "safetyChecks": [{
    "key": "evidence",
    "label": "검증 가능한 표현",
    "status": "pass|warning|blocked",
    "note": "판정 이유"
  }]
}`,
        },
        {
          role: "user",
          content: `상품명: ${brief.productName}
상품 설명·특징: ${brief.productDescription || "(미입력)"}
트렌드 선정 근거: ${brief.trendSource || "(직접 입력)"}
선정한 성과 콘텐츠:
${
  brief.winningContent
    ? `${brief.winningContent.title}
- 채널: ${brief.winningContent.channelTitle}
- 채널 중앙값 대비 조회수: ${brief.winningContent.outlierRatio.toFixed(1)}배
- 일평균 조회수: ${Math.round(brief.winningContent.viewsPerDay)}
- 반응률: ${brief.winningContent.engagementRate.toFixed(2)}%
- 설명: ${brief.winningContent.description || "(없음)"}`
    : "(선택 없음)"
}
타깃 시청자: ${brief.targetAudience || "(미입력)"}
시청자의 문제: ${brief.problem}
이야기 소재·실제 경험·후기: ${brief.storySource}
증빙 가능한 변화: ${brief.proof || "(미입력, 과장 표현 금지)"}
가격·혜택: ${brief.priceBenefit || "(미입력)"}
원하는 CTA: ${brief.cta}
감정 톤: ${brief.tone}
목표 길이: ${brief.durationSec}초
자산 이용 권리 확인: ${brief.assetRightsConfirmed ? "확인함" : "확인하지 않음"}
해외 참고 영상(복제 금지, 후킹·구도·제품 시연 방식만 참고):
${
  brief.referenceVideos.length
    ? brief.referenceVideos
        .slice(0, 5)
        .map(
          (video, index) =>
            `${index + 1}. ${video.title} / ${video.channelTitle} / 조회수 ${video.viewCount}`
        )
        .join("\n")
    : "(선택 없음)"
}`,
        },
      ],
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(`AI 스토리 기획 생성 실패 (${response.status}): ${detail.slice(0, 180)}`)
  }

  const data = await response.json()
  const raw = data.choices?.[0]?.message?.content || "{}"
  const parsed = JSON.parse(raw) as Record<string, unknown>
  const sourceScenes = Array.isArray(parsed.scenes) ? parsed.scenes : []
  const fallbackDuration = brief.durationSec / Math.max(1, sourceScenes.length)
  const scenes: StoryShoppingScene[] = sourceScenes.map((entry, index) => {
    const scene = (entry || {}) as Record<string, unknown>
    const startSec = Math.max(0, Number(scene.startSec) || index * fallbackDuration)
    const endSec = Math.max(
      startSec + 1,
      Number(scene.endSec) || (index + 1) * fallbackDuration
    )
    const beat = BEATS.includes(scene.beat as StoryBeat)
      ? (scene.beat as StoryBeat)
      : BEATS[Math.min(index, BEATS.length - 1)]!
    return {
      id: `story-scene-${Date.now()}-${index}`,
      beat,
      startSec,
      endSec: Math.min(brief.durationSec, endSec),
      narration: String(scene.narration || "").trim(),
      caption: String(scene.caption || "").trim().slice(0, 24),
      visualDirection: String(scene.visualDirection || "").trim(),
      productPlacement: String(scene.productPlacement || "").trim(),
      imagePrompt: String(scene.imagePrompt || "").trim(),
    }
  })

  if (!scenes.length) throw new Error("AI가 장면을 생성하지 못했습니다. 다시 시도해주세요.")
  const scores = (parsed.scores || {}) as Record<string, unknown>
  const scoreValues = {
    productFit: clampScore(scores.productFit),
    visualProof: clampScore(scores.visualProof),
    storyPower: clampScore(scores.storyPower),
    hookPower: clampScore(scores.hookPower),
    conversion: clampScore(scores.conversion),
  }
  const total = Math.round(
    scoreValues.productFit * 0.25 +
      scoreValues.visualProof * 0.2 +
      scoreValues.storyPower * 0.2 +
      scoreValues.hookPower * 0.2 +
      scoreValues.conversion * 0.15
  )
  const safetyChecks: StorySafetyCheck[] = Array.isArray(parsed.safetyChecks)
    ? parsed.safetyChecks.map((entry, index) => {
        const check = (entry || {}) as Record<string, unknown>
        const status = ["pass", "warning", "blocked"].includes(String(check.status))
          ? (String(check.status) as StorySafetyCheck["status"])
          : "warning"
        return {
          key: String(check.key || `check-${index}`),
          label: String(check.label || "안전성 확인"),
          status,
          note: String(check.note || "").trim(),
        }
      })
    : []
  if (!brief.assetRightsConfirmed) {
    safetyChecks.unshift({
      key: "asset-rights",
      label: "이미지·영상 이용 권리",
      status: "blocked",
      note: "사용할 자산의 소유권 또는 이용 허가를 먼저 확인해야 합니다.",
    })
  }

  return {
    conceptTitle: String(parsed.conceptTitle || `${brief.productName} 반전 썰`).trim(),
    conceptSummary: String(parsed.conceptSummary || "").trim(),
    hookTitle: String(parsed.hookTitle || `${brief.productName}, 반전이 있었습니다`).trim(),
    subTitle: String(parsed.subTitle || "문제에서 해결까지 짧게 공개").trim(),
    channelLabel: String(parsed.channelLabel || "오늘의 썰").trim(),
    openingHooks: cleanStringArray(parsed.openingHooks, 5),
    ctaCandidates: cleanStringArray(parsed.ctaCandidates, 3),
    scenes,
    scores: { ...scoreValues, total },
    safetyChecks,
  }
}
