import type {
  AutoEditTargetDuration,
  EditPlan,
  EditPlanSegment,
  ScriptLine,
  ShoppingScript,
  VideoAnalysis,
  VideoScene,
  SceneVisualType,
} from "@/lib/shotform-auto-edit-types"
import { filterScenesForEdit, isProductSafeScene, pickIntervalIsProductSafe, sceneHasUnsafeVision } from "@/lib/shotform-auto-edit-product-filter"
import { compareScenesByEditorialPriority, sceneEditorialScore } from "@/lib/shotform-scene-priority"

const ROUND = (n: number) => Math.round(n * 100) / 100

function analysisMap(analyses: VideoAnalysis[]): Map<string, VideoAnalysis> {
  return new Map(analyses.map((a) => [a.video_id, a]))
}

type UsedClip = { video_id: string; source_start: number; source_end: number }

function sceneKey(sc: { video_id: string; start: number; end: number }): string {
  return `${sc.video_id}:${ROUND(sc.start)}:${ROUND(sc.end)}`
}

function clipKey(video_id: string, source_start: number, source_end: number): string {
  return `${video_id}:${ROUND(source_start)}:${ROUND(source_end)}`
}

function clipsOverlap(a: UsedClip, start: number, end: number): boolean {
  return a.source_start < end - 0.08 && start < a.source_end - 0.08
}

function isClipUsed(usedClips: UsedClip[], video_id: string, start: number, end: number): boolean {
  return usedClips.some((c) => c.video_id === video_id && clipsOverlap(c, start, end))
}

/** 장면 안에서 아직 안 쓴 소스 구간 — slice로 나눠 중복 방지 */
function pickUniqueClipFromScene(
  scene: TaggedScene,
  wantDur: number,
  maxSourceEnd: number,
  usedClips: UsedClip[],
  analysis: VideoAnalysis | undefined,
  sliceHint = 0
): { source_start: number; source_end: number } | null {
  const sceneLen = Math.max(0.25, scene.end - scene.start)
  const dur = Math.min(wantDur, sceneLen, 4)
  const maxStart = Math.min(scene.end, maxSourceEnd) - dur
  if (maxStart < scene.start - 0.01) return null

  const span = maxStart - scene.start
  const sliceCount = Math.max(1, Math.min(8, Math.floor(span / Math.max(0.35, dur * 0.75)) + 1))

  for (let s = 0; s < sliceCount; s++) {
    const slice = (sliceHint + s) % sliceCount
    let ss = scene.start
    if (sliceCount > 1) {
      ss = scene.start + (span * slice) / (sliceCount - 1)
    }
    if (scene.visual_type === "demo" || scene.visual_type === "result") {
      ss = scene.start + (span * Math.min(slice + 0.35, sliceCount - 1)) / Math.max(1, sliceCount - 1)
    }
    ss = Math.max(scene.start, Math.min(maxStart, ss))
    const se = Math.min(maxSourceEnd, ss + dur)
    if (se - ss < 0.2) continue
    if (!isClipUsed(usedClips, scene.video_id, ss, se)) {
      if (!analysis || pickIntervalIsProductSafe(analysis, ss, se, scene.description)) {
        return { source_start: ROUND(ss), source_end: ROUND(Math.max(ss + 0.25, se)) }
      }
    }
  }
  return null
}

function pickSceneWithUniqueClip(
  pool: TaggedScene[],
  usedSceneKeys: Set<string>,
  usedClips: UsedClip[],
  wantDur: number,
  byId: Map<string, VideoAnalysis>,
  preferType?: SceneVisualType,
  lastVideoId?: string | null,
  videoIds?: string[],
  avoidSceneKey?: string
): { scene: TaggedScene; clip: { source_start: number; source_end: number } } | null {
  let candidates = pool.filter((sc) => {
    const key = sceneKey(sc)
    if (avoidSceneKey && key === avoidSceneKey) return false
    return !usedSceneKeys.has(key)
  })

  if (!candidates.length) {
    candidates = pool.filter((sc) => sceneKey(sc) !== avoidSceneKey)
  }

  if (lastVideoId && videoIds && videoIds.length > 1) {
    const other = candidates.filter((c) => c.video_id !== lastVideoId)
    if (other.length) candidates = other
  }

  const ordered: TaggedScene[] = []
  if (preferType) {
    ordered.push(...candidates.filter((c) => c.visual_type === preferType))
    ordered.push(
      ...candidates
        .filter((c) => c.visual_type !== preferType)
        .sort((a, b) => sceneEditorialScore(b) - sceneEditorialScore(a))
    )
  } else {
    ordered.push(...[...candidates].sort((a, b) => sceneEditorialScore(b) - sceneEditorialScore(a)))
  }

  for (const scene of ordered) {
    const analysis = byId.get(scene.video_id)
    if (!analysis) continue
    const clip = pickUniqueClipFromScene(scene, wantDur, analysis.duration, usedClips, analysis)
    if (clip) return { scene, clip }
  }

  for (const scene of pool) {
    const analysis = byId.get(scene.video_id)
    if (!analysis) continue
    const clip = pickUniqueClipFromScene(scene, wantDur, analysis.duration, usedClips, analysis, usedClips.length)
    if (clip) return { scene, clip }
  }

  return null
}

