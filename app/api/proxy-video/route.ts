import { type NextRequest, NextResponse } from "next/server"
import { fetchUpstreamVideo, isAllowedVideoHost, unwrapProxyVideoUrl } from "@/lib/video-upstream-fetch"

export const maxDuration = 300

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url")
  if (!raw) {
    return NextResponse.json({ error: "url 파라미터가 필요합니다." }, { status: 400 })
  }
  let target: URL
  try {
    target = new URL(unwrapProxyVideoUrl(raw))
  } catch {
    return NextResponse.json({ error: "잘못된 URL입니다." }, { status: 400 })
  }
  if (target.protocol !== "https:") {
    return NextResponse.json({ error: "https URL만 허용합니다." }, { status: 400 })
  }
  if (!isAllowedVideoHost(target.hostname)) {
    return NextResponse.json({ error: "허용되지 않은 영상 호스트입니다." }, { status: 403 })
  }

  const range = req.headers.get("range")
  let upstream: Response
  try {
    upstream = await fetchUpstreamVideo(raw, { range: range ?? undefined })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "영상 upstream fetch 실패"
    return NextResponse.json(
      {
        error: msg.includes("upstream fetch 실패")
          ? "영상 CDN 링크가 만료되었거나 접근이 거부되었습니다. 노트 페이지에서 URL을 다시 조회해 주세요."
          : msg,
      },
      { status: 502 }
    )
  }
  const type = upstream.headers.get("content-type") || "video/mp4"
  const headers: Record<string, string> = {
    "Content-Type": type,
    "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    "Accept-Ranges": "bytes",
  }

  const contentLength = upstream.headers.get("content-length")
  if (contentLength) headers["Content-Length"] = contentLength
  const contentRange = upstream.headers.get("content-range")
  if (contentRange) headers["Content-Range"] = contentRange

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  })
}
