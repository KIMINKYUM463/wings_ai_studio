export type BenchmarkTab = "my-channel" | "trending" | "insight" | "groups" | "video-groups"

export interface TrendingVideo {
  id: string
  title: string
  channelTitle: string
  channelId: string
  thumbnail: string
  viewCount: number
  likeCount: number
  publishedAt: string
  description?: string
}

export interface ChannelBucket {
  channelId: string
  channelTitle: string
  videoCount: number
  totalViews: number
  totalLikes: number
  videos: TrendingVideo[]
  score: number
  subscriberCount?: number
  channelViewCount?: number
  thumbnailUrl?: string
  customUrl?: string
}

export interface RisingCreator {
  channelTitle: string
  channelId: string
  videoCount: number
  totalViews: number
  averageViews: number
  highlight: string
  videos: Array<{ title: string; viewCount: number }>
}

export interface GroupChannel {
  channelId: string
  /** 채널을 최초 등록할 때 사용한 URL 또는 검색어 */
  sourceInput?: string
  channelTitle: string
  thumbnailUrl?: string
  subscriberCount?: string
  viewCount?: string
  videoCount?: string
  videos?: Array<{
    videoId: string
    title: string
    thumbnailUrl: string
    viewCount: number
    likeCount: number
    commentCount?: number
    publishedAt: string
    description?: string
    durationSeconds?: number
    mutationX?: number
    baselineViewCount?: number
  }>
}

export interface ChannelGroup {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  channels: GroupChannel[]
}

/** 관심 영상에 저장된 즐겨찾기 영상 */
export interface GroupVideo {
  videoId: string
  title: string
  thumbnailUrl: string
  viewCount: number
  likeCount: number
  publishedAt: string
  channelId: string
  channelTitle: string
  channelThumb?: string
  durationSeconds?: number
  savedAt: string
}

export interface VideoGroup {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  videos: GroupVideo[]
}

export function formatCount(n: number | string): string {
  const num = typeof n === "string" ? parseInt(n.replace(/,/g, ""), 10) || 0 : n
  if (num >= 100_000_000) return `${(num / 100_000_000).toFixed(1)}억`
  if (num >= 10_000) return `${(num / 10_000).toFixed(1)}만`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}천`
  return num.toLocaleString()
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days <= 0) return "오늘"
  if (days === 1) return "어제"
  if (days < 7) return `${days}일 전`
  if (days < 30) return `${Math.floor(days / 7)}주 전`
  return `${Math.floor(days / 30)}개월 전`
}

export function getYoutubeApiKey(): string {
  if (typeof window === "undefined") return ""
  return (localStorage.getItem("shotform_youtube_data_api_key") || "").trim()
}

export function getGeminiApiKey(): string {
  if (typeof window === "undefined") return ""
  return (
    localStorage.getItem("shotform_gemini_api_key") ||
    localStorage.getItem("gemini_api_key") ||
    ""
  ).trim()
}
