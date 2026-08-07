/** 쿠팡 상품평 수집 — 타입·상태 메시지 (로컬 에이전트 Playwright) */

export type CoupangReviewSort = "best" | "latest"

export type CoupangCollectStatus =
  | "ready"
  | "no_reviews"
  | "dependency_missing"
  | "profile_locked"
  | "blocked"
  | "failed"
  | "session_ready"

export type CoupangReviewRaw = {
  author?: string
  rating?: number
  content: string
  date?: string
  option?: string
  title?: string
  seller?: string
  /** 쿠팡 상품평 페이지 번호 (1부터) */
  page?: number
  /** 해당 페이지 안에서의 순번 (1부터) */
  indexOnPage?: number
  /** 리뷰 첨부 사진 URL */
  images?: string[]
}

/** 벤치마킹 UI와 동일 — 화면 페이지당 리뷰 수 */
export const COUPANG_REVIEWS_PER_PAGE = 5

export function resolveReviewPageMeta(
  review: { page?: number; indexOnPage?: number } | null | undefined,
  listIndex: number,
  perPage = COUPANG_REVIEWS_PER_PAGE
): { page: number; indexOnPage: number } {
  const safePer = Math.max(1, perPage)
  const page =
    typeof review?.page === "number" && review.page > 0
      ? Math.floor(review.page)
      : Math.floor(listIndex / safePer) + 1
  const indexOnPage =
    typeof review?.indexOnPage === "number" && review.indexOnPage > 0
      ? Math.floor(review.indexOnPage)
      : (listIndex % safePer) + 1
  return { page, indexOnPage }
}

/** 예: "1페이지 · 1번" */
export function formatReviewPageLabel(page: number, indexOnPage: number): string {
  return `${page}페이지 · ${indexOnPage}번`
}

export type CoupangCollectResult = {
  status: CoupangCollectStatus
  message?: string
  productName?: string
  productUrl?: string
  price?: string
  productPrice?: string
  delivery?: string
  productDelivery?: string
  description?: string
  productDescription?: string
  detailText?: string
  images?: string[]
  detailImages?: string[]
  productImage?: string
  /** 상품평에 첨부된 사진들 */
  reviewImages?: string[]
  detailImageCount?: number
  essentialInfo?: Record<string, string>
  reviewCountText?: string
  reviewCount?: number
  reviews?: CoupangReviewRaw[]
  sort?: CoupangReviewSort
  maxPages?: number
  profileDir?: string
  detail?: string
}

/** 숏폼 대본이 얼마나 '사실·근거'에 가까운지 (0~100) */
export type CoupangFactCheck = {
  overall: number
  reviewEvidence: number
  detailEvidence: number
  specificity: number
  consistency: number
  /** 높을수록 과장·허위 마케팅 톤이 적음 */
  lowHype: number
  note?: string
}

export type CoupangReviewInsights = {
  strengths: string[]
  useCases: string[]
  concerns: string[]
  quotes: string[]
  factCheck?: CoupangFactCheck
}

export function coupangStatusMessage(status: CoupangCollectStatus, fallback?: string): string {
  switch (status) {
    case "ready":
      return "상품평을 가져왔습니다."
    case "no_reviews":
      return "등록된 상품평이 없습니다."
    case "dependency_missing":
      return "Playwright가 없습니다. 프로젝트 폴더에서 npm run shotform:install-coupang 를 실행하세요."
    case "profile_locked":
      return "쿠팡 Chrome 프로필이 잠겨 있습니다. 열린 수집/세션 창을 닫고 다시 시도하세요."
    case "blocked":
      return "쿠팡(Akamai) 차단입니다. 「쿠팡 세션(로그인)」으로 Chrome에서 상품이 보이게 한 뒤 창을 닫고 다시 가져오세요."
    case "session_ready":
      return "쿠팡용 Chrome 창을 열었습니다. 로그인 후 창을 닫으세요."
    case "failed":
    default:
      return fallback || "쿠팡 상품평 수집에 실패했습니다."
  }
}

