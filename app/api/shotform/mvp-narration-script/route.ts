import { type NextRequest, NextResponse } from "next/server"
import type { AutoEditJobResult } from "@/lib/shotform-auto-edit-types"
import { benchmarkScriptFewShotJson } from "@/lib/shotform-benchmark-script"
import {
  buildNaturalShortsNarrationSystemPrompt,
  buildNaturalShortsNarrationUserPrompt,
  ensureNaturalShortsCtaOnLastLine,
  normalizeNaturalShortsExtras,
  parseTopicWithStyleMode,
  sanitizeNarrationForOutput,
} from "@/lib/shotform-natural-shorts-script"
import { rephraseSceneToShoppingNarrationVariant } from "@/lib/shotform-cut-narration"
import { narrationLooksIncomplete } from "@/lib/shotform-narration-timing"
import {
  alignNarrationLinesToCuts,
  buildNarrationCutsPromptBlock,
  limitConnectorsAcrossScript,
  parseNarrationLinesFromAi,
  polishCutNarrationLines,
  stripLeadingNarrationConnector,
  visualGroundingScore,
} from "@/lib/shotform-narration-script-quality"
import { buildCutScriptContexts } from "@/lib/shotform-visual-scene-match"

async function requestNarrationJson(args: {
  apiKey: string
  systemContent: string
  userContent: string
  temperature: number
  maxTokens: number
}): Promise<Record<string, unknown>> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: args.temperature,
      max_tokens: args.maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: args.systemContent },
        { role: "user", content: args.userContent },
      ],
    }),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    throw new Error(`OpenAI 오류 (${res.status}): ${errText.slice(0, 200)}`)
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = json.choices?.[0]?.message?.content
  if (!content) throw new Error("OpenAI 응답이 비어 있습니다.")
  return JSON.parse(content) as Record<string, unknown>
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      openaiApiKey?: string
      result?: AutoEditJobResult
      mode?: "generate" | "rewrite"
      previousScripts?: Record<string, string>
      /** 프로젝트명 — 끝에 " 1"이면 자연스러운 스토리형 모드 */
      projectName?: string
      topic?: string
    }
    const apiKey = body.openaiApiKey?.trim()
    const result = body.result
    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API 키가 필요합니다." }, { status: 400 })
    }
    if (!result?.editPlan?.edit_plan?.length) {
      return NextResponse.json({ error: "짜집기 편집 컷 정보가 없습니다. 먼저 AI 짜집기를 완료하세요." }, { status: 400 })
    }

    const analyses = result.analyses?.length
      ? result.analyses
      : result.analysis
        ? [result.analysis]
        : []

    const cuts = buildCutScriptContexts(result.editPlan, analyses, result.mixInfo)
    if (!cuts.length) {
      return NextResponse.json({ error: "대본을 만들 장면 정보가 없습니다." }, { status: 400 })
    }

    const mode = body.mode === "rewrite" ? "rewrite" : "generate"
    const previousScripts = body.previousScripts ?? {}

    const previousScriptBlock =
      mode === "rewrite" && Object.keys(previousScripts).length
        ? Object.entries(previousScripts)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([idx, text]) => `컷 ${idx}: ${text.replace(/\n/g, " / ")}`)
            .join("\n")
        : ""

    const productName = result.productAnalysis?.productName || "제품"
    const styleSource = body.topic?.trim() || body.projectName?.trim() || productName
    const { topic, naturalShorts } = parseTopicWithStyleMode(styleSource)

    const vs = result.productAnalysis?.videoStructure
    const productContext = [
      `제품명: ${productName}`,
      naturalShorts && topic ? `스토리 주제: ${topic}` : "",
      result.productAnalysis?.category ? `카테고리: ${result.productAnalysis.category}` : "",
      result.productAnalysis?.summary ? `요약: ${result.productAnalysis.summary}` : "",
      vs?.hook ? `후킹 방향: ${vs.hook}` : "",
      vs?.body ? `본문 방향: ${vs.body}` : "",
      vs?.cta ? `마무리/CTA: ${vs.cta}` : "",
      analyses.map((a) => `[${a.video_id}] ${a.title}`).join("\n"),
    ]
      .filter(Boolean)
      .join("\n")

    const cutsBlock = buildNarrationCutsPromptBlock(cuts, naturalShorts)

    const systemContent = naturalShorts
      ? buildNaturalShortsNarrationSystemPrompt({ cutCount: cuts.length, mode })
      : `한국어 쇼핑숏폼 나레이션 작가. JSON만 출력.
${mode === "rewrite" ? "\n**모드: 대본 다시쓰기** — 영상·컷 구성은 그대로, 나레이션 문장만 전면 교체. 이전 대본과 같은 표현·문장 구조 반복 금지.\n" : ""}
참고 예시 — **한 편의 영상처럼 앞뒤가 이어지는 흐름** (줄바꿈 = 자막 한 줄):
${benchmarkScriptFewShotJson()}

필수:
- lines는 **${cuts.length}개 컷이 하나의 대본**으로 자연스럽게 이어져야 함 (독립 문장 나열 금지)
- 스토리 골격: ①문제·후킹 → ②해결책·제품 → ③~N-1 화면별 데모(앞 컷 맥락 이어받기) → ④마무리·구매
- **중국어·치수(cm/mm/m/인치) 사용 금지**
- **그리고/그래서/바로/이어서로 문장 시작 금지** — 접속사 남발 없이 내용으로 이어질 것
- lines[i] = i번째 컷 (\\n = 자막 줄). 완결된 구어체. 장면 설명·중국어 그대로 읽기 금지

JSON: {"lines":["나레이션줄1\\n줄2", ...]} — lines 길이 = ${cuts.length}, **「컷1」번호·라벨 금지** (순수 나레이션만)`

    const userContent = naturalShorts
      ? buildNaturalShortsNarrationUserPrompt({
          topic,
          productName,
          productContext,
          cutsBlock,
          cutCount: cuts.length,
          previousScriptBlock,
          mode,
        })
      : `${productContext}

편집 타임라인 컷 ${cuts.length}개 (영상 블록과 1:1):
${cutsBlock}

${
  mode === "rewrite" && previousScriptBlock
    ? `이전 대본 (참고만 — 문장·표현을 재사용하지 말고 새로 작성):