function registerUsedClip(
  usedSceneKeys: Set<string>,
  usedClips: UsedClip[],
  scene: TaggedScene,
  clip: { source_start: number; source_end: number }
): void {
  usedSceneKeys.add(sceneKey(scene))
  usedClips.push({
    video_id: scene.video_id,
    source_start: clip.source_start,
    source_end: clip.source_end,
  })
}

/** 편집 plan 내 동일 소스 구간 중복 제거 */
export function dedupeEditPlanSegments(plan: EditPlan): EditPlan {
  const seen = new Set<string>()
  const edit_plan: EditPlanSegment[] = []
  let outCursor = 0

  for (const seg of plan.edit_plan) {
    const key = clipKey(seg.video_id, seg.source_start, seg.source_end)
    if (seen.has(key)) continue
    seen.add(key)
    const dur = Math.max(0.25, seg.source_end - seg.source_start)
    edit_plan.push({
      ...seg,
      output_start: ROUND(outCursor),
      output_end: ROUND(outCursor + dur),
    })
    outCursor += dur
  }

  return { target_duration: plan.target_duration, edit_plan }
}

type TaggedScene = VideoScene & { video_id: string; title: string }

/** 장면 pool이 비었을 때 — 영상 앞구간 최소 타임라인 (finalizeEditPlan↔buildSceneBasedEditPlan 무한 재귀 방지) */
export function buildMinimalDurationEditPlan(
  analyses: VideoAnalysis[],
  targetDuration: AutoEditTargetDuration
): EditPlan {
  const edit_plan: EditPlanSegment[] = []
  let outCursor = 0
  const share = Math.max(1.2, targetDuration / Math.max(1, analyses.length))

  for (const a of analyses) {
    if (outCursor >= targetDuration - 0.08) break
    const dur = Math.min(share, Math.max(0.8, a.duration * 0.35), targetDuration - outCursor)
    if (dur < 0.5 || a.duration < 0.5) continue
    const start = Math.min(0.6, Math.max(0, a.duration - dur - 0.08))
    edit_plan.push({
      video_id: a.video_id,
      source_start: ROUND(start),
      source_end: ROUND(Math.min(a.duration, start + dur)),
      output_start: ROUND(outCursor),
      output_end: ROUND(outCursor + dur),
      reason: a.title || "제품 장면",
    })
    outCursor += dur
  }

  return { target_duration: targetDuration, edit_plan }
}

function collectTaggedScenes(analyses: VideoAnalysis[]): TaggedScene[] {
  if (analyses.length > 1) return interleaveScenesByVideo(analyses)

  const out: TaggedScene[] = []
  for (const a of analyses) {
    for (const sc of filterScenesForEdit(a.scenes, a.vision_frames)) {
      out.push({ ...sc, video_id: a.video_id, title: a.title })
    }
  }
  return out.sort((x, y) => compareScenesByEditorialPriority(x, y))
}

