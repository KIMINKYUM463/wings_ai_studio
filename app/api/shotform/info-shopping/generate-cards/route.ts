import { NextRequest, NextResponse } from "next/server"
import { SHOTFORM_COPY_MODEL } from "@/lib/shotform-ai-models"

export const runtime = "nodejs"
export const maxDuration = 180

type GenerateBody = {
  apiKey?: string
  productName?: string
  productDescription?: string
  productPrice?: number
  productImage?: string
  sourceTitle?: string
  sourceSummary?: string
  tipAngle?: string
  channelHandle?: string
  themeId?: string
  targetDurationSec?: number
  useAiImages?: boolean
}

type ParsedCards = {
  hook?: string
  title?: string
  slides?: Array<Record<string, unknown>>
}

type CardLine = { text: string; highlights: string[] }

const ALLOWED_TYPES = new Set(["cover", "pain", "tip", "review", "product", "cta"])
/** 연결형 본문 3줄 이상이 필요한 카드 */
const MULTI_LINE_TYPES = new Set(["cover", "pain", "tip", "review"])
const MAX_ATTEMPTS = 3

const DEFAULT_BADGE: Record<string, string> = {
  cover: "문제",
  pain: "공감",
  tip: "해결",
  review: "후기",
  product: "제품",
  cta: "CTA",
}

/** 문제제기 → 해결 고정 아크 (처음부터 제품 노출 금지) */
function expectedArc(slideCount: number): string[] {
  if (slideCount <= 5) return ["cover", "pain", "tip", "review", "cta"]
  if (slideCount === 6) return ["cover", "pain", "tip", "review", "product", "cta"]
  return ["cover", "pain", "tip", "review", "tip", "product", "cta"]
}

function stripLineNumber(raw: string): string {
  return raw
    .replace(/^[0-9０-９❶❷❸❹❺①②③④⑤]+[.、.)）:\s]+/u, "")
    .replace(/^[0-9０-９]+번[.、.\s]*/u, "")
    .trim()
}

function normalizeLines(raw: unknown): CardLine[] {
  const items = Array.isArray(raw) ? raw : []
  return items
    .map((line) => {
      if (typeof line === "string") return { text: stripLineNumber(line), highlights: [] }
      const obj = line as { text?: string; highlights?: unknown }
      return {
        text: stripLineNumber(String(obj.text || "")),
        highlights: Array.isArray(obj.highlights)
          ? obj.highlights.map((h) => String(h)).filter(Boolean).slice(0, 4)
          : [],
      }
    })
    .filter((line) => line.text)
    .slice(0, 5)
}

/** TTS는 본문만 — 번호·훅·제목 제외, 연결어미는 마침표 없이 */
function buildNarration(lines: CardLine[]): string {
  return lines
    .map((line, i) => {
      const clean = line.text
      const isLast = i === lines.length - 1
      if (!isLast && /(?:는데|한데|하고|지만|며|서|고)$/.test(clean)) return clean
      if (isLast) return /[.。?？!！]$/.test(clean) ? clean : `${clean}.`
      return /[.。?？!！]$/.test(clean) ? clean.replace(/[.。]$/, ",") : `${clean},`
    })
    .join(" ")
}

function normalizeSlides(parsed: ParsedCards, arc: string[]) {
  const slideCount = arc.length
  return (Array.isArray(parsed.slides) ? parsed.slides : [])
    .slice(0, slideCount)
    .map((slide, index) => {
      // 아크 강제: LLM이 순서를 틀려도 문제→해결 구조 유지
      const forcedType = arc[index] || (index === slideCount - 1 ? "cta" : "tip")
      const rawType = String(slide.type || "")
      const type = ALLOWED_TYPES.has(forcedType)
        ? forcedType
        : ALLOWED_TYPES.has(rawType)
          ? rawType
          : forcedType
      const lines = normalizeLines(slide.lines)
      const title = String(slide.title || "").trim() || `${index + 1}번 카드`
      const hook = String(slide.hook || "").trim()

      // 대본 생성 직후에는 이미지 비움 — 이미지 단계에서 사용자가 채움
      return {
        id: `slide-${index + 1}`,
        order: index + 1,
        type,
        badge: String(slide.badge || "").trim() || DEFAULT_BADGE[type],
        // 스티커 훅이 큰 제목과 같으면 화면에 같은 문장이 두 번 보이므로 생략
        hook: hook && hook !== title ? hook : undefined,
        title,
        lines,
        narration: String(slide.narration || "").trim() || buildNarration(lines),
        durationSec: Math.max(
          3,
          Math.min(12, Number(slide.durationSec) || (lines.length >= 3 ? 6 : 5))
        ),
        imagePrompt: String(slide.imagePrompt || "").trim() || undefined,
        imageUrl: undefined,
        imageSource: undefined,
      }
    })
}

