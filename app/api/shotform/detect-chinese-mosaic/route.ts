import { type NextRequest, NextResponse } from "next/server"
import {
  visionDetectMosaicBatch,
  type MosaicDetectFrameInput,
} from "@/lib/shotform-mosaic-detect"
import { mergeMosaicRowsToOverlays } from "@/lib/mvp-mosaic-merge"

export const maxDuration = 300

const MAX_FRAMES_PER_REQUEST = 2

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      openaiApiKey?: string
      durationSec?: number
      frames?: MosaicDetectFrameInput[]
      rowsOnly?: boolean
      highDetail?: boolean
    }

    const openaiApiKey =
      body.openaiApiKey?.trim() || process.env.OPENAI_API_KEY?.trim() || ""
    const durationSec = Number(body.durationSec)
    const frames = Array.isArray(body.frames) ? body.frames : []
    const rowsOnly = body.rowsOnly !== false
    const highDetail = body.highDetail !== false

    if (!openaiApiKey) {
      return NextResponse.json(
        { error: "OpenAI API 키가 필요합니다. ShotForm 설정에서 shotform_openai_api_key를 저장해 주세요." },
        { status: 400 }
      )
    }
    if (!frames.length) {
      return NextResponse.json({ error: "분석할 프레임이 없습니다." }, { status: 400 })
    }
    if (frames.length > MAX_FRAMES_PER_REQUEST) {
      return NextResponse.json(
        { error: `한 번에 최대 ${MAX_FRAMES_PER_REQUEST}장까지 보낼 수 있습니다.` },
        { status: 400 }
      )
    }

    const sanitized = frames
      .filter((f) => Number.isFinite(Number(f.timeSec)) && typeof f.imageBase64 === "string")
      .map((f) => ({
        timeSec: Number(f.timeSec),
        imageBase64: f.imageBase64.trim(),
      }))
      .slice(0, MAX_FRAMES_PER_REQUEST)

    const rows = await visionDetectMosaicBatch(openaiApiKey, sanitized, { highDetail })

    if (rowsOnly) {
      return NextResponse.json({ rows, count: rows.length })
    }

    if (!Number.isFinite(durationSec) || durationSec <= 0) {
      return NextResponse.json({ error: "영상 길이(durationSec)가 필요합니다." }, { status: 400 })
    }

    const overlays = mergeMosaicRowsToOverlays(rows, durationSec)
    return NextResponse.json({ overlays, rows, count: overlays.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI 모자이크 감지 실패"
    console.error("[detect-chinese-mosaic]", msg, e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
