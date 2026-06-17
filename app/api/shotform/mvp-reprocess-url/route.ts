import { type NextRequest, NextResponse } from "next/server"
import {
  detectReprocessUrlPlatform,
  resolveReprocessUrl,
  type MvpReprocessResolvedItem,
} from "@/lib/shotform-mvp-reprocess-url"

export const maxDuration = 300

function apifyTokenFromBody(body: Record<string, unknown>): string {
  return (
    (typeof body.apifyApiKey === "string" && body.apifyApiKey.trim()) ||
    process.env.APIFY_TOKEN ||
    ""
  )
}

/** POST — YouTube·TikTok URL 1개 → playUrl·메타 (재가공 AI편집) */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const apifyToken = apifyTokenFromBody(body)
    const rawUrl =
      (typeof body.url === "string" && body.url.trim()) ||
      (typeof body.urlText === "string" && body.urlText.trim()) ||
      ""

    if (!rawUrl) {
      return NextResponse.json({ error: "YouTube 또는 TikTok URL을 입력해 주세요." }, { status: 400 })
    }

    if (!detectReprocessUrlPlatform(rawUrl)) {
      return NextResponse.json(
        { error: "YouTube(youtube.com, youtu.be) 또는 TikTok(tiktok.com) URL만 지원합니다." },
        { status: 400 }
      )
    }

    const item: MvpReprocessResolvedItem = await resolveReprocessUrl(apifyToken, rawUrl)
    const ok = item.videoUrl.startsWith("http") && !item.error

    return NextResponse.json({
      item,
      success: ok,
      notice: ok
        ? "영상 URL 해석 완료 — AI 짜집기로 이어갈 수 있습니다."
        : "영상 URL을 찾지 못했습니다. URL·토큰·서버 yt-dlp 설정을 확인해 주세요.",
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "URL 해석 오류" }, { status: 500 })
  }
}
