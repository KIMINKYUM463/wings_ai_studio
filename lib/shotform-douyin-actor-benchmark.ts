/**
 * ?? Apify Actor ???? ? ?? Actor?
 */

import {
  pickDouyinThumbnailFromRaw,
  runDouyinApifyActorRaw,
  type DouyinApifyRawRunResult,
} from "@/lib/apify-product-search"
import { buildDouyinBenchmarkSearchInput } from "@/lib/apify-douyin-benchmark-input"
import {
  discoverDouyinStoreActors,
  discoveredDouyinToBenchmarkDef,
  type DiscoveredDouyinActor,
} from "@/lib/apify-douyin-store-discovery"
import { DOUYIN_VIDEO_APIFY_ACTORS, isDouyinVideoApifyActor, normalizeDouyinVideoActorSlug } from "@/lib/apify-douyin-video-actors"
import { isRelevantToKeyword } from "@/lib/shotform-mvp-keyword-relevance"
import type { SerpVideoRow } from "@/lib/serpapi-product-search"

export type DouyinActorRole = "search" | "download"

export type DouyinBenchmarkActorDef = {
  id: string
  slug: string
  label: string
  role: DouyinActorRole
  rank: number
  description: string
  storeUrl: string
  searchable?: boolean
  storeRole?: string
  stats?: DiscoveredDouyinActor["stats"]
}

export const DOUYIN_BENCHMARK_ACTORS: DouyinBenchmarkActorDef[] = DOUYIN_VIDEO_APIFY_ACTORS.map((a, i) => ({
  id: a.slug.replace(/\//g, "--"),
  slug: a.slug,
  label: a.label,
  role: "search" as const,
  rank: i + 1,
  description: `???? ?? ~${a.videoRatioPct}% ? ??? ?? ?`,
  storeUrl: `https://apify.com/${a.slug}`,
  searchable: true,
}))

export const DOUYIN_BENCHMARK_DEFAULT_KEYWORDS = [
  "车载吸尘器",
  "无线车载吸尘器",
  "厨房神器",
  "便携式搅拌机",
] as const

export type ExtractedItemFields = {
  pageUrl: string | null
  title: string | null
  thumbnail: string | null
  videoUrl: string | null
  likeCount: number | null
  viewCount: number | null
  hasVideo: boolean
  hasThumbnail: boolean
  topLevelKeys: string[]
}

export type RunAggregateMetrics = {
  rawCount: number
  mappedCount: number
  withPageUrl: number
  withThumbnail: number
  withLikeCount: number
  withViewCount: number
  withVideoUrl: number
  videoItemCount: number
  videoRatioPct: number
  avgLikeCount: number | null
  maxLikeCount: number | null
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
  role: DouyinActorRole
  keyword: string
  durationMs: number
  durationSec: number
  error: string | null
  httpStatus: number | null
  input: Record<string, unknown>
  metrics: RunAggregateMetrics
  samples: Array<ExtractedItemFields & { noteUrl?: string | null; mapped?: SerpVideoRow | null }>
  videoItems: VideoBenchmarkItem[]
  rawKeysHint: string[]
}

export type DouyinBenchmarkReport = {
  keywords: string[]
  actors: DouyinBenchmarkActorDef[]
  results: ActorKeywordBenchmarkResult[]
  actorMeta: Array<{
    actorId: string
    modifiedAt: string | null
    version: string | null
    statsNote: string | null
  }>
  summary: Array<{
    actorId: string
    actorSlug: string
    actorLabel: string
    role: DouyinActorRole
    rank: number
    totalRaw: number
    totalMapped: number
    avgDurationSec: number
    avgVideoRatioPct: number
    likeCoveragePct: number
    thumbCoveragePct: number
    score: number
    searchable?: boolean
    storeRole?: string
    totalVideoItems: number
  }>
  notice: string
  batch?: { offset: number; batchSize: number; totalActors: number; hasMore: boolean }
}

export { discoverDouyinStoreActors, discoveredDouyinToBenchmarkDef }
export type { DiscoveredDouyinActor }

function slugToId(slug: string): string {
  return slug.replace(/\//g, "--")
}

function normalizeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null
  const s = raw.trim()
  if (!s) return null
  if (s.startsWith("//")) return `https:${s}`
  if (s.startsWith("http://")) return `https://${s.slice(7)}`
  return s.startsWith("http") ? s : null
}

function pickStr(o: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = o[k]
    if (typeof v === "string" && v.trim()) return normalizeHttpUrl(v.trim())
  }
  return null
}

function pickNum(o: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = o[k]
    if (typeof v === "number" && Number.isFinite(v)) return Math.round(v)
    if (typeof v === "string" && /^\d+$/.test(v.trim())) return parseInt(v.trim(), 10)
  }
  return null
}

function isDouyinPageUrl(url: string): boolean {
  return /douyin\.com|iesdouyin\.com|v\.douyin\.com/.test(url)
}

