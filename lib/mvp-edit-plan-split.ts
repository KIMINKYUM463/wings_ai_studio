import type {
  AutoEditJobResult,
  EditPlan,
  EditPlanSegment,
} from "@/lib/shotform-auto-edit-types"
import { normalizeAutoEditTargetDuration } from "@/lib/shotform-auto-edit-types"
import { shiftScriptOverridesForInsert } from "@/lib/mvp-edit-plan-insert"
import {
  mvpEditPlanClipKey,
  parseMvpEditPlanClipKey,
  type MvpVideoSourceTransforms,
} from "@/lib/mvp-video-source-transform"
import type { VoiceLineCue } from "@/lib/shotform-factory-line-tts"

/** 자르기 시 앞·뒤 최소 길이(초) */
export const MVP_EDIT_PLAN_SPLIT_MIN_SEC = 0.2

/** 공백 컷 — 합성 MP4 위에도 미리보기·렌더에서 검정으로 가림 */
export const MVP_BLANK_VIDEO_ID = "__blank__"

export function isEditPlanBlank(seg: EditPlanSegment | null | undefined): boolean {
  if (!seg) return false
  return Boolean(seg.is_blank) || seg.video_id === MVP_BLANK_VIDEO_ID
}

export type SplitEditPlanArgs = {
  result: AutoEditJobResult
  /** 자를 컷 인덱스 (선택 클립) */
  cutIndex: number
  /** 출력 타임라인 기준 자르기 시각 */
  splitOutputSec: number
}

export type SplitEditPlanResult = {
  result: AutoEditJobResult
  /** 앞쪽(왼쪽) 컷 인덱스 — 기존과 동일 */
  leftCutIndex: number
  /** 뒤쪽(오른쪽) 새 컷 인덱스 */
  rightCutIndex: number
  /** 0~1 — 원본 컷에서 왼쪽이 차지하는 비율 */
  splitRatio: number
  scriptOverridesShift: (overrides: Record<string, string>) => Record<string, string>
  videoTransformsShift: (map: MvpVideoSourceTransforms) => MvpVideoSourceTransforms
  /** TTS 유지용 — 장면 인덱스를 앞/뒤로 나눔 */
  voiceLineCuesShift: (cues: readonly VoiceLineCue[]) => VoiceLineCue[]
}

function retimePlan(segments: EditPlanSegment[]): EditPlanSegment[] {
  let cursor = 0
  return segments.map((seg) => {
    const dur = Math.max(0.05, seg.output_end - seg.output_start)
    const next: EditPlanSegment = {
      ...seg,
      output_start: cursor,
      output_end: cursor + dur,
    }
    cursor += dur
    return next
  })
}

/** clip:N 키를 자르기 위치에 맞게 재배치 (새 오른쪽 컷은 왼쪽 transform 복제) */
export function shiftVideoTransformsForSplit(
  map: MvpVideoSourceTransforms,
  splitCutIndex: number
): MvpVideoSourceTransforms {
  const next: MvpVideoSourceTransforms = {}
  const leftKey = mvpEditPlanClipKey(splitCutIndex)
  const rightKey = mvpEditPlanClipKey(splitCutIndex + 1)
  const leftT = map[leftKey]

  for (const [key, value] of Object.entries(map)) {
    const idx = parseMvpEditPlanClipKey(key)
    if (idx == null) {
      next[key] = value
      continue
    }
    if (idx > splitCutIndex) {
      next[mvpEditPlanClipKey(idx + 1)] = value
    } else {
      next[mvpEditPlanClipKey(idx)] = value
    }
  }
  if (leftT) {
    next[leftKey] = leftT
    next[rightKey] = { ...leftT }
  }
  return next
}

/**
 * TTS 큐 장면 인덱스 재배치 (캡컷식).
 * 영상만 앞/뒤로 갈라짐 — TTS·나레이션은 원래 컷(왼쪽)에 그대로 두고,
 * 뒤쪽 새 컷은 대본/TTS 없이 영상만 이어집니다. 이후 컷 인덱스는 +1.
 */
export function shiftVoiceLineCuesForSplit(
  cues: readonly VoiceLineCue[],
  splitCutIndex: number,
  _splitRatio?: number
): VoiceLineCue[] {
  if (!cues.length) return []
  return cues.map((c) => {
    if (c.sceneIndex > splitCutIndex) {
      return { ...c, sceneIndex: c.sceneIndex + 1 }
    }
    return c
  })
}

