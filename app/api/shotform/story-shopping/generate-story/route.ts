import { NextRequest, NextResponse } from "next/server"
import type { StoryNarrationStyle } from "@/app/WingsAIStudioShotForm/story-shopping/story-types"
import {
  STORY_SCRIPT_TEMPLATES,
  isStoryScriptTemplateId,
} from "@/app/WingsAIStudioShotForm/story-shopping/story-script-catalog"
import { SHOTFORM_COPY_MODEL } from "@/lib/shotform-ai-models"
import { expandShortNarrations, lengthOff } from "@/lib/shotform-generate-shopping-script"
import {
  STORY_MAX_SCENES,
  storyTargetCharacters,
  storyTargetSceneCount,
} from "@/app/WingsAIStudioShotForm/story-shopping/story-script-pace"
import { STORY_TITLE_FORMULAS } from "@/app/WingsAIStudioShotForm/story-shopping/story-title-formulas"
import { guardStoryApiRequest } from "@/lib/story-shopping-security"
import { STORY_MARKET_CREATIVE_RULES } from "@/lib/story-market-intelligence"
import { hookFormulaPromptBlock } from "@/lib/shopping-hook-formulas"
import {
  assertGroundedStory,
  generatedStoryModelSchema,
  splitGroundedSentences,
  stableStoryIdentity,
  storyEvidenceSourceSchema,
} from "@/app/WingsAIStudioShotForm/story-shopping/story-grounding"
import { z } from "zod"

export const runtime = "nodejs"

const requestSchema = z
  .object({
    templateId: z.string(),
    productName: z.string().trim().min(1).max(500),
    productDescription: z.string().max(10_000).optional().default(""),
    priceBenefit: z.string().max(1000).optional().default(""),
    targetSeconds: z.coerce.number().finite().optional(),
    narrationStyle: z.enum(["ssul", "polite"]).optional(),
    collectorData: z.record(z.unknown()).optional().default({}),
    referenceTitle: z.string().max(500).optional().default(""),
    referenceTranscript: z.string().max(20_000).optional().default(""),
    referenceVideos: z
      .array(
        z.object({
          title: z.string().max(500),
          description: z.string().max(2000).optional().default(""),
          viewCount: z.coerce.number().nonnegative().optional().default(0),
          durationSec: z.coerce.number().nonnegative().optional().default(0),
          format: z.string().max(80).optional(),
          hookPattern: z.string().max(120).optional(),
          performanceScore: z.coerce.number().min(0).max(100).optional(),
        })
      )
      .max(8)
      .optional()
      .default([]),
    apiKey: z.string().optional(),
    requestId: z.string().max(100).optional(),
    productIdentity: z.string().max(100).optional(),
    reviewSetIdentity: z.string().max(100).optional(),
    baseRevision: z.string().max(100).optional(),
  })
  .passthrough()

