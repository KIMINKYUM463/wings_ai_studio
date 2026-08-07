export type InfoSlideType =
  | "cover"
  | "pain"
  | "tip"
  | "review"
  | "product"
  | "cta"

export type InfoThemeId =
  | "gray"
  | "blue"
  | "news"
  | "mint"
  | "coral"
  | "cream"
  | "charcoal"
  | "rose"
  | "lime"

export type InfoSourceType = "youtube" | "web"

export type InfoSourceMeta = {
  url: string
  sourceType: InfoSourceType
  title: string
  description: string
  thumbnailUrl?: string
  videoId?: string
  transcript?: string
}

export type InfoProductAnalysis = {
  productName: string
  searchKeyword: string
  productDescription: string
  confidence: number
  evidence: string[]
  analysisSummary: string
  tipAngle?: string
}

export type InfoCoupangProduct = {
  rank: number
  productId: string
  productName: string
  productPrice: number
  productImage: string
  productUrl: string
  categoryName: string
  isRocket: boolean
}

export type InfoCardLine = {
  text: string
  /** 핑크 강조할 부분 문자열 */
  highlights?: string[]
}

export type InfoSlide = {
  id: string
  order: number
  type: InfoSlideType
  badge?: string
  hook?: string
  title: string
  lines: InfoCardLine[]
  narration: string
  durationSec: number
  imageUrl?: string
  imagePrompt?: string
  /** product=구제품컷(레거시), stock=Pixabay 무료 이미지 */
  imageSource?: "product" | "stock" | "ai" | "upload"
}

export type InfoGeneratedCards = {
  themeId: InfoThemeId
  targetDurationSec: number
  hook: string
  title: string
  slides: InfoSlide[]
  generatedAt: string
}

export type InfoVoiceTrack = {
  slideId: string
  audioUrl: string
  lineTracks?: Array<{
    lineIndex: number
    text: string
    audioUrl: string
  }>
}

export type InfoVoiceData = {
  voiceId: string
  provider?: "supertone" | "supertonic" | "typecast" | "elevenlabs"
  style?: string
  speed: number
  tracks: InfoVoiceTrack[]
  generatedAt: string
}

export type InfoShoppingBrief = {
  sourceUrl: string
  channelHandle: string
  themeId: InfoThemeId
  useAiImages: boolean
  targetDurationSec: number
  sourceMeta?: InfoSourceMeta
  analysis?: InfoProductAnalysis
  searchQuery: string
  products: InfoCoupangProduct[]
  selectedProduct?: InfoCoupangProduct
  generatedCards?: InfoGeneratedCards
  voiceData?: InfoVoiceData
}

export const EMPTY_INFO_BRIEF: InfoShoppingBrief = {
  sourceUrl: "",
  channelHandle: "",
  themeId: "news",
  useAiImages: true,
  targetDurationSec: 30,
  searchQuery: "",
  products: [],
}

export const INFO_THEMES: Array<{
  id: InfoThemeId
  label: string
  swatch: string
}> = [
  { id: "news", label: "스퀘어 뉴스 (추천)", swatch: "#facc15" },
  { id: "coral", label: "코랄 임팩트", swatch: "#fb7185" },
  { id: "mint", label: "민트 클린", swatch: "#5eead4" },
  { id: "blue", label: "블루 정보", swatch: "#3b82f6" },
  { id: "charcoal", label: "차콜 프리미엄", swatch: "#3f3f46" },
  { id: "rose", label: "로즈 감성", swatch: "#f9a8d4" },
  { id: "lime", label: "라임 포인트", swatch: "#a3e635" },
  { id: "cream", label: "크림 소프트", swatch: "#f5e6c8" },
  { id: "gray", label: "라이트 그레이", swatch: "#e5e7eb" },
]

export const INFO_SLIDE_LABELS: Record<InfoSlideType, string> = {
  cover: "훅·문제",
  pain: "문제제기",
  tip: "해결",
  review: "효과·후기",
  product: "제품",
  cta: "CTA",
}
