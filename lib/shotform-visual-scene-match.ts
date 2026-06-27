import { descriptionSuggestsPresenterOrFace } from "@/lib/shotform-auto-edit-product-filter"
import {
  collectSceneDescriptionsForRange,
  collectVisionCaptionsForRange,
  extractTitleVisualHints,
} from "@/lib/shotform-source-video-narration"
import type {
  EditPlan,
  MixInfo,
  MixPick,
  VideoAnalysis,
  VisualScene,
} from "@/lib/shotform-auto-edit-types"
import { analysisBySrcIndex } from "@/lib/shotform-analysis-src-index"

const SHOT_TYPES = ["미디엄샷", "와이드샷", "클로즈업", "익스트림클로즈업", "오버헤드샷", "풀샷", "기타"] as const

const SHOT_BRACKET_RE = /^\[(미디엄샷|와이드샷|클로즈업|익스트림클로즈업|오버헤드샷|풀샷|기타)\]\s*/

/** UI 표시용 — 설명 앞 [클로즈업]·[와이드샷] 등 샷 라벨 제거 */
export function stripShotLabelFromDescription(description: string): string {
  const t = description.trim()
  if (!t) return ""
  const stripped = t.replace(SHOT_BRACKET_RE, "").trim()
  return stripped || t
}

/** 숏폼 컷·장면 블록 최대 길이 (초) — 병합 시 이 값을 넘기지 않음 */
export const MAX_SCENE_BLOCK_SEC = 4

export type BenchmarkShotType = (typeof SHOT_TYPES)[number]

/** 0:12.5 형식 */
export function formatBenchmarkClock(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec - m * 60
  if (Math.abs(s - Math.round(s)) < 0.05) return `${m}:${String(Math.floor(s)).padStart(2, "0")}`
  return `${m}:${s.toFixed(1)}`
}

export function formatBenchmarkSceneRange(start: number, end: number): string {
  return `${formatBenchmarkClock(start)}-${formatBenchmarkClock(end)}`
}

export function sceneDurationLabel(start: number, end: number): string {
  const d = end - start
  return Math.abs(d - Math.round(d)) < 0.05 ? `${Math.round(d)}` : d.toFixed(1)
}

export function formatDescriptionWithShotBracket(description: string, shotType?: string): string {
  const shot = shotType || inferShotType(description)
  const stripped = description.replace(/^\[[^\]]+\]\s*/, "").trim()
  if (!stripped) return `[${shot}] 장면`
  if (/^\[(미디엄샷|와이드샷|클로즈업|익스트림클로즈업|오버헤드샷|풀샷|기타)\]/.test(stripped)) {
    return stripped
  }
  return `[${shot}] ${stripped}`
}

export function inferShotType(description: string): BenchmarkShotType {
  const d = description
  if (/익스트림|extreme|매크로|macro/i.test(d)) return "익스트림클로즈업"
  if (/클로즈|close|closeup|특写|特写/i.test(d)) return "클로즈업"
  if (/와이드|wide|전신|풀샷|full/i.test(d)) return "와이드샷"
  if (/오버헤드|위에서|탑뷰|top.?view/i.test(d)) return "오버헤드샷"
  if (/미디엄|medium|상반신|허리/i.test(d)) return "미디엄샷"
  return "기타"
}

export function normalizeBenchmarkVisualScenes(raw: unknown, duration: number): VisualScene[] {
  if (!Array.isArray(raw)) return []
  const out: VisualScene[] = []
  for (const row of raw) {
    if (!row || typeof row !== "object") continue
    const o = row as Record<string, unknown>
    const start = Number(o.start)
    const end = Number(o.end)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue
    const desc = String(o.description || o.visual_description || "").trim()
    const shotRaw = String(o.shot_type || o.shotType || "").trim()
    const shot_type = SHOT_TYPES.includes(shotRaw as BenchmarkShotType)
      ? (shotRaw as BenchmarkShotType)
      : inferShotType(desc)
    out.push({
      start: Math.max(0, Math.min(duration, start)),
      end: Math.max(0, Math.min(duration, end)),
      description: formatDescriptionWithShotBracket(desc || "장면", shot_type),
      shot_type,
    })
  }
  return out.sort((a, b) => a.start - b.start)
}

