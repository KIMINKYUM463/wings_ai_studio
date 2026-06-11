/**
 * 제품 검색 — TikTok / 샤오홍슈 / 더우인 후보 수집용 Apify 호출 (서버 전용).
 * APIFY_TOKEN 또는 요청 body의 apifyApiKey 필요.
 *
 * 기본 Actor(환경변수로 교체 가능):
 * - TikTok: clockworks/tiktok-scraper
 * - 샤오홍슈(기본): **socialdatax/socialdatax-xhs-data-api** — search_notes · note_type=video
 *   RedNote는 **키워드 정확 일치**가 로그인·지역 제한인 경우가 있어 결과가 검색어와 다를 수 있음.
 * - 더우인(기본): **영상 검증 Actor 2개 병합** — `sian.agency/douyin-scraper` + `natanielsantos/douyin-scraper` 모두 호출 후 결과 합산(중복 URL 제거).
 *   `natanielsantos/douyin-scraper` 는 Apify 콘솔에서 **Full access 승인**이 있어야 할 수 있음(403 `full-permission-actor-not-approved`).
 *   `APIFY_DOUYIN_ACTOR` 로 단일 Actor만 지정 가능(화이트리스트 내).
 * - **TikTok**: 분석 풀에서 **통합 상위 2문구**.
 * - **샤오홍슈**: `serpPriorityQueries.xiaohongshu` → `searchQueries.xiaohongshu` 순 **전용 2문구**(부족 시 통합 TOP2 보강) — zhorex 등은 **간체 실검**에 맞춰야 해서 TikTok과 동일 통합만 넣으면 Apify는 0건·콘솔 수동 검색만 24건처럼 보일 수 있음.
 * - **더우인**: `serpPriorityQueries.douyin` → `searchQueries.douyin` 후 **샤오홍슈 간체 풀**을 이어 붙여 검색어 풀을 넓힘. sian.agency는 `maxPages`×~12건, natanielsantos는 `maxItemsPerUrl` — `APIFY_DOUYIN_COUNT` 로 조절.
 * - `APIFY_XHS_ACTOR` / `APIFY_DOUYIN_ACTOR` 로 교체 가능. `APIFY_XHS_PROFILE` / `APIFY_DOUYIN_PROFILE` 로 슬러그 추론 덮어쓰기.
 */

import { dedupeVideoRows, normalizeMediaDurationSec, type SerpVideoRow } from "@/lib/serpapi-product-search"

function pickDurationSecFromRaw(o: Record<string, unknown>): number | null {
  const tryField = (v: unknown): number | null =>
    normalizeMediaDurationSec(typeof v === "number" ? v : null)
  let d =
    tryField(o.duration) ??
    tryField(o.video_duration) ??
    tryField(o.videoDuration) ??
    tryField(o.video_time)
  const vm = o.videoMeta as Record<string, unknown> | undefined
  if (d == null && vm) d = tryField(vm.duration)
  const vid = o.video as Record<string, unknown> | undefined
  if (d == null && vid) d = tryField(vid.duration) ?? tryField(vid.duration_ms)
  const music = o.musicMeta as Record<string, unknown> | undefined
  if (d == null && music) d = tryField(music.duration)
  const noteCard = o.note_card as Record<string, unknown> | undefined
  if (d == null && noteCard) {
    const nv = noteCard.video as Record<string, unknown> | undefined
    if (nv) d = tryField(nv.duration) ?? tryField(nv.duration_ms)
  }
  return d
}
import {
  filterRowsByAnyKeyword,
  filterRowsByKeyword,
} from "@/lib/shotform-mvp-keyword-relevance"
import {
  DEFAULT_XHS_VIDEO_ACTOR,
  filterXhsVideoRows,
  isXhsVideoApifyActor,
  normalizeXhsVideoActorSlug,
  resolveXhsVideoActorChain,
} from "@/lib/apify-xhs-video-actors"

import {
  DEFAULT_DOUYIN_VIDEO_ACTOR,
  isDouyinVideoApifyActor,
  normalizeDouyinVideoActorSlug,
  resolveDouyinVideoActorChain,
} from "@/lib/apify-douyin-video-actors"

export { XHS_VIDEO_APIFY_ACTORS, DEFAULT_XHS_VIDEO_ACTOR } from "@/lib/apify-xhs-video-actors"
export { DOUYIN_VIDEO_APIFY_ACTORS, DEFAULT_DOUYIN_VIDEO_ACTOR } from "@/lib/apify-douyin-video-actors"

export type ApifySearchAnalysisShape = {
  searchQueries: { tiktok: string[]; xiaohongshu: string[]; douyin: string[] }
  serpPriorityQueries: { tiktok: string[]; xiaohongshu: string[]; douyin: string[] }
  productName: string
  targetKeywords?: string[]
  shoppingKeywords?: string[]
  searchFeatures?: string[]
  productTraits?: string[]
  category?: string
}

type XhsProfile =
  | "zen_rednote"
  | "dltik"
  | "datapilot"
  | "easyapi"
  | "easyapi_aio"
  | "kuaima"
  | "zhorex_rednote"
  | "socialdatax"
type DouyinProfile =
  | "zen_douyin"
  | "kuaima_douyin"
  | "cloudcharlestom"
  | "natanielsantos"
  | "sian_agency"
  | "automation_douyin_analytics"

function actorPathId(slug: string): string {
  const s = slug.trim()
  return s.includes("~") ? s : s.replace("/", "~")
}

async function apifyRunSyncGetDatasetItems(
  token: string,
  actorSlug: string,
  input: Record<string, unknown>,
  opts?: { timeoutSec?: number; maxItems?: number }
): Promise<unknown[]> {
  const pathId = actorPathId(actorSlug)
  const timeoutSec = opts?.timeoutSec ?? 180
  const url = new URL(`https://api.apify.com/v2/acts/${encodeURIComponent(pathId)}/run-sync-get-dataset-items`)
  url.searchParams.set("token", token)
  url.searchParams.set("timeout", String(timeoutSec))
  if (opts?.maxItems != null) url.searchParams.set("maxItems", String(opts.maxItems))
  const r = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(timeoutSec * 1000 + 120_000),
  })
  if (!r.ok) {
    const t = await r.text().catch(() => "")
    if (r.status === 403 && t.includes("actor-is-not-rented")) {
      console.warn(
        `[apify] ${actorSlug}: 403 actor-is-not-rented — 무료 체험 종료 후 해당 Actor를 Apify 콘솔에서 Rent/구독해야 합니다. ` +
          "렌탈 없이 쓰려면 `APIFY_XHS_ACTOR`·`APIFY_DOUYIN_ACTOR` 를 사용 가능한 다른 Store 슬러그(예: datapilot·dltik)로 바꾸세요."
      )
      try {
        const j = JSON.parse(t) as { error?: { message?: string } }
        if (typeof j?.error?.message === "string" && j.error.message.trim()) {
          console.warn(`[apify] ${actorSlug}: ${j.error.message.trim()}`)
        }
      } catch {
        /* ignore */
      }
      return []
    }
    if (r.status === 400 && t.includes("ABORTED")) {
      console.warn(
        `[apify] ${actorSlug}: run ABORTED (동기 대기 timeout 초과 가능). ` +
          "`APIFY_XHS_TIMEOUT_SEC` 늘리거나 `APIFY_XHS_MAX_RESULTS` 낮추기."
      )
    }
    if (r.status === 403 && t.includes("full-permission-actor-not-approved")) {
      try {
        const j = JSON.parse(t) as { error?: { data?: { approvalUrl?: string } } }
        const approval = j?.error?.data?.approvalUrl
        if (approval) console.warn(`[apify] ${actorSlug} needs account permission. Open: ${approval}`)
      } catch {
        /* ignore */
      }
      console.warn(
        `[apify] ${actorSlug}: Full access 승인이 필요한 Actor입니다. 콘솔 링크에서 승인하거나, ` +
          "`APIFY_DOUYIN_ACTOR=sian.agency/douyin-scraper` 또는 `natanielsantos/douyin-scraper` 로 바꾸세요."
      )
    }
    console.warn(`[apify] ${actorSlug} HTTP ${r.status}`, t.slice(0, 400))
    return []
  }
  const data = (await r.json().catch(() => null)) as unknown
  return Array.isArray(data) ? data : []
}

function normalizeMediaUrl(raw: string): string {
  const s = raw.trim()
  if (s.startsWith("//")) return `https:${s}`
  if (s.startsWith("http://")) return `https://${s.slice(7)}`
  return s
}

function pickStr(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === "string" && v.trim()) {
      const n = normalizeMediaUrl(v.trim())
      if (n.startsWith("http")) return n
    }
  }
  return ""
}

/** URL이 아닌 일반 텍스트 필드 */
function pickText(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return ""
}

function buildXhsExploreUrlFromNoteId(noteId: string): string {
  const id = noteId.trim().replace(/^note_/, "")
  if (!id || id.length < 12) return ""
  if (/^[0-9a-f]{16,32}$/i.test(id) || /^[a-zA-Z0-9_-]{16,32}$/.test(id)) {
    return `https://www.xiaohongshu.com/explore/${id}`
  }
  return ""
}

function mergeSocialdataxFlattenedVideo(o: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = {}
  if (o.video && typeof o.video === "object") Object.assign(merged, o.video as Record<string, unknown>)
  for (const [k, v] of Object.entries(o)) {
    if (k.startsWith("video_") && v != null && v !== "") merged[k.slice(6)] = v
  }
  return merged
}

function pickNum(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === "number" && Number.isFinite(v)) return Math.round(v)
    if (typeof v === "string" && /^\d+$/.test(v.trim())) return parseInt(v.trim(), 10)
  }
  return null
}

function pickStats(o: Record<string, unknown>): { viewCount: number | null; likeCount: number | null } {
  const stats =
    o.statistics && typeof o.statistics === "object"
      ? (o.statistics as Record<string, unknown>)
      : o.stats && typeof o.stats === "object"
        ? (o.stats as Record<string, unknown>)
        : null
  const viewCount =
    pickNum(o, ["playCount", "viewCount", "views", "play_count"]) ??
    (stats ? pickNum(stats, ["playCount", "viewCount", "play_count"]) : null)
  const likeCount =
    pickNum(o, ["diggCount", "likeCount", "likes", "digg_count", "likedCount", "liked_count", "like_count"]) ??
    (stats ? pickNum(stats, ["diggCount", "likeCount", "digg_count", "liked_count"]) : null)
  return { viewCount, likeCount }
}

function collectHttpStrings(obj: unknown, out: string[], depth = 0): void {
  if (depth > 10 || out.length > 80) return
  if (typeof obj === "string") {
    const n = normalizeMediaUrl(obj.trim())
    if (n.startsWith("http")) out.push(n)
    return
  }
  if (!obj || typeof obj !== "object") return
  if (Array.isArray(obj)) {
    for (const x of obj) collectHttpStrings(x, out, depth + 1)
    return
  }
  for (const v of Object.values(obj as Record<string, unknown>)) {
    collectHttpStrings(v, out, depth + 1)
  }
}

function isLikelyXhsImageUrl(url: string): boolean {
  if (/\.mp4(\?|$)/i.test(url)) return false
  if (/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url)) return true
  if (url.includes("sns-webpic") || url.includes("sns-img") || url.includes("imageView")) return true
  if (url.includes("xhscdn") && !url.includes("/sns-video")) return true
  return false
}

function pickThumbFromImagesArray(images: unknown[]): string {
  for (const im of images) {
    if (typeof im === "string") {
      const n = normalizeMediaUrl(im)
      if (n.startsWith("http")) return n
    } else if (im && typeof im === "object") {
      const hit = pickStr(im as Record<string, unknown>, [
        "url",
        "urlDefault",
        "url_default",
        "original",
        "thumb",
        "thumbnail",
        "cover",
      ])
      if (hit) return hit
    }
  }
  return ""
}

