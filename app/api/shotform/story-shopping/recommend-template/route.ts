import { NextRequest, NextResponse } from "next/server"
import type { StoryScriptTemplateId } from "@/app/WingsAIStudioShotForm/story-shopping/story-types"

export const runtime = "nodejs"

const TEMPLATE_IDS = new Set<StoryScriptTemplateId>([
  "origin",
  "inventor",
  "competition",
  "unexpected-use",
  "hidden-truth",
  "heartwarming-true",
  "review-twist",
  "problem-solution",
  "before-after",
  "challenge-test",
  "mistake-warning",
  "expert-tip",
  "comparison",
  "time-saving",
  "gift-reaction",
  "trend-discovery",
])

export async function POST(request: NextRequest) {
  try {
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
        model: "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `쇼핑 숏폼 스토리 전략가로서 제품의 특성과 사용 맥락에 가장 적합한 유형 하나를 고르세요.

유형:
- origin: 만들어진 이유나 문제 해결 과정이 흥미로운 제품
- inventor: 기발한 구조·아이디어·발명성이 강한 제품
- competition: 기존 제품의 불편을 새로운 방식으로 개선한 제품
- unexpected-use: 의외의 사용법이나 다양한 활용이 강점인 제품
- hidden-truth: 익숙하지만 잘 알려지지 않은 특징이 있는 제품
- heartwarming-true: 실제 사람·가족·관계의 검증된 사연이 충분한 제품
- review-twist: 처음의 의심을 뒤집을 만큼 구체적이고 일관된 실제 사용 후기가 충분한 제품
- problem-solution: 반복되는 생활 불편과 이를 해결하는 기능이 분명한 제품
- before-after: 사용 전후의 변화가 입력 자료로 구체적으로 확인되는 제품
- challenge-test: 같은 조건에서 성능이나 사용성을 직접 시험하기 좋은 제품
- mistake-warning: 잘못된 사용법이나 구매 실수를 예방할 정보가 충분한 제품
- expert-tip: 선택 기준이나 올바른 사용 팁으로 설명할 가치가 큰 제품
- comparison: 기존 방식과 새 방식의 장단점을 공정하게 비교할 수 있는 제품
- time-saving: 반복 작업이나 사용 단계를 실질적으로 줄여주는 제품
- gift-reaction: 특정 관계나 상황에서 선물하는 맥락이 자연스러운 제품
- trend-discovery: 최근 주목받는 이유와 새로운 사용 맥락을 설명할 수 있는 제품

규칙:
- 수집된 정보에 근거해 선택한다.
- 검증된 실화가 없으면 heartwarming-true를 추천하지 않는다.
- 실제 리뷰가 부족하거나 평가가 추상적이면 review-twist를 추천하지 않는다.
- 확인 가능한 전후 자료가 없으면 before-after를 추천하지 않는다.
- 검증할 조건이나 결과 근거가 없으면 challenge-test를 추천하지 않는다.
- 실제 유행 근거가 없으면 trend-discovery를 추천하지 않는다.
- 탄생 배경 근거가 없으면 origin보다 제품 기능과 사용 맥락에 맞는 다른 유형을 우선한다.
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
    const templateId = String(parsed.templateId || "") as StoryScriptTemplateId
    if (!TEMPLATE_IDS.has(templateId)) {
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
