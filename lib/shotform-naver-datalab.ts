/**
 * 네이버 데이터랩 — 쇼핑 카테고리별 인기 검색어
 * @see https://developers.naver.com/docs/serviceapi/datalab/shopping/shopping.md
 */

import type {
  ShoppingRankApiResponse,
  ShoppingRankEntry,
  ShoppingRankRecommendation,
} from "@/lib/shotform-shopping-rank-types"

export type NaverDatalabCategory = {
  code: string
  name: string
}

/** 네이버 쇼핑인사이트 대분류 */
export const NAVER_DATALAB_SHOPPING_CATEGORIES: NaverDatalabCategory[] = [
  { code: "50000000", name: "패션의류" },
  { code: "50000001", name: "패션잡화" },
  { code: "50000002", name: "화장품/미용" },
  { code: "50000003", name: "디지털/가전" },
  { code: "50000004", name: "가구/인테리어" },
  { code: "50000005", name: "출산/육아" },
  { code: "50000006", name: "식품" },
  { code: "50000007", name: "스포츠/레저" },
  { code: "50000008", name: "생활/건강" },
  { code: "50000009", name: "여가/생활편의" },
]

type DatalabKeywordRow = {
  keyword?: string
  title?: string
  data?: Array<{ period?: string; ratio?: number }>
}

function naverClientCredentials(): { clientId: string; clientSecret: string } {
  const clientId =
    process.env.NAVER_DATALAB_CLIENT_ID?.trim() ||
    process.env.NAVER_CLIENT_ID?.trim() ||
    ""
  const clientSecret =
    process.env.NAVER_DATALAB_CLIENT_SECRET?.trim() ||
    process.env.NAVER_CLIENT_SECRET?.trim() ||
    ""
  if (!clientId || !clientSecret) {
    throw new Error(
      "네이버 API 키가 없습니다. .env.local에 NAVER_CLIENT_ID, NAVER_CLIENT_SECRET을 설정해 주세요."
    )
  }
  return { clientId, clientSecret }
}

function formatYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function keywordLabel(row: DatalabKeywordRow): string {
  return (row.keyword || row.title || "").trim()
}

async function fetchCategoryKeywordTrends(
  category: NaverDatalabCategory,
  startDate: string,
  endDate: string
): Promise<DatalabKeywordRow[]> {
  const { clientId, clientSecret } = naverClientCredentials()

  const res = await fetch("https://openapi.naver.com/v1/datalab/shopping/category/keywords", {
    method: "POST",
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startDate,
      endDate,
      timeUnit: "date",
      category: category.code,
      device: "",
      gender: "",
      ages: [],
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    throw new Error(
      `[${category.name}] 데이터랩 오류 ${res.status}: ${errText.slice(0, 200) || res.statusText}`
    )
  }

  const json = (await res.json()) as { results?: DatalabKeywordRow[] }
  return json.results ?? []
}

function buildRankingsFromTrends(
  category: NaverDatalabCategory,
  rows: DatalabKeywordRow[],
  collectedAt: string,
  maxDays = 3,
  topN = 10
): ShoppingRankEntry[] {
  const byDate = new Map<string, Array<{ keyword: string; ratio: number }>>()

  for (const row of rows) {
    const kw = keywordLabel(row)
    if (!kw || !row.data?.length) continue
    for (const point of row.data) {
      const date = point.period?.trim()
      if (!date) continue
      const ratio = Number(point.ratio) || 0
      const list = byDate.get(date) ?? []
      list.push({ keyword: kw, ratio })
      byDate.set(date, list)
    }
  }

  const dates = [...byDate.keys()].sort((a, b) => b.localeCompare(a)).slice(0, maxDays)
  const out: ShoppingRankEntry[] = []

  for (const date of dates) {
    const sorted = (byDate.get(date) ?? [])
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, topN)

    sorted.forEach((item, idx) => {
      out.push({
        id: `${category.code}:${date}:${idx + 1}:${item.keyword}`,
        category_name: category.name,
        category_code: category.code,
        target_date: date,
        rank_order: idx + 1,
        keyword: item.keyword,
        time_unit: "date",
        collected_at: collectedAt,
      })
    })
  }

  return out
}

