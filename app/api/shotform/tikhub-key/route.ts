import { NextRequest, NextResponse } from "next/server"
import { saveTikhubApiKey, tikhubApiKey } from "@/lib/wings-shopping-v2/tikhub-key"

export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json({ configured: Boolean(tikhubApiKey()) })
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { apiKey?: unknown }
  const apiKey = String(body.apiKey ?? "").trim()
  if (apiKey.length > 512) {
    return NextResponse.json({ ok: false, error: "키가 너무 깁니다." }, { status: 400 })
  }
  saveTikhubApiKey(apiKey)
  return NextResponse.json({ ok: true, configured: Boolean(apiKey) })
}
