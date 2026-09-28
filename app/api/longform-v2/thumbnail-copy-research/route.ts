import { NextResponse } from "next/server"
import { youtubeApiKeyFromRequest } from "@/lib/longform-v2/youtube/resolveYoutubeDataApiKey"
import { formatYoutubeDataApiErrorMessage } from "@/lib/longform-v2/youtube/youtubeDataApiErrors"
import type {
  ThumbnailCopyResearchItem,
  ThumbnailCopyResearchResult,
} from "@/lib/longform-v2/youtube/thumbnailCopyResearch"

export const runtime = "nodejs"
export const maxDuration = 60

function parseDurationSeconds(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const hours = Number.parseInt(match[1] || "0", 10)
  const minutes = Number.parseInt(match[2] || "0", 10)
  const seconds = Number.parseInt(match[3] || "0", 10)
  return hours * 3600 + minutes * 60 + seconds
}

/** 제목을 썸네일 문구 대용 줄로 나눔 (OCR 미이식 시) */
function titleAsThumbnailLines(title: string): string[] {
  const parts = title
    .split(/[|/·•\-|–—:：]/u)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
  if (parts.length >= 2) return parts.slice(0, 3)
  if (title.trim()) return [title.trim()]
  return []
}

/**
 * 주제 키워드로 YouTube 롱폼 고조회 검색 → 카피 리서치 참고 수집
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      topic?: string
      keywords?: string[]
      maxItems?: number
      months?: number
      regionCode?: string
      youtubeApiKey?: string
    }

    const apiKey = youtubeApiKeyFromRequest(req, body.youtubeApiKey)
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "YouTube Data API 키가 필요합니다. 설정 → API 키에서 YouTube Data API Key를 저장하세요.",
        },
        { status: 400 },
      )
    }

    const topic = String(body.topic || "").trim()
    const keywords = (Array.isArray(body.keywords) ? body.keywords : [])
      .map((k) => String(k || "").trim())
      .filter(Boolean)
    const searchKeyword = keywords[0] || topic
    if (!searchKeyword) {
      return NextResponse.json(
        { success: false, error: "검색 키워드(주제)가 필요합니다." },
        { status: 400 },
      )
    }

    const maxItems = Math.min(12, Math.max(4, Number(body.maxItems) || 10))
    const months = Math.min(24, Math.max(1, Number(body.months) || 12))
    const regionCode = String(body.regionCode || "KR").trim() || "KR"

    const publishedAfter = new Date()
    publishedAfter.setMonth(publishedAfter.getMonth() - months)

    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search")
    searchUrl.searchParams.set("part", "snippet")
    searchUrl.searchParams.set("type", "video")
    searchUrl.searchParams.set("videoDuration", "long")
    searchUrl.searchParams.set("order", "viewCount")
    searchUrl.searchParams.set("maxResults", "20")
    searchUrl.searchParams.set("regionCode", regionCode)
    searchUrl.searchParams.set("relevanceLanguage", "ko")
    searchUrl.searchParams.set("publishedAfter", publishedAfter.toISOString())
    searchUrl.searchParams.set("q", searchKeyword)
    searchUrl.searchParams.set("key", apiKey)

    const searchRes = await fetch(searchUrl.toString())
    const searchData = (await searchRes.json().catch(() => ({}))) as {
      error?: { message?: string }
      items?: Array<{
        id?: { videoId?: string }
        snippet?: {
          title?: string
          channelTitle?: string
          thumbnails?: { medium?: { url?: string }; high?: { url?: string } }
        }
      }>
    }

    if (!searchRes.ok) {
      const msg = formatYoutubeDataApiErrorMessage(
        searchData.error?.message || `YouTube 검색 실패 (${searchRes.status})`,
      )
      return NextResponse.json({ success: false, error: msg }, { status: searchRes.status })
    }

    const rawItems = searchData.items || []
    const videoIds = rawItems
      .map((it) => it.id?.videoId)
      .filter((id): id is string => Boolean(id))

    if (!videoIds.length) {
      const empty: ThumbnailCopyResearchResult = {
        topic: topic || searchKeyword,
        keywords: [searchKeyword],
        items: [],
      }
      return NextResponse.json({ success: true, ...empty })
    }

    const statsUrl = new URL("https://www.googleapis.com/youtube/v3/videos")
    statsUrl.searchParams.set("part", "statistics,contentDetails,snippet")
    statsUrl.searchParams.set("id", videoIds.join(","))
    statsUrl.searchParams.set("key", apiKey)

    const statsRes = await fetch(statsUrl.toString())
    const statsData = (await statsRes.json().catch(() => ({}))) as {
      error?: { message?: string }
      items?: Array<{
        id?: string
        statistics?: { viewCount?: string }
        contentDetails?: { duration?: string }
        snippet?: {
          title?: string
          channelTitle?: string
          thumbnails?: { medium?: { url?: string }; high?: { url?: string } }
        }
      }>
    }

    if (!statsRes.ok) {
      const msg = formatYoutubeDataApiErrorMessage(
        statsData.error?.message || `YouTube 영상 조회 실패 (${statsRes.status})`,
      )
      return NextResponse.json({ success: false, error: msg }, { status: statsRes.status })
    }

    const byId = new Map((statsData.items || []).map((v) => [v.id || "", v]))

    const items: ThumbnailCopyResearchItem[] = []
    for (const raw of rawItems) {
      const videoId = raw.id?.videoId
      if (!videoId) continue
      const detail = byId.get(videoId)
      const duration = detail?.contentDetails?.duration || ""
      // 롱폼만 (3분+)
      if (parseDurationSeconds(duration) < 180) continue

      const title =
        detail?.snippet?.title?.trim() || raw.snippet?.title?.trim() || ""
      const channelTitle =
        detail?.snippet?.channelTitle?.trim() ||
        raw.snippet?.channelTitle?.trim() ||
        ""
      const viewCount = Number.parseInt(detail?.statistics?.viewCount || "0", 10) || 0
      const thumbnailUrl =
        detail?.snippet?.thumbnails?.high?.url ||
        detail?.snippet?.thumbnails?.medium?.url ||
        raw.snippet?.thumbnails?.high?.url ||
        raw.snippet?.thumbnails?.medium?.url

      items.push({
        videoId,
        title,
        channelTitle,
        viewCount,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnailUrl,
        thumbnailLines: titleAsThumbnailLines(title),
        searchKeyword,
      })
    }

    items.sort((a, b) => b.viewCount - a.viewCount)
    const sliced = items.slice(0, maxItems)

    const result: ThumbnailCopyResearchResult = {
      topic: topic || searchKeyword,
      keywords: [searchKeyword],
      items: sliced,
    }

    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : "카피 리서치 실패"
    console.error("[longform-v2/thumbnail-copy-research]", message)
    return NextResponse.json(
      { success: false, error: formatYoutubeDataApiErrorMessage(message) },
      { status: 500 },
    )
  }
}