/** Vision 키프레임 캡션 → 출력용 visual_scenes (GPT 환각 대신 실제 화면) */
export function visualScenesFromVisionFrames(
  frames: Array<{ timeSec: number; caption?: string }>,
  duration: number
): VisualScene[] {
  const captioned = frames.filter((f) => f.caption?.trim()).sort((a, b) => a.timeSec - b.timeSec)
  if (!captioned.length) return []

  return captioned.map((f, i) => {
    const prev = captioned[i - 1]
    const next = captioned[i + 1]
    const start = i === 0 ? 0 : Math.round(((prev!.timeSec + f.timeSec) / 2) * 10) / 10
    const end =
      i === captioned.length - 1
        ? Math.round(duration * 10) / 10
        : Math.round(((f.timeSec + next!.timeSec) / 2) * 10) / 10
    const desc = f.caption!.trim()
    return {
      start,
      end: Math.max(start + 0.2, end),
      description: formatDescriptionWithShotBracket(desc, inferShotType(desc)),
      shot_type: inferShotType(desc),
    }
  })
}

/** 분석 결과의 전체 시각 타임라인 (벤치마크 장면 우선) */
export function visualTimelineForAnalysis(analysis: VideoAnalysis): VisualScene[] {
  if (analysis.visual_scenes?.length) return analysis.visual_scenes
  return analysis.scenes.map((s) => ({
    start: s.start,
    end: s.end,
    description: s.description,
    shot_type: inferShotType(s.description),
  }))
}

export function visualSceneAtTime(analysis: VideoAnalysis, timeSec: number): VisualScene | null {
  const t = Math.max(0, timeSec)
  const list = visualTimelineForAnalysis(analysis)
  for (const sc of list) {
    if (t >= sc.start - 0.05 && t < sc.end - 0.02) return sc
  }
  const last = list[list.length - 1]
  if (last && t >= last.start) return last
  return list[0] ?? null
}

/** 컷 중간 시각에 가장 가까운 Vision 키프레임 */
export function visionFrameNearest(
  analysis: VideoAnalysis,
  timeSec: number,
  maxDeltaSec = 3.5
): NonNullable<VideoAnalysis["vision_frames"]>[number] | null {
  const frames = analysis.vision_frames
  if (!frames?.length) return null
  let best = frames[0]!
  let bestDist = Math.abs(best.timeSec - timeSec)
  for (const f of frames) {
    const d = Math.abs(f.timeSec - timeSec)
    if (d < bestDist) {
      bestDist = d
      best = f
    }
  }
  return bestDist <= maxDeltaSec ? best : null
}

/** 소스 구간 안·근처 Vision 캡션 — 「제품 사용 장면」 폴백 대신 실제 화면 묘사 */
function visionCaptionForSourceRange(
  analysis: VideoAnalysis,
  sourceStart: number,
  sourceEnd: number
): string | null {
  const frames = analysis.vision_frames?.filter((f) => f.caption?.trim()) ?? []
  if (!frames.length) return null

  const inRange = frames.filter(
    (f) => f.timeSec >= sourceStart - 0.6 && f.timeSec <= sourceEnd + 0.6
  )
  for (const f of inRange) {
    const cap = f.caption!.trim()
    if (!descriptionSuggestsPresenterOrFace(cap)) return cap
  }

  const mid = (sourceStart + sourceEnd) / 2
  const nearest = visionFrameNearest(analysis, mid, 6)
  if (nearest?.caption?.trim() && !descriptionSuggestsPresenterOrFace(nearest.caption)) {
    return nearest.caption.trim()
  }

  for (const f of frames) {
    const cap = f.caption!.trim()
    if (!descriptionSuggestsPresenterOrFace(cap)) return cap
  }
  return null
}

const VEHICLE_HINT = /차량|자동차|차안|차\s*내부|시트|대시보드|트렁크|운전석|조수석|car\s*interior|vehicle|dashboard|car\s*seat/i

function captionConflictsWithText(caption: string, text: string): boolean {
  const hasVehicleInText = VEHICLE_HINT.test(text)
  const hasVehicleInCaption = VEHICLE_HINT.test(caption)
  return hasVehicleInText && !hasVehicleInCaption
}

