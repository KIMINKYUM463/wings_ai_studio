import { NextResponse } from "next/server"
import { hasFfmpeg } from "@/lib/ffmpeg-binaries"
import { concatRangesFromMp4Buffer } from "@/lib/mvp-insert-clip-ffmpeg"
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

  const rangesRaw = String(form.get("rangesJson") || "")
  let ranges: Array<{ startSec: number; endSec: number }> = []
  try {
    const parsed = JSON.parse(rangesRaw) as unknown
    if (!Array.isArray(parsed)) throw new Error("ranges")
    ranges = parsed.map((r) => {
      const row = r as { startSec?: unknown; endSec?: unknown }
      return {
        startSec: Number(row.startSec),
        endSec: Number(row.endSec),
      }
    })
  } catch {
    return NextResponse.json({ error: "구간 목록이 올바르지 않습니다." }, { status: 400 })
  }

  if (
    !ranges.length ||
    ranges.some(
      (r) =>
        !Number.isFinite(r.startSec) ||
        !Number.isFinite(r.endSec) ||
        r.endSec <= r.startSec
    )
  ) {
    return NextResponse.json({ error: "이어 붙일 구간이 올바르지 않습니다." }, { status: 400 })
  }

  try {
    const mainMp4 = await readFormMp4Buffer(form, "video", "videoUrl")
    const out = await concatRangesFromMp4Buffer({
      mainMp4,
      ranges,
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
    const message = e instanceof Error ? e.message : "컷 순서 변경 실패"
    console.error("[mvp-reorder-clips]", message)
    const status = /없거나 너무 작|올바르지 않|https만|허용되지 않은/.test(message) ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
