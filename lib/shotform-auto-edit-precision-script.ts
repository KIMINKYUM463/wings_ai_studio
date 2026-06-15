import type {
  EditPlan,
  MixInfo,
  ProductAnalysis,
  SceneSubtitleBlock,
  ScriptLine,
  ShoppingScript,
  VideoAnalysis,
} from "@/lib/shotform-auto-edit-types"
import {
  assembleScriptBundleFromScenes,
  buildBenchmarkSceneBlocksFromEditPlan,
  formatSceneNarrationLines,
} from "@/lib/shotform-benchmark-script"
import {
  bundleTextForEditCut,
  isGenericTemplateNarration,
  rephraseSceneToShoppingNarrationVariant,
  sanitizeSceneSubtitleText,
} from "@/lib/shotform-cut-narration"
import {
  hasExcessiveScriptRepetition,
  narrationBlockSimilarity,
  narrationLineIsDuplicateOfPrior,
} from "@/lib/shotform-narration-similarity"
import {
  limitConnectorsAcrossScript,
  polishCutNarrationLines,
  stripLeadingNarrationConnector,
} from "@/lib/shotform-narration-script-quality"
import {
  actionSceneForSourceRange,
  actionScriptTextForSourceRange,
} from "@/lib/shotform-scene-understanding"
import { buildDesiredBeatSequence, type StoryBeat } from "@/lib/shotform-story-flow"
import { analysisByVideoId, buildCutScriptContexts } from "@/lib/shotform-visual-scene-match"

export type PrecisionScriptSceneBlueprint = {
  index: number
  start: number
  end: number
  duration: number
  target_lines: number
  visual_card: string
  story_beat: StoryBeat
  scene_role: string
  pain_point?: string
  benefit?: string
  action_hint: string
  purchase_angle: string
}

async function openaiJson<T>(apiKey: string, system: string, user: string, maxTokens = 2800): Promise<T> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.38,
      max_tokens: maxTokens,
      response_format: { type: "json_object" as const },
      messages: [
        { role: "system" as const, content: system },
        { role: "user" as const, content: user },
      ],
    }),
    signal: AbortSignal.timeout(70_000),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => "")
    throw new Error(`OpenAI 실패 (${res.status}): ${t.slice(0, 180)}`)
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error("OpenAI 응답이 비었습니다.")
  return JSON.parse(content) as T
}

function roleToStoryBeat(role: string, index: number, total: number): StoryBeat {
  const r = role.trim()
  if (r.includes("문제")) return "hook"
  if (r.includes("설치") || r.includes("부착")) return "setup"
  if (r.includes("사용") || r.includes("기능") || r.includes("데모")) return "demo"
  if (r.includes("수납") || r.includes("추가") || r.includes("세척") || r.includes("관리")) return "result"
  if (r.includes("구매") || r.includes("마무리")) return "close"
  if (index === 0) return "hook"
  if (index >= total - 1) return "close"
  if (index < total * 0.35) return "setup"
  return "demo"
}

function purchaseAngleForBeat(beat: StoryBeat, productName: string, role: string): string {
  const p = productName || "이 제품"
  switch (beat) {
    case "hook":
      return `시청자 일상 불편·문제를 짧게 찌르고 ${p} 필요성을 암시`
    case "intro":
      return `${p}가 어떤 문제를 푸는지 한 줄로 소개`
    case "setup":
      return `설치·준비가 쉽다는 점으로 구매 장벽 낮추기`
    case "demo":
      return `화면 속 실제 사용 장면과 연결된 구체적 효용`
    case "result":
      return `Before/After 체감·공간·시간 절약 등 결과 강조`
    case "close":
      return `지금 사야 하는 이유·마지막 한 방 CTA (과장 금지)`
    default:
      return role ? `${role} 장면 — 구매 욕구로 연결` : "구매 포인트 연결"
  }
}

