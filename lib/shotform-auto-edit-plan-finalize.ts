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

/** 컷당 최대 길이 — 동일 소스 중복·이탈 방지 (5~6초 권장) */
export const MAX_EDIT_SEGMENT_SEC = 6
export const IDEAL_EDIT_SEGMENT_SEC = 5.5
export const MIN_EDIT_SEGMENT_SEC = 1

const FILL_CLIP_LENS = [5.5, 5, 4.5, 5.5, 4, 5, 3.5] as const

function segmentOutputDur(seg: EditPlanSegment): number {
  return seg.output_end - seg.output_start
}

function capSegmentsToMaxLength(segments: EditPlanSegment[]): EditPlanSegment[] {
  const capped: EditPlanSegment[] = []
  let outCursor = 0
  for (const seg of segments) {
    let dur = Math.max(MIN_EDIT_SEGMENT_SEC, segmentOutputDur(seg))
    if (dur > MAX_EDIT_SEGMENT_SEC + 0.05) dur = MAX_EDIT_SEGMENT_SEC
    capped.push({
      ...seg,
      source_end: ROUND(seg.source_start + dur),
      output_start: ROUND(outCursor),
      output_end: ROUND(outCursor + dur),
    })
    outCursor += dur
  }
  return capped
}

function sourceRangeUsedByPlan(
  video_id: string,
  plan: EditPlanSegment[],
  start: number,
  end: number
): boolean {
  return plan.some(
    (s) => s.video_id === video_id && s.source_start < end - 0.45 && start < s.source_end - 0.45
  )
}

function findFreshSourceStart(
  analysis: VideoAnalysis,
  edit_plan: EditPlanSegment[],
  clipLen: number,
  round: number
): number | null {
  const maxStart = Math.max(0, analysis.duration - clipLen - 0.05)
  if (maxStart < 0.1) return null

  for (let attempt = 0; attempt < 32; attempt++) {
    const t = ROUND((round * 2.3 + attempt * 1.41 + analysis.duration * 0.07) % Math.max(0.25, maxStart))
    if (!sourceRangeUsedByPlan(analysis.video_id, edit_plan, t, t + clipLen)) return t
  }

  for (let attempt = 0; attempt < 16; attempt++) {
    const t = ROUND((attempt * 0.9) % Math.max(0.25, maxStart))
    if (!sourceRangeUsedByPlan(analysis.video_id, edit_plan, t, t + clipLen)) return t
  }

  return ROUND((round * 3.1) % Math.max(0.25, maxStart))
}

