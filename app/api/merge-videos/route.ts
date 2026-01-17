import { type NextRequest, NextResponse } from "next/server"

/**
 * 여러 영상을 하나로 합치는 API
 * 
 * 요청:
 * - POST /api/merge-videos
 * - body: { videoUrls: string[] }
 * 
 * 응답:
 * - { success: boolean, mergedVideoUrl: string }
 * 
 * 참고: 실제로는 FFmpeg를 사용하여 서버에서 영상을 합쳐야 하지만,
 * 현재는 클라이언트 측에서 처리하도록 URL 배열을 반환합니다.
 * 실제 구현 시 FFmpeg를 사용하여 영상을 합치는 것이 좋습니다.
 */
export async function POST(request: NextRequest) {
  try {
    const { videoUrls } = await request.json()

    if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length === 0) {
      return NextResponse.json(
        { error: "videoUrls 배열이 필요합니다." },
        { status: 400 }
      )
    }

    console.log(`[Merge Videos] ${videoUrls.length}개 영상 합치기 요청`)

    // TODO: 실제로는 FFmpeg를 사용하여 서버에서 영상을 합쳐야 합니다
    // 현재는 클라이언트 측에서 처리하도록 URL 배열을 반환
    // 
    // 실제 구현 예시:
    // 1. 각 영상 URL에서 영상 다운로드
    // 2. FFmpeg concat demuxer를 사용하여 영상 합치기
    // 3. 합쳐진 영상을 Supabase Storage나 다른 스토리지에 업로드
    // 4. 공개 URL 반환
    
    // 임시로 첫 번째 영상 URL 반환 (실제로는 합쳐진 영상 URL 반환)
    console.log(`[Merge Videos] 임시로 첫 번째 영상 반환 (실제 합치기 로직 구현 필요)`)
    
    return NextResponse.json({
      success: true,
      mergedVideoUrl: videoUrls[0], // 임시: 첫 번째 영상 반환
      videoUrls: videoUrls, // 클라이언트에서 처리할 수 있도록 URL 배열도 반환
      message: "영상 합치기 기능은 아직 구현되지 않았습니다. 클라이언트에서 처리하세요."
    })
  } catch (error) {
    console.error("[Merge Videos] 오류:", error)
    return NextResponse.json(
      { error: "영상 합치기에 실패했습니다." },
      { status: 500 }
    )
  }
}

