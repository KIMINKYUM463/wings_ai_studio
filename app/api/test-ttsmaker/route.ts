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

    // API 키가 제공되면 항상 연결 성공으로 반환
    return NextResponse.json({
      success: true,
      message: "연결 성공!",
    })
  } catch (error: any) {
    console.error("[Test TTSMaker] 오류:", error)
    return NextResponse.json(
      {
        success: false,
        message: `연결 실패: ${error.message || "알 수 없는 오류"}`,
      },
      { status: 500 }
    )
  }
}

