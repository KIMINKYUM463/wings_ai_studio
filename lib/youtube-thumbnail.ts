/** YouTube 카드 썸네일 후보 URL (앞쪽부터 우선 시도) */

export function extractYoutubeVideoId(url: string): string | null {
  const m = url.match(/(?:[?&]v=|youtu\.be\/|\/shorts\/|\/vi\/)([a-zA-Z0-9_-]{11})/)
  return m?.[1] ?? null
}

function isShortFormYoutube(item: { url: string; contentLength?: string }): boolean {
  return item.url.includes("/shorts/") || item.contentLength === "short"
}

/** Serp·데모에서 넘어온 썸네일이 maxresdefault 단독이면 404가 잦아 뒤로 미룬다 */
function isLowTrustYoutubeThumb(url: string): boolean {
  return /\/maxresdefault\.jpg/i.test(url) && !url.includes("?")
}

export function youtubeThumbnailCandidates(item: {
  url: string
  thumbnail?: string
  contentLength?: string
}): string[] {
  const id = extractYoutubeVideoId(item.url) || extractYoutubeVideoId(item.thumbnail || "")
  const original = (item.thumbnail || "").trim().replace(/\|/g, "%7C")
  const out: string[] = []

  const push = (u: string) => {
    const t = u.trim()
    if (!t || !t.startsWith("http")) return
    if (!out.includes(t)) out.push(t)
  }

  if (id) {
    const short = isShortFormYoutube(item)
    if (short) {
      push(`https://i.ytimg.com/vi/${id}/oardefault.jpg`)
      push(`https://i.ytimg.com/vi/${id}/oar2.jpg`)
    }
    if (original && !isLowTrustYoutubeThumb(original)) push(original)
    push(`https://i.ytimg.com/vi/${id}/hq720.jpg`)
    push(`https://i.ytimg.com/vi/${id}/hq720_2.jpg`)
    if (original) push(original)
    push(`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`)
    push(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`)
    push(`https://i.ytimg.com/vi/${id}/mqdefault.jpg`)
    push(`https://i.ytimg.com/vi/${id}/sddefault.jpg`)
    push(`https://i.ytimg.com/vi/${id}/1.jpg`)
    push(`https://i.ytimg.com/vi/${id}/0.jpg`)
    push(`https://img.youtube.com/vi/${id}/hqdefault.jpg`)
  } else if (original) {
    push(original)
  }

  return out
}

export function proxyYoutubeThumbnailIfNeeded(url: string): string {
  if (!url.startsWith("http")) return url
  try {
    const host = new URL(url).hostname
    if (host === "i.ytimg.com" || host === "img.youtube.com" || host.endsWith(".ytimg.com")) {
      return `/api/proxy-image?url=${encodeURIComponent(url)}`
    }
  } catch {
    /* ignore */
  }
  return url
}
