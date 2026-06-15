import { type NextRequest, NextResponse } from "next/server"
import {
  autoEditJobStoreEnabled,
  createAutoEditPrecisionMetaUploadUrl,
} from "@/lib/shotform-auto-edit-job-store"

/** POST — 브라우저가 정밀 키프레임 메타 JSON을 Supabase에 직접 올리기 위한 signed URL */
export async function POST(req: NextRequest) {
  try {
    if (!autoEditJobStoreEnabled()) {
      return NextResponse.json(
        { error: "Supabase Storage가 설정되지 않았습니다 (NEXT_PUBLIC_SUPABASE_URL)." },
        { status: 503 }
      )
    }

    const body = (await req.json().catch(() => ({}))) as { jobId?: string; videoId?: string }
    const jobId = body.jobId?.trim()
    const videoId = body.videoId?.trim()
    if (!jobId || !videoId) {
      return NextResponse.json({ error: "jobId와 videoId가 필요합니다." }, { status: 400 })
    }

    const signed = await createAutoEditPrecisionMetaUploadUrl(jobId, videoId)
    if (!signed) {
      return NextResponse.json(
        { error: "정밀 메타 업로드 URL을 만들지 못했습니다. SUPABASE_SERVICE_ROLE_KEY를 확인해 주세요." },
        { status: 500 }
      )
    }

    return NextResponse.json(signed)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "오류" }, { status: 500 })
  }
}
