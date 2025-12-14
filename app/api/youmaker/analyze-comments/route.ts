import { NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

/**
 * YouTube 댓글을 가져와서 감정 분석을 수행합니다.
 * POST /api/youmaker/analyze-comments
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { videoId, geminiApiKey, youtubeApiKey } = body

    if (!videoId) {
      return NextResponse.json(
        { error: "영상 ID가 필요합니다." },
        { status: 400 }
      )
    }

    if (!youtubeApiKey) {
      return NextResponse.json(
        { error: "YouTube Data API Key가 필요합니다." },
        { status: 400 }
      )
    }

    if (!geminiApiKey) {
      return NextResponse.json(
        { error: "Gemini API Key가 필요합니다." },
        { status: 400 }
      )
    }

    // 1. YouTube Data API로 댓글 가져오기
    let allComments: string[] = []
    let nextPageToken: string | undefined = undefined
    const maxComments = 100 // 최대 100개 댓글 분석

    do {
      const commentsUrl = new URL("https://www.googleapis.com/youtube/v3/commentThreads")
      commentsUrl.searchParams.append("part", "snippet")
      commentsUrl.searchParams.append("videoId", videoId)
      commentsUrl.searchParams.append("maxResults", "100")
      commentsUrl.searchParams.append("order", "relevance")
      commentsUrl.searchParams.append("key", youtubeApiKey)
      if (nextPageToken) {
        commentsUrl.searchParams.append("pageToken", nextPageToken)
      }

      const commentsResponse = await fetch(commentsUrl.toString())

      if (!commentsResponse.ok) {
        const errorData = await commentsResponse.json().catch(() => ({}))
        return NextResponse.json(
          { error: `YouTube API 오류: ${errorData.error?.message || commentsResponse.statusText}` },
          { status: commentsResponse.status }
        )
      }

      const commentsData = await commentsResponse.json()

      if (commentsData.items) {
        const comments = commentsData.items.map((item: any) => {
          return item.snippet?.topLevelComment?.snippet?.textDisplay || ""
        }).filter((text: string) => text.length > 0)

        allComments = allComments.concat(comments)
      }

      nextPageToken = commentsData.nextPageToken

      // 최대 댓글 수에 도달하면 중단
      if (allComments.length >= maxComments) {
        allComments = allComments.slice(0, maxComments)
        break
      }
    } while (nextPageToken && allComments.length < maxComments)

    if (allComments.length === 0) {
      return NextResponse.json({
        success: true,
        sentiment: { positive: 0, negative: 0, neutral: 100 },
        bestKeywords: [],
        summary: "분석할 댓글이 없습니다.",
        pros: [],
        cons: [],
      })
    }

    // 2. Gemini AI로 댓글 감정 분석
    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" })

    const commentsText = allComments.slice(0, 50).join("\n---\n") // 최대 50개 댓글만 분석

    const prompt = `다음은 YouTube 영상의 댓글들입니다. 이 댓글들을 분석하여 다음 정보를 JSON 형식으로 제공해주세요:

1. 감정 분석 (sentiment): 긍정, 부정, 중립 비율을 퍼센트로 계산
2. 베스트 키워드 (bestKeywords): 댓글에서 가장 많이 언급된 핵심 키워드 8개 (배열)
3. 요약 (summary): 전체 댓글의 분위기와 주요 의견을 2-3문장으로 요약
4. 장점 (pros): 시청자들이 좋아하는 점 4개 (배열)
5. 아쉬운 점 (cons): 시청자들이 아쉬워하는 점이나 개선 요청 4개 (배열)

반드시 다음 JSON 형식으로만 응답해주세요 (설명이나 추가 텍스트 없이):
{
  "sentiment": {
    "positive": 숫자,
    "negative": 숫자,
    "neutral": 숫자
  },
  "bestKeywords": ["키워드1", "키워드2", ...],
  "summary": "요약 텍스트",
  "pros": ["장점1", "장점2", "장점3", "장점4"],
  "cons": ["아쉬운점1", "아쉬운점2", "아쉬운점3", "아쉬운점4"]
}

댓글들:
${commentsText}`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    // JSON 추출 (마크다운 코드 블록 제거)
    let jsonText = text.trim()
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "")
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```\n?/g, "")
    }

    let analysisData
    try {
      analysisData = JSON.parse(jsonText)
    } catch (parseError) {
      // JSON 파싱 실패 시 기본값 반환
      console.error("JSON 파싱 실패:", parseError, "원본 텍스트:", text)
      return NextResponse.json({
        success: true,
        sentiment: { positive: 50, negative: 25, neutral: 25 },
        bestKeywords: ["유용함", "도움됨", "추천", "좋아요"],
        summary: "댓글 분석 중 오류가 발생했습니다.",
        pros: ["분석 중"],
        cons: ["분석 중"],
      })
    }

    // 데이터 검증 및 기본값 설정
    const sentiment = {
      positive: analysisData.sentiment?.positive || 0,
      negative: analysisData.sentiment?.negative || 0,
      neutral: analysisData.sentiment?.neutral || 0,
    }

    // 합계가 100이 되도록 정규화
    const total = sentiment.positive + sentiment.negative + sentiment.neutral
    if (total > 0) {
      sentiment.positive = Math.round((sentiment.positive / total) * 100)
      sentiment.negative = Math.round((sentiment.negative / total) * 100)
      sentiment.neutral = 100 - sentiment.positive - sentiment.negative
    }

    return NextResponse.json({
      success: true,
      sentiment,
      bestKeywords: analysisData.bestKeywords || [],
      summary: analysisData.summary || "분석 완료",
      pros: analysisData.pros || [],
      cons: analysisData.cons || [],
    })
  } catch (error) {
    console.error("[Analyze Comments] 오류:", error)
    return NextResponse.json(
      {
        error: `서버 오류: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    )
  }
}