function pickThumbFromImageList(imageList: unknown[]): string {
  for (const row of imageList) {
    if (!row || typeof row !== "object") continue
    const o = row as Record<string, unknown>
    const direct = pickStr(o, ["url", "urlDefault", "url_default", "original", "thumb"])
    if (direct) return direct
    const infos = o.info_list
    if (Array.isArray(infos)) {
      for (const inf of infos) {
        if (inf && typeof inf === "object") {
          const u = pickStr(inf as Record<string, unknown>, ["url", "urlDefault", "url_default"])
          if (u) return u
        }
      }
    }
  }
  return ""
}

function parseMaybeJsonValue(raw: unknown): unknown | null {
  if (typeof raw !== "string") return raw ?? null
  const t = raw.trim()
  if (!t.startsWith("[") && !t.startsWith("{")) return null
  try {
    return JSON.parse(t) as unknown
  } catch {
    return null
  }
}

function enrichXhsRawForMediaPick(o: Record<string, unknown>): Record<string, unknown> {
  const enriched = { ...o }
  for (const key of [
    "images",
    "image_list",
    "imageList",
    "cover",
    "video",
    "note_card",
    "noteCard",
    "display_cover",
    "displayCover",
  ]) {
    const parsed = parseMaybeJsonValue(o[key])
    if (parsed != null) enriched[key] = parsed
  }
  return enriched
}

/** cover / images — 문자열 URL·JSON·객체·배열 */
function pickCoverFromUnknown(val: unknown): string {
  if (val == null) return ""
  if (typeof val === "string") {
    const t = val.trim()
    if (!t) return ""
    const parsed = parseMaybeJsonValue(t)
    if (parsed != null && parsed !== val) return pickCoverFromUnknown(parsed)
    const n = normalizeMediaUrl(t)
    if (!n.startsWith("http") || /\.mp4(\?|$)/i.test(n)) return ""
    return isLikelyXhsImageUrl(n) ? n : n.includes("xhscdn") && !n.includes("/sns-video") ? n : ""
  }
  if (Array.isArray(val)) {
    return pickThumbFromImagesArray(val) || pickThumbFromImageList(val)
  }
  if (typeof val === "object") {
    const o = val as Record<string, unknown>
    const direct = pickStr(o, [
      "url_default",
      "urlDefault",
      "url_pre",
      "urlPre",
      "url",
      "original",
      "thumb",
      "thumbnail",
      "cover",
      "coverUrl",
      "cover_url",
    ])
    if (direct) return direct
    const infos = o.info_list
    if (Array.isArray(infos)) {
      for (const inf of infos) {
        if (inf && typeof inf === "object") {
          const u = pickStr(inf as Record<string, unknown>, ["url", "url_default", "urlDefault"])
          if (u) return u
        }
      }
    }
  }
  return ""
}

/** socialdatax search_notes — video_*·cover 객체 등 평면 필드 */
function pickSocialdataxFlatThumbnail(o: Record<string, unknown>): string {
  for (const [k, v] of Object.entries(o)) {
    if (k.startsWith("video_") && /cover|thumb|poster|frame|webpic|image/i.test(k)) {
      const hit = pickCoverFromUnknown(v)
      if (hit) return hit
    }
  }
  for (const key of [
    "cover",
    "cover_image",
    "coverImage",
    "display_cover",
    "displayCover",
    "images",
    "image_list",
    "imageList",
    "note_card",
    "noteCard",
  ]) {
    const hit = pickCoverFromUnknown(o[key])
    if (hit) return hit
  }
  return ""
}

const SOCIALDATAX_XHS_ACTOR = "socialdatax/socialdatax-xhs-data-api"

/** 소스 검색과 동일 — socialdatax get_note_detail로 小红书 노트 영상 URL 조회 */
export async function resolveXhsNoteUrlViaApify(
  apifyToken: string,
  inputUrl: string
): Promise<{ noteUrl: string; videoUrl: string; title: string }> {
  const { normalizeXhsNoteUrl } = await import("@/lib/xhs-video")
  const noteUrl = normalizeXhsNoteUrl(inputUrl)
  const detail = await fetchSocialdataxNoteDetailRaw(apifyToken.trim(), noteUrl)
  if (!detail) {
    throw new Error("小红书 노트를 Apify에서 조회하지 못했습니다.")
  }
  const mapped = mapSocialdataxXhsItem(detail)
  const play = mapped?.videoUrl?.trim()
  if (!play?.startsWith("http")) {
    throw new Error("이 노트는 재생 가능한 영상이 없습니다. (이미지 전용 노트이거나 비공개일 수 있습니다)")
  }
  return {
    noteUrl: mapped?.url?.startsWith("http") ? mapped.url : noteUrl,
    videoUrl: play,
    title: mapped?.title?.trim() || "(小红书 노트)",
  }
}

async function fetchSocialdataxNoteDetailRaw(
  token: string,
  noteUrl: string
): Promise<Record<string, unknown> | null> {
  const url = noteUrl.trim()
  if (!url.includes("xiaohongshu")) return null
  const input = {
    operation: "get_note_detail",
    note_url: url,
    max_items: 1,
    auto_paginate: false,
  }
  const items = await apifyRunSyncGetDatasetItems(token, SOCIALDATAX_XHS_ACTOR, input, {
    timeoutSec: Math.min(120, Math.max(45, Number(process.env.APIFY_XHS_NOTE_DETAIL_TIMEOUT_SEC || 90) || 90)),
    maxItems: 2,
  })
  for (const it of items) {
    if (!it || typeof it !== "object") continue
    const o = it as Record<string, unknown>
    if (o.empty_page === true) continue
    return o
  }
  return null
}

/** search_notes에 cover가 없을 때 get_note_detail로 썸네일 보강 (Apify 과금 — 검색 1회당 최대 N건) */
async function enrichSocialdataxMissingThumbnails(token: string, rows: SerpVideoRow[]): Promise<void> {
  if (process.env.APIFY_XHS_ENRICH_THUMBNAILS === "0") return
  const maxRaw = Number(process.env.APIFY_XHS_THUMB_ENRICH_MAX || 20)
  const maxEnrich = Math.min(36, Math.max(0, Number.isFinite(maxRaw) ? maxRaw : 20))
  if (maxEnrich <= 0) return

  const need = rows.filter(
    (r) => !r.thumbnail?.startsWith("http") && r.url?.includes("xiaohongshu.com/explore/")
  )
  if (need.length === 0) return

  const concurrency = Math.min(4, Math.max(1, Number(process.env.APIFY_XHS_THUMB_ENRICH_CONCURRENCY || 3) || 3))
  const targets = need.slice(0, maxEnrich)
  let enriched = 0

  for (let i = 0; i < targets.length; i += concurrency) {
    const batch = targets.slice(i, i + concurrency)
    await Promise.all(
      batch.map(async (row) => {
        try {
          const detail = await fetchSocialdataxNoteDetailRaw(token, row.url)
          if (!detail) return
          const merged = enrichXhsRawForMediaPick({
            ...detail,
            video: mergeSocialdataxFlattenedVideo(detail),
          })
          const thumb =
            pickSocialdataxFlatThumbnail(detail) ||
            pickXhsThumbnailFromRaw(merged) ||
            pickCoverFromUnknown(detail.images) ||
            pickCoverFromUnknown(detail.cover)
          if (thumb.startsWith("http")) {
            row.thumbnail = thumb
            enriched++
          }
        } catch {
          /* skip */
        }
      })
    )
  }

  if (enriched > 0) {
    console.info(`[apify] socialdatax: note_detail로 썸네일 ${enriched}/${targets.length}건 보강`)
  }
}

/** socialdatax/socialdatax-xhs-data-api — search_notes 평면·video_*·JSON 필드 */
function mapSocialdataxXhsItem(raw: unknown): SerpVideoRow | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  if (o.empty_page === true) return null

  const noteIdRaw =
    pickText(o, ["note_id", "noteId"]) ||
    (typeof o.id === "string" && !o.item_index && o.id.trim() ? o.id.trim() : "")

  let url =
    pickStr(o, ["note_url", "noteUrl", "url", "link", "share_url", "shareUrl", "web_url", "webUrl"]) ||
    buildXhsExploreUrlFromNoteId(noteIdRaw)
  if (url && !url.includes("xiaohongshu.com") && !url.includes("xhslink.com")) {
    url = ""
  }

  const title =
    pickText(o, [
      "display_title",
      "displayTitle",
      "title",
      "note_title",
      "noteTitle",
      "desc",
      "description",
      "content",
    ]) || "(제목 없음)"

  let author = pickText(o, [
    "author_name",
    "authorName",
    "author_nickname",
    "authorNickname",
    "nickname",
    "user_name",
    "userName",
  ])
  if (!author && o.author && typeof o.author === "object") {
    author = pickText(o.author as Record<string, unknown>, ["name", "nickname", "nickName", "username"])
  }
  if (!author) author = "小红书"

  const enriched = enrichXhsRawForMediaPick({ ...o, video: mergeSocialdataxFlattenedVideo(o) })
  let thumb =
    pickSocialdataxFlatThumbnail(o) ||
    pickXhsThumbnailFromRaw(enriched) ||
    pickStr(o, [
      "cover_url",
      "coverUrl",
      "cover_image_url",
      "coverImageUrl",
      "video_cover",
      "videoCover",
      "video_cover_url",
      "videoCoverUrl",
      "video_poster",
      "videoPoster",
      "video_first_frame",
      "videoFirstFrame",
      "display_cover",
      "displayCover",
      "cover",
    ])
  if (!thumb) {
    for (const [k, v] of Object.entries(o)) {
      if (typeof v !== "string" || !v.trim()) continue
      if (!/cover|thumb|webpic|image/i.test(k)) continue
      const n = normalizeMediaUrl(v.trim())
      if (n.startsWith("http") && isLikelyXhsImageUrl(n)) {
        thumb = n
        break
      }
    }
  }

  let play =
    pickXhsPlayUrlFromRaw(enriched) ||
    pickStr(o, [
      "video_url",
      "videoUrl",
      "video_play_url",
      "video_play_url_720",
      "video_master_url",
      "video_addr",
      "media_url",
      "play_url",
      "playUrl",
    ])
  if (!play) {
    for (const [k, v] of Object.entries(o)) {
      if (typeof v !== "string" || !v.trim()) continue
      if (!/^video_/i.test(k) && !/play|mp4|stream/i.test(k)) continue
      const n = normalizeMediaUrl(v.trim())
      if (n.startsWith("http") && (/\.mp4(\?|$)/i.test(n) || n.includes("sns-video"))) {
        play = n
        break
      }
    }
  }

  if (!url && !play) return null

  const { viewCount, likeCount } = pickStats(o)
  return {
    platform: "xiaohongshu",
    title,
    thumbnail: thumb,
    videoUrl: play,
    url: url ? url.split("?")[0] || url : "",
    author,
    contentLength: "unknown",
    durationSec: pickDurationSecFromRaw(o),
    viewCount,
    likeCount,
  }
}

/** 小红书 Actor raw item — cover / images / note_card / deep scan */
export function pickXhsThumbnailFromRaw(o: Record<string, unknown>): string {
  const src = enrichXhsRawForMediaPick(o)
  let thumb = pickStr(src, [
    "coverUrl",
    "cover_url",
    "cover",
    "cover_image",
    "coverImage",
    "cover_image_url",
    "coverImageUrl",
    "video_cover",
    "videoCover",
    "video_cover_url",
    "videoCoverUrl",
    "video_poster",
    "video_first_frame",
    "videoFirstFrame",
    "display_cover",
    "thumbnail",
    "thumb",
    "imageUrl",
    "image_url",
    "picUrl",
    "pic_url",
    "image",
  ])
  if (thumb) return thumb

  const noteCard = (src.note_card ?? src.noteCard ?? src.note) as Record<string, unknown> | undefined
  if (noteCard && typeof noteCard === "object") {
    thumb = pickStr(noteCard, ["cover", "coverUrl", "cover_image", "coverImage", "thumbnail"])
    if (!thumb) {
      const cover = noteCard.cover ?? noteCard.cover_image ?? noteCard.coverImage
      if (cover && typeof cover === "object") {
        thumb = pickStr(cover as Record<string, unknown>, [
          "url_default",
          "urlDefault",
          "url",
          "url_pre",
          "urlPre",
          "info_list",
        ])
      }
    }
    if (!thumb && Array.isArray(noteCard.image_list)) {
      thumb = pickThumbFromImageList(noteCard.image_list)
    }
    if (!thumb && Array.isArray(noteCard.images)) {
      thumb = pickThumbFromImagesArray(noteCard.images)
    }
  }

  if (!thumb && Array.isArray(src.images)) thumb = pickThumbFromImagesArray(src.images)
  if (!thumb && Array.isArray(src.image_list)) thumb = pickThumbFromImageList(src.image_list)

  const vid = src.video
  if (!thumb && vid && typeof vid === "object") {
    thumb = pickStr(vid as Record<string, unknown>, ["poster", "cover", "coverUrl", "thumb"])
  }

  const nested = (src.data ?? src.item ?? src.note_detail ?? src.noteDetail) as Record<string, unknown> | undefined
  if (!thumb && nested && typeof nested === "object") {
    thumb = pickXhsThumbnailFromRaw(nested)
  }

  if (!thumb) {
    const urls: string[] = []
    collectHttpStrings(src, urls)
    thumb =
      urls.find(isLikelyXhsImageUrl) ||
      urls.find((u) => u.includes("xhscdn") && !u.includes(".mp4")) ||
      ""
  }

  return thumb
}

