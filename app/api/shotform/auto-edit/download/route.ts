import { type NextRequest, NextResponse } from "next/server"
import { readAutoEditOutput } from "@/lib/shotform-auto-edit-jobs"

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId")?.trim()
  if (!jobId) {
    return NextResponse.json({ error: "jobId가 필요합니다." }, { status: 400 })
  }

  const file = await readAutoEditOutput(jobId)
  if (!file) {
    return NextResponse.json({ error: "편집 결과를 찾을 수 없거나 만료되었습니다." }, { status: 404 })
  }

  const inline = req.nextUrl.searchParams.get("inline") === "1"

  return new NextResponse(new Uint8Array(file.buffer), {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(file.buffer.length),
      "Content-Disposition": inline
        ? "inline"
        : `attachment; filename="${encodeURIComponent(file.filename)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  })
}
