import { NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

/**
 * Gemini AI를 사용하여 인기 동영상 목록에서 라이징 크리에이터를 분석합니다.
 * POST /api/youmaker/rising-creators
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { videos, geminiApiKey } = body

    if (!videos || !Array.isArray(videos)) {
      return NextResponse.json(
        { error: "동영상 데이터가 필요합니다." },
        { status: 400 }
      )
    }

    if (!geminiApiKey) {
      return NextResponse.json(
        { error: "Gemini API Key가 필요합니다." },
        { status: 400 }
      )
    }

    // Gemini AI 초기화
    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" })

    // 채널별로 그룹화
    const channelMap = new Map<string, any[]>()
    videos.forEach((video: any) => {
      const channelId = video.channelId || video.channelTitle
      if (!channelMap.has(channelId)) {
        channelMap.set(channelId, [])
      }
      channelMap.get(channelId)!.push(video)
    })

    const channelsData = Array.from(channelMap.entries()).map(([channelId, channelVideos]) => ({
      channelId,
      channelTitle: channelVideos[0].channelTitle,
      videoCount: channelVideos.length,
      totalViews: channelVideos.reduce((sum, v) => sum + (v.viewCount || 0), 0),
      videos: channelVideos.map((v: any) => ({
        title: v.title,
        viewCount: v.viewCount,
      })),
    }))

    const prompt = `다음은 한국 유튜브의 실시간 인기 동영상 목록에서 채널별로 그룹화한 데이터입니다.

${JSON.stringify(channelsData, null, 2)}

이 리스트에 있는 채널 중에서, 급상승 동영상에 이름을 올린 주목할 만한 크리에이터를 분석해주세요.

다음 JSON 형식으로 응답해주세요:
{
  "creators": [
    {
      "channelTitle": "채널명",
      "channelId": "채널ID",
      "videoCount": 인기영상개수,
      "totalViews": 총조회수,
      "averageViews": 평균조회수,
      "highlight": "주목할만한점",
      "videos": [
        {
          "title": "영상제목",
          "viewCount": 조회수
        }
      ]
    }
  ]
}

응답은 반드시 유효한 JSON 형식이어야 하며, 다른 설명이나 텍스트는 포함하지 마세요.`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    // JSON 파싱 시도
    let creatorsData
    try {
      // JSON 코드 블록이 있는 경우 제거
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        creatorsData = JSON.parse(jsonMatch[0])
      } else {
        creatorsData = JSON.parse(text)
      }
    } catch (parseError) {
      console.error("[Rising Creators] JSON 파싱 오류:", parseError)
      console.error("[Rising Creators] 응답 텍스트:", text)
      return NextResponse.json(
        { error: "AI 응답을 파싱할 수 없습니다." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      creators: creatorsData.creators || [],
    })
  } catch (error) {
    console.error("[Rising Creators] 오류:", error)
    return NextResponse.json(
      {
        error: `서버 오류: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    )
  }
}

