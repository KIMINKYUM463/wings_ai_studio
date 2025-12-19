import { NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

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
 * AI 경쟁 전략 분석
 */
async function analyzeStrategy(videos: AnalyzedVideo[], geminiApiKey: string): Promise<any> {
  const genAI = new GoogleGenerativeAI(geminiApiKey)
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" })

  const topVideos = videos.slice(0, 10)

  const prompt = `당신은 전 세계 1위 유튜브 전략 컨설턴트입니다. 아래 채널 데이터를 기반으로 '초격차 경쟁 전략'을 수립하세요.

[데이터: 인기 영상 Top 10]
${JSON.stringify(topVideos, null, 2)}

분석 결과는 반드시 다음 JSON 구조로 응답하세요:
{
  "coreConcept": { "title": "핵심 컨셉", "description": "상세 설명" },
  "detailedPlan": { 
      "contentDirection": "콘텐츠 방향성", 
      "uploadSchedule": "추천 스케줄",
      "keywordStrategy": "점유할 키워드"
  },
  "revenueModel": "수익화 제안"
}

설명이나 추가 텍스트 없이 JSON만 출력해주세요.`

  try {
    const result = await model.generateContent(prompt)
    const response = await result.response
    let text = response.text().trim()

    // JSON 코드 블록 제거
    if (text.startsWith("```json")) {
      text = text.replace(/```json\n?/g, "").replace(/```\n?/g, "")
    } else if (text.startsWith("```")) {
      text = text.replace(/```\n?/g, "")
    }

    // JSON 파싱
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    } else {
      throw new Error("JSON 파싱 실패")
    }
  } catch (error) {
    console.error("[Strategy Analysis] 오류:", error)
    throw error
  }
}

/**
 * AI 성장 과정 분석
 */
async function analyzeGrowth(videos: AnalyzedVideo[], geminiApiKey: string): Promise<any> {
  const genAI = new GoogleGenerativeAI(geminiApiKey)
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" })

  const timelineData = videos.map((v) => ({
    t: v.title,
    d: v.publishedAt,
    v: v.viewCount,
  }))

  const prompt = `당신은 유튜브 데이터 사이언티스트입니다. 영상 업로드 타임라인을 분석하여 채널의 성장 임계점(Tipping Point)과 성공 공식을 도출하세요.

[데이터: 타임라인]
${JSON.stringify(timelineData, null, 2)}

분석 결과 JSON 구조:
{
  "overallSummary": "채널 성장사 총평",
  "phases": [
    { "phaseTitle": "단계명", "period": "기간", "strategyAnalysis": "적용된 성공 전략" }
  ]
}

설명이나 추가 텍스트 없이 JSON만 출력해주세요.`

  try {
    const result = await model.generateContent(prompt)
    const response = await result.response
    let text = response.text().trim()

    // JSON 코드 블록 제거
    if (text.startsWith("```json")) {
      text = text.replace(/```json\n?/g, "").replace(/```\n?/g, "")
    } else if (text.startsWith("```")) {
      text = text.replace(/```\n?/g, "")
    }

    // JSON 파싱
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    } else {
      throw new Error("JSON 파싱 실패")
    }
  } catch (error) {
    console.error("[Growth Analysis] 오류:", error)
    throw error
  }
}

/**
 * AI 채널 주치의 컨설팅
 */
async function analyzeConsulting(videos: AnalyzedVideo[], geminiApiKey: string): Promise<any> {
  const genAI = new GoogleGenerativeAI(geminiApiKey)
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" })

  const recentVideos = videos.slice(0, 15)

  const prompt = `당신은 유튜브 채널 전문 주치의입니다. SWOT 분석을 통해 채널의 병목 현상을 진단하고 처방전을 내리세요.

[데이터: 최근 성과]
${JSON.stringify(recentVideos, null, 2)}

분석 결과 JSON 구조:
{
  "overallDiagnosis": "종합 진단 결과",
  "detailedAnalysis": [
    { "area": "분야(예: 썸네일)", "problem": "문제점", "solution": "해결책" }
  ],
  "actionPlan": { "shortTerm": ["당장 할 일 3가지"], "longTerm": ["장기 과제"] }
}

설명이나 추가 텍스트 없이 JSON만 출력해주세요.`

  try {
    const result = await model.generateContent(prompt)
    const response = await result.response
    let text = response.text().trim()

    // JSON 코드 블록 제거
    if (text.startsWith("```json")) {
      text = text.replace(/```json\n?/g, "").replace(/```\n?/g, "")
    } else if (text.startsWith("```")) {
      text = text.replace(/```\n?/g, "")
    }

    // JSON 파싱
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    } else {
      throw new Error("JSON 파싱 실패")
    }
  } catch (error) {
    console.error("[Consulting Analysis] 오류:", error)
    throw error
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
    const { channelId, youtubeApiKey, geminiApiKey } = body

    if (!channelId) {
      return NextResponse.json(
        { error: "채널 ID가 필요합니다." },
        { status: 400 }
      )
    }

    // API 키 우선순위: 요청에서 받은 키 > 환경 변수
    const YOUTUBE_API_KEY = youtubeApiKey || process.env.YOUTUBE_API_KEY
    const GEMINI_API_KEY = geminiApiKey || process.env.API_KEY || process.env.GEMINI_API_KEY

    if (!YOUTUBE_API_KEY) {
      return NextResponse.json(
        { error: "YouTube API Key가 필요합니다." },
        { status: 400 }
      )
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Gemini API Key가 필요합니다." },
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

    // 2. AI 분석 병렬 실행
    console.log("[Channel Analysis] AI 분석 시작...")
    const [strategy, growth, consulting] = await Promise.all([
      analyzeStrategy(videos, GEMINI_API_KEY),
      analyzeGrowth(videos, GEMINI_API_KEY),
      analyzeConsulting(videos, GEMINI_API_KEY),
    ])

    console.log("[Channel Analysis] AI 분석 완료")

    return NextResponse.json({
      success: true,
      result: {
        channelInfo,
        videos,
        metadata,
        strategy,
        growth,
        consulting,
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

