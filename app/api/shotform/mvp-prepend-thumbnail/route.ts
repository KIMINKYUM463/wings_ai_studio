import { NextResponse } from "next/server"
import { hasFfmpeg } from "@/lib/ffmpeg-binaries"
import { prependThumbnailIntroToMp4Buffer } from "@/lib/mvp-thumbnail-prepend-ffmpeg"
import { MVP_THUMBNAIL_INTRO_SEC } from "@/lib/mvp-thumbnail-intro"

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

  const video = form.get("video")
  const thumbnail = form.get("thumbnail")
  const durationSec = Number.parseFloat(String(form.get("durationSec") || "0"))
  const introSec = Number.parseFloat(String(form.get("introSec") || String(MVP_THUMBNAIL_INTRO_SEC)))

  if (!(video instanceof Blob) || video.size < 1000) {
    return NextResponse.json({ error: "렌더 영상 파일이 없거나 너무 작습니다." }, { status: 400 })
  }
  if (!(thumbnail instanceof Blob) || thumbnail.size < 64) {
    return NextResponse.json({ error: "썸네일 이미지가 없습니다." }, { status: 400 })
  }

  try {
    const mainMp4 = Buffer.from(await video.arrayBuffer())
    const thumbPng = Buffer.from(await thumbnail.arrayBuffer())
    const out = await prependThumbnailIntroToMp4Buffer({
      mainMp4,
      thumbPng,
      introSec: Number.isFinite(introSec) && introSec > 0 ? introSec : MVP_THUMBNAIL_INTRO_SEC,
      mainDurationSec: Number.isFinite(durationSec) && durationSec > 0.05 ? durationSec : 30,
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
    const message = e instanceof Error ? e.message : "썸네일 합성 실패"
    console.error("[mvp-prepend-thumbnail]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
