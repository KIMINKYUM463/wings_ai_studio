import { NextRequest, NextResponse } from "next/server"

export const dynamic = 'force-dynamic'

interface AnalyzedVideo {
  title: string
  viewCount: number
  likeCount: number
  commentCount: number
  publishedAt: string
  popularityScore: number
  videoId: string
  thumbnailUrl: string
  description: string
}

/**
 * YouTube 데이터 수집
 */
async function getChannelData(channelId: string, youtubeApiKey: string): Promise<{
  channelInfo: {
    title: string
    subscriberCount: string
    videoCount: string
    viewCount: string
    thumbnailUrl: string
    publishedAt: string
    description: string
  }
  videos: AnalyzedVideo[]
  metadata: {
    channelCreationDate: string
    firstUploadDate: string
    averageUploadCycle: string
    recentUploadCycle: string
  }
}> {
  // 1. 채널 정보 가져오기
  const channelResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=contentDetails,statistics,snippet&id=${channelId}&key=${youtubeApiKey}`
  )

  if (!channelResponse.ok) {
    const errorData = await channelResponse.json().catch(() => ({}))
    throw new Error(`채널 정보 조회 실패: ${errorData.error?.message || channelResponse.statusText}`)
  }

  const channelData = await channelResponse.json()

  if (!channelData.items || channelData.items.length === 0) {
    throw new Error("채널을 찾을 수 없습니다.")
  }

  const channel = channelData.items[0]
  const uploadsId = channel.contentDetails?.relatedPlaylists?.uploads

  if (!uploadsId) {
    throw new Error("채널의 업로드 플레이리스트를 찾을 수 없습니다.")
  }

  // 2. 업로드 플레이리스트에서 최신 영상 50개 가져오기
  const playlistResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails,snippet&playlistId=${uploadsId}&maxResults=50&key=${youtubeApiKey}`
  )

  if (!playlistResponse.ok) {
    const errorData = await playlistResponse.json().catch(() => ({}))
    throw new Error(`플레이리스트 조회 실패: ${errorData.error?.message || playlistResponse.statusText}`)
  }

  const playlistData = await playlistResponse.json()

  if (!playlistData.items || playlistData.items.length === 0) {
    return {
      channelInfo: {
        title: channel.snippet.title,
        subscriberCount: channel.statistics.subscriberCount || "0",
        videoCount: channel.statistics.videoCount || "0",
        viewCount: channel.statistics.viewCount || "0",
      },
      videos: [],
    }
  }

  const videoIds = playlistData.items.map((item: any) => item.contentDetails.videoId).join(",")

  // 3. 각 영상의 상세 통계 가져오기
  const videosResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds}&key=${youtubeApiKey}`
  )

  if (!videosResponse.ok) {
    const errorData = await videosResponse.json().catch(() => ({}))
    throw new Error(`영상 통계 조회 실패: ${errorData.error?.message || videosResponse.statusText}`)
  }

  const videosData = await videosResponse.json()

  const videos: AnalyzedVideo[] = (videosData.items || []).map((v: any) => {
    const views = parseInt(v.statistics.viewCount || "0", 10)
    const likes = parseInt(v.statistics.likeCount || "0", 10)
    const comments = parseInt(v.statistics.commentCount || "0", 10)

    // 인기 점수 계산 (유메이커 알고리즘)
    const score = Math.min((views / 10000) * 0.6 + (likes / 100) * 0.3 + (comments / 10) * 0.1, 100)

    return {
      title: v.snippet.title,
      viewCount: views,
      likeCount: likes,
      commentCount: comments,
      publishedAt: v.snippet.publishedAt,
      popularityScore: Math.round(score * 100) / 100, // 소수점 2자리
      videoId: v.id,
      thumbnailUrl: v.snippet.thumbnails?.high?.url || v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url || "",
      description: v.snippet.description || "",
    }
  })

  // 조회수 순으로 정렬
  videos.sort((a, b) => b.viewCount - a.viewCount)

  // 채널 메타데이터 계산
  const channelPublishedAt = channel.snippet.publishedAt || ""
  const firstVideo = videos.length > 0 ? videos[videos.length - 1] : null // 가장 오래된 영상
  const recentVideos = videos.slice(0, 10) // 최근 10개 영상

  // 평균 업로드 주기 계산 (최근 10개 영상 기준)
  let averageDays = 0
  if (recentVideos.length > 1) {
    const dates = recentVideos.map((v) => new Date(v.publishedAt).getTime()).sort((a, b) => a - b)
    const intervals: number[] = []
    for (let i = 1; i < dates.length; i++) {
      intervals.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24)) // 일 단위
    }
    averageDays = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0
  }

  // 최근 업로드 주기 계산 (최근 2개 영상 기준)
  let recentDays = 0
  if (recentVideos.length >= 2) {
    const recentDates = recentVideos.slice(0, 2).map((v) => new Date(v.publishedAt).getTime()).sort((a, b) => a - b)
    recentDays = (recentDates[1] - recentDates[0]) / (1000 * 60 * 60 * 24)
  }

  // 날짜 포맷팅
  const formatDate = (dateString: string) => {
    if (!dateString) return "정보 없음"
    const date = new Date(dateString)
    return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`
  }

  const formatCycle = (days: number) => {
    if (days === 0) return "정보 없음"
    const rounded = Math.round(days)
    if (rounded === 0) return "1일 미만"
    return `${rounded}일`
  }

  return {
    channelInfo: {
      title: channel.snippet.title,
      subscriberCount: channel.statistics.subscriberCount || "0",
      videoCount: channel.statistics.videoCount || "0",
      viewCount: channel.statistics.viewCount || "0",
      thumbnailUrl: channel.snippet.thumbnails?.high?.url || channel.snippet.thumbnails?.default?.url || "",
      publishedAt: channelPublishedAt,
      description: channel.snippet.description || "",
    },
    videos,
    metadata: {
      channelCreationDate: formatDate(channelPublishedAt),
      firstUploadDate: firstVideo ? formatDate(firstVideo.publishedAt) : "정보 없음",
      averageUploadCycle: formatCycle(averageDays),
      recentUploadCycle: formatCycle(recentDays),
    },
  }
}

