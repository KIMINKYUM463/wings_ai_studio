/**
 * 제품 URL → 유사 숏폼 검색 (Lite, 회당 ~₩10 이하 목표)
 * - OpenAI gpt-4o-mini 1회 (키워드·상품명)
 * - 쇼핑 URL og 메타 + 제품 사진 Vision OCR 폴백
 * - DuckDuckGo HTML site: 검색 (Serp/Apify 없음)
 * - YouTube Data API 있으면 YouTube만 보조 (무료 쿼터)
 */

import {
  fetchCoupangProductMeta,
  fetchImageAsVisionDataUrl,
  isCoupangProductUrl,
} from "@/lib/shotform-coupang-product-meta"
import { fetchProductPageMeta } from "@/lib/shotform-mvp-xhs-test"
import { runShoppingFrameOcr } from "@/lib/shotform-shopping-frame-ocr"
import type { SerpVideoRow } from "@/lib/serpapi-product-search"

export type LitePlatform = "youtube" | "tiktok" | "xiaohongshu" | "douyin"

export type LiteAnalysis = {
  productName: string
  category: string
  categoryTags: string[]
  targetKeywords: string[]
  searchQueries: Record<LitePlatform, string[]>
  productTraits?: string[]
  usageScene?: string
}

export type LiteVideoResult = SerpVideoRow & {
  relevanceScore?: number
}

const LITE_PLATFORMS: LitePlatform[] = ["tiktok", "douyin", "xiaohongshu", "youtube"]

const SITE_CLAUSE: Record<LitePlatform, string> = {
  tiktok: "site:tiktok.com/video",
  douyin: "site:douyin.com/video",
  xiaohongshu: "site:xiaohongshu.com/explore",
  youtube: "(site:youtube.com/shorts OR site:youtube.com/watch OR site:youtu.be)",
}

const PLATFORM_LABEL: Record<LitePlatform, string> = {
  tiktok: "TikTok",
  douyin: "抖音",
  xiaohongshu: "小红书",
  youtube: "YouTube",
}

function detectPlatformFromUrl(link: string): LitePlatform | "other" {
  const u = link.toLowerCase()
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube"
  if (u.includes("tiktok.com")) return "tiktok"
  if (u.includes("xiaohongshu.com") || u.includes("xhslink.com")) return "xiaohongshu"
  if (u.includes("douyin.com") || u.includes("iesdouyin.com") || u.includes("v.douyin.com")) return "douyin"
  return "other"
}

function isVideoPageUrl(platform: LitePlatform, url: string): boolean {
  const u = url.toLowerCase()
  switch (platform) {
    case "tiktok":
      if (u.includes("/tag/") || u.includes("/music/")) return false
      return /tiktok\.com\/@[^/]+\/video\/\d+/.test(u) || /vm\.tiktok\.com\//.test(u)
    case "douyin":
      if (u.includes("/search/") || u.includes("/user/")) return false
      return /douyin\.com\/video\/\d+/.test(u) || /v\.douyin\.com\//.test(u)
    case "xiaohongshu":
      if (u.includes("customer.") || u.includes("login") || u.includes("/oia")) return false
      return /xiaohongshu\.com\/explore\/[a-z0-9]+/i.test(u) ||
        /xiaohongshu\.com\/discovery\/item\/[a-z0-9]+/i.test(u) ||
        /xhslink\.com\//.test(u)
    case "youtube":
      return /[?&]v=[\w-]{11}/.test(u) || /youtu\.be\/[\w-]{11}/.test(u) || /\/shorts\/[\w-]{11}/.test(u)
    default:
      return false
  }
}

function youtubeIdFromUrl(link: string): string | null {
  try {
    const u = new URL(link)
    const v = u.searchParams.get("v")
    if (v && /^[\w-]{11}$/.test(v)) return v
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace(/^\//, "").split("/")[0]
      return id && /^[\w-]{11}$/.test(id) ? id : null
    }
    const shorts = u.pathname.match(/\/shorts\/([\w-]{11})/)
    if (shorts) return shorts[1]!
  } catch {
    return null
  }
  return null
}

