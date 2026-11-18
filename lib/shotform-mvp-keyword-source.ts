/**
 * MVP — 키워드로 TikHub 4개 플랫폼 동시 검색
 * 抖音·小红书는 中文 검색어, TikTok·YouTube Shorts는 한국어 키워드로 찾는다.
 */

import {
  resolveTikhubVideo,
  tikhubErrorMessage,
  searchDouyinOnTikhub,
  searchTiktokOnTikhub,
  searchXiaohongshuOnTikhub,
  searchYoutubeShortsOnTikhub,
  type TikhubSearchResult,
} from "@/lib/tikhub"
import {
  filterRowsByAnyKeyword,
  rowRelevanceText,
  scoreTextKeywordRelevance,
} from "@/lib/shotform-mvp-keyword-relevance"
import type { KoZhKeywordPair } from "@/lib/shotform-xhs-ko-zh-keywords"
import { remixSourceFitScore } from "@/lib/shotform-auto-edit-product-filter"
import type { SerpVideoRow } from "@/lib/serpapi-product-search"

export type MvpKeywordVideo = SerpVideoRow & { relevanceScore?: number }

export type MvpPlatformSourceResult = {
  videos: MvpKeywordVideo[]
  /** 저장 프로젝트 호환용 이름 — 실제로는 TikHub 호출 수 */
  apifyHttpCalls: number
  apifyActor: string
  keywordsUsed: string[]
  notice: string
}

export type MvpKeywordSourceResult = {
  keywordPairs: KoZhKeywordPair[]
  searchQueries: string[]
  douyin: MvpPlatformSourceResult
  xhs: MvpPlatformSourceResult
  /** TikTok·YouTube 추가 전에 저장된 프로젝트에는 없다 */
  tiktok?: MvpPlatformSourceResult
  youtube?: MvpPlatformSourceResult
  notice: string
}

export const MVP_KEYWORD_PLATFORMS = ["douyin", "xiaohongshu", "tiktok", "youtube"] as const
export type MvpKeywordPlatform = (typeof MVP_KEYWORD_PLATFORMS)[number]

const RESULT_KEY = { douyin: "douyin", xiaohongshu: "xhs", tiktok: "tiktok", youtube: "youtube" } as const

const PLATFORM_LABEL: Record<MvpKeywordPlatform, string> = {
  douyin: "抖音",
  xiaohongshu: "小红书",
  tiktok: "TikTok",
  youtube: "YouTube",
}

export function mvpPlatformResult(
  result: MvpKeywordSourceResult,
  platform: MvpKeywordPlatform
): MvpPlatformSourceResult | undefined {
  return result[RESULT_KEY[platform]]
}

export function withMvpPlatformResult(
  result: MvpKeywordSourceResult,
  platform: MvpKeywordPlatform,
  value: MvpPlatformSourceResult
): MvpKeywordSourceResult {
  return { ...result, [RESULT_KEY[platform]]: value }
}

/** 小红书 「영상 다시 가져오기」 최대 재시도 횟수 (재시도마다 다음 페이지) */
export const MVP_XHS_PLATFORM_RETRY_MAX = 5

/** YouTube는 검색 응답에 재생 주소가 없어 관련도 상위만 재생 주소를 조회한다 (TikHub 호출 1회씩) */
const YOUTUBE_RESOLVE_LIMIT = 8
/** 다른 플랫폼 검색과 동시에 돌기 때문에 TikHub 동시 호출 수를 제한한다 */
const YOUTUBE_RESOLVE_CONCURRENCY = 4

const SOURCE_LABEL = "TikHub"

function scoreRow(row: SerpVideoRow, keywords: string[]): number {
  const text = rowRelevanceText(row)
  return Math.max(0, ...keywords.map((k) => scoreTextKeywordRelevance(text, k)))
}

function rankKey(v: MvpKeywordVideo): number {
  return (v.relevanceScore ?? 0) + remixSourceFitScore(v) + Math.log10(1 + (v.likeCount ?? 0)) / 2
}

/** 키워드 관련도 + 리믹스 적합도(짧은 단일 제품 시연 우선) + 좋아요 순 */
export function sortRemixSourceVideos<T extends MvpKeywordVideo>(videos: T[]): T[] {
  return [...videos].sort((a, b) => rankKey(b) - rankKey(a))
}

