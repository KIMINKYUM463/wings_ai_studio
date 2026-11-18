import { NextRequest, NextResponse } from "next/server"
import { guardStoryApiRequest } from "@/lib/story-shopping-security"
import { analyzeStoryMarketVideo } from "@/lib/story-market-intelligence"

type YouTubeSearchItem = {
  id?: { videoId?: string }
  snippet?: {
    title?: string
    description?: string
    channelId?: string
    channelTitle?: string
    publishedAt?: string
    thumbnails?: { high?: { url?: string }; medium?: { url?: string } }
  }
}

type YouTubeVideoItem = {
  id?: string
  statistics?: { viewCount?: string; likeCount?: string }
  contentDetails?: { duration?: string }
  status?: { embeddable?: boolean; license?: string }
}

type MappedVideo = {
  id: string
  title: string
  description: string
  channelTitle: string
  publishedAt: string
  thumbnailUrl: string
  viewCount: number
  likeCount: number
  duration: string
  durationSec: number
  url: string
  embedUrl: string
  region: string
  license: string
  embeddable: boolean
  matchedKeyword?: string
}

const parseDuration = (duration: string) => {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  return (
    Number.parseInt(match[1] || "0") * 3600 +
    Number.parseInt(match[2] || "0") * 60 +
    Number.parseInt(match[3] || "0")
  )
}

async function createGlobalSearchQueries(productName: string): Promise<string[]> {
  const openAiKey =
    process.env.OPENAI_API_KEY || process.env.GPT_API_KEY || process.env.CHATGPT_API_KEY
  const fallback = [
    `${productName} product demo review #shorts`,
    `${productName} problem solution #shorts`,
    `${productName} before after hack #shorts`,
  ]
  if (!openAiKey) return fallback

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 180,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              `Translate the Korean product into concise English YouTube Shorts searches.
Return JSON only: {"queries":["product demo review #shorts","problem solution #shorts","before after hack #shorts"]}.
Keep the exact product category in every query. Return exactly 3 distinct queries.`,
          },
          { role: "user", content: productName },
        ],
      }),
    })
    if (!response.ok) return fallback
    const data = await response.json()
    const parsed = JSON.parse(String(data.choices?.[0]?.message?.content || "{}")) as {
      queries?: unknown
    }
    const queries = (Array.isArray(parsed.queries) ? parsed.queries : [])
      .map((item) => String(item || "").replace(/["']/g, "").trim())
      .filter((item, index, list) => item.length >= 5 && list.indexOf(item) === index)
      .slice(0, 3)
    return queries.length === 3 ? queries : fallback
  } catch {
    return fallback
  }
}

/** 긴 상품명에서 핵심 한글 키워드만 추출 (폴백용) */
function extractShortKoreanHints(text: string): string[] {
  const t = text.replace(/\s+/g, " ").trim()
  if (!t) return []
  const hints: string[] = []
  const rules: Array<[RegExp, string]> = [
    [/캠핑/, "camping"],
    [/음료|주스|우유|생수|워터/, "drink"],
    [/디스펜서|저그|워터저그/, "water dispenser"],
    [/따르|따라/, "pouring"],
    [/자동/, "automatic"],
    [/야외|아웃도어/, "outdoors"],
    [/사람|인물/, "person"],
    [/고생|번거|골치/, "struggling"],
  ]
  for (const [re, en] of rules) {
    if (re.test(t) && !hints.includes(en)) hints.push(en)
  }
  return hints
}

function fallbackCcKeywords(productName: string, context: string): {
  productKeywords: string[]
  situationKeywords: string[]
} {
  const merged = `${productName} ${context}`
  const hints = extractShortKoreanHints(merged)
  const productKeywords = [
    hints.includes("water dispenser") ? "water dispenser" : "",
    hints.includes("drink") ? "drink dispenser" : "",
    "beverage dispenser",
  ].filter(Boolean)
  const situationKeywords = [
    hints.includes("camping") ? "camping pouring drink" : "",
    hints.includes("pouring") || hints.includes("drink")
      ? "person pouring drink outdoors"
      : "",
    hints.includes("camping") ? "campsite drink" : "",
    "pouring beverage b-roll",
  ].filter(Boolean)

  return {
    productKeywords: productKeywords.slice(0, 3),
    situationKeywords: situationKeywords.slice(0, 3),
  }
}

/**
 * CC 검색용 — 긴 문장이 아니라 짧은 영문 키워드 묶음으로 분리
 * product: 제품 관련 / situation: 장면·상황 B-roll
 */
async function buildCcKeywordSets(
  productName: string,
  context: string
): Promise<{ productKeywords: string[]; situationKeywords: string[] }> {
  const openAiKey =
    process.env.OPENAI_API_KEY || process.env.GPT_API_KEY || process.env.CHATGPT_API_KEY
  const fallback = fallbackCcKeywords(productName, context)
  if (!openAiKey) return fallback

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 220,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You extract SHORT English YouTube search KEYWORDS for Creative Commons B-roll.
Return JSON only:
{
  "productKeywords": ["2-4 word English keyword phrases about the PRODUCT only"],
  "situationKeywords": ["2-5 word English keyword phrases about the SCENE/SITUATION only, no product model names"]
}
Rules:
- Never paste Korean text.
- Never use long titles, brand dumps, or full sentences.
- Max 3 items per array.
- Prefer visual B-roll terms (camping, pouring drink, outdoors, person holding jug).`,
          },
          {
            role: "user",
            content: `Product (may be long Korean title):\n${productName.slice(0, 120)}\n\nScene/narration/visual guide:\n${(context || "(none)").slice(0, 200)}`,
          },
        ],
      }),
    })
    if (!response.ok) return fallback
    const data = await response.json()
    const raw = String(data.choices?.[0]?.message?.content || "").trim()
    const parsed = JSON.parse(raw) as {
      productKeywords?: unknown
      situationKeywords?: unknown
    }
    const clean = (list: unknown) =>
      (Array.isArray(list) ? list : [])
        .map((item) => String(item || "").replace(/["']/g, "").trim())
        .filter((item) => item.length >= 3 && item.length <= 40 && !/[가-힣]/.test(item))
        .slice(0, 3)

    const productKeywords = clean(parsed.productKeywords)
    const situationKeywords = clean(parsed.situationKeywords)
    if (!productKeywords.length && !situationKeywords.length) return fallback
    return {
      productKeywords: productKeywords.length ? productKeywords : fallback.productKeywords,
      situationKeywords: situationKeywords.length
        ? situationKeywords
        : fallback.situationKeywords,
    }
  } catch {
    return fallback
  }
}

async function searchYoutubeIds(
  apiKey: string,
  query: string,
  creativeCommonsOnly: boolean
): Promise<YouTubeSearchItem[]> {
  const publishedAfter = new Date()
  publishedAfter.setFullYear(publishedAfter.getFullYear() - 3)
  const params = new URLSearchParams({
    part: "snippet",
    maxResults: creativeCommonsOnly ? "12" : "24",
    q: creativeCommonsOnly ? `${query} vertical shorts` : query,
    type: "video",
    order: creativeCommonsOnly ? "relevance" : "viewCount",
    publishedAfter: publishedAfter.toISOString(),
    safeSearch: "moderate",
    key: apiKey,
  })
  if (!creativeCommonsOnly) {
    params.set("videoDuration", "short")
    params.set("regionCode", "US")
    params.set("relevanceLanguage", "en")
  }
  if (creativeCommonsOnly) {
    params.set("videoLicense", "creativeCommon")
    params.set("videoEmbeddable", "true")
    params.set("relevanceLanguage", "en")
  }
  const searchResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${params.toString()}`,
    { next: { revalidate: 21600 } }
  )
  if (!searchResponse.ok) {
    const detail = await searchResponse.text().catch(() => "")
    throw new Error(`YouTube API ${searchResponse.status}: ${detail.slice(0, 160)}`)
  }
  const searchData = (await searchResponse.json()) as { items?: YouTubeSearchItem[] }
  return searchData.items || []
}