function rowFromUrl(url: string, title: string, platform: LitePlatform): LiteVideoResult | null {
  if (!isVideoPageUrl(platform, url)) return null
  const ytId = platform === "youtube" ? youtubeIdFromUrl(url) : null
  return {
    platform,
    title: title.trim() || "(제목 없음)",
    thumbnail: ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : "",
    videoUrl: ytId ? `https://www.youtube.com/embed/${ytId}` : "",
    url,
    author: PLATFORM_LABEL[platform],
    contentLength: platform === "youtube" ? "short" : "unknown",
  }
}

/** DuckDuckGo HTML — uddg 리다이렉트에서 실제 URL 추출 */
export async function ddgSiteSearchLinks(query: string, max = 14): Promise<Array<{ url: string; title: string }>> {
  const body = new URLSearchParams({ q: query, kl: "kr-kr" })
  const res = await fetch("https://html.duckduckgo.com/html/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html",
    },
    body: body.toString(),
    signal: AbortSignal.timeout(18_000),
  })
  if (!res.ok) return []
  const html = await res.text()
  const out: Array<{ url: string; title: string }> = []
  const seen = new Set<string>()

  const uddgRe =
    /class="result__a"[^>]*href="(?:https?:)?\/\/duckduckgo\.com\/l\/\?[^"]*?uddg=([^"&]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = uddgRe.exec(html)) !== null && out.length < max) {
    let url = ""
    try {
      url = decodeURIComponent(m[1]!.replace(/&amp;/g, "&"))
    } catch {
      continue
    }
    if (!url.startsWith("http")) continue
    const key = url.split("?")[0]!.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    let title = m[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
    if (!title) {
      const snippetMatch = html.slice(m.index, m.index + 800).match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i)
      title = snippetMatch?.[1]?.replace(/<[^>]+>/g, "").trim() || ""
    }
    out.push({ url, title })
  }

  if (out.length === 0) {
    const fallbackRe = /href="(https?:\/\/[^"]+)"/gi
    while ((m = fallbackRe.exec(html)) !== null && out.length < max) {
      const url = m[1]!
      if (url.includes("duckduckgo.com")) continue
      const key = url.split("?")[0]!.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ url, title: "" })
    }
  }

  return out
}

async function searchPlatformVideos(platform: LitePlatform, keywords: string[], maxPerPlatform = 10): Promise<LiteVideoResult[]> {
  const site = SITE_CLAUSE[platform]
  const kws = keywords.map((k) => k.trim()).filter(Boolean).slice(0, 2)
  if (kws.length === 0) return []

  const seen = new Set<string>()
  const rows: LiteVideoResult[] = []

  for (const kw of kws) {
    if (rows.length >= maxPerPlatform) break
    const q = `${kw} ${site}`.trim()
    const hits = await ddgSiteSearchLinks(q, maxPerPlatform)
    for (const hit of hits) {
      const p = detectPlatformFromUrl(hit.url)
      if (p !== platform && p !== "other") continue
      const row = rowFromUrl(hit.url, hit.title, platform)
      if (!row) continue
      const key = row.url.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      rows.push(row)
      if (rows.length >= maxPerPlatform) break
    }
  }

  if (rows.length === 0 && platform === "xiaohongshu") {
    for (const kw of kws) {
      if (rows.length >= maxPerPlatform) break
      const hits = await ddgSiteSearchLinks(`${kw} site:xiaohongshu.com 笔记`, maxPerPlatform)
      for (const hit of hits) {
        const row = rowFromUrl(hit.url, hit.title, platform)
        if (!row) continue
        const key = row.url.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        rows.push(row)
      }
    }
  }

  return rows
}

