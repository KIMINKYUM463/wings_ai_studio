import crypto from "node:crypto"
import type { CoupangRankedProduct } from "@/lib/shotform-keyword-analysis-types"

const COUPANG_API_ORIGIN = "https://api-gateway.coupang.com"

function signedDate(now = new Date()): string {
  return now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
    .slice(2)
}

function credentials() {
  const accessKey = process.env.COUPANG_PARTNERS_ACCESS_KEY?.trim()
  const secretKey = process.env.COUPANG_PARTNERS_SECRET_KEY?.trim()
  if (!accessKey || !secretKey) {
    throw new Error(
      "쿠팡 파트너스 환경변수(COUPANG_PARTNERS_ACCESS_KEY, COUPANG_PARTNERS_SECRET_KEY)가 필요합니다."
    )
  }
  return { accessKey, secretKey }
}

async function coupangRequest(path: string, params: URLSearchParams) {
  const { accessKey, secretKey } = credentials()
  const method = "GET"
  const datetime = signedDate()
  const query = params.toString()
  const message = `${datetime}${method}${path}${query}`
  const signature = crypto.createHmac("sha256", secretKey).update(message).digest("hex")
  const authorization = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`
  const response = await fetch(`${COUPANG_API_ORIGIN}${path}${query ? `?${query}` : ""}`, {
    headers: { Authorization: authorization },
    cache: "no-store",
  })
  if (!response.ok) {
    const text = await response.text().catch(() => "")
    throw new Error(`쿠팡 파트너스 조회 실패 (${response.status}): ${text.slice(0, 240)}`)
  }
  return response.json()
}

function normalizeProducts(raw: unknown, limit: number): CoupangRankedProduct[] {
  const payload = raw as {
    data?: unknown[] | { productData?: unknown[] }
    productData?: unknown[]
  }
  const rows = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.data && (payload.data as { productData?: unknown[] }).productData)
      ? (payload.data as { productData: unknown[] }).productData
      : Array.isArray(payload?.productData)
        ? payload.productData
        : []

  return rows.slice(0, limit).map((value, index) => {
    const item = value as Record<string, unknown>
    return {
      rank: index + 1,
      productId: String(item.productId || item.product_id || index + 1),
      productName: String(item.productName || item.product_name || "상품"),
      productPrice: Number(item.productPrice || item.product_price || item.salePrice || 0),
      productImage: String(item.productImage || item.product_image || item.imageUrl || ""),
      productUrl: String(item.productUrl || item.product_url || item.landingUrl || ""),
      categoryName: item.categoryName ? String(item.categoryName) : undefined,
      isRocket: Boolean(item.isRocket || item.isRocketWow || item.rocket),
    }
  })
}

export async function fetchCoupangRankedProducts(options: {
  mode: "search" | "goldbox" | "best"
  query?: string
  categoryId?: string
  limit?: number
}): Promise<CoupangRankedProduct[]> {
  const limit = Math.max(1, Math.min(20, options.limit || 10))
  const subId = process.env.COUPANG_PARTNERS_SUB_ID?.trim()
  let path: string
  const params = new URLSearchParams()

  if (options.mode === "goldbox") {
    path = "/v2/providers/affiliate_open_api/apis/openapi/products/goldbox"
  } else if (options.mode === "best") {
    path = `/v2/providers/affiliate_open_api/apis/openapi/products/bestcategories/${encodeURIComponent(
      options.categoryId || "1001"
    )}`
    params.set("limit", String(limit))
  } else {
    const query = options.query?.trim()
    if (!query) throw new Error("쿠팡에서 검색할 키워드가 필요합니다.")
    path = "/v2/providers/affiliate_open_api/apis/openapi/products/search"
    params.set("keyword", query)
    params.set("limit", String(limit))
  }
  if (subId) params.set("subId", subId)

  return normalizeProducts(await coupangRequest(path, params), limit)
}
