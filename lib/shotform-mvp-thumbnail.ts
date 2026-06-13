/** MVP·쇼핑숏폼 공용 — Replicate nano-banana-pro 썸네일 생성 */

export type ThumbnailHookingText = { line1: string; line2: string }

export type ThumbnailTextRole = "hook1" | "hook2" | "badge" | "custom"

export type RewriteThumbnailTextInput = {
  productName: string
  currentText: string
  role?: ThumbnailTextRole
  otherLines?: string[]
}

/** 쇼핑숏폼 AI 썸네일 카피 — 후킹 생성·리라이트 공용 */
export const THUMBNAIL_HOOKING_MAX_CHARS = 7

export const THUMBNAIL_HOOKING_SYSTEM_PROMPT = `당신은 유튜브 쇼핑숏폼 썸네일 후킹 카피 전문가입니다.

절대 규칙 (무조건 준수):
1. 반드시 두 줄 line1, line2 (JSON만 출력, 빈 문자열 금지)
2. 각 줄 ${THUMBNAIL_HOOKING_MAX_CHARS}자 이내 — 8자 이상 절대 금지, 길게 쓰지 말 것
3. 각 줄에 반드시 숫자 포함 (99%, 3초, 1위, 10배, 7일, 50% 등)
4. 짧고 굵게, 클릭·충격·긴박감·호기심 유발
5. 제품명 그대로 나열 금지 — 후킹 문구만
6. line1·line2 단어 중복 금지
7. **line1+line2는 위·아래 합쳐 한 메시지** — 따로 노는 독립 문구 금지
8. line1=앞반(궁금증·충격·후킹), line2=뒷반(결론·제품 핵심·긴박) — 이어 읽으면 자연스러워야 함

연결된 좋은 예 (위+아래 = 한 세트):
{"line1":"99% 손해","line2":"3초 완판"} → 몰라서 99% 손해 / 3초 만에 완판
{"line1":"안 쓰면","line2":"100% 손해"}
{"line1":"1위 비밀","line2":"7일 만에"}
{"line1":"10배 싸게","line2":"오늘 마감"}
{"line1":"요즘 난리","line2":"이거 때문"}

나쁜 예 (각각 따로 노는 것):
{"line1":"99% 손해","line2":"7일 효과"} — 앞뒤 무관
{"line1":"10배 싸게","line2":"1위 비밀"} — 연결 없음
{"line1":"이 제품 쓰면 좋아요","line2":"지금 구매하세요"} — 너무 김·약함`

export function buildThumbnailHookingUserPrompt(productName: string): string {
  return `제품명: ${productName}

위 제품에 맞는 쇼츠 썸네일 후킹 2줄을 작성하세요.
- 위 줄(line1)+아래 줄(line2)을 합쳐 읽었을 때 **한 문장·한 후킹**처럼 이어져야 합니다.
- line1은 궁금증/충격, line2는 그에 대한 결론/제품 핵심.
- 각 줄 ${THUMBNAIL_HOOKING_MAX_CHARS}자 이내, 숫자 필수, 짧고 굵게.

{"line1":"...","line2":"..."}`
}

function clampThumbnailCopyLine(text: string, max = THUMBNAIL_HOOKING_MAX_CHARS): string {
  const t = text.trim().replace(/\s+/g, " ")
  if (t.length <= max) return t
  return t.slice(0, max).trim()
}

function normalizeHookingText(raw: { line1?: string; line2?: string }): ThumbnailHookingText {
  return {
    line1: clampThumbnailCopyLine(raw.line1?.trim() || "99% 손해"),
    line2: clampThumbnailCopyLine(raw.line2?.trim() || "3초 완판"),
  }
}

const HOOKING_PAIRS: readonly ThumbnailHookingText[] = [
  { line1: "99% 손해", line2: "3초 완판" },
  { line1: "안 쓰면", line2: "100% 손해" },
  { line1: "1위 비밀", line2: "7일 만에" },
  { line1: "10배 싸게", line2: "오늘 마감" },
  { line1: "요즘 난리", line2: "이거 때문" },
  { line1: "50% 할인", line2: "품절 임박" },
  { line1: "5초 충전", line2: "이유 공개" },
] as const

