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
  sanitizeSceneSubtitleText,
} from "@/lib/shotform-cut-narration"
import { hasExcessiveScriptRepetition } from "@/lib/shotform-narration-similarity"
import {
  actionSceneForSourceRange,
  actionScriptTextForSourceRange,
} from "@/lib/shotform-scene-understanding"
import {
  buildNarrationProductContext,
  detectObviousProductCategoryLeak,
  normalizeUserSourceKeywords,
  primaryProductLabelFromKeywords,
} from "@/lib/shotform-user-keyword-product"
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

/** 정밀 대본 — AI 검증 완료 표시 (스튜디오 하드코딩 폴백 우회) */
export const PRECISION_SCRIPT_TONE = "쇼핑숏폼·정밀"

async function openaiJson<T>(apiKey: string, system: string, user: string, maxTokens = 2800): Promise<T> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.32,
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
      return `Before/After 체감·운전·시야·편의 등 결과 강조`
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
    [`운전 중 폰`, `이렇게 두세요`],
    [`대시보드`, `깔끔하게`],
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
    const text = (raw && !isGenericTemplateNarration(raw) ? raw : blocks[0]?.text || "").trim()
    return {
      start: seg.output_start,
      end: seg.output_end,
      text: text || "한번 보세요",
      video_id: seg.video_id,
    }
  })
}

function productIdentityBlock(userKeywords: string[], productAnalysis: ProductAnalysis): string {
  return buildNarrationProductContext({
    userKeywords,
    productName: productAnalysis.productName,
    category: productAnalysis.category,
    summary: productAnalysis.summary,
    videoStructure: productAnalysis.videoStructure,
  })
}

export { detectObviousProductCategoryLeak }

/** 고속·벤치마크 대본 — 키워드 제품 정체성 AI 검수 */
export async function auditShoppingScriptProductIdentity(args: {
  apiKey: string
  userKeywords: readonly string[]
  productAnalysis: ProductAnalysis
  editPlan: EditPlan
  analyses: VideoAnalysis[]
  scenes: SceneSubtitleBlock[]
  targetDuration: number
  leakSamples?: string[]
}): Promise<SceneSubtitleBlock[]> {
  const blueprint: PrecisionScriptSceneBlueprint[] = buildBenchmarkSceneBlocksFromEditPlan(
    args.editPlan,
    args.analyses,
    undefined,
    args.productAnalysis.scenes
  ).map((b, i) => ({
    index: i + 1,
    start: b.start,
    end: b.end,
    duration: b.duration,
    target_lines: b.target_lines,
    visual_card: b.visual_card,
    story_beat: "demo" as StoryBeat,
    scene_role: "demo",
    action_hint: args.scenes[i]?.text?.slice(0, 40) || b.visual_card,
    purchase_angle: primaryProductLabelFromKeywords(args.userKeywords, args.productAnalysis.productName),
  }))

  return auditProductIdentityWithAi({
    apiKey: args.apiKey,
    userKeywords: [...args.userKeywords],
    productAnalysis: args.productAnalysis,
    blueprint,
    scenes: args.scenes,
    targetDuration: args.targetDuration,
    leakSamples: args.leakSamples,
  })
}

