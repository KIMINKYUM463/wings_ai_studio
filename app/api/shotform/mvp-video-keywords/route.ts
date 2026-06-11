import { type NextRequest, NextResponse } from "next/server"
import { isSupportedMvpVideoUrl, runMvpVideoKeywordAnalysis } from "@/lib/shotform-mvp-video-keywords"

export const maxDuration = 120

function openaiKeyFromBody(body: Record<string, unknown>): string {
  return (
    (typeof body.openaiApiKey === "string" && body.openaiApiKey.trim()) ||
    process.env.OPENAI_API_KEY ||
    ""
  )
}

/** POST — 영상 URL → 대본·장면 OCR → 제품 관련 한국어 키워드 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const url = typeof body.url === "string" ? body.url.trim() : ""
    const openaiApiKey = openaiKeyFromBody(body)

    if (!url) {
      return NextResponse.json({ error: "영상 URL을 입력해 주세요." }, { status: 400 })
    }
    if (!isSupportedMvpVideoUrl(url)) {
      return NextResponse.json(
        { error: "YouTube·TikTok·Instagram 영상 URL만 지원합니다." },
        { status: 400 }
      )
    }
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: "OpenAI API 키가 필요합니다. ShotForm 설정에 shotform_openai_api_key를 저장하세요." },
        { status: 400 }
      )
    }

    const result = await runMvpVideoKeywordAnalysis({ url, apiKey: openaiApiKey })
    return NextResponse.json(result)
  } catch (e) {
    console.error("[mvp-video-keywords]", e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "키워드 추출 실패" }, { status: 500 })
  }
}
