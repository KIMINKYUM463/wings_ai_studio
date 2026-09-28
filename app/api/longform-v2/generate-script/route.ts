import { NextResponse } from "next/server"
import { buildGeneratePrompt } from "@/lib/longform-v2/prompts"
import { geminiChatText, resolveGeminiKey } from "@/lib/longform-v2/gemini"
import {
  clampV2TargetChars,
  enforceV2ScriptLineFormat,
  fitV2GeneratedScriptToTarget,
  sanitizeV2ScriptOutput,
  v2ScriptTargetCharRange,
} from "@/lib/longform-v2/script-utils"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const benchmarkScript = String(body.benchmarkScript || "").trim()
    const planMarkdown = String(body.planMarkdown || "").trim()
    const analysis = body.analysis
    const topicDirection = String(body.topicDirection || "").trim()
    const targetChars = clampV2TargetChars(Number(body.targetChars) || 8300)
    const apiKey = resolveGeminiKey(body.geminiApiKey)

    if (!benchmarkScript || !planMarkdown) {
      return NextResponse.json(
        { success: false, error: "벤치마킹 대본과 기획안이 필요합니다." },
        { status: 400 }
      )
    }
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "Gemini API 키가 필요합니다." }, { status: 400 })
    }

    const prompt = buildGeneratePrompt({
      benchmarkScript,
      planMarkdown,
      analysisJson: analysis && typeof analysis === "object" ? JSON.stringify(analysis, null, 2) : "{}",
      topicDirection,
      targetChars,
    })

    let script = sanitizeV2ScriptOutput(await geminiChatText(apiKey, prompt, { temperature: 0.72 }))
    script = enforceV2ScriptLineFormat(script)

    const { min, max } = v2ScriptTargetCharRange(targetChars)
    if (script.length < min) {
      const more = await geminiChatText(
        apiKey,
        `${prompt}\n\n[이어쓰기] 아래까지 작성됨. ${min}~${max}자 범위 안에서 이어서 작성. 반복 금지.\n\n---\n${script.slice(-6000)}`,
        { temperature: 0.7 }
      )
      script = enforceV2ScriptLineFormat(sanitizeV2ScriptOutput(`${script}\n${more}`))
    }

    script = fitV2GeneratedScriptToTarget(script, targetChars)

    return NextResponse.json({
      success: true,
      script,
      charCount: script.length,
    })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "대본 생성 실패" },
      { status: 500 }
    )
  }
}