/** 썰쇼핑 채널 인기 영상 대본(12개 채널)을 분석해 뽑은 문체 규칙 */
const SSUL_STYLE_GUIDE = `문체: 썰쇼핑 채널식 3인칭 서사 (선물가게·수상한상점·신사들 스타일)
- 첫 문장은 영상 제목 그대로 읽는다. 명사로 끝나는 짧은 후킹 문장 + 마침표.
- 둘째 문장부터 바로 대상의 정체·배경을 밝힌다. 제품명은 전체의 15~45% 지점 안에 공개한다. 제품명은 브랜드+핵심 이름만 짧게 쓰고 영어는 한글 발음으로 쓴다. 예) "Abc Pro 2세대 무선 이어폰 블랙, 1개" → "에이비씨 이어폰".
- 이야기 뼈대: 누가/무엇이 문제였나 → 그래서 무엇을 시도했나 → 그 결과 생긴 핵심 차별점(작동 원리) → 사람들의 반응·근황. 앞뒤 문장이 원인→결과로 이어져야 하며 맥락 없는 점프 금지.
- 존댓말 금지. 음슴체·반말 서술로 끝낸다: ~했음, ~함, ~버림, ~거임, ~는 거, ~정도임, ~다고. (마지막 한 문장만 "~입니다/~요" 허용)
- 친구에게 썰 풀듯 빠르고 과장된 리듬. 반전 직전에 "근데 여기서 ~함." 같은 전환 문장을 1번 쓴다. 같은 연결어(결국·근데·그래서)는 2번까지만.
- 제품을 쓰는 순간의 감각을 그 제품에 맞는 감각(소리·맛·향·촉감·시야 중)으로 구체적으로 묘사하고, 일상적 비유를 1번 쓴다. 다른 제품군의 표현(예: 음식이 아닌데 맛·향)을 가져오지 않는다.
- 유행어는 핵심 1~2곳에만: 미친, 1티어, 도파민 폭발, 극락, 때려 넣은, 풀매수.
- 등장인물의 생각이나 한마디를 따옴표 대사로 1번 넣는다.
- 마지막 장면은 구매 권유 대신 꿀팁("아, 참고로 ~"), 사람들의 반응·근황, 또는 화자의 한 줄 드립(가벼운 반문 가능, 예: "이 정도면 ~도 실력 아님?") 중 하나다. 반응·근황은 실제 리뷰 근거가 있을 때만 쓰고, 없으면 상품명·설명에 적힌 특징(소재·구성·사이즈 등)에서 나온 사용 꿀팁으로 끝낸다. 세탁·내구성·두께처럼 근거에 없는 특성은 꿀팁에도 쓰지 않는다. "아, 참고로" 뒤에는 장면을 더 붙이지 않는다. 가격 숫자는 쓰지 않는다.
- "~필수템!", "~방지템!" 같은 광고 카피·슬로건 문장을 쓰지 않는다. 모든 문장은 이야기의 서술이다.
- 근거 자료에 없는 순위·판매량("1위", "1황", "완판")과 질병 치료·의학 효과는 지어내지 않는다.
- 기능 나열 금지. 사람의 집착·문제·시도·반전·반응으로 보여준다.
- 위 문장들은 형식 설명이다. 예시 문구를 그대로 가져오지 말고 이 제품에 맞는 새 표현을 쓴다.`

const POLITE_STYLE_GUIDE = `문체: 자연스러운 존댓말 구어체
- 제품 → 기능 → 구매 순서의 광고 대본을 쓰지 않는다.
- 흥미로운 이야기 → 갈등 → 궁금증 → 해결 → 알고 보니 제품 순서로 쓴다.
- 제품명은 전체 대본의 70% 이후에 처음 공개한다.
- 첫 3초 안에 강한 궁금증을 만든다.
- 마지막은 제품이 필요한 이유와 자연스럽게 연결하되 과장 구매 유도는 하지 않는다.`

