import { NextRequest, NextResponse } from "next/server"
import { geminiApiKey, saveGeminiApiKey } from "@/lib/wings-shopping-v2/gemini-key"

export const runtime = "nodejs"

/** 키 값은 돌려주지 않는다. 들어 있는지만 알려 준다. */
export async function GET() {
  return NextResponse.json({ configured: Boolean(geminiApiKey()) })
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { apiKey?: unknown }
  const apiKey = String(body.apiKey ?? "").trim()
  if (apiKey.length > 256) {
    return NextResponse.json({ ok: false, error: "키가 너무 깁니다." }, { status: 400 })
  }
  saveGeminiApiKey(apiKey)
  return NextResponse.json({ ok: true, configured: Boolean(apiKey) })
}
