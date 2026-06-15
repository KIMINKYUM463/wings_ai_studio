import path from "path"
import type {
  AutoEditTargetDuration,
  EditPlan,
  MixInfo,
  MixPick,
  ProductAnalysis,
  SceneSubtitleBlock,
  ScriptLine,
  ShoppingScript,
  ShotFormScriptBundle,
  VideoAnalysis,
} from "@/lib/shotform-auto-edit-types"
import {
  descriptionSuggestsPresenterOrFace,
  emergencyScenesForAnalysis,
  filteredScenesForMixPick,
  filterAnalysesForEmergencyEdit,
  isProductSafeContentType,
  pickIntervalIsProductSafe,
} from "@/lib/shotform-auto-edit-product-filter"
import {
  mixPicksTooClose,
  ensureHookFirstPick,
  reorderMixPicksProductFirst,
  sceneEditorialScore,
  scenesForPickingDiverse,
  sortedScenesForPicking,
} from "@/lib/shotform-scene-priority"
import {
  NATURAL_SHORTS_CTA,
  buildNaturalShortsNarrationSystemPrompt,
  buildNaturalShortsNarrationUserPrompt,
  ensureNaturalShortsCtaOnLastLine,
  parseTopicWithStyleMode,
  sanitizeNarrationForOutput,
} from "@/lib/shotform-natural-shorts-script"
import { narrationLooksIncomplete } from "@/lib/shotform-narration-timing"
import { buildDesiredBeatSequence, reorderMixPicksByStoryFlow } from "@/lib/shotform-story-flow"
import {
  buildSceneBasedEditPlan,
  editPlanTotalOutputSeconds,
  ensureJumpCutEditPlan,
  finalizeEditPlan,
  forceFillEditPlanToTarget,
  isRealMixEditPlan,
} from "@/lib/shotform-auto-edit-plan-finalize"
import {
  buildCutScriptContexts,
  buildSceneSubtitleBlocksFromCuts,
  describeSourceRangeFromAnalysis,
  enrichEditPlanWithVisualReasons,
  enrichMixPicksWithVisualReasons,
  inferShotType,
  type CutScriptContext,
} from "@/lib/shotform-visual-scene-match"
import {
  buildNarrationSegmentsFromEditPlan,
  bundleTextForEditCut,
  extractVisualDescription,
  looksLikeSceneCardMetadata,
  rephraseSceneToShoppingNarration,
  rephraseSceneToShoppingNarrationVariant,
  sanitizeSceneSubtitleText,
} from "@/lib/shotform-cut-narration"
import {
  alignNarrationLinesToCuts,
  buildNarrationCutsPromptBlock,
  limitConnectorsAcrossScript,
  parseNarrationLinesFromAi,
  polishCutNarrationLines,
  stripLeadingNarrationConnector,
} from "@/lib/shotform-narration-script-quality"
import {
  buildCutNarrationSceneMetas,
  buildRepeatedSceneGroupsPrompt,
} from "@/lib/shotform-narration-scene-groups"
import { buildSourceVideosNarrationBlock } from "@/lib/shotform-source-video-narration"
import {
  assembleScriptBundleFromScenes,
  benchmarkScriptFewShotJson,
  buildBenchmarkSceneBlocksFromEditPlan,
  formatSceneNarrationLines,
} from "@/lib/shotform-benchmark-script"
import { AUTO_EDIT_NO_USABLE_VIDEO_MESSAGE } from "@/lib/shotform-auto-edit-errors"

export { AUTO_EDIT_NO_USABLE_VIDEO_MESSAGE, isAutoEditNoUsableVideoError } from "@/lib/shotform-auto-edit-errors"

const ROUND = (n: number) => Math.round(n * 100) / 100

/** 벤치마킹 프로그램 — 소스당 mix 프롬프트에 넣을 의미 장면 상한 */
const BENCHMARK_MIX_SCENES_PER_SOURCE = 12

function benchmarkTimelineForAnalysis(a: VideoAnalysis) {
  if (a.visual_scenes?.length) return a.visual_scenes
  return a.scenes.map((s) => ({
    start: s.start,
    end: s.end,
    description: s.description,
    shot_type: inferShotType(s.description),
  }))
}

function compactScenesForMixPrompt(a: VideoAnalysis) {
  return benchmarkTimelineForAnalysis(a)
    .slice(0, BENCHMARK_MIX_SCENES_PER_SOURCE)
    .map((s) => ({
      start: s.start,
      end: s.end,
      description: s.description.slice(0, 120),
    }))
}

/** 목표 길이 대비 최소 채움 비율 — 미만이면 짜집기 중단 */
const EDIT_PLAN_MIN_FILL_RATIO = 0.85

export function editPlanOutputSeconds(plan: EditPlan): number {
  return plan.edit_plan.at(-1)?.output_end ?? 0
}

export function editPlanMeetsTargetDuration(
  plan: EditPlan,
  minRatio = EDIT_PLAN_MIN_FILL_RATIO
): boolean {
  const target = plan.target_duration
  const actual = editPlanOutputSeconds(plan)
  return plan.edit_plan.length > 0 && actual >= target * minRatio - 0.1
}

export function assertEditPlanMeetsTargetDuration(plan: EditPlan): void {
  if (!editPlanMeetsTargetDuration(plan)) {
    throw new Error(AUTO_EDIT_NO_USABLE_VIDEO_MESSAGE)
  }
}

/** 긴급 폴백 — 이 길이(초) 이상이면 짧은 영상으로라도 성공 처리 */
export const EMERGENCY_MIN_OUTPUT_SECONDS = 3

/** 목표 쇼츠 길이 대비 최소 채움 비율 */
export const TARGET_FILL_MIN_RATIO = 0.92

function isPickWithinBounds(pick: MixPick, analysis: VideoAnalysis | undefined): boolean {
  if (!analysis) return false
  if (pick.end <= pick.start) return false
  if (pick.start < -0.05 || pick.end > analysis.duration + 0.55) return false
  return pick.end - pick.start >= 0.3
}

function emergencyScenePoolForAnalysis(a: VideoAnalysis): VideoAnalysis["scenes"] {
  const pool = a.scenes?.length ? a.scenes : emergencyScenesForAnalysis(a)
  return scenesForPickingDiverse(pool)
}

function sanitizeEditPlanSegmentsRelaxed(plan: EditPlan, analyses: VideoAnalysis[]): EditPlan {
  const byId = new Map(analyses.map((a) => [a.video_id, a]))
  const kept: EditPlan["edit_plan"] = []
  let cursor = 0

  for (const seg of plan.edit_plan) {
    const analysis = byId.get(seg.video_id)
    if (!analysis) continue
    const maxSrc = Math.max(0.25, analysis.duration - seg.source_start)
    const dur = Math.max(0.25, Math.min(seg.source_end - seg.source_start, maxSrc))
    if (dur < 0.2) continue
    kept.push({
      ...seg,
      source_start: ROUND(seg.source_start),
      source_end: ROUND(seg.source_start + dur),
      output_start: ROUND(cursor),
      output_end: ROUND(cursor + dur),
    })
    cursor += dur
  }

  return { target_duration: plan.target_duration, edit_plan: kept }
}

/** 안전 필터 실패 시 — 완화 규칙으로 mix 생성 (목표 길이에 최대한 맞춤) */
export function buildEmergencyMix(
  analyses: VideoAnalysis[],
  targetDuration: AutoEditTargetDuration
): MixInfo {
  const effectiveCap = targetDuration
  const picks: MixPick[] = []
  let total = 0
  const clipLens = [0.9, 1.1, 1.3, 1.6, 1.0, 0.75]
  let attempt = 0
  const seen = new Set<string>()

  while (total < effectiveCap - 0.05 && picks.length < 20 && attempt < analyses.length * 30) {
    attempt++
    const slot = picks.length
    const a = analyses[slot % analyses.length]!
    const srcIndex = a.src_index ?? slot % analyses.length
    const clipLen = Math.min(clipLens[slot % clipLens.length]!, effectiveCap - total)
    const pool = emergencyScenePoolForAnalysis(a)
    if (!pool.length) continue
    const usedFromSrc = picks.filter((p) => p.srcIndex === srcIndex).length
    const sc = pool[(usedFromSrc * 2 + slot) % pool.length]!
    const span = Math.max(0.3, sc.end - sc.start - clipLen)
    const offset = (usedFromSrc * 3.7 + slot * 1.9) % span
    const start = ROUND(Math.min(sc.start + offset, Math.max(0, a.duration - clipLen - 0.05)))
    const end = ROUND(Math.min(a.duration, start + clipLen))

    const pick: MixPick = {
      srcIndex,
      start,
      end,
      reason: describeSourceRangeFromAnalysis(a, start, end, sc.description).slice(0, 80) || "영상 장면",
    }
    const key = pickKey(pick)
    if (seen.has(key) || !isPickWithinBounds(pick, a)) continue
    if (picks.some((p) => mixPicksTooClose(p, pick, 0.6))) continue
    seen.add(key)
    picks.push(pick)
    total += end - start
  }

  if (!picks.length && analyses[0]) {
    const a = analyses[0]!
    const dur = ROUND(Math.min(a.duration, effectiveCap, 4))
    if (dur >= 0.35) {
      picks.push({
        srcIndex: a.src_index ?? 0,
        start: 0,
        end: dur,
        reason: a.title || "영상 장면",
      })
      total = dur
    }
  }

  return {
    sourceCount: analyses.length,
    targetDuration,
    actualDuration: ROUND(total),
    picks,
  }
}

