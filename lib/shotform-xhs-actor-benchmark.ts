/**
 * 小红书 Apify Actor 벤치마크 — ChatGPT 추천 기준 비교
 * 결과 개수 · 썸네일 · 좋아요 · URL · 영상비율 · 다운로드 URL · 속도
 */

import {
  runXhsApifyActorRaw,
  runXhsDownloadActorRaw,
  pickXhsThumbnailFromRaw,
  type XhsApifyRawRunResult,
} from "@/lib/apify-product-search"
import { buildXhsBenchmarkSearchInput } from "@/lib/apify-xhs-benchmark-input"
import {
  discoverXhsStoreActors,
  discoveredToBenchmarkDef,
  type DiscoveredXhsActor,
} from "@/lib/apify-xhs-store-discovery"
import { XHS_VIDEO_APIFY_ACTORS, isXhsVideoApifyActor, normalizeXhsVideoActorSlug } from "@/lib/apify-xhs-video-actors"
import type { SerpVideoRow } from "@/lib/serpapi-product-search"

export type XhsActorRole = "search" | "detail" | "download"

export type XhsBenchmarkActorDef = {
  id: string
  slug: string
  label: string
  role: XhsActorRole
  rank: number
  description: string
  storeUrl: string
  searchable?: boolean
  storeRole?: string
  stats?: DiscoveredXhsActor["stats"]
}

/** 서비스·벤치마크 — socialdatax XHS API */
export const XHS_BENCHMARK_ACTORS: XhsBenchmarkActorDef[] = XHS_VIDEO_APIFY_ACTORS.map((a, i) => ({
  id: a.slug.replace(/\//g, "--"),
  slug: a.slug,
  label: a.label,
  role: "search" as const,
  rank: i + 1,
  description: `벤치마크 영상 ~${a.videoRatioPct}% · 서비스 사용 중`,
  storeUrl: `https://apify.com/${a.slug}`,
  searchable: true,
}))

export const XHS_BENCHMARK_DEFAULT_KEYWORDS = [
  "车载吸尘器",
  "无线车载吸尘器",
  "厨房神器",
  "便携式搅拌机",
] as const

export type ExtractedItemFields = {
  noteUrl: string | null
  title: string | null
  thumbnail: string | null
  videoUrl: string | null
  downloadUrl: string | null
  likeCount: number | null
  viewCount: number | null
  commentCount: number | null
  collectCount: number | null
  hasVideo: boolean
  hasImage: boolean
  description: string | null
  hashtags: string[]
  mediaType: string | null
  topLevelKeys: string[]
}

export type RunAggregateMetrics = {
  rawCount: number
  mappedCount: number
  withNoteUrl: number
  withThumbnail: number
  withLikeCount: number
  withViewCount: number
  withVideoUrl: number
  withDownloadUrl: number
  withDescription: number
  withHashtags: number
  videoItemCount: number
  imageItemCount: number
  videoRatioPct: number
  avgLikeCount: number | null
  maxLikeCount: number | null
}

export type BenchmarkSampleItem = ExtractedItemFields & {
  mapped?: SerpVideoRow | null
}

export type VideoBenchmarkItem = {
  title: string
  thumbnail: string
  noteUrl: string
  videoUrl: string
  likeCount: number | null
  viewCount: number | null
  author: string | null
}

export type ActorKeywordBenchmarkResult = {
  actorId: string
  actorSlug: string
  actorLabel: string
  role: XhsActorRole
  keyword: string
  durationMs: number
  durationSec: number
  error: string | null
  httpStatus: number | null
  input: Record<string, unknown>
  metrics: RunAggregateMetrics
  samples: BenchmarkSampleItem[]
  /** 영상으로 판별된 항목 (썸네일·재생 URL) */
  videoItems: VideoBenchmarkItem[]
  rawKeysHint: string[]
}

export type ActorStoreMeta = {
  actorId: string
  modifiedAt: string | null
  version: string | null
  statsNote: string | null
}

export type XhsBenchmarkReport = {
  keywords: string[]
  actors: XhsBenchmarkActorDef[]
  results: ActorKeywordBenchmarkResult[]
  downloadResults: ActorKeywordBenchmarkResult[]
  actorMeta: ActorStoreMeta[]
  summary: Array<{
    actorId: string
    actorSlug: string
    actorLabel: string
    role: XhsActorRole
    rank: number
    totalRaw: number
    totalMapped: number
    avgDurationSec: number
    avgVideoRatioPct: number
    likeCoveragePct: number
    thumbCoveragePct: number
    downloadCoveragePct: number
    score: number
    searchable?: boolean
    storeRole?: string
    totalVideoItems: number
  }>
  notice: string
  batch?: { offset: number; batchSize: number; totalActors: number; hasMore: boolean }
}

export { discoverXhsStoreActors, discoveredToBenchmarkDef }
export type { DiscoveredXhsActor }

function slugToId(slug: string): string {
  return slug.replace(/\//g, "--")
}

function resolveActors(args: {
  actorIds?: string[]
  actorSlugs?: string[]
  discoverAll?: boolean
  searchableOnly?: boolean
}): XhsBenchmarkActorDef[] {
  if (args.discoverAll) {
    throw new Error("discoverAll는 runXhsActorBenchmark 밖에서 discoverXhsStoreActors() 후 actorSlugs로 전달하세요.")
  }

  const fromPreset = XHS_BENCHMARK_ACTORS.filter((a) => !args.actorIds?.length || args.actorIds.includes(a.id))

  if (args.actorSlugs?.length) {
    return args.actorSlugs
      .filter(isXhsVideoApifyActor)
      .map((slug) => XHS_BENCHMARK_ACTORS.find((a) => a.slug === normalizeXhsVideoActorSlug(slug)))
      .filter((a): a is XhsBenchmarkActorDef => !!a)
  }

  let actors = fromPreset
  if (args.searchableOnly !== false) {
    actors = actors.filter((a) => a.searchable !== false && a.role !== "download")
  }
  return actors
}

function buildSearchInput(actor: XhsBenchmarkActorDef, keyword: string): Record<string, unknown> {
  return buildXhsBenchmarkSearchInput(actor.slug, keyword)
}

function normalizeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null
  const s = raw.trim()
  if (!s) return null
  if (s.startsWith("//")) return `https:${s}`
  if (s.startsWith("http://")) return `https://${s.slice(7)}`
  return s.startsWith("http") ? s : null
}

function pickStrFromObj(o: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = o[k]
    if (typeof v === "string" && v.trim()) return normalizeHttpUrl(v.trim())
  }
  return null
}

