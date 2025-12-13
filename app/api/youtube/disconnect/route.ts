import { NextResponse } from "next/server"

/**
 * YouTube 연결 해제 API
 * POST /api/youtube/disconnect
 * 
 * 로컬스토리지 기반이므로 서버에서는 성공만 반환
 * 실제 삭제는 클라이언트에서 수행
 */
export async function POST() {
  try {
    // 로컬스토리지 기반이므로 서버에서는 성공만 반환
    // 실제 삭제는 클라이언트에서 localStorage.removeItem("youtube_tokens")로 수행
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[YouTube] 연결 해제 오류:", error)
    return NextResponse.json(
      { error: "연결 해제 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}