function relevanceScore(row: LiteVideoResult, a: LiteAnalysis): number {
  const full = `${row.title} ${row.url}`.toLowerCase()
  let s = 0
  const anchors = [
    a.productName,
    ...(a.targetKeywords || []),
    ...(a.searchQueries[row.platform as LitePlatform] || []),
  ]
    .map((x) => x.trim())
    .filter((x) => x.length >= 2)

  for (const phrase of anchors) {
    const p = phrase.toLowerCase()
    if (full.includes(p)) s += p.length >= 5 ? 14 : 8
  }
  return s
}

export async function collectLiteSimilarVideos(analysis: LiteAnalysis): Promise<LiteVideoResult[]> {
  const tasks = LITE_PLATFORMS.map(async (platform) => {
    const kws = [
      ...(analysis.searchQueries[platform] || []),
      analysis.productName,
      ...(analysis.targetKeywords || []).slice(0, 2),
    ]
    return searchPlatformVideos(platform, kws, 10)
  })

  const batches = await Promise.all(tasks)
  const merged = batches.flat()
  const seen = new Set<string>()
  const deduped: LiteVideoResult[] = []
  for (const r of merged) {
    const key = r.url.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push({ ...r, relevanceScore: relevanceScore(r, analysis) })
  }

  deduped.sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))
  return deduped
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

function pickMetaContent(html: string, property: string): string {
  const re1 = new RegExp(`property=["']${property}["'][^>]*content=["']([^"']+)["']`, "i")
  const re2 = new RegExp(`content=["']([^"']+)["'][^>]*property=["']${property}["']`, "i")
  return decodeHtmlEntities(html.match(re1)?.[1] || html.match(re2)?.[1] || "")
}

/** 쿠팡·네이버 스마트스토어 등 쇼핑몰 URL */
export function isShoppingProductUrl(rawUrl: string): boolean {
  const u = rawUrl.trim().toLowerCase()
  return (
    isCoupangProductUrl(u) ||
    u.includes("smartstore.naver.com") ||
    u.includes("shopping.naver.com") ||
    u.includes("brand.naver.com") ||
    u.includes("gmarket.co.kr") ||
    u.includes("11st.co.kr") ||
    u.includes("auction.co.kr") ||
    u.includes("ssg.com") ||
    u.includes("lotteon.com") ||
    u.includes("kurly.com") ||
    u.includes("musinsa.com") ||
    u.includes("ably.com") ||
    u.includes("wconcept.co.kr")
  )
}

export type LiteProductPageContext = {
  title: string
  description: string
  thumbnail: string
}

/** 쇼핑·제품 페이지 og:title / og:image 추출 */
export async function resolveLiteProductPageContext(url: string): Promise<LiteProductPageContext> {
  const trimmed = url.trim()
  if (!trimmed.startsWith("http")) return { title: "", description: "", thumbnail: "" }

  if (isCoupangProductUrl(trimmed)) {
    const meta = await fetchCoupangProductMeta(trimmed)
    if (meta) {
      return {
        title: meta.title,
        description: meta.description,
        thumbnail: meta.imageUrls[0] || "",
      }
    }
  }

  const page = await fetchProductPageMeta(trimmed)
  let thumbnail = ""
  try {
    const res = await fetch(trimmed, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ko-KR,ko;q=0.9",
      },
      signal: AbortSignal.timeout(14_000),
      redirect: "follow",
    })
    if (res.ok) {
      const html = (await res.text()).slice(0, 180_000)
      thumbnail =
        pickMetaContent(html, "og:image") ||
        pickMetaContent(html, "og:image:url") ||
        pickMetaContent(html, "twitter:image")
    }
  } catch {
    /* ignore */
  }

  return {
    title: page.title,
    description: page.description,
    thumbnail,
  }
}

