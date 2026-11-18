/**
 * TikHub (https://api.tikhub.io) — 抖音·小红书·TikTok·YouTube Shorts 검색 + 워터마크 없는 원본 mp4 주소.
 * 응답 구조가 엔드포인트·버전마다 달라서, 응답 전체를 훑어 aweme(抖音/TikTok)·note(小红书) 객체를 찾는다.
 * 서버 전용.
 */

import type { SerpVideoRow } from "@/lib/serpapi-product-search"

const BASE = "https://api.tikhub.io"

export type TikhubPlatform = "douyin" | "xiaohongshu" | "tiktok" | "youtube"

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null

function walk(v: unknown, fn: (o: Obj) => boolean | void, seen = new Set<unknown>()): void {
  if (!isObj(v) || seen.has(v)) return
  seen.add(v)
  if (!Array.isArray(v) && fn(v) === true) return
  for (const child of Array.isArray(v) ? v : Object.values(v)) walk(child, fn, seen)
}

const firstUrl = (v: unknown): string | undefined => {
  if (!isObj(v)) return undefined
  const list = (v as { url_list?: unknown }).url_list
  return Array.isArray(list) && typeof list[0] === "string" ? list[0] : undefined
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null)

/** 小红书 CDN은 http로 오는 경우가 있어 프록시(https 전용)에 맞춘다 */
const toHttps = (u: string) => u.replace(/^http:\/\//i, "https://")

export function resolveTikhubKey(fromClient?: unknown): string {
  return (typeof fromClient === "string" && fromClient.trim()) || process.env.TIKHUB_API_KEY || ""
}

export class TikhubError extends Error {
  constructor(
    public status: number,
    body: string
  ) {
    super(`TikHub ${status}: ${body}`)
  }
}

export function tikhubErrorMessage(e: unknown): string {
  const status = e instanceof TikhubError ? e.status : 0
  const detail = e instanceof Error ? e.message : ""
  if (status === 402) return "TikHub 잔액이 부족합니다 (충전 필요)"
  if (/expired|过期|만료/i.test(detail)) {
    return "TikHub API 키가 만료되었습니다. TikHub에서 새 키를 발급받아 설정에 다시 저장해 주세요."
  }
  if (status === 401 || status === 403) return "TikHub API 키가 올바르지 않습니다"
  if (status === 400) {
    return "TikHub 일시 오류(400). 샤오홍슈는 TikHub 서버가 가끔 실패합니다. 다른 플랫폼으로 진행하거나 잠시 후 다시 검색하세요"
  }
  return `TikHub 요청 실패 (${status || (e instanceof Error ? e.message.slice(0, 80) : "알 수 없음")})`
}

async function call(key: string, pathAndQuery: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${BASE}${pathAndQuery}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(45_000),
    cache: "no-store",
  })
  if (!res.ok) throw new TikhubError(res.status, (await res.text().catch(() => "")).slice(0, 200))
  return res.json()
}

const qs = (o: Record<string, string | number>) =>
  new URLSearchParams(Object.entries(o).map(([k, v]) => [k, String(v)])).toString()

/** 抖音·TikTok 응답 속 aweme → 검색 행 (play_addr = 워터마크 없는 원본) */
export function extractAwemeRows(res: unknown, platform: "douyin" | "tiktok"): SerpVideoRow[] {
  const out = new Map<string, SerpVideoRow>()
  walk(res, (o) => {
    const id = o.aweme_id
    if ((typeof id !== "string" && typeof id !== "number") || !(isObj(o.video) || typeof o.desc === "string")) return
    const key = String(id)
    if (out.has(key)) return true
    const video = isObj(o.video) ? o.video : {}
    const author = isObj(o.author) ? o.author : {}
    const stats = isObj(o.statistics) ? o.statistics : {}
    const ms = num(video.duration)
    const authorId = typeof author.unique_id === "string" && author.unique_id ? author.unique_id : "user"
    out.set(key, {
      platform,
      title: typeof o.desc === "string" && o.desc.trim() ? o.desc.trim() : platform === "douyin" ? "抖音 영상" : "TikTok 영상",
      thumbnail: firstUrl(video.cover) ?? firstUrl(video.origin_cover) ?? "",
      videoUrl: firstUrl(video.play_addr) ?? firstUrl(video.play_addr_h264) ?? "",
      url:
        platform === "douyin"
          ? `https://www.douyin.com/video/${key}`
          : `https://www.tiktok.com/@${authorId}/video/${key}`,
      author: typeof author.nickname === "string" ? author.nickname : "",
      contentLength: "short",
      durationSec: ms == null ? null : ms > 1000 ? Math.round(ms / 100) / 10 : ms,
      likeCount: num(stats.digg_count),
      // 抖音 검색 응답은 play_count를 0으로 숨김 → 0은 「모름」으로 표시
      viewCount: num(stats.play_count) || null,
    })
    return true
  })
  return [...out.values()]
}