function pickXhsPlayUrlFromRaw(o: Record<string, unknown>): string {
  let play = pickStr(o, ["videoUrl", "mediaUrl", "playUrl", "play_url", "videoAddress", "mp4Url"])
  const vid = o.video
  if (!play && vid && typeof vid === "object") {
    play = pickStr(vid as Record<string, unknown>, [
      "url_1080p",
      "url_720p",
      "url_540p",
      "url_360p",
      "url",
      "playUrl",
      "play_url",
      "masterUrl",
      "master_url",
      "downloadUrl",
    ])
  }
  if (!play) {
    const urls: string[] = []
    collectHttpStrings(o, urls)
    play = urls.find((u) => /\.mp4(\?|$)/i.test(u) || u.includes("/sns-video")) || ""
  }
  return play
}

function mapTiktokItem(raw: unknown): SerpVideoRow | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const url = pickStr(o, ["webVideoUrl", "videoUrl", "url"])
  if (!url || !url.includes("tiktok.com")) return null
  const text = typeof o.text === "string" ? o.text.trim() : ""
  const vm = o.videoMeta as Record<string, unknown> | undefined
  const thumb =
    (vm && typeof vm.coverUrl === "string" && vm.coverUrl) ||
    (vm && typeof vm.originalCoverUrl === "string" && vm.originalCoverUrl) ||
    ""
  const am = o.authorMeta as Record<string, unknown> | undefined
  const nick = am && typeof am.nickName === "string" ? am.nickName.trim() : ""
  const name = am && typeof am.name === "string" ? am.name.trim() : ""
  const author = nick || name || "TikTok"
  let durSec: number | undefined
  if (vm && typeof vm.duration === "number" && Number.isFinite(vm.duration)) durSec = vm.duration
  const contentLength =
    durSec == null ? ("unknown" as const) : durSec <= 180 ? ("short" as const) : ("long" as const)
  const { viewCount, likeCount } = pickStats(o)
  return {
    platform: "tiktok",
    title: text || "(제목 없음)",
    thumbnail: thumb,
    videoUrl: "",
    url,
    author,
    contentLength,
    durationSec: durSec != null ? normalizeMediaDurationSec(durSec) : null,
    viewCount,
    likeCount,
  }
}

/** kuaima/xiaohongshu-search 등 평면 레코드 (href + title) */
function mapKuaimaFlatXhsItem(raw: unknown): SerpVideoRow | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const href =
    (typeof o.href === "string" && o.href.trim()) ||
    (typeof o.link === "string" && o.link.trim()) ||
    (typeof o.url === "string" && o.url.trim()) ||
    ""
  if (!href.includes("xiaohongshu.com")) return null
  const title = typeof o.title === "string" ? o.title.trim() : ""
  const author =
    (typeof o.author === "string" && o.author.trim()) ||
    (typeof o.author_name === "string" && o.author_name.trim()) ||
    "小红书"
  let thumb = ""
  if (typeof o.author_avatar === "string" && o.author_avatar.startsWith("http")) thumb = o.author_avatar
  return {
    platform: "xiaohongshu",
    title: title || "(제목 없음)",
    thumbnail: thumb,
    videoUrl: "",
    url: href.split("?")[0] || href,
    author,
    contentLength: "unknown",
    durationSec: pickDurationSecFromRaw(o),
  }
}

/** zhorex/rednote-xiaohongshu-scraper — README: postUrl·postId·title·images[]·author{nickname} 등 */
function mapZhorexRednoteXhsItem(raw: unknown): SerpVideoRow | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const rawHref =
    (typeof o.postUrl === "string" && o.postUrl.trim()) ||
    (typeof o.url === "string" && o.url.trim()) ||
    (typeof o.noteUrl === "string" && o.noteUrl.trim()) ||
    (typeof o.link === "string" && o.link.trim()) ||
    ""
  const postId = typeof o.postId === "string" ? o.postId.trim() : ""
  let href = rawHref.startsWith("//") ? `https:${rawHref}` : rawHref
  if (!href && postId.length >= 16 && /^[0-9a-f]+$/i.test(postId)) {
    href = `https://www.xiaohongshu.com/explore/${postId}`
  }
  if (!href) return null
  if (!href.includes("xiaohongshu.com") && !href.includes("xhslink.com")) return null
  const title =
    (typeof o.title === "string" && o.title.trim()) ||
    (typeof o.noteTitle === "string" && o.noteTitle.trim()) ||
    (typeof o.desc === "string" && o.desc.trim()) ||
    "(제목 없음)"
  let author =
    (typeof o.authorName === "string" && o.authorName.trim()) ||
    (typeof o.authorNickname === "string" && o.authorNickname.trim()) ||
    (typeof o.author === "string" && o.author.trim()) ||
    ""
  if (!author && o.author && typeof o.author === "object") {
    const au = o.author as Record<string, unknown>
    author =
      (typeof au.nickname === "string" && au.nickname.trim()) ||
      (typeof au.nickName === "string" && au.nickName.trim()) ||
      (typeof au.name === "string" && au.name.trim()) ||
      ""
  }
  if (!author) author = "小红书"
  const thumb = pickXhsThumbnailFromRaw(o)
  const play = pickXhsPlayUrlFromRaw(o)
  const { viewCount, likeCount } = pickStats(o)
  return {
    platform: "xiaohongshu",
    title: title || "(제목 없음)",
    thumbnail: thumb,
    videoUrl: play,
    url: href.split("?")[0] || href,
    author,
    contentLength: "unknown",
    durationSec: pickDurationSecFromRaw(o),
    viewCount,
    likeCount,
  }
}

/** zen RedNote 형 평면 JSON(url·title·author·images[]·video) — zhorex 등 다른 프로필에서 출력 호환 시 폴백 */
function mapZenRednoteXhsItem(raw: unknown): SerpVideoRow | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const url = typeof o.url === "string" ? o.url.trim() : ""
  if (!url.includes("xiaohongshu.com")) return null
  const title =
    (typeof o.title === "string" && o.title.trim()) ||
    (typeof o.desc === "string" && o.desc.trim()) ||
    (typeof o.noteTitle === "string" && o.noteTitle.trim()) ||
    "(제목 없음)"
  const au = o.author as Record<string, unknown> | undefined
  const author =
    (typeof o.authorNickname === "string" && o.authorNickname.trim()) ||
    (au && typeof au.nickname === "string" && au.nickname.trim()) ||
    (au && typeof au.name === "string" && au.name.trim()) ||
    "小红书"
  const thumb = pickXhsThumbnailFromRaw(o)
  const play = pickXhsPlayUrlFromRaw(o)
  return {
    platform: "xiaohongshu",
    title: title || "(제목 없음)",
    thumbnail: thumb,
    videoUrl: play,
    url: url.split("?")[0] || url,
    author,
    contentLength: "unknown",
    durationSec: pickDurationSecFromRaw(o),
  }
}

function mapDatapilotXhsItem(raw: unknown): SerpVideoRow | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const it = o.item as Record<string, unknown> | undefined
  if (!it || typeof it.id !== "string" || !it.id.trim()) return null
  const id = it.id.trim()
  const noteUrl = `https://www.xiaohongshu.com/explore/${id}`
  const title = typeof it.title === "string" ? it.title.trim() : "(제목 없음)"
  const authorObj = it.author as Record<string, unknown> | undefined
  const author =
    (authorObj && typeof authorObj.username === "string" && authorObj.username.trim()) ||
    (authorObj && typeof authorObj.nickName === "string" && authorObj.nickName.trim()) ||
    "小红书"
  const thumb = pickXhsThumbnailFromRaw(it)
  const play = pickXhsPlayUrlFromRaw(it)
  return {
    platform: "xiaohongshu",
    title: title || "(제목 없음)",
    thumbnail: thumb,
    videoUrl: play,
    url: noteUrl,
    author,
    contentLength: "unknown",
    durationSec: pickDurationSecFromRaw(it),
  }
}

function mapXhsDatasetItem(raw: unknown, profile: XhsProfile): SerpVideoRow | null {
  if (profile === "zen_rednote") {
    return mapZenRednoteXhsItem(raw) ?? mapDatapilotXhsItem(raw) ?? mapKuaimaFlatXhsItem(raw)
  }
  if (profile === "dltik") {
    return mapDatapilotXhsItem(raw) ?? mapZenRednoteXhsItem(raw) ?? mapKuaimaFlatXhsItem(raw)
  }
  if (profile === "zhorex_rednote") {
    return mapZhorexRednoteXhsItem(raw) ?? mapZenRednoteXhsItem(raw) ?? mapKuaimaFlatXhsItem(raw) ?? mapDatapilotXhsItem(raw)
  }
  if (profile === "socialdatax") {
    return (
      mapSocialdataxXhsItem(raw) ??
      mapZenRednoteXhsItem(raw) ??
      mapZhorexRednoteXhsItem(raw) ??
      mapDatapilotXhsItem(raw) ??
      mapKuaimaFlatXhsItem(raw)
    )
  }
  if (profile === "easyapi_aio" || profile === "easyapi") {
    return mapZenRednoteXhsItem(raw) ?? mapKuaimaFlatXhsItem(raw) ?? mapDatapilotXhsItem(raw)
  }
  return mapDatapilotXhsItem(raw) ?? mapKuaimaFlatXhsItem(raw) ?? mapZenRednoteXhsItem(raw)
}

function isLikelyDouyinImageUrl(url: string): boolean {
  if (/\.mp4(\?|$)/i.test(url)) return false
  if (/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url)) return true
  if (url.includes("douyinpic.com") || url.includes("cover") || url.includes("thumb")) return true
  return false
}

/** 抖音 Actor raw item — cover / videoMeta / video 객체 */
export function pickDouyinThumbnailFromRaw(o: Record<string, unknown>): string {
  let thumb = pickStr(o, [
    "thumb",
    "cover",
    "coverUrl",
    "coverImageUrl",
    "thumbnail",
    "dynamicCover",
    "originCover",
    "dynamic_cover",
    "origin_cover",
  ])
  if (thumb) return thumb

  const vm = o.videoMeta as Record<string, unknown> | undefined
  if (vm) {
    thumb = pickStr(vm, ["cover", "originCover", "dynamicCover", "origin_cover", "dynamic_cover"])
    if (thumb) return thumb
  }

  const vid = o.video as Record<string, unknown> | undefined
  if (vid) {
    thumb = pickStr(vid, ["cover", "dynamic_cover", "origin_cover", "poster", "thumb"])
    if (thumb) return thumb
  }

  const nested = (o.data ?? o.item ?? o.aweme_detail) as Record<string, unknown> | undefined
  if (nested && typeof nested === "object") {
    thumb = pickDouyinThumbnailFromRaw(nested)
    if (thumb) return thumb
  }

  const urls: string[] = []
  collectHttpStrings(o, urls)
  return (
    urls.find(isLikelyDouyinImageUrl) ||
    urls.find((u) => u.includes("douyinpic.com") && !u.includes(".mp4")) ||
    ""
  )
}

