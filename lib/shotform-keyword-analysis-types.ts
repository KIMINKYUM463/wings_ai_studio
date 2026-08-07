export type NaverKeywordRank = {
  rank: number
  keyword: string
  pc: number
  mobile: number
  total: number
}

export type CoupangRankedProduct = {
  rank: number
  productId: string
  productName: string
  productPrice: number
  productImage: string
  productUrl: string
  categoryName?: string
  isRocket?: boolean
}

export type KeywordAnalysisSnapshot = {
  query: string
  selectedKeyword?: string
  naverKeywords: NaverKeywordRank[]
  coupangProducts: CoupangRankedProduct[]
  coupangMode: "search" | "goldbox" | "best"
  collectedAt: string
}

export type SelectedKeywordProduct = {
  productId: string
  productName: string
  productPrice: number
  productImage: string
  productUrl: string
}