export function buildEmergencyEditPlan(
  allAnalyses: VideoAnalysis[],
  videoIds: string[],
  targetDuration: AutoEditTargetDuration
): { mixInfo: MixInfo; editPlan: EditPlan } | null {
  const analyses = filterAnalysesForEmergencyEdit(allAnalyses)
  if (!analyses.length) return null

  const mixInfo = buildEmergencyMix(analyses, targetDuration)
  if (!mixInfo.picks.length) return null

  let editPlan = mixPicksToEditPlan(mixInfo, videoIds, targetDuration)
  editPlan = enrichEditPlanWithVisualReasons(sanitizeEditPlanSegmentsRelaxed(editPlan, analyses), analyses)

  const outputSec = editPlanOutputSeconds(editPlan)
  if (outputSec < EMERGENCY_MIN_OUTPUT_SECONDS) return null

  return {
    mixInfo: { ...mixInfo, actualDuration: ROUND(outputSec) },
    editPlan,
  }
}

/** 목표 미달·장면 부족 시 긴급 폴백으로 짧은 영상이라도 생성 */
export function ensureEditPlanOrEmergencyFallback(args: {
  mix: MixInfo
  analyses: VideoAnalysis[]
  allAnalyses: VideoAnalysis[]
  videoIds: string[]
  targetDuration: AutoEditTargetDuration
}): { mixInfo: MixInfo; editPlan: EditPlan; usedEmergency: boolean } {
  let { mixInfo, editPlan } = buildEditPlanFromMix(
    args.mix,
    args.analyses,
    args.videoIds,
    args.targetDuration
  )
  const meetsDuration = editPlan.edit_plan.length > 0 && editPlanMeetsTargetDuration(editPlan)
  const isRealMix = isRealMixEditPlan(editPlan, args.analyses)

  if (meetsDuration && isRealMix) {
    editPlan = forceFillEditPlanToTarget(editPlan, args.analyses)
    editPlan = ensureJumpCutEditPlan(editPlan, args.analyses)
    mixInfo = syncMixInfoFromEditPlan(mixInfo, editPlan, args.analyses)
    return { mixInfo, editPlan, usedEmergency: false }
  }

  if (meetsDuration && !isRealMix) {
    const scenePlan = buildSceneBasedEditPlan(args.analyses, args.targetDuration)
    const filledScene = forceFillEditPlanToTarget(
      ensureJumpCutEditPlan(scenePlan, args.analyses),
      args.analyses
    )
    if (editPlanTotalOutputSeconds(filledScene) >= args.targetDuration * TARGET_FILL_MIN_RATIO - 0.15) {
      return {
        mixInfo: syncMixInfoFromEditPlan(mixInfo, filledScene, args.analyses),
        editPlan: filledScene,
        usedEmergency: false,
      }
    }
  }

  const emergency = buildEmergencyEditPlan(args.allAnalyses, args.videoIds, args.targetDuration)
  if (emergency?.editPlan.edit_plan.length) {
    const filled = forceFillEditPlanToTarget(
      ensureJumpCutEditPlan(emergency.editPlan, args.analyses),
      args.analyses
    )
    return {
      mixInfo: syncMixInfoFromEditPlan(emergency.mixInfo, filled, args.analyses),
      editPlan: filled,
      usedEmergency: true,
    }
  }

  if (editPlan.edit_plan.length > 0) {
    editPlan = forceFillEditPlanToTarget(editPlan, args.analyses)
    editPlan = ensureJumpCutEditPlan(editPlan, args.analyses)
    const filledSec = editPlanTotalOutputSeconds(editPlan)
    if (filledSec >= args.targetDuration * TARGET_FILL_MIN_RATIO - 0.15) {
      return {
        mixInfo: syncMixInfoFromEditPlan(mixInfo, editPlan, args.analyses),
        editPlan,
        usedEmergency: false,
      }
    }
  }

  const scenePlan = buildSceneBasedEditPlan(args.analyses, args.targetDuration)
  const filledScene = forceFillEditPlanToTarget(
    ensureJumpCutEditPlan(scenePlan, args.analyses),
    args.analyses
  )
  if (editPlanTotalOutputSeconds(filledScene) >= args.targetDuration * TARGET_FILL_MIN_RATIO - 0.15) {
    return {
      mixInfo: syncMixInfoFromEditPlan(mixInfo, filledScene, args.analyses),
      editPlan: filledScene,
      usedEmergency: false,
    }
  }

  throw new Error(AUTO_EDIT_NO_USABLE_VIDEO_MESSAGE)
}

const PRESENTER_PICK_DESC =
  /카메라.*응시|카메라를?\s*바라보며|바라보며\s*(말|설명|소개)|인물.?소개|口播|露脸|talking.?head|립싱크|lip\s*sync|직접\s*소개|对着镜头/i

async function openaiJson<T>(apiKey: string, system: string, user: string, maxTokens = 2000): Promise<T> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: maxTokens,
      response_format: { type: "json_object" as const },
      messages: [
        { role: "system" as const, content: system },
        { role: "user" as const, content: user },
      ],
    }),
    signal: AbortSignal.timeout(90_000),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => "")
    throw new Error(`OpenAI 실패 (${res.status}): ${t.slice(0, 180)}`)
  }
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error("OpenAI 응답이 비어 있습니다.")
  return JSON.parse(content) as T
}

function pickKey(p: MixPick): string {
  return `${p.srcIndex}:${ROUND(p.start)}:${ROUND(p.end)}`
}

function isPickSafe(pick: MixPick, analysis: VideoAnalysis | undefined): boolean {
  if (!analysis) return false
  if (pick.end <= pick.start || pick.end - pick.start > 5) return false
  if (pick.start < 0 || pick.end > analysis.duration + 0.5) return false
  return pickIntervalIsProductSafe(analysis, pick.start, pick.end, pick.reason)
}

function scenePoolForAnalysis(a: VideoAnalysis): VideoAnalysis["scenes"] {
  const safe = filteredScenesForMixPick(a)
  if (safe.length) return safe
  return []
}

/** mix picks → ffmpeg 편집 지시서 (pick 1회씩만 사용 — 동일 컷 순환 금지) */
export function mixPicksToEditPlan(
  mix: MixInfo,
  videoIds: string[],
  targetDuration: AutoEditTargetDuration
): EditPlan {
  const edit_plan: EditPlan["edit_plan"] = []
  let outCursor = 0

  if (!mix.picks.length) {
    return { target_duration: targetDuration, edit_plan }
  }

  for (const pick of mix.picks) {
    if (outCursor >= targetDuration - 0.02) break
    const video_id = videoIds[pick.srcIndex]
    if (!video_id) continue

    const srcAvail = Math.max(0.2, pick.end - pick.start)
    const clipDur = Math.min(srcAvail, targetDuration - outCursor)
    if (clipDur < 0.15) continue

    edit_plan.push({
      video_id,
      source_start: ROUND(pick.start),
      source_end: ROUND(pick.start + clipDur),
      output_start: ROUND(outCursor),
      output_end: ROUND(outCursor + clipDur),
      reason: pick.reason,
    })
    outCursor += clipDur
  }

  if (edit_plan.length) {
    const last = edit_plan[edit_plan.length - 1]!
    if (last.output_end > targetDuration + 0.05) {
      last.output_end = ROUND(targetDuration)
      last.source_end = ROUND(last.source_start + (last.output_end - last.output_start))
    }
  }

  return { target_duration: targetDuration, edit_plan }
}

