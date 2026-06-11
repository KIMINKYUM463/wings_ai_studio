/** 샤오홍슈 노트 URL·CDN 스트림 재생 헬퍼 */

function matchXhsNoteIdInText(text: string): string | null {
  const m = text.match(/xiaohongshu\.com\/(?:explore|discovery\/item)\/([a-f0-9]+)/i)
  return m?.[1] ?? null
}

/** explore/discovery 링크·404 redirectPath·인코딩된 URL에서 노트 ID 추출 */
export function extractXhsNoteId(url: string): string | null {
  const trimmed = url.trim()
  const direct = matchXhsNoteIdInText(trimmed)
  if (direct) return direct

  try {
    const decoded = decodeURIComponent(trimmed)
    const fromDecoded = matchXhsNoteIdInText(decoded)
    if (fromDecoded) return fromDecoded
  } catch {
    /* ignore */
  }

  const redirectParam = trimmed.match(/redirectPath=([^&]+)/i)?.[1]
  if (redirectParam) {
    try {
      const path = decodeURIComponent(redirectParam)
      const fromRedirect = matchXhsNoteIdInText(path.startsWith("http") ? path : `https://${path}`)
      if (fromRedirect) return fromRedirect
    } catch {
      /* ignore */
    }
  }

  return null
}

/** 404·리다이렉트 URL을 explore 노트 URL로 정규화 */
export function normalizeXhsNoteUrl(url: string): string {
  const id = extractXhsNoteId(url)
  if (!id) return url.trim()
  return `https://www.xiaohongshu.com/explore/${id}`
}

export function isXhsNotePageUrl(url: string): boolean {
  return Boolean(extractXhsNoteId(url))
}

export function isXhsCdnMediaUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".xhscdn.com")
  } catch {
    return false
  }
}

/** 브라우저에서 xhscdn 직링크가 막히므로 서버 프록시 경유 */
export function xhsVideoPlaybackSrc(url: string): string {
  const u = url.trim()
  if (!u.startsWith("http")) return u
  if (isXhsCdnMediaUrl(u)) {
    return `/api/proxy-video?url=${encodeURIComponent(u)}`
  }
  return u
}

function decodeJsonishUrl(raw: string): string {
  return raw.replace(/\\u002F/gi, "/").replace(/\\\//g, "/").replace(/&amp;/g, "&")
}

function pickBestVideoUrl(candidates: string[]): string | null {
  const uniq = [...new Set(candidates.map(decodeJsonishUrl).filter(Boolean))]
  const videoish = uniq.filter(
    (u) =>
      u.includes("xhscdn.com") &&
      (u.includes(".mp4") || u.includes("/stream/") || /\/video\//i.test(u) || u.includes("sns-video"))
  )
  if (!videoish.length) return null
  const scored = videoish.map((u) => {
    let score = 0
    if (u.includes("master")) score += 6
    if (u.includes(".mp4")) score += 5
    if (u.includes("720")) score += 3
    if (u.includes("1080")) score += 2
    if (u.includes("540")) score += 1
    return { u, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.u ?? null
}

function walkForVideoUrls(obj: unknown, out: string[]): void {
  if (obj == null) return
  if (typeof obj === "string") {
    if (obj.startsWith("https://") && obj.includes("xhscdn.com")) out.push(obj)
    return
  }
  if (Array.isArray(obj)) {
    for (const x of obj) walkForVideoUrls(x, out)
    return
  }
  if (typeof obj === "object") {
    const o = obj as Record<string, unknown>
    for (const k of [
      "masterUrl",
      "url_1080p",
      "url_720p",
      "url_540p",
      "url_360p",
      "playUrl",
      "videoUrl",
      "stream",
      "mediaUrl",
    ]) {
      const v = o[k]
      if (typeof v === "string" && v.startsWith("http")) out.push(v)
    }
    for (const v of Object.values(o)) walkForVideoUrls(v, out)
  }
}

function parseInitialState(html: string): unknown | null {
  const m = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*(?:<\/script>|;?\s*window\.|<\/script>)/)
  if (!m?.[1]) return null
  try {
    return JSON.parse(m[1].replace(/undefined/g, "null")) as unknown
  } catch {
    return null
  }
}

/** 노트 페이지 HTML에서 xhscdn MP4·스트림 URL 추출 */
export function extractXhsVideoUrlsFromHtml(html: string, noteId?: string | null): string[] {
  const candidates: string[] = []
  const re = /https:\/\/[^"'\\\s]+xhscdn\.com\/[^"'\\\s]+/g
  for (const m of html.matchAll(re)) {
    candidates.push(decodeJsonishUrl(m[0]))
  }
  const state = parseInitialState(html)
  if (state) {
    walkForVideoUrls(state, candidates)
    if (noteId && state && typeof state === "object") {
      const note = (state as Record<string, unknown>).note as Record<string, unknown> | undefined
      const map = note?.noteDetailMap as Record<string, unknown> | undefined
      const detail = map?.[noteId]
      if (detail) walkForVideoUrls(detail, candidates)
    }
  }
  return candidates
}

export async function fetchXhsNoteVideoUrl(noteUrl: string): Promise<string | null> {
  const noteId = extractXhsNoteId(noteUrl)
  if (!noteId) return null
  const pageUrl = `https://www.xiaohongshu.com/explore/${noteId}`
  const res = await fetch(pageUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      Referer: "https://www.xiaohongshu.com/",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
    redirect: "follow",
    next: { revalidate: 300 },
  })
  if (!res.ok) return null
  const html = await res.text()
  return pickBestVideoUrl(extractXhsVideoUrlsFromHtml(html, noteId))
}
