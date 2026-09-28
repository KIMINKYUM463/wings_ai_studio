import { NextResponse } from "next/server"
import { geminiChatText, resolveGeminiKey } from "@/lib/longform-v2/gemini"
import { dedupeTitleItems, parseTitleItems } from "@/lib/longform-v2/parse-title-items"
import { buildYoutubeTitleExpertRulesKo, YOUTUBE_TITLE_BATCH_STYLE_HINTS } from "@/lib/longform-v2/youtube/youtubeCopyPromptRulesKo"

export const runtime = "nodejs"
export const maxDuration = 90

function buildBatchPrompt(hint: string, style: string, batchCount: number, language: string): string {
  return `${buildYoutubeTitleExpertRulesKo()}

주제·대본 힌트: ${hint.trim()}
콘텐츠 타입: 롱폼 · 빠른 모드 대본
언어: ${language}
★ 이번 배치 스타일: ${style} ★

위 가이드를 바탕으로 트렌딩 가능한 유튜브 영상 제목을 ${batchCount}개 제안해주세요.

요구사항:
- 각 제목은 **40~70자** (공백 포함·한국어 기준). **모바일에서 앞 28~35자**에 핵심 키워드·후킹
- **낚시 금지** — 주제·대본의 **핵심 충격 사실**에만 기반
- 각 제목마다 **파이프(|) 뒤** **50자 이내**의 **간략한 설명**
- 출력 형식만 (다른 말 금지):
1. 제목 | 간략설명
2. 제목 | 간략설명`
}

/**
 * WingsStudio POST /api/ai/generate-titles 대응
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const geminiKey = resolveGeminiKey(body.geminiApiKey)
    if (!geminiKey) {
      return NextResponse.json(
        { success: false, error: "Gemini API 키가 필요합니다.", items: [] },
        { status: 400 }
      )
    }

    const hint = String(body.hint || body.prompt || "").trim()
    if (!hint) {
      return NextResponse.json(
        { success: false, error: "대본 힌트가 비어 있습니다.", items: [] },
        { status: 400 }
      )
    }

    const language = String(body.language || "한국어")
    const targetCount = Math.min(10, Math.max(1, Number(body.count) || 5))
    const styles = YOUTUBE_TITLE_BATCH_STYLE_HINTS.slice(0, 4)
    const per = Math.max(1, Math.ceil(targetCount / styles.length))

    const settled = await Promise.allSettled(
      styles.map((style) =>
        geminiChatText(geminiKey, buildBatchPrompt(hint, style, per, language), {
          temperature: 0.9,
        }).then((text) => parseTitleItems(text, per))
      )
    )

    let items = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []))
    items = dedupeTitleItems(items).slice(0, targetCount)

    if (items.length === 0) {
      return NextResponse.json(
        { success: false, error: "제목 후보를 파싱하지 못했습니다. 다시 시도해 주세요.", items: [] },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true, items, titles: items })
  } catch (e) {
    const message = e instanceof Error ? e.message : "제목 생성 실패"
    console.error("[longform-v2/generate-titles]", message)
    return NextResponse.json({ success: false, error: message, items: [] }, { status: 500 })
  }
}
