import type { MvpThumbnailVariant } from "@/lib/mvp-studio-types"

export type StoryTone =
  | "reversal"
  | "confession"
  | "curiosity"
  | "warning"
  | "heartwarming"

export type StoryBeat = "hook" | "setup" | "conflict" | "product" | "proof" | "cta"

export interface StoryReferenceVideo {
  id: string
  title: string
  description: string
  channelTitle: string
  publishedAt: string
  thumbnailUrl: string
  viewCount: number
  likeCount: number
  duration: string
  durationSec: number
  url: string
  embedUrl: string
  region: "channel" | "global"
}

export interface StoryWinningContent {
  videoId: string
  channelId: string
  title: string
  description: string
  channelTitle: string
  channelThumbnailUrl?: string
  thumbnailUrl: string
  viewCount: number
  likeCount: number
  commentCount: number
  publishedAt: string
  durationSeconds?: number
  mutationX?: number
  baselineViewCount?: number
  popularityScore: number
  channelBaselineViews: number
  outlierRatio: number
  viewsPerDay: number
  engagementRate: number
  winningScore: number
  source: "channel-analysis"
}

export interface StoryShoppingTag {
  title: string
  url: string
  price: string
  imageUrl: string
  domain?: string
}

export interface StoryProductAnalysis {
  videoId: string
  source: "youtube-shopping-tag" | "ai-analysis"
  productName: string
  searchKeyword: string
  alternativeKeywords?: string[]
  productDescription: string
  confidence: number
  evidence: string[]
  analysisSummary: string
  hasTranscript: boolean
  shoppingTags?: StoryShoppingTag[]
}

export interface StoryCoupangProduct {
  productName: string
  productPrice: number
  productImage: string
  productUrl: string
  categoryName?: string
  isRocket?: boolean
  rank?: number
  productId?: string
}

export type StoryScriptTemplateId =
  | "origin"
  | "inventor"
  | "competition"
  | "unexpected-use"
  | "hidden-truth"
  | "heartwarming-true"
  | "review-twist"
  | "problem-solution"
  | "before-after"
  | "challenge-test"
  | "mistake-warning"
  | "expert-tip"
  | "comparison"
  | "time-saving"
  | "gift-reaction"
  | "trend-discovery"

export interface StoryScriptScene {
  id: string
  order: number
  narration: string
  caption: string
  visualPrompt: string
  durationSec: number
}

export interface StoryGeneratedScript {
  templateId: StoryScriptTemplateId
  templateName: string
  targetDurationSec: number
  typeReason: string
  hook: string
  title: string
  script: string
  scenes: StoryScriptScene[]
  generatedAt: string
}

export interface StoryTemplateRecommendation {
  templateId: StoryScriptTemplateId
  reason: string
  productKey: string
  recommendedAt: string
}

export interface StoryVoiceLineTrack {
  lineIndex: number
  text: string
  audioUrl?: string
  durationSec?: number
  startSec?: number
  endSec?: number
  /** whisper = AI 음성 분석 싱크, estimated = 글자 수 비율 추정 */
  alignmentSource?: "whisper" | "estimated"
}

export interface StoryVoiceTrack {
  sceneId: string
  audioUrl: string
  durationSec?: number
  lineTracks?: StoryVoiceLineTrack[]
}

export interface StoryVoiceData {
  voiceId: string
  provider: "supertone" | "supertonic" | "typecast" | "elevenlabs"
  style: string
  speed: number
  tracks: StoryVoiceTrack[]
  generatedAt: string
}

export type StoryFrameTemplateId =
  | "channel-search"
  | "channel-pill"
  | "channel-minimal"
  | "channel-star"
  | "channel-red"
  | "channel-green"
  | "channel-dark"
  | "channel-purple"
  | "channel-orange"
  | "channel-mint"
  | "channel-lavender"
  | "channel-navy"
  | "channel-pink"
  | "channel-paper"
  | "channel-neon"
  | "channel-review"
  | "channel-board"
  | "channel-hot"
  | "channel-best-comment"
  | "channel-chat"
  | "channel-office"
  | "channel-breaking"
  | "channel-webtoon"
  | "channel-diary"

export interface StoryFrameSettings {
  templateId: StoryFrameTemplateId
  channelName: string
  videoTitle: string
  titleSuggestions?: string[]
  authorLabel: string
  viewCountLabel: string
  likeCountLabel: string
  commentCountLabel: string
}

export interface StoryVideoMosaic {
  id: string
  x: number
  y: number
  width: number
  height: number
  startSec: number
  endSec: number
  blockSize: number
}

export interface StorySceneAsset {
  sceneId: string
  lineIndex?: number
  mediaUrl: string
  mediaType: "image" | "video"
  source:
    | "ai"
    | "upload"
    | "stock"
    | "pixabay"
    | "google"
    | "youtube"
    | "xiaohongshu"
    | "douyin"
    | "image-to-video"
    | "product"
    | "review"
    | "klipy"
  sourcePageUrl?: string
  attribution?: string
  license?:
    | "generated"
    | "pixabay"
    | "creativeCommon"
    | "youtube-cc"
    | "permission-confirmed"
    | string
  rightsConfirmed?: boolean
  generatedFromImageUrl?: string
  trimStartSec?: number
  trimEndSec?: number
  videoMosaics?: StoryVideoMosaic[]
  mediaScale?: number
  mediaOffsetX?: number
  mediaOffsetY?: number
  mediaFit?: "cover" | "contain"
  motionEffect?:
    | "none"
    | "zoom-in"
    | "zoom-out"
    | "pan-left"
    | "pan-right"
    | "shake"
    | "pulse"
    | "blur-in"
    | "flash"
  editorNote?: string
}