/** picks 정규화 — 중복·얼굴·길이 보정 */
export function finalizeMixPicks(
  raw: MixPick[],
  analyses: VideoAnalysis[],
  targetDuration: AutoEditTargetDuration
): MixInfo {
  const bySrc = new Map(analyses.map((a) => [a.src_index ?? 0, a]))
  const seen = new Set<string>()
  const picks: MixPick[] = []
  let total = 0
  let lastSrc = -1

  for (const row of raw) {
    if (total >= targetDuration - 0.05) break

    const pick: MixPick = {
      srcIndex: Math.max(0, Math.floor(row.srcIndex)),
      start: ROUND(row.start),
      end: ROUND(row.end),
      reason: String(row.reason || "").trim() || "제품 장면",
    }

    let dur = pick.end - pick.start
    if (dur < 0.8) continue
    if (dur > 3.5) {
      pick.end = ROUND(pick.start + 3)
      dur = pick.end - pick.start
    }

    const analysis = bySrc.get(pick.srcIndex)
    if (!isPickSafe(pick, analysis)) continue

    const key = pickKey(pick)
    if (seen.has(key)) continue
    if (picks.some((existing) => mixPicksTooClose(existing, pick, 2.5))) continue
    seen.add(key)

    if (total + dur > targetDuration) {
      pick.end = ROUND(pick.start + (targetDuration - total))
      dur = pick.end - pick.start
    }
    if (dur < 0.8) continue

    picks.push(pick)
    total += dur
    lastSrc = pick.srcIndex
  }

  let ordered = ensureHookFirstPick(reorderMixPicksProductFirst(picks, analyses), analyses)
  ordered = balanceMultiSourceMixPicks(ordered, analyses, targetDuration)
  ordered = ensureHookFirstPick(reorderMixPicksProductFirst(ordered, analyses), analyses)
  total = pickTotalDuration(ordered)

  return {
    sourceCount: analyses.length,
    targetDuration,
    actualDuration: ROUND(total),
    picks: ordered,
  }
}

function picksDurationBySrc(picks: MixPick[]): Map<number, number> {
  const m = new Map<number, number>()
  for (const p of picks) {
    m.set(p.srcIndex, (m.get(p.srcIndex) ?? 0) + (p.end - p.start))
  }
  return m
}

function maxConsecutiveSameSrc(picks: MixPick[]): number {
  let max = 1
  let streak = 1
  for (let i = 1; i < picks.length; i++) {
    if (picks[i]!.srcIndex === picks[i - 1]!.srcIndex) streak++
    else streak = 1
    max = Math.max(max, streak)
  }
  return max
}

/** 2개 이상 소스일 때 각 영상이 최소 비율·교차로 섞이도록 보정 */
function harvestPicksForSource(
  existing: MixPick[],
  analysis: VideoAnalysis,
  srcIndex: number,
  wantDur: number,
  minGapSec = 1.0
): MixPick[] {
  const harvested: MixPick[] = []
  let got = 0
  const seen = new Set(existing.map(pickKey))
  const pool = scenesForPickingDiverse(scenePoolForAnalysis(analysis))
  const clipLens = [1.5, 2.0, 2.4, 1.8, 2.2, 1.6]

  for (let si = 0; si < pool.length && got < wantDur + 0.1; si++) {
    const sc = pool[si]!
    for (let step = 0; step < 6 && got < wantDur + 0.1; step++) {
      const clipLen = clipLens[(harvested.length + step) % clipLens.length]!
      const span = Math.max(0.4, sc.end - sc.start - clipLen)
      const offset = (step * 2.3 + si * 1.1) % span
      const start = ROUND(Math.min(sc.start + offset, Math.max(0, analysis.duration - clipLen - 0.05)))
      const end = ROUND(Math.min(analysis.duration, start + clipLen))
      const pick: MixPick = {
        srcIndex,
        start,
        end,
        reason: describeSourceRangeFromAnalysis(analysis, start, end, sc.description).slice(0, 80) || "제품 장면",
      }
      if (seen.has(pickKey(pick)) || !isPickSafe(pick, analysis)) continue
      if ([...existing, ...harvested].some((e) => mixPicksTooClose(e, pick, minGapSec))) continue
      seen.add(pickKey(pick))
      harvested.push(pick)
      got += end - start
    }
  }
  return harvested
}

function balanceMultiSourceMixPicks(
  picks: MixPick[],
  analyses: VideoAnalysis[],
  targetDuration: number
): MixPick[] {
  if (analyses.length <= 1 || picks.length < 2) return picks

  const srcIndices = analyses.map((a, i) => a.src_index ?? i)
  const minShare = (targetDuration / analyses.length) * 0.25
  let working = picks.map((p) => ({ ...p }))
  let durBySrc = picksDurationBySrc(working)

  const underRep = srcIndices.filter((si) => (durBySrc.get(si) ?? 0) < minShare)
  const singleSource = new Set(working.map((p) => p.srcIndex)).size < Math.min(analyses.length, 2)
  const needsAlternation = maxConsecutiveSameSrc(working) > 2

  if (!underRep.length && !singleSource && !needsAlternation) return picks

  const harvestTargets =
    underRep.length > 0
      ? underRep
      : singleSource
        ? srcIndices.filter((si) => (durBySrc.get(si) ?? 0) < minShare)
        : []

  for (const si of harvestTargets) {
    const a = analyses.find((x, i) => (x.src_index ?? i) === si)
    if (!a) continue
    const need = minShare - (durBySrc.get(si) ?? 0)
    if (need <= 0.1) continue
    const extra = harvestPicksForSource(working, a, si, need + 1.2)
    if (extra.length) working.push(...extra)
    durBySrc = picksDurationBySrc(working)
  }

  let total = pickTotalDuration(working)
  while (total > targetDuration + 0.05 && working.length > 3) {
    let maxSi = srcIndices[0]!
    let maxDur = -1
    for (const si of srcIndices) {
      const d = durBySrc.get(si) ?? 0
      if (d > maxDur) {
        maxDur = d
        maxSi = si
      }
    }
    const removable = working
      .map((p, i) => ({ p, i }))
      .filter(({ p, i }) => p.srcIndex === maxSi && i > 0)
    const victim = removable.at(-1)
    if (!victim) break
    working.splice(victim.i, 1)
    total = pickTotalDuration(working)
    durBySrc = picksDurationBySrc(working)
  }

  working = reorderMixPicksProductFirst(working, analyses)
  total = pickTotalDuration(working)
  if (total > targetDuration + 0.05 && working.length) {
    const last = working[working.length - 1]!
    last.end = ROUND(Math.max(last.start + 0.8, last.end - (total - targetDuration)))
    if (last.end - last.start < 0.8) working.pop()
  }

  return working.length >= 2 ? working : picks
}

function pickTotalDuration(picks: MixPick[]): number {
  return picks.reduce((s, p) => s + (p.end - p.start), 0)
}

function minimumPickCountForTarget(targetDuration: number): number {
  return Math.ceil(targetDuration / 2.4)
}

/** 편집 지시서 → mix picks (UI·대본 동기화) */
export function mixPicksFromEditPlan(editPlan: EditPlan, analyses: VideoAnalysis[]): MixInfo {
  const byId = new Map(analyses.map((a) => [a.video_id, a]))
  const picks: MixPick[] = editPlan.edit_plan.map((seg) => {
    const a = byId.get(seg.video_id) ?? analyses[0]!
    return {
      srcIndex: a.src_index ?? 0,
      start: ROUND(seg.source_start),
      end: ROUND(seg.source_end),
      reason: seg.reason || "제품 장면",
    }
  })
  return {
    sourceCount: analyses.length,
    targetDuration: editPlan.target_duration,
    actualDuration: ROUND(editPlanTotalOutputSeconds(editPlan)),
    picks,
  }
}

function syncMixInfoFromEditPlan(mixInfo: MixInfo, editPlan: EditPlan, analyses: VideoAnalysis[]): MixInfo {
  const synced = mixPicksFromEditPlan(editPlan, analyses)
  return {
    ...mixInfo,
    picks: synced.picks,
    targetDuration: synced.targetDuration,
    actualDuration: synced.actualDuration,
  }
}

