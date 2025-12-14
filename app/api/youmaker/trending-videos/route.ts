import { NextRequest, NextResponse } from "next/server"

/**
 * YouTube Data API를 사용하여 한국 지역의 인기 동영상 50개를 가져옵니다.
 * GET /api/youmaker/trending-videos
 */
export async function GET(request: NextRequest) {
  try {
    // 쿼리 파라미터에서 API 키 가져오기
    const searchParams = request.nextUrl.searchParams
    const apiKey = searchParams.get("apiKey")

    if (!apiKey) {
      return NextResponse.json(
        { error: "YouTube Data API Key가 필요합니다." },
        { status: 400 }
      )
    }

    // YouTube Data API 호출
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=KR&maxResults=50&key=${apiKey}`
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: `YouTube API 오류: ${errorData.error?.message || response.statusText}` },
        { status: response.status }
      )
    }

    const data = await response.json()

    // 필요한 데이터만 추출
    const videos = data.items?.map((item: any) => ({
      id: item.id,
      title: item.snippet?.title || "",
      channelTitle: item.snippet?.channelTitle || "",
      channelId: item.snippet?.channelId || "",
      thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || "",
      viewCount: parseInt(item.statistics?.viewCount || "0"),
      likeCount: parseInt(item.statistics?.likeCount || "0"),
      publishedAt: item.snippet?.publishedAt || "",
      description: item.snippet?.description || "",
    })) || []

    return NextResponse.json({
      success: true,
      videos,
    })
  } catch (error) {
    console.error("[Trending Videos] 오류:", error)
    return NextResponse.json(
      {
        error: `서버 오류: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    )
  }
}




