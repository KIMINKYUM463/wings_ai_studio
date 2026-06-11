import { type NextRequest, NextResponse } from "next/server"
import { inpaintBrushMaskRegions } from "@/lib/mvp-thumbnail-inpaint"

export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      imageBase64?: string
      maskBase64?: string
      replicateApiKey?: string
    }

    const imageBase64 = body.imageBase64?.trim()
    const maskBase64 = body.maskBase64?.trim()
    const replicateApiKey =
      body.replicateApiKey?.trim() || process.env.REPLICATE_API_TOKEN?.trim() || ""

    if (!imageBase64) {
      return NextResponse.json({ error: "원본 이미지가 필요합니다." }, { status: 400 })
    }
    if (!maskBase64) {
      return NextResponse.json({ error: "지울 영역(마스크)이 필요합니다." }, { status: 400 })
    }
    if (!replicateApiKey) {
      return NextResponse.json(
        { error: "Replicate API 키가 필요합니다. ShotForm 설정에서 입력해 주세요." },
        { status: 400 }
      )
    }

    const imageUrl = await inpaintBrushMaskRegions(imageBase64, maskBase64, replicateApiKey)
    return NextResponse.json({ imageUrl })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "선택 영역 지우기 실패"
    console.error("[mvp-thumbnail-inpaint]", msg, e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