/** 실제 소스 구간 화면 설명 — 컷 캡션·Vision 우선, GPT 장면 설명은 환각 시 무시 */
export function describeSourceRangeFromAnalysis(
  analysis: VideoAnalysis,
  sourceStart: number,
  sourceEnd: number,
  fallback?: string,
  cutCaption?: string
): string {
  if (cutCaption?.trim() && !descriptionSuggestsPresenterOrFace(cutCaption)) {
    return cutCaption.trim()
  }

  const mid = (sourceStart + sourceEnd) / 2
  const vf = visionFrameNearest(analysis, mid, 5)
  if (vf?.caption?.trim() && !descriptionSuggestsPresenterOrFace(vf.caption)) {
    return vf.caption.trim()
  }

  const visionCaption = visionCaptionForSourceRange(analysis, sourceStart, sourceEnd)
  if (visionCaption) {
    return visionCaption
  }

  const atMid = visualSceneAtTime(analysis, mid)
  if (atMid && mid >= atMid.start - 0.15 && mid <= atMid.end + 0.15) {
    const sceneDesc = atMid.description.replace(/^\[[^\]]+\]\s*/, "").trim() || atMid.description
    if (
      !descriptionSuggestsPresenterOrFace(sceneDesc) &&
      !captionConflictsWithText(vf?.caption || "", sceneDesc)
    ) {
      return sceneDesc
    }
  }

  const rangeScenes = collectSceneDescriptionsForRange(analysis, sourceStart, sourceEnd)
  if (rangeScenes.length) {
    return rangeScenes[0]!
  }

  const titleHint = extractTitleVisualHints(analysis.title)
  const summaryHint = analysis.summary?.trim()
  if (titleHint || summaryHint) {
    return [titleHint, summaryHint].filter(Boolean).join(" — ").slice(0, 120)
  }

  const anyVision = collectVisionCaptionsForRange(analysis, sourceStart, sourceEnd)
  if (anyVision.length) {
    return anyVision[0]!
  }

  const hasVisionCaptions = analysis.vision_frames?.some((f) => f.caption?.trim())
  if (hasVisionCaptions) {
    return "제품 사용 장면"
  }

  const fb = (fallback || "제품 장면").trim()
  if (descriptionSuggestsPresenterOrFace(fb)) {
    return "제품 사용 장면"
  }
  if (hasVisionCaptions && captionConflictsWithText(vf?.caption || "", fb)) {
    return "제품 사용 장면"
  }
  return fb
}

/** 소스 구간과 겹치는 장면 — 짧은 컷은 중간 시각 기준, 긴 구간은 겹침 최대 */
export function visualSceneForSourceRange(
  analysis: VideoAnalysis,
  sourceStart: number,
  sourceEnd: number
): VisualScene | null {
  const list = visualTimelineForAnalysis(analysis)
  if (!list.length) return null
  const mid = (sourceStart + sourceEnd) / 2
  const cutLen = sourceEnd - sourceStart

  if (cutLen <= 4.5) {
    const atMid = visualSceneAtTime(analysis, mid)
    if (atMid) return atMid
  }

  let best: VisualScene | null = null
  let bestOverlap = 0
  for (const sc of list) {
    const overlap = Math.max(0, Math.min(sourceEnd, sc.end) - Math.max(sourceStart, sc.start))
    if (overlap > bestOverlap) {
      bestOverlap = overlap
      best = sc
    }
  }
  return best ?? visualSceneAtTime(analysis, mid)
}

export function formatBenchmarkSceneCard(scene: VisualScene): string {
  const dur = sceneDurationLabel(scene.start, scene.end)
  const desc = stripShotLabelFromDescription(scene.description)
  const role = scene.scene_role ? `[${scene.scene_role}] ` : ""
  const script =
    scene.script_lines?.length && scene.script_lines.some((l) => l.trim())
      ? ` · 대본: ${scene.script_lines.filter((l) => l.trim()).join(" / ")}`
      : ""
  return `${formatBenchmarkSceneRange(scene.start, scene.end)} (${dur}초) ${role}${desc}${script}`
}

/** 편집 컷 — 소스 영상에서 실제로 자른 구간 기준 카드 */
export function formatCutVisualCard(
  analysis: VideoAnalysis,
  sourceStart: number,
  sourceEnd: number,
  description?: string,
  cutCaption?: string
): string {
  const desc = describeSourceRangeFromAnalysis(analysis, sourceStart, sourceEnd, description, cutCaption)
  const plain = stripShotLabelFromDescription(desc) || "제품 장면"
  const dur = sceneDurationLabel(sourceStart, sourceEnd)
  return `소스 ${sourceStart.toFixed(1)}–${sourceEnd.toFixed(1)}초 (${dur}초) ${plain}`
}

export function formatVisualReasonForCut(
  analysis: VideoAnalysis,
  sourceStart: number,
  sourceEnd: number
): string {
  return formatCutVisualCard(analysis, sourceStart, sourceEnd).slice(0, 120)
}

export function analysisByVideoId(analyses: VideoAnalysis[]): Map<string, VideoAnalysis> {
  return new Map(analyses.map((a) => [a.video_id, a]))
}

