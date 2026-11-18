import Anthropic from "@anthropic-ai/sdk"
import { NextRequest, NextResponse } from "next/server"
import { guardStoryApiRequest } from "@/lib/story-shopping-security"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const access = await guardStoryApiRequest(request, {
    limit: 10,
    maxBytes: 600_000,
  })
  if (access.error) return access.error
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "Anthropic API 키가 설정되지 않았습니다." }, { status: 503 })
  }
  const body = await request.json()
  const messages = Array.isArray(body.messages) ? body.messages.slice(0, 30) : []
  if (!messages.length) {
    return NextResponse.json({ error: "messages가 필요합니다." }, { status: 400 })
  }
  const client = new Anthropic({ apiKey })
  const message = await client.messages.create({
    model: String(body.model || "claude-sonnet-4-5-20250929"),
    max_tokens: Math.min(20_000, Math.max(1, Number(body.max_tokens) || 2_000)),
    temperature: Math.min(1, Math.max(0, Number(body.temperature) || 0.7)),
    messages,
  })
  return NextResponse.json(message)
}