function extractItemFields(raw: unknown): ExtractedItemFields {
  const topLevelKeys =
    raw && typeof raw === "object" && !Array.isArray(raw) ? Object.keys(raw as Record<string, unknown>).slice(0, 24) : []

  if (!raw || typeof raw !== "object") {
    return {
      pageUrl: null,
      title: null,
      thumbnail: null,
      videoUrl: null,
      likeCount: null,
      viewCount: null,
      hasVideo: false,
      hasThumbnail: false,
      topLevelKeys,
    }
  }

  const o = raw as Record<string, unknown>
  let pageUrl = pickStr(o, ["url", "shareUrl", "share_url", "videoUrl", "link"])
  if (!pageUrl) {
    const id =
      pickStr(o, ["aweme_id", "awemeId", "videoId", "id"]) ||
      (typeof o.id === "string" && /^\d{10,22}$/.test(o.id.trim()) ? o.id.trim() : null)
    if (id) pageUrl = `https://www.douyin.com/video/${id}`
  }

  const title =
    pickStr(o, ["desc", "description", "text", "caption", "title", "previewTitle"])?.slice(0, 200) || null

  const thumbnail = pickDouyinThumbnailFromRaw(o)
  const videoUrl = pickStr(o, ["playUrl", "videoUrl", "play_url"]) || null

  const stats = o.statistics as Record<string, unknown> | undefined
  const likeCount =
    pickNum(o, ["likeCount", "likes", "diggCount", "digg_count"]) ??
    (stats ? pickNum(stats, ["likeCount", "diggCount"]) : null)
  const viewCount =
    pickNum(o, ["viewCount", "views", "playCount", "play_count"]) ??
    (stats ? pickNum(stats, ["viewCount", "playCount"]) : null)

  const hasVideo = Boolean(videoUrl) || Boolean(o.video) || Boolean(o.videoMeta)
  const hasThumbnail = Boolean(thumbnail)

  return {
    pageUrl: pageUrl && isDouyinPageUrl(pageUrl) ? pageUrl : pageUrl,
    title,
    thumbnail,
    videoUrl,
    likeCount,
    viewCount,
    hasVideo,
    hasThumbnail,
    topLevelKeys,
  }
}

function aggregateMetrics(items: ExtractedItemFields[], mappedCount: number): RunAggregateMetrics {
  const rawCount = items.length
  const withPageUrl = items.filter((i) => i.pageUrl).length
  const withThumbnail = items.filter((i) => i.thumbnail).length
  const withLikeCount = items.filter((i) => i.likeCount != null).length
  const withViewCount = items.filter((i) => i.viewCount != null).length
  const withVideoUrl = items.filter((i) => i.videoUrl).length
  const videoItemCount = items.filter((i) => i.hasVideo || i.videoUrl).length
  const likes = items.map((i) => i.likeCount).filter((n): n is number => n != null)
  return {
    rawCount,
    mappedCount,
    withPageUrl,
    withThumbnail,
    withLikeCount,
    withViewCount,
    withVideoUrl,
    videoItemCount,
    videoRatioPct: rawCount ? Math.round((videoItemCount / rawCount) * 100) : 0,
    avgLikeCount: likes.length ? Math.round(likes.reduce((a, b) => a + b, 0) / likes.length) : null,
    maxLikeCount: likes.length ? Math.max(...likes) : null,
  }
}

function collectVideoItems(extracted: ExtractedItemFields[], mapped: SerpVideoRow[]): VideoBenchmarkItem[] {
  const out: VideoBenchmarkItem[] = []
  const seen = new Set<string>()

  const push = (item: VideoBenchmarkItem) => {
    const key = (item.noteUrl || `${item.title}:${item.thumbnail}`).toLowerCase()
    if (!key || key === ":" || seen.has(key)) return
    seen.add(key)
    out.push(item)
  }

  for (const m of mapped) {
    if (m.platform !== "douyin" && !m.url?.includes("douyin")) continue
    push({
      title: m.title || "(제목 없음)",
      thumbnail: m.thumbnail || "",
      noteUrl: m.url || "",
      videoUrl: m.videoUrl || "",
      likeCount: m.likeCount ?? null,
      viewCount: m.viewCount ?? null,
      author: m.author || null,
    })
  }

  for (let i = 0; i < extracted.length; i++) {
    const e = extracted[i]!
    const m = mapped[i]
    if (!e.hasVideo && !e.videoUrl && !e.thumbnail && !e.pageUrl) continue
    push({
      title: e.title || m?.title || "(제목 없음)",
      thumbnail: e.thumbnail || m?.thumbnail || "",
      noteUrl: e.pageUrl || m?.url || "",
      videoUrl: e.videoUrl || m?.videoUrl || "",
      likeCount: e.likeCount ?? m?.likeCount ?? null,
      viewCount: e.viewCount ?? m?.viewCount ?? null,
      author: m?.author || null,
    })
  }

  return out.filter((v) => v.thumbnail || v.videoUrl || v.noteUrl).slice(0, 36)
}

