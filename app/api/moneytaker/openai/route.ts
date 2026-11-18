import { NextRequest, NextResponse } from "next/server"
import { guardStoryApiRequest } from "@/lib/story-shopping-security"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const access = await guardStoryApiRequest(request, {
    limit: 20,
    maxBytes: 600_000,
  })
  if (access.error) return access.error

  const apiKey =
    process.env.OPENAI_API_KEY ||
    process.env.GPT_API_KEY ||
    process.env.CHATGPT_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI API 키가 설정되지 않았습니다." }, { status: 503 })
  }
  const body = await request.json()
  const messages = Array.isArray(body.messages) ? body.messages.slice(0, 40) : []
  if (!messages.length) {
    return NextResponse.json({ error: "messages가 필요합니다." }, { status: 400 })
  }
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...body,
      model: String(body.model || "gpt-4o-mini"),
      messages,
      max_tokens: Math.min(20_000, Math.max(1, Number(body.max_tokens) || 2_000)),
    }),
    signal: AbortSignal.timeout(120_000),
  })
  const payload = await response.json().catch(() => ({ error: "OpenAI 응답 오류" }))
  return NextResponse.json(payload, { status: response.status })
}