export async function runLiteProductAnalysis(args: {
  url: string
  platform: string
  title: string
  author: string
  description?: string
  ocrNotes?: string
  transcript?: string
  apiKey: string
}): Promise<LiteAnalysis> {
  const { url, platform, title, author, description, ocrNotes, transcript, apiKey } = args

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.25,
      max_tokens: 650,
      response_format: { type: "json_object" as const },
      messages: [
        {
          role: "system" as const,
          content: `쇼핑 숏폼 키워드 추출기. JSON만 출력.
각 searchQueries 배열은 정확히 2개(중복 금지).
- youtube: 한국어 쇼핑 숏폼 검색어
- tiktok: 영어 review/unboxing 스타일
- xiaohongshu: 간체 중국어 2개
- douyin: 간체 중국어 2개
상품명만 단독 금지. 특징+제품군 형태.`,
        },
        {
          role: "user" as const,
          content: `URL: ${url}
플랫폼: ${platform}
제목: ${title || "(없음)"}
작성자: ${author || "(없음)"}
페이지 설명: ${(description || "").slice(0, 900) || "(없음)"}
제품 이미지 OCR: ${(ocrNotes || "").slice(0, 1800) || "(없음)"}
자막: ${(transcript || "").slice(0, 1200) || "(없음)"}

JSON:
{"productName":"","category":"","categoryTags":[],"targetKeywords":[],"searchQueries":{"youtube":["",""],"tiktok":["",""],"xiaohongshu":["",""],"douyin":["",""]},"productTraits":[],"usageScene":""}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  })

  if (!res.ok) {
    const t = await res.text().catch(() => "")
    throw new Error(`Lite AI 분석 실패 (${res.status}): ${t.slice(0, 200)}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error("Lite AI 응답이 비어 있습니다.")

  const parsed = JSON.parse(content) as Record<string, unknown>
  const sq = (parsed.searchQueries || {}) as Record<string, unknown>

  const pick2 = (v: unknown): string[] => {
    if (!Array.isArray(v)) return []
    return v.map((x) => String(x).trim()).filter(Boolean).slice(0, 2)
  }

  const productName = String(parsed.productName || title || "제품").trim()
  const fallbackKw = productName.slice(0, 40)

  const searchQueries: Record<LitePlatform, string[]> = {
    youtube: pick2(sq.youtube).length ? pick2(sq.youtube) : [fallbackKw, `${fallbackKw} 리뷰`],
    tiktok: pick2(sq.tiktok).length ? pick2(sq.tiktok) : [`${fallbackKw} review`, `${fallbackKw} unboxing`],
    xiaohongshu: pick2(sq.xiaohongshu).length ? pick2(sq.xiaohongshu) : [fallbackKw, `${fallbackKw} 测评`],
    douyin: pick2(sq.douyin).length ? pick2(sq.douyin) : [fallbackKw, `${fallbackKw} 推荐`],
  }

  return {
    productName,
    category: String(parsed.category || "").trim() || "쇼핑",
    categoryTags: Array.isArray(parsed.categoryTags) ? parsed.categoryTags.map(String).slice(0, 3) : [],
    targetKeywords: Array.isArray(parsed.targetKeywords) ? parsed.targetKeywords.map(String).slice(0, 8) : [],
    searchQueries,
    productTraits: Array.isArray(parsed.productTraits) ? parsed.productTraits.map(String).slice(0, 6) : [],
    usageScene: String(parsed.usageScene || "").trim(),
  }
}

/** YouTube Data API (무료 쿼터) — Lite에서 YouTube 결과 보강 */
export async function youtubeShortSearchLite(apiKey: string, q: string): Promise<LiteVideoResult[]> {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoDuration=short&maxResults=12&q=${encodeURIComponent(q)}&regionCode=KR&relevanceLanguage=ko&key=${encodeURIComponent(apiKey)}`
  const r = await fetch(url, { signal: AbortSignal.timeout(12_000) })
  if (!r.ok) return []
  const data = (await r.json().catch(() => ({}))) as {
    items?: Array<{
      id?: { videoId?: string }
      snippet?: { title?: string; channelTitle?: string; thumbnails?: { high?: { url?: string }; medium?: { url?: string } } }
    }>
  }
  return (data.items || [])
    .map((item) => {
      const id = item.id?.videoId
      if (!id) return null
      const sn = item.snippet
      const thumb = sn?.thumbnails?.high?.url || sn?.thumbnails?.medium?.url || ""
      return {
        platform: "youtube" as const,
        title: sn?.title || "(제목 없음)",
        thumbnail: thumb || `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
        videoUrl: `https://www.youtube.com/embed/${id}`,
        url: `https://www.youtube.com/watch?v=${id}`,
        author: sn?.channelTitle || "",
        contentLength: "short" as const,
      } satisfies LiteVideoResult
    })
    .filter(Boolean) as LiteVideoResult[]
}

