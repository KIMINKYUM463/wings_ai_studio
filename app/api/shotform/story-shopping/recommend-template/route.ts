import { NextRequest, NextResponse } from "next/server"
import {
  STORY_SCRIPT_TEMPLATES,
  STORY_SCRIPT_TEMPLATE_IDS,
  isStoryScriptTemplateId,
} from "@/app/WingsAIStudioShotForm/story-shopping/story-script-catalog"
import { SHOTFORM_COPY_MODEL } from "@/lib/shotform-ai-models"
import { guardStoryApiRequest } from "@/lib/story-shopping-security"

export const runtime = "nodejs"

const TEMPLATE_LIST = STORY_SCRIPT_TEMPLATE_IDS.map(
  (id) => `- ${id}: ${STORY_SCRIPT_TEMPLATES[id].recommendWhen}`
).join("\n")

export async function POST(request: NextRequest) {
  try {
    const access = await guardStoryApiRequest(request, {
      limit: 12,
      maxBytes: 100_000,
    })
    if (access.error) return access.error
    const body = await request.json()
    const productName = String(body.productName || "").trim()
    const apiKey =
      String(body.apiKey || "").trim() ||
      process.env.OPENAI_API_KEY ||
      process.env.GPT_API_KEY ||
      process.env.CHATGPT_API_KEY
    if (!productName) {
      return NextResponse.json({ error: "선택된 상품이 없습니다." }, { status: 400 })
    }
    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API 키가 필요합니다." }, { status: 503 })
    }

    const collector = body.collectorData || {}
    const reviews = Array.isArray(collector.reviews)
      ? collector.reviews
          .slice(0, 20)
          .map((review: { content?: string }) => String(review.content || "").trim())
          .filter(Boolean)
          .join(" | ")
      : ""
    const productContext = [
      `상품명: ${productName}`,
      `상품 설명: ${String(body.productDescription || "").slice(0, 2500) || "없음"}`,
      `상세 분석: ${JSON.stringify(collector.detailInsights || {}).slice(0, 3500)}`,
      `리뷰 분석: ${JSON.stringify(collector.reviewInsights || {}).slice(0, 3500)}`,
      `실제 리뷰: ${reviews.slice(0, 4000) || "없음"}`,
    ].join("\n")

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: SHOTFORM_COPY_MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `쇼핑 숏폼 스토리 전략가로서 제품의 특성과 사용 맥락에 가장 적합한 유형 하나를 고르세요.

유형:
${TEMPLATE_LIST}

규칙:
- 수집된 정보에 근거해 선택한다.
- 검증된 실화가 없으면 heartwarming-true를 추천하지 않는다.
- 실제 리뷰가 부족하거나 평가가 추상적이면 review-twist를 추천하지 않는다.
- 확인 가능한 전후 자료가 없으면 before-after를 추천하지 않는다.
- 검증할 조건이나 결과 근거가 없으면 challenge-test를 추천하지 않는다.
- 실제 유행 근거가 없으면 trend-discovery를 추천하지 않는다.
- 우연한 탄생 일화·도움받은 일화가 근거 자료에 없으면 accident-hit, rescue-story를 추천하지 않는다.
- 리뉴얼·구성 변경·재출시 근거가 없으면 quiet-change를, 이탈·재구매 흐름이 리뷰에 없으면 consumer-revolt를 추천하지 않는다.
- 성분·안전·품질 논란 근거가 없으면 controversy-flip을 추천하지 않는다.
- 위험하거나 권장되지 않는 활용법만 있다면 maker-panic을 추천하지 않는다.
- 탄생 배경 근거가 없으면 origin보다 제품 기능과 사용 맥락에 맞는 다른 유형을 우선한다.
- time-saving은 작업 시간이나 단계를 실제로 줄여주는 도구·가전에만 추천한다. 의류·방한·뷰티·침구처럼 착용감·체감이 핵심인 제품에는 추천하지 않는다.
- 추천 이유가 "~해서 시간을 절약" 처럼 제품 기능을 유형에 억지로 끼워 맞추는 문장이 되면 그 유형은 틀린 것이다. 제품의 핵심 가치(예: 보온, 정리, 세정)가 유형의 갈등·해결 구조와 그대로 맞는 유형을 고른다.
- 광고 문구가 아니라, 이 제품에서 어떤 이야기가 자연스럽게 나오는지 판단한다.

JSON만 출력:
{"templateId":"유형 ID","reason":"제품 특성과 연결한 추천 이유 1~2문장"}`,
          },
          { role: "user", content: productContext },
        ],
      }),
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => "")
      throw new Error(`템플릿 추천 실패 (${response.status}): ${detail.slice(0, 180)}`)
    }
    const data = await response.json()
    const parsed = JSON.parse(String(data.choices?.[0]?.message?.content || "{}"))
    const templateId = String(parsed.templateId || "")
    if (!isStoryScriptTemplateId(templateId)) {
      throw new Error("AI가 올바른 스토리 유형을 선택하지 못했습니다.")
    }
    return NextResponse.json({
      success: true,
      recommendation: {
        templateId,
        reason: String(parsed.reason || "").trim(),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "템플릿 추천에 실패했습니다." },
      { status: 500 }
    )
  }
}