/** 분석 장면을 슬라이스해 서로 다른 소스 구간 pick을 최대한 수확 */
function harvestUniquePicksFromAnalyses(
  existing: MixPick[],
  analyses: VideoAnalysis[],
  targetDuration: number,
  minGapSec = 0.8
): MixPick[] {
  const picks = [...existing]
  let total = pickTotalDuration(picks)
  if (total >= targetDuration - 0.08) return picks

  const seen = new Set(picks.map(pickKey))
  const clipLens = [1.5, 1.8, 2.0, 2.2, 2.5, 2.8, 1.6, 2.4]

  for (let pass = 0; pass < 4 && total < targetDuration - 0.08 && picks.length < 55; pass++) {
    const gap = pass >= 2 ? 0.5 : minGapSec
    for (let ai = 0; ai < analyses.length; ai++) {
      const a = analyses[ai]!
      if (total >= targetDuration - 0.08) break
      const srcIndex = a.src_index ?? ai
      const pool = scenesForPickingDiverse(scenePoolForAnalysis(a))
      for (let si = 0; si < pool.length && total < targetDuration - 0.08; si++) {
        const sc = pool[si]!
        const clipLen = clipLens[(picks.length + si) % clipLens.length]!
        const sceneLen = sc.end - sc.start
        if (sceneLen < clipLen + 0.25) continue
        const sliceCount = Math.max(1, Math.min(8, Math.floor((sceneLen - clipLen) / 1.0) + 1))
        for (let sl = 0; sl < sliceCount && total < targetDuration - 0.08; sl++) {
          const span = Math.max(0.25, sceneLen - clipLen)
          const offset = sliceCount <= 1 ? 0 : (span * sl) / (sliceCount - 1)
          const start = ROUND(Math.min(sc.start + offset, Math.max(0, a.duration - clipLen - 0.05)))
          const end = ROUND(Math.min(a.duration, start + clipLen))
          const pick: MixPick = {
            srcIndex,
            start,
            end,
            reason: describeSourceRangeFromAnalysis(a, start, end, sc.description).slice(0, 80) || "제품 장면",
          }
          if (seen.has(pickKey(pick)) || !isPickSafe(pick, a)) continue
          if (picks.some((e) => mixPicksTooClose(e, pick, gap))) continue
          seen.add(pickKey(pick))
          picks.push(pick)
          total += end - start
        }
      }
    }
  }

  return picks
}

function ensureEnoughUniqueMixPicks(
  picks: MixPick[],
  analyses: VideoAnalysis[],
  targetDuration: number
): MixPick[] {
  let result = picks.map((p) => ({ ...p }))
  let total = pickTotalDuration(result)
  const minPicks = minimumPickCountForTarget(targetDuration)

  while (total < targetDuration - 0.08 && result.length < 55) {
    const before = result.length
    result = harvestUniquePicksFromAnalyses(result, analyses, targetDuration)
    total = pickTotalDuration(result)
    if (result.length === before) break
  }

  while ((total < targetDuration - 0.08 || result.length < minPicks) && result.length < 55) {
    const added = tryAddFillPick(result, analyses, targetDuration - total, 0.6)
    if (!added) break
    result.push(added)
    total = pickTotalDuration(result)
  }

  while (total < targetDuration - 0.08 && result.length < 55) {
    const before = result.length
    result = bruteForceAddMixPicks(result, analyses, targetDuration)
    total = pickTotalDuration(result)
    if (result.length === before) break
  }

  return result
}

/** fill 실패 시 장면 전수 탐색으로 pick 추가 */
function bruteForceAddMixPicks(
  existing: MixPick[],
  analyses: VideoAnalysis[],
  targetDuration: number
): MixPick[] {
  const picks = [...existing]
  let total = pickTotalDuration(picks)
  if (total >= targetDuration - 0.08) return picks

  const seen = new Set(picks.map(pickKey))
  const clipLens = [1.5, 2, 2.5, 1.8, 2.2]

  for (let ai = 0; ai < analyses.length; ai++) {
    const a = analyses[ai]!
    if (total >= targetDuration - 0.08) break
    const srcIndex = a.src_index ?? ai
    const pool = scenesForPickingDiverse(scenePoolForAnalysis(a))
    if (!pool.length) continue
    for (let si = 0; si < pool.length && total < targetDuration - 0.08; si++) {
      const sc = pool[si]!
      for (let step = 0; step < 6 && total < targetDuration - 0.08; step++) {
        const clipLen = clipLens[(picks.length + step) % clipLens.length]!
        const span = Math.max(0.4, sc.end - sc.start - clipLen)
        const offset = (step * 2.1 + si * 1.3) % span
        const start = ROUND(Math.min(sc.start + offset, Math.max(0, a.duration - clipLen - 0.05)))
        const end = ROUND(Math.min(a.duration, start + clipLen))
        const pick: MixPick = {
          srcIndex,
          start,
          end,
          reason: describeSourceRangeFromAnalysis(a, start, end, sc.description).slice(0, 80) || "제품 장면",
        }
        if (seen.has(pickKey(pick)) || !isPickSafe(pick, a)) continue
        if (picks.some((e) => mixPicksTooClose(e, pick, 1))) continue
        seen.add(pickKey(pick))
        picks.push(pick)
        total += end - start
      }
    }
  }

  return picks
}

/** 부족한 초를 채울 추가 pick 생성 */
function tryAddFillPick(
  existing: MixPick[],
  analyses: VideoAnalysis[],
  needSec: number,
  minGapSec = 1.2
): MixPick | null {
  const wantDur = Math.min(2.8, Math.max(1.0, needSec))
  const seen = new Set(existing.map(pickKey))
  const lastSrc = existing.at(-1)?.srcIndex

  for (let attempt = 0; attempt < analyses.length * 24; attempt++) {
    const preferIdx =
      lastSrc != null && analyses.length > 1
        ? (lastSrc + 1 + attempt) % analyses.length
        : attempt % analyses.length
    const a = analyses[preferIdx]!
    const srcIndex = a.src_index ?? preferIdx
    const pool = scenesForPickingDiverse(scenePoolForAnalysis(a))
    if (!pool.length) continue
    const usedFromSrc = existing.filter((p) => p.srcIndex === srcIndex).length
    const sc = pool[(usedFromSrc * 3 + attempt) % pool.length]!
    const span = Math.max(0.5, sc.end - sc.start - wantDur)
    const offset = (usedFromSrc * 4.2 + attempt * 1.7) % span
    const start = ROUND(Math.min(sc.start + offset, Math.max(0, a.duration - wantDur - 0.1)))
    const end = ROUND(Math.min(a.duration, start + wantDur))

    const pick: MixPick = {
      srcIndex,
      start,
      end,
      reason: describeSourceRangeFromAnalysis(a, start, end, sc.description).slice(0, 80) || "제품 장면",
    }
    if (
      seen.has(pickKey(pick)) ||
      !isPickSafe(pick, a) ||
      existing.some((e) => mixPicksTooClose(e, pick, minGapSec))
    ) {
      continue
    }
    return pick
  }
  return null
}

/** mix picks 합계를 목표 쇼츠 길이에 정확히 맞춤 */
export function fillMixToTargetDuration(
  mix: MixInfo,
  analyses: VideoAnalysis[],
  targetDuration: AutoEditTargetDuration
): MixInfo {
  const picks = mix.picks.map((p) => ({ ...p }))
  let total = pickTotalDuration(picks)

  if (total > targetDuration + 0.05) {
    while (picks.length && total > targetDuration + 0.05) {
      const last = picks[picks.length - 1]!
      const excess = total - targetDuration
      const newEnd = ROUND(Math.max(last.start + 0.8, last.end - excess))
      last.end = newEnd
      if (last.end - last.start < 0.8) picks.pop()
      total = pickTotalDuration(picks)
    }
  }

  while (total < targetDuration - 0.08 && picks.length < 45) {
    const need = targetDuration - total
    const added = tryAddFillPick(picks, analyses, need)
    if (!added) break
    picks.push(added)
    total = pickTotalDuration(picks)
  }

  picks.splice(0, picks.length, ...ensureEnoughUniqueMixPicks(picks, analyses, targetDuration))
  total = pickTotalDuration(picks)

  if (total > targetDuration + 0.05) {
    while (picks.length && total > targetDuration + 0.05) {
      const last = picks[picks.length - 1]!
      const excess = total - targetDuration
      last.end = ROUND(Math.max(last.start + 0.8, last.end - excess))
      if (last.end - last.start < 0.8) picks.pop()
      total = pickTotalDuration(picks)
    }
  }

  for (const p of picks) {
    if (p.end - p.start > 3.5) p.end = ROUND(p.start + 3)
  }
  total = pickTotalDuration(picks)

  if (total < targetDuration - 0.15) {
    picks.splice(0, picks.length, ...ensureEnoughUniqueMixPicks(picks, analyses, targetDuration))
    total = pickTotalDuration(picks)
  }

  if (picks.length && total > targetDuration + 0.05) {
    const last = picks[picks.length - 1]!
    const excess = total - targetDuration
    last.end = ROUND(Math.max(last.start + 0.8, last.end - excess))
    total = pickTotalDuration(picks)
  }

  let balanced = balanceMultiSourceMixPicks(picks, analyses, targetDuration)
  balanced = ensureHookFirstPick(reorderMixPicksProductFirst(balanced, analyses), analyses)
  total = pickTotalDuration(balanced)

  return {
    ...mix,
    picks: balanced,
    targetDuration,
    actualDuration: ROUND(Math.min(targetDuration, total)),
  }
}