/** 여러 영상 — video_id별로 번갈아 pool 구성 (각 버킷은 편집 우선순위 정렬) */
function interleaveScenesByVideo(analyses: VideoAnalysis[]): TaggedScene[] {
  const buckets = new Map<string, TaggedScene[]>()
  for (const a of analyses) {
    const scenes = filterScenesForEdit(a.scenes, a.vision_frames)
      .sort(compareScenesByEditorialPriority)
      .map((sc) => ({ ...sc, video_id: a.video_id, title: a.title }))
    buckets.set(a.video_id, scenes)
  }

  const ids = analyses.map((a) => a.video_id)
  const out: TaggedScene[] = []
  let round = 0
  while (true) {
    let added = false
    for (const id of ids) {
      const sc = buckets.get(id)?.[round]
      if (sc) {
        out.push(sc)
        added = true
      }
    }
    if (!added) break
    round++
  }
  return out
}

/** AI 실패 시 — 중요 장면 기반, 목표 길이 정확히 맞춤 */
export function buildSceneBasedEditPlan(
  analyses: VideoAnalysis[],
  targetDuration: AutoEditTargetDuration
): EditPlan {
  const pool = collectTaggedScenes(analyses)
  if (!pool.length) {
    return buildMinimalDurationEditPlan(analyses, targetDuration)
  }

  const byId = analysisMap(analyses)
  const multi = analyses.length > 1

  const arc: Array<{ type: VideoScene["visual_type"]; ratio: number; label: string }> = multi
    ? [
        { type: "demo", ratio: 0.35, label: "제품·실사용" },
        { type: "product_showcase", ratio: 0.2, label: "특징·클로즈업" },
        { type: "result", ratio: 0.25, label: "효과·결과" },
        { type: "problem", ratio: 0.12, label: "문제" },
        { type: "cta", ratio: 0.08, label: "마무리" },
      ]
    : [
        { type: "demo", ratio: 0.4, label: "제품·실사용" },
        { type: "product_showcase", ratio: 0.25, label: "특징·클로즈업" },
        { type: "result", ratio: 0.25, label: "효과·결과" },
        { type: "problem", ratio: 0.1, label: "문제" },
      ]

  const videoIds = analyses.map((a) => a.video_id)
  const usedSceneKeys = new Set<string>()
  const usedClips: UsedClip[] = []
  const edit_plan: EditPlanSegment[] = []
  let outCursor = 0
  let lastVideoId: string | null = null
  let slotIdx = 0

  while (outCursor < targetDuration - 0.12 && slotIdx < 120) {
    const slot = arc[slotIdx % arc.length]!
    const remaining = targetDuration - outCursor
    const isLast = remaining <= 3.5 || slotIdx >= arc.length * 8
    let slotDur = isLast ? remaining : Math.max(1.2, Math.min(remaining, targetDuration * slot.ratio))
    if (slotDur > remaining) slotDur = remaining
    if (slotDur < 0.35) break

    const picked = pickSceneWithUniqueClip(
      pool,
      usedSceneKeys,
      usedClips,
      slotDur,
      byId,
      slot.type,
      lastVideoId,
      videoIds
    )
    if (!picked) {
      slotIdx++
      continue
    }

    const { scene, clip } = picked
    registerUsedClip(usedSceneKeys, usedClips, scene, clip)
    lastVideoId = scene.video_id
    const clipDur = Math.min(clip.source_end - clip.source_start, remaining)

    edit_plan.push({
      video_id: scene.video_id,
      source_start: clip.source_start,
      source_end: clip.source_end,
      output_start: ROUND(outCursor),
      output_end: ROUND(outCursor + clipDur),
      reason: `${slot.label}: ${scene.description}`,
    })
    outCursor += clipDur
    slotIdx++
  }

  return finalizeEditPlan({ target_duration: targetDuration, edit_plan }, analyses)
}