const BADGE_FALLBACKS = ["한정", "오늘만", "마감", "최저가", "1+1"] as const

function pickHookingPairFallback(otherLine?: string, role?: ThumbnailTextRole): ThumbnailHookingText {
  const other = otherLine?.trim()
  if (other && (role === "hook1" || role === "hook2")) {
    const matched = HOOKING_PAIRS.find((p) =>
      role === "hook1" ? p.line2 === other : p.line1 === other
    )
    if (matched) return matched
  }
  return HOOKING_PAIRS[Math.floor(Math.random() * HOOKING_PAIRS.length)]!
}

function pickFallbackText(
  role: ThumbnailTextRole | undefined,
  currentText: string,
  otherLines: string[]
): string {
  if (role === "hook1" || role === "hook2") {
    const pair = pickHookingPairFallback(otherLines[0], role)
    return role === "hook1" ? pair.line1 : pair.line2
  }
  if (role === "badge") {
    const blocked = new Set([currentText.trim(), ...otherLines.map((l) => l.trim())].filter(Boolean))
    const candidates = BADGE_FALLBACKS.filter((t) => !blocked.has(t))
    const list = candidates.length ? candidates : [...BADGE_FALLBACKS]
    return list[Math.floor(Math.random() * list.length)]
  }
  const pair = pickHookingPairFallback()
  return pair.line1
}

function rolePromptHint(role: ThumbnailTextRole | undefined): string {
  if (role === "hook1") {
    return `첫 번째 후킹 줄(상단): 숫자 + 궁금증·충격 (${THUMBNAIL_HOOKING_MAX_CHARS}자 이내). 아래 줄과 합쳐 한 메시지가 되도록 앞반만 작성`
  }
  if (role === "hook2") {
    return `두 번째 후킹 줄(하단): 숫자 + 결론·제품 핵심·긴박 (${THUMBNAIL_HOOKING_MAX_CHARS}자 이내). 위 줄과 합쳐 한 메시지가 되도록 뒷반만 작성`
  }
  if (role === "badge") {
    return `뱃지 라벨: 숫자 포함, 2~${THUMBNAIL_HOOKING_MAX_CHARS}자, 짧고 강렬`
  }
  return `쇼츠 썸네일 후킹 한 줄 (${THUMBNAIL_HOOKING_MAX_CHARS}자 이내, 숫자 필수)`
}

function buildThumbnailRewriteSystemPrompt(role?: ThumbnailTextRole): string {
  const pairRule =
    role === "hook1" || role === "hook2"
      ? "\n- **짝 줄과 한 세트**: 위+아래 합쳐 읽으면 하나의 후킹 메시지. 짝 줄 문구는 유지하고, 수정하는 줄만 짝과 자연스럽게 이어지게 작성"
      : ""
  return `${THUMBNAIL_HOOKING_SYSTEM_PROMPT}

추가 규칙 (한 줄 리라이트):
- ${rolePromptHint(role)}${pairRule}
- 반드시 한 줄만 출력: {"text": "새 문구"}
- 현재 문구와 완전히 다른 새 문구`
}

function parseReplicateImageOutput(output: unknown): string {
  if (typeof output === "string") return output
  if (Array.isArray(output) && output.length > 0) {
    const first = output[0]
    if (typeof first === "string") return first
    if (first && typeof first === "object" && "url" in first) {
      return String((first as { url: string }).url)
    }
    return String(first)
  }
  if (output && typeof output === "object" && "url" in output) {
    return String((output as { url: string }).url)
  }
  return String(output)
}

