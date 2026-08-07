import { NextResponse } from "next/server"
import { extractCoupangReviewInsights } from "@/lib/shotform-coupang-review-insights"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      openaiApiKey?: string
      productName?: string
      reviews?: Array<{ author?: string; rating?: number; content?: string; date?: string }>
    }

    const openaiApiKey =
      body.openaiApiKey?.trim() ||
      process.env.OPENAI_API_KEY?.trim() ||
      process.env.GPT_API_KEY?.trim() ||
      ""

    if (!openaiApiKey) {
      return NextResponse.json({ error: "OpenAI API 키가 필요합니다." }, { status: 400 })
    }

    const reviews = Array.isArray(body.reviews)
      ? body.reviews
          .map((r) => ({
            author: r.author,
            rating: r.rating,
            content: String(r.content || "").trim(),
            date: r.date,
          }))
          .filter((r) => r.content.length > 0)
      : []

    if (reviews.length === 0) {
      return NextResponse.json({ error: "분석할 리뷰가 없습니다." }, { status: 400 })
    }

    const insights = await extractCoupangReviewInsights(
      reviews,
      openaiApiKey,
      body.productName?.trim()
    )

    return NextResponse.json({ ok: true, insights })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "인사이트 생성 실패" },
      { status: 500 }
    )
  }
}