export async function POST(request: NextRequest) {
  try {
    const access = await guardStoryApiRequest(request, {
      limit: 8,
      maxBytes: 250_000,
    })
    if (access.error) return access.error
    const parsedBody = requestSchema.safeParse(await request.json())
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "스토리 생성 요청 형식이 올바르지 않습니다.", issues: parsedBody.error.issues },
        { status: 400 }
      )
    }
    const body = parsedBody.data
    const templateIdInput = String(body.templateId || "")
    const productName = String(body.productName || "").trim()
    const targetSeconds = Math.max(10, Math.min(60, Math.round(Number(body.targetSeconds) || 30)))
    const narrationStyle: StoryNarrationStyle = body.narrationStyle === "polite" ? "polite" : "ssul"
    const isSsul = narrationStyle === "ssul"
    const targetCharacters = storyTargetCharacters(targetSeconds, narrationStyle)
    const targetSceneCount = storyTargetSceneCount(targetSeconds, narrationStyle)
    const referenceTitle = String(body.referenceTitle || "").trim().slice(0, 120)
    const referenceTranscript = String(body.referenceTranscript || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2500)
    const marketReferenceSummary = body.referenceVideos
      .slice(0, 8)
      .map(
        (video, index) =>
          `${index + 1}. ${video.title} | 조회 ${video.viewCount} | ${video.durationSec}초 | ` +
          `${video.format || "미분류"} | ${video.hookPattern || "훅 미분류"}`
      )
      .join("\n")
    const apiKey =
      String(body.apiKey || "").trim() ||
      process.env.OPENAI_API_KEY ||
      process.env.GPT_API_KEY ||
      process.env.CHATGPT_API_KEY
    if (!isStoryScriptTemplateId(templateIdInput)) {
      return NextResponse.json({ error: "스토리 템플릿을 선택해주세요." }, { status: 400 })
    }
    const templateId = templateIdInput
    if (!productName) {
      return NextResponse.json({ error: "선택된 상품이 없습니다." }, { status: 400 })
    }
    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API 키가 필요합니다." }, { status: 503 })
    }

    const collector = body.collectorData || {}
    const reviewRecords = Array.isArray(collector.reviews)
      ? collector.reviews
          .slice(0, 30)
          .map((review) => {
            const record =
              review && typeof review === "object" ? (review as Record<string, unknown>) : {}
            return {
              content: String(record.content || "").trim(),
              author: String(record.author || "").trim(),
              date: String(record.date || "").trim(),
              rating: Number(record.rating) || undefined,
            }
          })
          .filter((review) => review.content)
      : []
    const productIdentity = stableStoryIdentity({
      productName,
      productDescription: body.productDescription,
      collectedProductName: collector.collectedProductName,
      productId: body.productId,
      productUrl: body.productUrl,
    })
    const reviewSetIdentity = stableStoryIdentity(
      reviewRecords.map(({ content, author, date, rating }) => ({ content, author, date, rating }))
    )
    if (body.productIdentity && body.productIdentity !== productIdentity) {
      return NextResponse.json(
        { error: "상품 식별자가 현재 요청 내용과 일치하지 않습니다.", productIdentity },
        { status: 409 }
      )
    }
    if (body.reviewSetIdentity && body.reviewSetIdentity !== reviewSetIdentity) {
      return NextResponse.json(
        { error: "리뷰 묶음 식별자가 현재 요청 내용과 일치하지 않습니다.", reviewSetIdentity },
        { status: 409 }
      )
    }
    const evidenceSources = [
      {
        id: "product-core",
        kind: "product" as const,
        identity: productIdentity,
        text: `상품명: ${productName}\n상품 설명: ${
          String(body.productDescription || "").slice(0, 2500) || "없음"
        }\n가격 정보: ${String(body.priceBenefit || "") || "없음"}`,
      },
      {
        id: "product-detail",
        kind: "detail" as const,
        identity: stableStoryIdentity(collector.detailInsights || {}),
        text: `상세 분석: ${JSON.stringify(collector.detailInsights || {}).slice(0, 5000)}`,
      },
      {
        id: "review-summary",
        kind: "review-summary" as const,
        identity: stableStoryIdentity(collector.reviewInsights || {}),
        text: `리뷰 분석: ${JSON.stringify(collector.reviewInsights || {}).slice(0, 5000)}`,
      },
      ...reviewRecords.map((review, index) => ({
        id: `review-${index + 1}`,
        kind: "review" as const,
        identity: stableStoryIdentity(review),
        text: `실제 리뷰 ${index + 1}: ${review.content}`,
      })),
      ...(referenceTranscript || referenceTitle
        ? [
            {
              id: "reference-video",
              kind: "reference" as const,
              identity: stableStoryIdentity({ referenceTitle, referenceTranscript }),
              text: `참고 영상 제목: ${referenceTitle || "없음"}\n참고 영상 대본: ${
                referenceTranscript || "없음"
              }`,
            },
          ]
        : []),
    ].map((source) => storyEvidenceSourceSchema.parse(source))
    const evidence = evidenceSources
      .map((source) => `[SOURCE ${source.id} | ${source.kind}]\n${source.text}`)
      .join("\n\n")
    const validSourceIds = new Set(evidenceSources.map((source) => source.id))
    const requestId =
      body.requestId || `story_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const referenceRule = referenceTranscript
      ? `\n참고 영상 활용 규칙:
- 참고 영상 대본은 이야기 구조·정보 순서·리듬을 배우는 용도다. 문장을 그대로 베끼지 말고(같은 어절 6개 이상 연속 금지) 새 문장으로 다시 쓴다.
- 참고 영상에 나온 제품 사실(탄생 배경·인물·수치)은 입력 상품과 같은 제품일 때만 근거로 쓴다.`
      : ""
    const marketReferenceRule = marketReferenceSummary
      ? `\n선택된 해외·시장 참고 영상 성과 신호:
${marketReferenceSummary}
- 위 정보는 훅 종류·영상 길이·증명 방식의 구조 참고용이다.
- 제목·설명의 주장을 상품 사실 근거로 사용하지 않는다.
- 조회수가 높다는 이유만으로 문장, 장면 순서, 고유 표현을 복제하지 않는다.`
      : ""

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: SHOTFORM_COPY_MODEL,
        temperature: 0.8,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `너는 조회수 수백만 쇼핑 썰 쇼츠 전문 작가다.

${isSsul ? SSUL_STYLE_GUIDE : POLITE_STYLE_GUIDE}

${hookFormulaPromptBlock({ style: isSsul ? "ssul" : "polite" })}

${STORY_MARKET_CREATIVE_RULES}