/** 정밀 분석 action_scenes + 편집 타임라인 → 쇼핑숏폼 구조 블루프린트 */
export function buildPrecisionScriptBlueprint(args: {
  editPlan: EditPlan
  analyses: VideoAnalysis[]
  mixInfo?: MixInfo
  productAnalysis: ProductAnalysis
}): PrecisionScriptSceneBlueprint[] {
  const { editPlan, analyses, mixInfo, productAnalysis } = args
  const blocks = buildBenchmarkSceneBlocksFromEditPlan(
    editPlan,
    analyses,
    mixInfo,
    productAnalysis.scenes
  )
  const cuts = buildCutScriptContexts(editPlan, analyses, mixInfo)
  const byId = analysisByVideoId(analyses)
  const beats = buildDesiredBeatSequence(blocks.length, editPlan.target_duration)
  const productName = productAnalysis.productName || "쇼핑 제품"

  return blocks.map((block, i) => {
    const cut = cuts.find(
      (c) =>
        (c.output_start + c.output_end) / 2 >= block.start - 0.08 &&
        (c.output_start + c.output_end) / 2 < block.end + 0.08
    )
    const analysis = cut ? byId.get(cut.video_id) : analyses[0]
    const action =
      analysis && cut
        ? actionSceneForSourceRange(analysis, cut.source_start, cut.source_end)
        : null
    const role = action?.scene_role || "데모"
    const beat = beats[i] ?? roleToStoryBeat(role, i, blocks.length)
    const actionHint =
      (analysis && cut ? actionScriptTextForSourceRange(analysis, cut.source_start, cut.source_end) : "") ||
      action?.script_lines?.join(" / ") ||
      ""

    let pain_point: string | undefined
    let benefit: string | undefined
    if (role.includes("문제") || beat === "hook") {
      pain_point = action?.scene_description?.slice(0, 80) || productAnalysis.summary?.slice(0, 60)
    }
    if (beat === "demo" || beat === "result" || role.includes("수납") || role.includes("사용")) {
      benefit = action?.scene_description?.slice(0, 80)
    }

    return {
      index: i + 1,
      start: block.start,
      end: block.end,
      duration: block.duration,
      target_lines: block.target_lines,
      visual_card: block.visual_card,
      story_beat: beat,
      scene_role: role,
      pain_point,
      benefit,
      action_hint: actionHint.slice(0, 120),
      purchase_angle: purchaseAngleForBeat(beat, productName, role),
    }
  })
}

function defaultHeadcopies(productName: string): string[][] {
  const p = (productName || "이 제품").slice(0, 14)
  return [
    [`아직도 이렇게`, `쓰고 계세요?`],
    [`이거 모르면`, `손해예요`],
    [`${p}`, `이유 3가지`],
    [`끝까지 보면`, `바로 달라져요`],
  ]
}

function scriptLinesFromBlocks(
  blocks: SceneSubtitleBlock[],
  editPlan: EditPlan
): ScriptLine[] {
  const plan = editPlan.edit_plan
  return plan.map((seg, i) => {
    const raw = bundleTextForEditCut(i, plan, blocks)
    const dur = Math.max(0.5, seg.output_end - seg.output_start)
    const text =
      raw && !isGenericTemplateNarration(raw)
        ? raw
        : rephraseSceneToShoppingNarrationVariant(seg.visual_caption || seg.reason, undefined, dur, i + 3)
    return {
      start: seg.output_start,
      end: seg.output_end,
      text,
      video_id: seg.video_id,
    }
  })
}

function localDedupeSceneTexts(texts: string[], contexts: Array<{ visual_card: string; duration: number }>): string[] {
  const prior: string[] = []
  return texts.map((raw, i) => {
    let t = stripLeadingNarrationConnector(sanitizeSceneSubtitleText(raw) || raw.trim())
    if (
      !t ||
      isGenericTemplateNarration(t) ||
      narrationLineIsDuplicateOfPrior(t, prior, 0.38) ||
      prior.some((p) => narrationBlockSimilarity(p, t) >= 0.62)
    ) {
      t = rephraseSceneToShoppingNarrationVariant(
        contexts[i]?.visual_card || "",
        undefined,
        contexts[i]?.duration || 3,
        i * 17 + prior.length * 11 + 5
      )
    }
    prior.push(t)
    return t
  })
}

