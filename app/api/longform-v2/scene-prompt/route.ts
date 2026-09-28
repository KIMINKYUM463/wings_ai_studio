import { NextResponse } from "next/server"
import { buildSceneImagePromptRequest } from "@/lib/longform-v2/prompts"
import { geminiChatText, resolveGeminiKey } from "@/lib/longform-v2/gemini"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const sceneText = String(body.sceneText || "").trim()
    const styleHint = String(body.styleHint || "").trim()
    const apiKey = resolveGeminiKey(body.geminiApiKey)

    if (!sceneText) {
      return NextResponse.json({ success: false, error: "장면 텍스트가 필요합니다." }, { status: 400 })
    }
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "Gemini API 키가 필요합니다." }, { status: 400 })
    }

    const prompt = await geminiChatText(
      apiKey,
      buildSceneImagePromptRequest(sceneText, styleHint),
      { temperature: 0.5 }
    )

    return NextResponse.json({
      success: true,
      prompt: prompt.replace(/^["']|["']$/g, "").trim(),
    })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "프롬프트 생성 실패" },
      { status: 500 }
    )
  }
}
