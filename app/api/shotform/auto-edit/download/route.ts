import { type NextRequest, NextResponse } from "next/server"
import { readAutoEditOutput } from "@/lib/shotform-auto-edit-jobs"
import { resolveAutoEditOutputPlayableUrl } from "@/lib/shotform-auto-edit-playable-url"

export const maxDuration = 120

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId")?.trim()
  if (!jobId) {
    return NextResponse.json({ error: "jobId가 필요합니다." }, { status: 400 })
  }

  const mode = req.nextUrl.searchParams.get("mode")
  if (mode === "url") {
    const playable = await resolveAutoEditOutputPlayableUrl(jobId)
    if (!playable) {
      return NextResponse.json(
        {
          error:
            "편집 결과 MP4를 찾을 수 없습니다. Storage 업로드·Supabase 설정을 확인한 뒤 짜집기를 다시 실행해 주세요.",
        },
        { status: 404 }
      )
    }
    return NextResponse.json({
      url: playable.url,
      kind: playable.kind,
    })
  }

  const inline = req.nextUrl.searchParams.get("inline") === "1"
  const file = await readAutoEditOutput(jobId)
  if (!file) {
    return NextResponse.json(
      { error: "편집 결과를 찾을 수 없거나 만료되었습니다. 잠시 후 다시 시도하거나 짜집기를 다시 실행해 주세요." },
      { status: 404 }
    )
  }

  return new NextResponse(new Uint8Array(file.buffer), {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(file.buffer.length),
      "Content-Disposition": inline
        ? "inline"
        : `attachment; filename="${encodeURIComponent(file.filename)}"`,
      "Cache-Control": "private, max-age=3600",
      "Accept-Ranges": "bytes",
    },
  })
}
