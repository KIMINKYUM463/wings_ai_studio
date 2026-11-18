import { NextRequest, NextResponse } from "next/server"
import { saveTikhubApiKey, tikhubApiKey } from "@/lib/wings-shopping-v2/tikhub-key"

export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json({ configured: Boolean(tikhubApiKey()) })
}

export async function POST(request: NextRequest) {
  // 배포 서버(Vercel)는 파일을 못 쓰고, 써도 모든 사용자가 한 키를 공유하게 됨 → 키는 각자 브라우저에만 둔다
  if (process.env.VERCEL) return NextResponse.json({ ok: true, configured: false, stored: false })
  const body = (await request.json().catch(() => ({}))) as { apiKey?: unknown }
  const apiKey = String(body.apiKey ?? "").trim()
  if (apiKey.length > 512) {
    return NextResponse.json({ ok: false, error: "키가 너무 깁니다." }, { status: 400 })
  }
  saveTikhubApiKey(apiKey)
  return NextResponse.json({ ok: true, configured: Boolean(apiKey) })
}