/** output 타임라인 = targetDuration, 소스는 필요한 만큼만 trim */
export function finalizeEditPlan(plan: EditPlan, analyses: VideoAnalysis[]): EditPlan {
  const target = plan.target_duration
  const byId = analysisMap(analyses)
  const sorted = [...plan.edit_plan].sort((a, b) => a.output_start - b.output_start)

  const normalized: EditPlanSegment[] = []
  let outCursor = 0

  for (const seg of sorted) {
    if (outCursor >= target - 0.05) break

    const analysis = byId.get(seg.video_id) || analyses[0]!
    let outDur = Math.max(0.25, seg.output_end - seg.output_start)
    if (outCursor + outDur > target) outDur = target - outCursor

    let ss = Math.max(0, Math.min(seg.source_start, analysis.duration - 0.25))
    let maxSe = Math.min(analysis.duration, seg.source_end)
    let sourceAvail = Math.max(0.25, maxSe - ss)

    if (sourceAvail > outDur + 0.05) {
      maxSe = ss + outDur
    } else if (sourceAvail < outDur - 0.05) {
      outDur = Math.min(outDur, sourceAvail)
    }

    if (outDur < 0.2) continue

    normalized.push({
      video_id: analysis.video_id,
      source_start: ROUND(ss),
      source_end: ROUND(ss + outDur),
      output_start: ROUND(outCursor),
      output_end: ROUND(outCursor + outDur),
      reason: seg.reason,
    })
    outCursor += outDur
  }

  if (normalized.length === 0) {
    return buildMinimalDurationEditPlan(analyses, target)
  }

  if (Math.abs(outCursor - target) > 0.15) {
    const last = normalized[normalized.length - 1]!
    const delta = target - outCursor
    const analysis = byId.get(last.video_id)!
    const newOutDur = last.output_end - last.output_start + delta
    if (newOutDur >= 0.25 && last.source_start + newOutDur <= analysis.duration + 0.01) {
      last.output_end = ROUND(target)
      last.source_end = ROUND(last.source_start + newOutDur)
    } else if (delta < 0) {
      last.output_end = ROUND(target)
      last.source_end = ROUND(last.source_start + (last.output_end - last.output_start))
    }
  }

  return { target_duration: target, edit_plan: normalized }
}

/** 목표 쇼츠 길이에 맞게 부족한 output 구간을 소스에서 채움 */
export function forceFillEditPlanToTarget(
  plan: EditPlan,
  analyses: VideoAnalysis[],
  minRatio = 0.92
): EditPlan {
  const target = plan.target_duration
  if (!analyses.length) return plan

  let edit_plan = [...finalizeEditPlan(plan, analyses).edit_plan]
  let outCursor = editPlanTotalOutputSeconds({ target_duration: target, edit_plan })

  if (outCursor >= target * minRatio - 0.1) {
    edit_plan = ensureJumpCutEditPlan(
      stretchEditPlanLastSegment({ target_duration: target, edit_plan }, analyses),
      analyses
    ).edit_plan
    return { target_duration: target, edit_plan }
  }

  const clipLens = [2.2, 2.5, 1.8, 2.0, 2.8, 1.6, 2.4]
  let round = 0

  while (outCursor < target - 0.12 && round < 100) {
    round++
    let added = false
    for (const a of analyses) {
      if (outCursor >= target - 0.12) break
      const need = target - outCursor
      const clipLen = Math.min(clipLens[round % clipLens.length]!, need, a.duration)
      if (clipLen < 0.35) continue
      const maxStart = Math.max(0, a.duration - clipLen - 0.05)
      const start = ROUND((round * 2.4 + analyses.indexOf(a) * 1.7) % Math.max(0.3, maxStart))
      const end = ROUND(Math.min(a.duration, start + clipLen))
      const dur = end - start
      if (dur < 0.35) continue

      edit_plan.push({
        video_id: a.video_id,
        source_start: start,
        source_end: end,
        output_start: ROUND(outCursor),
        output_end: ROUND(outCursor + dur),
        reason: a.title || "제품 장면",
      })
      outCursor += dur
      added = true
    }
    if (!added) break
  }

  edit_plan = finalizeEditPlan({ target_duration: target, edit_plan }, analyses).edit_plan
  edit_plan = ensureJumpCutEditPlan(
    stretchEditPlanLastSegment({ target_duration: target, edit_plan }, analyses),
    analyses
  ).edit_plan
  return { target_duration: target, edit_plan }
}