function pickTextFromObj(o: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = o[k]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return null
}

function pickNumFromObj(o: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = o[k]
    if (typeof v === "number" && Number.isFinite(v)) return Math.round(v)
    if (typeof v === "string" && /^\d+$/.test(v.trim())) return parseInt(v.trim(), 10)
  }
  return null
}

function collectHttpUrls(obj: unknown, out: string[], depth = 0): void {
  if (depth > 8 || out.length > 40) return
  if (typeof obj === "string") {
    const s = obj.trim()
    if (s.startsWith("http")) out.push(s)
    else if (s.startsWith("//")) out.push(`https:${s}`)
    return
  }
  if (!obj || typeof obj !== "object") return
  if (Array.isArray(obj)) {
    for (const x of obj) collectHttpUrls(x, out, depth + 1)
    return
  }
  for (const v of Object.values(obj as Record<string, unknown>)) {
    collectHttpUrls(v, out, depth + 1)
  }
}

function extractItemFields(raw: unknown): ExtractedItemFields {
  const topLevelKeys =
    raw && typeof raw === "object" && !Array.isArray(raw) ? Object.keys(raw as Record<string, unknown>).slice(0, 24) : []

  if (!raw || typeof raw !== "object") {
    return {
      noteUrl: null,
      title: null,
      thumbnail: null,
      videoUrl: null,
      downloadUrl: null,
      likeCount: null,
      viewCount: null,
      commentCount: null,
      collectCount: null,
      hasVideo: false,
      hasImage: false,
      description: null,
      hashtags: [],
      mediaType: null,
      topLevelKeys,
    }
  }

  const o = raw as Record<string, unknown>
  const stats =
    o.statistics && typeof o.statistics === "object"
      ? (o.statistics as Record<string, unknown>)
      : o.stats && typeof o.stats === "object"
        ? (o.stats as Record<string, unknown>)
        : o.interactInfo && typeof o.interactInfo === "object"
          ? (o.interactInfo as Record<string, unknown>)
          : null

  const urls: string[] = []
  collectHttpUrls(raw, urls)
  const noteUrl =
    urls.find((u) => /xiaohongshu\.com\/(explore|discovery\/item)\/[a-z0-9]+/i.test(u)) ||
    pickStrFromObj(o, ["note_url", "noteUrl", "postUrl", "url", "href", "link", "share_url", "shareUrl"]) ||
    null

  const title =
    pickTextFromObj(o, [
      "display_title",
      "displayTitle",
      "title",
      "noteTitle",
      "note_title",
      "desc",
      "description",
      "content",
      "text",
    ])?.slice(0, 200) || null

  const description =
    pickTextFromObj(o, ["desc", "description", "content", "noteContent", "body"])?.slice(0, 400) || null

  const likeCount =
    pickNumFromObj(o, ["likeCount", "likes", "diggCount", "likedCount", "like_count"]) ??
    (stats ? pickNumFromObj(stats, ["likeCount", "likes", "diggCount", "likedCount"]) : null)

  const viewCount =
    pickNumFromObj(o, ["viewCount", "views", "playCount", "play_count"]) ??
    (stats ? pickNumFromObj(stats, ["viewCount", "playCount"]) : null)

  const commentCount =
    pickNumFromObj(o, ["commentCount", "comments", "comment_count"]) ??
    (stats ? pickNumFromObj(stats, ["commentCount", "comments"]) : null)

  const collectCount =
    pickNumFromObj(o, ["collectCount", "collects", "collectedCount", "favoriteCount"]) ??
    (stats ? pickNumFromObj(stats, ["collectCount", "collects"]) : null)

  const videoCandidates = urls.filter(
    (u) => /\.mp4(\?|$)/i.test(u) || u.includes("video") || u.includes("sns-video")
  )
  const imageCandidates = urls.filter(
    (u) =>
      /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(u) ||
      u.includes("imageView") ||
      u.includes("sns-webpic") ||
      u.includes("sns-img") ||
      u.includes("xhscdn.com")
  )

  let videoUrl =
    pickStrFromObj(o, [
      "videoUrl",
      "video_url",
      "video_play_url",
      "playUrl",
      "play_url",
      "mediaUrl",
      "videoAddress",
    ]) ||
    videoCandidates[0] ||
    null
  let downloadUrl =
    pickStrFromObj(o, ["downloadUrl", "download_url", "videoDownloadUrl", "noWatermarkUrl", "mp4Url"]) ||
    videoCandidates.find((u) => /\.mp4/i.test(u)) ||
    null

  const vid = o.video
  if (vid && typeof vid === "object") {
    const v = vid as Record<string, unknown>
    if (!videoUrl) {
      videoUrl =
        pickStrFromObj(v, ["url", "url_720p", "url_1080p", "playUrl", "masterUrl", "downloadUrl"]) || videoUrl
    }
  }

  let thumbnail =
    pickStrFromObj(o, [
      "coverUrl",
      "cover_url",
      "cover",
      "cover_image",
      "coverImage",
      "cover_image_url",
      "video_cover",
      "videoCover",
      "thumbnail",
      "thumb",
      "imageUrl",
      "image_url",
      "picUrl",
      "pic_url",
    ]) ||
    imageCandidates[0] ||
    null
  if (!thumbnail && Array.isArray(o.images) && o.images[0]) {
    const im = o.images[0]
    if (typeof im === "string") thumbnail = normalizeHttpUrl(im)
    else if (im && typeof im === "object") {
      thumbnail = pickStrFromObj(im as Record<string, unknown>, ["url", "original", "thumb", "urlDefault"]) || thumbnail
    }
  }
  if (!thumbnail && Array.isArray(o.image_list) && o.image_list[0]) {
    const im = o.image_list[0]
    if (typeof im === "string") thumbnail = normalizeHttpUrl(im)
    else if (im && typeof im === "object") {
      thumbnail = pickStrFromObj(im as Record<string, unknown>, ["url", "original"]) || thumbnail
    }
  }

  const noteCard = (o.note_card ?? o.noteCard) as Record<string, unknown> | undefined
  if (!thumbnail && noteCard) {
    const cover = noteCard.cover ?? noteCard.cover_image ?? noteCard.coverImage
    if (cover && typeof cover === "object") {
      thumbnail =
        pickStrFromObj(cover as Record<string, unknown>, ["url_default", "urlDefault", "url", "url_pre", "urlPre"]) ||
        thumbnail
    }
  }

  if (!thumbnail && raw && typeof raw === "object") {
    thumbnail = pickXhsThumbnailFromRaw(raw as Record<string, unknown>) || thumbnail
  }

  const mediaType =
    pickStrFromObj(o, ["type", "noteType", "mediaType", "contentType"]) ||
    (o.type != null ? String(o.type) : null)

  const noteCardType = noteCard?.type != null ? String(noteCard.type) : ""
  const modelType = o.model_type != null ? String(o.model_type) : ""

  const tagRaw = o.hashtags ?? o.tags ?? o.tagList
  const hashtags: string[] = []
  if (Array.isArray(tagRaw)) {
    for (const t of tagRaw) {
      if (typeof t === "string" && t.trim()) hashtags.push(t.trim().replace(/^#/, ""))
      else if (t && typeof t === "object") {
        const name = (t as Record<string, unknown>).name ?? (t as Record<string, unknown>).tag
        if (typeof name === "string" && name.trim()) hashtags.push(name.trim().replace(/^#/, ""))
      }
    }
  }

  const typeLower = (mediaType || noteCardType || modelType).toLowerCase()
  const hasVideo =
    Boolean(videoUrl) ||
    typeLower.includes("video") ||
    noteCardType === "video" ||
    modelType === "video" ||
    modelType === "2" ||
    mediaType === "2" ||
    Boolean(o.video) ||
    videoCandidates.length > 0
  const hasImage =
    Boolean(thumbnail) ||
    typeLower.includes("image") ||
    (Array.isArray(o.images) && o.images.length > 0) ||
    imageCandidates.length > 0

  return {
    noteUrl,
    title,
    thumbnail,
    videoUrl,
    downloadUrl,
    likeCount,
    viewCount,
    commentCount,
    collectCount,
    hasVideo,
    hasImage,
    description,
    hashtags: hashtags.slice(0, 12),
    mediaType,
    topLevelKeys,
  }
}

function aggregateMetrics(items: ExtractedItemFields[], mappedCount: number): RunAggregateMetrics {
  const rawCount = items.length
  const withNoteUrl = items.filter((i) => i.noteUrl).length
  const withThumbnail = items.filter((i) => i.thumbnail).length
  const withLikeCount = items.filter((i) => i.likeCount != null).length
  const withViewCount = items.filter((i) => i.viewCount != null).length
  const withVideoUrl = items.filter((i) => i.videoUrl).length
  const withDownloadUrl = items.filter((i) => i.downloadUrl || i.videoUrl).length
  const withDescription = items.filter((i) => i.description && i.description.length > 10).length
  const withHashtags = items.filter((i) => i.hashtags.length > 0).length
  const videoItemCount = items.filter((i) => i.hasVideo).length
  const imageItemCount = items.filter((i) => i.hasImage).length
  const likes = items.map((i) => i.likeCount).filter((n): n is number => n != null)
  const avgLikeCount = likes.length ? Math.round(likes.reduce((a, b) => a + b, 0) / likes.length) : null
  const maxLikeCount = likes.length ? Math.max(...likes) : null

  return {
    rawCount,
    mappedCount,
    withNoteUrl,
    withThumbnail,
    withLikeCount,
    withViewCount,
    withVideoUrl,
    withDownloadUrl,
    withDescription,
    withHashtags,
    videoItemCount,
    imageItemCount,
    videoRatioPct: rawCount ? Math.round((videoItemCount / rawCount) * 100) : 0,
    avgLikeCount,
    maxLikeCount,
  }
}

function collectVideoItems(
  extracted: ExtractedItemFields[],
  mapped: SerpVideoRow[],
  rawItems?: unknown[]
): VideoBenchmarkItem[] {
  const out: VideoBenchmarkItem[] = []
  const seen = new Set<string>()

  const push = (item: VideoBenchmarkItem) => {
    const key = (item.noteUrl || `${item.title}:${item.thumbnail}`).toLowerCase()
    if (!key || key === ":" || seen.has(key)) return
    seen.add(key)
    out.push(item)
  }

  for (const m of mapped) {
    const hasThumb = Boolean(m.thumbnail?.startsWith("http"))
    const hasVideo = Boolean(m.videoUrl?.startsWith("http"))
    const hasNote = Boolean(m.url?.includes("xiaohongshu") || m.url?.includes("xhslink"))
    if (!hasThumb && !hasVideo && !hasNote) continue
    push({
      title: m.title && m.title !== "(제목 없음)" ? m.title : "(제목 없음)",
      thumbnail: hasThumb ? m.thumbnail : "",
      noteUrl: m.url || "",
      videoUrl: hasVideo ? m.videoUrl : "",
      likeCount: m.likeCount ?? null,
      viewCount: m.viewCount ?? null,
      author: m.author || null,
    })
  }

  for (let i = 0; i < extracted.length; i++) {
    const e = extracted[i]!
    const m = mapped[i]
    const raw = rawItems?.[i]
    if (!e.hasVideo && !e.videoUrl && !e.thumbnail && !e.hasImage) continue
    let thumbnail = e.thumbnail || m?.thumbnail || ""
    if (!thumbnail.startsWith("http") && raw && typeof raw === "object") {
      const fromRaw = pickXhsThumbnailFromRaw(raw as Record<string, unknown>)
      if (fromRaw.startsWith("http")) thumbnail = fromRaw
    }
    push({
      title: e.title || m?.title || "(제목 없음)",
      thumbnail,
      noteUrl: e.noteUrl || m?.url || "",
      videoUrl: e.videoUrl || e.downloadUrl || m?.videoUrl || "",
      likeCount: e.likeCount ?? m?.likeCount ?? null,
      viewCount: e.viewCount ?? m?.viewCount ?? null,
      author: m?.author || null,
    })
  }

  return out.filter((v) => v.thumbnail || v.videoUrl || v.noteUrl).slice(0, 36)
}

function toBenchmarkResult(
  actor: XhsBenchmarkActorDef,
  keyword: string,
  input: Record<string, unknown>,
  run: XhsApifyRawRunResult
): ActorKeywordBenchmarkResult {
  const extracted = run.rawItems.map(extractItemFields)
  const samples: BenchmarkSampleItem[] = run.rawItems.slice(0, 12).map((raw, idx) => {
    const fields = extractItemFields(raw)
    const mapped = run.mappedRows[idx] ?? null
    return {
      ...fields,
      title: fields.title || mapped?.title || null,
      thumbnail: fields.thumbnail || mapped?.thumbnail || null,
      noteUrl: fields.noteUrl || mapped?.url || null,
      videoUrl: fields.videoUrl || mapped?.videoUrl || null,
      mapped,
    }
  })
  let videoItems = collectVideoItems(extracted, run.mappedRows, run.rawItems)
  videoItems = videoItems.map((v) => {
    if (v.thumbnail?.startsWith("http")) return v
    for (let i = 0; i < run.rawItems.length; i++) {
      const raw = run.rawItems[i]
      if (!raw || typeof raw !== "object") continue
      const e = extracted[i]
      const m = run.mappedRows[i]
      const noteMatch =
        v.noteUrl &&
        ((e?.noteUrl && e.noteUrl === v.noteUrl) ||
          (m?.url && (m.url === v.noteUrl || m.url.split("?")[0] === v.noteUrl.split("?")[0])))
      const videoMatch =
        v.videoUrl &&
        ((e?.videoUrl && e.videoUrl === v.videoUrl) || (m?.videoUrl && m.videoUrl === v.videoUrl))
      if (!noteMatch && !videoMatch) continue
      const thumb = pickXhsThumbnailFromRaw(raw as Record<string, unknown>)
      if (thumb.startsWith("http")) return { ...v, thumbnail: thumb }
    }
    const hit = run.mappedRows.find(
      (m) =>
        m.url &&
        v.noteUrl &&
        (m.url === v.noteUrl || m.url.split("?")[0] === v.noteUrl.split("?")[0])
    )
    if (hit?.thumbnail?.startsWith("http")) return { ...v, thumbnail: hit.thumbnail }
    return v
  })

  return {
    actorId: actor.id,
    actorSlug: run.actor,
    actorLabel: actor.label,
    role: actor.role,
    keyword,
    durationMs: run.durationMs,
    durationSec: Math.round(run.durationMs / 100) / 10,
    error: run.error,
    httpStatus: run.httpStatus,
    input,
    metrics: {
      ...aggregateMetrics(extracted, run.mappedRows.length),
      videoItemCount: videoItems.length,
      videoRatioPct: extracted.length
        ? Math.round((videoItems.length / Math.max(extracted.length, run.mappedRows.length)) * 100)
        : videoItems.length > 0
          ? 100
          : 0,
    },
    samples,
    videoItems,
    rawKeysHint: extracted[0]?.topLevelKeys ?? [],
  }
}

async function fetchActorStoreMeta(token: string, actor: XhsBenchmarkActorDef): Promise<ActorStoreMeta> {
  try {
    const pathId = actor.slug.includes("~") ? actor.slug : actor.slug.replace("/", "~")
    const r = await fetch(`https://api.apify.com/v2/acts/${encodeURIComponent(pathId)}?token=${encodeURIComponent(token)}`, {
      signal: AbortSignal.timeout(10_000),
    })
    if (!r.ok) {
      return {
        actorId: actor.id,
        modifiedAt: null,
        version: null,
        statsNote: r.status === 404 ? "Actor 슬러그 없음 (404)" : `메타 조회 HTTP ${r.status}`,
      }
    }
    const j = (await r.json()) as {
      data?: {
        modifiedAt?: string
        taggedBuilds?: { latest?: { buildNumber?: string } }
        stats?: { totalRuns?: number }
      }
    }
    const d = j.data
    return {
      actorId: actor.id,
      modifiedAt: d?.modifiedAt ?? null,
      version: d?.taggedBuilds?.latest?.buildNumber != null ? String(d.taggedBuilds.latest.buildNumber) : null,
      statsNote: d?.stats?.totalRuns != null ? `총 런 ${d.stats.totalRuns.toLocaleString()}` : null,
    }
  } catch {
    return { actorId: actor.id, modifiedAt: null, version: null, statsNote: "메타 조회 실패" }
  }
}

function buildSummary(
  actors: XhsBenchmarkActorDef[],
  results: ActorKeywordBenchmarkResult[]
): XhsBenchmarkReport["summary"] {
  return actors
    .filter((a) => a.role !== "download")
    .map((actor) => {
      const rows = results.filter((r) => r.actorId === actor.id)
      const n = rows.length || 1
      const totalRaw = rows.reduce((s, r) => s + r.metrics.rawCount, 0)
      const totalMapped = rows.reduce((s, r) => s + r.metrics.mappedCount, 0)
      const avgDurationSec = Math.round(rows.reduce((s, r) => s + r.durationSec, 0) / n)
      const avgVideoRatioPct = Math.round(rows.reduce((s, r) => s + r.metrics.videoRatioPct, 0) / n)
      const likeCoveragePct =
        totalRaw > 0
          ? Math.round((rows.reduce((s, r) => s + r.metrics.withLikeCount, 0) / totalRaw) * 100)
          : 0
      const thumbCoveragePct =
        totalRaw > 0
          ? Math.round((rows.reduce((s, r) => s + r.metrics.withThumbnail, 0) / totalRaw) * 100)
          : 0
      const downloadCoveragePct =
        totalRaw > 0
          ? Math.round((rows.reduce((s, r) => s + r.metrics.withDownloadUrl, 0) / totalRaw) * 100)
          : 0
      const totalVideoItems = rows.reduce((s, r) => s + r.videoItems.length, 0)

      /** 간단 점수: 결과수 + 필드 커버리지 - 속도 페널티 */
      const score =
        totalMapped * 3 +
        totalRaw +
        totalVideoItems * 8 +
        likeCoveragePct * 0.5 +
        thumbCoveragePct * 0.3 +
        downloadCoveragePct * 0.8 +
        avgVideoRatioPct * 0.4 -
        avgDurationSec * 0.15

      return {
        actorId: actor.id,
        actorSlug: actor.slug,
        actorLabel: actor.label,
        role: actor.role,
        rank: actor.rank,
        totalRaw,
        totalMapped,
        avgDurationSec,
        avgVideoRatioPct,
        likeCoveragePct,
        thumbCoveragePct,
        downloadCoveragePct,
        score: Math.round(score * 10) / 10,
        searchable: actor.searchable,
        storeRole: actor.storeRole,
        totalVideoItems,
      }
    })
    .sort((a, b) => b.score - a.score)
}

export async function runXhsActorBenchmark(args: {
  apifyToken: string
  keywords?: string[]
  actorIds?: string[]
  actorSlugs?: string[]
  searchableOnly?: boolean
  testDownload?: boolean
  batchOffset?: number
  batchSize?: number
}): Promise<XhsBenchmarkReport> {
  const keywords = (args.keywords?.length ? args.keywords : [...XHS_BENCHMARK_DEFAULT_KEYWORDS])
    .map((k) => k.trim())
    .filter(Boolean)

  let allActors = resolveActors(args)
  if (args.searchableOnly) {
    allActors = allActors.filter((a) => a.searchable !== false && a.role !== "download")
  }

  const batchOffset = Math.max(0, args.batchOffset ?? 0)
  const batchSize = Math.min(10, Math.max(1, args.batchSize ?? allActors.length))
  const actors = allActors.slice(batchOffset, batchOffset + batchSize)
  const hasMore = batchOffset + batchSize < allActors.length

  const searchActors = actors.filter((a) => a.role !== "download")
  const downloadActor = allActors.find((a) => a.role === "download")

  const actorMeta = await Promise.all(actors.map((a) => fetchActorStoreMeta(args.apifyToken, a)))

  const results: ActorKeywordBenchmarkResult[] = []
  const noteUrlsForDownload: string[] = []

  for (const actor of searchActors) {
    for (const keyword of keywords) {
      const input = buildSearchInput(actor, keyword)
      const run = await runXhsApifyActorRaw(args.apifyToken, actor.slug, input)
      const row = toBenchmarkResult(actor, keyword, input, run)
      results.push(row)
      for (const s of row.samples) {
        if (s.noteUrl && !noteUrlsForDownload.includes(s.noteUrl)) {
          noteUrlsForDownload.push(s.noteUrl)
        }
      }
      for (const m of run.mappedRows) {
        if (m.url && !noteUrlsForDownload.includes(m.url)) noteUrlsForDownload.push(m.url)
      }
    }
  }

  const downloadResults: ActorKeywordBenchmarkResult[] = []
  if (args.testDownload && downloadActor && noteUrlsForDownload.length > 0 && !hasMore) {
    const urls = noteUrlsForDownload.slice(0, 3)
    const run = await runXhsDownloadActorRaw(args.apifyToken, downloadActor.slug, urls)
    const input = { links: urls }
    downloadResults.push({
      ...toBenchmarkResult(downloadActor, `(다운로드 ${urls.length}URL)`, input, run),
      keyword: urls.join(" | ").slice(0, 120),
    })
  }

  const summary = buildSummary(actors, results)
  const top = summary[0]
  const notice = top
    ? `배치 ${batchOffset / batchSize + 1} · ${results.length}회 호출 · 1위 ${top.actorLabel} (${top.score}점)${hasMore ? " · 다음 배치 있음" : ""}`
    : `벤치마크 결과 없음 (배치 ${batchOffset / batchSize + 1})`

  return {
    keywords,
    actors,
    results,
    downloadResults,
    actorMeta,
    summary,
    notice,
    batch: {
      offset: batchOffset,
      batchSize,
      totalActors: allActors.length,
      hasMore,
    },
  }
}

/** 서비스 선정 Actor만 반환 (socialdatax) */
export async function listAllXhsBenchmarkActors(_searchableOnly = true): Promise<XhsBenchmarkActorDef[]> {
  return XHS_BENCHMARK_ACTORS
}
