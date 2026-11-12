import { NextRequest, NextResponse } from "next/server"
import { fetchYoutubeTranscript } from "@/lib/youtube-transcript"

/**
 * YouTube 영상의 자막(수동·자동 생성)을 가져옵니다.
 * POST /api/youmaker/get-video-transcript
 *
 * watch 페이지 자막 URL은 poToken 없이 빈 응답을 주는 경우가 많아,
 * ANDROID InnerTube 경로를 쓰는 공용 lib/youtube-transcript 를 사용합니다.
 */
export async function POST(request: NextRequest) {
  try {
    const { videoId } = (await request.json()) as { videoId?: string }
    if (!videoId) {
      return NextResponse.json({ error: "영상 ID가 필요합니다." }, { status: 400 })
    }

    const transcript = await fetchYoutubeTranscript(String(videoId))
    if (!transcript) {
      return NextResponse.json({
        success: false,
        transcript: "",
        hasCaptions: false,
        message: "자막 데이터를 가져올 수 없습니다. 자막이 없거나 접근이 제한된 영상일 수 있습니다.",
      })
    }

    return NextResponse.json({
      success: true,
      transcript,
      hasCaptions: true,
      message: "자막을 성공적으로 가져왔습니다.",
    })
  } catch (error) {
    console.error("[Get Video Transcript] 오류:", error)
    return NextResponse.json(
      { error: `서버 오류: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    )
  }
}
