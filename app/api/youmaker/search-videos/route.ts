import { NextRequest, NextResponse } from "next/server"

/**
 * YouTube Data API를 사용하여 키워드로 영상을 검색하고 필터링합니다.
 * POST /api/youmaker/search-videos
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      keyword,
      categoryId,
      duration,
      minViews,
      maxResults = 50,
      apiKey,
    } = body

    if (!apiKey) {
      return NextResponse.json(
        { error: "YouTube Data API Key가 필요합니다." },
        { status: 400 }
      )
    }

    if (!keyword || !keyword.trim()) {
      return NextResponse.json(
        { error: "키워드가 필요합니다." },
        { status: 400 }
      )
    }

    // 1개월 전 날짜 계산
    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
    const publishedAfter = oneMonthAgo.toISOString()

    // YouTube Search API 파라미터 구성
    const searchParams = new URLSearchParams({
      part: "snippet",
      q: keyword.trim(),
      type: "video",
      maxResults: "200", // 최대 200개 검색 후 필터링
      order: "viewCount",
      regionCode: "KR",
      relevanceLanguage: "ko",
      publishedAfter,
      key: apiKey,
    })

    // 카테고리 필터 추가
    if (categoryId && categoryId !== "all") {
      searchParams.append("videoCategoryId", categoryId)
    }

    // 길이 필터 추가
    if (duration) {
      if (duration === "short") {
        searchParams.append("videoDuration", "short") // 4분 이하
      } else if (duration === "medium") {
        // 4분~20분은 API에서 직접 지원하지 않으므로 나중에 필터링
        searchParams.append("videoDuration", "medium")
      } else if (duration === "long") {
        searchParams.append("videoDuration", "long") // 20분 이상
      }
    }

    // YouTube Search API 호출
    const searchResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`
    )

    if (!searchResponse.ok) {
      const errorData = await searchResponse.json().catch(() => ({}))
      return NextResponse.json(
        { error: `YouTube API 오류: ${errorData.error?.message || searchResponse.statusText}` },
        { status: searchResponse.status }
      )
    }

    const searchData = await searchResponse.json()

    if (!searchData.items || searchData.items.length === 0) {
      return NextResponse.json({
        success: true,
        videos: [],
        totalViews: 0,
        totalLikes: 0,
        totalComments: 0,
      })
    }

    // 비디오 ID 추출
    const videoIds = searchData.items.map((item: any) => item.id.videoId).join(",")

    // 비디오 상세 정보 가져오기 (통계, 길이 등)
    const videosResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${videoIds}&key=${apiKey}`
    )

    if (!videosResponse.ok) {
      const errorData = await videosResponse.json().catch(() => ({}))
      return NextResponse.json(
        { error: `YouTube API 오류: ${errorData.error?.message || videosResponse.statusText}` },
        { status: videosResponse.status }
      )
    }

    const videosData = await videosResponse.json()

    // 길이 파싱 함수 (ISO 8601 형식: PT4M13S -> 초 단위)
    const parseDuration = (duration: string): number => {
      const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
      if (!match) return 0
      const hours = parseInt(match[1] || "0", 10)
      const minutes = parseInt(match[2] || "0", 10)
      const seconds = parseInt(match[3] || "0", 10)
      return hours * 3600 + minutes * 60 + seconds
    }

    // 영상 데이터 처리 및 필터링
    let filteredVideos = videosData.items
      .map((item: any) => {
        const durationSeconds = parseDuration(item.contentDetails?.duration || "PT0S")
        const viewCount = parseInt(item.statistics?.viewCount || "0", 10)
        const likeCount = parseInt(item.statistics?.likeCount || "0", 10)
        const commentCount = parseInt(item.statistics?.commentCount || "0", 10)

        return {
          id: item.id,
          title: item.snippet?.title || "",
          channelTitle: item.snippet?.channelTitle || "",
          channelId: item.snippet?.channelId || "",
          thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || "",
          publishedAt: item.snippet?.publishedAt || "",
          duration: durationSeconds, // 초 단위
          viewCount,
          likeCount,
          commentCount,
        }
      })
      .filter((video: any) => {
        // 길이 필터 (4분~20분은 API에서 직접 지원하지 않으므로 여기서 필터링)
        if (duration === "medium") {
          const durationSeconds = video.duration
          if (durationSeconds < 240 || durationSeconds > 1200) {
            // 4분 미만 또는 20분 초과
            return false
          }
        } else if (duration === "short") {
          // 4분 이하 (240초 이하)
          if (video.duration > 240) {
            return false
          }
        } else if (duration === "long") {
          // 20분 이상 (1200초 이상)
          if (video.duration < 1200) {
            return false
          }
        }

        // 조회수 필터
        if (minViews) {
          const minViewsMap: Record<string, number> = {
            "10000": 10000,
            "50000": 50000,
            "100000": 100000,
            "500000": 500000,
            "1000000": 1000000,
          }
          const minViewCount = minViewsMap[minViews] || 0
          if (video.viewCount < minViewCount) {
            return false
          }
        }

        return true
      })

    // 인기 점수 계산 함수
    const calculatePopularityScore = (viewCount: number, likeCount: number, commentCount: number): number => {
      // 조회수 60%: 10,000회 = 1점
      const viewScore = (viewCount / 10000) * 0.6

      // 좋아요 30%: 100개 = 1점
      const likeScore = (likeCount / 100) * 0.3

      // 댓글 10%: 10개 = 1점
      const commentScore = (commentCount / 10) * 0.1

      return Math.round((viewScore + likeScore + commentScore) * 100) / 100
    }

    // 인기 점수 계산 및 정렬
    filteredVideos = filteredVideos
      .map((video: any) => ({
        ...video,
        popularityScore: calculatePopularityScore(video.viewCount, video.likeCount, video.commentCount),
      }))
      .sort((a: any, b: any) => b.popularityScore - a.popularityScore)
      .slice(0, maxResults) // 상위 N개만

    // 통계 계산
    const totalViews = filteredVideos.reduce((sum: number, video: any) => sum + video.viewCount, 0)
    const totalLikes = filteredVideos.reduce((sum: number, video: any) => sum + video.likeCount, 0)
    const totalComments = filteredVideos.reduce((sum: number, video: any) => sum + video.commentCount, 0)

    return NextResponse.json({
      success: true,
      videos: filteredVideos,
      totalViews,
      totalLikes,
      totalComments,
      targetCount: maxResults,
      analyzedCount: searchData.items.length,
    })
  } catch (error) {
    console.error("[Search Videos] 오류:", error)
    return NextResponse.json(
      {
        error: `서버 오류: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    )
  }
}

