import { NextResponse } from "next/server"
import { sanitizeThumbnailImagePromptEn } from "@/lib/longform-v2/youtube/thumbnailBackgroundImagePrompt"
import { THUMBNAIL_SCRIPT_LITERAL_VISUAL_BLOCK_EN } from "@/lib/longform-v2/youtube/thumbnailScriptLiteralVisual"

export const runtime = "nodejs"
export const maxDuration = 180

/**
 * WingsStudio 썸네일 배경 이미지 생성 (Replicate) — 텍스트 없는 배경
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const replicateApiKey = String(body.replicateApiKey || process.env.REPLICATE_API_TOKEN || "").trim()
    if (!replicateApiKey) {
      return NextResponse.json(
        { success: false, error: "Replicate API 키가 필요합니다." },
        { status: 400 }
      )
    }

    let promptEn = sanitizeThumbnailImagePromptEn(String(body.imagePromptEn || body.prompt || ""))
    if (!promptEn) {
      return NextResponse.json(
        { success: false, error: "이미지 프롬프트가 비어 있습니다." },
        { status: 400 }
      )
    }

    const title = String(body.videoTitle || "").trim()
    const topic = String(body.topic || "").trim()

    let prompt =
      "NO TEXT OR LETTERS ANYWHERE. NO HANGUL. NO KOREAN CHARACTERS ON IMAGE. " +
      "YouTube thumbnail background 1280x720, dramatic lighting, high contrast, single clear focal subject. " +
      promptEn +
      `\n${THUMBNAIL_SCRIPT_LITERAL_VISUAL_BLOCK_EN}`

    if (title) prompt += `\nVideo title context: ${title}`
    if (topic) prompt += `\nTopic: ${topic}`
    if (!prompt.toLowerCase().includes("no text")) {
      prompt += "\nno text, no letters, no words, no logo, no watermark"
    }

    const res = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${replicateApiKey}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({
        // nano-banana-pro 계열 — WingsStudio 기본과 동일 계열. 없으면 flux 폴백은 호출부에서
        version: "black-forest-labs/flux-schnell",
        input: {
          prompt,
          aspect_ratio: "16:9",
          output_format: "jpg",
          output_quality: 90,
        },
      }),
    })

    // Prefer: wait may not work on all versions — poll if needed
    let data = await res.json().catch(() => ({}))
    if (!res.ok) {
      // try models API style
      const res2 = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions", {
        method: "POST",
        headers: {
          Authorization: `Token ${replicateApiKey}`,
          "Content-Type": "application/json",
          Prefer: "wait",
        },
        body: JSON.stringify({
          input: {
            prompt,
            aspect_ratio: "16:9",
            output_format: "jpg",
          },
        }),
      })
      data = await res2.json().catch(() => ({}))
      if (!res2.ok) {
        throw new Error(data?.detail || data?.error || `Replicate 오류 (${res2.status})`)
      }
    }

    // Poll if processing
    let prediction = data
    const getUrl = prediction?.urls?.get
    let guard = 0
    while (
      prediction?.status &&
      prediction.status !== "succeeded" &&
      prediction.status !== "failed" &&
      prediction.status !== "canceled" &&
      getUrl &&
      guard < 60
    ) {
      await new Promise((r) => setTimeout(r, 2000))
      const poll = await fetch(getUrl, {
        headers: { Authorization: `Token ${replicateApiKey}`, Accept: "application/json" },
      })
      prediction = await poll.json()
      guard++
    }

    if (prediction?.status === "failed") {
      throw new Error(prediction?.error || "이미지 생성 실패")
    }

    const out = prediction?.output
    const imageUrl = Array.isArray(out) ? String(out[0] || "") : typeof out === "string" ? out : ""
    if (!imageUrl) {
      throw new Error("이미지 URL이 없습니다.")
    }

    // 브라우저 CORS 없이 바로 쓰도록 서버에서 data URL로 변환
    let imageDataUrl = ""
    let base64 = ""
    let mimeType = "image/jpeg"
    try {
      const imgRes = await fetch(imageUrl)
      if (imgRes.ok) {
        const buf = Buffer.from(await imgRes.arrayBuffer())
        const ct = imgRes.headers.get("content-type") || "image/jpeg"
        mimeType = ct.startsWith("image/") ? ct : "image/jpeg"
        base64 = buf.toString("base64")
        imageDataUrl = `data:${mimeType};base64,${base64}`
      }
    } catch {
      /* URL만 반환 — 클라이언트가 재시도 */
    }

    return NextResponse.json({
      success: true,
      imageUrl,
      imageDataUrl: imageDataUrl || undefined,
      base64: base64 || undefined,
      mimeType,
      prompt,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "썸네일 이미지 생성 실패"
    console.error("[longform-v2/thumbnail-image]", message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
