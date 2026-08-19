import { NextResponse } from "next/server"
import { hasFfmpeg } from "@/lib/ffmpeg-binaries"
import { insertClipIntoMp4Buffer } from "@/lib/mvp-insert-clip-ffmpeg"
import { readFormMp4Buffer } from "@/lib/mvp-read-form-mp4"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(req: Request) {
  if (!hasFfmpeg()) {
    return NextResponse.json(
      {
        error:
          "서버에서 ffmpeg를 찾지 못했습니다. npm install 후 dev 서버를 재시작해 주세요.",
      },
      { status: 503 }
    )
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: "요청 본문을 읽지 못했습니다." }, { status: 400 })
  }

  const insertAtSec = Number.parseFloat(String(form.get("insertAtSec") || "0"))
  const clipDurationSec = Number.parseFloat(String(form.get("clipDurationSec") || "2"))
  const clipStartSec = Number.parseFloat(String(form.get("clipStartSec") || "0"))
  const mainDurationSec = Number.parseFloat(String(form.get("mainDurationSec") || "0"))
  const replaceEndRaw = form.get("replaceEndSec")
  const replaceEndSec =
    replaceEndRaw != null && String(replaceEndRaw).trim() !== ""
      ? Number.parseFloat(String(replaceEndRaw))
      : NaN

  try {
    const [mainMp4, clipVideo] = await Promise.all([
      readFormMp4Buffer(form, "video", "videoUrl"),
      readFormMp4Buffer(form, "clip", "clipUrl", "추가할 영상 파일이 없습니다."),
    ])
    const out = await insertClipIntoMp4Buffer({
      mainMp4,
      clipVideo,
      insertAtSec: Number.isFinite(insertAtSec) ? insertAtSec : 0,
      clipDurationSec: Number.isFinite(clipDurationSec) ? clipDurationSec : 2,
      clipStartSec: Number.isFinite(clipStartSec) && clipStartSec > 0 ? clipStartSec : 0,
      mainDurationSec:
        Number.isFinite(mainDurationSec) && mainDurationSec > 0.1
          ? mainDurationSec
          : undefined,
      replaceEndSec: Number.isFinite(replaceEndSec) ? replaceEndSec : undefined,
    })

    return new NextResponse(new Uint8Array(out), {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(out.length),
        "Cache-Control": "no-store",
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "추가 영상 합성 실패"
    console.error("[mvp-insert-clip]", message)
    const status = /없거나 너무 작|추가할 영상|https만|허용되지 않은/.test(message)
      ? 400
      : 500
    return NextResponse.json({ error: message }, { status })
  }
}