function appendFillClipsToPlan(
  edit_plan: EditPlanSegment[],
  analyses: VideoAnalysis[],
  target: number
): EditPlanSegment[] {
  const out = [...edit_plan]
  let outCursor = out.length ? out[out.length - 1]!.output_end : 0
  let round = 0

  while (outCursor < target - 0.08 && round < 120) {
    round++
    let added = false
    for (const a of analyses) {
      if (outCursor >= target - 0.08) break
      const need = target - outCursor
      const clipLen = Math.min(
        MAX_EDIT_SEGMENT_SEC,
        FILL_CLIP_LENS[round % FILL_CLIP_LENS.length]!,
        need,
        a.duration
      )
      if (clipLen < MIN_EDIT_SEGMENT_SEC) continue

      const start = findFreshSourceStart(a, out, clipLen, round)
      if (start == null) continue

      const end = ROUND(Math.min(a.duration, start + clipLen))
      const dur = end - start
      if (dur < MIN_EDIT_SEGMENT_SEC) continue

      out.push({
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
  return out
}

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
  const dur = Math.min(wantDur, sceneLen, MAX_EDIT_SEGMENT_SEC)
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

  const pool = collectTaggedScenes(analyses)
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
    const isLast = remaining <= MAX_EDIT_SEGMENT_SEC || slotIdx >= arc.length * 8
    let slotDur = isLast
      ? Math.min(remaining, MAX_EDIT_SEGMENT_SEC)
      : Math.max(1.2, Math.min(remaining, targetDuration * slot.ratio, MAX_EDIT_SEGMENT_SEC))
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

/** finalizeEditPlan 정규화 실패 시 — buildSceneBasedEditPlan 재호출 금지 (스택 오버플로 방지) */
function minimalEditPlanFallback(analyses: VideoAnalysis[], target: number): EditPlan {
  const a = analyses.find((x) => x.duration > 0.3) ?? analyses[0]
  if (!a) return { target_duration: target, edit_plan: [] }

  const dur = ROUND(Math.min(target, Math.max(0.5, a.duration), MAX_EDIT_SEGMENT_SEC))
  return {
    target_duration: target,
    edit_plan: [
      {
        video_id: a.video_id,
        source_start: 0,
        source_end: dur,
        output_start: 0,
        output_end: dur,
        reason: a.title || a.scenes[0]?.description || "제품 장면",
      },
    ],
  }
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
    outDur = Math.min(outDur, MAX_EDIT_SEGMENT_SEC)
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
    return minimalEditPlanFallback(analyses, target)
  }

  return { target_duration: target, edit_plan: capSegmentsToMaxLength(normalized) }
}

/** 목표 쇼츠 길이에 맞게 부족한 output 구간을 소스에서 채움 */
export function forceFillEditPlanToTarget(
  plan: EditPlan,
  analyses: VideoAnalysis[],
  minRatio = 0.92
): EditPlan {
  const target = plan.target_duration
  if (!analyses.length) return plan

  let edit_plan = capSegmentsToMaxLength(finalizeEditPlan(plan, analyses).edit_plan)
  let outCursor = editPlanTotalOutputSeconds({ target_duration: target, edit_plan })

  if (outCursor < target * minRatio - 0.1) {
    edit_plan = appendFillClipsToPlan(edit_plan, analyses, target)
    edit_plan = capSegmentsToMaxLength(
      finalizeEditPlan({ target_duration: target, edit_plan }, analyses).edit_plan
    )
  }

  return stretchEditPlanLastSegment({ target_duration: target, edit_plan }, analyses)
}

function stretchEditPlanLastSegment(plan: EditPlan, analyses: VideoAnalysis[]): EditPlan {
  const target = plan.target_duration
  let edit_plan = capSegmentsToMaxLength(plan.edit_plan)
  let out = editPlanTotalOutputSeconds({ target_duration: target, edit_plan })

  if (out > target + 0.05 && edit_plan.length) {
    const last = edit_plan[edit_plan.length - 1]!
    const trim = out - target
    const newDur = Math.max(MIN_EDIT_SEGMENT_SEC, segmentOutputDur(last) - trim)
    last.output_end = ROUND(last.output_start + newDur)
    last.source_end = ROUND(last.source_start + newDur)
    return { target_duration: target, edit_plan }
  }

  if (out < target - 0.08) {
    edit_plan = appendFillClipsToPlan(edit_plan, analyses, target)
    edit_plan = capSegmentsToMaxLength(
      finalizeEditPlan({ target_duration: target, edit_plan }, analyses).edit_plan
    )
    out = editPlanTotalOutputSeconds({ target_duration: target, edit_plan })

    if (out > target + 0.05 && edit_plan.length) {
      const last = edit_plan[edit_plan.length - 1]!
      const trim = out - target
      const newDur = Math.max(MIN_EDIT_SEGMENT_SEC, segmentOutputDur(last) - trim)
      last.output_end = ROUND(last.output_start + newDur)
      last.source_end = ROUND(last.source_start + newDur)
    }
  }

  return { target_duration: target, edit_plan }
}

export function editPlanTotalOutputSeconds(plan: EditPlan): number {
  if (!plan.edit_plan.length) return 0
  const last = plan.edit_plan[plan.edit_plan.length - 1]!
  return last.output_end
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
