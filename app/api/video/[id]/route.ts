import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()

    // 사용자 인증 확인
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 영상 정보 조회
    const { data: video, error: videoError } = await supabase
      .from("videos")
      .select("*")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .single()

    if (videoError || !video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 })
    }

    // Storage에서 영상 파일 URL 생성
    const { data: urlData } = await supabase.storage.from("videos").createSignedUrl(video.storage_path, 3600) // 1시간 유효

    if (!urlData?.signedUrl) {
      return NextResponse.json({ error: "Failed to generate video URL" }, { status: 500 })
    }

    // 영상 파일을 스트리밍으로 반환
    const response = await fetch(urlData.signedUrl)
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch video" }, { status: 500 })
    }

    const videoBuffer = await response.arrayBuffer()

    return new NextResponse(videoBuffer, {
      headers: {
        "Content-Type": video.file_type,
        "Content-Length": video.file_size.toString(),
        "Cache-Control": "public, max-age=3600",
      },
    })
  } catch (error) {
    console.error("Video API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
