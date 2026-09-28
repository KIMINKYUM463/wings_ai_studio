/** Gemini REST — WingsStudio v2 스크립트/프롬프트용 */

/** Google이 안내한 최신 Flash. 미제공·용량 부족 시 아래 폴백 순서로 재시도 */
const PRIMARY_MODEL = "gemini-3.6-flash"
const FALLBACK_MODELS = [
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
] as const

export function resolveGeminiKey(bodyKey?: string | null): string {
  return (
    (bodyKey || "").trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    ""
  )
}

function isModelUnavailableError(message: string, status: number): boolean {
  const m = message.toLowerCase()
  return (
    status === 404 ||
    m.includes("no longer available") ||
    m.includes("not found") ||
    m.includes("is not found") ||
    m.includes("unsupported") ||
    m.includes("not supported")
  )
}

function isRetryableCapacityError(message: string, status: number): boolean {
  const m = message.toLowerCase()
  return (
    status === 429 ||
    status === 503 ||
    m.includes("high demand") ||
    m.includes("resource_exhausted") ||
    m.includes("unavailable") ||
    m.includes("overloaded")
  )
}

async function geminiGenerateOnce(
  apiKey: string,
  model: string,
  prompt: string,
  options?: {
    json?: boolean
    temperature?: number
    /** data URL 또는 순수 base64 + mime */
    image?: { mimeType: string; data: string }
  }
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
  const parts: Array<Record<string, unknown>> = [{ text: prompt }]
  if (options?.image?.data) {
    parts.push({
      inline_data: {
        mime_type: options.image.mimeType || "image/jpeg",
        data: options.image.data,
      },
    })
  }
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: options?.temperature ?? 0.55,
      maxOutputTokens: 8192,
      ...(options?.json ? { responseMimeType: "application/json" } : {}),
    },
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = String(data?.error?.message || `Gemini 오류 (${res.status})`)
    const err = new Error(msg) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  const text =
    data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") ||
    ""
  return String(text).trim()
}

async function geminiGenerate(
  apiKey: string,
  prompt: string,
  options?: {
    json?: boolean
    temperature?: number
    image?: { mimeType: string; data: string }
  }
) {
  const models = [PRIMARY_MODEL, ...FALLBACK_MODELS]
  let lastError: Error | null = null

  for (const model of models) {
    try {
      return await geminiGenerateOnce(apiKey, model, prompt, options)
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      const status = (err as Error & { status?: number }).status || 0
      lastError = err
      if (isModelUnavailableError(err.message, status) || isRetryableCapacityError(err.message, status)) {
        continue
      }
      throw err
    }
  }

  throw lastError || new Error("Gemini 호출 실패")
}

export async function geminiChatText(
  apiKey: string,
  prompt: string,
  options?: { temperature?: number }
): Promise<string> {
  return geminiGenerate(apiKey, prompt, { temperature: options?.temperature ?? 0.7 })
}

/** 이미지(그림체 샘플) + 텍스트로 Gemini 호출 */
export async function geminiChatWithImage(
  apiKey: string,
  prompt: string,
  image: { mimeType: string; data: string },
  options?: { temperature?: number }
): Promise<string> {
  return geminiGenerate(apiKey, prompt, {
    temperature: options?.temperature ?? 0.35,
    image,
  })
}

export async function geminiChatJson<T extends Record<string, unknown>>(
  apiKey: string,
  prompt: string,
  options?: { temperature?: number }
): Promise<T> {
  const text = await geminiGenerate(apiKey, prompt, {
    json: true,
    temperature: options?.temperature ?? 0.5,
  })
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()
  return JSON.parse(cleaned) as T
}