async function pollReplicatePrediction(predictionId: string, token: string, maxAttempts = 120): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2000))

    const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!statusResponse.ok) {
      throw new Error(`Replicate 상태 확인 실패: ${statusResponse.status}`)
    }

    const statusData = (await statusResponse.json()) as {
      status?: string
      output?: unknown
      error?: string
    }

    if (statusData.status === "succeeded" && statusData.output) {
      return parseReplicateImageOutput(statusData.output)
    }
    if (statusData.status === "failed") {
      throw new Error(`썸네일 생성 실패: ${statusData.error || "알 수 없는 오류"}`)
    }
  }

  throw new Error("썸네일 생성 시간 초과 (Replicate 폴링)")
}

export async function rewriteThumbnailLayerText(
  input: RewriteThumbnailTextInput,
  apiKey?: string
): Promise<string> {
  const productName = input.productName.trim() || "제품"
  const currentText = input.currentText.trim()
  const otherLines = (input.otherLines ?? []).map((l) => l.trim()).filter(Boolean)
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    return pickFallbackText(input.role, currentText, otherLines)
  }

  const otherHint =
    otherLines.length > 0
      ? role === "hook1" || role === "hook2"
        ? `\n짝이 되는 다른 줄(반드시 이어 읽기): 「${otherLines[0]}」\n위·아래를 합치면 하나의 후킹이 되도록, ${role === "hook1" ? "상단(앞반)" : "하단(뒷반)"}만 새로 작성`
        : `\n다른 줄에 이미 사용된 문구(단어 중복 금지): ${otherLines.join(" / ")}`
      : ""

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GPT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: buildThumbnailRewriteSystemPrompt(input.role),
          },
          {
            role: "user",
            content: `제품명: ${productName}
현재 문구: ${currentText || "(비어 있음)"}
역할: ${input.role ?? "custom"}${otherHint}

${THUMBNAIL_HOOKING_MAX_CHARS}자 이내, 숫자 필수, 짧고 굵은 후킹 한 줄만 작성하세요.
{"text": "..."}`,
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 60,
        temperature: 1.0,
      }),
    })

    if (!response.ok) throw new Error(`API 호출 실패: ${response.status}`)

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error("문구 변환에 실패했습니다.")

    let parsed: { text?: string }
    try {
      parsed = typeof content === "string" ? JSON.parse(content) : content
    } catch {
      return pickFallbackText(input.role, currentText, otherLines)
    }

    const next = parsed.text?.trim()
    if (!next) return pickFallbackText(input.role, currentText, otherLines)
    return clampThumbnailCopyLine(next)
  } catch (error) {
    console.error("[MVP Thumbnail] 문구 변환 실패:", error)
    return pickFallbackText(input.role, currentText, otherLines)
  }
}

export async function generateThumbnailHookingText(
  productName: string,
  apiKey?: string
): Promise<ThumbnailHookingText> {
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    return HOOKING_PAIRS[Math.floor(Math.random() * HOOKING_PAIRS.length)]!
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GPT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: THUMBNAIL_HOOKING_SYSTEM_PROMPT },
          { role: "user", content: buildThumbnailHookingUserPrompt(productName) },
        ],
        response_format: { type: "json_object" },
        max_tokens: 80,
        temperature: 0.85,
      }),
    })

    if (!response.ok) throw new Error(`API 호출 실패: ${response.status}`)

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error("후킹 문구 생성에 실패했습니다.")

    let parsed: { line1?: string; line2?: string }
    try {
      parsed = typeof content === "string" ? JSON.parse(content) : content
    } catch {
      return normalizeHookingText({ line1: "99% 손해", line2: "3초 완판" })
    }

    return normalizeHookingText(parsed)
  } catch (error) {
    console.error("[MVP Thumbnail] 후킹 문구 생성 실패:", error)
    return normalizeHookingText({ line1: "99% 손해", line2: "3초 완판" })
  }
}