/**
 * TikTok·YouTube는 한국어로 검색해도 영어 제목 영상이 많이 섞여 나와 제목 키워드 필터를 걸면 관련 영상이 대부분 빠진다.
 * 플랫폼 검색 순위를 믿고 정렬만 한다.
 */
const TITLE_FILTERED_PLATFORMS = new Set<MvpKeywordPlatform>(["douyin", "xiaohongshu"])

function rankVideos(platform: MvpKeywordPlatform, rows: SerpVideoRow[], keywords: string[], minScore = 8): MvpKeywordVideo[] {
  const unique = new Map<string, SerpVideoRow>()
  for (const r of rows) if (r.videoUrl?.startsWith("http") && !unique.has(r.url)) unique.set(r.url, r)
  const scored: MvpKeywordVideo[] = [...unique.values()].map((r) => ({ ...r, relevanceScore: scoreRow(r, keywords) }))
  if (!TITLE_FILTERED_PLATFORMS.has(platform)) return sortRemixSourceVideos(scored)

  const filtered = filterRowsByAnyKeyword(scored, keywords, minScore) as MvpKeywordVideo[]
  if (filtered.length > 0) return sortRemixSourceVideos(filtered)
  return sortRemixSourceVideos(scored).slice(0, Math.min(8, scored.length))
}

function buildPlatformResult(
  platform: MvpKeywordPlatform,
  search: TikhubSearchResult,
  queries: string[]
): MvpPlatformSourceResult {
  const videos = rankVideos(platform, search.rows, queries)
  const warn = search.warnings.length ? ` · ${search.warnings.join(" · ")}` : ""
  return {
    videos,
    apifyHttpCalls: search.httpCalls,
    apifyActor: SOURCE_LABEL,
    keywordsUsed: search.keywordsUsed,
    notice:
      videos.length === 0
        ? `${PLATFORM_LABEL[platform]} 영상 0건 — 키워드를 바꿔 보세요. (검색 결과 ${search.rows.length}건)${warn}`
        : `${SOURCE_LABEL} ${search.httpCalls}회 · 영상 ${videos.length}건 · ${search.keywordsUsed.join(" · ")}${warn}`,
  }
}

function failedPlatformResult(platform: MvpKeywordPlatform, error: unknown): MvpPlatformSourceResult {
  return {
    videos: [],
    apifyHttpCalls: 0,
    apifyActor: SOURCE_LABEL,
    keywordsUsed: [],
    notice: `${PLATFORM_LABEL[platform]} 검색 실패 — ${error instanceof Error ? error.message : String(error)}`,
  }
}

function uniqueQueries(queries: string[]): string[] {
  return [...new Set(queries.map((k) => k.trim()).filter(Boolean))].slice(0, 3)
}

/** 중국 플랫폼은 中文 검색어, 글로벌 플랫폼은 한국어 원문 키워드 */
function platformQueries(platform: MvpKeywordPlatform, searchQueries: string[], keywordPairs: KoZhKeywordPair[]): string[] {
  const global = platform === "tiktok" || platform === "youtube"
  const queries = uniqueQueries(global ? keywordPairs.map((p) => p.ko) : searchQueries)
  if (queries.length) return queries
  if (global && searchQueries.length) return uniqueQueries(searchQueries)
  throw new Error(global ? "검색할 키워드가 없습니다." : "검색할 중국어 키워드가 없습니다.")
}

