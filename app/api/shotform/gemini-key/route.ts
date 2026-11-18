import { NextRequest, NextResponse } from "next/server"
import { geminiApiKey, saveGeminiApiKey } from "@/lib/wings-shopping-v2/gemini-key"

export const runtime = "nodejs"

/** 키 값은 돌려주지 않는다. 들어 있는지만 알려 준다. */
export async function GET() {
  return NextResponse.json({ configured: Boolean(geminiApiKey()) })
}

export async function POST(request: NextRequest) {
  // 배포 서버(Vercel)는 파일을 못 쓰고, 써도 모든 사용자가 한 키를 공유하게 됨 → 키는 각자 브라우저에만 둔다
  if (process.env.VERCEL) return NextResponse.json({ ok: true, configured: false, stored: false })
  const body = (await request.json().catch(() => ({}))) as { apiKey?: unknown }
  const apiKey = String(body.apiKey ?? "").trim()
  if (apiKey.length > 256) {
    return NextResponse.json({ ok: false, error: "키가 너무 깁니다." }, { status: 400 })
  }
  saveGeminiApiKey(apiKey)
  return NextResponse.json({ ok: true, configured: Boolean(apiKey) })
}
