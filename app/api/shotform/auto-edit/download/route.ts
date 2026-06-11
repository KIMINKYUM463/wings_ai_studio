import { type NextRequest, NextResponse } from "next/server"
import { autoEditOutputStoragePath } from "@/lib/shotform-auto-edit-job-store"
import { getAutoEditJobAsync, readAutoEditOutput } from "@/lib/shotform-auto-edit-jobs"
import { createMvpProjectsClient } from "@/lib/supabase/mvp-projects"

const STORAGE_BUCKET = "video-sources"

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId")?.trim()
  if (!jobId) {
    return NextResponse.json({ error: "jobId가 필요합니다." }, { status: 400 })
  }

  const inline = req.nextUrl.searchParams.get("inline") === "1"
  const job = await getAutoEditJobAsync(jobId)
  const storagePath = job?.outputStoragePath || autoEditOutputStoragePath(jobId)

  if (storagePath) {
    try {
      const supabase = await createMvpProjectsClient()
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(storagePath, 3600)
      if (!error && data?.signedUrl) {
        if (inline) {
          return NextResponse.redirect(data.signedUrl, { status: 302 })
        }
        const remote = await fetch(data.signedUrl, { cache: "no-store" })
        if (remote.ok) {
          const buf = Buffer.from(await remote.arrayBuffer())
          if (buf.length >= 20_000) {
            const title = job?.analysis?.title || job?.analyses?.[0]?.title || "shopping-short"
            const safe = title.slice(0, 32).replace(/[^\w\uac00-\ud7af\u4e00-\u9fff-]+/g, "_")
            return new NextResponse(new Uint8Array(buf), {
              status: 200,
              headers: {
                "Content-Type": "video/mp4",
                "Content-Length": String(buf.length),
                "Content-Disposition": `attachment; filename="${encodeURIComponent(`${safe || "auto-edit"}_${jobId.slice(0, 8)}.mp4`)}"`,
                "Cache-Control": "private, max-age=3600",
              },
            })
          }
        }
      }
    } catch (e) {
      console.error("[auto-edit/download] signed url fallback:", e)
    }
  }

  const file = await readAutoEditOutput(jobId)
  if (!file) {
    return NextResponse.json(
      { error: "편집 결과를 찾을 수 없거나 만료되었습니다. 짜집기를 다시 실행해 주세요." },
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
    },
  })
}