/** 小红书 영상 노트 상세/검색 객체에서 mp4 주소 */
export function findXhsVideoUrl(res: unknown): string | undefined {
  let found: string | undefined
  walk(res, (o) => {
    if (found) return true
    if (typeof o.master_url === "string" && o.master_url) {
      found = o.master_url
      return true
    }
  })
  if (!found) {
    walk(res, (o) => {
      if (found) return true
      if (typeof o.url === "string" && /\.mp4(\?|$)|sns-video/.test(o.url)) {
        found = o.url
        return true
      }
    })
  }
  return found ? toHttps(found) : undefined
}

/** 小红书 검색 응답 → 영상 노트 행 (검색 응답에 mp4가 없으면 videoUrl은 빈 값) */
export function extractXhsRows(res: unknown): SerpVideoRow[] {
  const out = new Map<string, SerpVideoRow>()
  walk(res, (o) => {
    const id = o.id ?? o.note_id
    const title = o.title ?? o.display_title ?? o.desc
    if (typeof id !== "string" || typeof o.type !== "string" || typeof title !== "string") return
    if (o.type === "video" && !out.has(id)) {
      const user = isObj(o.user) ? o.user : {}
      const images = Array.isArray(o.images_list) ? o.images_list : []
      const cover =
        isObj(images[0]) && typeof images[0].url === "string"
          ? images[0].url
          : isObj(o.cover) && typeof o.cover.url === "string"
            ? o.cover.url
            : isObj(o.cover) && typeof o.cover.url_default === "string"
              ? o.cover.url_default
              : ""
      const video = isObj(o.video_info_v2) ? o.video_info_v2 : isObj(o.video) ? o.video : null
      const capa = video && isObj(video.capa) ? video.capa : null
      const clock = typeof o.video_duration === "string" ? /^(\d+):(\d{2})$/.exec(o.video_duration) : null
      const durationRaw =
        num(o.duration) ??
        (capa ? num(capa.duration) : null) ??
        (clock ? Number(clock[1]) * 60 + Number(clock[2]) : null) ??
        (video ? num((video as Obj).duration) : null)
      out.set(id, {
        platform: "xiaohongshu",
        title: title.trim() || "小红书 영상",
        thumbnail: cover ? toHttps(cover) : "",
        videoUrl: video ? findXhsVideoUrl(video) ?? "" : "",
        url: `https://www.xiaohongshu.com/explore/${id}`,
        author:
          typeof user.nickname === "string" ? user.nickname : typeof user.nick_name === "string" ? user.nick_name : "",
        contentLength: "short",
        durationSec: durationRaw == null ? null : durationRaw > 1000 ? Math.round(durationRaw / 100) / 10 : durationRaw,
        likeCount: num(o.liked_count) ?? num(o.likes),
      })
    }
    return true
  })
  return [...out.values()]
}

/** 抖音·TikTok 상세 응답에서 워터마크 없는 재생 주소 */
export function findPlayUrl(res: unknown): string | undefined {
  let found: string | undefined
  walk(res, (o) => {
    if (found) return true
    const u = firstUrl(o.play_addr) ?? firstUrl(o.play_addr_h264)
    if (u) {
      found = u
      return true
    }
  })
  return found
}

/** "68K views" · "1.2M" · "474" → 숫자 */
function parseCount(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null
  if (typeof v !== "string") return null
  const m = /([\d.,]+)\s*([KMB])?/i.exec(v)
  if (!m) return null
  const n = Number(m[1]!.replace(/,/g, ""))
  const mul = ({ K: 1e3, M: 1e6, B: 1e9 } as Record<string, number>)[(m[2] ?? "").toUpperCase()] ?? 1
  return Number.isFinite(n) ? Math.round(n * mul) : null
}

const youtubeShortUrl = (id: string) => `https://www.youtube.com/shorts/${id}`