function toBenchmarkResult(
  actor: DouyinBenchmarkActorDef,
  keyword: string,
  input: Record<string, unknown>,
  run: DouyinApifyRawRunResult
): ActorKeywordBenchmarkResult {
  const extracted = run.rawItems.map(extractItemFields)
  const samples = run.rawItems.slice(0, 12).map((raw, idx) => {
    const fields = extractItemFields(raw)
    const mapped = run.mappedRows[idx] ?? null
    return {
      ...fields,
      title: fields.title || mapped?.title || null,
      thumbnail: fields.thumbnail || mapped?.thumbnail || null,
      pageUrl: fields.pageUrl || mapped?.url || null,
      noteUrl: fields.pageUrl || mapped?.url || null,
      videoUrl: fields.videoUrl || mapped?.videoUrl || null,
      mapped,
    }
  })
  const videoItems = collectVideoItems(extracted, run.mappedRows).filter((v) =>
    isRelevantToKeyword(`${v.title} ${v.author || ""}`, keyword)
  )

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

function resolveActors(args: {
  actorIds?: string[]
  actorSlugs?: string[]
  searchableOnly?: boolean
}): DouyinBenchmarkActorDef[] {
  if (args.actorSlugs?.length) {
    return args.actorSlugs
      .filter(isDouyinVideoApifyActor)
      .map((slug) => DOUYIN_BENCHMARK_ACTORS.find((a) => a.slug === normalizeDouyinVideoActorSlug(slug)))
      .filter((a): a is DouyinBenchmarkActorDef => !!a)
  }

  let actors = DOUYIN_BENCHMARK_ACTORS.filter((a) => !args.actorIds?.length || args.actorIds.includes(a.id))
  if (args.searchableOnly !== false) {
    actors = actors.filter((a) => a.searchable !== false && a.role !== "download")
  }
  return actors
}

async function fetchActorStoreMeta(token: string, actor: DouyinBenchmarkActorDef) {
  try {
    const pathId = actor.slug.replace("/", "~")
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
      data?: { modifiedAt?: string; taggedBuilds?: { latest?: { buildNumber?: string } }; stats?: { totalRuns?: number } }
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

function buildSummary(actors: DouyinBenchmarkActorDef[], results: ActorKeywordBenchmarkResult[]) {
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
        totalRaw > 0 ? Math.round((rows.reduce((s, r) => s + r.metrics.withLikeCount, 0) / totalRaw) * 100) : 0
      const thumbCoveragePct =
        totalRaw > 0 ? Math.round((rows.reduce((s, r) => s + r.metrics.withThumbnail, 0) / totalRaw) * 100) : 0
      const totalVideoItems = rows.reduce((s, r) => s + r.videoItems.length, 0)
      const score =
        totalMapped * 3 +
        totalRaw +
        totalVideoItems * 8 +
        likeCoveragePct * 0.5 +
        thumbCoveragePct * 0.3 +
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
        score: Math.round(score * 10) / 10,
        searchable: actor.searchable,
        storeRole: actor.storeRole,
        totalVideoItems,
      }
    })
    .sort((a, b) => b.score - a.score)
}

export async function runDouyinActorBenchmark(args: {
  apifyToken: string
  keywords?: string[]
  actorIds?: string[]
  actorSlugs?: string[]
  searchableOnly?: boolean
  batchOffset?: number
  batchSize?: number
}): Promise<DouyinBenchmarkReport> {
  const keywords = (args.keywords?.length ? args.keywords : [...DOUYIN_BENCHMARK_DEFAULT_KEYWORDS])
    .map((k) => k.trim())
    .filter(Boolean)

  let allActors = resolveActors(args)
  if (args.searchableOnly) {
    allActors = allActors.filter((a) => a.searchable !== false && a.role !== "download")
  }

  const batchOffset = Math.max(0, args.batchOffset ?? 0)
  const batchSize = Math.min(8, Math.max(1, args.batchSize ?? allActors.length))
  const actors = allActors.slice(batchOffset, batchOffset + batchSize)
  const hasMore = batchOffset + batchSize < allActors.length
  const searchActors = actors.filter((a) => a.role !== "download")

  const actorMeta = await Promise.all(actors.map((a) => fetchActorStoreMeta(args.apifyToken, a)))
  const results: ActorKeywordBenchmarkResult[] = []

  for (const actor of searchActors) {
    for (const keyword of keywords) {
      const input = buildDouyinBenchmarkSearchInput(actor.slug, keyword)
      const run = await runDouyinApifyActorRaw(args.apifyToken, actor.slug, input)
      results.push(toBenchmarkResult(actor, keyword, input, run))
    }
  }

  const summary = buildSummary(actors, results)
  const top = summary[0]
  const notice = top
    ? `배치 ${Math.floor(batchOffset / batchSize) + 1} · ${results.length}회 호출 · 1위 ${top.actorLabel} (${top.score}점)${hasMore ? " · 다음 배치 있음" : ""}`
    : `벤치마크 결과 없음`

  return {
    keywords,
    actors,
    results,
    actorMeta,
    summary,
    notice,
    batch: { offset: batchOffset, batchSize, totalActors: allActors.length, hasMore },
  }
}

/** ??? ?? Actor? ?? (Store ?? ?? ??) */
export async function listAllDouyinBenchmarkActors(_searchableOnly = true): Promise<DouyinBenchmarkActorDef[]> {
  return DOUYIN_BENCHMARK_ACTORS
}