/** 2차 AI — 중복·후킹·구매 전환 검증 및 수정 */
async function verifyPrecisionScriptWithAi(args: {
  apiKey: string
  productAnalysis: ProductAnalysis
  blueprint: PrecisionScriptSceneBlueprint[]
  draftScenes: SceneSubtitleBlock[]
  targetDuration: number
}): Promise<{
  scenes: SceneSubtitleBlock[]
  headcopies: string[][]
  commentKeyword: string
  issues_fixed: string[]
}> {
  const { apiKey, productAnalysis, blueprint, draftScenes, targetDuration } = args

  const parsed = await openaiJson<{
    passed?: boolean
    issues?: string[]
    sceneSubtitles?: Array<{ index: number; text: string }>
    headcopies?: string[][]
    commentKeyword?: string
  }>(
    apiKey,
    `쇼핑 숏폼 대본 **검수 PD**. JSON만 출력.

역할: 초안 대본을 검수하고 **중복·약한 후킹·구매 전환 부족**을 수정한 최종안을 낸다.

검수 체크리스트:
1. **중복 금지** — 장면 간 같은 문장·같은 꼬리표현·「이렇게 쓰면 편해요」류 반복 제거
2. **후킹** — 1번 장면은 문제·호기심·불편 중 하나로 시선 고정 (제품명 나열 금지)
3. **스토리 흐름** — hook→문제→해결→데모→결과→CTA 한 편의 영상처럼 연결
4. **구매 욕구** — 각 장면이 「왜 사야 하는지」에 기여, 마지막 장면은 행동 유도
5. **화면 일치** — visual·action_hint에 없는 기능·스펙 지어내기 금지
6. **구어체** — 줄당 8~18자, "~입니다" 최소화, 완결된 문장

출력 JSON:
{
  "passed": false,
  "issues": ["수정한 문제 요약"],
  "sceneSubtitles": [{"index":1,"text":"줄1\\n줄2"}, ...] — blueprint 개수와 동일,
  "headcopies": [["위후킹","아래후킹"], ...] 4세트,
  "commentKeyword": "댓글 키워드"
}`,
    `제품: ${productAnalysis.productName}
카테고리: ${productAnalysis.category}
키워드: ${productAnalysis.targetKeywords.join(", ")}
요약: ${productAnalysis.summary}
목표: ${targetDuration}초

구조 블루프린트:
${JSON.stringify(blueprint, null, 0)}

초안 sceneSubtitles:
${JSON.stringify(
  draftScenes.map((s, i) => ({
    index: i + 1,
    start: s.start,
    end: s.end,
    text: s.text,
  })),
  null,
  0
)}`,
    3200
  )

  const issues = Array.isArray(parsed.issues) ? parsed.issues.map(String).slice(0, 8) : []
  const revised: SceneSubtitleBlock[] = draftScenes.map((s, i) => {
    const row = parsed.sceneSubtitles?.find((r) => Number(r.index) === i + 1)
    const text = typeof row?.text === "string" && row.text.trim() ? row.text.trim() : s.text
    return { ...s, text: sanitizeSceneSubtitleText(text) || text }
  })

  const headcopies =
    Array.isArray(parsed.headcopies) && parsed.headcopies.length >= 3
      ? parsed.headcopies
          .filter((row) => Array.isArray(row) && row.length >= 2)
          .map((row) => [String(row[0]), String(row[1])])
      : defaultHeadcopies(productAnalysis.productName)

  return {
    scenes: revised,
    headcopies,
    commentKeyword:
      String(parsed.commentKeyword || productAnalysis.targetKeywords[0] || productAnalysis.category).trim() ||
      "쇼핑",
    issues_fixed: issues,
  }
}