export function pickDouyinPlayUrlFromRaw(o: Record<string, unknown>): string {
  let play = pickStr(o, ["videoUrl", "playUrl", "play_url", "downloadUrl"])
  const vm = o.videoMeta as Record<string, unknown> | undefined
  if (!play && vm) {
    play = pickStr(vm, ["playUrl", "downloadUrl", "playUrlH264", "playUrlH265", "playUrlLowBitrate"])
  }
  const vid = o.video as Record<string, unknown> | undefined
  if (!play && vid) {
    play = pickStr(vid, ["playAddr", "play_addr", "download_addr", "playUrl", "video_url", "url"])
  }
  if (!play) {
    const urls: string[] = []
    collectHttpStrings(o, urls)
    play = urls.find((u) => /\.mp4(\?|$)/i.test(u) || u.includes("douyinvod")) || ""
  }
  return play
}

/** natanielsantos·zen-studio/douyin-search-scraper 등 (text/url/thumb/authorMeta/videoMeta, Zen은 id·caption·shareUrl 평면 필드) */
function mapNatanielDouyinItem(raw: unknown): SerpVideoRow | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  let url = typeof o.url === "string" ? o.url.trim() : ""
  if (!url.includes("douyin.com") && !url.includes("iesdouyin.com")) {
    const idRaw =
      (typeof o.id === "string" && o.id.trim()) ||
      (typeof o.groupId === "string" && o.groupId.trim()) ||
      (typeof o.aweme_id === "string" && o.aweme_id.trim()) ||
      (typeof o.videoId === "string" && o.videoId.trim()) ||
      ""
    if (/^\d{10,22}$/.test(idRaw)) url = `https://www.douyin.com/video/${idRaw}`
  }
  if (!url.includes("douyin.com") && !url.includes("iesdouyin.com")) {
    const su = typeof o.shareUrl === "string" ? o.shareUrl.trim() : ""
    if (su.includes("douyin.com") || su.includes("iesdouyin.com") || su.includes("v.douyin.com")) url = su
  }
  if (!url.includes("douyin.com") && !url.includes("iesdouyin.com") && !url.includes("v.douyin.com")) return null
  const title =
    (typeof o.text === "string" && o.text.trim()) ||
    (typeof o.caption === "string" && o.caption.trim()) ||
    (typeof o.previewTitle === "string" && o.previewTitle.trim()) ||
    (typeof o.desc === "string" && o.desc.trim()) ||
    ""
  const am = o.authorMeta as Record<string, unknown> | undefined
  const author =
    (am && typeof am.name === "string" && am.name.trim()) ||
    (am && typeof am.nickName === "string" && am.nickName.trim()) ||
    (am && typeof am.nickname === "string" && am.nickname.trim()) ||
    "抖音"
  const vm = o.videoMeta as Record<string, unknown> | undefined
  const thumb = pickDouyinThumbnailFromRaw(o)
  let play = pickDouyinPlayUrlFromRaw(o)
  const music = o.musicMeta as Record<string, unknown> | undefined
  let dur: number | undefined
  if (vm && typeof vm.duration === "number" && Number.isFinite(vm.duration)) {
    const vd = vm.duration
    dur = vd >= 500 ? vd / 1000 : vd
  }
  if ((dur == null || !Number.isFinite(dur)) && music && typeof music.duration === "number" && Number.isFinite(music.duration)) {
    dur = music.duration
  }
  const contentLength =
    dur == null || !Number.isFinite(dur) ? ("unknown" as const) : dur <= 180 ? ("short" as const) : ("long" as const)
  const { viewCount, likeCount } = pickStats(o)
  return {
    platform: "douyin",
    title: title || "(제목 없음)",
    thumbnail: thumb,
    videoUrl: play,
    url: url.split("?")[0] || url,
    author,
    contentLength,
    durationSec: dur != null ? normalizeMediaDurationSec(dur) : null,
    viewCount,
    likeCount,
  }
}

function mapCloudcharlestomDouyinItem(raw: unknown): SerpVideoRow | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const pageUrl = typeof o.url === "string" ? o.url.trim() : ""
  const share = o.share_info as Record<string, unknown> | undefined
  const shareUrl = share && typeof share.share_url === "string" ? share.share_url.trim() : ""
  let url = ""
  if (
    pageUrl.startsWith("http") &&
    (pageUrl.includes("douyin.com") || pageUrl.includes("iesdouyin.com") || pageUrl.includes("v.douyin.com"))
  ) {
    url = pageUrl
  } else if (shareUrl.startsWith("http")) {
    url = shareUrl
  }
  if (!url) return null
  const desc = typeof o.desc === "string" ? o.desc.trim() : ""
  const au = o.author as Record<string, unknown> | undefined
  const author = au && typeof au.nickname === "string" ? au.nickname.trim() : "抖音"
  const vid = o.video as Record<string, unknown> | undefined
  const thumb = pickDouyinThumbnailFromRaw(o)
  const vdur = vid && typeof vid.duration === "number" ? vid.duration : undefined
  let sec: number | undefined
  if (vdur != null && Number.isFinite(vdur)) {
    sec = vdur >= 1000 ? vdur / 1000 : vdur
  }
  const contentLength = sec == null ? "unknown" : sec <= 180 ? "short" : "long"
  const play = pickDouyinPlayUrlFromRaw(o)
  return {
    platform: "douyin",
    title: desc || "(제목 없음)",
    thumbnail: thumb,
    videoUrl: play,
    url,
    author,
    contentLength,
    durationSec: sec != null ? normalizeMediaDurationSec(sec) : null,
  }
}

function mapAutomationLabDouyinItem(raw: unknown): SerpVideoRow | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  /** trending 등 비영상 행은 목록에 넣지 않음 */
  if (typeof o.type === "string" && o.type === "trending") return null
  let pageUrl = typeof o.url === "string" ? o.url.trim() : ""
  if (!pageUrl && typeof o.share_url === "string") pageUrl = o.share_url.trim()
  if (!pageUrl && typeof o.videoUrl === "string") {
    const vu = o.videoUrl.trim()
    if (
      vu.includes("douyin.com/video/") ||
      vu.includes("iesdouyin.com") ||
      vu.includes("v.douyin.com")
    ) {
      pageUrl = vu
    }
  }
  if (!pageUrl && typeof o.aweme_id === "string" && o.aweme_id.trim()) {
    pageUrl = `https://www.douyin.com/video/${o.aweme_id.trim()}`
  }
  if (!pageUrl && typeof o.awemeId === "string" && o.awemeId.trim()) {
    pageUrl = `https://www.douyin.com/video/${o.awemeId.trim()}`
  }
  /** automation-lab search 모드: videoId만 있고 url 없음 (문서 예시) */
  if (!pageUrl && typeof o.videoId === "string" && o.videoId.trim()) {
    pageUrl = `https://www.douyin.com/video/${o.videoId.trim()}`
  }
  if (
    !pageUrl ||
    (!pageUrl.includes("douyin.com") &&
      !pageUrl.includes("iesdouyin.com") &&
      !pageUrl.includes("v.douyin.com"))
  ) {
    return null
  }
  const title =
    (typeof o.description === "string" && o.description.trim()) ||
    (typeof o.title === "string" && o.title.trim()) ||
    (typeof o.desc === "string" && o.desc.trim()) ||
    (typeof o.text === "string" && o.text.trim()) ||
    "(제목 없음)"
  const au = o.author as Record<string, unknown> | undefined
  const author =
    (typeof o.authorNickname === "string" && o.authorNickname.trim()) ||
    (typeof o.authorName === "string" && o.authorName.trim()) ||
    (typeof o.nickname === "string" && o.nickname.trim()) ||
    (au && typeof au.nickname === "string" && au.nickname.trim()) ||
    "抖音"
  const thumb = pickDouyinThumbnailFromRaw(o)
  const play = pickDouyinPlayUrlFromRaw(o)
  let durSec: number | undefined
  if (typeof o.duration === "number" && Number.isFinite(o.duration)) durSec = o.duration
  const contentLength =
    durSec == null ? ("unknown" as const) : durSec <= 180 ? ("short" as const) : ("long" as const)
  return {
    platform: "douyin",
    title: title || "(제목 없음)",
    thumbnail: thumb,
    videoUrl: play,
    url: pageUrl.split("?")[0] || pageUrl,
    author,
    contentLength,
    durationSec: durSec != null ? normalizeMediaDurationSec(durSec) : null,
  }
}

function mapDouyinDatasetItem(raw: unknown, profile: DouyinProfile): SerpVideoRow | null {
  if (profile === "automation_douyin_analytics") {
    return (
      mapNatanielDouyinItem(raw) ??
      mapCloudcharlestomDouyinItem(raw) ??
      mapAutomationLabDouyinItem(raw)
    )
  }
  if (profile === "sian_agency" || profile === "natanielsantos") {
    return mapNatanielDouyinItem(raw) ?? mapCloudcharlestomDouyinItem(raw)
  }
  if (profile === "zen_douyin" || profile === "kuaima_douyin") {
    return mapNatanielDouyinItem(raw) ?? mapCloudcharlestomDouyinItem(raw)
  }
  return mapCloudcharlestomDouyinItem(raw) ?? mapNatanielDouyinItem(raw)
}

const DEFAULT_TIKTOK_ACTOR = "clockworks/tiktok-scraper"
const DEFAULT_XHS_PRIMARY_ACTOR = DEFAULT_XHS_VIDEO_ACTOR
const DEFAULT_DOUYIN_PRIMARY_ACTOR = DEFAULT_DOUYIN_VIDEO_ACTOR

/** Apify 실제 슬러그는 `…-scraper`. 오타 보정 + zen RedNote 미사용(zhorex로 치환) */
function normalizeXhsActorSlug(slug: string): string {
  const t = slug.trim()
  const lower = t.toLowerCase()
  if (lower === "zhorex/rednote-xiaohongshu-scrape") return "zhorex/rednote-xiaohongshu-scraper"
  if (lower === "zen-studio/rednote-search-scraper") {
    console.warn(
      "[apify] 샤오홍슈: zen-studio/rednote-search-scraper 는 사용하지 않으며 zhorex/rednote-xiaohongshu-scraper 로 치환합니다."
    )
    return "zhorex/rednote-xiaohongshu-scraper"
  }
  return t
}

function inferXhsProfile(actorSlug: string): XhsProfile {
  const override = (process.env.APIFY_XHS_PROFILE || "").trim().toLowerCase()
  if (override === "zhorex_rednote" || override === "zhorex") return "zhorex_rednote"
  /** zen RedNote 스크래퍼는 제품 검색에서 쓰지 않음 — zhorex 입력 경로로 통일 */
  if (override === "zen_rednote" || override === "zen") return "zhorex_rednote"
  if (override === "dltik") return "dltik"
  if (override === "datapilot") return "datapilot"
  if (override === "easyapi") return "easyapi"
  if (override === "easyapi_aio" || override === "aio") return "easyapi_aio"
  if (override === "kuaima") return "kuaima"
  const s = actorSlug.toLowerCase()
  if (s.includes("socialdatax") && s.includes("xhs")) return "socialdatax"
  if (s.includes("zhorex") && s.includes("rednote")) return "zhorex_rednote"
  if (s.includes("zen-studio") && s.includes("rednote") && s.includes("search")) return "zen_rednote"
  if (s.includes("dltik") && s.includes("xiaohongshu")) return "dltik"
  if (s.includes("easyapi") && s.includes("all-in-one")) return "easyapi_aio"
  if (s.includes("easyapi") && s.includes("rednote")) return "easyapi"
  if (s.includes("kuaima") && s.includes("xiaohongshu")) return "kuaima"
  if (s.includes("datapilot")) return "datapilot"
  return "datapilot"
}