export function mergeLiteYoutubeBoost(
  rows: LiteVideoResult[],
  ytRows: LiteVideoResult[],
  analysis: LiteAnalysis
): LiteVideoResult[] {
  const seen = new Set(rows.map((r) => r.url.toLowerCase()))
  const out = [...rows]
  for (const r of ytRows) {
    if (seen.has(r.url.toLowerCase())) continue
    seen.add(r.url.toLowerCase())
    out.push({ ...r, relevanceScore: relevanceScore(r, analysis) })
  }
  out.sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))
  return out
}

export type LiteProductSearchInput = {
  url: string
  platform: string
  title: string
  author: string
  thumbnail: string
  youtubeVideoId: string | null
  transcript: string
  openaiApiKey: string
  youtubeDataApiKey?: string | null
  /** URL에서 메타를 못 찾을 때 사용자가 올린 제품 사진 (data:image/...) */
  productImageDataUrl?: string
}

export type LiteProductSearchOutput = {
  analysis: LiteAnalysis & {
    searchQueries: Record<LitePlatform, string[]>
    serpPriorityQueries: Record<LitePlatform, string[]>
    searchFeatures?: string[]
    shoppingKeywords?: string[]
    adCopyLines?: string[]
    targetCustomer?: string
  }
  results: LiteVideoResult[]
  keyframes: Array<{ index: number; imageUrl: string; label?: string }>
  keyframesSource: string
  pipeline: { done: string[]; planned: string[] }
  notice: string
}

export type LiteKeywordContext = {
  title: string
  description: string
  thumbnail: string
  ocrNotes: string
  usedVisionSources: string[]
  keyframeImage: string
}

/** URL·쇼핑 페이지·제품 사진 → GPT 키워드 분석용 컨텍스트 */
export async function buildLiteKeywordContext(input: {
  url: string
  platform: string
  title: string
  thumbnail: string
  openaiApiKey: string
  productImageDataUrl?: string
}): Promise<LiteKeywordContext> {
  let title = input.title.trim()
  let description = ""
  let thumbnail = input.thumbnail.trim()
  const usedVisionSources: string[] = []

  if (input.url.startsWith("http") && (isShoppingProductUrl(input.url) || input.platform === "unknown")) {
    const pageCtx = await resolveLiteProductPageContext(input.url)
    if (pageCtx.title) title = pageCtx.title
    description = pageCtx.description
    if (pageCtx.thumbnail) thumbnail = pageCtx.thumbnail
    if (pageCtx.title || pageCtx.description) usedVisionSources.push("shopping_page_meta")
  }

  const visionImages: string[] = []
  if (thumbnail.startsWith("http")) {
    const dataUrl = await fetchImageAsVisionDataUrl(thumbnail)
    visionImages.push(dataUrl || thumbnail)
    if (dataUrl) usedVisionSources.push("page_og_image")
  }
  if (input.productImageDataUrl?.startsWith("data:image/")) {
    visionImages.push(input.productImageDataUrl)
    usedVisionSources.push("user_product_image")
  }

  const ocrNotes =
    visionImages.length > 0
      ? await runShoppingFrameOcr(input.openaiApiKey, visionImages, {
          imageContext:
            "쇼핑몰 제품 상세·대표 이미지입니다. 제품명·브랜드·스펙·특징·카테고리·용도를 정확히 읽어 주세요. 추측은 [추측]으로 표시.",
        })
      : ""

  const keyframeImage =
    input.productImageDataUrl?.startsWith("data:image/")
      ? input.productImageDataUrl
      : thumbnail || input.thumbnail

  return { title, description, thumbnail, ocrNotes, usedVisionSources, keyframeImage }
}