분량 규칙 (매우 중요):
- ${targetSeconds}초 영상이며 성우가 빠르게 읽는다. narration 전체 합계가 공백 제외 ${targetCharacters}자(±10%)가 되어야 한다. 짧으면 실패다.
- 장면은 ${targetSceneCount}개 안팎, 장면당 narration은 1~2문장 약 ${Math.round(targetCharacters / targetSceneCount)}자.
${isSsul ? "- 첫 장면 narration은 제목 문장 하나만 쓴다." : ""}

사실 규칙:
- 입력 근거(상품 설명·상세 분석·리뷰·참고 영상)에 없는 역사·기업·인물·수치·수상·효능을 사실처럼 만들지 않는다.
- 탄생 비화 근거가 없으면 지어내지 말고, 리뷰 속 실제 사용자 반응·문제 상황·사용 장면으로 서사를 만든다.
- 각색은 말투와 연출(대사·비유)까지만 허용한다.${referenceRule}
${marketReferenceRule}
- 모든 사실 문장은 바로 위 SOURCE ID 중 하나 이상을 sourceIds에 기록한다.
- 숫자·기간·비율·순위·효능 문장은 정확히 뒷받침하는 SOURCE가 없으면 삭제한다.
- claims에는 검증 가능한 사실만 넣고 numeric/efficacy claim은 sourceIds가 비어 있으면 안 된다.

${STORY_TITLE_FORMULAS}

필드 구분 규칙:
- narration은 화면 설명이 아니라 성우가 실제로 읽을 완성된 대사다.
- narration에 "장면", "모습", "화면", "클로즈업", "보여준다", "연출한다" 같은 촬영 지시를 쓰지 않는다.
- 나쁜 narration 예시: "친구가 캠핑을 준비하는 모습", "버튼을 눌러 음료를 따르는 장면"
- 좋은 narration 예시: ${
              isSsul
                ? `"캠핑만 가면 음료 따르다 손이 끈적해지는 게 너무 싫었던 한 아저씨가 있었음."`
                : `"캠핑만 가면 음료 따르는 일이 왜 이렇게 번거로운지 모르겠더라고요."`
            }
- caption은 해당 narration의 핵심을 압축한 짧은 화면 자막이다.
- visualPrompt에만 인물 행동, 배경, 카메라 구도 등 장면 설명을 쓴다.
- script는 모든 narration을 순서대로 이어 붙인 실제 음성 대본이어야 한다.

이야기 흐름 템플릿 (제품 공개 시점과 말투는 위 문체 규칙이 우선):
${STORY_SCRIPT_TEMPLATES[templateId].guide}
- 장면 순서는 위 흐름의 단계(→로 구분)를 그대로 따르고, 단계마다 최소 1장면을 쓴다. 갈등·전환이 없는 평이한 소개글은 실패다.

JSON만 출력:
{
  "typeReason":"이 유형이 적합한 이유",
  "hook":"첫 3초 후킹",
  "title":"쇼츠 제목 (제목 공식 사용, 마침표 없이)",
  "script":"전체 대본",
  "claims":[
    {"id":"claim-1","text":"검증할 주장","category":"factual|numeric|efficacy|opinion","sourceIds":["product-core"],"verified":true}
  ],
  "scenes":[
    {
      "narration":"장면 내레이션",
      "caption":"짧은 자막",
      "visualPrompt":"필요한 영상이나 사진 설명",
      "durationSec":5,
      "sourceIds":["product-core"],
      "claimIds":["claim-1"],
      "sentences":[
        {"id":"scene-1-sentence-1","text":"장면의 첫 문장","sourceIds":["product-core"],"claimIds":["claim-1"]}
      ]
    }
  ]
}