const PRODUCT_PRESERVATION_RULES = `CRITICAL PRODUCT PRESERVATION RULES (MUST FOLLOW - ABSOLUTELY MANDATORY):
- The product's physical shape, proportions, dimensions, and design must be preserved EXACTLY as shown in the reference image
- Product must NOT be deformed, abstracted, redesigned, or modified in any way
- Product must remain recognizable and maintain its original form, structure, and appearance
- Do NOT alter the product's structure, size, shape, proportions, or appearance
- The product in the image must match the reference product image EXACTLY
- Maintain exact original product features, buttons, switches, controls, and design elements from reference image
- Do NOT add new features, buttons, switches, or controls that are not present in the original product
- Do NOT remove or modify any existing features, buttons, or design elements from the original product
- Product's original design and structure must be preserved accurately (exact product design preservation, maintain original product structure)
- The product's actual appearance must be accurately reflected (product preservation, exact product shape and features maintained)
- Only maintain original product features, buttons, and design elements from the reference image
- Never add new features, buttons, or switches not present in the original
- Exact original product design and structure must be preserved`

function buildThumbnailPrompt(productName: string, hookingText?: ThumbnailHookingText): string {
  return `YouTube shopping shorts thumbnail with text style.

Product: ${productName}

${PRODUCT_PRESERVATION_RULES}

Background: Show the product being actively used in a real-world scenario. The product's main function must be clearly demonstrated. Hands operating or using the product are allowed. Realistic product usage scene, natural lighting, authentic environment. Photo-realistic style, not illustration.

Text to display (CRITICAL - MUST FOLLOW EXACTLY - ABSOLUTELY MANDATORY):
- Display EXACTLY two lines of text (NOT one line, NOT three lines, EXACTLY two lines)
- Line 1 (top line): "${hookingText ? hookingText.line1 : productName}"
- Line 2 (bottom line): "${hookingText ? hookingText.line2 : "쇼츠 영상"}"
- BOTH lines MUST be displayed - Line 1 AND Line 2 are REQUIRED
- DO NOT combine the two lines into one
- DO NOT display only one line
- DO NOT skip either line
- ABSOLUTELY NO duplicate words between the two lines
- Each line must have completely different words
- If any word appears in Line 1, it must NOT appear in Line 2
- If any word appears in Line 2, it must NOT appear in Line 1
- The two lines must be distinct and non-repetitive
- Display exactly as provided above, no variations, no duplicates
- Line 1 must be on top, Line 2 must be on bottom
- Both lines must be clearly visible and readable

Text style requirements:
- Very bold Korean typography
- Huge text, high contrast
- EXACTLY two lines of text displayed prominently (no more, no less)
- First line (top): white text only (no stroke, no outline)
- Second line (bottom): neon mint / turquoise text only (bright mint green or turquoise color, no stroke, no outline)
- Flat design, no heavy shadow
- Optimized for mobile readability
- Text should look like it's overlaid on a photo
- Photo-realistic text rendering

Image requirements:
- Product usage scene as background (photo-realistic)
- Product being actively used (product shape, structure, features, buttons, and design MUST be preserved exactly as in reference image)
- Product must maintain exact original form, features, buttons, and design elements from reference image
- Do NOT add new features, buttons, or controls not present in the original product
- Hands operating the product are visible
- Natural, realistic environment
- High quality, professional photography style
- 9:16 vertical aspect ratio
- No human faces, no face visible
- Realistic lighting and shadows
- Product must be the exact same product from the reference image (exact product design preservation, maintain original product structure, exact product shape and features maintained)

Product highlighting elements:
- Add a bright red arrow or red circle to highlight and point to the product
- Red arrow should point directly at the product
- Red circle should surround or highlight the product area
- Use vibrant red color (#FF0000 or similar) for high visibility
- Arrow or circle should be bold and eye-catching
- These elements should draw attention to the product
- Professional YouTube thumbnail style highlighting`
}

