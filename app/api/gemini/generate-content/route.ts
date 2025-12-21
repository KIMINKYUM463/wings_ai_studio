import { NextRequest, NextResponse } from "next/server"

// 내부적으로 사용할 Gemini API 키
const INTERNAL_GEMINI_API_KEY = "AIzaSyDd4WA3vBc3lwKkccfzf0C5RFWhJ44Y1jQ"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { model, contents, generationConfig } = body

    if (!model || !contents) {
      return NextResponse.json(
        { error: "model과 contents는 필수입니다." },
        { status: 400 }
      )
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${INTERNAL_GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents,
          generationConfig: generationConfig || {},
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: `Gemini API 호출 실패: ${response.status}`, details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Gemini API 라우트 오류:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}

