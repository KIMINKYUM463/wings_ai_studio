import { NextResponse } from "next/server"
import { geminiChatText, resolveGeminiKey } from "@/lib/longform-v2/gemini"
import type { ThumbnailCopyResearchItem } from "@/lib/longform-v2/youtube/thumbnailCopyResearch"
import {
  buildThumbnailSubCopiesSystemPrompt,
  buildThumbnailSubCopiesUserPrompt,
  parseThumbnailSubCopiesJson,
  type ThumbnailSubCopiesRequest,
  type ThumbnailSubCopySlotSpec,
} from "@/lib/longform-v2/youtube/thumbnailSubCopy"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<ThumbnailSubCopiesRequest> & {
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

    const slotSpec = body.slotSpec as ThumbnailSubCopySlotSpec | undefined
    if (!slotSpec?.subKey) {
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

    const count = Math.min(12, Math.max(6, Number(body.count) || 10))
    const researchItems = Array.isArray(body.researchItems)
      ? (body.researchItems as ThumbnailCopyResearchItem[])
      : []

    const payload: ThumbnailSubCopiesRequest = {
      templateId: String(body.templateId || "studio"),
      topic: topic || scriptExcerpt.slice(0, 80),
      scriptExcerpt: scriptExcerpt || topic,
      videoTitle: body.videoTitle?.trim() || undefined,
      outputLanguage: body.outputLanguage,
      slotSpec,
      researchItems,
      count,
    }

    const prompt = `${buildThumbnailSubCopiesSystemPrompt(payload.outputLanguage)}\n\n---\n\n${buildThumbnailSubCopiesUserPrompt(payload)}`
    let raw = await geminiChatText(geminiKey, prompt, { temperature: 0.9 })
    let subCopies = parseThumbnailSubCopiesJson(raw, slotSpec, count)

    if (subCopies.length < Math.min(4, count)) {
      raw = await geminiChatText(
        geminiKey,
        `${prompt}\n\n⚠️ subCopies가 부족합니다. 정확히 ${count}개 JSON만 다시 출력하세요.`,
        { temperature: 0.85 },
      )
      const retry = parseThumbnailSubCopiesJson(raw, slotSpec, count)
      if (retry.length > subCopies.length) subCopies = retry
    }

    if (!subCopies.length) {
      return NextResponse.json(
        { success: false, error: "서브카피를 파싱하지 못했습니다. 다시 시도해 주세요." },
        { status: 502 },
      )
    }

    return NextResponse.json({ success: true, subCopies })
  } catch (e) {
    const message = e instanceof Error ? e.message : "서브카피 생성 실패"
    console.error("[longform-v2/thumbnail-sub-copies]", message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
