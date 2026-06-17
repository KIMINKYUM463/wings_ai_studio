import { type NextRequest, NextResponse } from "next/server"
import {
  deriveHashtagsFromTags,
  mergeHashtagsIntoDescription,
} from "@/lib/mvp-studio-seo"

type SeoRequestBody = {
  apiKey?: string
  productName?: string
  referenceTitles?: string[]
  script?: string
  videoDurationSec?: number
}

type SeoAiPayload = {
  title?: string
  recommendedTitles?: string[]
  description?: string
  tags?: string[]
  hashtags?: string[]
  hookShort?: string
  commentCue?: string
}

function normalizeHashtags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((h) => {
      const s = String(h).trim()
      if (!s) return ""
      return s.startsWith("#") ? s : `#${s}`
    })
    .filter(Boolean)
    .slice(0, 12)
}

function normalizeTags(raw: unknown, productName: string): string[] {
  if (Array.isArray(raw)) {
    return raw.map((t) => String(t).trim()).filter(Boolean).slice(0, 20)
  }
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20)
  }
  return [productName, "쇼핑", "숏폼", "리뷰"]
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

    const refBlock =
      referenceTitles.length > 0
        ? `레퍼런스·관련 영상 제목:\n${referenceTitles.slice(0, 8).map((t) => `- ${t}`).join("\n")}`
        : ""

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.85,
        max_tokens: 2200,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `당신은 한국 쇼핑·제품 홍보 유튜브 숏폼 SEO 전문가입니다.
제품과 나레이션 대본을 분석해 유튜브 업로드용 메타데이터를 JSON으로만 작성하세요.

규칙:
- 모든 문장은 자연스러운 한국어
- 제목(title): 100자 이내, 클릭을 유도하되 과장·클릭베이트 남용 금지
- recommendedTitles: 서로 다른 스타일의 대안 제목 5개 (각 100자 이내)
- description: 400~800자, 제품 특징·사용 상황·구매 유도, 이모지 2~4개 허용 (해시태그 줄은 넣지 마세요 — 앱에서 태그로부터 자동 추가)
- tags: 유튜브 업로드용 태그 15~20개 (# 없이, 쉼표 구분 개념)
- hookShort: 15자 내외 짧은 후킹 멘트 (CTA 앞에 붙는 문구)
- commentCue: 댓글 유도용 짧은 키워드 1~3단어 (예: 꿀템, 링크)

JSON 형식:
{
  "title": "...",
  "recommendedTitles": ["...", "...", "...", "...", "..."],
  "description": "...",
  "tags": ["..."],
  "hookShort": "...",
  "commentCue": "..."
}`,
          },
          {
            role: "user",
            content: `제품명(추정): ${productName}
영상 길이: 약 ${Math.max(1, Math.round(videoDurationSec))}초
${refBlock ? `${refBlock}\n` : ""}
나레이션 대본:
${script.slice(0, 3500)}

위 제품·대본에 맞는 유튜브 숏폼 SEO 메타데이터를 작성해 주세요.`,
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
    const title = (parsed.title || `${productName} 리뷰`).trim().slice(0, 100)
    const recommendedTitles = (Array.isArray(parsed.recommendedTitles) ? parsed.recommendedTitles : [])
      .map((t) => String(t).trim())
      .filter(Boolean)
      .slice(0, 5)

    const tags = normalizeTags(parsed.tags, productName)
    const hashtags =
      normalizeHashtags(parsed.hashtags).length > 0
        ? normalizeHashtags(parsed.hashtags)
        : deriveHashtagsFromTags(tags, 8)
    const description = mergeHashtagsIntoDescription(
      (parsed.description || script).trim(),
      hashtags
    )

    return NextResponse.json({
      title,
      recommendedTitles:
        recommendedTitles.length >= 3
          ? recommendedTitles
          : [title, `${productName} 솔직 리뷰`, `${productName} 꿀템 추천`].slice(0, 5),
      description,
      tags,
      hashtags,
      hookShort: (parsed.hookShort || `${productName}, 이거 실화?`).trim().slice(0, 30),
      commentCue: (parsed.commentCue || "꿀템").trim().slice(0, 20),
    })
  } catch (e) {
    console.error("[shotform-factory-seo]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "SEO 생성에 실패했습니다." },
      { status: 500 }
    )
  }
}
