/**
 * 네이버 검색광고의 월간 검색량과 쇼핑인사이트 클릭 추이를 결합한 자체 쇼핑 순위.
 * 네이버는 카테고리별 인기 검색어 목록을 직접 제공하지 않으므로 공식 순위로 표시하면 안 됩니다.
 * @see https://developers.naver.com/docs/serviceapi/datalab/shopping/shopping.md
 */

import { fetchNaverKeywordRanks } from "@/lib/server/naver-searchad-keywords"
import type {
  ShoppingOfficialTrend,
  ShoppingRankApiResponse,
  ShoppingRankEntry,
  ShoppingRankRecommendation,
} from "@/lib/shotform-shopping-rank-types"

export type NaverDatalabCategory = {
  code: string
  name: string
  seed: string
}

export const NAVER_DATALAB_SHOPPING_CATEGORIES: NaverDatalabCategory[] = [
  { code: "50000000", name: "패션의류", seed: "여성의류" },
  { code: "50000001", name: "패션잡화", seed: "가방" },
  { code: "50000002", name: "화장품/미용", seed: "화장품" },
  { code: "50000003", name: "디지털/가전", seed: "가전제품" },
  { code: "50000004", name: "가구/인테리어", seed: "인테리어" },
  { code: "50000005", name: "출산/육아", seed: "유아용품" },
  { code: "50000006", name: "식품", seed: "식품" },
  { code: "50000007", name: "스포츠/레저", seed: "운동용품" },
  { code: "50000008", name: "생활/건강", seed: "생활용품" },
  { code: "50000009", name: "여가/생활편의", seed: "여행" },
]

type TrendPoint = { period: string; ratio: number }
type KeywordTrendRow = {
  title: string
  keyword?: string[]
  data: TrendPoint[]
}
type CategoryTrendRow = {
  title: string
  category?: string[]
  data: TrendPoint[]
}

const cache = new Map<string, { expiresAt: number; value: ShoppingRankApiResponse }>()
let categoryHighlightsCache: {
  expiresAt: number
  value: Awaited<ReturnType<typeof fetchCategoryHighlights>>
} | null = null
let categoryHighlightsRequest: Promise<Awaited<ReturnType<typeof fetchCategoryHighlights>>> | null = null

function credentials() {
  const clientId =
    process.env.NAVER_DATALAB_CLIENT_ID?.trim() || process.env.NAVER_CLIENT_ID?.trim()
  const clientSecret =
    process.env.NAVER_DATALAB_CLIENT_SECRET?.trim() || process.env.NAVER_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) {
    throw new Error("네이버 DataLab Client ID와 Client Secret이 필요합니다.")
  }
  return { clientId, clientSecret }
}