/** 편집 지시서 output 타임라인 = 목표 길이에 맞게 마지막 컷만 트림 (동일 컷 순환 금지) */
export function ensureEditPlanExactDuration(plan: EditPlan, analyses: VideoAnalysis[]): EditPlan {
  const target = plan.target_duration
  if (!plan.edit_plan.length) return plan

  const byId = new Map(analyses.map((a) => [a.video_id, a]))
  const edit_plan: EditPlan["edit_plan"] = []
  let outCursor = 0

  for (const seg of plan.edit_plan) {
    const analysis = byId.get(seg.video_id)
    const srcSpan = Math.max(0.2, seg.source_end - seg.source_start)
    const maxFromFile = analysis
      ? Math.max(0.2, analysis.duration - seg.source_start)
      : srcSpan
    const dur = Math.min(srcSpan, maxFromFile, seg.output_end - seg.output_start)
    if (dur < 0.15) continue

    edit_plan.push({
      ...seg,
      source_start: ROUND(seg.source_start),
      source_end: ROUND(seg.source_start + dur),
      output_start: ROUND(outCursor),
      output_end: ROUND(outCursor + dur),
    })
    outCursor += dur
  }

  if (!edit_plan.length) return plan

  const last = edit_plan[edit_plan.length - 1]!
  if (last.output_end > target + 0.05) {
    last.output_end = ROUND(target)
    last.source_end = ROUND(last.source_start + (last.output_end - last.output_start))
  }

  return { target_duration: target, edit_plan }
}

/** 각 편집 컷 소스 시각의 실제 프레임을 Vision으로 캡션 — 짜집기 장면 분석 정확도 */
export async function enrichEditPlanWithCutCaptions(args: {
  apiKey: string
  editPlan: EditPlan
  analyses: VideoAnalysis[]
  sourcePaths: Record<string, string>
  workDir: string
  titles?: Record<string, string>
}): Promise<{ editPlan: EditPlan; analyses: VideoAnalysis[] }> {
  const { captionEditPlanCuts } = await import("@/lib/shotform-auto-edit-vision")
  let editPlan = args.editPlan
  const analyses = args.analyses.map((a) => ({ ...a, vision_frames: [...(a.vision_frames ?? [])] }))

  for (const a of analyses) {
    const sourcePath = args.sourcePaths[a.video_id]
    if (!sourcePath) continue
    const cuts = editPlan.edit_plan.filter((s) => s.video_id === a.video_id)
    if (!cuts.length) continue

    const captions = await captionEditPlanCuts({
      apiKey: args.apiKey,
      title: args.titles?.[a.video_id] || a.title || "쇼핑 숏폼",
      sourcePath,
      workDir: path.join(args.workDir, `cut_caption_${a.video_id}`),
      duration: a.duration,
      cuts,
    })

    editPlan = {
      ...editPlan,
      edit_plan: editPlan.edit_plan.map((seg) => {
        if (seg.video_id !== a.video_id) return seg
        const mid = ((seg.source_start + seg.source_end) / 2).toFixed(2)
        const cap = captions.get(mid)
        if (!cap) return seg
        return { ...seg, visual_caption: cap, reason: cap.slice(0, 120) }
      }),
    }

    const ai = analyses.find((x) => x.video_id === a.video_id)
    if (ai) {
      for (const [t, cap] of captions) {
        const timeSec = Number(t)
        const row = ai.vision_frames!.find((f) => Math.abs(f.timeSec - timeSec) < 0.06)
        if (row) row.caption = cap
        else ai.vision_frames!.push({ timeSec, content_type: "product_in_use", caption: cap })
      }
      ai.vision_frames!.sort((x, y) => x.timeSec - y.timeSec)
    }
  }

  return { editPlan, analyses }
}

function applyStoryFlowToMix(
  mixInfo: MixInfo,
  analyses: VideoAnalysis[],
  targetDuration: AutoEditTargetDuration
): MixInfo {
  return {
    ...mixInfo,
    picks: reorderMixPicksByStoryFlow(
      mixInfo.picks,
      analyses,
      targetDuration,
      analyses[0]?.videoStructure
    ),
  }
}

/** mix → 편집 지시서 (목표 길이에 맞게 picks·타임라인 정규화) */
export function buildEditPlanFromMix(
  mix: MixInfo,
  analyses: VideoAnalysis[],
  videoIds: string[],
  targetDuration: AutoEditTargetDuration
): { mixInfo: MixInfo; editPlan: EditPlan } {
  let mixInfo = applyStoryFlowToMix(
    enrichMixPicksWithVisualReasons(fillMixToTargetDuration(mix, analyses, targetDuration), analyses),
    analyses,
    targetDuration
  )
  let editPlan = mixPicksToEditPlan(mixInfo, videoIds, targetDuration)
  editPlan = enrichEditPlanWithVisualReasons(
    sanitizeEditPlanSegments(ensureEditPlanExactDuration(editPlan, analyses), analyses),
    analyses
  )

  for (let attempt = 0; attempt < 2; attempt++) {
    const end = editPlan.edit_plan.at(-1)?.output_end ?? 0
    if (end >= targetDuration - 0.15) break
    mixInfo = applyStoryFlowToMix(
      enrichMixPicksWithVisualReasons(fillMixToTargetDuration(mixInfo, analyses, targetDuration), analyses),
      analyses,
      targetDuration
    )
    editPlan = enrichEditPlanWithVisualReasons(
      sanitizeEditPlanSegments(
        ensureEditPlanExactDuration(mixPicksToEditPlan(mixInfo, videoIds, targetDuration), analyses),
        analyses
      ),
      analyses
    )
  }

  const actualEnd = editPlanTotalOutputSeconds(editPlan)
  mixInfo = {
    ...mixInfo,
    targetDuration,
    actualDuration: ROUND(Math.min(targetDuration, actualEnd)),
  }

  editPlan = forceFillEditPlanToTarget(editPlan, analyses)
  editPlan = ensureJumpCutEditPlan(editPlan, analyses)
  mixInfo = syncMixInfoFromEditPlan(mixInfo, editPlan, analyses)

  return { mixInfo, editPlan }
}

export function buildFallbackMix(analyses: VideoAnalysis[], targetDuration: AutoEditTargetDuration): MixInfo {
  const picks: MixPick[] = []
  let total = 0
  const clipLens = [1.4, 1.8, 2.2, 2.6, 2.0, 1.6]
  let attempt = 0

  while (total < targetDuration - 0.05 && picks.length < 28 && attempt < analyses.length * 40) {
    attempt++
    const slot = picks.length
    const a = analyses[slot % analyses.length]!
    const srcIndex = a.src_index ?? slot % analyses.length
    const clipLen = clipLens[slot % clipLens.length]!
    const pool = scenesForPickingDiverse(scenePoolForAnalysis(a))
    if (!pool.length) continue
    const usedFromSrc = picks.filter((p) => p.srcIndex === srcIndex).length
    const sc = pool[(usedFromSrc * 3 + slot) % pool.length]!
    const span = Math.max(0.6, sc.end - sc.start - clipLen)
    const offset = (usedFromSrc * 5 + slot * 2.3) % span
    const start = ROUND(Math.min(sc.start + offset, Math.max(0, a.duration - clipLen - 0.1)))
    const end = ROUND(start + clipLen)

    const pick: MixPick = {
      srcIndex,
      start,
      end,
      reason: describeSourceRangeFromAnalysis(a, start, end, sc.description).slice(0, 80) || "제품 장면",
    }
    if (!isPickSafe(pick, a) || picks.some((p) => mixPicksTooClose(p, pick, 2.5))) continue

    picks.push(pick)
    total += end - start
  }

  return finalizeMixPicks(picks, analyses, targetDuration)
}

function sanitizeEditPlanSegments(plan: EditPlan, analyses: VideoAnalysis[]): EditPlan {
  const byId = new Map(analyses.map((a) => [a.video_id, a]))
  const kept: EditPlan["edit_plan"] = []
  let cursor = 0

  for (const seg of plan.edit_plan) {
    const analysis = byId.get(seg.video_id)
    if (!analysis) continue
    if (!pickIntervalIsProductSafe(analysis, seg.source_start, seg.source_end, seg.reason)) continue
    const dur = Math.max(0.25, seg.source_end - seg.source_start)
    kept.push({
      ...seg,
      output_start: ROUND(cursor),
      output_end: ROUND(cursor + dur),
    })
    cursor += dur
  }

  return { target_duration: plan.target_duration, edit_plan: kept }
}