${previousScriptBlock}

`
    : ""
}스토리 골격: 문제·후킹 → 제품·해결 → 화면별 데모 → 마무리·CTA.
위 ${cuts.length}개 컷이 **한 편의 쇼핑숏폼**처럼 읽히도록 lines 배열을 ${mode === "rewrite" ? "다시" : ""} 작성하세요.`

    const temperature = mode === "rewrite" ? 0.55 : naturalShorts ? 0.45 : 0.35
    const maxTokens = naturalShorts ? 4000 : 3200

    let parsed = await requestNarrationJson({
      apiKey,
      systemContent,
      userContent,
      temperature,
      maxTokens,
    })
    let lines = parseNarrationLinesFromAi(parsed.lines)

    if (lines.length !== cuts.length) {
      try {
        const retryParsed = await requestNarrationJson({
          apiKey,
          systemContent,
          userContent: `${userContent}

**필수 수정**: lines 배열은 **정확히 ${cuts.length}개** 문자열이어야 합니다. (방금 ${lines.length}개 — 오류)
컷 ${cuts.length}개와 1:1로 다시 작성하세요. 빈 문자열·누락 금지. **「컷1」「컷2」 라벨을 대본 안에 쓰지 마세요.**`,
          temperature: Math.min(temperature, 0.35),
          maxTokens,
        })
        const retryLines = parseNarrationLinesFromAi(retryParsed.lines)
        if (retryLines.length) {
          parsed = retryParsed
          lines = retryLines
        }
      } catch {
        /* align으로 보정 */
      }
    }

    lines = alignNarrationLinesToCuts(lines, cuts, productName)

    const polishedRaw = limitConnectorsAcrossScript(
      polishCutNarrationLines(
        lines.map((line) => stripLeadingNarrationConnector(line)),
        cuts.map((c) => ({ visual_card: c.visual_card, duration: c.duration })),
        productName,
        { allowTemplateFallback: false, fitToDuration: false }
      )
    )
    const polished = polishedRaw.map((text, i) => {
      let t = ensureNaturalShortsCtaOnLastLine(
        sanitizeNarrationForOutput(text),
        naturalShorts && i === polishedRaw.length - 1
      )
      if (narrationLooksIncomplete(t.replace(/\n/g, " "))) {
        t = rephraseSceneToShoppingNarrationVariant(
          cuts[i]!.visual_card,
          productName,
          cuts[i]!.duration,
          i + 21
        )
        t = sanitizeNarrationForOutput(t)
      }
      return t
    })

    const overrides: Record<string, string> = {}
    polished.forEach((text, i) => {
      overrides[String(i + 1)] = text
    })

    const extras = naturalShorts ? normalizeNaturalShortsExtras(parsed) : null

    return NextResponse.json({
      overrides,
      lines: polished,
      naturalShorts,
      topic: naturalShorts ? topic : undefined,
      scriptExtras: extras,
      quality: polished.map((text, i) => ({
        index: i + 1,
        visualGrounding: Math.round(visualGroundingScore(text, cuts[i]!.visual_card) * 100),
      })),
      cuts: cuts.map((c) => ({
        index: c.index,
        output_start: c.output_start,
        output_end: c.output_end,
        visual_card: c.visual_card,
      })),
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "대본 생성 실패" },
      { status: 500 }
    )
  }
}
