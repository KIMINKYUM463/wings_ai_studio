import { NextResponse } from "next/server"
import { buildAnalyzeArtStylePrompt } from "@/lib/longform-v2/prompts"
import { geminiChatWithImage, resolveGeminiKey } from "@/lib/longform-v2/gemini"

function parseDataUrl(input: string): { mimeType: string; data: string } | null {
  const raw = String(input || "").trim()
  if (!raw) return null
  const m = /^data:([^;]+);base64,(.+)$/i.exec(raw)
  if (m) {
    return { mimeType: m[1] || "image/jpeg", data: m[2] }
  }
  if (/^[A-Za-z0-9+/=\s]+$/.test(raw) && raw.length > 100) {
    return { mimeType: "image/jpeg", data: raw.replace(/\s/g, "") }
  }
  return null
}

function parseStyleJson(text: string): {
  styleHint: string
  labelKo: string
  descriptionKo: string
} | null {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim()
  try {
    const obj = JSON.parse(cleaned) as Record<string, unknown>
    const styleHint = String(obj.styleHint || obj.style || obj.prompt || "").trim()
    if (!styleHint || styleHint.length < 12) return null
    return {
      styleHint,
      labelKo: String(obj.labelKo || obj.label || "커스텀 그림체").trim() || "커스텀 그림체",
      descriptionKo: String(obj.descriptionKo || obj.description || "").trim(),
    }
  } catch {
    // JSON이 아니면 전체를 영문 힌트로 취급
    const styleHint = cleaned.replace(/^["']|["']$/g, "").trim()
    if (!styleHint || styleHint.length < 12) return null
    return {
      styleHint,
      labelKo: "커스텀 그림체",
      descriptionKo: "업로드한 샘플의 선·채색·분위기를 따라가는 맞춤 그림체입니다.",
    }
  }
}

/** 업로드 그림체 → Gemini Vision으로 스타일 프롬프트(+한글 설명) 추출 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const apiKey = resolveGeminiKey(body.geminiApiKey)
    const parsed = parseDataUrl(String(body.imageDataUrl || body.image || ""))

    if (!apiKey) {
      return NextResponse.json({ success: false, error: "Gemini API 키가 필요합니다." }, { status: 400 })
    }
    if (!parsed) {
      return NextResponse.json(
        { success: false, error: "이미지(data URL)가 필요합니다." },
        { status: 400 }
      )
    }

    const raw = await geminiChatWithImage(
      apiKey,
      buildAnalyzeArtStylePrompt(),
      { mimeType: parsed.mimeType, data: parsed.data },
      { temperature: 0.3 }
    )

    const analyzed = parseStyleJson(raw)
    if (!analyzed) {
      return NextResponse.json(
        { success: false, error: "스타일 분석 결과가 비어 있습니다. 다른 이미지를 시도하세요." },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      styleHint: analyzed.styleHint,
      labelKo: analyzed.labelKo,
      descriptionKo: analyzed.descriptionKo,
      imageStyleId: "custom",
      imageStyleLabel: analyzed.labelKo,
    })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "스타일 분석 실패" },
      { status: 500 }
    )
  }
}
