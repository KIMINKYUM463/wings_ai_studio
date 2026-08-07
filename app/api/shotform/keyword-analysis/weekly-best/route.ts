import { NextResponse, type NextRequest } from "next/server"
import { fetchNaverShoppingRankSnapshot } from "@/lib/shotform-naver-datalab"
import { fetchCoupangRankedProducts } from "@/lib/server/coupang-partners"

export const runtime = "nodejs"
export const maxDuration = 60

type WeeklyBestItem = {
  rank: number
  keyword: string
  score: number
  reason: string
  naverSignal: string
  coupangSignal: string
}

let cached: { expiresAt: number; items: WeeklyBestItem[]; analyzedAt: string } | null = null

const NAVER_CATEGORY_CODES = [
  "50000000",
  "50000002",
  "50000003",
  "50000006",
  "50000007",
  "50000008",
]
const COUPANG_CATEGORY_IDS = ["1001", "1010", "1016", "1012", "1017", "1014"]

function cleanJson(content: string) {
  return content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
}

export async function POST(request: NextRequest) {
  try {
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json({ success: true, ...cached, cached: true })
    }
    const body = (await request.json().catch(() => ({}))) as { apiKey?: string }
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

    const [naverSnapshots, coupangLists] = await Promise.all([
      Promise.all(NAVER_CATEGORY_CODES.map((code) => fetchNaverShoppingRankSnapshot(code))),
      Promise.all(
        COUPANG_CATEGORY_IDS.map((categoryId) =>
          fetchCoupangRankedProducts({ mode: "best", categoryId, limit: 5 })
        )
      ),
    ])

    const naverSignals = naverSnapshots.flatMap((snapshot) => {
      const latestDate = snapshot.latestAvailableDate
      return snapshot.rankings
        .filter((item) => item.target_date === latestDate)
        .slice(0, 5)
        .map((item) => ({
          category: item.category_name,
          keyword: item.keyword,
          rank: item.rank_order,
          rankChange: item.rank_change || 0,
          monthlySearches: item.monthly_searches || 0,
          shoppingRatio: item.ratio || 0,
        }))
    })
    const coupangSignals = coupangLists.flatMap((products, categoryIndex) =>
      products.map((product) => ({
        categoryId: COUPANG_CATEGORY_IDS[categoryIndex],
        productName: product.productName,
        rank: product.rank,
        price: product.productPrice,
      }))
    )

    const prompt = `당신은 한국 이커머스 트렌드 분석가입니다.
아래 네이버 쇼핑 검색 신호와 쿠팡 카테고리 베스트 상품을 함께 분석해, 앞으로 일주일 동안 숏폼 상품 소재로 유망한 소비 키워드 BEST 3를 고르세요.

규칙:
- 양 플랫폼에서 동시에 확인되는 수요를 가장 높게 평가합니다.
- 단순 상품명 대신 사용자가 실제 검색할 2~12자 한국어 키워드로 통합합니다.
- 서로 겹치지 않는 세 가지 주제를 선택합니다.
- score는 0~100 정수입니다.
- 제공 데이터에 없는 성과나 판매량은 만들지 마세요.
- JSON 객체만 반환하세요.

응답 형식:
{"items":[{"rank":1,"keyword":"키워드","score":95,"reason":"선정 이유 한 문장","naverSignal":"네이버 근거","coupangSignal":"쿠팡 근거"}]}

네이버 신호:
${JSON.stringify(naverSignals)}

쿠팡 신호:
${JSON.stringify(coupangSignals)}`

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "데이터 근거 중심의 한국 이커머스 분석가" },
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
      items?: WeeklyBestItem[]
    }
    const items = (parsed.items || []).slice(0, 3).map((item, index) => ({
      rank: index + 1,
      keyword: String(item.keyword || "").trim(),
      score: Math.max(0, Math.min(100, Math.round(Number(item.score) || 0))),
      reason: String(item.reason || "").trim(),
      naverSignal: String(item.naverSignal || "").trim(),
      coupangSignal: String(item.coupangSignal || "").trim(),
    })).filter((item) => item.keyword)
    if (items.length !== 3) throw new Error("AI가 BEST 3 분석 결과를 완성하지 못했습니다.")

    const analyzedAt = new Date().toISOString()
    cached = { items, analyzedAt, expiresAt: Date.now() + 30 * 60 * 1000 }
    return NextResponse.json({ success: true, items, analyzedAt, cached: false })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "주간 BEST 3 분석 실패" },
      { status: 502 }
    )
  }
}