/**
 * 선택 컷을 출력 타임라인 시각에서 둘로 가릅니다.
 * 합성 MP4는 그대로 두고 edit_plan만 나눕니다.
 * TTS는 시간축 그대로 유지(큐를 앞/뒤로 쪼개지 않음) — 캡컷처럼 영상 편집과 무관.
 */
export function splitEditPlanAtOutputTime(args: SplitEditPlanArgs): SplitEditPlanResult {
  const planSegs = args.result.editPlan?.edit_plan
  if (!planSegs?.length) {
    throw new Error("편집 플랜이 없습니다.")
  }

  const i = Math.floor(args.cutIndex)
  if (i < 0 || i >= planSegs.length) {
    throw new Error("자를 컷을 선택해 주세요.")
  }

  const seg = planSegs[i]!
  const outDur = Math.max(0.05, seg.output_end - seg.output_start)
  const srcDur = Math.max(0.05, seg.source_end - seg.source_start)
  const min = MVP_EDIT_PLAN_SPLIT_MIN_SEC

  const splitOut = Math.max(
    seg.output_start + min,
    Math.min(seg.output_end - min, args.splitOutputSec)
  )
  if (splitOut <= seg.output_start + min - 0.001 || splitOut >= seg.output_end - min + 0.001) {
    if (outDur < min * 2) {
      throw new Error(`컷이 너무 짧아 자를 수 없습니다. (최소 ${min * 2}초)`)
    }
    throw new Error(`빨간바를 컷 안쪽(양끝 ${min}초 제외)에 두고 자르세요.`)
  }

  const splitRatio = (splitOut - seg.output_start) / outDur
  const splitSrc = isEditPlanBlank(seg)
    ? splitRatio * srcDur
    : seg.source_start + splitRatio * srcDur

  const left: EditPlanSegment = {
    ...seg,
    source_end: isEditPlanBlank(seg) ? splitSrc : splitSrc,
    output_end: splitOut,
    reason: seg.reason,
  }
  const right: EditPlanSegment = {
    ...seg,
    source_start: isEditPlanBlank(seg) ? 0 : splitSrc,
    source_end: isEditPlanBlank(seg) ? Math.max(0.05, srcDur - splitSrc) : seg.source_end,
    output_start: splitOut,
    reason: seg.reason,
    visual_caption: seg.visual_caption
      ? `${seg.visual_caption} (이어짐)`
      : seg.visual_caption,
  }

  const merged = [...planSegs.slice(0, i), left, right, ...planSegs.slice(i + 1)]
  const retimed = retimePlan(merged)
  const totalDur = retimed[retimed.length - 1]?.output_end || outDur
  const target = normalizeAutoEditTargetDuration(
    Math.ceil(totalDur / 5) * 5,
    args.result.editPlan?.target_duration || 30
  )

  const nextPlan: EditPlan = {
    target_duration: target,
    edit_plan: retimed,
  }

  const nextResult: AutoEditJobResult = {
    ...args.result,
    editPlan: nextPlan,
    outputDuration: totalDur,
    mixInfo: args.result.mixInfo ? { ...args.result.mixInfo } : args.result.mixInfo,
  }

  return {
    result: nextResult,
    leftCutIndex: i,
    rightCutIndex: i + 1,
    splitRatio,
    scriptOverridesShift: (overrides) =>
      shiftScriptOverridesForInsert(overrides, i + 1),
    videoTransformsShift: (map) => shiftVideoTransformsForSplit(map, i),
    voiceLineCuesShift: (cues) => shiftVoiceLineCuesForSplit(cues, i, splitRatio),
  }
}

