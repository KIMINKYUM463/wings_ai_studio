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
import { sanitizeProductNameForNarration } from "@/lib/shotform-cut-narration"
import { narrationLooksIncomplete } from "@/lib/shotform-narration-timing"
import {
  alignNarrationLinesToCuts,
  buildNarrationCutsPromptBlock,
  ensureRewriteDiffersFromPrevious,
  limitConnectorsAcrossScript,
  parseNarrationLinesFromAi,
  polishCutNarrationLines,
  stripLeadingNarrationConnector,
  visualGroundingScore,
} from "@/lib/shotform-narration-script-quality"
import {
  buildCutNarrationSceneMetas,
  buildRepeatedSceneGroupsPrompt,
} from "@/lib/shotform-narration-scene-groups"
import { buildCutScriptContexts } from "@/lib/shotform-visual-scene-match"
import { buildSourceVideosNarrationBlock } from "@/lib/shotform-source-video-narration"
import {
  buildNarrationProductContext,
  normalizeUserSourceKeywords,
  primaryProductLabelFromKeywords,
  resolveNarrationSourceKeywords,
} from "@/lib/shotform-user-keyword-product"
import {
  detectShoppingScriptQualityIssues,
  mitigateProductNameSpam,
  NARRATION_PRODUCT_NAME_USAGE_RULE,
} from "@/lib/shotform-narration-script-audit"
import { auditShoppingScriptWithAi } from "@/lib/shotform-auto-edit-precision-script"
import { formatSceneNarrationLines } from "@/lib/shotform-benchmark-script"

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
      /** 1단계 사용자 키워드 — result에 없을 때 보조 */
      sourceKeywords?: string[]
      /** 다시쓰기 시 클라이언트 nonce — 동일 대본 방지 */
      rewriteNonce?: number
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
    const rewriteSalt =
      mode === "rewrite"
        ? Math.floor((body.rewriteNonce ?? Date.now()) % 9000) + 101
        : 0
    const previousScripts = body.previousScripts ?? {}

    const previousScriptBlock =
      mode === "rewrite" && Object.keys(previousScripts).length
        ? Object.entries(previousScripts)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([idx, text]) => `컷 ${idx}: ${text.replace(/\n/g, " / ")}`)
            .join("\n")
        : ""

    const userKeywords = resolveNarrationSourceKeywords(body.sourceKeywords, result.sourceKeywords)
    const visualBlob = cuts.map((c) => c.visual_card).join("\n")
    const rawProductName = primaryProductLabelFromKeywords(
      userKeywords,
      result.productAnalysis?.productName || "제품"
    )
    const productName =
      sanitizeProductNameForNarration(rawProductName, {
        category: result.productAnalysis?.category,
        summary: result.productAnalysis?.summary,
        analysisTitles: analyses.map((a) => a.title),
        visualHint: `${userKeywords.join(" ")}\n${visualBlob}`,
        userKeywords,
      }) || rawProductName
    const styleSource = body.topic?.trim() || body.projectName?.trim() || productName
    const { topic, naturalShorts } = parseTopicWithStyleMode(styleSource)

    const vs = result.productAnalysis?.videoStructure
    const productContext = buildNarrationProductContext({
      userKeywords,
      productName,
      category: result.productAnalysis?.category,
      summary: result.productAnalysis?.summary,
      videoStructure: vs,
      analysisTitles: analyses.map((a) => a.title),
      visualBlob,
      topic: naturalShorts ? topic : undefined,
      naturalShorts,
    })

    const sceneMetas = buildCutNarrationSceneMetas(
      cuts,
      {
        keywords: userKeywords.length ? userKeywords : result.productAnalysis?.targetKeywords,
        summary: result.productAnalysis?.summary,
        category: result.productAnalysis?.category,
      },
      analyses
    )
    const sourceVideosBlock = buildSourceVideosNarrationBlock(analyses)
    const cutsBlock = buildNarrationCutsPromptBlock(cuts, naturalShorts, sceneMetas, userKeywords)
    const repeatGroupsBlock = buildRepeatedSceneGroupsPrompt(cuts, sceneMetas)

    const systemContent = naturalShorts
      ? buildNaturalShortsNarrationSystemPrompt({ cutCount: cuts.length, mode })
      : `한국어 쇼핑숏폼 나레이션 작가. JSON만 출력.
${mode === "rewrite" ? "\n**모드: 대본 다시쓰기** — 영상·컷 구성은 그대로, 나레이션 문장만 전면 교체. 이전 대본과 같은 표현·문장 구조 반복 금지.\n" : ""}
참고 예시 — **한 편의 영상처럼 앞뒤가 이어지는 흐름** (줄바꿈 = 자막 한 줄):
${benchmarkScriptFewShotJson()}

필수:
- **사용자 입력 키워드가 있으면 그 제품 기준으로만** 대본을 작성 (영상 분석 제품명과 다르면 키워드 우선)
- **원본 중국 숏폼 제목·Vision·장면 분석**을 참고해 각 컷 화면에 실제로 보이는 사물·행동을 한국어로 구체적으로 말할 것
- 컷 visual에 「화면자막」(OCR)이 있으면 그 의미를 한국어 구매 효용으로 반영 (중국어·영어 원문 낭독 금지)
- **키워드 제품 + 각 컷 화면**을 한 문장으로 결합 (화면만 읽거나 키워드만 말하기 금지)
- **후킹 구조**: ①문제·공감(욕실/책상 어지러움) → ②키워드 제품 → ③화면별 데모(퍼즐/벽걸이/컵 등 다른 각도) → ④CTA
- **금지**: 「몇 번 봐도」「아까 말한」「이어서 보면」「이 화면에서도 그대로」같은 메타 반복 문구
- **금지**: 거치대·수납 제품에 칫솔질·플라크 기능 지어내기 / 화면 무관 「선물용 색감」
- lines는 **${cuts.length}개 컷이 하나의 대본**으로 자연스럽게 이어져야 함 (독립 문장 나열 금지)
- **각 lines[i]는 i번째 컷의 「화면」에 실제로 보이는 사물·행동을 구체적으로 말할 것** (추상 칭찬만 금지)
- 컷마다 화면 키워드(장면에 실제로 보이는 사물·행동·장소) 중 **최소 1개** 반드시 포함
- 스토리 골격: ①문제·후킹 → ②해결책·제품 → ③~N-1 화면별 데모(앞 컷 맥락 이어받기) → ④마무리·구매
- **금지 문구**: "이 포인트", "이 부분이 핵심", "충분히 만족", "손이 가요", "이렇게 활용하면", "생각보다 편해요", "이렇게 쉬워요", "제품 사용 장면" 읽기, "완벽하게 작동", "모든 것이 해결", "설치가 이렇게 간편"
- ${NARRATION_PRODUCT_NAME_USAGE_RULE}
- **중국어·영문(unboxing/review 등) 그대로 읽기 금지** — 한국어 구어체만
- **그리고/그래서/바로/이어서로 문장 시작 금지** — 접속사 남발 없이 내용으로 이어질 것
- lines[i] = i번째 컷 (\\n = 자막 줄). 완결된 구어체. 장면 설명·중국어 그대로 읽기 금지
- **각 컷 duration(초)에 맞는 짧은 분량만** — 초당 약 4자. 긴 문장으로 시간을 넘기지 말 것

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
${
  sourceVideosBlock
    ? `
