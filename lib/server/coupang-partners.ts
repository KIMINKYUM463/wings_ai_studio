import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import type { CoupangRankedProduct } from "@/lib/shotform-keyword-analysis-types"

const COUPANG_API_ORIGIN = "https://api-gateway.coupang.com"
const COOLDOWN_FILE = path.join(os.tmpdir(), "shotform-coupang-partners-cooldown.json")
const SUCCESS_TTL_MS = {
  best: 30 * 60 * 1000,
  goldbox: 30 * 60 * 1000,
  search: 10 * 60 * 1000,
} as const

type RankMode = keyof typeof SUCCESS_TTL_MS
type CacheEntry = { expiresAt: number; products: CoupangRankedProduct[] }

const productCache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<CoupangRankedProduct[]>>()
let cooldownUntil = 0
let cooldownMessage = ""
let cooldownLoaded = false

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

function loadCooldown() {
  if (cooldownLoaded) return
  cooldownLoaded = true
  try {
    const parsed = JSON.parse(fs.readFileSync(COOLDOWN_FILE, "utf8")) as {
      until?: number
      message?: string
    }
    if (typeof parsed.until === "number" && parsed.until > Date.now()) {
      cooldownUntil = parsed.until
      cooldownMessage = parsed.message || ""
    }
  } catch {
    // 쿨다운 파일이 없으면 호출 가능한 상태다.
  }
}

function rememberCooldown(until: number, message: string) {
  cooldownUntil = Math.max(cooldownUntil, until)
  cooldownMessage = message
  try {
    fs.writeFileSync(COOLDOWN_FILE, JSON.stringify({ until: cooldownUntil, message }))
  } catch {
    // 디스크 저장이 실패해도 프로세스 메모리는 유지한다.
  }
}

function parseRetryAt(message: string): number | null {
  const match = message.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?/)
  if (!match) return null
  const fraction = (match[2] || "000").slice(0, 3).padEnd(3, "0")
  const parsed = Date.parse(`${match[1]}.${fraction}+09:00`)
  return Number.isFinite(parsed) ? parsed : null
}

function formatRetryAt(retryAt: number) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(retryAt))
}

function rateLimitMessage(rawMessage: string, retryAt: number | null) {
  if (!retryAt) {
    return "쿠팡 파트너스 호출 한도를 넘겼습니다. 잠시 후 다시 시도해 주세요."
  }
  return `쿠팡 파트너스 호출 한도를 넘겼습니다. ${formatRetryAt(retryAt)} 이후에 다시 시도해 주세요. 그 전에 새로고침하면 계정이 추가 제한될 수 있습니다.`
}

function isRateLimited(code: string, message: string) {
  return code === "403" || /사용 횟수|호출 한도|초과/.test(message)
}

function assertCoupangOk(payload: unknown) {
  const body = payload as { rCode?: string | number; rMessage?: string }
  const code = body?.rCode
  if (code === undefined || code === null || String(code) === "0") return

  const rawMessage = String(body.rMessage || "쿠팡 파트너스 조회에 실패했습니다.")
  if (isRateLimited(String(code), rawMessage)) {
    const retryAt = parseRetryAt(rawMessage)
    const message = rateLimitMessage(rawMessage, retryAt)
    rememberCooldown(retryAt && retryAt > Date.now() ? retryAt : Date.now() + 60_000, message)
    throw new Error(message)
  }
  throw new Error(rawMessage)
}

async function coupangRequest(pathName: string, params: URLSearchParams) {
  const { accessKey, secretKey } = credentials()
  const method = "GET"
  const datetime = signedDate()
  const query = params.toString()
  const message = `${datetime}${method}${pathName}${query}`
  const signature = crypto.createHmac("sha256", secretKey).update(message).digest("hex")
  const authorization = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`
  const response = await fetch(`${COUPANG_API_ORIGIN}${pathName}${query ? `?${query}` : ""}`, {
    headers: { Authorization: authorization },
    cache: "no-store",
  })
  if (!response.ok) {
    const text = await response.text().catch(() => "")
    throw new Error(`쿠팡 파트너스 조회 실패 (${response.status}): ${text.slice(0, 240)}`)
  }
  const payload = await response.json()
  assertCoupangOk(payload)
  return payload
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

async function requestProducts(options: {
  mode: RankMode
  query?: string
  categoryId?: string
  limit: number
}): Promise<CoupangRankedProduct[]> {
  const subId = process.env.COUPANG_PARTNERS_SUB_ID?.trim()
  let pathName: string
  const params = new URLSearchParams()

  if (options.mode === "goldbox") {
    pathName = "/v2/providers/affiliate_open_api/apis/openapi/products/goldbox"
  } else if (options.mode === "best") {
    pathName = `/v2/providers/affiliate_open_api/apis/openapi/products/bestcategories/${encodeURIComponent(
      options.categoryId || "1001"
    )}`
    params.set("limit", String(options.limit))
  } else {
    const query = options.query?.trim()
    if (!query) throw new Error("쿠팡에서 검색할 키워드가 필요합니다.")
    pathName = "/v2/providers/affiliate_open_api/apis/openapi/products/search"
    params.set("keyword", query)
    params.set("limit", String(options.limit))
  }
  if (subId) params.set("subId", subId)

  return normalizeProducts(await coupangRequest(pathName, params), options.limit)
}

export async function fetchCoupangRankedProducts(options: {
  mode: RankMode
  query?: string
  categoryId?: string
  limit?: number
}): Promise<CoupangRankedProduct[]> {
  const limit = Math.max(1, Math.min(20, options.limit || 10))
  const cacheKey = `${options.mode}:${options.categoryId || ""}:${options.query?.trim() || ""}:${limit}`
  const cached = productCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.products

  loadCooldown()
  if (cooldownUntil > Date.now()) {
    if (cached?.products.length) return cached.products
    throw new Error(
      cooldownMessage || "쿠팡 파트너스 호출 한도를 넘겼습니다. 잠시 후 다시 시도해 주세요."
    )
  }

  const pending = inflight.get(cacheKey)
  if (pending) return pending

  const request = (async () => {
    try {
      const products = await requestProducts({ ...options, limit })
      productCache.set(cacheKey, { expiresAt: Date.now() + SUCCESS_TTL_MS[options.mode], products })
      return products
    } catch (error) {
      if (cached?.products.length) return cached.products
      throw error
    } finally {
      inflight.delete(cacheKey)
    }
  })()

  inflight.set(cacheKey, request)
  return request
}
