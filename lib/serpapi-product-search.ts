/**
 * 제품 검색용 SerpApi 호출 (서버 전용).
 * SERPAPI_KEY 환경변수 필요.
 */

const SERP = "https://serpapi.com/search.json"

export type SerpVideoRow = {
  platform: string
  title: string
  thumbnail: string
  videoUrl: string
  url: string
  author: string
  contentLength?: "short" | "long" | "unknown"
  /** 영상 길이(초) — Apify·SerpApi에서 수집 가능할 때 */
  durationSec?: number | null
  viewCount?: number | null
  likeCount?: number | null
}

/** Apify duration(ms 또는 초) → 초 */
export function normalizeMediaDurationSec(raw: number | undefined | null): number | null {
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return null
  const sec = raw >= 500 ? raw / 1000 : raw
  return Math.round(Math.min(7200, sec) * 10) / 10
}

/** "9:28" | "0:45" | "1:05:03" → 초 */
export function parseYoutubeLengthToSec(len?: string): number | null {
  if (!len || typeof len !== "string") return null
  const p = len.trim().split(":").map((x) => parseInt(x, 10))
  if (p.some((n) => Number.isNaN(n))) return null
  if (p.length === 2) return p[0]! * 60 + p[1]!
  if (p.length === 3) return p[0]! * 3600 + p[1]! * 60 + p[2]!
  return null
}

/** 카드·타임라인용 — 45초 / 1:23 */
export function formatMediaDurationLabel(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return "—"
  const total = Math.max(0, sec)
  const m = Math.floor(total / 60)
  const s = total - m * 60
  if (m > 0) {
    const sText =
      Math.abs(s - Math.round(s)) < 0.05
        ? String(Math.round(s)).padStart(2, "0")
        : s.toFixed(1)
    return `${m}:${sText}`
  }
  return Math.abs(total - Math.round(total)) < 0.05 ? `${Math.round(total)}초` : `${total.toFixed(1)}초`
}

export type SerpKeyframe = { index: number; imageUrl: string; label?: string }

function thumbPick(thumbnail: unknown): string {
  if (!thumbnail) return ""
  if (typeof thumbnail === "string") return thumbnail
  if (typeof thumbnail === "object" && thumbnail !== null && "static" in thumbnail) {
    const s = (thumbnail as { static?: string }).static
    return typeof s === "string" ? s : ""
  }
  return ""
}

/** "9:28" | "0:45" | "1:05:03" → 숏폼(≤3분) vs 롱폼 */
export function parseYoutubeLength(len?: string): "short" | "long" | "unknown" {
  if (!len || typeof len !== "string") return "unknown"
  const p = len.trim().split(":").map((x) => parseInt(x, 10))
  if (p.some((n) => Number.isNaN(n))) return "unknown"
  let sec = 0
  if (p.length === 2) sec = p[0] * 60 + p[1]
  else if (p.length === 3) sec = p[0] * 3600 + p[1] * 60 + p[2]
  else return "unknown"
  if (sec <= 180) return "short"
  return "long"
}

function detectVideoPlatform(link: string): string {
  const u = link.toLowerCase()
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube"
  if (u.includes("tiktok.com")) return "tiktok"
  if (u.includes("instagram.com")) return "instagram"
  if (u.includes("xiaohongshu.com") || u.includes("xhslink.com")) return "xiaohongshu"
  if (u.includes("douyin.com") || u.includes("iesdouyin.com") || u.includes("v.douyin.com") || u.includes("m.douyin.com"))
    return "douyin"
  if (u.includes("facebook.com") || u.includes("fb.watch")) return "facebook"
  return "web"
}