${sourceVideosBlock}
`
    : ""
}${
  userKeywords.length
    ? `
**사용자 입력 키워드 + 영상 결합 (필수)**:
- 키워드: ${userKeywords.join(", ")} = 홍보 제품. 각 컷 「화면」·원본 참고에 보이는 행동·사물과 **제품 장점**을 한 문장으로 연결하세요.
- 영상에 다른 제품이 보여도 나레이션은 키워드 제품 기준. 화면은 연출·데모로 활용.
- **키워드 전체 명칭은 후킹 1회·마지막 CTA 1회만**. 중간 컷은 이거/마우스/손에 쥔 이 친구 등으로 지칭.
- 반복 화면이어도 「몇 번 봐도」「아까 말한」 금지 — **다른 각도·다른 구체 표현**으로 데모.
- 원본 중국어 제목·자막은 **한국어로 바꿔** 화면에 맞게 설명 (중국어 그대로 읽기 금지).
`
    : ""
}
편집 타임라인 컷 ${cuts.length}개 (영상 블록과 1:1):
${cutsBlock}

${
  mode === "rewrite" && previousScriptBlock
    ? `이전 대본 (참고만 — **문장·표현을 재사용하지 말고 완전히 새로** 작성):
${previousScriptBlock}

**다시쓰기 필수**: 이전 대본과 **동일·유사한 문장 금지**. 각 컷 화면에 맞는 **새 구어체**만.