function inferDouyinProfile(actorSlug: string): DouyinProfile {
  const override = (process.env.APIFY_DOUYIN_PROFILE || "").trim().toLowerCase()
  if (override === "automation_douyin" || override === "automation") return "automation_douyin_analytics"
  if (override === "zen_douyin" || override === "zen") return "zen_douyin"
  if (override === "kuaima_douyin" || override === "kuaima") return "kuaima_douyin"
  if (override === "cloudcharlestom") return "cloudcharlestom"
  if (override === "natanielsantos") return "natanielsantos"
  if (override === "sian_agency" || override === "sian") return "sian_agency"
  const s = actorSlug.toLowerCase()
  if (s.includes("sian.agency") && s.includes("douyin")) return "sian_agency"
  if (s.includes("automation-lab") && s.includes("douyin-analytics")) return "automation_douyin_analytics"
  if (s.includes("zen-studio") && s.includes("douyin")) return "zen_douyin"
  if (s.includes("kuaima") && s.includes("douyin")) return "kuaima_douyin"
  if (s.includes("natanielsantos")) return "natanielsantos"
  return "cloudcharlestom"
}

function buildZenRednoteInput(keywords: string[]): Record<string, unknown> {
  const qs = dedupeKeywordStrings(
    keywords.map((k) => k.trim()).filter(Boolean),
    5
  )
  const zenMaxEnv = (process.env.APIFY_ZEN_XHS_MAX_RESULTS || "").trim()
  const genMaxEnv = (process.env.APIFY_XHS_MAX_RESULTS || "").trim()
  /** 키워드 2개 웨이브(통합 TOP2)일 때 기본 12면 run-sync 300s 내 ABORTED 되는 경우가 많아 기본값을 낮춤 */
  const defaultMax = qs.length >= 2 ? 8 : 12
  const maxRaw = Number(zenMaxEnv || genMaxEnv || defaultMax)
  const maxResults = Math.min(1000, Math.max(1, Number.isFinite(maxRaw) ? maxRaw : defaultMax))
  const sortRaw = (process.env.APIFY_ZEN_XHS_SORT_TYPE || "general").trim()
  const sortType = ["general", "popularity_descending", "time_descending"].includes(sortRaw) ? sortRaw : "general"
  const noteRaw = (process.env.APIFY_XHS_NOTE_TYPE || "all").trim()
  const noteType = ["all", "video", "image", "live"].includes(noteRaw) ? noteRaw : "all"
  const timeRaw = (process.env.APIFY_ZEN_XHS_TIME_FILTER || "all").trim()
  const timeFilter = ["all", "1d", "1w", "6mo"].includes(timeRaw) ? timeRaw : "all"
  const topUp = process.env.APIFY_ZEN_XHS_TOP_UP_SORTS === "1"
  return {
    keywords: qs,
    maxResults,
    sortType,
    topUpFromOtherSorts: topUp,
    noteType,
    timeFilter,
  }
}

function buildDatapilotProxyConfiguration(): Record<string, unknown> {
  const useResidential = process.env.APIFY_XHS_RESIDENTIAL_PROXY !== "0"
  if (!useResidential) return { useApifyProxy: false }
  const countryRaw = (process.env.APIFY_XHS_PROXY_COUNTRY || "SG").trim().toUpperCase()
  const apifyProxyCountry = ["US", "CA", "GB", "DE", "NL", "FR", "CN", "SG"].includes(countryRaw)
    ? countryRaw
    : "SG"
  return {
    useApifyProxy: true,
    apifyProxyGroups: ["RESIDENTIAL"],
    apifyProxyCountry,
  }
}

function buildZhorexRednoteSearchInput(keyword: string): Record<string, unknown> {
  const kw = keyword.trim()
  const maxRaw = Number(process.env.APIFY_XHS_MAX_RESULTS ?? 24)
  const maxResults = Math.min(500, Math.max(1, Number.isFinite(maxRaw) ? maxRaw : 24))
  const useResidential = process.env.APIFY_XHS_RESIDENTIAL_PROXY !== "0"
  const proxyConfiguration = useResidential
    ? { useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"] }
    : { useApifyProxy: false }
  const sortBy = (process.env.APIFY_ZHOREX_XHS_SORT_BY || "general").trim()
  const filterByType = (process.env.APIFY_ZHOREX_XHS_FILTER_BY_TYPE || "video").trim()
  const minLikesRaw = Number(process.env.APIFY_ZHOREX_XHS_FILTER_BY_MIN_LIKES ?? 0)
  const filterByMinLikes = Number.isFinite(minLikesRaw) ? Math.max(0, Math.floor(minLikesRaw)) : 0
  const cookie = (process.env.APIFY_XHS_COOKIE || "").trim()
  const input: Record<string, unknown> = {
    mode: "search",
    searchQuery: kw,
    maxResults,
    sortBy,
    filterByType,
    filterByMinLikes,
    includeComments: false,
    proxyConfiguration,
  }
  if (cookie) input.cookieString = cookie
  return input
}

function buildEasyApiAioSearchInput(keywords: string[]): Record<string, unknown> {
  const qs = dedupeKeywordStrings(
    keywords.map((k) => k.trim()).filter(Boolean),
    5
  )
  const maxRaw = Number(process.env.APIFY_XHS_MAX_ITEMS ?? 30)
  const maxItems = Math.min(10_000, Math.max(30, Number.isFinite(maxRaw) ? maxRaw : 30))
  return {
    mode: "search",
    keywords: qs,
    maxItems,
    postUrls: [],
    profileUrls: [],
  }
}

function buildSocialdataxSearchInput(keyword: string): Record<string, unknown> {
  const kw = keyword.trim()
  const maxRaw = Number(process.env.APIFY_XHS_MAX_RESULTS ?? process.env.APIFY_XHS_BENCHMARK_MAX_ITEMS ?? 20)
  const maxItems = Math.min(50, Math.max(8, Number.isFinite(maxRaw) ? maxRaw : 20))
  const noteRaw = (process.env.APIFY_XHS_NOTE_TYPE || "video").trim()
  const noteType = ["all", "video", "image"].includes(noteRaw) ? noteRaw : "video"
  return {
    operation: "search_notes",
    keyword: kw,
    page: 1,
    sort_type: "general",
    note_type: noteType,
    publish_time_range: "all",
    max_items: maxItems,
    auto_paginate: true,
  }
}

function buildXhsActorInput(profile: XhsProfile, keyword: string): Record<string, unknown> {
  const kw = keyword.trim()
  if (profile === "zen_rednote") {
    return buildZenRednoteInput([kw])
  }
  if (profile === "dltik") {
    const maxR = Math.min(1000, Math.max(1, Number(process.env.APIFY_XHS_MAX_RESULTS_PER_INPUT ?? 30) || 30))
    const cookies = (process.env.APIFY_XHS_COOKIE || "").trim()
    const input: Record<string, unknown> = {
      mode: "search",
      queries: [kw],
      maxResultsPerInput: maxR,
      noteUrls: [],
      userIds: [],
    }
    if (cookies) input.cookiesString = cookies
    return input
  }
  if (profile === "zhorex_rednote") {
    return buildZhorexRednoteSearchInput(kw)
  }
  if (profile === "socialdatax") {
    return buildSocialdataxSearchInput(kw)
  }
  if (profile === "easyapi_aio") {
    return buildEasyApiAioSearchInput([kw])
  }
  if (profile === "easyapi") {
    // Apify 런타임 검증: input.maxItems must be >= 100 (README 예시 20은 거부됨).
    const maxRaw = Number(process.env.APIFY_XHS_MAX_ITEMS ?? 100)
    const maxItems = Math.min(10_000, Math.max(100, Number.isFinite(maxRaw) ? maxRaw : 100))
    const sortType = (process.env.APIFY_XHS_SORT_TYPE || "general").trim()
    const noteType = (process.env.APIFY_XHS_NOTE_TYPE || "video").trim()
    const useProxy = process.env.APIFY_XHS_USE_PROXY === "1"
    return {
      keywords: [kw],
      maxItems,
      sortType: ["general", "latest", "hotest"].includes(sortType) ? sortType : "general",
      noteType: ["all", "text", "video", "image", "user"].includes(noteType) ? noteType : "all",
      proxyConfiguration: useProxy
        ? { useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"] }
        : { useApifyProxy: false },
    }
  }
  if (profile === "kuaima") {
    const maxItems = Math.min(50, Math.max(5, Number(process.env.APIFY_XHS_KUAIMA_MAX_ITEMS || 20) || 20))
    return {
      categories: (process.env.APIFY_XHS_KUAIMA_CATEGORIES || "全部").trim(),
      search_key: kw,
      scrape_detail: process.env.APIFY_XHS_KUAIMA_SCRAPE_DETAIL === "1",
      download_image: false,
      cookie_val: (process.env.APIFY_XHS_COOKIE || "").trim(),
      filter: (process.env.APIFY_XHS_KUAIMA_FILTER || "综合").trim(),
      maxItems,
    }
  }
  return {
    keyword: kw,
    proxyConfiguration: buildDatapilotProxyConfiguration(),
  }
}

function buildZenDouyinInput(keywords: string[], count: number): Record<string, unknown> {
  const qs = dedupeKeywordStrings(
    keywords.map((k) => k.trim()).filter(Boolean),
    5
  )
  /** Zen Store 무료 구간은 키워드당 12건 상한 안내가 많음 — env 미설정 시 보수적으로 12 cap */
  const envCap = process.env.APIFY_DOUYIN_MAX_RESULTS_PER_QUERY
  const parsed = envCap != null && String(envCap).trim() !== "" ? Number(envCap) : NaN
  const safeDefault = Math.min(12, Math.max(6, Math.min(30, count)))
  const maxResultsPerQuery = Number.isFinite(parsed)
    ? Math.min(1000, Math.max(5, parsed))
    : Math.min(1000, Math.max(5, safeDefault))
  const sort = (process.env.APIFY_ZEN_DOUYIN_SORT || "general").trim()
  const sortVal = ["general", "most_liked", "latest"].includes(sort) ? sort : "general"
  const pub = (process.env.APIFY_ZEN_DOUYIN_PUBLISH_TIME || "unlimited").trim()
  const publishTime = ["unlimited", "one_day", "one_week", "half_year"].includes(pub) ? pub : "unlimited"
  const dur = (process.env.APIFY_ZEN_DOUYIN_DURATION || "unlimited").trim()
  const duration = ["unlimited", "under_1m", "one_to_five", "over_5m"].includes(dur) ? dur : "unlimited"
  return {
    keywords: qs,
    maxResultsPerQuery,
    sort: sortVal,
    publishTime,
    duration,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSlideshowImages: false,
  }
}

function buildAutomationDouyinSearchInput(keywords: string[], count: number): Record<string, unknown> {
  const qs = dedupeKeywordStrings(
    keywords.map((k) => k.trim()).filter(Boolean),
    5
  )
  const maxRaw = Number(process.env.APIFY_DOUYIN_MAX_RESULTS ?? Math.min(200, Math.max(10, count * 3)))
  const maxResults = Math.min(200, Math.max(1, Number.isFinite(maxRaw) ? maxRaw : 30))
  return {
    mode: "search",
    keywords: qs,
    searchType: "video",
    userUrls: [],
    maxResults,
  }
}

function buildSianAgencyDouyinInput(keyword: string, count: number): Record<string, unknown> {
  const kw = keyword.trim().slice(0, 200)
  const perPage = 12
  const n = Math.min(600, Math.max(1, Number.isFinite(count) ? count : 12))
  const maxPages = Math.min(50, Math.max(1, Math.ceil(n / perPage)))
  return {
    operation: "searchVideo",
    keyword: kw,
    maxPages,
  }
}

function buildDouyinActorInput(profile: DouyinProfile, keyword: string, count: number): Record<string, unknown> {
  const kw = keyword.trim().slice(0, 200)
  if (profile === "sian_agency") {
    return buildSianAgencyDouyinInput(kw, count)
  }
  if (profile === "zen_douyin") {
    return buildZenDouyinInput([kw], count)
  }
  if (profile === "automation_douyin_analytics") {
    return buildAutomationDouyinSearchInput([kw], count)
  }
  if (profile === "kuaima_douyin") {
    return { search_by_keywords: kw }
  }
  if (profile === "natanielsantos") {
    const n = Math.min(50, Math.max(1, Number.isFinite(count) ? count : 12))
    const sort = (process.env.APIFY_DOUYIN_SORT || "general").trim()
    const searchSortFilter = ["general", "most_liked", "latest"].includes(sort) ? sort : "general"
    return {
      searchTermsOrHashtags: [kw],
      searchSortFilter,
      searchPublishTimeFilter: "all",
      searchDurationFilter: "all",
      maxItemsPerUrl: n,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
    }
  }
  return {
    keyword: kw,
    count: Math.min(30, Math.max(5, Number.isFinite(count) ? count : 12)),
    timeout: Math.min(90_000, Number(process.env.APIFY_DOUYIN_TIMEOUT_MS || 60_000)),
  }
}

function dedupeKeywordStrings(xs: string[], max: number): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const x of xs) {
    const t = x.trim()
    if (!t) continue
    const k = t.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(t)
    if (out.length >= max) break
  }
  return out
}

