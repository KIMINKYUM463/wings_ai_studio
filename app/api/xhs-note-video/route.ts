import { type NextRequest, NextResponse } from "next/server"
import { extractXhsNoteId, fetchXhsNoteVideoUrl } from "@/lib/xhs-video"

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url")?.trim() || ""
  if (!raw) {
    return NextResponse.json({ error: "url 파라미터가 필요합니다." }, { status: 400 })
  }
  if (!extractXhsNoteId(raw)) {
    return NextResponse.json({ error: "샤오홍슈 노트 URL이 아닙니다." }, { status: 400 })
  }

  try {
    const videoUrl = await fetchXhsNoteVideoUrl(raw)
    if (!videoUrl) {
      return NextResponse.json(
        { error: "노트 페이지에서 재생 가능한 영상 URL을 찾지 못했습니다." },
        { status: 404 }
      )
    }
    return NextResponse.json({ videoUrl })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "영상 URL 조회 실패"
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