장면은 약 ${targetSceneCount}개로 나누고, 모든 durationSec 합계는 정확히 ${targetSeconds}초가 되게 구성한다.`,
          },
          { role: "user", content: evidence },
        ],
      }),
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => "")
      throw new Error(`스토리 생성 실패 (${response.status}): ${detail.slice(0, 200)}`)
    }
    const data = await response.json()
    let parsed = generatedStoryModelSchema.parse(
      JSON.parse(String(data.choices?.[0]?.message?.content || "{}"))
    )
    let rawScenes: Record<string, unknown>[] = Array.isArray(parsed.scenes)
      ? parsed.scenes
      : []
    if (rawScenes.length === 0) {
      throw new Error("AI가 완전한 스토리 대본을 반환하지 않았습니다.")
    }
    const directionPattern =
      /(하는\s*장면|하는\s*모습|보여주는\s*장면|보여준다|클로즈업|화면에|화면을|카메라|연출|소개하며\s*.+있다|누르는\s*장면|담는\s*모습)/i
    const directionCount = rawScenes.filter((scene: Record<string, unknown>) =>
      directionPattern.test(String(scene.narration || ""))
    ).length
    // 모델이 글자 수를 잘 못 지켜 2배 가까이 길게 쓰는 경우가 많아, 길이 초과도 교정 대상으로 본다.
    const narrationChars = rawScenes.reduce(
      (sum, scene) => sum + String(scene.narration || "").replace(/\s+/g, "").length,
      0
    )
    const tooLong = narrationChars > targetCharacters * 1.2
    const tooShort = narrationChars < targetCharacters * 0.85
    if (tooLong || tooShort || directionCount >= Math.ceil(rawScenes.length / 2)) {
      const repairResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: SHOTFORM_COPY_MODEL,
          temperature: 0.5,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `너는 숏폼 대본 교정 작가다. 입력 JSON의 스토리 순서·사실·말투는 유지하되 scenes를 교정한다.

${isSsul ? SSUL_STYLE_GUIDE : POLITE_STYLE_GUIDE}

반드시 지킬 규칙:
- narration은 성우가 그대로 읽는 대사다.
- narration에 장면·모습·화면·카메라·클로즈업·연출 같은 촬영 설명을 절대 쓰지 않는다.
- 시각적 행동과 촬영 설명은 visualPrompt로 옮긴다.
- caption은 narration의 의미를 짧게 압축한다.
- 현재 narration 합계는 공백 제외 ${narrationChars}자다. ${
                tooLong || tooShort
                  ? `반드시 ${targetCharacters}자 안팎으로 ${tooLong ? "줄이고" : "늘리고(근거 안의 감각 묘사·반응·꿀팁 추가, 사실 추가 금지)"}, 장면당 약 ${Math.round(targetCharacters / Math.max(rawScenes.length, targetSceneCount))}자로 맞춘다.`
                  : "분량은 크게 바꾸지 않는다."
              }
- 확인되지 않은 사실은 추가하지 않는다.
- 기존 claims/sourceIds/claimIds/sentences를 유지하고, 문장을 바꾸면 sentences.text도 동일하게 갱신한다.
- 숫자·효능 문장은 검증된 claim ID와 SOURCE ID가 없으면 삭제한다.

