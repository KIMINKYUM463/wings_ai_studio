import { NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

/**
 * Gemini AI를 사용하여 인기 동영상 목록에서 트렌드 키워드를 추출합니다.
 * POST /api/youmaker/analyze-trends
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

    // 동영상 데이터를 JSON 형태로 정리
    const videosData = videos.map((video: any) => ({
      title: video.title,
      channelTitle: video.channelTitle,
      viewCount: video.viewCount,
    }))

    const prompt = `다음은 한국 유튜브의 실시간 인기 동영상 50개 목록입니다.

${JSON.stringify(videosData, null, 2)}

이 50개의 인기 영상 리스트를 분석하여:
1. 공통된 주제나 키워드별로 그룹화
2. 각 그룹의 총 조회수를 합산하여 랭킹 매기기
3. 각 키워드의 트렌드 점수 계산 (조회수 기반)

다음 JSON 형식으로 응답해주세요:
{
  "trends": [
    {
      "keyword": "키워드명",
      "totalViews": 총조회수,
      "videoCount": 해당키워드영상수,
      "trendScore": 트렌드점수,
      "videos": [
        {
          "title": "영상제목",
          "channelTitle": "채널명",
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
    let trendsData
    try {
      // JSON 코드 블록이 있는 경우 제거
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        trendsData = JSON.parse(jsonMatch[0])
      } else {
        trendsData = JSON.parse(text)
      }
    } catch (parseError) {
      console.error("[Analyze Trends] JSON 파싱 오류:", parseError)
      console.error("[Analyze Trends] 응답 텍스트:", text)
      return NextResponse.json(
        { error: "AI 응답을 파싱할 수 없습니다." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      trends: trendsData.trends || [],
    })
  } catch (error) {
    console.error("[Analyze Trends] 오류:", error)
    return NextResponse.json(
      {
        error: `서버 오류: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    )
  }
}




