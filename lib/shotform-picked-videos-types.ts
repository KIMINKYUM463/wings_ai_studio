export type PickedVideoPlatform = "tiktok" | "instagram" | "xiaohongshu" | "youtube" | "other"

export type PickedVideoItem = {
  id: string
  index: number
  productName: string
  thumbnailUrl: string
  coupangLink: string
  sourceUrls: string[]
  platforms: PickedVideoPlatform[]
  viewCount: number
  isFree: boolean
}

export type PickedVideosResponse = {
  videos: PickedVideoItem[]
}
