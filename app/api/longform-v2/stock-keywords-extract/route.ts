import { NextResponse } from "next/server"
import { geminiChatJson, resolveGeminiKey } from "@/lib/longform-v2/gemini"
import { extractStockKeywordsFromScriptLine } from "@/lib/longform-v2/stock-keywords-ko"

export const runtime = "nodejs"
export const maxDuration = 60

function buildStockKeywordsPrompt(scriptLine: string): string {
  return `당신은 실사 스톡 영상(Pexels) 검색 전문가입니다.

아래 장면 대본을 읽고, 이 장면 배경으로 보일 **실사(live-action) 영상**을 찾기 위한 **핵심 한국어 검색 키워드 2~3개**만 추출하세요.

규칙:
- 대본 앞부분을 그대로 자르지 마세요.
- 조사·접속사·추상 개념(가능성, 과거, 유령, 이유 등)은 제외하세요.
- 눈에 보이는 사물·장소·자연·현상·활동 위주로 고르세요.
- **최대 3개 단어**, 각 2~6글자 — Pexels 검색에 맞게 짧게.
- 애니메이션·일러스트·3D·CGI가 아닌 **카메라로 촬영한 실제 장면**을 떠올리세요.
- 우주·별·은하 장면이면 '천문대', '밤하늘', '별빛', '은하수'처럼 촬영 가능한 실사 소재를 우선하세요.
- 키워드는 공백으로 구분한 한 줄 문자열로만 답하세요.
- JSON만 출력: {"keywords":"키워드1 키워드2 키워드3"}

대본:
${scriptLine.trim()}`
}

async function extractWithGemini(scriptLine: string, apiKey: string): Promise<string | null> {
  try {
    const parsed = await geminiChatJson<{
      keywords?: string
      stockSearchKeywordsKo?: string
      searchKeywords?: string
    }>(apiKey, buildStockKeywordsPrompt(scriptLine), { temperature: 0.2 })
    const kw = String(
      parsed.keywords || parsed.stockSearchKeywordsKo || parsed.searchKeywords || ""
    ).trim()
    if (!kw || kw.length < 2) return null
    return kw
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .join(" ")
      .slice(0, 36)
  } catch {
    return null
  }
}

/**
 * WingsStudio detailModeStockKeywordsExtract 대응 —
 * 장면 대본 → 실사 스톡 검색용 한국어 키워드 (Gemini + 휴리스틱 fallback)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const scenes = Array.isArray(body.scenes) ? body.scenes : []
    const geminiKey = resolveGeminiKey(body.geminiApiKey)

    const keywordsBySceneIndex: Record<number, string> = {}

    await Promise.all(
      scenes.map(async (raw: { index?: number; text?: string }) => {
        const sceneIndex = Number(raw?.index)
        const scriptLine = String(raw?.text || "").trim()
        if (!Number.isFinite(sceneIndex) || !scriptLine) return

        const fallback = extractStockKeywordsFromScriptLine(scriptLine)
        if (geminiKey) {
          const ai = await extractWithGemini(scriptLine, geminiKey)
          if (ai) {
            keywordsBySceneIndex[sceneIndex] = ai
            return
          }
        }
        keywordsBySceneIndex[sceneIndex] = fallback
      })
    )

    return NextResponse.json({ success: true, keywordsBySceneIndex })
  } catch (e) {
    const message = e instanceof Error ? e.message : "키워드 추출 실패"
    console.error("[longform-v2/stock-keywords-extract]", message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
