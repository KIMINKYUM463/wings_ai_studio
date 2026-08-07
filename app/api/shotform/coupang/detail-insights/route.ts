import { NextResponse } from "next/server"
import { extractCoupangDetailInsights } from "@/lib/shotform-coupang-detail-insights"

export const runtime = "nodejs"
export const maxDuration = 90

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      openaiApiKey?: string
      productName?: string
      detailImageUrls?: string[]
      productImageUrl?: string
    }

    const openaiApiKey =
      body.openaiApiKey?.trim() ||
      process.env.OPENAI_API_KEY?.trim() ||
      process.env.GPT_API_KEY?.trim() ||
      ""

    if (!openaiApiKey) {
      return NextResponse.json({ error: "OpenAI API 키가 필요합니다." }, { status: 400 })
    }

    const detailImageUrls = Array.isArray(body.detailImageUrls)
      ? body.detailImageUrls.filter((u) => typeof u === "string" && u.startsWith("http"))
      : []
    const productImageUrl =
      typeof body.productImageUrl === "string" && body.productImageUrl.startsWith("http")
        ? body.productImageUrl
        : undefined

    if (!detailImageUrls.length && !productImageUrl) {
      return NextResponse.json({ error: "분석할 상세페이지 이미지가 없습니다." }, { status: 400 })
    }

    const insights = await extractCoupangDetailInsights({
      openaiApiKey,
      productName: body.productName?.trim(),
      detailImageUrls,
      productImageUrl,
    })

    return NextResponse.json({ ok: true, insights })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "상세페이지 분석 실패" },
      { status: 500 }
    )
  }
}