export interface StorySfxClip {
  id: string
  label: string
  audioUrl: string
  startSec: number
  durationSec: number
  clipKey?: string
  catalogId?: string
  source?: "bundled" | "upload"
  sourceOffsetSec?: number
  sourceDurationSec?: number
  volumePct?: number
  autoPlaced?: boolean
  autoReason?: string
  autoVolumeVersion?: number
}

export interface StoryEditSettings {
  subtitleColor: string
  subtitleSize: number
  subtitlePosition: "top" | "center" | "bottom"
  backgroundColor: string
  subtitleFontFamily?: string
  subtitleFontWeight?: 400 | 600 | 700 | 900
  subtitleBackgroundEnabled?: boolean
  subtitleBackgroundColor?: string
  subtitleOutlineWidth?: number
  subtitleOutlineColor?: string
}

export interface StoryMediaPoolItem {
  id: string
  title: string
  mediaUrl: string
  mediaType: "image" | "video"
  source: "ai" | "google" | "youtube" | "pixabay" | "product" | "upload"
  thumbnailUrl?: string
  durationSec?: number
  pageUrl?: string
  attribution?: string
  license?: StorySceneAsset["license"]
  addedAt?: string
}

export interface StoryMashupSettings {
  includeGoogleLens: boolean
  includeGoogle: boolean
  includeStock: boolean
  includeYoutubeCc: boolean
  includeAi: boolean
}

export const DEFAULT_STORY_MASHUP_SETTINGS: StoryMashupSettings = {
  includeGoogleLens: true,
  includeGoogle: true,
  includeStock: true,
  includeYoutubeCc: true,
  includeAi: true,
}

export interface StoryShoppingScene {
  id: string
  beat: StoryBeat
  startSec: number
  endSec: number
  narration: string
  caption: string
  visualDirection: string
  productPlacement: string
  imagePrompt: string
  mediaUrl?: string
  mediaType?: "image" | "video"
}

export interface StorySafetyCheck {
  key: string
  label: string
  status: "pass" | "warning" | "blocked"
  note: string
}

export interface StoryShoppingBlueprint {
  conceptTitle: string
  conceptSummary: string
  hookTitle: string
  subTitle: string
  channelLabel: string
  openingHooks: string[]
  ctaCandidates: string[]
  scenes: StoryShoppingScene[]
  scores: {
    productFit: number
    visualProof: number
    storyPower: number
    hookPower: number
    conversion: number
    total: number
  }
  safetyChecks: StorySafetyCheck[]
}

export interface StoryCollectorData {
  collectedAt: string
  collectedProductName: string
  productImages: string[]
  detailImages: string[]
  reviewImages: string[]
  reviews: Array<{
    author?: string
    rating?: number
    content: string
    date?: string
    page?: number
    indexOnPage?: number
    images?: string[]
  }>
  photoPickNote: string
  detailInsights?: any
  reviewInsights?: any
}

export interface StoryShoppingBrief {
  productName: string
  productDescription: string
  productImage: string
  productUrl: string
  targetAudience: string
  problem: string
  storySource: string
  proof: string
  priceBenefit: string
  cta: string
  tone: StoryTone
  durationSec: number
  trendSource: string
  assetRightsConfirmed: boolean
  referenceVideos: StoryReferenceVideo[]
  winningContent?: StoryWinningContent
  productAnalysis?: StoryProductAnalysis
  productSearch?: {
    videoId: string
    query: string
    products: StoryCoupangProduct[]
  }
  selectedShoppingTag?: StoryShoppingTag & { videoId: string }
  selectedProductVideoId?: string
  selectedProductSource?: "youtube-shopping-tag" | "coupang-search"
  collectorData?: StoryCollectorData
  storyTemplateRecommendation?: StoryTemplateRecommendation
  generatedStory?: StoryGeneratedScript
  voiceData?: StoryVoiceData
  frameSettings?: StoryFrameSettings
  sceneAssets?: StorySceneAsset[]
  editSettings?: StoryEditSettings
  mediaPool?: StoryMediaPoolItem[]
  mashupSettings?: StoryMashupSettings
  sfxClips?: StorySfxClip[]
  thumbnailState?: StoryThumbnailState
}

export interface StoryThumbnailState {
  gallery: MvpThumbnailVariant[]
  selectedId: string | null
  introOn?: boolean
}

export const EMPTY_STORY_BRIEF: StoryShoppingBrief = {
  productName: "",
  productDescription: "",
  productImage: "",
  productUrl: "",
  targetAudience: "",
  problem: "",
  storySource: "",
  proof: "",
  priceBenefit: "",
  cta: "프로필 링크에서 확인해보세요.",
  tone: "reversal",
  durationSec: 30,
  trendSource: "",
  assetRightsConfirmed: false,
  referenceVideos: [],
}
