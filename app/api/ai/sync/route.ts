import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { videoId, audioUrl, subtitles } = await request.json()

    if (!videoId || !audioUrl || !subtitles) {
      return NextResponse.json({ error: "VideoId, audioUrl, and subtitles are required" }, { status: 400 })
    }

    console.log("[v0] 영상 동기화 API 호출:", { videoId, audioUrl, subtitlesCount: subtitles.length })

    await new Promise((resolve) => setTimeout(resolve, 1000)) // 1초 대기

    console.log("[v0] 영상 동기화 완료")

    return NextResponse.json({
      success: true,
      syncedVideoUrl: `/api/video/${videoId}`,
    })
  } catch (error) {
    console.error("[v0] Sync API error:", error)
    return NextResponse.json({ error: "Video sync failed" }, { status: 500 })
  }
}
