/** 더우인 영상 ID 추출 (`/video/{id}`) */
export function extractDouyinVideoId(url: string): string | null {
  if (!url) return null
  const m = url.match(/\/video\/(\d{10,22})/)
  return m ? m[1] : null
}

/**
 * 카드 iframe용 embed URL.
 * `www.douyin.com/embed` 는 X-Frame-Options: SAMEORIGIN → 외부 사이트에서 「연결 거부」.
 * `open.douyin.com/player` 는 외부 iframe 허용(벤치마킹과 유사한 공식 플레이어 UI).
 */
export function douyinEmbedCandidates(videoId: string): string[] {
  return [`https://open.douyin.com/player/video?vid=${videoId}`]
}

export function withDouyinPlayerParams(embedSrc: string, autoplay = true): string {
  try {
    const u = new URL(embedSrc)
    if (!u.hostname.includes("douyin.com")) return embedSrc
    if (autoplay) u.searchParams.set("autoplay", "1")
    if (u.hostname.includes("www.douyin.com")) {
      u.searchParams.set("utm_source", "copy")
      u.searchParams.set("utm_campaign", "client_share")
    }
    return u.toString()
  } catch {
    return embedSrc
  }
}

/** Apify 등이 준 직접 스트림 URL — embed URL이 아닐 때만 */
export function isDouyinDirectStreamUrl(url: string): boolean {
  const v = url.trim()
  if (!v.startsWith("http")) return false
  if (v.includes("douyin.com/embed") || v.includes("open.douyin.com/player")) return false
  return (
    v.includes(".mp4") ||
    v.includes("m3u8") ||
    v.includes("douyinvod.com") ||
    v.includes("ixigua.com") ||
    v.includes("snssdk.com") ||
    v.includes("bytecdn.cn") ||
    v.includes("zjcdn.com")
  )
}
