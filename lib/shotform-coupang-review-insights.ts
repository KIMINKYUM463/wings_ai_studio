import type { CoupangFactCheck, CoupangReviewInsights } from "@/lib/shotform-coupang-reviews"
import { normalizeFactCheck } from "@/lib/shotform-fact-check"

type ReviewLike = {
  author?: string
  rating?: number
  content: string
  date?: string
}

function emptyInsights(): CoupangReviewInsights {
  return { strengths: [], useCases: [], concerns: [], quotes: [] }
}

function normalizeList(v: unknown, max = 8): string[] {
  if (!Array.isArray(v)) return []
  return v
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .slice(0, max)
}

function parseFactCheck(v: unknown): CoupangFactCheck | undefined {
  if (!v || typeof v !== "object") return undefined
  const o = v as Record<string, unknown>
  return normalizeFactCheck({
    overall: o.overall as number,
    reviewEvidence: o.reviewEvidence as number,
    detailEvidence: o.detailEvidence as number,
    specificity: o.specificity as number,
    consistency: o.consistency as number,
    lowHype: o.lowHype as number,
    note: typeof o.note === "string" ? o.note : undefined,
  })
}

export async function extractCoupangReviewInsights(
  reviews: ReviewLike[],
  openaiApiKey: string,
  productName?: string
): Promise<CoupangReviewInsights> {
  const usable = reviews.map((r) => r.content.trim()).filter((c) => c.length >= 4).slice(0, 40)
  if (!usable.length) return emptyInsights()

  const reviewBlock = usable.map((c, i) => `${i + 1}. ${c.slice(0, 280)}`).join("\n")

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `당신은 쿠팡 상품평 분석가입니다. 쇼핑 숏폼 대본용 '리뷰 기반 대본 참고 포인트'와 '사실 기반 신뢰도'를 JSON으로만 반환합니다.
스키마:
{
  "strengths": string[]  // 장점·만족 포인트
  "useCases": string[]   // 사용 상황·대상
  "concerns": string[]   // 아쉬움·주의 (없거나 약하면 경쟁 대비·품질 안심 포인트로)
  "quotes": string[]     // 실제 리뷰 짧은 표현 (과장·욕설 제거)
  "factCheck": {
    "overall": number,          // 0~100 종합 사실성
    "reviewEvidence": number,   // 리뷰가 구체적 경험·수치로 뒷받침되는 정도
    "detailEvidence": number,   // (리뷰만 보면) 상세스펙 언급 가능성 추정, 없으면 35~55
    "specificity": number,      // 구체성 (숫자·상황·비교가 있는지)
    "consistency": number,      // 리뷰들끼리 모순이 적은지
    "lowHype": number,          // 높을수록 과장·광고성 톤이 적음
    "note": string              // 한 줄 평가 (한국어, 60자 이내)
  }
}
규칙:
- 각 배열 4~6개
- strengths/useCases/concerns는 화면에서 문단으로 이어 붙이므로, 각 항목을 "~했다는 평이 많아요.", "~라는 반응이 반복됩니다."처럼 완성된 한국어 문장으로 쓸 것
- quotes만 짧은 구어체 표현(8~28자)
- 리뷰에 없는 내용은 만들지 말 것
- factCheck 점수는 엄격히: 모호한 칭찬만 많으면 specificity·reviewEvidence를 낮게, 수치·기간·비교가 있으면 높게
- lowHype는 "최고/완벽/무조건" 남발이면 낮게`,
        },
        {
          role: "user",
          content: `상품명: ${productName || "(미상)"}\n\n상품평:\n${reviewBlock}`,
        },
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    throw new Error(`인사이트 생성 실패 (${res.status}) ${errText.slice(0, 200)}`)
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const raw = data.choices?.[0]?.message?.content || "{}"
  let parsed: Record<string, unknown> = {}
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return emptyInsights()
  }

  const factCheck = parseFactCheck(parsed.factCheck)

  return {
    strengths: normalizeList(parsed.strengths, 6),
    useCases: normalizeList(parsed.useCases, 6),
    concerns: normalizeList(parsed.concerns, 6),
    quotes: normalizeList(parsed.quotes, 6),
    ...(factCheck ? { factCheck } : {}),
  }
}

export function formatInsightsForScript(insights: CoupangReviewInsights | null | undefined): string {
  if (!insights) return ""
  const lines: string[] = []
  if (insights.strengths.length) lines.push(`장점: ${insights.strengths.join(", ")}`)
  if (insights.useCases.length) lines.push(`사용 상황: ${insights.useCases.join(", ")}`)
  if (insights.concerns.length) lines.push(`주의: ${insights.concerns.join(", ")}`)
  if (insights.quotes.length) lines.push(`고객 표현: ${insights.quotes.map((q) => `"${q}"`).join(", ")}`)
  if (insights.factCheck) {
    lines.push(
      `사실성 점수: ${insights.factCheck.overall}/100 (${insights.factCheck.note || "리뷰 근거 기준"})`
    )
  }
  return lines.join("\n")
}
