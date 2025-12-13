import { NextResponse } from "next/server"

/**
 * YouTube 연결 상태 확인 API
 * GET /api/youtube/status
 * 
 * 로컬스토리지에서 확인하므로 서버에서는 항상 false 반환
 * 실제 확인은 클라이언트에서 수행
 */
export async function GET() {
  try {
    // 로컬스토리지 기반이므로 서버에서는 항상 false
    // 실제 확인은 클라이언트에서 localStorage.getItem("youtube_tokens")로 확인
    return NextResponse.json({ 
      connected: false,
      message: "로컬스토리지에서 확인하세요"
    })
  } catch (error) {
    console.error("[YouTube] 연결 상태 확인 오류:", error)
    return NextResponse.json({ connected: false }, { status: 500 })
  }
}