/** 2단계 — 분석 결과 기반 mix picks (벤치마크 mixInfo) */
export async function createMixPlanWithAi(args: {
  apiKey: string
  analyses: VideoAnalysis[]
  productAnalysis: ProductAnalysis
  targetDuration: AutoEditTargetDuration
}): Promise<MixInfo> {
  const { apiKey, analyses, productAnalysis, targetDuration } = args
  const multi = analyses.length > 1
  const pickCount = Math.ceil(targetDuration / 1.5)

  const sources = analyses.map((a) => ({
    srcIndex: a.src_index ?? 0,
    duration: a.duration,
    title: a.title,
    scenes: compactScenesForMixPrompt(a),
  }))

  try {
    const parsed = await openaiJson<{ picks?: unknown }>(
      apiKey,
      `쇼핑 숏폼 영상 편집 PD (벤치마킹 프로그램 방식). JSON만 출력. **대본 작성 금지** — mix picks만.

목표: 최종 **약 ${targetDuration}초** 짜집기 (picks 합계 ${targetDuration}~${targetDuration + 5}초 허용).
picks[]: srcIndex(0부터), start, end(소스 영상 초), reason(한국어 한 줄).

규칙:
- pick당 **2~3.5초**. 약 ${pickCount}~${pickCount + 4}개 picks.
- **전체 영상을 1개 pick(0~끝)으로 덮지 말 것** — 최소 ${Math.max(2, Math.ceil(targetDuration / 3))}개 picks 필수.
- scenes에 있는 **의미 장면** 안에서 start/end를 고를 것 (촘촘한 키프레임 나열 금지).
- 인물·제품·설치·시연·결과 화면 모두 사용 가능 (口播·인물 장면도 허용).
- **첫 pick**: 후킹(투사 화면·임팩트 데모). 이후 기능→설치→화질→마무리 흐름.
- 동일 (srcIndex,start,end) 중복 금지.
${multi ? `- ${analyses.length}개 소스 — srcIndex를 번갈아 사용 (A→B→C→A…).` : ""}`,
      `제품: ${productAnalysis.productName}
카테고리: ${productAnalysis.category}
요약: ${productAnalysis.summary}

소스 영상 분석:
${JSON.stringify(sources, null, 0)}

JSON: {"picks":[{"srcIndex":0,"start":0,"end":2,"reason":"제품 클로즈업 — 핵심 기능"}]}`,
      multi ? 2500 : 2000
    )

    const raw: MixPick[] = []
    if (Array.isArray(parsed.picks)) {
      for (const row of parsed.picks) {
        if (!row || typeof row !== "object") continue
        const o = row as Record<string, unknown>
        const srcIndex = Number(o.srcIndex)
        const start = Number(o.start)
        const end = Number(o.end)
        const reason = String(o.reason || "").trim()
        if (!Number.isFinite(srcIndex) || !Number.isFinite(start) || !Number.isFinite(end)) continue
        if (end <= start) continue
        raw.push({ srcIndex: Math.floor(srcIndex), start, end, reason: reason || "제품 장면" })
      }
    }

    if (raw.length) {
      const hasOversizedPick = raw.some((p) => p.end - p.start > 4.5)
      const rawTotal = raw.reduce((s, p) => s + (p.end - p.start), 0)
      if (raw.length >= 2 && !hasOversizedPick && rawTotal >= targetDuration - 4) {
        let mix = finalizeMixPicks(raw, analyses, targetDuration)
        mix = fillMixToTargetDuration(mix, analyses, targetDuration)
        const srcUsed = new Set(mix.picks.map((p) => p.srcIndex)).size
        if (multi && srcUsed < analyses.length) {
          mix = fillMixToTargetDuration(buildFallbackMix(analyses, targetDuration), analyses, targetDuration)
        }
        if (mix.picks.length >= 2 && mix.actualDuration >= targetDuration - 2) return mix
      }
    }
  } catch {
    /* fallback */
  }

  return fillMixToTargetDuration(buildFallbackMix(analyses, targetDuration), analyses, targetDuration)
}

function alignShoppingScriptToEditCuts(
  script: ShoppingScript,
  editPlan: EditPlan,
  analyses: VideoAnalysis[],
  productName?: string
): ShoppingScript {
  const segments = buildNarrationSegmentsFromEditPlan(
    editPlan,
    analyses,
    script.script,
    productName,
    script.bundle?.sceneSubtitles?.conversion
  )
  const plan = editPlan.edit_plan
  const scriptLines: ScriptLine[] = segments.map((seg, i) => ({
    start: seg.start,
    end: seg.end,
    text: seg.text,
    video_id: plan[i]?.video_id,
  }))
  return { ...script, script: scriptLines }
}

async function tryGenerateNaturalShortsScript(args: {
  apiKey: string
  storyTopic: string
  productAnalysis: ProductAnalysis
  editPlan: EditPlan
  analyses: VideoAnalysis[]
  mixInfo: MixInfo
}): Promise<ShoppingScript | null> {
  const { apiKey, storyTopic, productAnalysis, editPlan, analyses, mixInfo } = args
  const cuts = buildCutScriptContexts(editPlan, analyses, mixInfo)
  if (!cuts.length) return null

  const sceneMetas = buildCutNarrationSceneMetas(
    cuts,
    {
      keywords: productAnalysis.targetKeywords,
      summary: productAnalysis.summary,
      category: productAnalysis.category,
    },
    analyses
  )

  const sourceVideosBlock = buildSourceVideosNarrationBlock(analyses)
  const vs = productAnalysis.videoStructure
  const productContext = [
    `제품명: ${productAnalysis.productName}`,
    `스토리 주제: ${storyTopic}`,
    productAnalysis.category ? `카테고리: ${productAnalysis.category}` : "",
    productAnalysis.summary ? `요약: ${productAnalysis.summary}` : "",
    vs?.hook ? `후킹 방향: ${vs.hook}` : "",
    vs?.body ? `본문 방향: ${vs.body}` : "",
    vs?.cta ? `마무리/CTA: ${vs.cta}` : "",
    analyses.map((a) => `[${a.video_id}] ${a.title}`).join("\n"),
    sourceVideosBlock,
  ]
    .filter(Boolean)
    .join("\n")

  const parsed = await openaiJson<{ lines?: unknown }>(
    apiKey,
    buildNaturalShortsNarrationSystemPrompt({ cutCount: cuts.length, mode: "generate" }),
    buildNaturalShortsNarrationUserPrompt({
      topic: storyTopic,
      productName: productAnalysis.productName,
      productContext,
      cutsBlock: buildNarrationCutsPromptBlock(
        cuts,
        true,
        sceneMetas,
        productAnalysis.targetKeywords
      ),
      cutCount: cuts.length,
      mode: "generate",
    }),
    4000
  )

  const rawLines = alignNarrationLinesToCuts(
    parseNarrationLinesFromAi(parsed.lines),
    cuts,
    productAnalysis.productName
  )
  if (!rawLines.length) return null

  const polishedRaw = limitConnectorsAcrossScript(
    polishCutNarrationLines(
      rawLines.map((line) => stripLeadingNarrationConnector(line)),
      cuts.map((c) => ({ visual_card: c.visual_card, duration: c.duration })),
      productAnalysis.productName,
      { allowTemplateFallback: false, fitToDuration: false, sceneMetas, userKeywords: productAnalysis.targetKeywords }
    )
  )
  const polished = polishedRaw.map((text, i) => {
    let t = ensureNaturalShortsCtaOnLastLine(text, i === polishedRaw.length - 1)
    if (narrationLooksIncomplete(t.replace(/\n/g, " "))) {
      t = rephraseSceneToShoppingNarrationVariant(
        cuts[i]!.visual_card,
        productAnalysis.productName,
        cuts[i]!.duration,
        i + 21
      )
      t = sanitizeNarrationForOutput(t)
    }
    return t
  })

  const scenes: SceneSubtitleBlock[] = cuts.map((c, i) => ({
    start: c.output_start,
    end: Math.min(editPlan.target_duration, c.output_end),
    text: polished[i]!,
  }))

  const bundle = assembleScriptBundleFromScenes(
    scenes,
    buildDefaultHeadcopies(productAnalysis.productName),
    String(productAnalysis.targetKeywords[0] || productAnalysis.category).trim()
  )

  return {
    tone: "쇼핑숏폼",
    bundle,
    script: scriptLinesFromSceneBlocks(scenes, editPlan),
  }
}

