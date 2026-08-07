import crypto from "node:crypto"
import type { NaverKeywordRank } from "@/lib/shotform-keyword-analysis-types"

type SearchAdItem = {
  relKeyword?: string
  keyword?: string
  monthlyPcQcCnt?: number | string
  monthlyMobileQcCnt?: number | string
  monthlyQcCnt?: number | string
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const REQUEST_INTERVAL_MS = 800
const cache = new Map<string, { expiresAt: number; items: NaverKeywordRank[] }>()
const inFlight = new Map<string, Promise<NaverKeywordRank[]>>()
let requestQueue: Promise<void> = Promise.resolve()
let lastRequestAt = 0

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = requestQueue.then(async () => {
    const remaining = REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt)
    if (remaining > 0) await wait(remaining)
    try {
      return await task()
    } finally {
      lastRequestAt = Date.now()
    }
  })
  requestQueue = run.then(() => undefined, () => undefined)
  return run
}

function parseCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string") return 0
  const lessThan = value.match(/<\s*(\d+)/)
  if (lessThan) return Math.max(0, Number(lessThan[1]) - 1)
  const parsed = Number(value.replace(/[^\d]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

export async function fetchNaverKeywordRanks(query: string, limit = 10): Promise<NaverKeywordRank[]> {
  const accessKey = process.env.NAVER_SEARCHAD_ACCESS_LICENSE?.trim()
  const secretKey = process.env.NAVER_SEARCHAD_SECRET_KEY?.trim()
  const customerId = process.env.NAVER_SEARCHAD_CUSTOMER_ID?.trim()
  if (!accessKey || !secretKey || !customerId) {
    throw new Error(
      "네이버 검색광고 환경변수(NAVER_SEARCHAD_ACCESS_LICENSE, NAVER_SEARCHAD_SECRET_KEY, NAVER_SEARCHAD_CUSTOMER_ID)가 필요합니다."
    )
  }

  const keyword = query.trim()
  if (!keyword) throw new Error("분석할 키워드가 필요합니다.")
  // 네이버 검색광고 hintKeywords는 공백이 포함된 검색어를 허용하지 않습니다.
  const hintKeyword = keyword.replace(/\s+/g, "")
  const cacheKey = hintKeyword.toLocaleLowerCase("ko-KR")
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.items.slice(0, Math.max(1, Math.min(50, limit)))
  }
  const pending = inFlight.get(cacheKey)
  if (pending) {
    const items = await pending
    return items.slice(0, Math.max(1, Math.min(50, limit)))
  }

  const request = enqueue(async () => {
    const method = "GET"
    const uri = "/keywordstool"
    let response: Response | null = null
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (attempt > 0) await wait(1000 * 2 ** (attempt - 1))
      const timestamp = Date.now().toString()
      const signature = crypto
        .createHmac("sha256", secretKey)
        .update(`${timestamp}.${method}.${uri}`)
        .digest("base64")
      const url = `https://api.searchad.naver.com${uri}?hintKeywords=${encodeURIComponent(hintKeyword)}&showDetail=1`
      response = await fetch(url, {
        method,
        headers: {
          "X-Timestamp": timestamp,
          "X-API-KEY": accessKey,
          "X-Customer": customerId,
          "X-Signature": signature,
        },
        cache: "no-store",
      })
      if (response.status !== 429) break
    }
    if (!response?.ok) {
      const message = await response?.text().catch(() => "") || ""
      throw new Error(`네이버 검색광고 조회 실패 (${response?.status || 500}): ${message.slice(0, 200)}`)
    }

    const raw = (await response.json()) as SearchAdItem[] | { keywordList?: SearchAdItem[] }
    const rawItems = Array.isArray(raw) ? raw : raw.keywordList || []
    const deduped = new Map<string, Omit<NaverKeywordRank, "rank">>()
    for (const item of rawItems) {
      const resultKeyword = String(item.relKeyword || item.keyword || "").trim()
      if (!resultKeyword) continue
      const pc = parseCount(item.monthlyPcQcCnt)
      const mobile = parseCount(item.monthlyMobileQcCnt)
      const total = parseCount(item.monthlyQcCnt) || pc + mobile
      const previous = deduped.get(resultKeyword)
      if (!previous || previous.total < total) {
        deduped.set(resultKeyword, { keyword: resultKeyword, pc, mobile, total })
      }
    }
    const items = [...deduped.values()]
      .sort((a, b) => b.total - a.total || a.keyword.localeCompare(b.keyword, "ko"))
      .slice(0, 50)
      .map((item, index) => ({ ...item, rank: index + 1 }))
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, items })
    return items
  })
  inFlight.set(cacheKey, request)
  try {
    const items = await request
    return items.slice(0, Math.max(1, Math.min(50, limit)))
  } finally {
    inFlight.delete(cacheKey)
  }
}
