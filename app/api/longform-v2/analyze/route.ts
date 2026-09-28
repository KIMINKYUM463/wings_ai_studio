import { NextResponse } from "next/server"
import { buildAnalyzePrompt } from "@/lib/longform-v2/prompts"
import { geminiChatJson, resolveGeminiKey } from "@/lib/longform-v2/gemini"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const benchmarkScript = String(body.benchmarkScript || "").trim()
    const apiKey = resolveGeminiKey(body.geminiApiKey)

    if (benchmarkScript.length < 200) {
      return NextResponse.json(
        { success: false, error: "벤치마킹 대본이 너무 짧습니다. (최소 200자)" },
        { status: 400 }
      )
    }
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "Gemini API 키가 필요합니다. API 키 설정에서 저장하세요." },
        { status: 400 }
      )
    }

    const analysis = await geminiChatJson<Record<string, unknown>>(
      apiKey,
      buildAnalyzePrompt(benchmarkScript),
      { temperature: 0.4 }
    )

    return NextResponse.json({ success: true, analysis })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "분석 실패" },
      { status: 500 }
    )
  }
}
