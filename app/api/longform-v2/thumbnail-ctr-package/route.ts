import { NextResponse } from "next/server"
import { geminiChatText, resolveGeminiKey } from "@/lib/longform-v2/gemini"
import {
  buildYoutubeCtrThumbnailPackageSystemKo,
  buildYoutubeCtrThumbnailPackageUserKo,
  parseCtrThumbnailPackageJson,
  YOUTUBE_CTR_THUMBNAIL_SCRIPT_MAX_CHARS,
} from "@/lib/longform-v2/youtube/youtubeCtrThumbnailPackageKo"

export const runtime = "nodejs"
export const maxDuration = 120

/**
 * WingsStudio CTR 썸네일 패키지 (메인 2줄·서브·이미지 프롬프트) 생성
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

    const script = String(body.script || body.scriptExcerpt || "").trim()
    if (!script) {
      return NextResponse.json(
        { success: false, error: "대본이 비어 있습니다." },
        { status: 400 }
      )
    }

    const count = Math.min(10, Math.max(6, Number(body.count) || 8))
    const scriptSlice =
      script.length > YOUTUBE_CTR_THUMBNAIL_SCRIPT_MAX_CHARS
        ? `${script.slice(0, YOUTUBE_CTR_THUMBNAIL_SCRIPT_MAX_CHARS)}…`
        : script

    const payload = {
      scriptExcerpt: scriptSlice,
      videoTitle: String(body.videoTitle || body.title || "").trim() || undefined,
      topic: String(body.topic || "").trim() || undefined,
      count,
    }

    const combined = `${buildYoutubeCtrThumbnailPackageSystemKo()}\n\n---\n\n${buildYoutubeCtrThumbnailPackageUserKo(payload)}`
    let raw = await geminiChatText(geminiKey, combined, { temperature: 0.92 })
    let options = parseCtrThumbnailPackageJson(raw, count)

    if (options.length < Math.min(4, count)) {
      raw = await geminiChatText(
        geminiKey,
        `${combined}\n\n⚠️ options가 부족합니다. mainLine2에 ~한다·~됩니다 금지. 정확히 ${count}개 JSON만.`,
        { temperature: 0.85 }
      )
      const retry = parseCtrThumbnailPackageJson(raw, count)
      if (retry.length > options.length) options = retry
    }

    if (!options.length) {
      return NextResponse.json(
        { success: false, error: "CTR 패키지를 파싱하지 못했습니다. 다시 시도해 주세요." },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true, options })
  } catch (e) {
    const message = e instanceof Error ? e.message : "CTR 패키지 생성 실패"
    console.error("[longform-v2/thumbnail-ctr-package]", message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
