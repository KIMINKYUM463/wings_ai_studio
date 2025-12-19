import { NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

export const dynamic = 'force-dynamic'

interface NewsItem {
  title: string
  description: string
  url: string
  publishedAt: string
  source?: string
}

interface NewsResponse {
  items: NewsItem[]
  referenceDate: string
}

/**
 * JSON 파싱 헬퍼 함수
 */
function parseJsonClean(text: string): NewsResponse | null {
  try {
    // JSON 코드 블록 제거
    let cleaned = text.trim()
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/```json\n?/g, "").replace(/```\n?/g, "")
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/```\n?/g, "")
    }

    // JSON 추출
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    return JSON.parse(cleaned)
  } catch (error) {
    console.error("[News Fetch] JSON 파싱 오류:", error)
    return null
  }
}

/**
 * 실시간 뉴스 수집 API
 * POST /api/youmaker/fetch-news
 * 
 * Gemini 3 Flash Preview 모델의 Google Search 도구를 사용하여 실시간 뉴스를 수집합니다.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { category, geminiApiKey } = body

    if (!category || !category.trim()) {
      return NextResponse.json(
        { error: "카테고리가 필요합니다." },
        { status: 400 }
      )
    }

    const GEMINI_API_KEY = geminiApiKey || process.env.API_KEY || process.env.GEMINI_API_KEY

    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Gemini API Key가 필요합니다." },
        { status: 400 }
      )
    }

    console.log("[News Fetch] 뉴스 수집 시작:", category)

    // Gemini AI 초기화
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
    
    // gemini-3-flash-preview 모델 사용 (Google Search 도구 지원)
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3-flash-preview",
    })

    // 프롬프트 구성
    const prompt = `${category} 분야의 최신 뉴스를 JSON 형식으로 가져와줘.

다음 JSON 구조로 응답해주세요:
{
  "items": [
    {
      "title": "뉴스 제목",
      "description": "뉴스 요약",
      "url": "뉴스 링크",
      "publishedAt": "발행일시",
      "source": "출처 (선택사항)"
    }
  ],
  "referenceDate": "기준 날짜"
}

최신 뉴스 10-20개를 수집해주세요. 설명이나 추가 텍스트 없이 JSON만 출력해주세요.`

    try {
      // Google Search 도구를 사용하여 실시간 뉴스 수집
      // Note: Google Search 도구는 gemini-3-flash-preview 모델에서 지원됩니다
      const response = await model.generateContent({
        contents: prompt,
        tools: [{ googleSearch: {} }],
        generationConfig: {
          responseMimeType: "application/json",
        },
      })

      const responseText = response.response.text()
      console.log("[News Fetch] Gemini 응답:", responseText.substring(0, 200))

      // JSON 파싱
      const result = parseJsonClean(responseText)

      if (!result || !result.items || !Array.isArray(result.items)) {
        throw new Error("뉴스 데이터 파싱에 실패했습니다.")
      }

      // 데이터 검증 및 정리
      const newsItems: NewsItem[] = result.items
        .filter((item: any) => item.title && item.url)
        .map((item: any) => ({
          title: item.title || "",
          description: item.description || "",
          url: item.url || "",
          publishedAt: item.publishedAt || new Date().toISOString(),
          source: item.source || "",
        }))

      const newsResponse: NewsResponse = {
        items: newsItems,
        referenceDate: result.referenceDate || new Date().toLocaleString("ko-KR"),
      }

      console.log("[News Fetch] 뉴스 수집 완료:", {
        count: newsItems.length,
        category,
      })

      return NextResponse.json({
        success: true,
        ...newsResponse,
      })
    } catch (geminiError) {
      console.error("[News Fetch] Gemini API 오류:", geminiError)
      
      // Google Search 도구가 지원되지 않는 경우 fallback
      // 일반 generateContent로 재시도
      try {
        const fallbackResponse = await model.generateContent(prompt)
        const fallbackText = fallbackResponse.response.text()
        const result = parseJsonClean(fallbackText)

        if (result && result.items && Array.isArray(result.items)) {
          const newsItems: NewsItem[] = result.items
            .filter((item: any) => item.title && item.url)
            .map((item: any) => ({
              title: item.title || "",
              description: item.description || "",
              url: item.url || "",
              publishedAt: item.publishedAt || new Date().toISOString(),
              source: item.source || "",
            }))

          return NextResponse.json({
            success: true,
            items: newsItems,
            referenceDate: result.referenceDate || new Date().toLocaleString("ko-KR"),
          })
        }
      } catch (fallbackError) {
        console.error("[News Fetch] Fallback 실패:", fallbackError)
      }

      throw geminiError
    }
  } catch (error) {
    console.error("[News Fetch] 오류:", error)
    return NextResponse.json(
      {
        error: `뉴스 수집 실패: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    )
  }
}

