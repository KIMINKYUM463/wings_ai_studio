import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")
  const months = searchParams.get("months") || "3"
  const clientApiKey = searchParams.get("apiKey")

  if (!query) {
    return NextResponse.json({ error: "Query parameter is required" }, { status: 400 })
  }

  // API 키는 클라이언트에서 필수로 전달되어야 함 (하드코딩 제거)
  const YOUTUBE_API_KEY = clientApiKey || process.env.YOUTUBE_API_KEY
  
  if (!YOUTUBE_API_KEY) {
    return NextResponse.json(
      { error: "YouTube Data API Key가 필요합니다. 설정 페이지에서 API 키를 입력해주세요." },
      { status: 400 }
    )
  }

  try {
    const selectedMonthsAgo = new Date()
    selectedMonthsAgo.setMonth(selectedMonthsAgo.getMonth() - Number.parseInt(months))
    const publishedAfter = selectedMonthsAgo.toISOString()

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=20&q=${encodeURIComponent(query)}&type=video&videoDuration=long&regionCode=KR&relevanceLanguage=ko&order=viewCount&publishedAfter=${publishedAfter}&key=${YOUTUBE_API_KEY}`,
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("YouTube API 오류:", response.status, errorData)
      
      // 구체적인 오류 메시지 반환
      if (response.status === 403) {
        return NextResponse.json(
          { error: "YouTube API 키가 유효하지 않거나 할당량을 초과했습니다." },
          { status: 403 }
        )
      } else if (response.status === 400) {
        return NextResponse.json(
          { error: "YouTube API 요청이 잘못되었습니다." },
          { status: 400 }
        )
      }
      
      throw new Error(`YouTube API request failed: ${response.status}`)
    }

    const data = await response.json()

    const videoIds = data.items.map((item: any) => item.id.videoId).join(",")
    const channelIds = [...new Set(data.items.map((item: any) => item.snippet.channelId))].join(",")

    const statsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${videoIds}&key=${YOUTUBE_API_KEY}`,
    )

    const channelsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelIds}&key=${YOUTUBE_API_KEY}`,
    )

    const statsData = await statsResponse.json()
    const channelsData = await channelsResponse.json()

    const channelProfileMap = new Map()
    channelsData.items?.forEach((channel: any) => {
      channelProfileMap.set(channel.id, channel.snippet.thumbnails.default.url)
    })

    const enrichedItems = data.items
      .map((item: any, index: number) => {
        const videoDetails = statsData.items[index]
        const stats = videoDetails?.statistics || {}
        const contentDetails = videoDetails?.contentDetails || {}
        const snippet = videoDetails?.snippet || {}

        const duration = contentDetails.duration || ""
        const isLongForm = parseDuration(duration) > 240 // 4 minutes in seconds

        return {
          id: item.id.videoId,
          title: item.snippet.title,
          channelTitle: item.snippet.channelTitle,
          channelId: item.snippet.channelId,
          channelProfileUrl: channelProfileMap.get(item.snippet.channelId) || "",
          publishedAt: item.snippet.publishedAt,
          viewCount: stats.viewCount || "0",
          thumbnailUrl: item.snippet.thumbnails.medium.url,
          description: item.snippet.description,
          tags: snippet.tags || [],
          duration: duration,
          isLongForm: isLongForm,
          url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        }
      })
      .filter((item: any) => item.isLongForm)
      .sort((a: any, b: any) => Number.parseInt(b.viewCount) - Number.parseInt(a.viewCount))

    return NextResponse.json({ items: enrichedItems })
  } catch (error) {
    console.error("YouTube API Error:", error)
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류"
    return NextResponse.json(
      { error: `YouTube 데이터를 가져오는데 실패했습니다: ${errorMessage}` },
      { status: 500 }
    )
  }
}

function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0

  const hours = Number.parseInt(match[1] || "0")
  const minutes = Number.parseInt(match[2] || "0")
  const seconds = Number.parseInt(match[3] || "0")

  return hours * 3600 + minutes * 60 + seconds
}
