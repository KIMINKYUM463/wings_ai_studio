export type ShoppingRankEntry = {
  id: string
  category_name: string
  category_code: string
  target_date: string
  rank_order: number
  keyword: string
  time_unit: string
  collected_at: string
  monthly_searches?: number
  ratio?: number
  score?: number
  rank_change?: number
}

export type ShoppingOfficialTrend = {
  id: string
  category_name: string
  category_code: string
  target_date: string
  ratio: number
  source: string
  collected_at: string
}

export type ShoppingRankRecommendation = {
  category_name: string
  category_code: string
  latest_ratio: number
  change_ratio: number
  streak_days: number
  score: number
  keyword?: string
  reason?: string
}

export type ShoppingRankApiResponse = {
  rankings: ShoppingRankEntry[]
  officialTrends: ShoppingOfficialTrend[]
  recommendations: {
    today: ShoppingRankRecommendation[]
    rising: ShoppingRankRecommendation[]
    steady: ShoppingRankRecommendation[]
  }
  isAdmin?: boolean
  error?: string
  categories?: ShoppingRankCategory[]
  latestAvailableDate?: string
  methodology?: string
}

export type ShoppingRankCategory = {
  name: string
  code: string
}