export function enrichMixPicksWithVisualReasons(mix: MixInfo, analyses: VideoAnalysis[]): MixInfo {
  const bySrc = analysisBySrcIndex(analyses)
  const picks = mix.picks.map((p) => {
    const a = bySrc.get(p.srcIndex)
    if (!a) return p
    const narrative = p.reason?.trim() || ""
    const isNarrative =
      narrative.length > 10 &&
      !narrative.startsWith("소스 ") &&
      !/^\d+(\.\d+)?–\d+(\.\d+)?초/.test(narrative)
    if (isNarrative) {
      const sc = visualSceneForSourceRange(a, p.start, p.end)
      const shot = sc?.shot_type || inferShotType(narrative)
      const suffix = narrative.includes(`[${shot}]`) ? "" : ` · [${shot}]`
      return { ...p, reason: `${narrative}${suffix}` }
    }
    const reason = formatVisualReasonForCut(a, p.start, p.end)
    return reason ? { ...p, reason } : p
  })
  return { ...mix, picks }
}

/** 짜집기 출력 타임라인 장면 — 벤치마크 analysis.scenes 형식 */
export function buildOutputTimelineScenes(
  editPlan: EditPlan,
  analyses: VideoAnalysis[],
  mixInfo?: MixInfo
): VisualScene[] {
  const contexts = buildCutScriptContexts(editPlan, analyses, mixInfo)
  const blocks = buildSceneSubtitleBlocksFromCuts(contexts, editPlan.target_duration)
  const byId = analysisByVideoId(analyses)

  return blocks.map((b) => {
    const ctx = contexts.find((c) => c.index === b.cut_indices[0])
    const a = ctx ? byId.get(ctx.video_id) : undefined
    const descFromCut = extractDescriptionFromVisualCard(b.visual_summary)
    const seg = editPlan.edit_plan[ctx ? ctx.index - 1 : -1]
    const descFromVision =
      a && ctx
        ? describeSourceRangeFromAnalysis(
            a,
            ctx.source_start,
            ctx.source_end,
            descFromCut,
            seg?.visual_caption
          )
        : descFromCut
    const shot = inferShotType(descFromVision)
    return {
      start: Math.round(b.start * 10) / 10,
      end: Math.round(b.end * 10) / 10,
      description: formatDescriptionWithShotBracket(descFromVision, shot),
      shot_type: shot,
    }
  })
}

function extractDescriptionFromVisualCard(card: string): string {
  const m = card.match(/\]\s*(.+)$/)
  if (m?.[1]) return m[1].trim()
  return card.replace(/^소스\s+[\d.–\s초()]+\s*/, "").trim() || "제품 장면"
}

export function enrichEditPlanWithVisualReasons(
  plan: EditPlan,
  analyses: VideoAnalysis[]
): EditPlan {
  const byId = analysisByVideoId(analyses)
  return {
    ...plan,
    edit_plan: plan.edit_plan.map((seg) => {
      const a = byId.get(seg.video_id)
      if (!a) return seg
      const reason = formatVisualReasonForCut(a, seg.source_start, seg.source_end)
      return reason ? { ...seg, reason } : seg
    }),
  }
}

export type CutScriptContext = {
  index: number
  output_start: number
  output_end: number
  duration: number
  video_id: string
  source_start: number
  source_end: number
  visual_card: string
  reason: string
}

export function buildCutScriptContexts(
  editPlan: EditPlan,
  analyses: VideoAnalysis[],
  mixInfo?: MixInfo
): CutScriptContext[] {
  const byId = analysisByVideoId(analyses)
  return editPlan.edit_plan.map((seg, i) => {
    const a = byId.get(seg.video_id)
    const visual_card = a
      ? formatCutVisualCard(a, seg.source_start, seg.source_end, seg.reason, seg.visual_caption)
      : seg.reason || mixInfo?.picks[i]?.reason || "장면"
    return {
      index: i + 1,
      output_start: seg.output_start,
      output_end: seg.output_end,
      duration: Math.round((seg.output_end - seg.output_start) * 10) / 10,
      video_id: seg.video_id,
      source_start: seg.source_start,
      source_end: seg.source_end,
      visual_card,
      reason: seg.reason,
    }
  })
}

/** sceneSubtitles 블록 — 편집 컷 1개 = 장면 1개 (숏폼 2~4초 리듬, 마지막 구간 늘리기 금지) */
export function buildSceneSubtitleBlocksFromCuts(
  contexts: CutScriptContext[],
  targetDuration: number
): Array<{ start: number; end: number; visual_summary: string; cut_indices: number[] }> {
  if (!contexts.length) return [{ start: 0, end: targetDuration, visual_summary: "", cut_indices: [] }]

  return contexts.map((ctx) => ({
    start: ctx.output_start,
    end: Math.min(targetDuration, ctx.output_end),
    visual_summary: ctx.visual_card,
    cut_indices: [ctx.index],
  }))
}