async function hydrateVideos(
  apiKey: string,
  searchItems: Array<YouTubeSearchItem & { matchedKeyword?: string }>,
  creativeCommonsOnly: boolean
): Promise<MappedVideo[]> {
  const ids = [
    ...new Set(
      searchItems
        .map((item) => item.id?.videoId)
        .filter((id): id is string => Boolean(id))
    ),
  ]
  if (!ids.length) return []

  const detailParams = new URLSearchParams({
    part: "statistics,contentDetails,status",
    id: ids.join(","),
    key: apiKey,
  })
  const detailResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?${detailParams.toString()}`,
    { next: { revalidate: 21600 } }
  )
  if (!detailResponse.ok) throw new Error("YouTube 영상 상세 정보를 가져오지 못했습니다.")
  const detailData = (await detailResponse.json()) as { items?: YouTubeVideoItem[] }
  const detailMap = new Map((detailData.items || []).map((item) => [item.id, item]))
  const keywordById = new Map(
    searchItems
      .filter((item) => item.id?.videoId)
      .map((item) => [item.id!.videoId!, item.matchedKeyword || ""])
  )

  const maxDurationSec = 90
  return searchItems
    .map((item) => {
      const id = item.id?.videoId || ""
      const snippet = item.snippet || {}
      const detail = detailMap.get(id)
      const duration = detail?.contentDetails?.duration || ""
      return {
        id,
        title: snippet.title || "",
        description: snippet.description || "",
        channelTitle: snippet.channelTitle || "",
        publishedAt: snippet.publishedAt || "",
        thumbnailUrl:
          snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || "",
        viewCount: Number(detail?.statistics?.viewCount || 0),
        likeCount: Number(detail?.statistics?.likeCount || 0),
        duration,
        durationSec: parseDuration(duration),
        url: `https://www.youtube.com/watch?v=${id}`,
        embedUrl: `https://www.youtube.com/embed/${id}`,
        region: "global",
        license: detail?.status?.license || "youtube",
        embeddable: detail?.status?.embeddable !== false,
        matchedKeyword: keywordById.get(id) || "",
      }
    })
    .filter(
      (item) =>
        item.id &&
        item.durationSec > 0 &&
        item.durationSec <= maxDurationSec &&
        (!creativeCommonsOnly ||
          (item.license === "creativeCommon" && item.embeddable))
    )
}

