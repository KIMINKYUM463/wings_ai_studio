/**
 * MVP — 한국어 키워드(→中文)로 抖音·小红书 Apify 동시 검색
 */

import { searchDouyinOnApify, searchXiaohongshuOnApify } from "@/lib/apify-product-search"
import { filterXhsVideoRows } from "@/lib/apify-xhs-video-actors"
import {
  filterRowsByAnyKeyword,
  rowRelevanceText,
  scoreTextKeywordRelevance,
} from "@/lib/shotform-mvp-keyword-relevance"
import type { KoZhKeywordPair } from "@/lib/shotform-xhs-ko-zh-keywords"
import type { SerpVideoRow } from "@/lib/serpapi-product-search"

export type MvpKeywordVideo = SerpVideoRow & { relevanceScore?: number }

export type MvpPlatformSourceResult = {
  videos: MvpKeywordVideo[]
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
  notice: string
}

export type MvpKeywordPlatform = "douyin" | "xiaohongshu"

/** 小红书 「영상 다시 가져오기」 최대 재시도 횟수 */
export const MVP_XHS_PLATFORM_RETRY_MAX = 10

function scoreRow(row: SerpVideoRow, keywords: string[]): number {
  const text = rowRelevanceText(row)
  return Math.max(0, ...keywords.map((k) => scoreTextKeywordRelevance(text, k)))
}

function rankVideos(rows: SerpVideoRow[], keywords: string[], minScore = 8): MvpKeywordVideo[] {
  const scored: MvpKeywordVideo[] = rows
    .filter((r) => r.videoUrl?.startsWith("http"))
    .map((r) => ({ ...r, relevanceScore: scoreRow(r, keywords) }))
    .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))

  const filtered = filterRowsByAnyKeyword(scored, keywords, minScore) as MvpKeywordVideo[]
  if (filtered.length > 0) {
    return [...filtered].sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))
  }
  return scored.slice(0, Math.min(8, scored.length))
}

function buildNotice(
  platformLabel: string,
  apify: { httpCalls: number; actor: string; actorsUsed: string[]; keywordsUsed: string[] },
  videoCount: number,
  rawCount: number
): string {
  if (videoCount === 0) {
    return `${platformLabel} 영상 0건 — 검색 Actor·키워드를 확인하세요. (raw ${rawCount}건)`
  }
  const actorNote =
    apify.actorsUsed.length > 0
      ? apify.actorsUsed.map((a) => a.split("/")[1] || a).join(" + ")
      : apify.actor
  return `API ${apify.httpCalls}회 · ${actorNote} · 영상 ${videoCount}건 · ${apify.keywordsUsed.join(" · ")}`
}

function buildPlatformResult(
  platformLabel: string,
  apify: { rows: SerpVideoRow[]; httpCalls: number; actor: string; actorsUsed: string[]; keywordsUsed: string[] },
  searchQueries: string[],
  filterXhs: boolean
): MvpPlatformSourceResult {
  const rows = filterXhs ? filterXhsVideoRows(apify.rows) : apify.rows
  const videos = rankVideos(rows, searchQueries)
  return {
    videos,
    apifyHttpCalls: apify.httpCalls,
    apifyActor: apify.actor,
    keywordsUsed: apify.keywordsUsed,
    notice: buildNotice(platformLabel, apify, videos.length, rows.length),
  }
}

function mergeNotice(douyin: MvpPlatformSourceResult, xhs: MvpPlatformSourceResult, searchQueries: string[]): string {
  const total = douyin.videos.length + xhs.videos.length
  if (total === 0) {
    return `검색어「${searchQueries.join(" · ")}」— 抖音·小红书 모두 영상 0건`
  }
  return `검색어「${searchQueries.join(" · ")}」— 抖音 ${douyin.videos.length}건 · 小红书 ${xhs.videos.length}건`
}

function withXhsRetryNotice(result: MvpPlatformSourceResult, attempt: number, maxAttempts: number): MvpPlatformSourceResult {
  if (attempt <= 1) return result
  const suffix =
    result.videos.length > 0
      ? ` · 재시도 ${attempt}/${maxAttempts}회째 성공`
      : ` · ${maxAttempts}회 재시도 후에도 영상 0건`
  return { ...result, notice: `${result.notice}${suffix}` }
}

async function searchXhsPlatformWithRetries(
  apifyToken: string,
  searchQueries: string[],
  maxAttempts: number
): Promise<MvpPlatformSourceResult> {
  let totalHttpCalls = 0
  let lastResult: MvpPlatformSourceResult | null = null
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const apify = await searchXiaohongshuOnApify(apifyToken, searchQueries)
      totalHttpCalls += apify.httpCalls
      const result = buildPlatformResult("小红书", apify, searchQueries, true)
      result.apifyHttpCalls = totalHttpCalls
      lastResult = result

      if (result.videos.length > 0) {
        return withXhsRetryNotice(result, attempt, maxAttempts)
      }
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
    }
  }

  if (lastResult) {
    lastResult.apifyHttpCalls = totalHttpCalls
    return withXhsRetryNotice(lastResult, maxAttempts, maxAttempts)
  }

  throw lastError ?? new Error(`小红书 소스 검색 ${maxAttempts}회 재시도 후 실패`)
}

/** 단일 플랫폼만 Apify 재검색 */
export async function runMvpKeywordPlatformSearch(args: {
  platform: MvpKeywordPlatform
  searchQueries: string[]
  apifyToken: string
  /** 小红书 재시도 횟수 (기본 1, 「영상 다시 가져오기」는 10) */
  maxAttempts?: number
}): Promise<MvpPlatformSourceResult> {
  const searchQueries = [...new Set(args.searchQueries.map((k) => k.trim()).filter(Boolean))].slice(0, 3)
  if (!searchQueries.length) {
    throw new Error("검색할 중국어 키워드가 없습니다.")
  }

  if (args.platform === "douyin") {
    const apify = await searchDouyinOnApify(args.apifyToken, searchQueries)
    return buildPlatformResult("抖音", apify, searchQueries, false)
  }

  const maxAttempts = Math.max(1, Math.min(args.maxAttempts ?? 1, MVP_XHS_PLATFORM_RETRY_MAX))
  if (maxAttempts <= 1) {
    const apify = await searchXiaohongshuOnApify(args.apifyToken, searchQueries)
    return buildPlatformResult("小红书", apify, searchQueries, true)
  }

  return searchXhsPlatformWithRetries(args.apifyToken, searchQueries, maxAttempts)
}

/** 간체 中文 검색어로 抖音·小红书 병렬 검색 */
export async function runMvpKeywordSourceSearch(args: {
  searchQueries: string[]
  keywordPairs: KoZhKeywordPair[]
  apifyToken: string
}): Promise<MvpKeywordSourceResult> {
  const searchQueries = [...new Set(args.searchQueries.map((k) => k.trim()).filter(Boolean))].slice(0, 3)
  if (!searchQueries.length) {
    throw new Error("검색할 중국어 키워드가 없습니다.")
  }

  const [douyinApify, xhsApify] = await Promise.all([
    searchDouyinOnApify(args.apifyToken, searchQueries),
    searchXiaohongshuOnApify(args.apifyToken, searchQueries),
  ])

  const douyin = buildPlatformResult("抖音", douyinApify, searchQueries, false)
  const xhs = buildPlatformResult("小红书", xhsApify, searchQueries, true)

  return {
    keywordPairs: args.keywordPairs,
    searchQueries,
    douyin,
    xhs,
    notice: mergeNotice(douyin, xhs, searchQueries),
  }
}