`
    : ""
}스토리 골격: 문제·후킹 → 제품·해결 → 화면별 데모 → 마무리·CTA.

**화면 정합성 (최우선)**:
- **사용자 입력 키워드 = 홍보 제품**. 영상 분석이 다른 제품으로 보여도 키워드 제품 기준으로만 작성.
- 각 컷의 「화면」·원본 Vision·장면 설명에 나온 **장소·행동·제품 상태**를 대본에 반드시 반영하세요.
- 화면과 무관한 추상 칭찬·다른 제품 기능 지어내기 금지.
- **모든 제품 공통**: 각 컷 「화면」·원본 Vision에 나온 사물·행동·장소를 대본에 반영. 키워드 제품 장점과 연결.
- 모든 컷에 같은 추상 문장(「이 포인트」「핵심」「만족」) 반복 금지.
- **동일 꼬리문구·동일 의미 반복 절대 금지** (예: 「먼지가 바로 빠져요」「이렇게 빼낼 수 있어요」를 여러 컷에 쓰지 말 것)
- **같은·유사 화면이 반복되면** 문장을 복사하지 말고 **앞 컷 나레이션을 이어** 제품 장점을 깊이 있게 전개
- 화면 설명을 앞에 붙이고 뒤에 고정 문구만 바꾸는 패턴 금지 — 컷마다 **새로운 구체 표현**으로 작성
${repeatGroupsBlock}

위 ${cuts.length}개 컷이 **한 편의 쇼핑숏폼**처럼 읽히도록 lines 배열을 ${mode === "rewrite" ? "다시" : ""} 작성하세요.`

    const temperature = mode === "rewrite" ? 0.82 : naturalShorts ? 0.45 : 0.42
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
        {
          allowTemplateFallback: false,
          fitToDuration: true,
          rewriteMode: mode === "rewrite",
          rewriteSalt,
          productContext,
          userKeywords,
          previousScripts: mode === "rewrite" ? previousScripts : undefined,
          sceneMetas,
        }
      )
    )
    let polished = polishedRaw.map((text, i) =>
      ensureNaturalShortsCtaOnLastLine(
        sanitizeNarrationForOutput(text),
        naturalShorts && i === polishedRaw.length - 1
      )
    )

    const weakIndices = polished
      .map((text, i) => ({ i, weak: !text.trim() || narrationLooksIncomplete(text.replace(/\n/g, " ")) }))
      .filter((x) => x.weak)
      .map((x) => x.i)

    if (weakIndices.length) {
      try {
        const patchParsed = await requestNarrationJson({
          apiKey,
          systemContent,
          userContent: `${userContent}

**필수 수정**: 아래 컷 번호의 lines가 비었거나 문장이 끊겼습니다. **해당 컷만** 키워드 제품 + 화면에 맞는 완결 구어체로 다시 작성하세요.
문제 컷: ${weakIndices.map((i) => i + 1).join(", ")}
전체 lines 길이는 반드시 ${cuts.length}개 유지.`,
          temperature: Math.min(temperature + 0.1, 0.85),
          maxTokens,
        })
        const patchLines = alignNarrationLinesToCuts(parseNarrationLinesFromAi(patchParsed.lines), cuts, productName)
        for (const i of weakIndices) {
          const patched = patchLines[i]?.trim()
          if (patched && !narrationLooksIncomplete(patched.replace(/\n/g, " "))) {
            polished[i] = sanitizeNarrationForOutput(
              formatSceneNarrationLines(patched, cuts[i]!.duration)
            )
          }
        }
      } catch {
        /* AI 패치 실패 시 기존 줄 유지 */
      }
    }

    if (mode === "rewrite" && Object.keys(previousScripts).length) {
      polished = ensureRewriteDiffersFromPrevious(
        polished,
        previousScripts,
        cuts.map((c) => ({ visual_card: c.visual_card, duration: c.duration })),
        productName,
        rewriteSalt
      )
    }

    if (result.productAnalysis && result.editPlan) {
      try {
        const sceneBlocks = cuts.map((c, i) => ({
          start: c.output_start,
          end: c.output_end,
          text: polished[i] ?? "",
        }))
        const issueSamples = detectShoppingScriptQualityIssues(polished, productName)
        const audited = await auditShoppingScriptWithAi({
          apiKey,
          userKeywords,
          productAnalysis: result.productAnalysis,
          editPlan: result.editPlan,
          analyses,
          scenes: sceneBlocks,
          targetDuration: result.editPlan.target_duration,
          issueSamples,
        })
        polished = audited.map((s, i) => {
          const dur = cuts[i]!.duration
          return formatSceneNarrationLines(s.text, dur)
        })
      } catch (auditErr) {
        console.warn("[mvp-narration-script] AI audit skipped:", auditErr)
      }
    }

    polished = mitigateProductNameSpam(polished, productName).map((text, i) => {
      const dur = cuts[i]!.duration
      let next = formatSceneNarrationLines(text, dur)
      const plain = next.replace(/\s+/g, "")
      if (!plain || plain === "한번보세요" || /^한번보세요$/.test(plain)) {
        // 포맷이 문장을 날리면 원문 유지 (동일 클리셰 방지)
        next = sanitizeNarrationForOutput(text) || next
      }
      return next
    })

    // 전 컷이 같은 짧은 클리셰면 실패로 처리해 재시도 유도
    const normalized = polished.map((t) => t.replace(/\s+/g, ""))
    if (
      polished.length >= 2 &&
      new Set(normalized).size === 1 &&
      (normalized[0] === "한번보세요" || (normalized[0]?.length ?? 0) <= 6)
    ) {
      return NextResponse.json(
        {
          error:
            "대본이 장면마다 같은 짧은 문구로만 생성되었습니다. 「대본 다시쓰기」를 다시 눌러 주세요.",
        },
        { status: 422 }
      )
    }

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