function stretchEditPlanLastSegment(plan: EditPlan, analyses: VideoAnalysis[]): EditPlan {
  const target = plan.target_duration
  const edit_plan = plan.edit_plan.map((s) => ({ ...s }))
  let out = editPlanTotalOutputSeconds({ target_duration: target, edit_plan })
  if (out >= target - 0.08 || !edit_plan.length) {
    if (out > target + 0.05 && edit_plan.length) {
      const last = edit_plan[edit_plan.length - 1]!
      last.output_end = ROUND(target)
      last.source_end = ROUND(last.source_start + (last.output_end - last.output_start))
    }
    return { target_duration: target, edit_plan }
  }

  const last = edit_plan[edit_plan.length - 1]!
  const a = analyses.find((x) => x.video_id === last.video_id) ?? analyses[0]!
  const need = target - out

  // 짜집기: 마지막 컷을 소스에서 연속으로 늘리지 않음 (한 영상 통째 재생 방지)
  if (need > 0.15 && need <= 1.2 && last.source_end + need <= a.duration + 0.05) {
    last.output_end = ROUND(last.output_end + need)
    last.source_end = ROUND(last.source_end + need)
    out = editPlanTotalOutputSeconds({ target_duration: target, edit_plan })
  }

  if (out < target - 0.15) {
    const need2 = target - out
    const dur = Math.min(need2, a.duration)
    const start = ROUND(Math.min(a.duration - dur, (last.source_end + 0.5) % Math.max(0.3, a.duration - dur)))
    edit_plan.push({
      video_id: a.video_id,
      source_start: start,
      source_end: ROUND(start + dur),
      output_start: ROUND(out),
      output_end: ROUND(target),
      reason: a.title || "제품 장면",
    })
  }

  return { target_duration: target, edit_plan }
}

export function editPlanTotalOutputSeconds(plan: EditPlan): number {
  if (!plan.edit_plan.length) return 0
  const last = plan.edit_plan[plan.edit_plan.length - 1]!
  return last.output_end
}

/** 목표 길이 대비 짜집기 최소 컷 수 (2~3초 리듬) */
export function minimumEditSegmentsForTarget(targetDuration: number): number {
  return Math.max(2, Math.ceil(targetDuration / 3))
}

/** 소스에서 연속 재생(한 영상 통째)인지 — 짜집기(점프컷)가 아님 */
export function isSequentialSourcePlaybackPlan(plan: EditPlan): boolean {
  const segs = [...plan.edit_plan].sort((a, b) => a.output_start - b.output_start)
  if (segs.length <= 1) return true
  for (let i = 1; i < segs.length; i++) {
    const prev = segs[i - 1]!
    const cur = segs[i]!
    if (prev.video_id !== cur.video_id) return false
    if (Math.abs(cur.source_start - prev.source_end) > 0.4) return false
  }
  return true
}

function sourceSpanSeconds(plan: EditPlan): number {
  const byVideo = new Map<string, { min: number; max: number }>()
  for (const seg of plan.edit_plan) {
    const row = byVideo.get(seg.video_id) ?? { min: seg.source_start, max: seg.source_end }
    row.min = Math.min(row.min, seg.source_start)
    row.max = Math.max(row.max, seg.source_end)
    byVideo.set(seg.video_id, row)
  }
  let span = 0
  for (const row of byVideo.values()) span += row.max - row.min
  return span
}

/** 실제 짜집기인지 — 컷 수·점프컷 여부 */
export function isRealMixEditPlan(plan: EditPlan, analyses: VideoAnalysis[]): boolean {
  const minSegs = minimumEditSegmentsForTarget(plan.target_duration)
  if (plan.edit_plan.length < minSegs) return false

  if (!isSequentialSourcePlaybackPlan(plan)) return true

  const a = analyses[0]
  if (!a || analyses.length > 1) return plan.edit_plan.length >= minSegs + 1

  const span = sourceSpanSeconds(plan)
  const maxSequentialSpan = Math.min(a.duration * 0.55, plan.target_duration * 0.65)
  return span <= maxSequentialSpan + 0.5
}

