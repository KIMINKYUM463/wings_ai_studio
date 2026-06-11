/**
 * Apify 기반 MVP 파이프라인 — 쇼핑숏폼 레퍼런스 검색
 */

import { collectApifyVideoCandidatesBudgeted, type ApifySearchAnalysisShape } from "@/lib/apify-product-search"
import type { SerpVideoRow } from "@/lib/serpapi-product-search"
import { runLiteProductAnalysis, youtubeShortSearchLite, type LiteAnalysis } from "@/lib/shotform-product-search-lite"
import { runMvpExtendedAnalysis, type MvpExtendedAnalysis } from "@/lib/shotform-mvp-test-analysis"

export type MvpSimilarVideo = SerpVideoRow & {
  relevanceScore?: number
}

export type MvpApifyPipelineInput = {
  url: string
  platform: string
  title: string
  author: string
  thumbnail: string
  youtubeVideoId: string | null
  transcript: string
  openaiApiKey: string
  apifyToken: string
  youtubeDataApiKey?: string | null
}

export type MvpApifyPipelineResult = {
  keywordAnalysis: LiteAnalysis
  mvpAnalysis: MvpExtendedAnalysis
  similarVideos: MvpSimilarVideo[]
  apifyHttpCalls: number
  pipeline: { done: string[]; planned: string[] }
  notice: string
}

function mergeZhIntoQueries(existing: string[], chinese: MvpExtendedAnalysis, take = 2): string[] {
  const zh = chinese.chineseKeywords.map((c) => c.zh.trim()).filter(Boolean)
  const merged = [...zh, ...existing]
  const seen = new Set<string>()
  const out: string[] = []
  for (const q of merged) {
    const k = q.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(q)
    if (out.length >= take) break
  }
  return out
}

function buildApifyAnalysis(lite: LiteAnalysis, mvp: MvpExtendedAnalysis): ApifySearchAnalysisShape {
  const xhs8 = mergeZhIntoQueries(lite.searchQueries.xiaohongshu, mvp, 8)
  const dy8 = mergeZhIntoQueries(lite.searchQueries.douyin, mvp, 8)
  return {
    productName: lite.productName,
    category: lite.category,
    targetKeywords: [...lite.targetKeywords, ...mvp.targetKeywords].slice(0, 14),
    shoppingKeywords: mvp.targetKeywords.slice(0, 8),
    searchFeatures: lite.productTraits,
    productTraits: lite.productTraits,
    searchQueries: {
      tiktok: lite.searchQueries.tiktok,
      xiaohongshu: xhs8.length ? xhs8 : lite.searchQueries.xiaohongshu,
      douyin: dy8.length ? dy8 : lite.searchQueries.douyin,
    },
    serpPriorityQueries: {
      tiktok: lite.searchQueries.tiktok.slice(0, 2),
      xiaohongshu: mergeZhIntoQueries(lite.searchQueries.xiaohongshu, mvp, 2),
      douyin: mergeZhIntoQueries(lite.searchQueries.douyin, mvp, 2),
    },
  }
}

function relevanceScore(row: MvpSimilarVideo, lite: LiteAnalysis, mvp: MvpExtendedAnalysis): number {
  const full = `${row.title} ${row.author}`.toLowerCase()
  let s = 0
  const anchors = [
    lite.productName,
    ...lite.targetKeywords,
    ...mvp.chineseKeywords.map((c) => c.zh),
    ...mvp.chineseKeywords.map((c) => c.ko),
  ]
  for (const phrase of anchors) {
    const p = phrase.trim().toLowerCase()
    if (p.length >= 2 && full.includes(p)) s += p.length >= 4 ? 12 : 6
  }
  return s
}

export async function executeMvpApifyPipeline(input: MvpApifyPipelineInput): Promise<MvpApifyPipelineResult> {
  const keywordAnalysis = await runLiteProductAnalysis({
    url: input.url,
    platform: input.platform,
    title: input.title,
    author: input.author,
    transcript: input.transcript,
    apiKey: input.openaiApiKey,
  })

  const mvpAnalysis = await runMvpExtendedAnalysis({
    url: input.url,
    platform: input.platform,
    title: input.title,
    author: input.author,
    transcript: input.transcript,
    productName: keywordAnalysis.productName,
    category: keywordAnalysis.category,
    apiKey: input.openaiApiKey,
  })

  const apifyShape = buildApifyAnalysis(keywordAnalysis, mvpAnalysis)
  const apify = await collectApifyVideoCandidatesBudgeted(input.apifyToken, apifyShape)

  let similarVideos: MvpSimilarVideo[] = apify.rows.map((r) => ({
    ...r,
    relevanceScore: relevanceScore(r, keywordAnalysis, mvpAnalysis),
  }))

  const ytQ =
    apifyShape.serpPriorityQueries.tiktok[0] ||
    keywordAnalysis.searchQueries.youtube[0] ||
    keywordAnalysis.productName
  if (input.youtubeDataApiKey && ytQ) {
    const ytRows = await youtubeShortSearchLite(input.youtubeDataApiKey, ytQ)
    const seen = new Set(similarVideos.map((v) => v.url.toLowerCase()))
    for (const r of ytRows) {
      if (seen.has(r.url.toLowerCase())) continue
      seen.add(r.url.toLowerCase())
      similarVideos.push({
        ...r,
        relevanceScore: relevanceScore(r, keywordAnalysis, mvpAnalysis),
      })
    }
  }

  similarVideos.sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))

  return {
    keywordAnalysis,
    mvpAnalysis,
    similarVideos,
    apifyHttpCalls: apify.apifyHttpCalls,
    pipeline: {
      done: [
        "mvp_apify_mode",
        "url_oembed",
        ...(input.transcript.length > 0 ? ["youtube_transcript_json3"] : []),
        "openai_keyword_analysis",
        "openai_mvp_extended_analysis",
        "apify_douyin_xhs_tiktok",
        ...(input.youtubeDataApiKey ? ["youtube_data_api_shorts"] : []),
        "keyword_relevance_sort",
      ],
      planned: ["ffmpeg_montage_worker", "r2_storage", "credit_billing"],
    },
    notice:
      `MVP 소스 검색: TikTok·抖音·小红书 Actor 검색 ${apify.apifyHttpCalls}회` +
      (input.youtubeDataApiKey ? " + YouTube Data API 보조." : ".") +
      " ShotForm 설정에 소스 검색 토큰이 필요합니다.",
  }
}