JSON만 출력:
{"script":"실제로 읽을 전체 대본","claims":[{"id":"claim-1","text":"주장","category":"factual","sourceIds":["product-core"],"verified":true}],"scenes":[{"narration":"실제로 읽을 대사","caption":"짧은 화면 자막","visualPrompt":"장면 설명","durationSec":5,"sourceIds":["product-core"],"claimIds":["claim-1"],"sentences":[{"id":"scene-1-sentence-1","text":"문장","sourceIds":["product-core"],"claimIds":["claim-1"]}]}]}`,
            },
            {
              role: "user",
              content: `${evidence}\n\n교정할 JSON:\n${JSON.stringify(parsed)}`,
            },
          ],
        }),
      })
      if (repairResponse.ok) {
        const repairData = await repairResponse.json()
        const repairedResult = generatedStoryModelSchema.safeParse(
          JSON.parse(String(repairData.choices?.[0]?.message?.content || "{}"))
        )
        const repaired = repairedResult.success ? repairedResult.data : null
        if (repaired && Array.isArray(repaired.scenes) && repaired.scenes.length > 0) {
          parsed = { ...parsed, ...repaired }
          rawScenes = repaired.scenes as Record<string, unknown>[]
        }
      }
    }
    // 전체 교정 프롬프트는 분량을 거의 못 늘려서, 장면별 목표 글자 수를 주고 한 번 더 늘린다
    const charsAfterRepair = rawScenes.reduce(
      (sum, scene) => sum + String(scene.narration || "").replace(/\s+/g, "").length,
      0
    )
    if (lengthOff(charsAfterRepair, targetCharacters)) {
      const expanded = await expandShortNarrations({
        openaiApiKey: apiKey,
        narrations: rawScenes.map((scene) => String(scene.narration || "")),
        charTarget: targetCharacters,
        sourceMaterial: evidence,
        voiceRule: isSsul
          ? '말투(음슴체 썰 서술 ~했음·~함·~거임, 존댓말 금지)·장면별 역할(마지막 장면은 "아, 참고로" 꿀팁)'
          : "말투(자연스러운 존댓말 구어체)·장면별 역할(제품 공개 시점 유지)",
        keepFirst: isSsul,
      })
      const expandedChars = expanded ? expanded.join("").replace(/s+/g, "").length : 0
      if (expanded && Math.abs(expandedChars - targetCharacters) < Math.abs(charsAfterRepair - targetCharacters)) {
        rawScenes = rawScenes.map((scene, index) => ({ ...scene, narration: expanded[index] }))
      }
    }
    const stripEnd = (text: string) => text.trim().replace(/[.。!?]+$/, "")
    const title = stripEnd(String(parsed.title || ""))
    const firstNarration = stripEnd(String(rawScenes[0]?.narration || ""))
    // 썰 채널은 제목을 첫 문장으로 읽음 — 모델이 빠뜨리면 제목 장면을 맨 앞에 추가
    const needsTitleScene = isSsul && title && !firstNarration.startsWith(title.slice(0, 8))
    const sceneSource = needsTitleScene
      ? [
          {
            narration: `${title}.`,
            caption: title,
            visualPrompt: rawScenes[0]?.visualPrompt,
            durationSec: 2,
            sourceIds: rawScenes[0]?.sourceIds,
            claimIds: rawScenes[0]?.claimIds,
          },
          ...rawScenes.slice(0, STORY_MAX_SCENES - 1),
        ]
      : rawScenes.slice(0, STORY_MAX_SCENES)
    const scenes = sceneSource.map((scene: Record<string, unknown>, index: number) => {
      const narration = String(scene.narration || "").replace(/>>\s*/g, "").trim()
      const sourceIds = Array.isArray(scene.sourceIds)
        ? scene.sourceIds.map(String).filter((id) => validSourceIds.has(id))
        : []
      const claimIds = Array.isArray(scene.claimIds) ? scene.claimIds.map(String) : []
      return {
        id: `story_scene_${Date.now()}_${index + 1}`,
        order: index + 1,
        narration,
        caption: String(scene.caption || "").trim(),
        visualPrompt: String(scene.visualPrompt || "").trim(),
        durationSec: Math.max(1, Number(scene.durationSec) || 5),
        sourceIds,
        claimIds,
        sentences: splitGroundedSentences(narration).map((text, sentenceIndex) => ({
          id: `scene_${index + 1}_sentence_${sentenceIndex + 1}`,
          text,
          sourceIds,
          claimIds,
        })),
      }
    })
    const rawDuration = scenes.reduce((sum, scene) => sum + scene.durationSec, 0) || 1
    let remainingDuration = targetSeconds
    const normalizedScenes = scenes.map((scene, index) => {
      const remainingSceneCount = scenes.length - index - 1
      const maxForCurrent = Math.max(1, remainingDuration - remainingSceneCount)
      const durationSec =
        index === scenes.length - 1
          ? remainingDuration
          : Math.max(
              1,
              Math.min(
                maxForCurrent,
                Math.round((scene.durationSec / rawDuration) * targetSeconds)
              )
            )
      remainingDuration -= durationSec
      return { ...scene, durationSec }
    })
    assertGroundedStory({
      claims: parsed.claims,
      scenes: normalizedScenes,
      validSourceIds,
    })
    const responseRevision = stableStoryIdentity({
      requestId,
      productIdentity,
      reviewSetIdentity,
      baseRevision: body.baseRevision,
      scenes: normalizedScenes.map((scene) => scene.narration),
    })
    return NextResponse.json({
      success: true,
      requestId,
      productIdentity,
      reviewSetIdentity,
      baseRevision: body.baseRevision,
      responseRevision,
      story: {
        templateId,
        templateName: STORY_SCRIPT_TEMPLATES[templateId].name,
        targetDurationSec: targetSeconds,
        typeReason: String(parsed.typeReason || "").trim(),
        hook: String(parsed.hook || "").trim(),
        title,
        narrationStyle,
        script: normalizedScenes
          .map((scene) => scene.narration)
          .filter(Boolean)
          .join("\n\n"),
        scenes: normalizedScenes,
        evidenceSources,
        claims: parsed.claims,
        generationContext: {
          requestId,
          productIdentity,
          reviewSetIdentity,
          baseRevision: body.baseRevision,
          responseRevision,
        },
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "스토리 생성에 실패했습니다." },
      { status: 500 }
    )
  }
}