function buildBackgroundOnlyPrompt(productName: string): string {
  return `YouTube shopping shorts BACKGROUND image only — NO text layer.

Product: ${productName}

${PRODUCT_PRESERVATION_RULES}

ABSOLUTELY NO TEXT (CRITICAL):
- Do NOT include any text, letters, numbers, typography, captions, subtitles, watermarks, or logos with words
- Do NOT include Korean or English characters anywhere in the image
- The image must be a clean photo background only — text will be added separately in an editor

Scene requirements:
- Show the product being actively used in a real-world scenario
- Product's main function clearly demonstrated
- Hands operating the product are allowed (no human faces visible)
- Realistic product usage scene, natural lighting, authentic environment
- Photo-realistic photography style, not illustration
- 9:16 vertical aspect ratio — full-bleed edge-to-edge photo filling the entire frame
- NO empty bands, gray bars, blank sky strips, or letterboxing at the top, bottom, or sides
- Scene and environment must extend naturally across the full canvas height and width
- High quality, professional photography
- Product clearly visible (may be in center or lower area) but background must fill the whole frame
- No arrows, circles, badges, or graphic overlays (those will be added in the editor)`
}

function normalizeReferenceImageInput(productImageBase64: string): string[] {
  if (productImageBase64.startsWith("data:image/")) {
    return [productImageBase64]
  }
  const mimeType = productImageBase64.includes("/9j/") ? "image/jpeg" : "image/png"
  return [`data:${mimeType};base64,${productImageBase64}`]
}

async function runNanoBananaPro(
  token: string,
  prompt: string,
  productImageBase64?: string,
  logLabel = "생성"
): Promise<string> {
  const imageInput = productImageBase64?.trim() ? normalizeReferenceImageInput(productImageBase64.trim()) : undefined

  const response = await fetch("https://api.replicate.com/v1/models/google/nano-banana-pro/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "wait=60",
    },
    body: JSON.stringify({
      input: {
        prompt,
        aspect_ratio: "9:16",
        ...(imageInput ? { image_input: imageInput } : {}),
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("[MVP Thumbnail] Replicate 오류:", errorText)
    throw new Error(`썸네일 생성 실패: ${response.status} - ${errorText.substring(0, 300)}`)
  }

  const data = (await response.json()) as {
    id?: string
    status?: string
    output?: unknown
    error?: string
  }

  if (data.status === "succeeded" && data.output) {
    const imageUrl = parseReplicateImageOutput(data.output)
    console.log(`[MVP Thumbnail] ${logLabel} 완료:`, imageUrl)
    return imageUrl
  }

  if ((data.status === "processing" || data.status === "starting") && data.id) {
    const imageUrl = await pollReplicatePrediction(data.id, token)
    console.log(`[MVP Thumbnail] ${logLabel} 완료 (폴링):`, imageUrl)
    return imageUrl
  }

  throw new Error(`이미지 생성 실패: ${data.error || data.status || "알 수 없는 오류"}`)
}

function resolveReplicateToken(replicateApiKey?: string): string {
  const token = replicateApiKey?.trim() || process.env.REPLICATE_API_TOKEN?.trim()
  if (!token) {
    throw new Error("Replicate API 키가 설정되지 않았습니다. ShotForm 설정에서 API 키를 입력해 주세요.")
  }
  return token
}

/** Replicate google/nano-banana-pro — 9:16 쇼츠 썸네일 URL 반환 */
export async function generateShortsThumbnail(
  productName: string,
  replicateApiKey?: string,
  productImageBase64?: string,
  hookingText?: ThumbnailHookingText
): Promise<string> {
  const token = resolveReplicateToken(replicateApiKey)
  const thumbnailPrompt = buildThumbnailPrompt(productName, hookingText)
  console.log("[MVP Thumbnail] Replicate nano-banana-pro 썸네일 생성 시작:", productName)
  return runNanoBananaPro(token, thumbnailPrompt, productImageBase64, "썸네일 생성")
}

/** Replicate — 텍스트·오버레이 없이 배경 장면만 생성 */
export async function generateShortsThumbnailBackground(
  productName: string,
  replicateApiKey?: string,
  productImageBase64?: string
): Promise<string> {
  const token = resolveReplicateToken(replicateApiKey)
  const prompt = buildBackgroundOnlyPrompt(productName)
  console.log("[MVP Thumbnail] Replicate nano-banana-pro 배경 생성 시작:", productName)
  return runNanoBananaPro(token, prompt, productImageBase64, "배경 생성")
}
