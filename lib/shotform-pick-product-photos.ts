/**
 * 갤러리·리뷰 사진 후보 중 제품이 잘 보이는 컷을 AI로 선정
 */

export type PickProductPhotosResult = {
  productImages: string[]
  productImage: string
  /** AI 선정 여부 (실패 시 휴리스틱 폴백) */
  aiPicked: boolean
  note?: string
}

function uniqHttp(urls: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of urls) {
    const u = String(raw || "").trim()
    if (!/^https?:\/\//i.test(u)) continue
    const key = u.split("?")[0].replace(/\/$/, "").toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(u)
  }
  return out
}

function fallbackPick(urls: string[], max = 2): PickProductPhotosResult {
  const picked = urls.slice(0, max)
  return {
    productImages: picked,
    productImage: picked[0] || "",
    aiPicked: false,
    note: "AI 선정 없이 수집 순서를 사용했습니다.",
  }
}

export async function pickBestProductPhotos(opts: {
  openaiApiKey: string
  imageUrls: string[]
  productName?: string
  maxPick?: number
  /** true면 기준 미달 사진을 억지로 채우지 않고 제외 */
  onlyClearlyVisible?: boolean
}): Promise<PickProductPhotosResult> {
  const onlyClearlyVisible = opts.onlyClearlyVisible === true
  const maxPick = Math.min(12, Math.max(1, opts.maxPick ?? 2))
  const urls = uniqHttp(opts.imageUrls).slice(0, onlyClearlyVisible ? 20 : 12)
  if (!onlyClearlyVisible && urls.length <= maxPick) {
    return {
      productImages: urls,
      productImage: urls[0] || "",
      aiPicked: false,
      note: urls.length ? "후보가 적어 전체를 사용했습니다." : "후보 이미지가 없습니다.",
    }
  }

  const key = opts.openaiApiKey?.trim()
  if (!key) return fallbackPick(urls, maxPick)

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "low" | "high" } }
  > = [
    {
      type: "text",
      text: `상품명: ${opts.productName || "(미상)"}
이미지 ${urls.length}장 (인덱스 0~${urls.length - 1}).
제품이 가장 잘 보이는 순으로 인덱스를 ranked에 넣어 주세요.
${onlyClearlyVisible
  ? `최대 ${maxPick}개만 선택하며, 기준을 만족하지 않는 사진은 절대 ranked에 넣지 마세요. 적합한 사진이 없으면 빈 배열을 반환하세요.`
  : `정확히 ${maxPick}개를 선택하세요.`}
아래 이미지는 "인덱스 N:" 텍스트 바로 다음이 해당 컷입니다.`,
    },
  ]

  for (let i = 0; i < urls.length; i++) {
    content.push({ type: "text", text: `인덱스 ${i}:` })
    content.push({
      type: "image_url",
      image_url: { url: urls[i], detail: "low" },
    })
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.1,
        max_tokens: 400,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `당신은 쇼핑 숏폼용 제품 대표 사진을 고르는 비주얼 디렉터입니다.
첨부된 이미지는 인덱스 라벨과 함께 주어집니다. 제품이 가장 잘 보이는 컷을 고르세요.

스키마(JSON만):
{
  "ranked": number[],
  "reason": string
}

규칙:
- ranked 길이는 ${onlyClearlyVisible ? `0~${maxPick}` : `정확히 ${maxPick}`}, 0~${urls.length - 1} 범위, 중복 금지
- 제품 본체·형태가 크고 선명한 컷을 1번
- 제품이 사진 면적의 약 20% 이상을 차지하고 핵심 형태를 알아볼 수 있어야 함
- 초점이 맞고 심하게 잘리거나 가려지지 않아야 함
- 포장문구·배너·아이콘·작은 사용씬·흐린 컷은 뒤로
${onlyClearlyVisible
  ? "- 제품이 작거나 불분명한 사진, 무관한 사진, 텍스트 위주의 캡처, 콜라주, 제품이 가려진 사진은 선택 금지"
  : ""}`,
          },
          { role: "user", content },
        ],
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      console.warn("[pick-product-photos]", res.status, errText.slice(0, 160))
      return onlyClearlyVisible
        ? {
            productImages: [],
            productImage: "",
            aiPicked: false,
            note: "AI 선별 요청에 실패해 리뷰 사진을 제외했습니다.",
          }
        : fallbackPick(urls, maxPick)
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const raw = data.choices?.[0]?.message?.content || "{}"
    let parsed: { ranked?: unknown; reason?: unknown } = {}
    try {
      parsed = JSON.parse(raw) as { ranked?: unknown; reason?: unknown }
    } catch {
      return onlyClearlyVisible
        ? {
            productImages: [],
            productImage: "",
            aiPicked: false,
            note: "AI 선별 응답을 읽지 못해 리뷰 사진을 제외했습니다.",
          }
        : fallbackPick(urls, maxPick)
    }

    const ranked = Array.isArray(parsed.ranked) ? parsed.ranked : []
    const picked: string[] = []
    const used = new Set<number>()
    for (const idx of ranked) {
      const n = Math.floor(Number(idx))
      if (!Number.isFinite(n) || n < 0 || n >= urls.length || used.has(n)) continue
      used.add(n)
      picked.push(urls[n])
      if (picked.length >= maxPick) break
    }

    if (!onlyClearlyVisible) {
      for (const u of urls) {
        if (picked.length >= maxPick) break
        if (!picked.includes(u)) picked.push(u)
      }
    }

    if (!picked.length && !onlyClearlyVisible) return fallbackPick(urls, maxPick)

    return {
      productImages: picked.slice(0, maxPick),
      productImage: picked[0] || "",
      aiPicked: true,
      note:
        typeof parsed.reason === "string" && parsed.reason.trim()
          ? parsed.reason.trim().slice(0, 160)
          : onlyClearlyVisible
            ? `AI가 제품이 선명한 리뷰 사진 ${picked.length}장을 선별했습니다.`
            : "AI가 제품이 잘 보이는 컷을 선정했습니다.",
    }
  } catch (e) {
    console.warn("[pick-product-photos]", e)
    return onlyClearlyVisible
      ? {
          productImages: [],
          productImage: "",
          aiPicked: false,
          note: "AI 선별 중 오류가 발생해 리뷰 사진을 제외했습니다.",
        }
      : fallbackPick(urls, maxPick)
  }
}
