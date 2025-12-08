import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { keyword, apiKey: clientApiKey } = await request.json()

    if (!keyword) {
      return NextResponse.json({ error: "키워드를 입력해주세요" }, { status: 400 })
    }

    // 기본 API 키 사용 (클라이언트 전달 > 환경변수 > 기본값)
    const DEFAULT_YOUTUBE_API_KEY = "AIzaSyA_hdd4NMhZtyxwxhI7s_QDsd2n2yAHWKM"
    const apiKey = clientApiKey || process.env.YOUTUBE_API_KEY || DEFAULT_YOUTUBE_API_KEY

    // YouTube Data API로 검색 결과 가져오기
    const searchResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keyword)}&type=video&maxResults=50&order=date&key=${apiKey}`,
    )

    if (!searchResponse.ok) {
      throw new Error("YouTube API 호출 실패")
    }

    const searchData = await searchResponse.json()
    const videoIds = searchData.items.map((item: any) => item.id.videoId).join(",")

    // 비디오 상세 정보 가져오기 (조회수 등)
    const videosResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&key=${apiKey}`,
    )

    if (!videosResponse.ok) {
      throw new Error("YouTube API 호출 실패")
    }

    const videosData = await videosResponse.json()

    // 통계 계산
    const totalViews = videosData.items.reduce((sum: number, item: any) => {
      return sum + Number.parseInt(item.statistics.viewCount || "0")
    }, 0)

    const avgViews = Math.floor(totalViews / videosData.items.length)
    const recentVideos = searchData.items.length

    const estimatedSearchVolume = Math.round((avgViews * recentVideos) / 10 + recentVideos * 500)

    // 트렌드 점수 계산 (0-100)
    // 최근 업로드 수, 평균 조회수, 검색 결과 수를 기반으로 계산
    const searchVolumeScore = Math.min((recentVideos / 50) * 40, 40) // 최대 40점
    const viewsScore = Math.min((avgViews / 10000) * 40, 40) // 최대 40점
    const competitionScore = recentVideos < 20 ? 20 : recentVideos < 40 ? 10 : 0 // 경쟁 낮으면 가산점

    const trendScore = Math.min(Math.round(searchVolumeScore + viewsScore + competitionScore), 100)

    // 경쟁 강도 계산
    let competition: "low" | "medium" | "high" = "medium"
    if (recentVideos < 20) competition = "low"
    else if (recentVideos > 40) competition = "high"

    // 트렌드 방향 (간단한 휴리스틱)
    let trend: "up" | "down" | "stable" = "stable"
    if (trendScore >= 70) trend = "up"
    else if (trendScore < 40) trend = "down"

    // 관련 키워드 생성 (실제로는 Google Trends API나 YouTube Suggest API 사용)
    const relatedKeywords = [
      `${keyword} 튜토리얼`,
      `${keyword} 2025`,
      `${keyword} 초보`,
      `${keyword} 팁`,
      `${keyword} 추천`,
      `${keyword} 방법`,
    ]

    const trendData = {
      keyword,
      searchVolume: estimatedSearchVolume, // 추정 월간 검색량
      trend,
      trendScore,
      recentVideos,
      avgViews,
      competition,
      relatedKeywords,
    }

    return NextResponse.json(trendData)
  } catch (error) {
    console.error("YouTube Trends API Error:", error)
    return NextResponse.json({ error: "분석 중 오류가 발생했습니다" }, { status: 500 })
  }
}
