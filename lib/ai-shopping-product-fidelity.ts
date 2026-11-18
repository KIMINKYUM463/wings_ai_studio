/**
 * AI 쇼핑숏폼이 실제 제품처럼 보이게 하기 위한 순수 규칙.
 * 생성 모델 호출은 하지 않고, 프롬프트와 판정 결과만 다룬다.
 */

export type ProductIdentityVerdict = {
  match: boolean
  reason: string
}

/** 참고 사진이 여러 장일 때 각 사진의 역할을 고정한다. */
export function productReferenceRolePrompt(count: number): string {
  const roles = [
    "1번 참고 사진: 정면 기준. 색, 전체 실루엣, 비율의 기준이다.",
    "2번 참고 사진: 측면 기준. 두께, 부품 위치, 비율을 맞춘다.",
    "3번 참고 사진: 로고·인쇄·디테일 기준. 글자와 문양을 바꾸거나 지우지 않는다.",
  ]
  return ["참고 사진 역할:", ...roles.slice(0, Math.max(1, Math.min(3, count)))].join("\n")
}

/** 손은 한 동작, 한 접촉점만 허용해 손가락이 제품을 통과하는 오류를 줄인다. */
export function handContactContract(): string {
  return `손 사용 제약:
- 한 장면에는 한 가지 동작만 보여준다.
- 같은 손이 제품의 한 접촉점을 처음부터 끝까지 유지한다.
- 잡는 위치를 바꾸거나, 두 가지 동작을 이어 붙이거나, 손가락이 제품 내부를 통과하지 않는다.`
}

/** 실패 대체 프롬프트도 제품 전체가 보이게 유지한다. */
export function fullProductImagePrompt(
  productName: string,
  kind: "full" | "detail" | "angle"
): string {
  const framing =
    kind === "full"
      ? "full product visible, entire product fills the frame"
      : kind === "detail"
        ? "entire product still fully visible, slightly closer framing, surface detail readable, NOT an extreme close-up, NOT a macro crop, NOT a partial product"
        : "same entire product from another angle and background, entire product remains visible"
  return `${productName} product, ${framing}, maintain exact original color, silhouette, parts, logos and prints, no additional parts, photorealistic product photograph, 9:16`
}

export function parseProductIdentityVerdict(raw: string): ProductIdentityVerdict {
  try {
    const parsed = JSON.parse(raw) as { match?: unknown; reason?: unknown }
    return {
      match: parsed.match === true,
      reason: String(parsed.reason || "").trim().slice(0, 240),
    }
  } catch {
    return { match: true, reason: "" }
  }
}

/**
 * 생성된 장면이 원본 제품과 같은지 저비용 비전 모델로 확인한다.
 * 키가 없거나 호출이 실패하면 생성을 막지 않고 null을 반환한다.
 */
export async function compareProductIdentity(args: {
  apiKey?: string
  referenceUrl: string
  generatedUrl: string
}): Promise<ProductIdentityVerdict | null> {
  const apiKey = args.apiKey?.trim()
  if (!apiKey) return null
  if (!/^https?:\/\//i.test(args.referenceUrl) || !/^https?:\/\//i.test(args.generatedUrl)) {
    return null
  }
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        max_tokens: 160,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `두 제품 사진을 비교한다. 첫 이미지가 실제 판매 제품, 둘째가 생성된 장면이다.
형태, 색, 부품 수, 제품 위 로고·인쇄가 판매 제품을 다른 제품으로 보이게 하면 match=false.
배경, 카메라 각도, 손의 존재만 달라진 경우는 match=true.
JSON만 출력: {"match":true,"reason":"한국어 한 문장"}`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "첫 이미지는 원본 제품, 둘째 이미지는 생성 결과다." },
              { type: "image_url", image_url: { url: args.referenceUrl, detail: "low" } },
              { type: "image_url", image_url: { url: args.generatedUrl, detail: "low" } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    })
    if (!response.ok) return null
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    return parseProductIdentityVerdict(data.choices?.[0]?.message?.content || "")
  } catch {
    return null
  }
}