/** 4단계 — mix 완료 후 벤치마크 형식 스크립트 (sceneSubtitles 블록) */
export async function generateScriptFromMix(args: {
  apiKey: string
  productAnalysis: ProductAnalysis
  mixInfo: MixInfo
  editPlan: EditPlan
  analyses: VideoAnalysis[]
  scriptTopic?: string
}): Promise<ShoppingScript> {
  const { apiKey, productAnalysis, mixInfo, editPlan, analyses, scriptTopic } = args
  const targetDuration = editPlan.target_duration
  const { topic: storyTopic, naturalShorts } = parseTopicWithStyleMode(
    scriptTopic?.trim() || productAnalysis.productName || ""
  )

  if (naturalShorts && storyTopic) {
    try {
      const nsScript = await tryGenerateNaturalShortsScript({
        apiKey,
        storyTopic,
        productAnalysis,
        editPlan,
        analyses,
        mixInfo,
      })
      if (nsScript) {
        return alignShoppingScriptToEditCuts(
          nsScript,
          editPlan,
          analyses,
          productAnalysis.productName
        )
      }
    } catch {
      /* 벤치마크 스키마 폴백 */
    }
  }

  const benchmarkScenes = buildBenchmarkSceneBlocksFromEditPlan(
    editPlan,
    analyses,
    mixInfo,
    productAnalysis.scenes
  )
  const sceneCount = benchmarkScenes.length
  const storyRoles = buildDesiredBeatSequence(sceneCount, targetDuration)

  try {
    const parsed = await openaiJson<{
      scripts?: { conversion?: string; storytelling?: string }
      headcopies?: unknown
      commentKeyword?: string
      sceneSubtitles?: { conversion?: unknown; storytelling?: unknown }
    }>(
      apiKey,
      `쇼핑숏폼 스크립트 작가. JSON만 출력. **벤치마크 프로그램과 동일 스키마**.

참고 예시 (25초 청소기 — 줄바꿈=자막 한 줄):
${benchmarkScriptFewShotJson()}

필수 JSON:
{
  "scripts": { "conversion": "sceneSubtitles.conversion의 text를 순서대로 \\n으로 이어붙인 전체", "storytelling": "sceneSubtitles.storytelling의 text를 순서대로 \\n으로 이어붙인 전체" },
  "headcopies": [["첫줄","둘째줄"], ...] 4~5세트 — **각 세트는 썸네일 위·아래 후킹, 합쳐 읽으면 한 메시지**,
  "commentKeyword": "키워드",
  "sceneSubtitles": {
    "conversion": [{"start":0,"end":12.5,"text":"줄1\\n줄2\\n..."}, ...] — **정확히 ${sceneCount}개**,
    "storytelling": [{"start":0,"end":5,"text":"..."}, ...] — **정확히 ${sceneCount}개**, conversion과 다른 어조(질문·공감·스토리)
  }
}

규칙:
- **전체가 한 편의 쇼핑숏폼**처럼 앞뒤가 이어져야 함 (장면별 독립 문장 나열 금지).
- **제품(${productAnalysis.productName})만** 홍보. 청소기·흡입·노즐·먼지 등 **다른 카테고리 언급 절대 금지** (거치대·홀더 제품이면 내비·고정·시야만).
- 아래 visual 블록 순서는 **이미 스토리 흐름**(후킹→소개→설치→데모→결과→마무리)에 맞게 짜집기된 타임라인임. 순서를 바꾸지 말고 이 흐름에 맞는 대본만 작성.
- 첫 장면: 후킹·관심, 중간: 기능·데모, 마지막: 정리·구매 욕구.
- sceneSubtitles.conversion[i].text = 해당 장면 visual에 맞는 **완결된 구어체 문장** (한 줄 10~20자, 끊긴 명사구·조사만 있는 줄 금지, 요/죠/네/다로 마무리). 다음 장면과 어색한 주제 점프 금지.
- 장면 길이(초)에 맞게 target_lines 개수 전후로 작성.
- scripts.conversion = 모든 장면 text를 \\n으로 연결 (장면 사이도 \\n, 추가 빈줄 없음).
- 장면 설명을 그대로 읽지 말고 구어체. 인물 얼굴 소개 금지. 같은 문구·패턴 반복 금지.
- **각 장면 visual에 보이는 동작·대상만** 말할 것. 화면에 없는 기능·스펙 지어내기 금지.
- 장면마다 **화면 키워드**를 최소 1개 이상 반영하고, 앞 장면과 같은 문장 구조 반복 금지.
- 마지막 scene end = ${targetDuration}.
${naturalShorts ? `
- **자연스러운 스토리형 모드** (주제: ${storyTopic})
- 구조: 초반 후킹(「이거 몰라서/저만 몰랐네요」) → 일상 갈등 → 제품 발견·설명 → 사용·결과 → 마지막 CTA 「${NATURAL_SHORTS_CTA}」
- **제품이 무엇인지·왜 쓰는지·효과**를 스토리에 반드시 포함 (제품 설명 생략 금지)
- **중국어·치수(cm/mm/m/인치) 절대 금지**` : ""}`,
      `제품: ${productAnalysis.productName}
${naturalShorts ? `스토리 주제: ${storyTopic}\n` : ""}카테고리: ${productAnalysis.category}
키워드: ${productAnalysis.targetKeywords.join(", ")}
요약: ${productAnalysis.summary}
목표 길이: ${targetDuration}초

출력 타임라인 장면 블록 (sceneSubtitles):
${JSON.stringify(
  benchmarkScenes.map((s, i) => ({
    start: s.start,
    end: s.end,
    duration: s.duration,
    target_lines: s.target_lines,
    story_role: storyRoles[i] ?? "demo",
    visual: s.visual_card,
  })),
  null,
  0
)}`,
      3600
    )

    let bundle = normalizeScriptBundle(parsed, targetDuration, productAnalysis)

    const aiScenes = normalizeSceneSubtitleBlocks(parsed.sceneSubtitles?.conversion, targetDuration)
    if (!bundle && aiScenes.length >= 2) {
      const headcopies = normalizeHeadcopies(parsed.headcopies)
      bundle = assembleScriptBundleFromScenes(
        aiScenes,
        headcopies.length >= 3 ? headcopies : buildDefaultHeadcopies(productAnalysis.productName),
        String(parsed.commentKeyword || productAnalysis.targetKeywords[0] || productAnalysis.category).trim()
      )
    }

    if (bundle) {
      const sceneContexts = bundle.sceneSubtitles.conversion.map((block, i) => {
        const hint = benchmarkScenes[i]
        return {
          visual_card: hint?.visual_card ?? block.text,
          duration: hint?.duration ?? block.end - block.start,
        }
      })
      const polishedTexts = limitConnectorsAcrossScript(
        polishCutNarrationLines(
          bundle.sceneSubtitles.conversion.map((b) =>
            stripLeadingNarrationConnector(sanitizeNarrationForOutput(b.text))
          ),
          sceneContexts,
          productAnalysis.productName,
          { allowTemplateFallback: false, fitToDuration: false, userKeywords: productAnalysis.targetKeywords }
        )
      )
      const scenes = bundle.sceneSubtitles.conversion.map((block, i) => {
        const hint = benchmarkScenes[i]
        const dur = hint?.duration ?? block.end - block.start
        return {
          ...block,
          text: formatSceneNarrationLines(polishedTexts[i] ?? block.text, dur),
        }
      })
      bundle = assembleScriptBundleFromScenes(
        scenes,
        bundle.headcopies,
        bundle.commentKeyword
      )
      return alignShoppingScriptToEditCuts(
        {
          tone: "쇼핑숏폼",
          bundle,
          script: scriptLinesFromSceneBlocks(scenes, editPlan),
        },
        editPlan,
        analyses,
        productAnalysis.productName
      )
    }
  } catch {
    /* fallback */
  }

  return alignShoppingScriptToEditCuts(
    buildQuickShoppingScript(productAnalysis, editPlan, analyses, mixInfo),
    editPlan,
    analyses,
    productAnalysis.productName
  )
}

function scriptLinesFromSceneBlocks(blocks: SceneSubtitleBlock[], editPlan: EditPlan): ScriptLine[] {
  const plan = editPlan.edit_plan
  if (!plan.length) return []

  return plan.map((seg, i) => {
    const raw = bundleTextForEditCut(i, plan, blocks)
    const dur = Math.max(0.5, seg.output_end - seg.output_start)
    const text =
      raw && !looksLikeSceneCardMetadata(raw)
        ? raw
        : rephraseSceneToShoppingNarration(seg.visual_caption || seg.reason, undefined, dur)
    return {
      start: seg.output_start,
      end: seg.output_end,
      text,
      video_id: seg.video_id,
    }
  })
}

function buildSceneGroupHint(
  segments: Array<{ output_start: number; output_end: number; reason: string }>,
  targetDuration: number
): SceneSubtitleBlock[] {
  if (!segments.length) {
    return [{ start: 0, end: targetDuration, text: "" }]
  }

  const ratios = [0.45, 0.25, 0.2, 0.1]
  const labels = ["제품·실사용", "기능·데모", "결과", "마무리"]
  const blocks: SceneSubtitleBlock[] = []
  let cursor = 0

  for (let i = 0; i < ratios.length; i++) {
    const isLast = i === ratios.length - 1
    const end = isLast ? targetDuration : ROUND(Math.min(targetDuration, cursor + targetDuration * ratios[i]!))
    if (end <= cursor) continue

    const picksInBlock = segments.filter(
      (s) => s.output_start >= cursor - 0.01 && s.output_start < end - 0.01
    )
    blocks.push({
      start: ROUND(cursor),
      end: ROUND(end),
      text: picksInBlock.map((p) => p.reason).join(" / "),
    })
    cursor = end
  }

  if (!blocks.length) {
    blocks.push({ start: 0, end: targetDuration, text: segments.map((s) => s.reason).join(" / ") })
  }
  return finalizeSceneSubtitleTimeline(blocks, targetDuration)
}

