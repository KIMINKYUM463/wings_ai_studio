import { type NextRequest, NextResponse } from "next/server"
import { fetchAndCropStoryboardCell } from "@/lib/youtube-storyboard-crop"

function isYoutubeStoryboardHost(hostname: string): boolean {
  return hostname.endsWith(".ytimg.com") || hostname === "ytimg.com"
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url")
  const col = Math.max(0, parseInt(req.nextUrl.searchParams.get("col") || "0", 10) || 0)
  const row = Math.max(0, parseInt(req.nextUrl.searchParams.get("row") || "0", 10) || 0)
  const cols = Math.max(1, parseInt(req.nextUrl.searchParams.get("cols") || "1", 10) || 1)
  const rows = Math.max(1, parseInt(req.nextUrl.searchParams.get("rows") || "1", 10) || 1)

  if (!raw) {
    return NextResponse.json({ error: "url 파라미터가 필요합니다." }, { status: 400 })
  }

  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return NextResponse.json({ error: "잘못된 URL입니다." }, { status: 400 })
  }
  if (target.protocol !== "https:" || !isYoutubeStoryboardHost(target.hostname)) {
    return NextResponse.json({ error: "허용되지 않은 스토리보드 호스트입니다." }, { status: 403 })
  }
  if (col >= cols || row >= rows) {
    return NextResponse.json({ error: "잘못된 col/row입니다." }, { status: 400 })
  }

  try {
    const cropped = await fetchAndCropStoryboardCell(raw, col, row, cols, rows)
    return new NextResponse(cropped, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "크롭 실패" },
      { status: 502 }
    )
  }
}