function formatYmd(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function dateRange() {
  const end = new Date()
  end.setDate(end.getDate() - 1)
  const start = new Date(end)
  start.setDate(start.getDate() - 13)
  return { startDate: formatYmd(start), endDate: formatYmd(end) }
}

async function postDataLab<T>(path: string, body: Record<string, unknown>): Promise<T[]> {
  const { clientId, clientSecret } = credentials()
  const response = await fetch(`https://openapi.naver.com${path}`, {
    method: "POST",
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  })
  if (!response.ok) {
    const message = await response.text().catch(() => "")
    throw new Error(`네이버 쇼핑인사이트 조회 실패 (${response.status}): ${message.slice(0, 200)}`)
  }
  const json = (await response.json()) as { results?: T[] }
  return json.results || []
}

async function fetchKeywordTrends(
  category: NaverDatalabCategory,
  keywords: string[],
  startDate: string,
  endDate: string
): Promise<KeywordTrendRow[]> {
  const batches: string[][] = []
  for (let index = 0; index < keywords.length; index += 5) {
    batches.push(keywords.slice(index, index + 5))
  }
  const results = await Promise.all(
    batches.map((batch) =>
      postDataLab<KeywordTrendRow>("/v1/datalab/shopping/category/keywords", {
        startDate,
        endDate,
        timeUnit: "date",
        category: category.code,
        keyword: batch.map((keyword) => ({ name: keyword, param: [keyword] })),
        device: "",
        gender: "",
        ages: [],
      })
    )
  )
  return results.flat()
}

async function fetchCategoryHighlights(
  startDate: string,
  endDate: string,
  collectedAt: string
): Promise<{
  trends: ShoppingOfficialTrend[]
  recommendations: ShoppingRankRecommendation[]
}> {
  const batches: NaverDatalabCategory[][] = []
  for (let index = 0; index < NAVER_DATALAB_SHOPPING_CATEGORIES.length; index += 3) {
    batches.push(NAVER_DATALAB_SHOPPING_CATEGORIES.slice(index, index + 3))
  }
  const rows = (
    await Promise.all(
      batches.map((batch) =>
        postDataLab<CategoryTrendRow>("/v1/datalab/shopping/categories", {
          startDate,
          endDate,
          timeUnit: "date",
          category: batch.map((category) => ({
            name: category.name,
            param: [category.code],
          })),
          device: "",
          gender: "",
          ages: [],
        })
      )
    )
  ).flat()

  const trends: ShoppingOfficialTrend[] = []
  const recommendations: ShoppingRankRecommendation[] = []
  for (const row of rows) {
    const category = NAVER_DATALAB_SHOPPING_CATEGORIES.find((item) => item.name === row.title)
    if (!category || !row.data?.length) continue
    for (const point of row.data) {
      trends.push({
        id: `${category.code}:${point.period}`,
        category_name: category.name,
        category_code: category.code,
        target_date: point.period,
        ratio: Number(point.ratio) || 0,
        source: "naver_datalab",
        collected_at: collectedAt,
      })
    }
    const latest = Number(row.data.at(-1)?.ratio) || 0
    const previous = row.data.slice(-8, -1)
    const average = previous.length
      ? previous.reduce((sum, point) => sum + (Number(point.ratio) || 0), 0) / previous.length
      : latest
    const change = average > 0 ? ((latest - average) / average) * 100 : 0
    recommendations.push({
      category_name: category.name,
      category_code: category.code,
      latest_ratio: Math.round(latest * 10) / 10,
      change_ratio: Math.round(change * 10) / 10,
      streak_days: row.data.slice(-3).filter((point, index, list) =>
        index === 0 || point.ratio >= list[index - 1]!.ratio
      ).length,
      score: Math.round((Math.max(0, change) + latest / 10) * 10) / 10,
      reason: change > 0 ? `최근 7일 평균 대비 ${change.toFixed(1)}% 상승` : "최근 쇼핑 클릭 관심도 상위",
    })
  }
  return { trends, recommendations }
}

async function getCategoryHighlights(startDate: string, endDate: string, collectedAt: string) {
  if (categoryHighlightsCache && categoryHighlightsCache.expiresAt > Date.now()) {
    return categoryHighlightsCache.value
  }
  if (!categoryHighlightsRequest) {
    categoryHighlightsRequest = fetchCategoryHighlights(startDate, endDate, collectedAt)
      .then((value) => {
        categoryHighlightsCache = { expiresAt: Date.now() + 15 * 60 * 1000, value }
        return value
      })
      .finally(() => {
        categoryHighlightsRequest = null
      })
  }
  return categoryHighlightsRequest
}

function makeRankings(
  category: NaverDatalabCategory,
  candidates: Awaited<ReturnType<typeof fetchNaverKeywordRanks>>,
  rows: KeywordTrendRow[],
  collectedAt: string
): { rankings: ShoppingRankEntry[]; rising: ShoppingRankRecommendation[]; steady: ShoppingRankRecommendation[] } {
  const trendsByKeyword = new Map(rows.map((row) => [row.title, row.data || []]))
  const dates = [...new Set(rows.flatMap((row) => row.data?.map((point) => point.period) || []))]
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 3)
  const rankings: ShoppingRankEntry[] = []
  const rankByDate = new Map<string, Map<string, number>>()

  for (const date of [...dates].reverse()) {
    const scored = candidates.map((candidate) => {
      const trend = trendsByKeyword.get(candidate.keyword) || []
      const point = trend.find((item) => item.period === date)
      const baseline = trend.length
        ? trend.reduce((sum, item) => sum + (Number(item.ratio) || 0), 0) / trend.length
        : 0
      const ratio = Number(point?.ratio) || 0
      const momentum = baseline > 0 ? Math.min(2, ratio / baseline) : 1
      const score = Math.log10(candidate.total + 10) * 100 * (0.75 + momentum * 0.25)
      return { candidate, ratio, score }
    })
    scored.sort((a, b) => b.score - a.score || b.candidate.total - a.candidate.total)
    const previousRanks = rankByDate.get([...rankByDate.keys()].at(-1) || "")
    const currentRanks = new Map<string, number>()
    scored.slice(0, 10).forEach((item, index) => {
      const rank = index + 1
      currentRanks.set(item.candidate.keyword, rank)
      rankings.push({
        id: `${category.code}:${date}:${item.candidate.keyword}`,
        category_name: category.name,
        category_code: category.code,
        target_date: date,
        rank_order: rank,
        keyword: item.candidate.keyword,
        time_unit: "date",
        collected_at: collectedAt,
        monthly_searches: item.candidate.total,
        ratio: Math.round(item.ratio * 10) / 10,
        score: Math.round(item.score * 10) / 10,
        rank_change: previousRanks ? (previousRanks.get(item.candidate.keyword) || rank) - rank : 0,
      })
    })
    rankByDate.set(date, currentRanks)
  }

  rankings.sort((a, b) => b.target_date.localeCompare(a.target_date) || a.rank_order - b.rank_order)
  const latest = rankings.filter((item) => item.target_date === dates[0])
  const recommendation = (item: ShoppingRankEntry, reason: string): ShoppingRankRecommendation => ({
    category_name: category.name,
    category_code: category.code,
    keyword: item.keyword,
    latest_ratio: item.ratio || 0,
    change_ratio: item.rank_change || 0,
    streak_days: 0,
    score: item.score || 0,
    reason,
  })
  const rising = latest
    .filter((item) => (item.rank_change || 0) > 0)
    .sort((a, b) => (b.rank_change || 0) - (a.rank_change || 0))
    .map((item) => recommendation(item, `전일 대비 ${item.rank_change}계단 상승`))
  const steady = latest
    .filter((item) => item.rank_order <= 5 && Math.abs(item.rank_change || 0) <= 1)
    .map((item) => recommendation(item, `상위 ${item.rank_order}위권을 꾸준히 유지`))
  return { rankings, rising, steady }
}

