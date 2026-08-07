import { NextResponse } from "next/server"
import { getScriptTemplateById } from "@/lib/shotform-script-templates"
import { generateShoppingScriptFromTemplate } from "@/lib/shotform-generate-shopping-script"

export const runtime = "nodejs"
export const maxDuration = 180

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      openaiApiKey?: string
      templateId?: string
      productName?: string
      targetSeconds?: number
      detailInsightsText?: string
      reviewInsightsText?: string
      reviewSamples?: string[]
      productPrice?: string
      productDelivery?: string
      extraNotes?: string
      productImageUrls?: string[]
      visualFocus?: string
    }

    const openaiApiKey =
      body.openaiApiKey?.trim() ||
      process.env.OPENAI_API_KEY?.trim() ||
      process.env.GPT_API_KEY?.trim() ||
      ""

    if (!openaiApiKey) {
      return NextResponse.json({ error: "OpenAI API 키가 필요합니다." }, { status: 400 })
    }

    const productName = body.productName?.trim() || ""
    if (!productName) {
      return NextResponse.json({ error: "제품명이 필요합니다." }, { status: 400 })
    }

    const template = getScriptTemplateById(body.templateId)
    const productImageUrls = Array.isArray(body.productImageUrls)
      ? body.productImageUrls.filter(
          (u): u is string => typeof u === "string" && /^https?:\/\//i.test(u)
        )
      : []

    const result = await generateShoppingScriptFromTemplate({
      openaiApiKey,
      template,
      productName,
      targetSeconds: body.targetSeconds ?? 30,
      detailInsightsText: body.detailInsightsText,
      reviewInsightsText: body.reviewInsightsText,
      reviewSamples: Array.isArray(body.reviewSamples) ? body.reviewSamples : [],
      productPrice: body.productPrice,
      productDelivery: body.productDelivery,
      extraNotes: body.extraNotes,
      productImageUrls,
      visualFocus: body.visualFocus,
    })

    return NextResponse.json({
      ok: true,
      ...result,
      templateId: template.id,
      templateName: template.name,
      visualFocus: body.visualFocus,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "대본 생성 실패" },
      { status: 500 }
    )
  }
}