/** 정밀 모드 — 구조 기반 초안 + AI 검증 대본 */
export async function generatePrecisionScriptFromMix(args: {
  apiKey: string
  productAnalysis: ProductAnalysis
  mixInfo: MixInfo
  editPlan: EditPlan
  analyses: VideoAnalysis[]
  scriptTopic?: string
}): Promise<ShoppingScript> {
  const { apiKey, productAnalysis, mixInfo, editPlan, analyses, scriptTopic } = args
  const targetDuration = editPlan.target_duration
  const blueprint = buildPrecisionScriptBlueprint({
    editPlan,
    analyses,
    mixInfo,
    productAnalysis,
  })
  const sceneCount = blueprint.length
  const topic = scriptTopic?.trim() || productAnalysis.productName

  const draft = await openaiJson<{
    sceneSubtitles?: Array<{ index: number; text: string; story_beat?: string }>
    headcopies?: string[][]
    commentKeyword?: string
  }>(
    apiKey,
    `쇼핑 숏폼 **정밀 대본 작가**. JSON만 출력.

정밀 분석으로 뽑은 **행동·장면 구조**를 바탕으로, 한 편의 **구매 전환 숏폼** 대본을 쓴다.

필수 스토리 골격 (${sceneCount}장면):
1. **hook** — 일상 불편·문제·「이거 아직도?」식 후킹 (제품명 반복 금지)
2. **intro/setup** — 제품이 문제를 어떻게 푸는지
3. **demo** — 화면 속 실제 사용·설치·기능 (visual 기반)
4. **result** — Before/After 체감·공간 변화
5. **close** — 구매·행동 유도 (과장·허위 금지)

규칙:
- action_hint는 **참고만** — 그대로 복사·반복 금지
- 장면마다 **다른 문장 구조**·다른 키워드 (중복 클리셰 금지)
- sceneSubtitles[i].text = 해당 장면 visual·purchase_angle에 맞는 구어체 (target_lines 전후)
- **한 편의 영상**처럼 앞뒤 연결, 장면별 독립 나열 금지
- 마지막 scene end = ${targetDuration}

출력:
{
  "sceneSubtitles": [{"index":1,"text":"...","story_beat":"hook"}, ...] — 정확히 ${sceneCount}개,
  "headcopies": [["위","아래"], ...] 4세트 — 썸네일 후킹,
  "commentKeyword": "키워드"
}`,
    `주제: ${topic}
제품: ${productAnalysis.productName}
카테고리: ${productAnalysis.category}
키워드: ${productAnalysis.targetKeywords.join(", ")}
요약: ${productAnalysis.summary}
영상 구조: hook=${productAnalysis.videoStructure?.hook || ""} / body=${productAnalysis.videoStructure?.body || ""} / cta=${productAnalysis.videoStructure?.cta || ""}
목표 길이: ${targetDuration}초

정밀 구조 블루프린트 (순서 고정):
${JSON.stringify(blueprint, null, 0)}`,
    3600
  )

  let draftScenes: SceneSubtitleBlock[] = blueprint.map((b, i) => {
    const row = draft.sceneSubtitles?.find((r) => Number(r.index) === i + 1)
    const raw = typeof row?.text === "string" ? row.text.trim() : ""
    const text = raw || b.action_hint || b.visual_card.slice(0, 40)
    return {
      start: b.start,
      end: b.end,
      text: sanitizeSceneSubtitleText(text) || text,
    }
  })

  const contexts = blueprint.map((b) => ({
    visual_card: b.visual_card,
    duration: b.duration,
  }))

  let polished = limitConnectorsAcrossScript(
    polishCutNarrationLines(
      localDedupeSceneTexts(
        draftScenes.map((s) => s.text),
        contexts
      ),
      contexts,
      productAnalysis.productName,
      { allowTemplateFallback: false, fitToDuration: true }
    )
  )

  draftScenes = draftScenes.map((s, i) => ({
    ...s,
    text: formatSceneNarrationLines(polished[i] ?? s.text, blueprint[i]!.duration),
  }))

  const verified = await verifyPrecisionScriptWithAi({
    apiKey,
    productAnalysis,
    blueprint,
    draftScenes,
    targetDuration,
  })

  polished = limitConnectorsAcrossScript(
    polishCutNarrationLines(
      localDedupeSceneTexts(
        verified.scenes.map((s) => s.text),
        contexts
      ),
      contexts,
      productAnalysis.productName,
      { allowTemplateFallback: false, fitToDuration: true }
    )
  )

  const finalScenes: SceneSubtitleBlock[] = verified.scenes.map((s, i) => ({
    ...s,
    text: formatSceneNarrationLines(polished[i] ?? s.text, blueprint[i]!.duration),
  }))

  const flatLines = finalScenes.map((s) => s.text.replace(/\n/g, " ").trim())
  if (hasExcessiveScriptRepetition(flatLines)) {
    const retry = await verifyPrecisionScriptWithAi({
      apiKey,
      productAnalysis,
      blueprint,
      draftScenes: finalScenes,
      targetDuration,
    })
    const retryPolished = polishCutNarrationLines(
      localDedupeSceneTexts(
        retry.scenes.map((s) => s.text),
        contexts
      ),
      contexts,
      productAnalysis.productName,
      { allowTemplateFallback: false, fitToDuration: true }
    )
    for (let i = 0; i < finalScenes.length; i++) {
      finalScenes[i] = {
        ...finalScenes[i]!,
        text: formatSceneNarrationLines(retryPolished[i] ?? finalScenes[i]!.text, blueprint[i]!.duration),
      }
    }
  }

  const bundle = assembleScriptBundleFromScenes(
    finalScenes,
    verified.headcopies,
    verified.commentKeyword
  )

  return {
    tone: "쇼핑숏폼·정밀",
    bundle,
    script: scriptLinesFromBlocks(finalScenes, editPlan),
  }
}