/** 작성자·판매자·상품명·옵션 접두어를 떼고 리뷰 본문만 남김 */
export function stripCoupangReviewMetaPrefix(content: string, productName?: string): string {
  let s = String(content || "")
    .replace(/\s+/g, " ")
    .trim()
  if (!s) return ""

  const headerRe =
    /^(?:[가-힣*]{2,8}\s+)?[가-힣A-Za-z0-9&·]{2,30}\s*\[[^\]]{1,40}\][\s\S]{5,200}?(?:\d+(?:\.\d+)?\s*(?:kg|g|ml|l|입|개|팩|박스|병|세트|봉))(?:\s*,\s*[가-힣A-Za-z0-9()[\]\s./\-]{0,80}?(?:\d+(?:\.\d+)?\s*(?:kg|g|ml|l|입|개|팩|박스|병|세트|봉)|가정용|못난이|\([^)]{0,40}\))){0,6}\s*/i
  let after = s.replace(headerRe, "").trim()
  if (after.length >= 8) s = after

  const pn = String(productName || "")
    .replace(/\s+/g, " ")
    .trim()
  if (pn) {
    const variants = [pn, pn.replace(/^\[[^\]]+\]\s*/, "").trim()].filter((v) => v.length >= 6)
    for (const v of variants) {
      const idx = s.indexOf(v)
      if (idx >= 0 && idx < 120) {
        after = s
          .slice(idx + v.length)
          .replace(/^[,\s]+/, "")
          .replace(
            /^(?:,?\s*(?:\d+(?:\.\d+)?\s*(?:kg|g|ml|l|입|개|팩|박스|병|세트|봉)|가정용|못난이|특가|\([^)]{0,40}\)))+/i,
            ""
          )
          .trim()
        if (after.length >= 8) {
          s = after
          break
        }
      }
    }
  }

  s = s
    .replace(
      /^(?:[가-힣*]{2,8}\s+)?[가-힣A-Za-z0-9&·]{2,30}\s*\[[^\]]+\][\s\S]*?(?:\d+(?:\.\d+)?\s*kg)(?:\s*,\s*[가-힣0-9()[\]\s,/]{0,80}?\d+\s*kg)?/i,
      ""
    )
    .replace(
      /^(?:,?\s*(?:\d+(?:\.\d+)?\s*(?:kg|g|ml|l|입|개|팩|박스|병|세트|봉)|가정용|못난이|특가|\([^)]{0,40}\)))+/i,
      ""
    )
    .trim()
  return s
}

export function normalizeCoupangReviews(
  reviews: CoupangReviewRaw[] | undefined,
  productName?: string,
  options?: { maxImagesPerReview?: number | null }
): Array<{ content: string; page?: number; indexOnPage?: number; images?: string[] }> {
  if (!Array.isArray(reviews)) return []
  const maxImagesPerReview =
    options?.maxImagesPerReview === undefined
      ? 8
      : options.maxImagesPerReview
  return reviews
    .map((r, i) => {
      const content = stripCoupangReviewMetaPrefix(
        String(r.content || "")
          .replace(/\s+/g, " ")
          .trim(),
        productName
      ).slice(0, 1500)
      const meta = resolveReviewPageMeta(r, i)
      const uniqueImages = Array.isArray(r.images)
        ? Array.from(
            new Set(
              r.images.filter(
                (u): u is string => typeof u === "string" && /^https?:\/\//i.test(u)
              )
            )
          )
        : undefined
      const images =
        uniqueImages && maxImagesPerReview !== null
          ? uniqueImages.slice(0, Math.max(0, maxImagesPerReview))
          : uniqueImages
      return {
        content,
        page: meta.page,
        indexOnPage: meta.indexOnPage,
        images: images?.length ? images : undefined,
      }
    })
    .filter(
      (r) =>
        r.content.length > 0 &&
        !/function\s*\(|localStorage|web-adapter|#region/i.test(r.content)
    )
}
