import type { ProductAnalysis, ProductVideoStructure } from "@/lib/shotform-auto-edit-types"

/** 대본·SEO — UI 1단계 입력이 job 저장값보다 우선 */
export function resolveNarrationSourceKeywords(
  liveInput?: readonly string[],
  jobStored?: readonly string[]
): string[] {
  const live = normalizeUserSourceKeywords(liveInput)
  if (live.length) return live
  return normalizeUserSourceKeywords(jobStored)
}

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
      ? [
          `**사용자 입력 키워드 (최우선·제품 정체성 기준)**: ${kw.join(", ")}`,
          `- 대본은 **이 키워드 제품**을 홍보하는 쇼핑숏폼. 원본 중국 숏폼 제목·Vision·장면과 키워드를 **함께** 반영.`,
          `- 영상 분석 제품명·다른 물건이 보여도 나레이션은 키워드 제품 기준으로만 작성.`,
          `- **키워드 전체 명칭(예: 무선 마우스)은 후킹 1회·마지막 CTA 1회만**. 중간 컷은 이거/마우스/손에 쥔 이 친구 등으로 지칭. 매 컷 제품명 반복 금지.`,
          `- **소파·가구 키워드면** 핸들·그립·손잡이·청소·흡입·차량 표현 **절대 금지**. 좌석·쿠션·거실·패브릭·인테리어만.`,
        ].join("\n")
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

/** 차량용·스마트폰 거치대 등 마운트 제품 여부 */
export function isCarMountOrHolderProduct(blob: string): boolean {
  const b = blob.trim()
  if (!b) return false
  if (/청소기|吸尘|vacuum|진공\s*청소|핸디\s*청소/i.test(b) && !/거치|홀더|마운트|holder|mount|브라켓|支架/i.test(b)) {
    return false
  }
  return /거치대|홀더|마운트|holder|mount|브라켓|휴대폰\s*거치|스마트폰\s*거치|手机支架|车载|차량용\s*거치|대시보드\s*거치/i.test(
    b
  )
}

/** 소파·거실 가구 등 — 핸들·청소기 템플릿과 분리 */
export function isFurnitureSofaProduct(blob: string): boolean {
  const b = blob.trim()
  if (!b) return false
  if (/청소기|吸尘|vacuum|마우스|mouse|키보드|keyboard|칫솔|거치대\s*만/i.test(b) && !/소파|쇼파|sofa|couch|沙发/i.test(b)) {
    return false
  }
  return /소파|쇼파|카우치|리클라이너|패브릭\s*소파|대형\s*소파|큰\s*소파|거실\s*소파|거실\s*가구|sofa|couch|沙发|沙發|leather\s*sofa|sectional/i.test(
    b
  )
}

/** 키워드 제품과 명백히 다른 카테고리 용어가 대본에 섞였는지 */
export function detectObviousProductCategoryLeak(
  lines: readonly string[],
  userKeywords: readonly string[]
): string[] {
  const kw = userKeywords.join(" ")
  const leaks: string[] = []

  if (isFurnitureSofaProduct(kw)) {
    const forbidden =
      /핸들|그립|손잡|손에\s*쥐|한\s*손에\s*쥐|노즐|흡입|먼지|청소기|진공|차량|운전|트렁크|시트\s*먼지|구석\s*청소|핸디|휴대용\s*청소|바닥\s*매트\s*먼지|영화관|프로젝터|몰입감|클릭만\s*하면|USB/i
    for (const line of lines) {
      const t = line.replace(/\n/g, " ").trim()
      if (t && forbidden.test(t)) leaks.push(t.slice(0, 48))
    }
    return [...new Set(leaks)]
  }

  const isMount = isCarMountOrHolderProduct(kw)
  if (!isMount) return []

  const forbidden =
    /핸디\s*청소|청소기|먼지|흡입|노즐|빨아들|진공|흡입구|먼지통|영화관|몰입감|프로젝터|스크린|경기\s*볼|야외에\s*설치|밝기가\s*확실|화면이\s*이렇게\s*선명|현장감이\s*살|정리\s*포인트|각도\s*조절\s*포인트|다른\s*컷|포인트|수납력이\s*또/i
  for (const line of lines) {
    const t = line.replace(/\n/g, " ").trim()
    if (t && forbidden.test(t)) leaks.push(t.slice(0, 48))
  }
  return leaks
}
