import { NextResponse, type NextRequest } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60

type InputProduct = {
  productId: string
  productName: string
  productPrice: number
  rank: number
  isRocket?: boolean
}

type Insight = {
  productId: string
  popularityReason: string
  videoHook: string
  videoConcept: string
}

const cache = new Map<string, { expiresAt: number; insights: Insight[]; analyzedAt: string }>()

function cleanJson(content: string) {
  return content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      apiKey?: string
      categoryName?: string
      products?: InputProduct[]
    }
    const apiKey =
      body.apiKey?.trim() ||
      process.env.OPENAI_API_KEY?.trim() ||
      process.env.GPT_API_KEY?.trim()
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI 분석을 위해 OpenAI API 키를 설정해 주세요." },
        { status: 400 }
      )
    }
    const products = (body.products || []).slice(0, 3).filter((product) => product.productId && product.productName)
    if (products.length !== 3) {
      return NextResponse.json({ error: "TOP 3 상품 정보가 필요합니다." }, { status: 400 })
    }

    const cacheKey = `${body.categoryName || "카테고리"}:${products.map((product) => product.productId).join(",")}`
    const cached = cache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json({ success: true, ...cached, cached: true })
    }

    const prompt = `당신은 한국 쇼핑 숏폼 전문 콘텐츠 전략가입니다.
쿠팡 파트너스 카테고리 베스트 TOP 3 상품을 분석해 각 상품이 소비자에게 인기 있을 가능성이 높은 이유와 실제로 제작하기 좋은 세로형 숏폼 영상 기획을 작성하세요.

카테고리: ${body.categoryName || "쇼핑"}
상품:
${JSON.stringify(products)}

규칙:
- 제공된 상품명, 가격, 순위, 로켓배송 여부만 근거로 사용하세요.
- 실제 판매량, 리뷰 수, 효능 등 제공되지 않은 사실은 단정하지 마세요.
- popularityReason은 소비자 관점의 구매 매력 1~2문장입니다.
- videoHook은 첫 3초에 사용할 짧고 강한 한국어 문장입니다.
- videoConcept은 15~30초 영상의 장면 흐름을 구체적으로 2문장 이내로 작성하세요.
- 상품별 기획이 서로 겹치지 않게 하세요.
- JSON 객체만 반환하세요.

응답 형식:
{"items":[{"productId":"상품 ID","popularityReason":"인기 이유","videoHook":"첫 3초 훅","videoConcept":"영상 구성"}]}`

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.35,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "근거를 과장하지 않는 한국 이커머스 숏폼 전략가" },
          { role: "user", content: prompt },
        ],
      }),
      cache: "no-store",
    })
    const json = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(json?.error?.message || `OpenAI 분석 실패 (${response.status})`)
    }
    const parsed = JSON.parse(cleanJson(json?.choices?.[0]?.message?.content || "{}")) as {
      items?: Insight[]
    }
    const byId = new Map((parsed.items || []).map((item) => [String(item.productId), item]))
    const insights = products.map((product) => {
      const item = byId.get(product.productId)
      return {
        productId: product.productId,
        popularityReason: String(item?.popularityReason || "").trim(),
        videoHook: String(item?.videoHook || "").trim(),
        videoConcept: String(item?.videoConcept || "").trim(),
      }
    })
    if (insights.some((item) => !item.popularityReason || !item.videoHook || !item.videoConcept)) {
      throw new Error("AI가 TOP 3 콘텐츠 분석을 완성하지 못했습니다.")
    }

    const analyzedAt = new Date().toISOString()
    cache.set(cacheKey, { expiresAt: Date.now() + 30 * 60 * 1000, insights, analyzedAt })
    return NextResponse.json({ success: true, insights, analyzedAt, cached: false })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "쿠팡 TOP 3 AI 분석 실패" },
      { status: 502 }
    )
  }
}
