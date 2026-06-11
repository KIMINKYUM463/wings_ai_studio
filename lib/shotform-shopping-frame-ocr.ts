/**
 * 쇼핑 숏폼 썸네일·키프레임 Vision OCR (product-search · MVP 키워드 추출 공용)
 */

export async function runShoppingFrameOcr(
  apiKey: string,
  imageUrls: string[],
  options?: { imageContext?: string }
): Promise<string> {
  const urls = [...new Set(imageUrls.filter((u) => u.startsWith("http") || u.startsWith("data:")))].slice(0, 3)
  if (urls.length === 0) return ""

  const contextHint =
    options?.imageContext?.trim() ||
    "쇼핑 숏폼/라이브커머스 화면으로 보입니다."

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [
    {
      type: "text",
      text: `${contextHint} 다음을 한국어 bullet로 간결히 정리하세요.
- 화면에 보이는 한글/영문/중문 텍스트(확실한 것만, 추측은 [추측] 표시)
- 가격·할인·한정 등 프로모 문구
- 제품명·브랜드로 추정되는 문자열
- 광고/세일 톤 문구`,
    },
    ...urls.map((u) => ({ type: "image_url" as const, image_url: { url: u } })),
  ]

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 600,
      messages: [{ role: "user", content }],
    }),
    signal: AbortSignal.timeout(45_000),
  })
  if (!res.ok) return ""
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const t = data.choices?.[0]?.message?.content
  return typeof t === "string" ? t.trim().slice(0, 2500) : ""
}