function youtubeIdFromUrl(link: string): string | null {
  try {
    const u = new URL(link)
    const v = u.searchParams.get("v")
    if (v) return v
    if (u.hostname.includes("youtu.be")) return u.pathname.replace(/^\//, "").split("/")[0] || null
    if (u.pathname.includes("/shorts/")) return u.pathname.split("/shorts/")[1]?.split(/[/?]/)[0] || null
  } catch {
    return null
  }
  return null
}

function rowFromYoutubeSerpItem(item: {
  title?: string
  link?: string
  video_id?: string
  channel?: { name?: string }
  thumbnail?: unknown
  length?: string
}): SerpVideoRow | null {
  const id = item.video_id || youtubeIdFromUrl(item.link || "")
  const link = item.link || ""
  if (!id || !link) return null
  const thumb = thumbPick(item.thumbnail) || `https://img.youtube.com/vi/${id}/hqdefault.jpg`
  return {
    platform: "youtube",
    title: item.title || "(제목 없음)",
    thumbnail: thumb,
    videoUrl: `https://www.youtube.com/embed/${id}`,
    url: link.startsWith("http") ? link : `https://www.youtube.com/watch?v=${id}`,
    author: item.channel?.name || "",
    contentLength: parseYoutubeLength(item.length),
    durationSec: parseYoutubeLengthToSec(item.length),
  }
}

export async function serpYoutubeSearch(apiKey: string, searchQuery: string, max = 18): Promise<SerpVideoRow[]> {
  const u = new URL(SERP)
  u.searchParams.set("engine", "youtube")
  u.searchParams.set("search_query", searchQuery)
  u.searchParams.set("api_key", apiKey)
  u.searchParams.set("gl", "kr")
  u.searchParams.set("hl", "ko")
  const r = await fetch(u.toString(), { next: { revalidate: 0 } })
  if (!r.ok) return []
  const data = (await r.json().catch(() => ({}))) as { video_results?: unknown[] }
  const items = data.video_results || []
  const out: SerpVideoRow[] = []
  for (const raw of items) {
    const row = rowFromYoutubeSerpItem(raw as Parameters<typeof rowFromYoutubeSerpItem>[0])
    if (row) out.push(row)
    if (out.length >= max) break
  }
  return out
}

/** SerpApi Google Videos가 `google.com/url?q=...` 형태로 줄 때 실제 영상 페이지로 복원 */
function normalizeSerpGoogleVideoLink(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed.startsWith("http")) return trimmed
  try {
    const u = new URL(trimmed)
    const host = u.hostname.replace(/^www\./, "")
    if ((host === "google.com" || host.endsWith(".google.com")) && (u.pathname === "/url" || u.pathname.startsWith("/url"))) {
      const inner = u.searchParams.get("q") || u.searchParams.get("url")
      if (inner?.startsWith("http")) {
        try {
          return decodeURIComponent(inner)
        } catch {
          return inner
        }
      }
    }
  } catch {
    /* keep raw */
  }
  return trimmed
}

function rowFromGoogleVideoItem(item: {
  title?: string
  link?: string
  thumbnail?: string
  rich_snippet?: { top?: { extensions?: string[] } }
}): SerpVideoRow | null {
  const raw = (item.link || "").trim()
  if (!raw.startsWith("http")) return null
  const link = normalizeSerpGoogleVideoLink(raw)
  if (!link.startsWith("http")) return null
  const platform = detectVideoPlatform(link)
  const thumb = item.thumbnail || ""
  const ytId = platform === "youtube" ? youtubeIdFromUrl(link) : null
  const extensions = item.rich_snippet?.top?.extensions
  const lenStr = Array.isArray(extensions) ? extensions.find((x) => typeof x === "string" && x.includes(":")) : undefined
  return {
    platform,
    title: item.title || "(제목 없음)",
    thumbnail: thumb,
    videoUrl: ytId ? `https://www.youtube.com/embed/${ytId}` : "",
    url: link,
    author:
      platform === "tiktok"
        ? "TikTok"
        : platform === "instagram"
          ? "Instagram"
          : platform === "douyin"
            ? "抖音"
            : platform === "xiaohongshu"
              ? "小红书"
              : "",
    contentLength: platform === "youtube" ? parseYoutubeLength(lenStr) : "unknown",
  }
}

