import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

type AnalyzeProductBody = {
  title?: string
  description?: string
  thumbnailUrl?: string
  transcript?: string
  apiKey?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AnalyzeProductBody
    const title = String(body.title || "").trim()
    const description = String(body.description || "").trim()
    const transcript = String(body.transcript || "").trim()
    const thumbnailUrl = String(body.thumbnailUrl || "").trim()
    const apiKey =
      String(body.apiKey || "").trim() ||
      process.env.OPENAI_API_KEY ||
      process.env.GPT_API_KEY ||
      process.env.CHATGPT_API_KEY

    if (!title) {
      return NextResponse.json({ error: "분석할 영상 제목이 필요합니다." }, { status: 400 })
    }
    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API 키가 필요합니다." }, { status: 503 })
    }

    const evidenceText = [
      `영상 제목: ${title}`,
      `영상 설명: ${description.slice(0, 3000) || "없음"}`,
      `영상 자막: ${transcript.slice(0, 7000) || "없음"}`,
    ].join("\n\n")
    const userContent: Array<Record<string, unknown>> = [
      { type: "text", text: evidenceText },
    ]
    if (/^https?:\/\//i.test(thumbnailUrl)) {
      userContent.push({
        type: "image_url",
        image_url: { url: thumbnailUrl, detail: "low" },
      })
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "당신은 쇼핑 숏폼 영상에서 실제 등장 상품을 식별하는 분석가입니다.",
              "제목, 설명, 자막, 썸네일에서 확인되는 근거만 사용하세요.",
              "브랜드나 모델을 확신할 수 없으면 일반 상품명으로 표현하고 절대 지어내지 마세요.",
              "쿠팡 검색에 적합한 짧은 한국어 키워드를 작성하세요.",
              'JSON만 반환하세요: {"productName":"상품명","searchKeyword":"쿠팡 검색어","productDescription":"확인된 특징","confidence":0~100,"evidence":["근거"],"analysisSummary":"분석 요약"}',
            ].join("\n"),
          },
          { role: "user", content: userContent },
        ],
      }),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => "")
      throw new Error(`OpenAI 분석 실패 (${response.status}): ${detail.slice(0, 200)}`)
    }

    const data = await response.json()
    const raw = String(data.choices?.[0]?.message?.content || "{}")
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const productName = String(parsed.productName || "").trim()
    const searchKeyword = String(parsed.searchKeyword || productName).trim()
    if (!productName || !searchKeyword) {
      throw new Error("영상에서 상품을 식별하지 못했습니다.")
    }

    return NextResponse.json({
      success: true,
      analysis: {
        productName,
        searchKeyword,
        productDescription: String(parsed.productDescription || "").trim(),
        confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 0)),
        evidence: Array.isArray(parsed.evidence)
          ? parsed.evidence.map((item) => String(item)).filter(Boolean).slice(0, 5)
          : [],
        analysisSummary: String(parsed.analysisSummary || "").trim(),
        hasTranscript: Boolean(transcript),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "영상 상품 분석에 실패했습니다." },
      { status: 500 }
    )
  }
}