/**
 * 채널 ID 추출 (URL, ID 또는 채널명)
 */
async function resolveChannelId(input: string, youtubeApiKey: string): Promise<string> {
  // 이미 채널 ID 형식인 경우 (UC로 시작)
  if (input.startsWith("UC") && input.length >= 24) {
    return input
  }

  // URL에서 채널 ID 추출 시도
  const urlPatterns = [
    /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/@([a-zA-Z0-9_-]+)/,
  ]

  for (const pattern of urlPatterns) {
    const match = input.match(pattern)
    if (match) {
      const extracted = match[1]
      
      // @username 형식인 경우 채널 검색 필요
      if (input.includes("/@")) {
        try {
          const searchResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(extracted)}&maxResults=1&key=${youtubeApiKey}`
          )
          
          if (searchResponse.ok) {
            const searchData = await searchResponse.json()
            if (searchData.items && searchData.items.length > 0) {
              return searchData.items[0].id.channelId
            }
          }
        } catch (error) {
          console.error("[Channel ID Resolution] 검색 실패:", error)
        }
      }
      
      // UC로 시작하면 채널 ID로 간주
      if (extracted.startsWith("UC") && extracted.length >= 24) {
        return extracted
      }
    }
  }

  // URL 패턴이 아니면 채널명으로 간주하고 검색
  console.log("[Channel ID Resolution] 채널명으로 검색 시도:", input)
  try {
    const searchResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(input)}&maxResults=5&key=${youtubeApiKey}`
    )
    
    if (searchResponse.ok) {
      const searchData = await searchResponse.json()
      if (searchData.items && searchData.items.length > 0) {
        // 가장 관련성 높은 채널 반환 (첫 번째 결과)
        const channelId = searchData.items[0].id.channelId
        console.log("[Channel ID Resolution] 채널 검색 성공:", {
          input,
          foundChannel: searchData.items[0].snippet.title,
          channelId,
        })
        return channelId
      }
    }
  } catch (error) {
    console.error("[Channel ID Resolution] 채널 검색 실패:", error)
  }

  throw new Error("채널을 찾을 수 없습니다. 채널 ID, URL 또는 정확한 채널명을 입력해주세요.")
}

/**
 * 채널 분석 API
 * POST /api/youmaker/analyze-channel
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { channelId, youtubeApiKey } = body

    if (!channelId) {
      return NextResponse.json(
        { error: "채널 ID가 필요합니다." },
        { status: 400 }
      )
    }

    // API 키 우선순위: 요청에서 받은 키 > 환경 변수
    const YOUTUBE_API_KEY = youtubeApiKey || process.env.YOUTUBE_API_KEY

    if (!YOUTUBE_API_KEY) {
      return NextResponse.json(
        { error: "YouTube API Key가 필요합니다." },
        { status: 400 }
      )
    }

    // 채널 ID 해석 (URL에서 추출 또는 검색)
    const resolvedChannelId = await resolveChannelId(channelId, YOUTUBE_API_KEY)
    console.log("[Channel Analysis] 채널 분석 시작:", resolvedChannelId)

    // 1. YouTube 데이터 수집
    const { channelInfo, videos, metadata } = await getChannelData(resolvedChannelId, YOUTUBE_API_KEY)
    console.log("[Channel Analysis] 데이터 수집 완료:", {
      videoCount: videos.length,
      channelTitle: channelInfo.title,
    })

    if (videos.length === 0) {
      return NextResponse.json(
        { error: "분석할 영상이 없습니다." },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      result: {
        channelInfo,
        videos,
        metadata,
      },
    })
  } catch (error) {
    console.error("[Channel Analysis] 오류:", error)
    return NextResponse.json(
      {
        error: `채널 분석 실패: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    )
  }
}

