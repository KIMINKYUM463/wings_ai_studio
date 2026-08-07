import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * 채널 통계 일괄 조회
 * POST /api/youmaker/channel-stats
 * body: { apiKey, channelIds: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const apiKey = body.apiKey as string | undefined
    const channelIds = (body.channelIds || []) as string[]

    if (!apiKey) {
      return NextResponse.json({ error: "YouTube Data API Key가 필요합니다." }, { status: 400 })
    }

    const ids = Array.from(
      new Set(channelIds.filter((id) => typeof id === "string" && id.startsWith("UC")))
    ).slice(0, 50)

    if (ids.length === 0) {
      return NextResponse.json({ success: true, channels: {} })
    }

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${ids.join(",")}&key=${apiKey}`
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: `YouTube API 오류: ${errorData.error?.message || response.statusText}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    const channels: Record<
      string,
      {
        title: string
        thumbnailUrl: string
        customUrl: string
        subscriberCount: number
        viewCount: number
        videoCount: number
      }
    > = {}

    for (const item of data.items || []) {
      channels[item.id] = {
        title: item.snippet?.title || "",
        thumbnailUrl:
          item.snippet?.thumbnails?.high?.url ||
          item.snippet?.thumbnails?.default?.url ||
          "",
        customUrl: item.snippet?.customUrl || "",
        subscriberCount: parseInt(item.statistics?.subscriberCount || "0", 10),
        viewCount: parseInt(item.statistics?.viewCount || "0", 10),
        videoCount: parseInt(item.statistics?.videoCount || "0", 10),
      }
    }

    return NextResponse.json({ success: true, channels })
  } catch (error) {
    console.error("[Channel Stats] 오류:", error)
    return NextResponse.json(
      { error: `서버 오류: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    )
  }
}
