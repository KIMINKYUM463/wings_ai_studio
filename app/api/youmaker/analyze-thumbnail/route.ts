import { NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

export const dynamic = 'force-dynamic'

/**
 * 썸네일 분석 API
 * POST /api/youmaker/analyze-thumbnail
 * 
 * Gemini 3 Flash Preview 모델을 사용하여 썸네일을 분석합니다.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { imageBase64, mimeType, geminiApiKey } = body

    if (!imageBase64) {
      return NextResponse.json(
        { error: "이미지가 필요합니다." },
        { status: 400 }
      )
    }

    // process.env.API_KEY를 우선 사용, 없으면 요청에서 받은 키 사용
    const GEMINI_API_KEY = process.env.API_KEY || geminiApiKey

    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Gemini API Key가 필요합니다." },
        { status: 400 }
      )
    }

    try {
      // Gemini 3 Flash Preview 모델 초기화
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
      const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" })

      console.log("[Thumbnail Analysis] Gemini 3 Flash Preview 모델로 썸네일 분석 시작")

      // 시스템 프롬프트
      const systemPrompt = `당신은 1,000만 회 이상의 조회수를 기록한 영상들을 분석한 유튜브 전략가 및 시각 디자이너입니다. 
업로드된 썸네일 이미지를 다음 세 가지 기준으로 세밀하게 분석해주세요:

1. 시인성(Visibility): 모바일 환경에서의 가독성, 피사체의 선명도
2. 심리적 자극: 시청자의 클릭을 유발하는 감정적 트리거 및 정보의 결핍 활용
3. 디자인 밸런스: 3등분의 법칙, 보색 대비, 시선의 흐름

각 항목에 대해 0-100점으로 점수를 매기고, 상세한 분석과 구체적인 개선 권장사항을 제공해주세요.
또한 종합 점수와 전체적인 요약, 종합 개선사항도 제공해주세요.

응답은 반드시 다음 JSON 형식으로만 제공해주세요:
{
  "visibility": {
    "score": 85,
    "analysis": "상세한 분석 내용...",
    "recommendations": ["권장사항 1", "권장사항 2", ...]
  },
  "psychologicalTrigger": {
    "score": 78,
    "analysis": "상세한 분석 내용...",
    "recommendations": ["권장사항 1", "권장사항 2", ...]
  },
  "designBalance": {
    "score": 82,
    "analysis": "상세한 분석 내용...",
    "recommendations": ["권장사항 1", "권장사항 2", ...]
  },
  "overallScore": 82,
  "summary": "전체적인 요약 내용...",
  "improvements": ["종합 개선사항 1", "종합 개선사항 2", ...]
}

설명이나 추가 텍스트 없이 JSON만 출력해주세요.`

      // 이미지 데이터 준비
      const imagePart = {
        inlineData: {
          data: imageBase64,
          mimeType: mimeType || "image/png",
        },
      }

      // Gemini API 호출
      const result = await model.generateContent([systemPrompt, imagePart])
      const response = await result.response
      const text = response.text()

      console.log("[Thumbnail Analysis] Gemini 응답:", text.substring(0, 200))

      // JSON 추출
      let analysisData: any = null
      
      // JSON 코드 블록 제거
      let jsonText = text.trim()
      if (jsonText.startsWith("```json")) {
        jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "")
      } else if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/```\n?/g, "")
      }

      // JSON 파싱
      try {
        analysisData = JSON.parse(jsonText)
      } catch (parseError) {
        // JSON 파싱 실패 시 텍스트에서 JSON 추출 시도
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          analysisData = JSON.parse(jsonMatch[0])
        } else {
          throw new Error("JSON 파싱에 실패했습니다.")
        }
      }

      // 데이터 검증 및 기본값 설정
      const analysis: any = {
        visibility: {
          score: analysisData.visibility?.score || 0,
          analysis: analysisData.visibility?.analysis || "분석 데이터가 없습니다.",
          recommendations: analysisData.visibility?.recommendations || [],
        },
        psychologicalTrigger: {
          score: analysisData.psychologicalTrigger?.score || 0,
          analysis: analysisData.psychologicalTrigger?.analysis || "분석 데이터가 없습니다.",
          recommendations: analysisData.psychologicalTrigger?.recommendations || [],
        },
        designBalance: {
          score: analysisData.designBalance?.score || 0,
          analysis: analysisData.designBalance?.analysis || "분석 데이터가 없습니다.",
          recommendations: analysisData.designBalance?.recommendations || [],
        },
        overallScore: analysisData.overallScore || 0,
        summary: analysisData.summary || "분석이 완료되었습니다.",
        improvements: analysisData.improvements || [],
      }

      // 점수 범위 검증 (0-100)
      analysis.visibility.score = Math.max(0, Math.min(100, analysis.visibility.score))
      analysis.psychologicalTrigger.score = Math.max(0, Math.min(100, analysis.psychologicalTrigger.score))
      analysis.designBalance.score = Math.max(0, Math.min(100, analysis.designBalance.score))
      analysis.overallScore = Math.max(0, Math.min(100, analysis.overallScore))

      console.log("[Thumbnail Analysis] 썸네일 분석 완료:", {
        overallScore: analysis.overallScore,
        visibility: analysis.visibility.score,
        psychologicalTrigger: analysis.psychologicalTrigger.score,
        designBalance: analysis.designBalance.score,
      })

      return NextResponse.json({
        success: true,
        analysis,
      })
    } catch (geminiError) {
      console.error("[Thumbnail Analysis] Gemini 분석 실패:", geminiError)
      throw geminiError
    }
  } catch (error) {
    console.error("[Thumbnail Analysis] 오류:", error)
    return NextResponse.json(
      {
        error: `썸네일 분석 실패: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    )
  }
}