export async function GET(request: NextRequest) {
  const access = await guardStoryApiRequest(request, { limit: 30 })
  if (access.error) return access.error
  const requestUrl = new URL(request.url)
  const productName = requestUrl.searchParams.get("q")?.trim()
  const context = requestUrl.searchParams.get("context")?.trim() || ""
  const extraKeywordsRaw = requestUrl.searchParams.get("keywords")?.trim() || ""
  const creativeCommonsOnly = requestUrl.searchParams.get("license") === "cc"
  if (!productName && !extraKeywordsRaw && !context) {
    return NextResponse.json({ error: "상품명 또는 키워드가 필요합니다." }, { status: 400 })
  }

  const apiKey =
    requestUrl.searchParams.get("apiKey")?.trim() ||
    requestUrl.searchParams.get("youtubeApiKey")?.trim() ||
    process.env.YOUTUBE_API_KEY ||
    ""
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "YouTube Data API 키가 필요합니다. 설정에서 YouTube Data API Key를 저장한 뒤 다시 시도해주세요.",
      },
      { status: 503 }
    )
  }

  try {
    // 비-CC: 기존 단일 쿼리
    if (!creativeCommonsOnly) {
      const searchQueries = await createGlobalSearchQueries(productName || context)
      const searchBatches = await Promise.all(
        searchQueries.map(async (keyword) =>
          (await searchYoutubeIds(apiKey, keyword, false)).map((item) => ({
            ...item,
            matchedKeyword: keyword,
          }))
        )
      )
      const hydrated = await hydrateVideos(apiKey, searchBatches.flat(), false)
      const items = hydrated
        .filter((item, index, list) => list.findIndex((other) => other.id === item.id) === index)
        .map((item) => ({
          ...item,
          ...analyzeStoryMarketVideo(item),
        }))
        .sort(
          (a, b) =>
            b.performanceScore - a.performanceScore ||
            b.viewCount - a.viewCount
        )
        .slice(0, 18)
      return NextResponse.json({
        success: true,
        searchQuery: searchQueries.join(" · "),
        keywords: searchQueries,
        items,
        marketSummary: {
          sampled: items.length,
          formats: items.reduce<Record<string, number>>((counts, item) => {
            counts[item.format] = (counts[item.format] || 0) + 1
            return counts
          }, {}),
        },
      })
    }

    // CC: 짧은 키워드로 여러 번 검색 (제품 + 상황)
    const built = await buildCcKeywordSets(productName || "product", context)
    const extraKeywords = extraKeywordsRaw
      .split(/[,|]/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 2 && item.length <= 40)
      .slice(0, 4)

    const keywordQueries = [
      ...built.productKeywords,
      ...built.situationKeywords,
      ...extraKeywords,
    ]
      .map((item) => item.trim())
      .filter(Boolean)
      // 너무 긴 건 키워드가 아님 — 강제 컷
      .map((item) => item.split(/\s+/).slice(0, 5).join(" "))
      .filter((item, index, arr) => arr.indexOf(item) === index)
      .slice(0, 4)

    if (!keywordQueries.length) {
      return NextResponse.json({
        success: true,
        searchQuery: "",
        keywords: [],
        productKeywords: [],
        situationKeywords: [],
        items: [],
      })
    }

    const mergedSearchItems: Array<YouTubeSearchItem & { matchedKeyword?: string }> = []
    for (const keyword of keywordQueries) {
      const batch = await searchYoutubeIds(apiKey, keyword, true)
      for (const item of batch) {
        mergedSearchItems.push({ ...item, matchedKeyword: keyword })
      }
    }

    const items = (await hydrateVideos(apiKey, mergedSearchItems, true))
      .filter((item, index, arr) => arr.findIndex((other) => other.id === item.id) === index)
      .map((item) => ({ ...item, ...analyzeStoryMarketVideo(item) }))
      .sort(
        (a, b) =>
          b.performanceScore - a.performanceScore ||
          b.viewCount - a.viewCount
      )
      .slice(0, 18)

    return NextResponse.json({
      success: true,
      searchQuery: keywordQueries.join(" · "),
      keywords: keywordQueries,
      productKeywords: built.productKeywords,
      situationKeywords: built.situationKeywords,
      extraKeywords,
      items,
    })
  } catch (error) {
    console.error("[Story Shopping YouTube References]", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "해외 관련 영상을 가져오지 못했습니다.",
      },
      { status: 500 }
    )
  }
}
