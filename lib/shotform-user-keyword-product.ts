import type { ProductAnalysis, ProductVideoStructure } from "@/lib/shotform-auto-edit-types"

/** 1단계에서 사용자가 입력한 한국어 키워드 정규화 */
export function normalizeUserSourceKeywords(raw?: readonly string[]): string[] {
  if (!raw?.length) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const k of raw) {
    const t = k.trim()
    if (!t || seen.has(t.toLowerCase())) continue
    seen.add(t.toLowerCase())
    out.push(t)
  }
  return out
}

/** 대본·제품명에 쓸 주 라벨 — 사용자 키워드가 있으면 최우선 */
export function primaryProductLabelFromKeywords(
  userKeywords?: readonly string[],
  fallback?: string
): string {
  const kw = normalizeUserSourceKeywords(userKeywords)
  if (kw.length) return kw[0]!
  return fallback?.trim() || "제품"
}

/** 영상 AI 분석 결과에 사용자 키워드를 병합 — 제품명·targetKeywords 우선 반영 */
export function applyUserKeywordsToProductAnalysis(
  productAnalysis: ProductAnalysis,
  userKeywords?: readonly string[]
): ProductAnalysis {
  const kw = normalizeUserSourceKeywords(userKeywords)
  if (!kw.length) return productAnalysis

  const productName = primaryProductLabelFromKeywords(kw, productAnalysis.productName)
  const mergedKeywords = [...kw]
  for (const k of productAnalysis.targetKeywords) {
    if (!mergedKeywords.some((m) => m.toLowerCase() === k.toLowerCase())) {
      mergedKeywords.push(k)
    }
  }

  const summaryPrefix = productName
  const summary = productAnalysis.summary?.trim()
    ? `${summaryPrefix} — ${productAnalysis.summary}`
    : summaryPrefix

  return {
    ...productAnalysis,
    productName,
    targetKeywords: mergedKeywords,
    summary,
  }
}

/** 나레이션 API·후처리용 제품 컨텍스트 — 사용자 키워드 최상단 */
export function buildNarrationProductContext(args: {
  userKeywords?: readonly string[]
  productName: string
  category?: string
  summary?: string
  videoStructure?: ProductVideoStructure
  analysisTitles?: readonly string[]
  visualBlob?: string
  topic?: string
  naturalShorts?: boolean
}): string {
  const kw = normalizeUserSourceKeywords(args.userKeywords)
  const vs = args.videoStructure
  return [
    kw.length
      ? `**사용자 입력 키워드 (최우선·제품 정체성 기준)**: ${kw.join(", ")}`
      : "",
    `제품명: ${args.productName}`,
    args.naturalShorts && args.topic ? `스토리 주제: ${args.topic}` : "",
    args.category ? `카테고리: ${args.category}` : "",
    args.summary ? `영상 분석 요약: ${args.summary}` : "",
    vs?.hook ? `후킹 방향: ${vs.hook}` : "",
    vs?.body ? `본문 방향: ${vs.body}` : "",
    vs?.cta ? `마무리/CTA: ${vs.cta}` : "",
    args.analysisTitles?.length ? args.analysisTitles.map((t) => `[소스] ${t}`).join("\n") : "",
    args.visualBlob ? `편집 컷 화면 힌트:\n${args.visualBlob}` : "",
  ]
    .filter(Boolean)
    .join("\n")
}