/** 小红书: 영상이 나올 때까지 다음 페이지로 재검색 */
async function searchXhsWithRetries(
  tikhubKey: string,
  queries: string[],
  maxAttempts: number
): Promise<MvpPlatformSourceResult> {
  let calls = 0
  let last: MvpPlatformSourceResult | null = null
  for (let page = 1; page <= maxAttempts; page++) {
    const search = await searchXiaohongshuOnTikhub(tikhubKey, queries, page)
    calls += search.httpCalls
    last = buildPlatformResult("xiaohongshu", search, queries)
    last.apifyHttpCalls = calls
    if (last.videos.length > 0) {
      if (page > 1) last.notice += ` · ${page}페이지에서 찾음`
      return last
    }
  }
  return last!
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

/** YouTube Shorts 검색 → 관련도·조회수 상위만 재생 주소 조회 (실패한 영상은 제외) */
async function searchYoutubeWithStreams(tikhubKey: string, queries: string[]): Promise<TikhubSearchResult> {
  const search = await searchYoutubeShortsOnTikhub(tikhubKey, queries)
  const byUrl = new Map(search.rows.map((r) => [r.url, r]))
  const top = [...byUrl.values()]
    .map((row) => ({ row, score: scoreRow(row, queries) + Math.log10(1 + (row.viewCount ?? 0)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, YOUTUBE_RESOLVE_LIMIT)
    .map((x) => x.row)
  const resolveOne = async (row: SerpVideoRow): Promise<SerpVideoRow | null> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const stream = await resolveTikhubVideo(tikhubKey, row.url)
        if (stream?.videoUrl) return { ...row, videoUrl: stream.videoUrl, durationSec: stream.durationSec ?? null }
      } catch (e) {
        if (attempt === 1) console.warn("[mvp-keyword-source] YouTube 재생 주소 조회 실패:", row.url, tikhubErrorMessage(e))
      }
    }
    return null
  }
  const resolved = await mapWithConcurrency(top, YOUTUBE_RESOLVE_CONCURRENCY, resolveOne)
  return {
    ...search,
    rows: resolved.filter((r): r is SerpVideoRow => r !== null),
    httpCalls: search.httpCalls + top.length,
  }
}

async function searchPlatform(
  platform: MvpKeywordPlatform,
  queries: string[],
  tikhubKey: string,
  xhsMaxAttempts: number
): Promise<MvpPlatformSourceResult> {
  switch (platform) {
    case "douyin":
      return buildPlatformResult(platform, await searchDouyinOnTikhub(tikhubKey, queries), queries)
    case "xiaohongshu":
      return searchXhsWithRetries(tikhubKey, queries, xhsMaxAttempts)
    case "tiktok":
      return buildPlatformResult(platform, await searchTiktokOnTikhub(tikhubKey, queries), queries)
    case "youtube":
      return buildPlatformResult(platform, await searchYoutubeWithStreams(tikhubKey, queries), queries)
  }
}

/** 단일 플랫폼만 재검색 */
export async function runMvpKeywordPlatformSearch(args: {
  platform: MvpKeywordPlatform
  searchQueries: string[]
  keywordPairs: KoZhKeywordPair[]
  tikhubKey: string
  maxAttempts?: number
}): Promise<MvpPlatformSourceResult> {
  const queries = platformQueries(args.platform, args.searchQueries, args.keywordPairs)
  const maxAttempts = Math.max(1, Math.min(args.maxAttempts ?? 1, MVP_XHS_PLATFORM_RETRY_MAX))
  return searchPlatform(args.platform, queries, args.tikhubKey, maxAttempts)
}

/** 4개 플랫폼 병렬 검색 (일부가 실패해도 나머지 결과는 보여줌) */
export async function runMvpKeywordSourceSearch(args: {
  searchQueries: string[]
  keywordPairs: KoZhKeywordPair[]
  tikhubKey: string
}): Promise<MvpKeywordSourceResult> {
  const searchQueries = uniqueQueries(args.searchQueries)
  const settled = await Promise.allSettled(
    MVP_KEYWORD_PLATFORMS.map((p) =>
      searchPlatform(p, platformQueries(p, searchQueries, args.keywordPairs), args.tikhubKey, 1)
    )
  )
  const firstError = settled.find((s): s is PromiseRejectedResult => s.status === "rejected")
  if (firstError && settled.every((s) => s.status === "rejected")) {
    throw firstError.reason instanceof Error ? firstError.reason : new Error(String(firstError.reason))
  }
  const results = settled.map((s, i) =>
    s.status === "fulfilled" ? s.value : failedPlatformResult(MVP_KEYWORD_PLATFORMS[i]!, s.reason)
  )
  const [douyin, xhs, tiktok, youtube] = results as [MvpPlatformSourceResult, ...MvpPlatformSourceResult[]]

  const keywordLabel = [...new Set([...searchQueries, ...args.keywordPairs.map((p) => p.ko)])].join(" · ")
  const counts = MVP_KEYWORD_PLATFORMS.map((p, i) => `${PLATFORM_LABEL[p]} ${results[i]!.videos.length}건`)
  const total = results.reduce((n, r) => n + r.videos.length, 0)
  return {
    keywordPairs: args.keywordPairs,
    searchQueries,
    douyin,
    xhs: xhs!,
    tiktok,
    youtube,
    notice: `검색어「${keywordLabel}」— ${total === 0 ? "모든 플랫폼 영상 0건" : counts.join(" · ")}`,
  }
}