export async function executeLiteProductSearch(input: LiteProductSearchInput): Promise<LiteProductSearchOutput> {
  const ctx = await buildLiteKeywordContext({
    url: input.url,
    platform: input.platform,
    title: input.title,
    thumbnail: input.thumbnail,
    openaiApiKey: input.openaiApiKey,
    productImageDataUrl: input.productImageDataUrl,
  })
  const { title, description, ocrNotes, usedVisionSources, keyframeImage } = ctx

  const analysisRaw = await runLiteProductAnalysis({
    url: input.url,
    platform: input.platform,
    title,
    author: input.author,
    description,
    ocrNotes,
    transcript: input.transcript,
    apiKey: input.openaiApiKey,
  })

  let results = await collectLiteSimilarVideos(analysisRaw)

  const ytQ = analysisRaw.searchQueries.youtube[0] || analysisRaw.productName
  if (input.youtubeDataApiKey && ytQ) {
    const ytBoost = await youtubeShortSearchLite(input.youtubeDataApiKey, ytQ)
    results = mergeLiteYoutubeBoost(results, ytBoost, analysisRaw)
  }

  const analysis = {
    ...analysisRaw,
    searchQueries: analysisRaw.searchQueries,
    serpPriorityQueries: analysisRaw.searchQueries,
    searchFeatures: analysisRaw.productTraits,
    shoppingKeywords: analysisRaw.targetKeywords.slice(0, 6),
    adCopyLines: [],
    targetCustomer: "",
  }

  const keyframes = keyframeImage
    ? [
        {
          index: 1,
          imageUrl: keyframeImage,
          label: input.productImageDataUrl ? "업로드한 제품 사진" : "제품·영상 대표 이미지",
        },
      ]
    : []

  const visionNote =
    usedVisionSources.length > 0
      ? ` Vision(${usedVisionSources.join("+")})으로 키워드를 보강했습니다.`
      : ""

  return {
    analysis,
    results,
    keyframes,
    keyframesSource: input.productImageDataUrl
      ? "user_product_image"
      : ctx.thumbnail
        ? "shopping_page_og_image"
        : input.thumbnail
          ? "platform_oembed_thumbnail_only"
          : "none",
    pipeline: {
      done: [
        "lite_mode",
        "url_oembed",
        ...(isShoppingProductUrl(input.url) ? ["shopping_page_meta"] : []),
        ...(ocrNotes.length > 0 ? ["openai_vision_ocr"] : []),
        ...(input.productImageDataUrl ? ["user_product_image"] : []),
        ...(input.transcript.length > 0 ? ["youtube_transcript_json3"] : []),
        "openai_lite_keyword_analysis",
        "duckduckgo_site_search_tiktok_douyin_xhs_youtube",
        ...(input.youtubeDataApiKey ? ["youtube_data_api_shorts_boost"] : []),
        "keyword_relevance_sort",
      ],
      planned: ["serpapi_apify_full_mode", "llm_similarity_rerank"],
    },
    notice:
      `경량 검색(Lite): 제품 URL·사진에서 키워드를 뽑고 DuckDuckGo site 검색으로 TikTok·抖音·小红书·YouTube 유사 영상을 수집합니다.${visionNote} SerpApi·유료 소스 검색 미사용(회당 약 ₩10 이하 목표).`,
  }
}
