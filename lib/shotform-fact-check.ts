import type { CoupangDetailInsights } from "@/lib/shotform-coupang-detail-insights"
import type { CoupangFactCheck, CoupangReviewInsights } from "@/lib/shotform-coupang-reviews"

function clampScore(n: unknown, fallback = 50): number {
  const v = typeof n === "number" ? n : Number(n)
  if (!Number.isFinite(v)) return fallback
  return Math.max(0, Math.min(100, Math.round(v)))
}

export function normalizeFactCheck(
  raw: Partial<CoupangFactCheck> | null | undefined,
  fallbacks?: Partial<CoupangFactCheck>
): CoupangFactCheck {
  const f = fallbacks || {}
  const reviewEvidence = clampScore(raw?.reviewEvidence, f.reviewEvidence ?? 45)
  const detailEvidence = clampScore(raw?.detailEvidence, f.detailEvidence ?? 35)
  const specificity = clampScore(raw?.specificity, f.specificity ?? 50)
  const consistency = clampScore(raw?.consistency, f.consistency ?? 50)
  const lowHype = clampScore(raw?.lowHype, f.lowHype ?? 55)
  const dims = [reviewEvidence, detailEvidence, specificity, consistency, lowHype]
  const avg = Math.round(dims.reduce((a, b) => a + b, 0) / dims.length)
  const overall = clampScore(raw?.overall, f.overall ?? avg)
  const note =
    typeof raw?.note === "string" && raw.note.trim()
      ? raw.note.trim().slice(0, 120)
      : f.note

  return {
    overall,
    reviewEvidence,
    detailEvidence,
    specificity,
    consistency,
    lowHype,
    ...(note ? { note } : {}),
  }
}

/** 리뷰/상세 텍스트 밀도로 대략적인 사실성 추정 (AI 없을 때 폴백) */
export function heuristicFactCheck(opts: {
  reviewCount: number
  reviewInsights?: CoupangReviewInsights | null
  detailInsights?: CoupangDetailInsights | null
  detailDisabled?: boolean
}): CoupangFactCheck {
  const r = opts.reviewInsights
  const d = opts.detailInsights
  const texts = [
    ...(r?.strengths || []),
    ...(r?.useCases || []),
    ...(r?.concerns || []),
    ...(r?.quotes || []),
    d?.summary || "",
    ...(d?.features || []),
    ...(d?.sellingPoints || []),
  ].join(" ")

  const hasNumber = /\d/.test(texts)
  const concreteHits = (texts.match(/(습니다|했어요|느낌|사용|보관|용량|무게|크기|배송|재구매|만족)/g) || [])
    .length
  const hypeHits = (texts.match(/(최고|완벽|무조건|절대|기적|혁명|평생|100%)/g) || []).length

  const reviewDensity = Math.min(100, opts.reviewCount * 8 + (r?.quotes?.length || 0) * 6)
  const detailDensity = opts.detailDisabled
    ? 25
    : d
      ? Math.min(
          100,
          30 +
            (d.features?.length || 0) * 8 +
            (d.sellingPoints?.length || 0) * 5 +
            (d.summary ? 15 : 0)
        )
      : 20

  const specificity = Math.min(100, 35 + (hasNumber ? 20 : 0) + Math.min(35, concreteHits * 2))
  const lowHype = Math.max(20, Math.min(100, 78 - hypeHits * 12))
  const consistency =
    r && d
      ? Math.min(100, 55 + Math.min(25, (r.strengths?.length || 0) * 3) + (d.summary ? 10 : 0))
      : r
        ? 58
        : d
          ? 52
          : 40

  return normalizeFactCheck({
    reviewEvidence: reviewDensity,
    detailEvidence: detailDensity,
    specificity,
    consistency,
    lowHype,
    note:
      opts.reviewCount > 0
        ? "리뷰·상세 근거를 바탕으로 추정한 사실성 점수입니다."
        : "상세 정보 기준으로 추정한 사실성 점수입니다.",
  })
}

/** AI factCheck + 상세 분석 유무를 반영해 최종 점수 */
export function mergeFactCheck(opts: {
  ai?: Partial<CoupangFactCheck> | null
  reviewCount: number
  reviewInsights?: CoupangReviewInsights | null
  detailInsights?: CoupangDetailInsights | null
  detailDisabled?: boolean
}): CoupangFactCheck {
  const base = heuristicFactCheck(opts)
  if (!opts.ai) return base

  const merged = normalizeFactCheck(opts.ai, base)

  // 상세 분석이 있으면 상세 근거 점수를 끌어올리고, 없으면 낮게 유지
  let detailEvidence = merged.detailEvidence
  if (opts.detailInsights && !opts.detailDisabled) {
    detailEvidence = Math.max(detailEvidence, Math.min(95, base.detailEvidence + 8))
  } else if (opts.detailDisabled || !opts.detailInsights) {
    detailEvidence = Math.min(detailEvidence, base.detailEvidence)
  }

  // 리뷰가 없으면 리뷰 근거를 낮춤
  let reviewEvidence = merged.reviewEvidence
  if (opts.reviewCount < 1) {
    reviewEvidence = Math.min(reviewEvidence, 28)
  }

  const dims = [
    reviewEvidence,
    detailEvidence,
    merged.specificity,
    merged.consistency,
    merged.lowHype,
  ]
  const overall = Math.round(dims.reduce((a, b) => a + b, 0) / dims.length)

  return {
    ...merged,
    reviewEvidence,
    detailEvidence,
    overall: clampScore(opts.ai.overall != null ? (merged.overall + overall) / 2 : overall),
  }
}

export function factCheckGrade(overall: number): {
  label: string
  tone: "high" | "mid" | "low"
} {
  if (overall >= 78) return { label: "사실 근거 충분", tone: "high" }
  if (overall >= 58) return { label: "대체로 사실 기반", tone: "mid" }
  return { label: "과장 주의 · 재확인 권장", tone: "low" }
}

export const FACT_CHECK_DIMS: Array<{
  key: keyof Pick<
    CoupangFactCheck,
    "reviewEvidence" | "detailEvidence" | "specificity" | "consistency" | "lowHype"
  >
  label: string
  short: string
}> = [
  { key: "reviewEvidence", label: "리뷰 근거", short: "리뷰" },
  { key: "detailEvidence", label: "상세 근거", short: "상세" },
  { key: "specificity", label: "구체성", short: "구체" },
  { key: "consistency", label: "일관성", short: "일치" },
  { key: "lowHype", label: "과장 억제", short: "절제" },
]