/** Apify 2차 웨이브 스킵용 — 두 키워드 쌍이 동일(순서 무관)인지 */
function sameKeywordPair(a: string[], b: string[]): boolean {
  const sa = new Set(a.map((x) => x.trim().toLowerCase()).filter((x) => x.length > 0))
  const sb = new Set(b.map((x) => x.trim().toLowerCase()).filter((x) => x.length > 0))
  if (sa.size === 0 || sa.size !== sb.size) return false
  for (const x of sa) if (!sb.has(x)) return false
  return true
}

const APIFY_PLAT_KEYS = ["tiktok", "xiaohongshu", "douyin"] as const

function unifiedKeywordCandidatePool(a: ApifySearchAnalysisShape): string[] {
  const raw: string[] = []
  const push = (x: unknown) => {
    if (typeof x !== "string") return
    const t = x.trim()
    if (t.length >= 2) raw.push(t)
  }
  for (const p of APIFY_PLAT_KEYS) {
    for (const q of a.serpPriorityQueries[p] || []) push(q)
  }
  for (const p of APIFY_PLAT_KEYS) {
    for (const q of a.searchQueries[p] || []) push(q)
  }
  for (const k of a.targetKeywords || []) push(k)
  for (const k of a.shoppingKeywords || []) push(k)
  push(a.productName)
  return dedupeKeywordStrings(raw, 48)
}

function scoreKeywordForProduct(query: string, a: ApifySearchAnalysisShape): number {
  const qn = query.trim().toLowerCase()
  let s = 0
  const pn = (a.productName || "").trim().toLowerCase()
  if (pn.length >= 2 && qn.includes(pn)) s += 28
  for (const part of pn.split(/[\s/|,+，、]+/).filter((x) => x.length >= 2)) {
    if (qn.includes(part)) s += 10
  }
  const cat = (a.category || "").trim().toLowerCase()
  if (cat.length >= 2 && qn.includes(cat)) s += 8
  for (const f of a.searchFeatures || []) {
    const t = String(f).trim().toLowerCase()
    if (t.length >= 2 && qn.includes(t)) s += 9
  }
  for (const tr of a.productTraits || []) {
    const t = String(tr).trim().toLowerCase()
    if (t.length >= 3 && t.length <= 48 && qn.includes(t)) s += 6
  }
  for (const sh of a.shoppingKeywords || []) {
    const t = String(sh).trim().toLowerCase()
    if (t.length >= 2 && qn.includes(t)) s += 7
  }
  for (const tk of a.targetKeywords || []) {
    const t = String(tk).trim().toLowerCase()
    if (t.length >= 2 && qn.includes(t)) s += 5
  }
  for (const p of APIFY_PLAT_KEYS) {
    for (const pq of a.serpPriorityQueries[p] || []) {
      if (pq.trim().toLowerCase() === qn) s += 6
    }
  }
  if (qn.length >= 4 && qn.length <= 72) s += 4
  return s
}

/** TikTok·샤오홍슈에 쓸 통합 검색어 2개(분석 풀 전체에서 제품 적합도 점수) */
export function pickTopUnifiedApifyKeywords(a: ApifySearchAnalysisShape): string[] {
  const pool = unifiedKeywordCandidatePool(a)
  if (pool.length === 0) {
    const fb = (a.productName || "").trim() || "product review"
    return [fb, fb]
  }
  const scored = pool.map((q) => ({ q, sc: scoreKeywordForProduct(q, a) }))
  scored.sort((x, y) => y.sc - x.sc || y.q.length - x.q.length)
  const first = scored[0]!.q
  const secondPick =
    scored.find((x) => x.q.trim().toLowerCase() !== first.trim().toLowerCase())?.q ||
    pool.find((q) => q.trim().toLowerCase() !== first.trim().toLowerCase()) ||
    first
  const pair = [first, secondPick].map((s) => s.trim().slice(0, 200)).filter((s) => s.length >= 1)
  if (pair.length >= 2) return pair.slice(0, 2)
  if (pair.length === 1) return [pair[0]!, pair[0]!]
  const fb = (a.productName || "").trim() || "product review"
  return [fb, fb]
}

/** 더우인(抖音) 전용 후보: serpPriority → searchQueries (통합 풀과 분리 — 한글 통합만 넣으면 실검 0건 가능) */
function douyinOrderedKeywordCandidates(a: ApifySearchAnalysisShape): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (raw: unknown) => {
    let s = ""
    if (typeof raw === "string") s = raw.trim().slice(0, 200)
    else if (raw && typeof raw === "object") {
      const o = raw as Record<string, unknown>
      if (typeof o.query === "string" && o.query.trim()) s = o.query.trim().slice(0, 200)
      else if (typeof o.text === "string" && o.text.trim()) s = o.text.trim().slice(0, 200)
      else if (typeof o.ko === "string" && o.ko.trim()) s = o.ko.trim().slice(0, 200)
    }
    if (s.length < 2) return
    const k = s.toLowerCase()
    if (seen.has(k)) return
    seen.add(k)
    out.push(s)
  }
  for (const q of a.serpPriorityQueries?.douyin || []) push(q)
  for (const q of a.searchQueries?.douyin || []) push(q)
  return out
}

/**
 * 더우인 Apify 검색용 키워드 2개.
 * `serpPriorityQueries.douyin` → `searchQueries.douyin` 뒤에 **샤오홍슈 간체 후보**를 붙인 풀에서 앞 2개(부족 시 통합 TOP2 보강).
 */
export function pickTopDouyinApifyKeywords(a: ApifySearchAnalysisShape): string[] {
  const fallback = pickTopUnifiedApifyKeywords(a)
  const ordered = douyinApifyKeywordPool(a)
  if (ordered.length >= 2) return [ordered[0]!, ordered[1]!]
  if (ordered.length === 1) {
    const one = ordered[0]!
    const alt =
      fallback.find((x) => x.trim().toLowerCase() !== one.trim().toLowerCase()) ||
      fallback[1] ||
      one
    return [one, alt]
  }
  return fallback
}

/** 샤오홍슈(小红书) 전용 후보: serpPriority → searchQueries (통합 풀과 분리) */
function xiaohongshuOrderedKeywordCandidates(a: ApifySearchAnalysisShape): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (raw: unknown) => {
    let s = ""
    if (typeof raw === "string") s = raw.trim().slice(0, 200)
    else if (raw && typeof raw === "object") {
      const o = raw as Record<string, unknown>
      if (typeof o.query === "string" && o.query.trim()) s = o.query.trim().slice(0, 200)
      else if (typeof o.text === "string" && o.text.trim()) s = o.text.trim().slice(0, 200)
      else if (typeof o.ko === "string" && o.ko.trim()) s = o.ko.trim().slice(0, 200)
    }
    if (s.length < 2) return
    const k = s.toLowerCase()
    if (seen.has(k)) return
    seen.add(k)
    out.push(s)
  }
  for (const q of a.serpPriorityQueries?.xiaohongshu || []) push(q)
  for (const q of a.searchQueries?.xiaohongshu || []) push(q)
  return out
}

/** 더우인 검색어 풀: douyin 전용 배열 + 샤오홍슈 간체(같은 상품군 실검) — douyin만 한글/빈 값일 때 0건 완화 */
function douyinApifyKeywordPool(a: ApifySearchAnalysisShape): string[] {
  return dedupeKeywordStrings(
    [...douyinOrderedKeywordCandidates(a), ...xiaohongshuOrderedKeywordCandidates(a)],
    18
  )
}

/**
 * 샤오홍슈 Apify 검색용 키워드 2개.
 * `serpPriorityQueries.xiaohongshu` → `searchQueries.xiaohongshu` 순으로 채우고, 2개 미만이면 통합 TOP2로 보강.
 */
export function pickTopXhsApifyKeywords(a: ApifySearchAnalysisShape): string[] {
  const fallback = pickTopUnifiedApifyKeywords(a)
  const ordered = xiaohongshuOrderedKeywordCandidates(a)
  if (ordered.length >= 2) return [ordered[0]!, ordered[1]!]
  if (ordered.length === 1) {
    const one = ordered[0]!
    const alt =
      fallback.find((x) => x.trim().toLowerCase() !== one.trim().toLowerCase()) ||
      fallback[1] ||
      one
    return [one, alt]
  }
  return fallback
}

async function apifyTiktokSearch(
  token: string,
  actor: string,
  keywords: string[],
  resultsPerPage: number
): Promise<SerpVideoRow[]> {
  const qs = keywords.map((k) => k.trim()).filter(Boolean).slice(0, 4)
  if (!qs.length) return []
  const input: Record<string, unknown> = {
    searchQueries: qs,
    searchSection: "/video",
    resultsPerPage,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSlideshowImages: false,
    shouldDownloadAvatars: false,
    downloadSubtitlesOptions: "NEVER_DOWNLOAD_SUBTITLES",
    proxyCountryCode: "None",
  }
  const tikMaxRaw = Number(process.env.APIFY_TIKTOK_SYNC_MAX_ITEMS ?? 100)
  const tikMax = Math.min(200, Math.max(40, Number.isFinite(tikMaxRaw) ? tikMaxRaw : 100))
  const items = await apifyRunSyncGetDatasetItems(token, actor, input, {
    timeoutSec: Number(process.env.APIFY_TIKTOK_TIMEOUT_SEC || 200),
    maxItems: tikMax,
  })
  const out: SerpVideoRow[] = []
  for (const it of items) {
    const row = mapTiktokItem(it)
    if (row) out.push(row)
  }
  return out
}

