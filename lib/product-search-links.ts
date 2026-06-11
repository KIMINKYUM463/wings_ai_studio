/** 플랫폼별 웹 검색 URL (클라이언트·서버 공용) */

export function platformSearchUrl(platform: string, query: string): string {
  const q = query.trim()
  if (!q) return "#"
  const encQ = encodeURIComponent(q)
  switch (platform) {
    case "youtube":
      return `https://www.youtube.com/results?search_query=${encQ}`
    case "tiktok":
      return `https://www.tiktok.com/search?q=${encQ}`
    case "instagram":
      return `https://www.google.com/search?q=${encodeURIComponent(`site:instagram.com ${q}`)}`
    case "xiaohongshu":
      return `https://www.google.com/search?q=${encodeURIComponent(`site:xiaohongshu.com ${q}`)}`
    case "douyin":
      return `https://www.google.com/search?q=${encodeURIComponent(`site:douyin.com ${q}`)}`
    case "baidu":
      return `https://www.baidu.com/s?wd=${encQ}`
    default:
      return `https://www.google.com/search?q=${encQ}`
  }
}

export function platformLabelKo(platform: string): string {
  const m: Record<string, string> = {
    youtube: "YouTube",
    tiktok: "TikTok",
    instagram: "Instagram",
    xiaohongshu: "샤오홍슈",
    douyin: "더우인",
    baidu: "바이두",
    web: "웹",
    facebook: "Facebook",
  }
  return m[platform] ?? platform
}

export function googleWebSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query.trim())}`
}