function normalizeHeadcopies(raw: unknown): string[][] {
  if (!Array.isArray(raw)) return []
  const out: string[][] = []
  for (const row of raw) {
    if (!Array.isArray(row)) continue
    const lines = row.map((x) => String(x).trim()).filter(Boolean)
    if (lines.length) out.push(lines)
  }
  return out.slice(0, 5)
}

function finalizeSceneSubtitleTimeline(
  blocks: SceneSubtitleBlock[],
  targetDuration: number
): SceneSubtitleBlock[] {
  if (!blocks.length) return [{ start: 0, end: ROUND(targetDuration), text: "" }]
  const out = blocks.map((b) => ({ ...b }))
  out[0]!.start = 0
  out[out.length - 1]!.end = ROUND(targetDuration)
  return out
}

function normalizeSceneSubtitleBlocks(raw: unknown, targetDuration: number): SceneSubtitleBlock[] {
  if (!Array.isArray(raw)) return []
  const out: SceneSubtitleBlock[] = []
  for (const row of raw) {
    if (!row || typeof row !== "object") continue
    const o = row as Record<string, unknown>
    const start = Number(o.start)
    const end = Number(o.end)
    const text = sanitizeSceneSubtitleText(String(o.text || "").trim())
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !text) continue
    out.push({
      start: ROUND(Math.max(0, start)),
      end: ROUND(Math.min(targetDuration, end)),
      text,
    })
  }
  return finalizeSceneSubtitleTimeline(
    out.sort((a, b) => a.start - b.start),
    targetDuration
  )
}

function normalizeScriptBundle(
  parsed: {
    scripts?: { conversion?: string; storytelling?: string }
    headcopies?: unknown
    commentKeyword?: string
    sceneSubtitles?: { conversion?: unknown; storytelling?: unknown }
  },
  targetDuration: number,
  productAnalysis: ProductAnalysis
): ShotFormScriptBundle | null {
  const conversionScenes = normalizeSceneSubtitleBlocks(
    parsed.sceneSubtitles?.conversion,
    targetDuration
  )
  if (conversionScenes.length < 2) return null

  const storytellingScenes = normalizeSceneSubtitleBlocks(
    parsed.sceneSubtitles?.storytelling,
    targetDuration
  )

  const conversionScript =
    String(parsed.scripts?.conversion || "").trim() ||
    conversionScenes.map((b) => b.text).join("\n")
  const storytellingScript =
    String(parsed.scripts?.storytelling || "").trim() ||
    (storytellingScenes.length
      ? storytellingScenes.map((b) => b.text).join("\n")
      : conversionScript)

  let headcopies = normalizeHeadcopies(parsed.headcopies)
  if (headcopies.length < 3) {
    headcopies = buildDefaultHeadcopies(productAnalysis.productName)
  }

  const commentKeyword =
    String(parsed.commentKeyword || "").trim() ||
    productAnalysis.targetKeywords[0]?.replace(/\s+/g, "") ||
    productAnalysis.category.replace(/\s+/g, "")

  return {
    scripts: { conversion: conversionScript, storytelling: storytellingScript },
    headcopies,
    commentKeyword,
    sceneSubtitles: {
      conversion: conversionScenes,
      storytelling: storytellingScenes.length ? storytellingScenes : conversionScenes,
    },
  }
}

function buildDefaultHeadcopies(productName: string): string[][] {
  return [
    ["이거 모르면", "100% 손해"],
    ["요즘 난리난", "이유 공개"],
    ["안 쓰면 진짜", "후회각"],
    ["왜 이제야", productName.slice(0, 7) || "알았지"],
    ["가성비 1위", "오늘 마감"],
  ]
}

function deriveScriptLinesFromBundle(
  bundle: ShotFormScriptBundle,
  editPlan: EditPlan,
  analyses?: VideoAnalysis[]
): ScriptLine[] {
  const blocks = bundle.sceneSubtitles.conversion
  const byId = analyses ? new Map(analyses.map((a) => [a.video_id, a])) : null

  return editPlan.edit_plan.map((seg) => {
    const block =
      blocks.find(
        (b) => seg.output_start >= b.start - 0.05 && seg.output_start < b.end - 0.05
      ) || blocks[blocks.length - 1]
    const lines = (block?.text || "").split("\n").map((l) => l.trim()).filter(Boolean)
    const picksInBlock = editPlan.edit_plan.filter(
      (s) =>
        block &&
        s.output_start >= block.start - 0.05 &&
        s.output_start < block.end - 0.05
    )
    const idx = Math.max(0, picksInBlock.findIndex((s) => s === seg))
    let text =
      picksInBlock.length <= 1
        ? sanitizeSceneSubtitleText((block?.text || "").trim())
        : sanitizeSceneSubtitleText(
            lines[idx % Math.max(1, lines.length)] || lines[0] || ""
          ) || ""

    if (!text || looksLikeSceneCardMetadata(text)) {
      text = rephraseSceneToShoppingNarration(
        seg.visual_caption || seg.reason,
        undefined,
        seg.output_end - seg.output_start
      )
    }

    return {
      start: seg.output_start,
      end: seg.output_end,
      text: text || seg.reason,
      video_id: seg.video_id,
    }
  })
}

function simpleNarrationFromVisualCard(visualCard: string, productName: string): string {
  const m = visualCard.match(/\[[^\]]+\]\s*(.+)$/)
  const desc = (m?.[1] || visualCard).trim()
  if (!desc) return productName
  if (desc.length <= 36) return desc
  const cut = desc.slice(0, 34)
  const sp = cut.lastIndexOf(" ")
  return (sp > 12 ? cut.slice(0, sp) : cut) + "…"
}

export function buildQuickShoppingScript(
  productAnalysis: ProductAnalysis,
  editPlan: EditPlan,
  analyses: VideoAnalysis[],
  mixInfo?: MixInfo
): ShoppingScript {
  const benchmarkScenes = buildBenchmarkSceneBlocksFromEditPlan(
    editPlan,
    analyses,
    mixInfo,
    productAnalysis.scenes
  )
  const contexts = benchmarkScenes.map((s) => ({
    visual_card: s.visual_card,
    duration: s.duration,
  }))
  const rawLines = benchmarkScenes.map((s, i) =>
    rephraseSceneToShoppingNarrationVariant(
      s.visual_card,
      productAnalysis.productName,
      s.duration,
      i * 3 + 1
    )
  )
  const polished = polishCutNarrationLines(rawLines, contexts, productAnalysis.productName, {
    allowTemplateFallback: false,
    fitToDuration: true,
    userKeywords: productAnalysis.targetKeywords,
  })

  const sceneBlocks: SceneSubtitleBlock[] = benchmarkScenes.map((s, i) => ({
    start: s.start,
    end: s.end,
    text: formatSceneNarrationLines(polished[i] ?? rawLines[i]!, s.duration),
  }))

  const bundle = assembleScriptBundleFromScenes(
    sceneBlocks,
    buildDefaultHeadcopies(productAnalysis.productName),
    productAnalysis.targetKeywords[0]?.replace(/\s+/g, "") ||
      productAnalysis.category.replace(/\s+/g, "")
  )

  return {
    tone: "쇼핑숏폼",
    bundle,
    script: scriptLinesFromSceneBlocks(sceneBlocks, editPlan),
  }
}

/** @deprecated buildQuickShoppingScript */
export const buildFallbackScriptBundle = buildQuickShoppingScript

export function aggregateProductAnalysis(analyses: VideoAnalysis[]): ProductAnalysis {
  const first = analyses[0]!
  const keywords = new Set<string>()
  for (const a of analyses) {
    for (const k of a.targetKeywords ?? []) keywords.add(k)
  }

  return {
    productName: first.productName || first.title || "쇼핑 제품",
    category: first.category || "쇼핑",
    targetKeywords: [...keywords],
    videoStructure: first.videoStructure ?? {
      hook: "",
      body: "",
      cta: "",
    },
    summary:
      analyses
        .map((a) => a.summary)
        .filter(Boolean)
        .join(" ") || first.title,
    scenes: benchmarkTimelineForAnalysis(first).map((s) => ({
      start: s.start,
      end: s.end,
      description: s.description,
    })),
    videoDuration: Math.max(...analyses.map((a) => a.duration)),
  }
}
