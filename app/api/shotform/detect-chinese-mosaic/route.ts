import { type NextRequest, NextResponse } from "next/server"
import { detectChineseMosaicOverlays, type MosaicDetectFrameInput } from "@/lib/shotform-mosaic-detect"

export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      openaiApiKey?: string
      durationSec?: number
      frames?: MosaicDetectFrameInput[]
    }

    const openaiApiKey =
      body.openaiApiKey?.trim() || process.env.OPENAI_API_KEY?.trim() || ""
    const durationSec = Number(body.durationSec)
    const frames = Array.isArray(body.frames) ? body.frames : []

    if (!openaiApiKey) {
      return NextResponse.json(
        { error: "OpenAI API 키가 필요합니다. ShotForm 설정에서 shotform_openai_api_key를 저장해 주세요." },
        { status: 400 }
      )
    }
    if (!Number.isFinite(durationSec) || durationSec <= 0) {
      return NextResponse.json({ error: "영상 길이(durationSec)가 필요합니다." }, { status: 400 })
    }
    if (!frames.length) {
      return NextResponse.json({ error: "분석할 프레임이 없습니다." }, { status: 400 })
    }
    if (frames.length > 40) {
      return NextResponse.json({ error: "프레임이 너무 많습니다. (최대 40장)" }, { status: 400 })
    }

    const sanitized = frames
      .filter((f) => Number.isFinite(Number(f.timeSec)) && typeof f.imageBase64 === "string")
      .map((f) => ({
        timeSec: Number(f.timeSec),
        imageBase64: f.imageBase64.trim(),
      }))
      .slice(0, 40)

    const overlays = await detectChineseMosaicOverlays({
      apiKey: openaiApiKey,
      frames: sanitized,
      durationSec,
    })

    return NextResponse.json({ overlays, count: overlays.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI 모자이크 감지 실패"
    console.error("[detect-chinese-mosaic]", msg, e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
