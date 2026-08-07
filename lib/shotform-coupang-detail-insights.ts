import { fetchImageAsVisionDataUrl } from "@/lib/shotform-coupang-product-meta"

export type CoupangDetailInsights = {
  summary: string
  features: string[]
  sellingPoints: string[]
  targetAudience: string[]
  caveats: string[]
  /** 숏폼 나레이션에 바로 넣을 구어체 멘트 */
  scriptLines: string[]
  /** 오프닝·후킹용 한 줄 */
  hookLines: string[]
}

function emptyDetailInsights(): CoupangDetailInsights {
  return {
    summary: "",
    features: [],
    sellingPoints: [],
    targetAudience: [],
    caveats: [],
    scriptLines: [],
    hookLines: [],
  }
}

function normalizeList(v: unknown, max = 10): string[] {
  if (!Array.isArray(v)) return []
  return v
    .map((x) => String(x || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, max)
}

/** 상품상세(긴 상세페이지) 이미지를 보고 숏폼 대본용으로 상세 정리 */
export async function extractCoupangDetailInsights(opts: {
  openaiApiKey: string
  productName?: string
  detailImageUrls: string[]
  productImageUrl?: string
}): Promise<CoupangDetailInsights> {
  const urls = Array.from(
    new Set(
      [...(opts.detailImageUrls || []), opts.productImageUrl || ""].filter(
        (u) => typeof u === "string" && /^https?:\/\//i.test(u)
      )
    )
  ).slice(0, 8)

  if (!urls.length) return emptyDetailInsights()

  // OpenAI가 coupangcdn 직접 다운로드 시 Timeout 나는 경우가 많아,
  // 우리 서버에서 받아 data URL로 넘긴다.
  const dataUrls = (
    await Promise.all(urls.map((url) => fetchImageAsVisionDataUrl(url)))
  ).filter((u): u is string => Boolean(u))

  if (!dataUrls.length) {
    throw new Error(
      "상세 이미지를 서버에서 가져오지 못했습니다. 쿠팡 CDN 차단·타임아웃일 수 있으니 다시 시도해 주세요."
    )
  }

  // 앞 장(상세 상단)은 글자가 많아 high, 나머지는 low로 토큰 절약
  const imageParts = dataUrls.map((url, i) => ({
    type: "image_url" as const,
    image_url: { url, detail: (i < 4 ? "high" : "low") as "high" | "low" },
  }))

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.4,
      max_tokens: 3500,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `당신은 쿠팡 상품상세 카피라이터이자 숏폼 대본 보조입니다.
첨부된 상세페이지 이미지(글·수치·배지·구성)를 읽고, 쇼핑 숏폼 대본에 바로 쓸 수 있게 JSON만 반환하세요.

스키마:
{
  "summary": "제품 한눈에 요약 3~5문장. 핵심 스펙·혜택·차별점을 포함",
  "features": string[],       // 제품 특징·스펙 (6~10개). 키워드 나열이 아니라 "무게라벨 3kg, 한 가족이 이틀 먹을 분량"처럼 대본에 말할 수 있는 구체 문장
  "sellingPoints": string[],  // 판매·설득 포인트 (6~10개). 왜 사야 하는지 / 상세 강조 문구를 구어체로 풀어서
  "targetAudience": string[], // 추천 대상·상황 (4~8개). "누가·언제·왜"가 드러나게
  "caveats": string[],        // 주의·확인·보관·배송 조건 (있으면 4~6, 없으면 [])
  "hookLines": string[],      // 영상 첫 1~3초용 훅 멘트 3~5개 (짧고 강한 한 문장)
  "scriptLines": string[]     // 본편 나레이션용 완성 문장 6~10개. 순서: 제품소개 → 혜택 → 사용장면 → 안심/배송 → 마무리 유도
}

규칙:
- 반드시 한국어, 실제 촬영용 구어체(존댓말/~거든요/~이에요)
- 이미지에 보이는 숫자·사이즈·중량·성분·구성·기간·배송표현을 최대한 살려 쓸 것
- 이미지에 없는 할인율·후기·인증·효과를 지어내지 말 것
- 법적 필수표기·작은 글씨 고지만 길게 반복하지 말 것 (보관·주의는 caveats에만 요약)
- features/sellingPoints는 "~합니다" 키워드가 아니라 쇼츠에서 읽히게 쓰는 한 문장`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `상품명: ${opts.productName || "(미상)"}
상세페이지 이미지 ${dataUrls.length}장을 분석하세요.
목표는 키워드 요약이 아니라, 숏폼 대본에 바로 넣을 디테일한 참고 자료입니다.`,
            },
            ...imageParts,
          ],
        },
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    throw new Error(`상세페이지 분석 실패 (${res.status}) ${errText.slice(0, 200)}`)
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const raw = data.choices?.[0]?.message?.content || "{}"
  let parsed: Record<string, unknown> = {}
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return emptyDetailInsights()
  }

  return {
    summary: String(parsed.summary || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 1200),
    features: normalizeList(parsed.features, 10),
    sellingPoints: normalizeList(parsed.sellingPoints, 10),
    targetAudience: normalizeList(parsed.targetAudience, 8),
    caveats: normalizeList(parsed.caveats, 6),
    hookLines: normalizeList(parsed.hookLines, 5),
    scriptLines: normalizeList(parsed.scriptLines, 10),
  }
}

export function formatDetailInsightsForScript(
  insights: CoupangDetailInsights | null | undefined
): string {
  if (!insights) return ""
  const lines: string[] = []
  if (insights.summary) lines.push(`상세 요약: ${insights.summary}`)
  if (insights.hookLines?.length) lines.push(`훅 멘트: ${insights.hookLines.join(" / ")}`)
  if (insights.scriptLines?.length) {
    lines.push(
      `대본 멘트:\n${insights.scriptLines.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
    )
  }
  if (insights.features.length) lines.push(`특징: ${insights.features.join(" | ")}`)
  if (insights.sellingPoints.length) {
    lines.push(`판매 포인트: ${insights.sellingPoints.join(" | ")}`)
  }
  if (insights.targetAudience.length) {
    lines.push(`대상: ${insights.targetAudience.join(" | ")}`)
  }
  if (insights.caveats.length) lines.push(`주의: ${insights.caveats.join(" | ")}`)
  return lines.join("\n")
}
