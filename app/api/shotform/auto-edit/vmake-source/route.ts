import { type NextRequest, NextResponse } from "next/server"
import { readVmakeTempSource } from "@/lib/shotform-vmake-temp-source"

/** Vmake AI가 Douyin 등 CDN 직접 fetch 불가 시 — 임시 공개 MP4 제공 */
export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId")?.trim()
  const videoId = req.nextUrl.searchParams.get("videoId")?.trim()
  const token = req.nextUrl.searchParams.get("token")?.trim()

  if (!jobId || !videoId || !token) {
    return NextResponse.json({ error: "jobId, videoId, token 필요" }, { status: 400 })
  }

  const buf = await readVmakeTempSource(jobId, videoId, token)
  if (!buf) {
    return NextResponse.json({ error: "만료되었거나 없는 영상" }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(buf.length),
      "Cache-Control": "private, max-age=3600",
      "Accept-Ranges": "bytes",
    },
  })
}