function buildRecommendations(
  category: NaverDatalabCategory,
  rows: DatalabKeywordRow[]
): ShoppingRankRecommendation[] {
  const recs: ShoppingRankRecommendation[] = []

  for (const row of rows) {
    const kw = keywordLabel(row)
    const data = row.data ?? []
    if (!kw || data.length < 2) continue

    const recent = data.slice(-3)
    const earlier = data.slice(0, Math.max(0, data.length - 3))
    const recentAvg = recent.reduce((s, d) => s + (Number(d.ratio) || 0), 0) / recent.length
    const earlierAvg =
      earlier.length > 0
        ? earlier.reduce((s, d) => s + (Number(d.ratio) || 0), 0) / earlier.length
        : recentAvg
    const change = recentAvg - earlierAvg
    const streak = recent.filter((d) => (Number(d.ratio) || 0) > 50).length

    recs.push({
      category_name: category.name,
      category_code: category.code,
      latest_ratio: Math.round(recentAvg * 10) / 10,
      change_ratio: Math.round(change * 10) / 10,
      streak_days: streak,
      score: Math.round((recentAvg + Math.max(0, change) * 2) * 10) / 10,
    })
  }

  recs.sort((a, b) => b.score - a.score)
  return recs.slice(0, 15)
}

/** 카테고리별 최근 인기 쇼핑 검색어 → 실시간 쇼핑순위 UI 형식 */
export async function fetchNaverShoppingRankSnapshot(): Promise<ShoppingRankApiResponse> {
  const end = new Date()
  end.setDate(end.getDate() - 1)
  const start = new Date(end)
  start.setDate(start.getDate() - 6)

  const startDate = formatYmd(start)
  const endDate = formatYmd(end)
  const collectedAt = new Date().toISOString()

  const results = await Promise.all(
    NAVER_DATALAB_SHOPPING_CATEGORIES.map(async (cat) => {
      try {
        const rows = await fetchCategoryKeywordTrends(cat, startDate, endDate)
        return { cat, rows, error: null as string | null }
      } catch (e) {
        return {
          cat,
          rows: [] as DatalabKeywordRow[],
          error: e instanceof Error ? e.message : "조회 실패",
        }
      }
    })
  )

  const errors = results.filter((r) => r.error).map((r) => r.error!)
  if (errors.length === results.length) {
    throw new Error(errors[0] || "데이터랩 조회 실패")
  }

  const rankings: ShoppingRankEntry[] = []
  const rising: ShoppingRankRecommendation[] = []
  const today: ShoppingRankRecommendation[] = []
  const steady: ShoppingRankRecommendation[] = []

  for (const { cat, rows } of results) {
    if (!rows.length) continue
    rankings.push(...buildRankingsFromTrends(cat, rows, collectedAt))
    const recs = buildRecommendations(cat, rows)
    for (const r of recs) {
      if (r.change_ratio >= 5) rising.push(r)
      else if (r.change_ratio <= -5) steady.push(r)
      else today.push(r)
    }
  }

  rising.sort((a, b) => b.score - a.score)
  today.sort((a, b) => b.score - a.score)
  steady.sort((a, b) => b.latest_ratio - a.latest_ratio)

  return {
    rankings,
    officialTrends: [],
    recommendations: {
      today: today.slice(0, 20),
      rising: rising.slice(0, 20),
      steady: steady.slice(0, 20),
    },
  }
}

/** 단일 카테고리 인기 키워드 (쇼핑숏폼 actions 호환) */
export async function fetchNaverTrendingKeywordsForCategory(
  categoryName = "쇼핑"
): Promise<string[]> {
  const cat =
    NAVER_DATALAB_SHOPPING_CATEGORIES.find((c) => c.name.includes(categoryName)) ??
    NAVER_DATALAB_SHOPPING_CATEGORIES[0]!

  const end = new Date()
  end.setDate(end.getDate() - 1)
  const start = new Date(end)
  start.setDate(start.getDate() - 6)

  const rows = await fetchCategoryKeywordTrends(cat, formatYmd(start), formatYmd(end))
  const collectedAt = new Date().toISOString()
  const ranked = buildRankingsFromTrends(cat, rows, collectedAt, 1, 10)
  const keywords = ranked.map((r) => r.keyword).filter(Boolean)
  if (keywords.length) return keywords

  return rows
    .map((r) => keywordLabel(r))
    .filter(Boolean)
    .slice(0, 10)
}