/** 한 덩어리 연속 재생 → 장면 pool 기반 점프컷으로 재구성 */
export function ensureJumpCutEditPlan(plan: EditPlan, analyses: VideoAnalysis[]): EditPlan {
  if (isRealMixEditPlan(plan, analyses)) return plan

  const rebuilt = buildSceneBasedEditPlan(analyses, plan.target_duration)
  const rebuiltSec = editPlanTotalOutputSeconds(rebuilt)
  if (
    rebuilt.edit_plan.length >= 2 &&
    isRealMixEditPlan(rebuilt, analyses) &&
    rebuiltSec >= plan.target_duration * 0.85 - 0.1
  ) {
    return rebuilt
  }

  const target = plan.target_duration
  const a = analyses[0]
  if (!a) return plan

  const pool = collectTaggedScenes(analyses)
  if (!pool.length) return plan

  const clipLens = [2.0, 2.4, 1.8, 2.2, 2.6, 1.6]
  const usedClips: UsedClip[] = []
  const edit_plan: EditPlanSegment[] = []
  let outCursor = 0
  let slot = 0

  while (outCursor < target - 0.12 && edit_plan.length < 30 && slot < 50) {
    const clipLen = Math.min(clipLens[slot % clipLens.length]!, target - outCursor, 3.2)
    const sc = pool[slot % pool.length]!
    const analysis = analysisMap(analyses).get(sc.video_id) ?? a
    const clip = pickUniqueClipFromScene(sc, clipLen, analysis.duration, usedClips, analysis, slot)
    if (!clip) {
      slot++
      continue
    }
    const dur = Math.min(clip.source_end - clip.source_start, target - outCursor)
    if (dur < 0.35) {
      slot++
      continue
    }
    usedClips.push({ video_id: sc.video_id, source_start: clip.source_start, source_end: clip.source_end })
    edit_plan.push({
      video_id: sc.video_id,
      source_start: clip.source_start,
      source_end: clip.source_end,
      output_start: ROUND(outCursor),
      output_end: ROUND(outCursor + dur),
      reason: sc.description.slice(0, 80) || "제품 장면",
    })
    outCursor += dur
    slot++
  }

  if (edit_plan.length < 2) return plan
  return finalizeEditPlan({ target_duration: target, edit_plan }, analyses)
}

const ARC_TYPES: SceneVisualType[] = ["demo", "product_showcase", "result", "problem", "cta"]

function isSceneUsable(scene: VideoScene, analysis: VideoAnalysis): boolean {
  if (!isProductSafeScene(scene)) return false
  if (analysis.vision_frames?.length && sceneHasUnsafeVision(scene, analysis.vision_frames)) {
    return false
  }
  return true
}

/** 대본 줄 timing을 0~targetDuration에 맞게 정렬 (줄당 2.5~4초) */
export function normalizeScriptTiming(
  lines: ScriptLine[],
  targetDuration: number
): ScriptLine[] {
  const valid = lines.filter((l) => l.text?.trim()).sort((a, b) => a.start - b.start)
  if (!valid.length) return []

  const count = valid.length
  const out: ScriptLine[] = []
  let cursor = 0

  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1
    const remaining = targetDuration - cursor
    const ideal = remaining / (count - i)
    const dur = isLast ? remaining : Math.min(4, Math.max(2.5, ideal))
    if (dur < 0.2) break

    out.push({
      ...valid[i]!,
      start: ROUND(cursor),
      end: ROUND(isLast ? targetDuration : cursor + dur),
    })
    cursor += dur
  }

  if (out.length) out[out.length - 1]!.end = targetDuration
  return out
}

/** AI 실패 시 — 분석 장면 기반 대본 초안 */
export function buildFallbackScriptFromScenes(
  analyses: VideoAnalysis[],
  targetDuration: AutoEditTargetDuration
): ShoppingScript {
  const pool = collectTaggedScenes(analyses)
  const byId = analysisMap(analyses)
  const videoIds = analyses.map((a) => a.video_id)
  const maxLines = Math.max(6, Math.ceil(targetDuration / 3.5))
  const lineCount = Math.min(maxLines, pool.length * 2)
  const usedSceneKeys = new Set<string>()
  const usedClips: UsedClip[] = []
  const script: ScriptLine[] = []
  let cursor = 0
  let lastVideoId: string | null = null

  for (let i = 0; i < lineCount; i++) {
    if (cursor >= targetDuration - 0.05) break

    const prefer = ARC_TYPES[Math.min(i, ARC_TYPES.length - 1)]!
    const isLast = i === lineCount - 1 || cursor + 3.5 >= targetDuration - 0.05
    const dur = isLast ? targetDuration - cursor : Math.min(4, Math.max(2.5, targetDuration / lineCount))

    const picked = pickSceneWithUniqueClip(
      pool,
      usedSceneKeys,
      usedClips,
      dur,
      byId,
      prefer,
      lastVideoId,
      videoIds
    )
    if (!picked) break

    const { scene } = picked
    registerUsedClip(usedSceneKeys, usedClips, scene, picked.clip)
    lastVideoId = scene.video_id

    const analysis = byId.get(scene.video_id)!
    const sceneIndex = analysis.scenes.findIndex((s) => s.start === scene.start && s.end === scene.end)

    script.push({
      start: ROUND(cursor),
      end: ROUND(isLast ? targetDuration : cursor + dur),
      text: scene.description.slice(0, 80) || `장면 ${i + 1}`,
      video_id: scene.video_id,
      scene_index: sceneIndex >= 0 ? sceneIndex : 0,
    })
    cursor += dur
  }

  return { tone: "쇼핑숏폼", script: normalizeScriptTiming(script, targetDuration) }
}