/** 선택 컷을 공백으로 — 길이·TTS 유지, 화면만 비움 */
export function convertEditPlanCutToBlank(
  result: AutoEditJobResult,
  cutIndex: number
): AutoEditJobResult {
  const planSegs = result.editPlan?.edit_plan
  if (!planSegs?.length) throw new Error("편집 플랜이 없습니다.")
  const i = Math.floor(cutIndex)
  if (i < 0 || i >= planSegs.length) throw new Error("공백으로 바꿀 컷을 선택해 주세요.")

  const seg = planSegs[i]!
  if (isEditPlanBlank(seg)) return result

  const dur = Math.max(0.05, seg.output_end - seg.output_start)
  const blank: EditPlanSegment = {
    ...seg,
    video_id: MVP_BLANK_VIDEO_ID,
    source_start: 0,
    source_end: dur,
    is_blank: true,
    reason: "공백 (영상 제거 · TTS 유지)",
    visual_caption: "공백 — 「추가 영상」으로 다른 클립을 넣을 수 있습니다",
  }

  const nextPlan: EditPlan = {
    target_duration: result.editPlan!.target_duration,
    edit_plan: planSegs.map((s, idx) => (idx === i ? blank : s)),
  }

  return {
    ...result,
    editPlan: nextPlan,
  }
}

export type RemoveEditPlanCutResult = {
  result: AutoEditJobResult
  removeStartSec: number
  removeEndSec: number
  removedDurationSec: number
  scriptOverridesShift: (overrides: Record<string, string>) => Record<string, string>
  videoTransformsShift: (map: MvpVideoSourceTransforms) => MvpVideoSourceTransforms
  voiceLineCuesShift: (cues: readonly VoiceLineCue[]) => VoiceLineCue[]
}

/**
 * 선택 컷을 타임라인에서 제거하고 뒤를 당겨 붙입니다(캡컷 리플 삭제).
 * MP4는 removeStart~removeEnd 구간을 잘라내야 합니다.
 * TTS 큐는 시간축을 당겨 영상에 맞춥니다(해당 컷 큐는 제거).
 */
export function removeEditPlanCut(
  result: AutoEditJobResult,
  cutIndex: number
): RemoveEditPlanCutResult {
  const planSegs = result.editPlan?.edit_plan
  if (!planSegs?.length) throw new Error("편집 플랜이 없습니다.")
  if (planSegs.length <= 1) {
    throw new Error("마지막 남은 컷은 삭제할 수 없습니다.")
  }
  const i = Math.floor(cutIndex)
  if (i < 0 || i >= planSegs.length) throw new Error("삭제할 컷을 선택해 주세요.")

  const seg = planSegs[i]!
  const removeStartSec = seg.output_start
  const removeEndSec = seg.output_end
  const removedDurationSec = Math.max(0.05, removeEndSec - removeStartSec)

  const merged = [...planSegs.slice(0, i), ...planSegs.slice(i + 1)]
  const retimed = retimePlan(merged)
  const totalDur = retimed[retimed.length - 1]?.output_end || 0.5
  const target = normalizeAutoEditTargetDuration(
    Math.ceil(totalDur / 5) * 5,
    result.editPlan?.target_duration || 30
  )

  const nextResult: AutoEditJobResult = {
    ...result,
    editPlan: { target_duration: target, edit_plan: retimed },
    outputDuration: totalDur,
  }

  return {
    result: nextResult,
    removeStartSec,
    removeEndSec,
    removedDurationSec,
    scriptOverridesShift: (overrides) => {
      const next: Record<string, string> = {}
      const keys = Object.keys(overrides)
        .map((k) => Number(k))
        .filter((n) => Number.isFinite(n) && n >= 1)
        .sort((a, b) => a - b)
      for (const sceneId of keys) {
        const idx = sceneId - 1
        if (idx === i) continue
        if (idx < i) next[String(sceneId)] = overrides[String(sceneId)] || ""
        else next[String(sceneId - 1)] = overrides[String(sceneId)] || ""
      }
      return next
    },
    videoTransformsShift: (map) => {
      const next: MvpVideoSourceTransforms = {}
      for (const [key, value] of Object.entries(map)) {
        const idx = parseMvpEditPlanClipKey(key)
        if (idx == null) {
          next[key] = value
          continue
        }
        if (idx === i) continue
        if (idx < i) next[mvpEditPlanClipKey(idx)] = value
        else next[mvpEditPlanClipKey(idx - 1)] = value
      }
      return next
    },
    voiceLineCuesShift: (cues) => {
      if (!cues.length) return []
      const out: VoiceLineCue[] = []
      for (const c of cues) {
        if (c.sceneIndex === i) continue
        let sceneIndex = c.sceneIndex
        if (sceneIndex > i) sceneIndex -= 1
        let startSec = c.startSec
        let endSec = c.endSec
        if (endSec <= removeStartSec + 0.02) {
          out.push({ ...c, sceneIndex })
          continue
        }
        if (startSec >= removeEndSec - 0.02) {
          out.push({
            ...c,
            sceneIndex,
            startSec: Math.max(0, startSec - removedDurationSec),
            endSec: Math.max(0.05, endSec - removedDurationSec),
          })
          continue
        }
        // 삭제 구간과 겹치면 앞쪽만 남김
        if (startSec < removeStartSec) {
          out.push({
            ...c,
            sceneIndex,
            endSec: Math.max(startSec + 0.05, removeStartSec),
          })
        }
        // 구간 안에서 시작된 큐는 제거
      }
      return out
    },
  }
}

