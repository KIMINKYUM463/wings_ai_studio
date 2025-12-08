import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 사용자 인증 확인
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { videoUrl, format, quality } = await request.json()

    if (!videoUrl) {
      return NextResponse.json({ error: "Video URL is required" }, { status: 400 })
    }

    // 실제 구현에서는 FFmpeg 등을 사용하여 영상 변환
    // 여기서는 시뮬레이션을 위해 원본 영상을 반환
    const response = await fetch(videoUrl)
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch video" }, { status: 500 })
    }

    const videoBuffer = await response.arrayBuffer()

    // 다운로드 카운트 업데이트 (실제 구현에서)
    // await supabase.from('final_videos').update({ download_count: ... })

    return new NextResponse(videoBuffer, {
      headers: {
        "Content-Type": `video/${format}`,
        "Content-Disposition": `attachment; filename="shorts_video.${format}"`,
        "Cache-Control": "no-cache",
      },
    })
  } catch (error) {
    console.error("Download API error:", error)
    return NextResponse.json({ error: "Download failed" }, { status: 500 })
  }
}