export async function fetchNaverShoppingRankSnapshot(
  categoryCode = NAVER_DATALAB_SHOPPING_CATEGORIES[0]!.code
): Promise<ShoppingRankApiResponse> {
  const category =
    NAVER_DATALAB_SHOPPING_CATEGORIES.find((item) => item.code === categoryCode) ||
    NAVER_DATALAB_SHOPPING_CATEGORIES[0]!
  const cached = cache.get(category.code)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const { startDate, endDate } = dateRange()
  const collectedAt = new Date().toISOString()
  const candidates = await fetchNaverKeywordRanks(category.seed, 10)
  const [keywordRows, categoryHighlights] = await Promise.all([
    fetchKeywordTrends(category, candidates.map((item) => item.keyword), startDate, endDate),
    getCategoryHighlights(startDate, endDate, collectedAt),
  ])
  const ranked = makeRankings(category, candidates, keywordRows, collectedAt)
  const today = [...categoryHighlights.recommendations]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
  const value: ShoppingRankApiResponse = {
    rankings: ranked.rankings,
    officialTrends: categoryHighlights.trends,
    recommendations: {
      today,
      rising: ranked.rising.slice(0, 5),
      steady: ranked.steady.slice(0, 5),
    },
    categories: NAVER_DATALAB_SHOPPING_CATEGORIES.map(({ code, name }) => ({ code, name })),
    latestAvailableDate: ranked.rankings[0]?.target_date || endDate,
    methodology: "네이버 검색광고 월간 검색량과 쇼핑인사이트 클릭 추이를 결합한 자체 산출 순위",
  }
  cache.set(category.code, { expiresAt: Date.now() + 15 * 60 * 1000, value })
  return value
}

export async function fetchNaverTrendingKeywordsForCategory(categoryName = "쇼핑"): Promise<string[]> {
  const category =
    NAVER_DATALAB_SHOPPING_CATEGORIES.find((item) => item.name.includes(categoryName)) ||
    NAVER_DATALAB_SHOPPING_CATEGORIES[0]!
  const snapshot = await fetchNaverShoppingRankSnapshot(category.code)
  const latestDate = snapshot.latestAvailableDate
  return snapshot.rankings
    .filter((item) => item.target_date === latestDate)
    .sort((a, b) => a.rank_order - b.rank_order)
    .map((item) => item.keyword)
    .slice(0, 10)
}
