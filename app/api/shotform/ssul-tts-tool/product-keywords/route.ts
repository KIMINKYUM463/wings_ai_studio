import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

type LangKeyword = {
  keyword: string
  ko: string
}

type KeywordBundle = {
  en: LangKeyword[]
  zh: LangKeyword[]
  ja: LangKeyword[]
}

type ProductKeywordsResult = {
  broad: KeywordBundle
  exact: KeywordBundle
}

type Body = {
  productName?: string
  imageBase64?: string
  mimeType?: string
  apiKey?: string
}

function asLangList(raw: unknown): LangKeyword[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null
      const item = row as Record<string, unknown>
      const keyword = String(item.keyword || item.text || "").trim()
      const ko = String(item.ko || item.korean || item.translation || "").trim()
      if (!keyword) return null
      return { keyword, ko: ko || keyword }
    })
    .filter((row): row is LangKeyword => Boolean(row))
    .slice(0, 12)
}

function normalizeBundle(raw: unknown): KeywordBundle {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  return {
    en: asLangList(obj.en || obj.english),
    zh: asLangList(obj.zh || obj.chinese || obj.zh_cn),
    ja: asLangList(obj.ja || obj.japanese),
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body
    const productName = String(body.productName || "").trim()
    const imageBase64 = String(body.imageBase64 || "").trim()
    const mimeType = String(body.mimeType || "image/jpeg").trim() || "image/jpeg"
    const apiKey =
      String(body.apiKey || "").trim() ||
      process.env.OPENAI_API_KEY ||
      process.env.GPT_API_KEY ||
      process.env.CHATGPT_API_KEY

    if (!productName) {
      return NextResponse.json({ error: "쿠팡 제품명을 입력해 주세요." }, { status: 400 })
    }
    if (!imageBase64) {
      return NextResponse.json({ error: "제품 이미지를 업로드해 주세요." }, { status: 400 })
    }
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API 키가 필요합니다. ShotForm 설정에서 키를 저장해 주세요." },
        { status: 503 }
      )
    }

    const dataUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:${mimeType};base64,${imageBase64}`

    const userPrompt = [
      "이 이미지를 확인하고, 이 제품을 영상 플랫폼에서 찾을 수 있도록 검색 키워드를 만들어줘.",
      "",
      "광범위한 일반 키워드와 정확한 제품명 키워드를 구분해서 정리하고, 각각의 키워드를 아래 언어로 제공해줘.",
      "",
      "영어",
      "중국어",
      "일본어",
      "",
      "각 외국어 키워드 옆에는 내가 의미를 이해할 수 있도록 한국어 번역도 함께 표시해줘.",
      "",
      `쿠팡 제품명: ${productName}`,
    ].join("\n")

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "당신은 숏폼·영상 플랫폼(유튜브, 틱톡, 쇼츠 등) 상품 검색 키워드 전문가입니다.",
              "업로드된 제품 이미지와 쿠팡 제품명을 함께 보고, 실제로 검색에 쓸 수 있는 키워드만 만듭니다.",
              "광범위(일반 카테고리·용도·형태)와 정확(제품명·브랜드·모델에 가까운 표현)을 구분합니다.",
              "영어·중국어(간체)·일본어 키워드를 각각 만들고, 모든 항목에 한국어 번역(ko)을 붙입니다.",
              "언어별로 최소 4개, 최대 8개 키워드를 제공합니다.",
              "지어낸 브랜드/모델은 넣지 말고, 이미지·제품명에서 확인되는 범위만 사용합니다.",
              'JSON만 반환: {"broad":{"en":[{"keyword":"...","ko":"..."}],"zh":[{"keyword":"...","ko":"..."}],"ja":[{"keyword":"...","ko":"..."}]},"exact":{"en":[{"keyword":"...","ko":"..."}],"zh":[{"keyword":"...","ko":"..."}],"ja":[{"keyword":"...","ko":"..."}]}}',
            ].join("\n"),
          },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              {
                type: "image_url",
                image_url: { url: dataUrl, detail: "high" },
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => "")
      throw new Error(`OpenAI 요청 실패 (${response.status}): ${detail.slice(0, 240)}`)
    }

    const data = await response.json()
    const raw = String(data.choices?.[0]?.message?.content || "{}")
    let parsed: Record<string, unknown> = {}
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>
    } catch {
      throw new Error("키워드 JSON을 파싱하지 못했습니다.")
    }

    const result: ProductKeywordsResult = {
      broad: normalizeBundle(parsed.broad || parsed.general || parsed.wide),
      exact: normalizeBundle(parsed.exact || parsed.precise || parsed.specific),
    }

    const total =
      result.broad.en.length +
      result.broad.zh.length +
      result.broad.ja.length +
      result.exact.en.length +
      result.exact.zh.length +
      result.exact.ja.length

    if (total < 3) {
      throw new Error("검색 키워드를 충분히 만들지 못했습니다. 이미지와 제품명을 확인해 주세요.")
    }

    return NextResponse.json({
      success: true,
      productName,
      keywords: result,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "제품 검색 키워드 생성에 실패했습니다.",
      },
      { status: 500 }
    )
  }
}
