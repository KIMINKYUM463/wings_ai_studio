import type { PickedVideoPlatform } from "@/lib/shotform-picked-videos-types"

export function platformLabel(p: PickedVideoPlatform): string {
  switch (p) {
    case "tiktok":
      return "TikTok"
    case "instagram":
      return "Instagram"
    case "xiaohongshu":
      return "小红书"
    case "youtube":
      return "YouTube"
    default:
      return "원본"
  }
}

export function platformBadgeClass(p: PickedVideoPlatform): string {
  switch (p) {
    case "tiktok":
      return "bg-black text-white"
    case "instagram":
      return "bg-gradient-to-r from-purple-600 to-pink-500 text-white"
    case "xiaohongshu":
      return "bg-red-600 text-white"
    default:
      return "bg-slate-600 text-white"
  }
}

export function formatViewCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}천`
  return String(n)
}