/**
 * 컷 순서를 바꿉니다(캡컷식 드래그 이동). TTS 큐는 변경하지 않습니다.
 * concatRanges = 이동 전 MP4 타임라인에서 새 순서로 이어 붙일 구간.
 */
export function reorderEditPlanCut(
  result: AutoEditJobResult,
  fromIndex: number,
  toIndex: number
): {
  result: AutoEditJobResult
  fromIndex: number
  toIndex: number
  order: number[]
  concatRanges: Array<{ startSec: number; endSec: number }>
  scriptOverridesShift: (overrides: Record<string, string>) => Record<string, string>
  videoTransformsShift: (map: MvpVideoSourceTransforms) => MvpVideoSourceTransforms
} {
  const planSegs = result.editPlan?.edit_plan
  if (!planSegs?.length) throw new Error("편집 플랜이 없습니다.")
  const n = planSegs.length
  const from = Math.floor(fromIndex)
  const to = Math.max(0, Math.min(n - 1, Math.floor(toIndex)))
  if (from < 0 || from >= n) throw new Error("이동할 컷을 선택해 주세요.")
  if (from === to) {
    const identity = Array.from({ length: n }, (_, i) => i)
    return {
      result,
      fromIndex: from,
      toIndex: to,
      order: identity,
      concatRanges: planSegs.map((s) => ({
        startSec: s.output_start,
        endSec: s.output_end,
      })),
      scriptOverridesShift: (o) => ({ ...o }),
      videoTransformsShift: (m) => ({ ...m }),
    }
  }

  const oldRanges = planSegs.map((s) => ({
    startSec: s.output_start,
    endSec: s.output_end,
  }))
  const order = Array.from({ length: n }, (_, i) => i)
  const [moved] = order.splice(from, 1)
  order.splice(to, 0, moved!)

  const reorderedSegs = order.map((oldIdx) => ({ ...planSegs[oldIdx]! }))
  const retimed = retimePlan(reorderedSegs)
  const totalDur = retimed[retimed.length - 1]?.output_end || 0.5
  const target = normalizeAutoEditTargetDuration(
    Math.ceil(totalDur / 5) * 5,
    result.editPlan?.target_duration || 30
  )

  const nextResult: AutoEditJobResult = {
    ...result,
    editPlan: { target_duration: target, edit_plan: retimed },
    outputDuration: totalDur,
  }

  return {
    result: nextResult,
    fromIndex: from,
    toIndex: to,
    order,
    concatRanges: order.map((oldIdx) => oldRanges[oldIdx]!),
    scriptOverridesShift: (overrides) => {
      const next: Record<string, string> = {}
      for (let newIdx = 0; newIdx < n; newIdx++) {
        const oldIdx = order[newIdx]!
        next[String(newIdx + 1)] = overrides[String(oldIdx + 1)] ?? ""
      }
      return next
    },
    videoTransformsShift: (map) => {
      const next: MvpVideoSourceTransforms = {}
      for (const [key, value] of Object.entries(map)) {
        const idx = parseMvpEditPlanClipKey(key)
        if (idx == null) {
          next[key] = value
          continue
        }
      }
      for (let newIdx = 0; newIdx < n; newIdx++) {
        const oldIdx = order[newIdx]!
        const oldKey = mvpEditPlanClipKey(oldIdx)
        if (map[oldKey]) next[mvpEditPlanClipKey(newIdx)] = map[oldKey]!
      }
      return next
    },
  }
}

