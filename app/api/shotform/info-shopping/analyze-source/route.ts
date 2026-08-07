import { NextRequest, NextResponse } from "next/server"
import { fetchProductPageMeta } from "@/lib/shotform-mvp-xhs-test"

export const runtime = "nodejs"
export const maxDuration = 120

function extractYoutubeId(raw: string): string | null {
  try {
    const url = new URL(raw.trim())
    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.replace("/", "").trim()
      return id || null
    }
    if (url.hostname.includes("youtube.com")) {
      const v = url.searchParams.get("v")
      if (v) return v
      const shorts = url.pathname.match(/\/shorts\/([^/?]+)/)
      if (shorts?.[1]) return shorts[1]
      const embed = url.pathname.match(/\/embed\/([^/?]+)/)
      if (embed?.[1]) return embed[1]
    }
  } catch {
    // ignore
  }
  return null
}

async function fetchYoutubeOembed(url: string): Promise<{ title: string; description: string; thumbnailUrl: string }> {
  try {
    const oembed = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { signal: AbortSignal.timeout(10_000) }
    )
    if (!oembed.ok) return { title: "", description: "", thumbnailUrl: "" }
    const data = (await oembed.json()) as { title?: string; thumbnail_url?: string; author_name?: string }
    return {
      title: String(data.title || "").trim(),
      description: data.author_name ? `채널: ${data.author_name}` : "",
      thumbnailUrl: String(data.thumbnail_url || "").trim(),
    }
  } catch {
    return { title: "", description: "", thumbnailUrl: "" }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      url?: string
      apiKey?: string
    }
    const url = String(body.url || "").trim()
    if (!url || !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: "유효한 URL이 필요합니다." }, { status: 400 })
    }

    const apiKey =
      String(body.apiKey || "").trim() ||
      process.env.OPENAI_API_KEY ||
      process.env.GPT_API_KEY ||
      process.env.CHATGPT_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API 키가 필요합니다." }, { status: 503 })
    }

    const videoId = extractYoutubeId(url)
    let title = ""
    let description = ""
    let thumbnailUrl = ""
    let transcript = ""
    const sourceType = videoId ? "youtube" : "web"

    if (videoId) {
      const meta = await fetchYoutubeOembed(url)
      title = meta.title
      description = meta.description
      thumbnailUrl = meta.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`

      try {
        const { fetchYoutubeTranscript } = await import("@/lib/youtube-transcript")
        transcript = (await fetchYoutubeTranscript(videoId)).slice(0, 8000)
      } catch {
        // 자막 없어도 계속
      }
    } else {
      const page = await fetchProductPageMeta(url)
      title = page.title
      description = page.description
    }

    if (!title) {
      return NextResponse.json(
        { error: "페이지 제목을 가져오지 못했습니다. URL을 확인해주세요." },
        { status: 422 }
      )
    }

    const evidenceText = [
      `소스 유형: ${sourceType}`,
      `URL: ${url}`,
      `제목: ${title}`,
      `설명: ${description.slice(0, 3000) || "없음"}`,
      `자막/본문: ${transcript.slice(0, 6000) || "없음"}`,
    ].join("\n\n")

    const userContent: Array<Record<string, unknown>> = [{ type: "text", text: evidenceText }]
    if (/^https?:\/\//i.test(thumbnailUrl)) {
      userContent.push({
        type: "image_url",
        image_url: { url: thumbnailUrl, detail: "high" },
      })
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "당신은 쇼핑 꿀팁·리뷰 숏폼을 위한 상품 기획 분석가입니다.",
              "벤치마크 URL(유튜브/웹)에서 소개·리뷰·추천할 만한 쿠팡 검색용 상품을 찾습니다.",
              "뉴스·정책만 있고 상품이 없으면, 주제와 자연스럽게 연결되는 실생활 쇼핑 상품 카테고리로 검색어를 제안하세요.",
              "지어낸 브랜드/모델은 쓰지 마세요. 일반 상품명이면 충분합니다.",
              'JSON만 반환: {"productName":"","searchKeyword":"","productDescription":"","confidence":0-100,"evidence":["근거"],"analysisSummary":"","tipAngle":"리뷰·꿀팁 각도 한 줄"}',
            ].join("\n"),
          },
          { role: "user", content: userContent },
        ],
      }),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => "")
      throw new Error(`OpenAI 분석 실패 (${response.status}): ${detail.slice(0, 200)}`)
    }

    const data = await response.json()
    const raw = String(data.choices?.[0]?.message?.content || "{}")
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const productName = String(parsed.productName || "").trim()
    const searchKeyword = String(parsed.searchKeyword || productName).trim()
    if (!productName || !searchKeyword) {
      throw new Error("소스에서 연결할 상품을 찾지 못했습니다.")
    }

    return NextResponse.json({
      success: true,
      sourceMeta: {
        url,
        sourceType,
        title,
        description,
        thumbnailUrl: thumbnailUrl || undefined,
        videoId: videoId || undefined,
        transcript: transcript ? transcript.slice(0, 2000) : undefined,
      },
      analysis: {
        productName,
        searchKeyword,
        productDescription: String(parsed.productDescription || "").trim(),
        confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 0)),
        evidence: Array.isArray(parsed.evidence)
          ? parsed.evidence.map((item) => String(item)).filter(Boolean).slice(0, 5)
          : [],
        analysisSummary: String(parsed.analysisSummary || "").trim(),
        tipAngle: String(parsed.tipAngle || "").trim(),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "소스 분석 실패" },
      { status: 500 }
    )
  }
}