type NormalizedSlide = ReturnType<typeof normalizeSlides>[number]

/** 부족한 점 목록 — 비어 있으면 통과 */
function findSlideProblems(slides: NormalizedSlide[], slideCount: number): string[] {
  const problems: string[] = []
  if (slides.length < slideCount) problems.push(`카드 ${slides.length}/${slideCount}장`)
  for (const slide of slides) {
    if (MULTI_LINE_TYPES.has(slide.type) && slide.lines.length < 3) {
      problems.push(`${slide.order}번 카드 본문 ${slide.lines.length}줄`)
    }
  }
  return problems
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateBody
    const apiKey =
      String(body.apiKey || "").trim() ||
      process.env.OPENAI_API_KEY ||
      process.env.GPT_API_KEY ||
      process.env.CHATGPT_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API 키가 필요합니다." }, { status: 400 })
    }

    const productName = String(body.productName || "").trim()
    if (!productName) {
      return NextResponse.json({ error: "제품명이 필요합니다." }, { status: 400 })
    }

    const targetDurationSec = Math.max(
      15,
      Math.min(60, Number(body.targetDurationSec) || 30)
    )
    const slideCount = targetDurationSec <= 20 ? 5 : targetDurationSec <= 35 ? 6 : 7
    const arc = expectedArc(slideCount)
    const channelHandle = String(body.channelHandle || "@shopping.tips").trim() || "@shopping.tips"
    const themeId = [
      "gray",
      "blue",
      "news",
      "mint",
      "coral",
      "cream",
      "charcoal",
      "rose",
      "lime",
    ].includes(String(body.themeId))
      ? String(body.themeId)
      : "news"

    const prompt = [
      `제품명: ${productName}`,
      `제품 설명: ${String(body.productDescription || "").slice(0, 1200) || "없음"}`,
      `가격: ${body.productPrice ? `${body.productPrice.toLocaleString()}원` : "미상"}`,
      `레퍼런스 제목: ${String(body.sourceTitle || "").slice(0, 200) || "없음"}`,
      `레퍼런스 요약: ${String(body.sourceSummary || "").slice(0, 800) || "없음"}`,
      `꿀팁 각도: ${String(body.tipAngle || "실사용 후기 + 구매 팁")}`,
      `채널 핸들: ${channelHandle}`,
      `목표 길이: ${targetDurationSec}초`,
      `슬라이드 수: ${slideCount}`,
      `필수 전개 순서(타입): ${arc.join(" → ")}`,
    ].join("\n")

    const systemPrompt = [
      "당신은 한국어 쇼핑 정보성 숏폼·카드뉴스 작가입니다.",
      "핵심 전개: 문제제기 → 공감 → 해결(제품) → 효과/후기 → CTA. 절대 처음부터 제품을 들이밀지 마세요.",
      "",
      "【1~2장: 문제 구간】type=cover, pain",
      "- 일상 불편·고민만. 제품명·브랜드·구매 유도 금지.",
      "- cover: 공감 훅 + 상황 제목. badge=문제 or 공감",
      "- pain: 구체적 불편 3~4개(번호). badge=공감 or BEFORE",
      "- 제목 패턴: '[공간·상황]이 늘 [불편]한 이유', '[귀찮은 일] 할 때마다 [불만]이죠?'",
      "",
      "【3장~: 해결 구간】type=tip 부터 제품 등장",
      "- tip: '그래서 이렇게 해결했어요' + 제품으로 해결되는 포인트 3~4개. badge=해결 or HOW TO",
      "- review: 실사용 효과·체감. badge=후기 or AFTER",
      "- product: 스펙·고르는 팁(있을 때만). badge=제품",
      "- cta: 한 줄 추천 + 행동. badge=CTA",
      "",
      `슬라이드 타입 순서는 반드시: ${arc.join(" → ")}`,
      "톤: 친근한 실사용 리뷰어. 과장 광고·의료 효능 단정 금지.",
      "【lines 작성법 — 매우 중요】",
      "- 텍스트 앞에 '1.' '2.' 같은 번호를 절대 넣지 마세요. 화면 원형 뱃지가 번호를 담당합니다.",
      "- 나열·설명체가 아니라, 말하듯 연결되는 후킹 문장으로 쓰세요.",
      "- 중간 줄은 ~는데 / ~고 / ~하고 로 끝내서 다음 줄과 이어지게.",
      "- 마지막 줄만 ~요 / ~죠 로 맺기.",
      "- 나쁜 예: 딱딱한 단문 나열 ('~해요' '~해요' '~해요')",
      "- 문제 패턴: '[상황]인데' → '[구체 불편]하고' → '[불편이 커지는 결과]하고' → '[감정]해요'",
      "- 해결 패턴: '[이 제품의 실제 특징]이라서' → '[그 덕분에 바뀐 점]하고' → '[생활 변화]하고' → '[만족]해요'",
      "- 위 대괄호는 형식일 뿐입니다. 모든 문장은 이 제품·이 상황에 맞게 새로 쓰세요.",
      "【사실성 — 매우 중요】",
      "- 해결·후기·제품 카드의 특징은 제품명·제품 설명에 실제로 적힌 것만 쓰세요.",
      "- 적혀 있지 않은 소재·수치·인증·효능·부착 방식(자석·흡착 등)을 지어내면 실패입니다.",
      "lines: cover·pain·tip·review는 연결형 3~4개(각 12~22자). product·cta는 1~3개.",
      "narration은 TTS용: lines를 공백으로 이어 붙인 구어체. 번호·훅·제목 금지.",
      "hook는 스티커형 한 줄(화면만, TTS 없음), title은 카드 큰 제목(화면만, TTS 없음). hook과 title은 서로 다른 문장으로.",
      "imagePrompt는 영어, vertical 9:16, no text no logos.",
      "cover/pain imagePrompt: lifestyle problem scene WITHOUT any product (messy shelf, cramped bathroom, frustration).",
      "tip/review/product/cta imagePrompt: product visible, commercial photography, natural light, sharp detail.",
      `JSON 형식:
{
  "hook": "전체 훅(문제 공감, 제품명 없이)",
  "title": "영상 제목",
  "slides": [
    {
      "type": "cover|pain|tip|review|product|cta",
      "badge": "문제|공감|해결|후기|제품|CTA",
      "hook": "스티커형 짧은 훅",
      "title": "카드 큰 제목",
      "lines": [{"text":"표시 문장","highlights":["강조어"]}],
      "narration": "TTS 구어체",
      "durationSec": 5,
      "imagePrompt": "english visual prompt"
    }
  ]
}`,
      `slides 배열 길이는 정확히 ${slideCount}개이며 type 순서는 ${arc.join(", ")}.`,
    ].join("\n")

    const requestCards = async (): Promise<ParsedCards> => {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: SHOTFORM_COPY_MODEL,
          temperature: 0.65,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
        }),
      })
      if (!response.ok) {
        const detail = await response.text().catch(() => "")
        throw new Error(`카드 생성 실패 (${response.status}): ${detail.slice(0, 200)}`)
      }
      const data = await response.json()
      return JSON.parse(String(data.choices?.[0]?.message?.content || "{}")) as ParsedCards
    }

    // 본문이 모자란 카드가 있으면 다시 생성 — 다른 제품 문구로 채우지 않음
    let best: { parsed: ParsedCards; slides: NormalizedSlide[]; problems: string[] } | null = null
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const parsed = await requestCards()
      const slides = normalizeSlides(parsed, arc)
      const problems = findSlideProblems(slides, slideCount)
      if (!best || problems.length < best.problems.length) best = { parsed, slides, problems }
      if (problems.length === 0) break
    }

    if (!best || best.slides.length < 3) {
      throw new Error("생성된 카드가 너무 적습니다. 다시 시도해주세요.")
    }
    const { parsed, slides } = best

    return NextResponse.json({
      success: true,
      cards: {
        themeId,
        targetDurationSec,
        hook: String(parsed.hook || slides[0]?.hook || slides[0]?.title || "").trim(),
        title: String(parsed.title || `${productName} 꿀팁`).trim(),
        slides,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "카드 생성 실패" },
      { status: 500 }
    )
  }
}