export type SerpGoogleVideosLocale = { gl?: string; hl?: string }

export async function serpGoogleVideosSearch(
  apiKey: string,
  q: string,
  max = 12,
  locale?: SerpGoogleVideosLocale,
  start?: number
): Promise<SerpVideoRow[]> {
  const u = new URL(SERP)
  u.searchParams.set("engine", "google_videos")
  u.searchParams.set("q", q)
  u.searchParams.set("api_key", apiKey)
  u.searchParams.set("gl", locale?.gl ?? "kr")
  u.searchParams.set("hl", locale?.hl ?? "ko")
  if (typeof start === "number" && start > 0) u.searchParams.set("start", String(start))
  const r = await fetch(u.toString(), { next: { revalidate: 0 } })
  if (!r.ok) return []
  const data = (await r.json().catch(() => ({}))) as { video_results?: unknown[] }
  const items = data.video_results || []
  const out: SerpVideoRow[] = []
  for (const raw of items) {
    const row = rowFromGoogleVideoItem(raw as Parameters<typeof rowFromGoogleVideoItem>[0])
    if (row) out.push(row)
    if (out.length >= max) break
  }
  return out
}

/** 키워드를 OR로 묶어 Google Videos **1회** 호출 (SerpApi 크레딧 절감). siteClause 예: site:tiktok.com 또는 (site:a OR site:b) */
export async function serpGoogleVideosSiteOrKeywords(
  apiKey: string,
  keywords: string[],
  siteClause: string,
  max: number,
  locale?: SerpGoogleVideosLocale
): Promise<SerpVideoRow[]> {
  const kws = keywords
    .map((k) => k.replace(/[()]/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 4)
  if (kws.length === 0) return []
  const orPart = kws.length === 1 ? kws[0] : `(${kws.join(" OR ")})`
  const q = `${orPart} ${siteClause}`.trim()
  return serpGoogleVideosSearch(apiKey, q, max, locale, 0)
}

export type SerpGoogleVideosMergedArgs = {
  maxTotal: number
  perQuery: number
  locale?: SerpGoogleVideosLocale
  /** SerpApi google_videos `start` 페이지네이션 (예: [0,10,20]) */
  paginationStarts?: number[]
}

/** 동일 사이트에 대해 여러 검색어로 Google Videos를 호출해 URL 기준으로 합칩니다(중국 사이트는 gl/hl 분리 권장). */
export async function serpGoogleVideosSearchMerged(
  apiKey: string,
  queries: string[],
  siteSuffix: string,
  args: SerpGoogleVideosMergedArgs
): Promise<SerpVideoRow[]> {
  const seen = new Set<string>()
  const out: SerpVideoRow[] = []
  const starts = args.paginationStarts?.length ? args.paginationStarts : [0]
  for (const raw of queries) {
    if (out.length >= args.maxTotal) break
    if (!raw.trim()) continue
    for (const start of starts) {
      if (out.length >= args.maxTotal) break
      const q = `${raw.trim()} ${siteSuffix}`.trim()
      const batch = await serpGoogleVideosSearch(apiKey, q, args.perQuery, args.locale, start)
      for (const row of batch) {
        const key = row.url.trim().toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        out.push(row)
        if (out.length >= args.maxTotal) break
      }
    }
  }
  return out
}

/**
 * `site:` 없이 Google Videos를 넓게 친 뒤, URL 기준으로 douyin / xiaohongshu만 남긴다(색인이 약한 중국 숏폼 보강).
 */
export async function serpGoogleVideosLoosePlatform(
  apiKey: string,
  queries: string[],
  platform: "douyin" | "xiaohongshu",
  args: SerpGoogleVideosMergedArgs & { queryBoost: string }
): Promise<SerpVideoRow[]> {
  const seen = new Set<string>()
  const out: SerpVideoRow[] = []
  const starts = args.paginationStarts?.length ? args.paginationStarts : [0]
  for (const raw of queries) {
    if (out.length >= args.maxTotal) break
    if (!raw.trim()) continue
    const wide = `${raw.trim()} ${args.queryBoost}`.trim()
    for (const start of starts) {
      if (out.length >= args.maxTotal) break
      const batch = await serpGoogleVideosSearch(apiKey, wide, args.perQuery, args.locale, start)
      for (const row of batch) {
        if (row.platform !== platform) continue
        const key = row.url.trim().toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        out.push(row)
        if (out.length >= args.maxTotal) break
      }
    }
  }
  return out
}

export async function serpGoogleImagesAsKeyframes(apiKey: string, q: string, limit = 6): Promise<SerpKeyframe[]> {
  const u = new URL(SERP)
  u.searchParams.set("engine", "google_images")
  u.searchParams.set("q", q)
  u.searchParams.set("api_key", apiKey)
  u.searchParams.set("hl", "ko")
  u.searchParams.set("gl", "kr")
  const r = await fetch(u.toString(), { next: { revalidate: 0 } })
  if (!r.ok) return []
  const data = (await r.json().catch(() => ({}))) as {
    images_results?: Array<{ original?: string; thumbnail?: string }>
  }
  const imgs = data.images_results || []
  const out: SerpKeyframe[] = []
  for (const im of imgs) {
    const url = (im.original || im.thumbnail || "").trim()
    if (!url.startsWith("http")) continue
    out.push({
      index: out.length + 1,
      imageUrl: url,
      label: `제품 시각 ${out.length + 1} (웹 이미지)`,
    })
    if (out.length >= limit) break
  }
  return out
}

export type SerpLensMatch = {
  title: string
  imageUrl: string
  thumbnailUrl: string
  pageUrl: string
  source?: string
}

/** 쿠팡 제품 메인 사진 → Google Lens 시각적 유사 이미지 */
export async function serpGoogleLensVisualMatches(
  apiKey: string,
  imageUrl: string,
  limit = 24
): Promise<SerpLensMatch[]> {
  const url = imageUrl.trim()
  if (!url.startsWith("http://") && !url.startsWith("https://")) return []

  const u = new URL(SERP)
  u.searchParams.set("engine", "google_lens")
  u.searchParams.set("url", url)
  u.searchParams.set("type", "visual_matches")
  u.searchParams.set("hl", "ko")
  u.searchParams.set("api_key", apiKey)

  const r = await fetch(u.toString(), { next: { revalidate: 0 } })
  if (!r.ok) return []
  const data = (await r.json().catch(() => ({}))) as {
    error?: string
    visual_matches?: Array<{
      title?: string
      link?: string
      source?: string
      thumbnail?: string
      image?: string
    }>
  }
  if (data.error || !Array.isArray(data.visual_matches)) return []

  const out: SerpLensMatch[] = []
  const seen = new Set<string>()
  for (const row of data.visual_matches) {
    const image = (row.image || row.thumbnail || "").trim()
    if (!image.startsWith("http") || seen.has(image)) continue
    seen.add(image)
    out.push({
      title: (row.title || row.source || "유사 이미지").trim(),
      imageUrl: image,
      thumbnailUrl: (row.thumbnail || row.image || "").trim() || image,
      pageUrl: (row.link || image).trim(),
      source: row.source,
    })
    if (out.length >= limit) break
  }
  return out
}

export function dedupeVideoRows<T extends { url: string }>(rows: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const it of rows) {
    const yid = youtubeIdFromUrl(it.url)
    /** YouTube만 video id로 묶고, 그 외(특히 google.com/search?q=…)는 전체 URL로 구분해 MVP 검색 링크가 서로 삭제되지 않게 함 */
    const key = yid ? `yt:${yid}` : it.url.trim().toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(it)
  }
  return out
}
