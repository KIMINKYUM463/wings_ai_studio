import { type NextRequest, NextResponse } from "next/server"
import {
  applyPlatformOutputsToMeta,
  normalizePlatformOutputsFromAi,
  syncFlatFromPlatformOutputs,
} from "@/lib/mvp-studio-seo-platforms"
import { buildMvpSeoSystemPrompt, buildMvpSeoUserPrompt } from "@/lib/mvp-studio-seo-prompts"
import type { MvpSeoPlatformOutputs } from "@/lib/mvp-studio-types"
import { emptyMvpStudioSeoMeta } from "@/lib/mvp-studio-seo"

type SeoRequestBody = {
  apiKey?: string
  productName?: string
  referenceTitles?: string[]
  script?: string
  videoDurationSec?: number
}

type SeoAiPayload = {
  platformOutputs?: Partial<MvpSeoPlatformOutputs>
  /** 구 단일 포맷 폴백 */
  title?: string
  recommendedTitles?: string[]
  description?: string
  tags?: string[]
  hashtags?: string[]
  hookShort?: string
  commentCue?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SeoRequestBody
    const apiKey =
      (typeof body.apiKey === "string" ? body.apiKey.trim() : "") ||
      process.env.GPT_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.CHATGPT_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API 키가 필요합니다." }, { status: 400 })
    }

    const productName = (body.productName || "쇼핑 숏폼 제품").trim()
    const script = (body.script || "").trim()
    const referenceTitles = Array.isArray(body.referenceTitles)
      ? body.referenceTitles.filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      : []
    const videoDurationSec =
      typeof body.videoDurationSec === "number" && body.videoDurationSec > 0 ? body.videoDurationSec : 30

    if (!script) {
      return NextResponse.json({ error: "나레이션 대본이 없습니다. 3단계 스크립트를 확인해 주세요." }, { status: 400 })
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.85,
        max_tokens: 4500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildMvpSeoSystemPrompt() },
          {
            role: "user",
            content: buildMvpSeoUserPrompt({
              productName,
              videoDurationSec,
              script,
              referenceTitles,
            }),
          },
        ],
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => "")
      return NextResponse.json(
        { error: `OpenAI API 오류 (${response.status})${errText ? `: ${errText.slice(0, 200)}` : ""}` },
        { status: 502 }
      )
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: "AI 응답이 비어 있습니다." }, { status: 502 })
    }

    const parsed = JSON.parse(content) as SeoAiPayload

    let rawOutputs: Partial<MvpSeoPlatformOutputs> | undefined = parsed.platformOutputs
    if (!rawOutputs?.common && (parsed.title || parsed.description)) {
      rawOutputs = {
        common: {
          title: parsed.title || "",
          description: parsed.description || "",
          tags: parsed.tags || [],
          hashtags: parsed.hashtags || [],
          hookShort: parsed.hookShort || "",
          commentCue: parsed.commentCue || "",
        },
        youtube: {
          title: parsed.title || "",
          description: parsed.description || "",
          tags: parsed.tags || [],
          hashtags: parsed.hashtags || [],
          recommendedTitles: parsed.recommendedTitles || [],
          pinnedComment: "",
        },
      }
    }

    const platformOutputs = normalizePlatformOutputsFromAi(rawOutputs, productName)
    const flat = syncFlatFromPlatformOutputs(platformOutputs)
    const meta = applyPlatformOutputsToMeta(emptyMvpStudioSeoMeta(), platformOutputs)

    return NextResponse.json({
      ...flat,
      recommendedTitles: meta.recommendedTitles ?? platformOutputs.youtube.recommendedTitles,
      platformOutputs,
    })
  } catch (e) {
    console.error("[shotform-factory-seo]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "SEO 생성에 실패했습니다." },
      { status: 500 }
    )
  }
}
