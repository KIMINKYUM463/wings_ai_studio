import { NextResponse } from "next/server"
import { pickBestProductPhotos } from "@/lib/shotform-pick-product-photos"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      openaiApiKey?: string
      productName?: string
      imageUrls?: string[]
      maxPick?: number
      onlyClearlyVisible?: boolean
    }

    const openaiApiKey =
      body.openaiApiKey?.trim() ||
      process.env.OPENAI_API_KEY?.trim() ||
      process.env.GPT_API_KEY?.trim() ||
      ""

    if (!openaiApiKey) {
      return NextResponse.json({ error: "OpenAI API 키가 필요합니다." }, { status: 400 })
    }

    const imageUrls = Array.isArray(body.imageUrls)
      ? body.imageUrls.filter((u): u is string => typeof u === "string" && /^https?:\/\//i.test(u))
      : []

    if (imageUrls.length === 0) {
      return NextResponse.json({ error: "선정할 제품 사진이 없습니다." }, { status: 400 })
    }

    const result = await pickBestProductPhotos({
      openaiApiKey,
      imageUrls,
      productName: body.productName?.trim(),
      maxPick: body.maxPick,
      onlyClearlyVisible: body.onlyClearlyVisible === true,
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "제품 사진 선정 실패" },
      { status: 500 }
    )
  }
}
