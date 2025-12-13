import { NextRequest, NextResponse } from "next/server"

/**
 * YouTube 업로드 예약 API
 * POST /api/youtube/schedule
 * 
 * 클라이언트에서 직접 업로드 API를 호출하도록 안내합니다.
 * (토큰이 로컬스토리지에 있어서 서버에서 접근 불가)
 * 
 * 요청 본문:
 * {
 *   videoUrl: string,
 *   title: string,
 *   description: string,
 *   thumbnailUrl?: string,
 *   scheduledTime: string,
 *   tags?: string[],
 *   categoryId?: string,
 *   privacyStatus?: "private" | "unlisted" | "public"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      videoUrl,
      title,
      description,
      thumbnailUrl,
      scheduledTime,
      tags = [],
      categoryId = "22",
      privacyStatus = "private",
    } = body

    // 필수 필드 검증
    if (!videoUrl || !title || !description || !scheduledTime) {
      return NextResponse.json(
        { error: "필수 필드가 누락되었습니다." },
        { status: 400 }
      )
    }

    // 예약 시간 검증
    const scheduledDate = new Date(scheduledTime)
    const now = new Date()
    if (scheduledDate <= now) {
      return NextResponse.json(
        { error: "예약 시간은 현재 시간보다 이후여야 합니다." },
        { status: 400 }
      )
    }

    // 클라이언트에서 직접 업로드하도록 안내
    // (토큰이 로컬스토리지에 있어서 서버에서 접근 불가)
    return NextResponse.json({
      success: true,
      requiresClientUpload: true,
      message: "클라이언트에서 직접 업로드를 수행해야 합니다.",
      uploadData: {
        videoUrl,
        title,
        description,
        thumbnailUrl,
        scheduledTime,
        tags,
        categoryId,
        privacyStatus,
      },
    })
  } catch (error) {
    console.error("[YouTube] 예약 오류:", error)
    return NextResponse.json(
      { error: "예약 중 오류가 발생했습니다.", details: error instanceof Error ? error.message : "알 수 없는 오류" },
      { status: 500 }
    )
  }
}