/** 제품 정체성·화면 정합 — AI 최종 검수 (하드코딩 폴백 대신 전면 재작성) */
async function auditProductIdentityWithAi(args: {
  apiKey: string
  userKeywords: string[]
  productAnalysis: ProductAnalysis
  blueprint: PrecisionScriptSceneBlueprint[]
  scenes: SceneSubtitleBlock[]
  targetDuration: number
  leakSamples?: string[]
}): Promise<SceneSubtitleBlock[]> {
  const { apiKey, userKeywords, productAnalysis, blueprint, scenes, targetDuration, leakSamples } = args
  const productContext = productIdentityBlock(userKeywords, productAnalysis)
  const primary = primaryProductLabelFromKeywords(userKeywords, productAnalysis.productName)

  const parsed = await openaiJson<{
    sceneSubtitles?: Array<{ index: number; text: string }>
    issues?: string[]
  }>(
    apiKey,
    `쇼핑 숏폼 **제품 정체성 검수 PD**. JSON만 출력.

**절대 규칙**
- 홍보 제품은 사용자 키워드 제품 **하나**뿐. 다른 카테고리 제품·기능으로 바꾸면 **전면 실패**.
- 화면(visual_card)에 보이는 행동·사물과 대본이 일치해야 함.
- 장면 설명을 그대로 읽지 말고 **구매 설득 나레이션**으로 변환.
- 중복 문장·같은 꼬리표현 금지. 후킹(1번)·CTA(마지막) 필수.

**금지 예시 (키워드가 거치대·홀더일 때)**
청소기, 핸디청소, 먼지, 흡입, 노즐, 트렁크, 영화관, 프로젝터, 스크린 선명, 경기 관람, 야외 설치

출력:
{"issues":["수정 요약"],"sceneSubtitles":[{"index":1,"text":"..."}, ...]}`,
    `${productContext}

**홍보 제품 (유일)**: ${primary}
목표 길이: ${targetDuration}초
${leakSamples?.length ? `\n**오류 샘플 (반드시 제거·재작성)**:\n${leakSamples.map((s) => `- ${s}`).join("\n")}` : ""}

장면별 visual·구조:
${JSON.stringify(blueprint, null, 0)}

검수할 대본:
${JSON.stringify(
  scenes.map((s, i) => ({ index: i + 1, start: s.start, end: s.end, text: s.text })),
  null,
  0
)}`,
    3400
  )

  return scenes.map((s, i) => {
    const row = parsed.sceneSubtitles?.find((r) => Number(r.index) === i + 1)
    const text = typeof row?.text === "string" && row.text.trim() ? row.text.trim() : s.text
    return { ...s, text: sanitizeSceneSubtitleText(text) || text }
  })
}

/** 2차 AI — 중복·후킹·구매 전환 검증 */
async function verifyPrecisionScriptWithAi(args: {
  apiKey: string
  userKeywords: string[]
  productAnalysis: ProductAnalysis
  blueprint: PrecisionScriptSceneBlueprint[]
  draftScenes: SceneSubtitleBlock[]
  targetDuration: number
}): Promise<{
  scenes: SceneSubtitleBlock[]
  headcopies: string[][]
  commentKeyword: string
}> {
  const { apiKey, userKeywords, productAnalysis, blueprint, draftScenes, targetDuration } = args
  const productContext = productIdentityBlock(userKeywords, productAnalysis)

  const parsed = await openaiJson<{
    sceneSubtitles?: Array<{ index: number; text: string }>
    headcopies?: string[][]
    commentKeyword?: string
  }>(
    apiKey,
    `쇼핑 숏폼 대본 **검수 PD**. JSON만 출력.

${productContext}

검수: 중복 제거, 후킹 강화, hook→해결→데모→CTA 흐름, **키워드 제품만** 언급.

출력 JSON:
{"sceneSubtitles":[{"index":1,"text":"..."}, ...], "headcopies":[["",""],...], "commentKeyword":"..."}`,
    `목표: ${targetDuration}초

블루프린트:
${JSON.stringify(blueprint, null, 0)}

초안:
${JSON.stringify(draftScenes.map((s, i) => ({ index: i + 1, text: s.text })), null, 0)}`,
    3200
  )

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
      String(parsed.commentKeyword || userKeywords[0] || productAnalysis.category).trim() || "쇼핑",
  }
}