async function apifyXhsSearchWithInput(
  token: string,
  actor: string,
  profile: XhsProfile,
  input: Record<string, unknown>
): Promise<SerpVideoRow[]> {
  const isEasy = profile === "easyapi" || profile === "easyapi_aio"
  let syncMax = 40
  if (isEasy) {
    const m = typeof input.maxItems === "number" && Number.isFinite(input.maxItems) ? input.maxItems : 100
    syncMax = Math.min(150, Math.max(24, Number(process.env.APIFY_XHS_SYNC_MAX_ITEMS || m + 15) || m + 15))
  } else if (profile === "zen_rednote") {
    const m = typeof input.maxResults === "number" && Number.isFinite(input.maxResults) ? input.maxResults : 12
    const nk = Array.isArray(input.keywords) ? input.keywords.length : 1
    syncMax = Math.min(220, Math.max(24, m * nk + 35))
  } else if (profile === "zhorex_rednote") {
    const m = typeof input.maxResults === "number" && Number.isFinite(input.maxResults) ? input.maxResults : 24
    syncMax = Math.min(520, Math.max(20, m + 25))
  } else if (profile === "socialdatax") {
    const m = typeof input.max_items === "number" && Number.isFinite(input.max_items) ? input.max_items : 20
    syncMax = Math.min(80, Math.max(12, m + 10))
  } else if (profile === "dltik") {
    const m =
      typeof input.maxResultsPerInput === "number" && Number.isFinite(input.maxResultsPerInput)
        ? input.maxResultsPerInput
        : 30
    syncMax = Math.min(120, Math.max(20, m + 15))
  }

  let timeoutSec = Math.min(600, Math.max(60, Number(process.env.APIFY_XHS_TIMEOUT_SEC || 180) || 180))
  if (isEasy) {
    timeoutSec = Math.min(
      600,
      Math.max(
        profile === "easyapi_aio" ? 120 : 90,
        Number(process.env.APIFY_XHS_TIMEOUT_SEC || (profile === "easyapi_aio" ? 240 : 300)) ||
          (profile === "easyapi_aio" ? 240 : 300)
      )
    )
  } else if (profile === "zen_rednote") {
    /** zen RedNote는 키워드 2개·정렬 확장 시 300s 내 ABORTED 되는 경우가 많음 — 기본 540s (상한 900s) */
    const zen = (process.env.APIFY_ZEN_XHS_TIMEOUT_SEC || "").trim()
    const gen = (process.env.APIFY_XHS_TIMEOUT_SEC || "").trim()
    const def = 540
    const parsed = Number(zen || gen || def)
    timeoutSec = Math.min(
      900,
      Math.max(180, Number.isFinite(parsed) && parsed >= 180 ? parsed : def)
    )
  } else if (profile === "zhorex_rednote") {
    timeoutSec = Math.min(600, Math.max(120, Number(process.env.APIFY_XHS_TIMEOUT_SEC || 300) || 300))
  } else if (profile === "socialdatax") {
    timeoutSec = Math.min(600, Math.max(120, Number(process.env.APIFY_XHS_TIMEOUT_SEC || 300) || 300))
  } else if (profile === "dltik") {
    timeoutSec = Math.min(600, Math.max(120, Number(process.env.APIFY_XHS_TIMEOUT_SEC || 300) || 300))
  } else if (profile === "kuaima") {
    timeoutSec = Math.min(600, Math.max(90, Number(process.env.APIFY_XHS_TIMEOUT_SEC || 240) || 240))
  } else if (profile === "datapilot") {
    timeoutSec = Math.min(600, Math.max(90, Number(process.env.APIFY_XHS_TIMEOUT_SEC || 240) || 240))
    syncMax = Math.min(120, Math.max(40, Number(process.env.APIFY_XHS_SYNC_MAX_ITEMS || 80) || 80))
  }

  const items = await apifyRunSyncGetDatasetItems(token, actor, input, {
    timeoutSec,
    maxItems: syncMax,
  })
  const out: SerpVideoRow[] = []
  for (const it of items) {
    const row = mapXhsDatasetItem(it, profile)
    if (row) out.push(row)
  }
  const deduped = dedupeVideoRows(out)
  if (profile === "socialdatax" && deduped.length > 0) {
    await enrichSocialdataxMissingThumbnails(token, deduped)
  }
  return deduped
}

async function apifyXhsSearchKeyword(token: string, actor: string, keyword: string): Promise<SerpVideoRow[]> {
  const kw = keyword.trim()
  if (!kw) return []
  const profile = inferXhsProfile(actor)
  const input = buildXhsActorInput(profile, kw)
  return apifyXhsSearchWithInput(token, actor, profile, input)
}

async function apifyXhsSearchWave(
  token: string,
  actor: string,
  keywords: string[]
): Promise<{ rows: SerpVideoRow[]; httpCalls: number }> {
  const profile = inferXhsProfile(actor)
  const qs = dedupeKeywordStrings(
    keywords.map((k) => k.trim()).filter(Boolean),
    5
  )
  if (!qs.length) return { rows: [], httpCalls: 0 }
  if (profile === "zen_rednote") {
    const input = buildZenRednoteInput(qs)
    const rows = filterRowsByAnyKeyword(await apifyXhsSearchWithInput(token, actor, profile, input), qs)
    return { rows, httpCalls: 1 }
  }
  if (profile === "easyapi_aio") {
    const input = buildEasyApiAioSearchInput(qs)
    const rows = filterRowsByAnyKeyword(await apifyXhsSearchWithInput(token, actor, profile, input), qs)
    return { rows, httpCalls: 1 }
  }
  const merged: SerpVideoRow[] = []
  const batches: SerpVideoRow[][] = []
  let httpCalls = 0
  for (const kw of qs) {
    const raw = await apifyXhsSearchKeyword(token, actor, kw)
    const rows = filterRowsByKeyword(raw, kw)
    batches.push(rows)
    merged.push(...rows)
    httpCalls += 1
  }
  const deduped = dedupeVideoRows(merged)
  /** 키워드별 런 중 하나만 dataset을 채우고 나머지는 0건일 때도, 합쳐서 비면 가장 많이 나온 런을 살림 */
  const bestBatch = batches.reduce((a, b) => (b.length > a.length ? b : a), [] as SerpVideoRow[])
  return { rows: deduped.length > 0 ? deduped : dedupeVideoRows(bestBatch), httpCalls }
}

async function apifyDouyinSearchWithInput(
  token: string,
  actor: string,
  profile: DouyinProfile,
  input: Record<string, unknown>
): Promise<SerpVideoRow[]> {
  let syncMax = 30
  if (profile === "zen_douyin") {
    const m =
      typeof input.maxResultsPerQuery === "number" && Number.isFinite(input.maxResultsPerQuery)
        ? input.maxResultsPerQuery
        : 12
    const nk = Array.isArray(input.keywords) ? input.keywords.length : 1
    syncMax = Math.min(180, Math.max(20, m * nk + 25))
  } else if (profile === "kuaima_douyin") {
    syncMax = 50
  } else if (profile === "automation_douyin_analytics") {
    const mr = typeof input.maxResults === "number" && Number.isFinite(input.maxResults) ? input.maxResults : 30
    const nk = Array.isArray(input.keywords) ? input.keywords.length : 1
    syncMax = Math.min(200, Math.max(25, mr * nk + 20))
  } else if (profile === "natanielsantos") {
    const n =
      typeof input.maxItemsPerUrl === "number" && Number.isFinite(input.maxItemsPerUrl) ? input.maxItemsPerUrl : 12
    syncMax = Math.min(80, Math.max(20, n + 10))
  } else if (profile === "sian_agency") {
    const pages = typeof input.maxPages === "number" && Number.isFinite(input.maxPages) ? input.maxPages : 1
    syncMax = Math.min(600, Math.max(20, pages * 12 + 10))
  } else {
    syncMax = 30
  }
  let defTimeout = 200
  if (profile === "zen_douyin") defTimeout = 300
  else if (profile === "kuaima_douyin") defTimeout = 260
  else if (profile === "automation_douyin_analytics") defTimeout = 240
  else if (profile === "natanielsantos") defTimeout = 200
  else if (profile === "sian_agency") defTimeout = 180
  const timeoutSec = Math.min(600, Math.max(60, Number(process.env.APIFY_DOUYIN_SYNC_TIMEOUT_SEC || defTimeout) || defTimeout))
  const items = await apifyRunSyncGetDatasetItems(token, actor, input, {
    timeoutSec,
    maxItems: syncMax,
  })
  const out: SerpVideoRow[] = []
  for (const it of items) {
    const row = mapDouyinDatasetItem(it, profile)
    if (row) out.push(row)
  }
  return out
}

async function apifyDouyinSearchKeyword(
  token: string,
  actor: string,
  keyword: string,
  count: number
): Promise<SerpVideoRow[]> {
  const kw = keyword.trim().slice(0, 200)
  if (!kw) return []
  const profile = inferDouyinProfile(actor)
  const input = buildDouyinActorInput(profile, kw, count)
  return apifyDouyinSearchWithInput(token, actor, profile, input)
}

async function apifyDouyinSearchWave(
  token: string,
  actor: string,
  keywords: string[],
  count: number
): Promise<{ rows: SerpVideoRow[]; httpCalls: number }> {
  const profile = inferDouyinProfile(actor)
  const qs = dedupeKeywordStrings(
    keywords.map((k) => k.trim()).filter(Boolean),
    5
  )
  if (!qs.length) return { rows: [], httpCalls: 0 }
  if (profile === "zen_douyin") {
    const input = buildZenDouyinInput(qs, count)
    const rows = await apifyDouyinSearchWithInput(token, actor, profile, input)
    return { rows, httpCalls: 1 }
  }
  if (profile === "automation_douyin_analytics") {
    const input = buildAutomationDouyinSearchInput(qs, count)
    const rows = await apifyDouyinSearchWithInput(token, actor, profile, input)
    return { rows, httpCalls: 1 }
  }
  const merged: SerpVideoRow[] = []
  const batches: SerpVideoRow[][] = []
  let httpCalls = 0
  for (const kw of qs) {
    const raw = await apifyDouyinSearchKeyword(token, actor, kw, count)
    const rows = filterRowsByKeyword(raw, kw)
    batches.push(rows)
    merged.push(...rows)
    httpCalls += 1
  }
  const deduped = dedupeVideoRows(merged)
  const bestBatch = batches.reduce((a, b) => (b.length > a.length ? b : a), [] as SerpVideoRow[])
  return { rows: deduped.length > 0 ? deduped : dedupeVideoRows(bestBatch), httpCalls }
}

export async function collectApifyVideoCandidatesBudgeted(
  token: string,
  analysis: ApifySearchAnalysisShape
): Promise<{ rows: SerpVideoRow[]; apifyHttpCalls: number }> {
  const tiktokActor = (process.env.APIFY_TIKTOK_ACTOR || DEFAULT_TIKTOK_ACTOR).trim()
  const tiktokRpp = Math.min(30, Math.max(6, Number(process.env.APIFY_TIKTOK_RESULTS_PER_PAGE || 14)))
  const douyinCount = Math.min(30, Math.max(5, Number(process.env.APIFY_DOUYIN_COUNT || 12)))

  const unifiedPair = pickTopUnifiedApifyKeywords(analysis)
  const xhsPair = pickTopXhsApifyKeywords(analysis)
  const douyinPair = pickTopDouyinApifyKeywords(analysis)

  const runTiktokWaves = async (): Promise<{ rows: SerpVideoRow[]; http: number }> => {
    if (!unifiedPair.length) return { rows: [], http: 0 }
    const batch = await apifyTiktokSearch(token, tiktokActor, unifiedPair, tiktokRpp)
    return { rows: batch, http: 1 }
  }

  const runXhsWaves = async (): Promise<{ rows: SerpVideoRow[]; http: number }> => {
    if (!xhsPair.length) return { rows: [], http: 0 }
    const actors = resolveXhsVideoActorChain()
    let acc: SerpVideoRow[] = []
    let http = 0

    for (const actorSlug of actors) {
      const actor = normalizeXhsVideoActorSlug(actorSlug)
      const w1 = await apifyXhsSearchWave(token, actor, xhsPair)
      acc.push(...filterXhsVideoRows(w1.rows))
      http += w1.httpCalls

      const orderedXhs = dedupeKeywordStrings(xiaohongshuOrderedKeywordCandidates(analysis), 12)
      const pair2 = orderedXhs.slice(2, 4)
      if (pair2.length >= 2 && !sameKeywordPair(xhsPair, pair2)) {
        const w2 = await apifyXhsSearchWave(token, actor, pair2)
        acc.push(...filterXhsVideoRows(w2.rows))
        http += w2.httpCalls
      }
    }

    return { rows: dedupeVideoRows(acc), http }
  }

  const runDouyinWaves = async (): Promise<{ rows: SerpVideoRow[]; http: number }> => {
    if (!douyinPair.length) return { rows: [], http: 0 }
    const actors = resolveDouyinVideoActorChain()
    let acc: SerpVideoRow[] = []
    let http = 0

    for (const actorSlug of actors) {
      const actor = normalizeDouyinVideoActorSlug(actorSlug)
      const w1 = await apifyDouyinSearchWave(token, actor, douyinPair, douyinCount)
      acc.push(...w1.rows)
      http += w1.httpCalls

      const orderedDy = douyinApifyKeywordPool(analysis)
      const pair2 = orderedDy.slice(2, 4)
      if (pair2.length >= 2 && !sameKeywordPair(douyinPair, pair2)) {
        const w2 = await apifyDouyinSearchWave(token, actor, pair2, douyinCount)
        acc.push(...w2.rows)
        http += w2.httpCalls
      }
    }

    return { rows: dedupeVideoRows(acc), http }
  }

  const [t, x, d] = await Promise.all([runTiktokWaves(), runXhsWaves(), runDouyinWaves()])
  const rows = dedupeVideoRows([...t.rows, ...x.rows, ...d.rows])
  const http = t.http + x.http + d.http

  return { rows, apifyHttpCalls: http }
}

const DEFAULT_XHS_PRIMARY_ACTOR_EXPORT = DEFAULT_XHS_VIDEO_ACTOR