/** YouTube Shorts 검색 응답 → 행 (재생 주소는 별도 조회가 필요해 videoUrl은 빈 값) */
export function extractYoutubeShortRows(res: unknown): SerpVideoRow[] {
  const out = new Map<string, SerpVideoRow>()
  walk(res, (o) => {
    const id = o.video_id
    if (typeof id !== "string" || typeof o.title !== "string") return
    if (!out.has(id)) {
      const thumb = (Array.isArray(o.thumbnails) ? o.thumbnails : []).find(
        (t): t is Obj => isObj(t) && typeof t.url === "string"
      )
      out.set(id, {
        platform: "youtube",
        title: o.title.trim() || "YouTube Shorts",
        thumbnail: thumb ? String(thumb.url) : `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        videoUrl: "",
        url: youtubeShortUrl(id),
        author: typeof o.author === "string" ? o.author : "",
        contentLength: "short",
        durationSec: null,
        likeCount: null,
        viewCount: parseCount(o.view_count),
      })
    }
    return true
  })
  return [...out.values()]
}

/** 리믹스는 원본 소리를 쓰지 않으므로 영상 전용 H.264 mp4 를 우선 (720p → 1080p → 480p → 합본 360p) */
const YOUTUBE_ITAG_PREFERENCE = ["136", "137", "135", "22", "18"]

function pickYoutubeStream(res: unknown): { videoUrl: string; durationSec: number | null } | null {
  const byItag = new Map<string, string>()
  let durationSec: number | null = null
  walk(res, (o) => {
    if ((typeof o.itag === "number" || typeof o.itag === "string") && typeof o.url === "string" && o.url) {
      byItag.set(String(o.itag), o.url)
    }
    if (durationSec == null && o.length_seconds != null) durationSec = parseCount(o.length_seconds)
  })
  const itag = YOUTUBE_ITAG_PREFERENCE.find((i) => byItag.has(i))
  return itag ? { videoUrl: byItag.get(itag)!, durationSec } : null
}

export function parseTikhubContentId(url: string): { platform: TikhubPlatform; id: string } | null {
  let u: URL
  try {
    u = new URL(url.trim())
  } catch {
    return null
  }
  const h = u.hostname
  if (/(^|\.)(ies)?douyin\.com$/.test(h)) {
    const m = u.pathname.match(/\/(?:video|note|shipin)\/(\d+)/)
    const q = u.searchParams.get("modal_id")
    return m ? { platform: "douyin", id: m[1]! } : q ? { platform: "douyin", id: q } : null
  }
  if (/(^|\.)tiktok\.com$/.test(h)) {
    const m = u.pathname.match(/\/video\/(\d+)/)
    return m ? { platform: "tiktok", id: m[1]! } : null
  }
  if (/(^|\.)xiaohongshu\.com$/.test(h)) {
    const m = u.pathname.match(/\/(?:explore|discovery\/item)\/([0-9a-f]{16,})/i)
    return m ? { platform: "xiaohongshu", id: m[1]! } : null
  }
  if (/(^|\.)youtube\.com$/.test(h) || h === "youtu.be") {
    const id =
      h === "youtu.be"
        ? u.pathname.slice(1)
        : (u.pathname.match(/\/(?:shorts|embed|live)\/([\w-]{11})/)?.[1] ?? u.searchParams.get("v") ?? "")
    return /^[\w-]{11}$/.test(id) ? { platform: "youtube", id } : null
  }
  return null
}

/** 단축 링크(v.douyin.com, xhslink.com, vt.tiktok.com)는 리다이렉트를 따라가 원본 주소로 */
async function expandShortLink(url: string): Promise<string> {
  if (parseTikhubContentId(url)) return url
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15_000) })
    return res.url || url
  } catch {
    return url
  }
}

export type TikhubSearchResult = { rows: SerpVideoRow[]; httpCalls: number; keywordsUsed: string[]; warnings: string[] }

async function searchEach(
  keywords: string[],
  run: (keyword: string) => Promise<SerpVideoRow[]>
): Promise<TikhubSearchResult> {
  const settled = await Promise.allSettled(keywords.map(run))
  const rows: SerpVideoRow[] = []
  const warnings = new Set<string>()
  const used: string[] = []
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") {
      rows.push(...s.value)
      used.push(keywords[i]!)
    } else warnings.add(tikhubErrorMessage(s.reason))
  })
  if (!used.length && warnings.size) throw new Error([...warnings].join(" · "))
  return { rows, httpCalls: keywords.length, keywordsUsed: used, warnings: [...warnings] }
}

/** 抖音 1분 이하 영상 검색 */
export function searchDouyinOnTikhub(key: string, keywords: string[], page = 0): Promise<TikhubSearchResult> {
  return searchEach(keywords, async (keyword) =>
    extractAwemeRows(
      await call(key, "/api/v1/douyin/search/fetch_video_search_v2", {
        keyword,
        cursor: page * 20,
        sort_type: "0",
        publish_time: "0",
        filter_duration: "0-1",
        content_type: "1",
        search_id: "",
      }),
      "douyin"
    )
  )
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** 小红书 search_notes. 400은 TikHub 쪽 일시 장애가 많아 파라미터 폴백 + 재시도 */
async function callXhsSearchNotes(key: string, keyword: string, page: number): Promise<unknown> {
  const attempts: Array<Record<string, string | number>> = [
    { keyword, page, sort_type: "general", note_type: "不限", source: "explore_feed", ai_mode: 0 },
    { keyword, page, sort_type: "general", note_type: "视频笔记", source: "explore_feed", ai_mode: 0 },
    { keyword, page, sort_type: "popularity_descending", note_type: "不限", source: "explore_feed" },
  ]
  let lastErr: unknown
  for (const params of attempts) {
    for (let retry = 0; retry < 2; retry++) {
      try {
        return await call(key, `/api/v1/xiaohongshu/app_v2/search_notes?${qs(params)}`)
      } catch (e) {
        lastErr = e
        const status = e instanceof TikhubError ? e.status : 0
        if (status === 400 && retry === 0) {
          await sleep(600 + Math.floor(Math.random() * 400))
          continue
        }
        break
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Xiaohongshu search failed")
}

/** 小红书에서 영상 노트만 검색. 검색 응답에 mp4가 없는 노트는 상세 조회로 채운다 */
export async function searchXiaohongshuOnTikhub(key: string, keywords: string[], page = 1): Promise<TikhubSearchResult> {
  const result = await searchEach(keywords, async (keyword) => extractXhsRows(await callXhsSearchNotes(key, keyword, page)))
  const missing = result.rows.filter((r) => !r.videoUrl).slice(0, 12)
  await Promise.all(
    missing.map(async (row) => {
      const id = parseTikhubContentId(row.url)?.id
      if (!id) return
      row.videoUrl = (await resolveXhsVideoUrl(key, id).catch(() => undefined)) ?? ""
      result.httpCalls += 1
    })
  )
  return result
}

export function searchTiktokOnTikhub(key: string, keywords: string[], page = 0): Promise<TikhubSearchResult> {
  return searchEach(keywords, async (keyword) =>
    extractAwemeRows(
      await call(
        key,
        `/api/v1/tiktok/app/v3/fetch_video_search_result?${qs({ keyword, offset: page * 20, count: 20, sort_type: 0, publish_time: 0 })}`
      ),
      "tiktok"
    )
  )
}

export function searchYoutubeShortsOnTikhub(key: string, keywords: string[]): Promise<TikhubSearchResult> {
  return searchEach(keywords, async (keyword) =>
    extractYoutubeShortRows(await call(key, `/api/v1/youtube/web_v2/get_shorts_search_v2?${qs({ keyword })}`))
  )
}

async function resolveXhsVideoUrl(key: string, noteId: string): Promise<string | undefined> {
  return findXhsVideoUrl(await call(key, `/api/v1/xiaohongshu/app_v2/get_video_note_detail?${qs({ note_id: noteId })}`))
}

/** 노트 URL → 영상 정보(재생 mp4 포함). 만료된 CDN 주소 갱신에도 쓴다 */
export async function resolveTikhubVideo(key: string, rawUrl: string): Promise<SerpVideoRow | null> {
  const url = await expandShortLink(rawUrl)
  const c = parseTikhubContentId(url)
  if (!c || !key) return null
  if (c.platform === "xiaohongshu") {
    const res = await call(key, `/api/v1/xiaohongshu/app_v2/get_video_note_detail?${qs({ note_id: c.id })}`)
    const videoUrl = findXhsVideoUrl(res)
    if (!videoUrl) return null
    const meta = extractXhsRows(res)[0]
    return {
      ...(meta ?? { platform: "xiaohongshu", title: "小红书 영상", thumbnail: "", author: "" }),
      url: `https://www.xiaohongshu.com/explore/${c.id}`,
      videoUrl,
    } as SerpVideoRow
  }
  if (c.platform === "youtube") {
    const res = await call(key, `/api/v1/youtube/web_v2/get_video_streams_v2?${qs({ video_id: c.id })}`)
    const stream = pickYoutubeStream(res)
    if (!stream) return null
    const data = isObj(res) && isObj(res.data) ? res.data : {}
    return {
      platform: "youtube",
      title: typeof data.title === "string" && data.title.trim() ? data.title.trim() : "YouTube Shorts",
      thumbnail: `https://i.ytimg.com/vi/${c.id}/hqdefault.jpg`,
      author: typeof data.author === "string" ? data.author : "",
      url: youtubeShortUrl(c.id),
      contentLength: "short",
      ...stream,
    }
  }
  const endpoints =
    c.platform === "douyin"
      ? [`/api/v1/douyin/app/v3/fetch_one_video?${qs({ aweme_id: c.id })}`, `/api/v1/douyin/web/fetch_one_video?${qs({ aweme_id: c.id })}`]
      : [`/api/v1/tiktok/app/v3/fetch_one_video?${qs({ aweme_id: c.id })}`]
  let lastError: unknown = null
  for (const ep of endpoints) {
    try {
      const res = await call(key, ep)
      const row = extractAwemeRows(res, c.platform).find((r) => r.url.includes(c.id))
      const videoUrl = row?.videoUrl || findPlayUrl(res)
      if (videoUrl) {
        return {
          platform: c.platform,
          title: c.platform === "douyin" ? "抖音 영상" : "TikTok 영상",
          thumbnail: "",
          author: "",
          url,
          ...row,
          videoUrl,
        }
      }
    } catch (e) {
      lastError = e
    }
  }
  if (lastError) throw lastError
  return null
}

function topSearchQueries(priority: string[] | undefined, fallback: string[] | undefined, limit = 2): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of [...(priority ?? []), ...(fallback ?? [])]) {
    const text = raw.trim()
    const key = text.toLowerCase()
    if (!text || seen.has(key)) continue
    seen.add(key)
    out.push(text)
    if (out.length >= limit) break
  }
  return out
}

/**
 * 제품 검색·썰쇼핑이 쓰던 Apify 수집 자리.
 * 도우인·샤오홍슈·틱톡을 TikHub로 찾고, 플랫폼별 우선 검색어 2개만 쓴다.
 */
export async function collectTikhubShoppingCandidates(
  key: string,
  analysis: {
    searchQueries?: { tiktok?: string[]; xiaohongshu?: string[]; douyin?: string[] }
    serpPriorityQueries?: { tiktok?: string[]; xiaohongshu?: string[]; douyin?: string[] }
    productName?: string
  }
): Promise<{ rows: SerpVideoRow[]; httpCalls: number }> {
  const token = key.trim()
  if (!token) return { rows: [], httpCalls: 0 }
  const name = analysis.productName?.trim()
  const douyin = topSearchQueries(analysis.serpPriorityQueries?.douyin, analysis.searchQueries?.douyin)
  const xhs = topSearchQueries(analysis.serpPriorityQueries?.xiaohongshu, analysis.searchQueries?.xiaohongshu)
  const tiktok = topSearchQueries(
    analysis.serpPriorityQueries?.tiktok,
    analysis.searchQueries?.tiktok?.length ? analysis.searchQueries.tiktok : name ? [name] : []
  )
  const [dy, xh, tt] = await Promise.all([
    douyin.length ? searchDouyinOnTikhub(token, douyin) : Promise.resolve({ rows: [], httpCalls: 0, keywordsUsed: [], warnings: [] }),
    xhs.length ? searchXiaohongshuOnTikhub(token, xhs) : Promise.resolve({ rows: [], httpCalls: 0, keywordsUsed: [], warnings: [] }),
    tiktok.length ? searchTiktokOnTikhub(token, tiktok) : Promise.resolve({ rows: [], httpCalls: 0, keywordsUsed: [], warnings: [] }),
  ])
  const seen = new Set<string>()
  const rows: SerpVideoRow[] = []
  for (const row of [...dy.rows, ...xh.rows, ...tt.rows]) {
    const id = row.url.trim().toLowerCase()
    if (!id || seen.has(id)) continue
    seen.add(id)
    rows.push(row)
  }
  return { rows, httpCalls: dy.httpCalls + xh.httpCalls + tt.httpCalls }
}
