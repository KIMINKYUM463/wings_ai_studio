/** 클라이언트·서버 공용 — 재가공 URL 타입·감지 (Node/sharp 의존 없음) */

export type MvpReprocessPlatform = "youtube" | "tiktok"

export type MvpReprocessResolvedItem = {
  inputUrl: string
  noteUrl: string
  videoUrl: string
  platform: MvpReprocessPlatform
  title: string
  durationSec?: number | null
  error?: string
}

export function detectReprocessUrlPlatform(url: string): MvpReprocessPlatform | null {
  const u = url.trim().toLowerCase()
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube"
  if (u.includes("tiktok.com")) return "tiktok"
  return null
}

export function parseReprocessUrl(text: string): string | null {
  const u = text.trim()
  if (!u.startsWith("http")) return null
  return detectReprocessUrlPlatform(u) ? u : null
}

/** Apify KV에 저장된 MP4 (bytepulselabs 등) */
export function isApifyHostedVideoUrl(url: string): boolean {
  try {
    return new URL(url.trim()).hostname.includes("api.apify.com")
  } catch {
    return false
  }
}

/** 재가공 CDN URL → 브라우저/서버 프록시 경로 */
export function reprocessVideoPlayUrl(videoUrl: string): string {
  const url = videoUrl.trim()
  if (!url.startsWith("http")) return url
  if (isApifyHostedVideoUrl(url)) return url
  try {
    const host = new URL(url).hostname
    if (
      host.includes("googlevideo.com") ||
      host.includes("tiktokcdn") ||
      host.includes("tiktokv.com") ||
      host.includes("muscdn.com")
    ) {
      return `/api/proxy-video?url=${encodeURIComponent(url)}`
    }
  } catch {
    /* ignore */
  }
  return url
}
