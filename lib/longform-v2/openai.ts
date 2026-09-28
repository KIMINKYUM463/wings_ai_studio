/** OpenAI Chat Completions 헬퍼 (신규 롱폼) */

export async function openaiChatJson<T extends Record<string, unknown>>(
  apiKey: string,
  system: string,
  user: string,
  options?: { temperature?: number; model?: string }
): Promise<T> {
  const model = options?.model || "gpt-4o-mini"
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: options?.temperature ?? 0.5,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error?.message || `OpenAI 오류 (${res.status})`)
  }
  const text = data?.choices?.[0]?.message?.content || "{}"
  return JSON.parse(text) as T
}

export async function openaiChatText(
  apiKey: string,
  system: string,
  user: string,
  options?: { temperature?: number; model?: string; maxTokens?: number }
): Promise<string> {
  const model = options?.model || "gpt-4o-mini"
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 16000,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error?.message || `OpenAI 오류 (${res.status})`)
  }
  return String(data?.choices?.[0]?.message?.content || "").trim()
}

export function resolveOpenAiKey(bodyKey?: string | null): string {
  return (
    (bodyKey || "").trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.GPT_API_KEY?.trim() ||
    process.env.CHATGPT_API_KEY?.trim() ||
    ""
  )
}
