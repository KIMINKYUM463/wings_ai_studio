import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { apiKey } = body

    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: "API 키가 제공되지 않았습니다." },
        { status: 400 }
      )
    }

    // Replicate API로 간단한 테스트 요청
    const response = await fetch("https://api.replicate.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
    })

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: "연결 성공!",
      })
    } else {
      const error = await response.json().catch(() => ({ detail: response.statusText }))
      return NextResponse.json(
        {
          success: false,
          message: `연결 실패: ${error.detail || error.message || response.statusText}`,
        },
        { status: response.status }
      )
    }
  } catch (error: any) {
    console.error("[Test Replicate] 오류:", error)
    return NextResponse.json(
      {
        success: false,
        message: `연결 실패: ${error.message || "알 수 없는 오류"}`,
      },
      { status: 500 }
    )
  }
}









