import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const channelId = searchParams.get("channelId")

  if (!channelId) {
    return NextResponse.json({ error: "Channel ID is required" }, { status: 400 })
  }

  try {
    // 기본 API 키 사용 (환경변수 > 기본값)
    const DEFAULT_YOUTUBE_API_KEY = "AIzaSyA_hdd4NMhZtyxwxhI7s_QDsd2n2yAHWKM"
    const apiKey = process.env.YOUTUBE_API_KEY || DEFAULT_YOUTUBE_API_KEY

    // 채널 기본 정보 가져오기
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`,
    )
    const channelData = await channelResponse.json()

    if (!channelData.items || channelData.items.length === 0) {
      throw new Error("Channel not found")
    }

    const channel = channelData.items[0]

    // 유사 채널 검색 (채널의 주요 키워드로 검색)
    const searchQuery = channel.snippet.title.split(" ")[0] // 첫 번째 단어로 검색
    const similarChannelsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(searchQuery)}&maxResults=10&key=${apiKey}`,
    )
    const similarChannelsData = await similarChannelsResponse.json()

    // 유사 채널들의 상세 정보 가져오기
    const similarChannelIds = similarChannelsData.items
      ?.filter((item: any) => item.id.channelId !== channelId) // 자기 자신 제외
      ?.slice(0, 5) // 최대 5개
      ?.map((item: any) => item.id.channelId)
      ?.join(",")

    let similarChannels = []
    if (similarChannelIds) {
      const similarChannelsDetailsResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${similarChannelIds}&key=${apiKey}`,
      )
      const similarChannelsDetails = await similarChannelsDetailsResponse.json()

      similarChannels =
        similarChannelsDetails.items?.map((item: any) => ({
          name: item.snippet.title,
          channelId: item.id,
          profileUrl: item.snippet.thumbnails?.default?.url || "/placeholder.svg?height=40&width=40",
          subscribers: formatSubscriberCount(item.statistics.subscriberCount),
          views: formatViewCount(item.statistics.viewCount),
        })) || []
    }

    // 응답 데이터 구성
    const responseData = {
      channelTitle: channel.snippet.title,
      channelId: channel.id,
      profileUrl: channel.snippet.thumbnails?.default?.url || "/placeholder.svg?height=40&width=40",
      subscriberCount: formatSubscriberCount(channel.statistics.subscriberCount),
      videoCount: `${Number.parseInt(channel.statistics.videoCount).toLocaleString()}개`,
      country: channel.snippet.country || "대한민국",
      dailyViews: formatDailyViews(channel.statistics.viewCount),
      algorithmScore: Math.floor(Math.random() * 40 + 60), // 모의 데이터
      engagement: Math.floor(Math.random() * 30 + 50), // 모의 데이터
      activity: Math.floor(Math.random() * 40 + 60), // 모의 데이터
      subscriberGrowth: Array.from({ length: 30 }, (_, i) => Math.floor(Math.random() * 1000 + 500 + i * 10)),
      viewsGrowth: Array.from({ length: 30 }, (_, i) => Math.floor(Math.random() * 5000 + 2000 + i * 50)),
      similarChannels,
    }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error("채널 분석 API 오류:", error)
    return NextResponse.json({ error: "Failed to fetch channel analysis" }, { status: 500 })
  }
}

function formatSubscriberCount(count: string): string {
  const num = Number.parseInt(count)
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}만`
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}천`
  }
  return num.toString()
}

function formatViewCount(count: string): string {
  const num = Number.parseInt(count)
  if (num >= 100000000) {
    return `${(num / 100000000).toFixed(1)}억`
  } else if (num >= 10000) {
    return `${(num / 10000).toFixed(0)}만`
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}천`
  }
  return num.toString()
}

function formatDailyViews(totalViews: string): string {
  // 대략적인 일일 조회수 계산 (총 조회수 / 365일 정도로 추정)
  const num = Number.parseInt(totalViews)
  const dailyEstimate = Math.floor(num / 365)

  if (dailyEstimate >= 10000) {
    return `${(dailyEstimate / 10000).toFixed(1)}만`
  } else if (dailyEstimate >= 1000) {
    return `${(dailyEstimate / 1000).toFixed(1)}천`
  }
  return dailyEstimate.toString()
}