/** 대본 1줄 = 편집 컷 1개 — 대본 순서대로 연속 배치 */
export function buildEditPlanFromScript(
  script: ShoppingScript,
  analyses: VideoAnalysis[],
  targetDuration: AutoEditTargetDuration
): EditPlan {
  const byId = analysisMap(analyses)
  const pool = collectTaggedScenes(analyses)
  const videoIds = analyses.map((a) => a.video_id)
  const usedSceneKeys = new Set<string>()
  const usedClips: UsedClip[] = []
  const lines = normalizeScriptTiming(script.script, targetDuration)

  if (!lines.length) {
    return buildSceneBasedEditPlan(analyses, targetDuration)
  }

  const edit_plan: EditPlanSegment[] = []
  let outCursor = 0
  let lastVideoId: string | null = null

  for (let i = 0; i < lines.length; i++) {
    if (outCursor >= targetDuration - 0.05) break

    const line = lines[i]!
    const wantDur = Math.min(4, Math.max(2.5, line.end - line.start))
    const remaining = targetDuration - outCursor
    const outDur = Math.min(wantDur, remaining)
    if (outDur < 0.25) break

    const prefer = ARC_TYPES[Math.min(i, ARC_TYPES.length - 1)]!
    let picked: { scene: TaggedScene; clip: { source_start: number; source_end: number } } | null =
      null

    if (line.video_id != null && line.scene_index != null && line.scene_index >= 0) {
      const analysis = byId.get(line.video_id)
      const sc = analysis?.scenes[line.scene_index]
      if (sc && analysis && isSceneUsable(sc, analysis)) {
        const tagged: TaggedScene = { ...sc, video_id: line.video_id, title: analysis.title }
        const key = sceneKey(tagged)
        if (!usedSceneKeys.has(key)) {
          const clip = pickUniqueClipFromScene(tagged, outDur, analysis.duration, usedClips, analysis, i)
          if (clip) picked = { scene: tagged, clip }
        }
      }
    }

    if (!picked) {
      picked = pickSceneWithUniqueClip(
        pool,
        usedSceneKeys,
        usedClips,
        outDur,
        byId,
        prefer,
        lastVideoId,
        videoIds
      )
    }

    if (!picked) break

    const { scene, clip } = picked
    registerUsedClip(usedSceneKeys, usedClips, scene, clip)
    lastVideoId = scene.video_id
    const clipDur = clip.source_end - clip.source_start

    edit_plan.push({
      video_id: scene.video_id,
      source_start: clip.source_start,
      source_end: clip.source_end,
      output_start: ROUND(outCursor),
      output_end: ROUND(outCursor + clipDur),
      reason: line.text,
    })
    outCursor += clipDur
  }

  if (!edit_plan.length) {
    return buildSceneBasedEditPlan(analyses, targetDuration)
  }

  const last = edit_plan[edit_plan.length - 1]!
  const gap = targetDuration - last.output_end
  if (gap > 0.05 && gap <= 0.5) {
    last.output_end = ROUND(targetDuration)
    const analysis = byId.get(last.video_id)!
    const extend = last.output_end - last.output_start
    if (last.source_start + extend <= analysis.duration + 0.01) {
      last.source_end = ROUND(last.source_start + extend)
    }
  }

  return dedupeEditPlanSegments({ target_duration: targetDuration, edit_plan })
}

/** 편집 결과에 맞춰 대본 타이밍 동기화 */
export function syncScriptToEditPlan(script: ShoppingScript, plan: EditPlan): ShoppingScript {
  const lines = script.script
  return {
    tone: script.tone,
    script: plan.edit_plan.map((seg, i) => ({
      start: seg.output_start,
      end: seg.output_end,
      text: lines[i]?.text || seg.reason,
      video_id: seg.video_id,
      scene_index: lines[i]?.scene_index,
    })),
  }
}
