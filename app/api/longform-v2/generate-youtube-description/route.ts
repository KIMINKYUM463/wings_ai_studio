import { NextResponse } from "next/server"
import { geminiChatText, resolveGeminiKey } from "@/lib/longform-v2/gemini"
import {
  parseYoutubeDescriptionJson,
  YOUTUBE_DESCRIPTION_SYSTEM,
} from "@/lib/longform-v2/youtube-description"

export const runtime = "nodejs"
export const maxDuration = 90

/**
 * WingsStudio POST /api/ai/generate-youtube-description 대응
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const geminiKey = resolveGeminiKey(body.geminiApiKey)
    if (!geminiKey) {
      return NextResponse.json(
        { success: false, error: "Gemini API 키가 필요합니다." },
        { status: 400 }
      )
    }

    const script = String(body.script || "").trim()
    const title = String(body.title || "").trim()
    if (!script || !title) {
      return NextResponse.json(
        { success: false, error: "script·title이 필요합니다." },
        { status: 400 }
      )
    }

    const category = String(body.category || "롱폼 · 빠른 모드").trim() || "롱폼 · 빠른 모드"
    const scriptSlice = script.length > 3000 ? `${script.slice(0, 3000)}…` : script

    const user = `제목: ${title}
카테고리: ${category}

대본:
${scriptSlice}

타임라인 작성 참고: 대본 문장 복사 금지. 구간별 짧은 주제와 분:초만.

위 대본과 제목을 반영해 JSON 객체 하나만 출력하세요.`

    const raw = await geminiChatText(
      geminiKey,
      `${YOUTUBE_DESCRIPTION_SYSTEM}\n\n---\n\n${user}`,
      { temperature: 0.7 }
    )

    const out = parseYoutubeDescriptionJson(raw)
    return NextResponse.json({ success: true, ...out })
  } catch (e) {
    const message = e instanceof Error ? e.message : "설명 생성 실패"
    console.error("[longform-v2/generate-youtube-description]", message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
