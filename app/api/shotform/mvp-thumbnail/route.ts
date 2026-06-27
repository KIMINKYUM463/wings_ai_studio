import { type NextRequest, NextResponse } from "next/server"
import {
  generateShortsThumbnail,
  generateShortsThumbnailBackground,
  generateThumbnailHookingText,
  rewriteThumbnailLayerText,
  type ThumbnailHookingInput,
  type ThumbnailTextRole,
} from "@/lib/shotform-mvp-thumbnail"

export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      openaiApiKey?: string
      replicateApiKey?: string
      productName?: string
      productImageBase64?: string
      hookingText?: { line1?: string; line2?: string }
      generateHookingOnly?: boolean
      rewriteTextOnly?: boolean
      hookingInput?: ThumbnailHookingInput
      currentText?: string
      textRole?: ThumbnailTextRole
      otherLines?: string[]
      generateBackgroundOnly?: boolean
    }

    const productName = body.productName?.trim() || "제품"
    const openaiApiKey = body.openaiApiKey?.trim() || process.env.OPENAI_API_KEY || process.env.GPT_API_KEY
    const replicateApiKey =
      body.replicateApiKey?.trim() || process.env.REPLICATE_API_TOKEN?.trim() || undefined

    const hookingInput: ThumbnailHookingInput = body.hookingInput?.productName?.trim()
      ? body.hookingInput
      : { productName }

    if (body.generateHookingOnly) {
      const hookingText = await generateThumbnailHookingText(hookingInput, openaiApiKey)
      return NextResponse.json({ hookingText })
    }

    if (body.rewriteTextOnly) {
      const text = await rewriteThumbnailLayerText(
        {
          productName,
          currentText: body.currentText?.trim() ?? "",
          role: body.textRole,
          otherLines: body.otherLines,
          hookingContext: hookingInput,
        },
        openaiApiKey
      )
      return NextResponse.json({ text })
    }

    if (body.generateBackgroundOnly) {
      if (!replicateApiKey) {
        return NextResponse.json(
          { error: "Replicate API 키가 필요합니다. ShotForm 설정에서 입력해 주세요." },
          { status: 400 }
        )
      }
      if (!body.productImageBase64?.trim()) {
        return NextResponse.json(
          { error: "참조 이미지가 필요합니다. 배경을 업로드하거나 영상 프레임을 불러오세요." },
          { status: 400 }
        )
      }
      const backgroundUrl = await generateShortsThumbnailBackground(
        productName,
        replicateApiKey,
        body.productImageBase64.trim()
      )
      return NextResponse.json({ backgroundUrl })
    }

    if (!replicateApiKey) {
      return NextResponse.json(
        { error: "Replicate API 키가 필요합니다. ShotForm 설정에서 입력해 주세요." },
        { status: 400 }
      )
    }
    if (!body.productImageBase64?.trim()) {
      return NextResponse.json(
        { error: "참조 이미지가 필요합니다. 영상 프레임을 불러오거나 이미지를 업로드하세요." },
        { status: 400 }
      )
    }

    let hookingText = {
      line1: body.hookingText?.line1?.trim() ?? "",
      line2: body.hookingText?.line2?.trim() ?? "",
    }
    if (!hookingText.line1 || !hookingText.line2) {
      hookingText = await generateThumbnailHookingText(hookingInput, openaiApiKey)
    }

    const thumbnailUrl = await generateShortsThumbnail(
      productName,
      replicateApiKey,
      body.productImageBase64.trim(),
      hookingText
    )

    return NextResponse.json({ thumbnailUrl, hookingText })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "썸네일 생성 실패"
    console.error("[mvp-thumbnail]", msg, e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
