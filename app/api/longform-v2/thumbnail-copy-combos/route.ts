import { NextResponse } from "next/server"
import { geminiChatText, resolveGeminiKey } from "@/lib/longform-v2/gemini"
import {
  buildThumbnailCopyCombosSystemPrompt,
  buildThumbnailCopyCombosUserPrompt,
  parseThumbnailCopyCombosJson,
  type ThumbnailCopyComboSlotSpec,
  type ThumbnailCopyCombosRequest,
} from "@/lib/longform-v2/youtube/thumbnailCopyCombos"
import type { ThumbnailCopyResearchItem } from "@/lib/longform-v2/youtube/thumbnailCopyResearch"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<ThumbnailCopyCombosRequest> & {
      geminiApiKey?: string
    }

    const geminiKey = resolveGeminiKey(
      body.geminiApiKey ||
        req.headers.get("x-gemini-api-key") ||
        req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""),
    )
    if (!geminiKey) {
      return NextResponse.json(
        { success: false, error: "Gemini API 키가 필요합니다. 설정 → API 키에서 저장하세요." },
        { status: 400 },
      )
    }

    const slotSpec = body.slotSpec as ThumbnailCopyComboSlotSpec | undefined
    if (!slotSpec?.line1Key || !slotSpec?.line2Key) {
      return NextResponse.json(
        { success: false, error: "슬롯 스펙(slotSpec)이 필요합니다." },
        { status: 400 },
      )
    }

    const topic = String(body.topic || "").trim()
    const scriptExcerpt = String(body.scriptExcerpt || "").trim()
    if (!topic && !scriptExcerpt) {
      return NextResponse.json(
        { success: false, error: "주제 또는 대본이 필요합니다." },
        { status: 400 },
      )
    }

    const count = Math.min(20, Math.max(8, Number(body.count) || 15))
    const researchItems = Array.isArray(body.researchItems)
      ? (body.researchItems as ThumbnailCopyResearchItem[])
      : []

    const payload: ThumbnailCopyCombosRequest = {
      templateId: String(body.templateId || "studio"),
      topic: topic || scriptExcerpt.slice(0, 80),
      scriptExcerpt: scriptExcerpt || topic,
      videoTitle: body.videoTitle?.trim() || undefined,
      outputLanguage: body.outputLanguage,
      slotSpec,
      researchItems,
      count,
    }

    const prompt = `${buildThumbnailCopyCombosSystemPrompt(payload.outputLanguage)}\n\n---\n\n${buildThumbnailCopyCombosUserPrompt(payload)}`
    let raw = await geminiChatText(geminiKey, prompt, { temperature: 0.9 })
    let combos = parseThumbnailCopyCombosJson(raw, slotSpec, count)

    if (combos.length < Math.min(6, count)) {
      raw = await geminiChatText(
        geminiKey,
        `${prompt}\n\n⚠️ combos가 부족합니다. 정확히 ${count}개 JSON만 다시 출력하세요.`,
        { temperature: 0.85 },
      )
      const retry = parseThumbnailCopyCombosJson(raw, slotSpec, count)
      if (retry.length > combos.length) combos = retry
    }

    if (!combos.length) {
      return NextResponse.json(
        { success: false, error: "2줄 카피 조합을 파싱하지 못했습니다. 다시 시도해 주세요." },
        { status: 502 },
      )
    }

    return NextResponse.json({ success: true, combos })
  } catch (e) {
    const message = e instanceof Error ? e.message : "카피 조합 생성 실패"
    console.error("[longform-v2/thumbnail-copy-combos]", message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