/** 小红书 Apify 검색 — 영상 검증 Actor 전부 호출 후 playUrl 있는 결과 병합 */
export async function searchXiaohongshuOnApify(
  token: string,
  keywords: string[],
  options?: { actor?: string; maxKeywords?: number }
): Promise<{ rows: SerpVideoRow[]; httpCalls: number; actor: string; actorsUsed: string[]; keywordsUsed: string[] }> {
  const maxKw = options?.maxKeywords ?? 3
  const keywordsUsed = dedupeKeywordStrings(
    keywords.map((k) => k.trim()).filter(Boolean),
    maxKw
  )
  if (!keywordsUsed.length) {
    return { rows: [], httpCalls: 0, actor: DEFAULT_XHS_VIDEO_ACTOR, actorsUsed: [], keywordsUsed: [] }
  }

  const chain = options?.actor
    ? [normalizeXhsVideoActorSlug(options.actor)]
    : resolveXhsVideoActorChain()

  let httpCalls = 0
  const actorsUsed: string[] = []
  let merged: SerpVideoRow[] = []

  for (const actorSlug of chain) {
    const actor = normalizeXhsVideoActorSlug(actorSlug)
    const { rows, httpCalls: hc } = await apifyXhsSearchWave(token, actor, keywordsUsed)
    httpCalls += hc
    const videos = filterXhsVideoRows(rows)
    if (videos.length > 0) actorsUsed.push(actor)
    merged = dedupeVideoRows([...merged, ...videos])
  }

  return {
    rows: merged,
    httpCalls,
    actor: actorsUsed.length ? actorsUsed.join(" + ") : chain[0] ?? DEFAULT_XHS_VIDEO_ACTOR,
    actorsUsed,
    keywordsUsed,
  }
}

/** 抖音 Apify 검색 — 영상 검증 Actor 전부 호출 후 결과 병합 */
export async function searchDouyinOnApify(
  token: string,
  keywords: string[],
  options?: { actor?: string; maxKeywords?: number; count?: number }
): Promise<{ rows: SerpVideoRow[]; httpCalls: number; actor: string; actorsUsed: string[]; keywordsUsed: string[] }> {
  const maxKw = options?.maxKeywords ?? 3
  const count = Math.min(30, Math.max(5, options?.count ?? Number(process.env.APIFY_DOUYIN_COUNT || 12)))
  const keywordsUsed = dedupeKeywordStrings(
    keywords.map((k) => k.trim()).filter(Boolean),
    maxKw
  )
  if (!keywordsUsed.length) {
    return { rows: [], httpCalls: 0, actor: DEFAULT_DOUYIN_VIDEO_ACTOR, actorsUsed: [], keywordsUsed: [] }
  }

  const chain = options?.actor
    ? [normalizeDouyinVideoActorSlug(options.actor)]
    : resolveDouyinVideoActorChain()

  let httpCalls = 0
  const actorsUsed: string[] = []
  let merged: SerpVideoRow[] = []

  for (const actorSlug of chain) {
    const actor = normalizeDouyinVideoActorSlug(actorSlug)
    const { rows, httpCalls: hc } = await apifyDouyinSearchWave(token, actor, keywordsUsed, count)
    httpCalls += hc
    if (rows.length > 0) actorsUsed.push(actor)
    merged = dedupeVideoRows([...merged, ...rows])
  }

  return {
    rows: merged,
    httpCalls,
    actor: actorsUsed.length ? actorsUsed.join(" + ") : chain[0] ?? DEFAULT_DOUYIN_VIDEO_ACTOR,
    actorsUsed,
    keywordsUsed,
  }
}

export type XhsApifyRawRunResult = {
  actor: string
  profile: string
  durationMs: number
  rawItems: unknown[]
  mappedRows: SerpVideoRow[]
  error: string | null
  httpStatus: number | null
}

/** Actor 벤치마크 — raw dataset + 매핑된 SerpVideoRow 동시 반환 */
export async function runXhsApifyActorRaw(
  token: string,
  actorSlug: string,
  input: Record<string, unknown>
): Promise<XhsApifyRawRunResult> {
  const trimmed = actorSlug.trim()
  const actor = isXhsVideoApifyActor(trimmed) ? normalizeXhsVideoActorSlug(trimmed) : normalizeXhsActorSlug(trimmed)
  const profile = inferXhsProfile(actor)
  const started = Date.now()
  let httpStatus: number | null = null
  let error: string | null = null
  let rawItems: unknown[] = []

  try {
    const pathId = actorPathId(actor)
    const isEasy = profile === "easyapi" || profile === "easyapi_aio"
    let syncMax = 40
    if (isEasy) {
      const m = typeof input.maxItems === "number" && Number.isFinite(input.maxItems) ? input.maxItems : 100
      syncMax = Math.min(150, Math.max(24, m + 15))
    } else if (profile === "zhorex_rednote") {
      syncMax = 80
    } else if (profile === "socialdatax") {
      const m = typeof input.max_items === "number" && Number.isFinite(input.max_items) ? input.max_items : 20
      syncMax = Math.min(80, Math.max(12, m + 10))
    } else if (profile === "zen_rednote") {
      const m = typeof input.maxResults === "number" && Number.isFinite(input.maxResults) ? input.maxResults : 12
      syncMax = Math.min(120, Math.max(20, m + 15))
    } else if (profile === "kuaima") {
      syncMax = Math.min(60, Math.max(15, Number(input.maxItems) || 25))
    }

    let timeoutSec = Math.min(600, Math.max(90, Number(process.env.APIFY_XHS_TIMEOUT_SEC || 240) || 240))
    if (profile === "kuaima") timeoutSec = Math.min(600, Math.max(90, Number(process.env.APIFY_XHS_TIMEOUT_SEC || 240) || 240))

    const url = new URL(`https://api.apify.com/v2/acts/${encodeURIComponent(pathId)}/run-sync-get-dataset-items`)
    url.searchParams.set("token", token)
    url.searchParams.set("timeout", String(timeoutSec))
    url.searchParams.set("maxItems", String(syncMax))

    const r = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(timeoutSec * 1000 + 120_000),
    })
    httpStatus = r.status
    if (!r.ok) {
      const t = await r.text().catch(() => "")
      error = `HTTP ${r.status}: ${t.slice(0, 280)}`
      rawItems = []
    } else {
      const data = (await r.json().catch(() => null)) as unknown
      rawItems = Array.isArray(data) ? data : []
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Apify 호출 실패"
  }

  const mappedRows: SerpVideoRow[] = []
  for (const it of rawItems) {
    const row = mapXhsDatasetItem(it, profile)
    if (row) mappedRows.push(row)
  }

  const deduped = dedupeVideoRows(mappedRows)
  if (profile === "socialdatax" && deduped.length > 0 && !error) {
    await enrichSocialdataxMissingThumbnails(token, deduped)
  }

  return {
    actor,
    profile,
    durationMs: Date.now() - started,
    rawItems,
    mappedRows: deduped,
    error,
    httpStatus,
  }
}

/** 다운로드 Actor — note URL 배열 입력 */
export async function runXhsDownloadActorRaw(
  token: string,
  actorSlug: string,
  noteUrls: string[]
): Promise<XhsApifyRawRunResult> {
  const actor = actorSlug.trim()
  const started = Date.now()
  let httpStatus: number | null = null
  let error: string | null = null
  let rawItems: unknown[] = []
  const links = noteUrls.map((u) => u.trim()).filter(Boolean).slice(0, 5)
  const input = { links }

  try {
    const pathId = actorPathId(actor)
    const timeoutSec = Math.min(300, Math.max(60, Number(process.env.APIFY_XHS_DOWNLOAD_TIMEOUT_SEC || 120) || 120))
    const url = new URL(`https://api.apify.com/v2/acts/${encodeURIComponent(pathId)}/run-sync-get-dataset-items`)
    url.searchParams.set("token", token)
    url.searchParams.set("timeout", String(timeoutSec))
    url.searchParams.set("maxItems", "20")

    const r = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(timeoutSec * 1000 + 60_000),
    })
    httpStatus = r.status
    if (!r.ok) {
      const t = await r.text().catch(() => "")
      error = `HTTP ${r.status}: ${t.slice(0, 280)}`
    } else {
      const data = (await r.json().catch(() => null)) as unknown
      rawItems = Array.isArray(data) ? data : []
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Apify 다운로드 호출 실패"
  }

  const mappedRows: SerpVideoRow[] = []
  for (const it of rawItems) {
    const row = mapZenRednoteXhsItem(it) ?? mapZhorexRednoteXhsItem(it) ?? mapKuaimaFlatXhsItem(it)
    if (row) mappedRows.push(row)
  }

  return {
    actor,
    profile: "download",
    durationMs: Date.now() - started,
    rawItems,
    mappedRows,
    error,
    httpStatus,
  }
}

export type DouyinApifyRawRunResult = {
  actor: string
  profile: string
  durationMs: number
  rawItems: unknown[]
  mappedRows: SerpVideoRow[]
  error: string | null
  httpStatus: number | null
}

/** 抖音 Actor 벤치마크 — raw dataset + 매핑된 SerpVideoRow */
export async function runDouyinApifyActorRaw(
  token: string,
  actorSlug: string,
  input: Record<string, unknown>
): Promise<DouyinApifyRawRunResult> {
  const trimmed = actorSlug.trim()
  const actor = isDouyinVideoApifyActor(trimmed) ? normalizeDouyinVideoActorSlug(trimmed) : trimmed
  const profile = inferDouyinProfile(actor)
  const started = Date.now()
  let httpStatus: number | null = null
  let error: string | null = null
  let rawItems: unknown[] = []

  try {
    const pathId = actorPathId(actor)
    let syncMax = 30
    if (profile === "zen_douyin") {
      const m =
        typeof input.maxResultsPerQuery === "number" && Number.isFinite(input.maxResultsPerQuery)
          ? input.maxResultsPerQuery
          : 12
      syncMax = Math.min(180, Math.max(20, m + 25))
    } else if (profile === "automation_douyin_analytics") {
      const mr = typeof input.maxResults === "number" && Number.isFinite(input.maxResults) ? input.maxResults : 30
      syncMax = Math.min(200, Math.max(25, mr + 20))
    } else if (profile === "natanielsantos") {
      const n =
        typeof input.maxItemsPerUrl === "number" && Number.isFinite(input.maxItemsPerUrl) ? input.maxItemsPerUrl : 12
      syncMax = Math.min(80, Math.max(20, n + 10))
    } else if (profile === "sian_agency") {
      const pages = typeof input.maxPages === "number" && Number.isFinite(input.maxPages) ? input.maxPages : 1
      syncMax = Math.min(600, Math.max(20, pages * 12 + 10))
    }

    let timeoutSec = 240
    if (profile === "zen_douyin") timeoutSec = 300
    else if (profile === "kuaima_douyin") timeoutSec = 260
    else if (profile === "automation_douyin_analytics") timeoutSec = 240
    else if (profile === "sian_agency") timeoutSec = 180
    timeoutSec = Math.min(600, Math.max(90, Number(process.env.APIFY_DOUYIN_SYNC_TIMEOUT_SEC || timeoutSec) || timeoutSec))

    const url = new URL(`https://api.apify.com/v2/acts/${encodeURIComponent(pathId)}/run-sync-get-dataset-items`)
    url.searchParams.set("token", token)
    url.searchParams.set("timeout", String(timeoutSec))
    url.searchParams.set("maxItems", String(syncMax))

    const r = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(timeoutSec * 1000 + 120_000),
    })
    httpStatus = r.status
    if (!r.ok) {
      const t = await r.text().catch(() => "")
      error = `HTTP ${r.status}: ${t.slice(0, 280)}`
      rawItems = []
    } else {
      const data = (await r.json().catch(() => null)) as unknown
      rawItems = Array.isArray(data) ? data : []
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Apify 호출 실패"
  }

  const mappedRows: SerpVideoRow[] = []
  for (const it of rawItems) {
    const row = mapDouyinDatasetItem(it, profile)
    if (row) mappedRows.push(row)
  }

  return {
    actor,
    profile,
    durationMs: Date.now() - started,
    rawItems,
    mappedRows: dedupeVideoRows(mappedRows),
    error,
    httpStatus,
  }
}