/** 정밀 모드 — 구조 기반 초안 + AI 검증 + 제품 정체성 검수 */
export async function generatePrecisionScriptFromMix(args: {
  apiKey: string
  productAnalysis: ProductAnalysis
  mixInfo: MixInfo
  editPlan: EditPlan
  analyses: VideoAnalysis[]
  scriptTopic?: string
  sourceKeywords?: readonly string[]
}): Promise<ShoppingScript> {
  const { apiKey, productAnalysis, mixInfo, editPlan, analyses, scriptTopic, sourceKeywords } = args
  const userKeywords = normalizeUserSourceKeywords(sourceKeywords?.length ? sourceKeywords : productAnalysis.targetKeywords)
  const targetDuration = editPlan.target_duration
  const blueprint = buildPrecisionScriptBlueprint({
    editPlan,
    analyses,
    mixInfo,
    productAnalysis,
  })
  const sceneCount = blueprint.length
  const topic = scriptTopic?.trim() || primaryProductLabelFromKeywords(userKeywords, productAnalysis.productName)
  const productContext = productIdentityBlock(userKeywords, productAnalysis)

  const draft = await openaiJson<{
    sceneSubtitles?: Array<{ index: number; text: string }>
    headcopies?: string[][]
    commentKeyword?: string
  }>(
    apiKey,
    `쇼핑 숏폼 **정밀 대본 작가**. JSON만 출력.

${productContext}

**필수**: 모든 장면 대본은 **사용자 키워드 제품**만 홍보. 다른 제품 카테고리(청소기·프로젝터 등) 언급 **절대 금지**.
화면 visual_card에 보이는 설치·사용·효과만 말할 것.

스토리 (${sceneCount}장면): hook → 문제 → 해결 → demo → result → CTA
- action_hint 참고만, 복사 금지
- 장면마다 다른 표현
- 마지막 end = ${targetDuration}

출력: {"sceneSubtitles":[{"index":1,"text":"..."},...], "headcopies":[...], "commentKeyword":"..."}`,
    `주제: ${topic}
목표: ${targetDuration}초

블루프린트:
${JSON.stringify(blueprint, null, 0)}`,
    3600
  )

  let scenes: SceneSubtitleBlock[] = blueprint.map((b, i) => {
    const row = draft.sceneSubtitles?.find((r) => Number(r.index) === i + 1)
    const raw = typeof row?.text === "string" ? row.text.trim() : ""
    return {
      start: b.start,
      end: b.end,
      text: formatSceneNarrationLines(
        sanitizeSceneSubtitleText(raw) || raw || b.action_hint || "",
        b.duration
      ),
    }
  })

  const verified = await verifyPrecisionScriptWithAi({
    apiKey,
    userKeywords,
    productAnalysis,
    blueprint,
    draftScenes: scenes,
    targetDuration,
  })
  scenes = verified.scenes.map((s, i) => ({
    ...s,
    text: formatSceneNarrationLines(s.text, blueprint[i]!.duration),
  }))

  let leaks = detectObviousProductCategoryLeak(
    scenes.map((s) => s.text),
    userKeywords
  )
  if (leaks.length || hasExcessiveScriptRepetition(scenes.map((s) => s.text.replace(/\n/g, " ")))) {
    scenes = await auditProductIdentityWithAi({
      apiKey,
      userKeywords,
      productAnalysis,
      blueprint,
      scenes,
      targetDuration,
      leakSamples: leaks,
    })
    scenes = scenes.map((s, i) => ({
      ...s,
      text: formatSceneNarrationLines(s.text, blueprint[i]!.duration),
    }))
    leaks = detectObviousProductCategoryLeak(
      scenes.map((s) => s.text),
      userKeywords
    )
    if (leaks.length) {
      scenes = await auditProductIdentityWithAi({
        apiKey,
        userKeywords,
        productAnalysis,
        blueprint,
        scenes,
        targetDuration,
        leakSamples: leaks,
      })
      scenes = scenes.map((s, i) => ({
        ...s,
        text: formatSceneNarrationLines(s.text, blueprint[i]!.duration),
      }))
    }
  }

  const bundle = assembleScriptBundleFromScenes(
    scenes,
    verified.headcopies,
    verified.commentKeyword
  )

  return {
    tone: PRECISION_SCRIPT_TONE,
    bundle,
    script: scriptLinesFromBlocks(scenes, editPlan),
  }
}
