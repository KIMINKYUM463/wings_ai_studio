import { NextResponse } from "next/server"
import { hasFfmpeg } from "@/lib/ffmpeg-binaries"
import {
  composeMotionVideoWithAudioToMp4,
  composeStillImageWithAudioToMp4,
} from "@/lib/longform-v2/compose-scene-video"

export const runtime = "nodejs"
export const maxDuration = 180

async function readSource(
  form: FormData,
  fileKey: string,
  urlKey: string,
): Promise<string | null> {
  const file = form.get(fileKey)
  if (file && typeof file !== "string" && "arrayBuffer" in file) {
    const buf = Buffer.from(await file.arrayBuffer())
    if (buf.length > 0) {
      const type = (file as File).type || "application/octet-stream"
      return `data:${type};base64,${buf.toString("base64")}`
    }
  }
  const url = String(form.get(urlKey) || "").trim()
  return url || null
}

export async function POST(req: Request) {
  if (!hasFfmpeg()) {
    return NextResponse.json(
      {
        success: false,
        error:
          "서버에서 ffmpeg를 찾지 못했습니다. npm install 후 dev 서버를 재시작해 주세요.",
      },
      { status: 503 },
    )
  }

  try {
    const contentType = req.headers.get("content-type") || ""
    let imageSource = ""
    let videoSource = ""
    let audioSource = ""

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData()
      imageSource = (await readSource(form, "image", "imageUrl")) || ""
      videoSource = (await readSource(form, "video", "videoUrl")) || ""
      audioSource = (await readSource(form, "audio", "audioUrl")) || ""
    } else {
      const body = await req.json()
      imageSource = String(body.imageUrl || "").trim()
      videoSource = String(body.videoUrl || body.motionVideoUrl || "").trim()
      audioSource = String(body.audioUrl || "").trim()
    }

    if (!audioSource) {
      return NextResponse.json(
        { success: false, error: "audioUrl(또는 audio 파일)이 필요합니다." },
        { status: 400 },
      )
    }

    // AI 움직임 영상이 있으면 그걸 우선 합성, 없으면 정지 이미지+Ken Burns
    const mp4 = videoSource
      ? await composeMotionVideoWithAudioToMp4({
          videoSource,
          audioSource,
        })
      : imageSource
        ? await composeStillImageWithAudioToMp4({
            imageSource,
            audioSource,
          })
        : null

    if (!mp4) {
      return NextResponse.json(
        {
          success: false,
          error: "imageUrl 또는 videoUrl(AI 영상)이 필요합니다.",
        },
        { status: 400 },
      )
    }

    const videoUrl = `data:video/mp4;base64,${mp4.toString("base64")}`
    return NextResponse.json({
      success: true,
      videoUrl,
      byteLength: mp4.length,
      mode: videoSource ? "motion+tts" : "still+tts",
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "최종영상 합성 실패"
    console.error("[longform-v2/compose-scene]", message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
