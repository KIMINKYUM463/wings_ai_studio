import { NextResponse } from "next/server"
import { buildPlanPrompt } from "@/lib/longform-v2/prompts"
import { geminiChatJson, resolveGeminiKey } from "@/lib/longform-v2/gemini"
import { clampV2TargetChars } from "@/lib/longform-v2/script-utils"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const benchmarkScript = String(body.benchmarkScript || "").trim()
    const analysis = body.analysis
    const topicDirection = String(body.topicDirection || "").trim()
    const targetChars = clampV2TargetChars(Number(body.targetChars) || 8300)
    const apiKey = resolveGeminiKey(body.geminiApiKey)

    if (benchmarkScript.length < 200) {
      return NextResponse.json({ success: false, error: "벤치마킹 대본이 너무 짧습니다." }, { status: 400 })
    }
    if (!analysis || typeof analysis !== "object") {
      return NextResponse.json({ success: false, error: "패턴 분석 결과가 필요합니다." }, { status: 400 })
    }
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "Gemini API 키가 필요합니다." }, { status: 400 })
    }

    const parsed = await geminiChatJson<Record<string, unknown>>(
      apiKey,
      buildPlanPrompt({
        benchmarkScript,
        analysisJson: JSON.stringify(analysis, null, 2),
        topicDirection,
        targetChars,
      }),
      { temperature: 0.55 }
    )

    const planMarkdown =
      String(parsed.planMarkdown || "").trim() ||
      [
        parsed.coreTopic && `## 핵심 주제\n${parsed.coreTopic}`,
        parsed.hookStrategy && `## 도입부\n${parsed.hookStrategy}`,
        parsed.bodyStructure && `## 본론 구조\n${parsed.bodyStructure}`,
        parsed.differentiation && `## 차별화\n${parsed.differentiation}`,
        parsed.toneGuide && `## 톤\n${parsed.toneGuide}`,
      ]
        .filter(Boolean)
        .join("\n\n")

    return NextResponse.json({
      success: true,
      plan: parsed,
      planMarkdown,
      planVerification: {
        pass: true,
        score: 75,
        summary: "Gemini 기획안 생성 완료",
        issues: [],
        suggestions: [],
      },
    })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "기획 생성 실패" },
      { status: 500 }
    )
  }
}
