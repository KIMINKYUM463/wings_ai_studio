import type {
  AutoEditJobResult,
  EditPlan,
  EditPlanSegment,
} from "@/lib/shotform-auto-edit-types"
import { normalizeAutoEditTargetDuration } from "@/lib/shotform-auto-edit-types"

const BLANK_VIDEO_ID = "__blank__"

function segmentIsBlank(seg: EditPlanSegment | null | undefined): boolean {
  if (!seg) return false
  return Boolean(seg.is_blank) || seg.video_id === BLANK_VIDEO_ID
}

export type InsertClipPlanArgs = {
  result: AutoEditJobResult
  /** 0-based: 이 컷 **뒤**에 삽입 ( -1 이면 맨 앞 ) */
  afterCutIndex: number
  clipDurationSec: number
  videoId: string
  reason?: string
  visualCaption?: string
}

export type InsertClipPlanResult = {
  result: AutoEditJobResult
  /** 새로 생긴 컷의 0-based 인덱스 */
  insertedCutIndex: number
  /** 출력 타임라인에서 삽입 시작 시각(초) */
  insertAtOutputSec: number
  /**
   * 공백 채우기 시 — 원본 MP4에서 이 시각까지를 제거하고 클립으로 대체.
   * 없으면 끼워넣기(길이 증가).
   */
  replaceEndOutputSec?: number
  scriptOverrides: Record<string, string>
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

/** 대본 overrides 키("1","2"…)를 컷 insert에 맞게 재배치 */
export function shiftScriptOverridesForInsert(
  overrides: Record<string, string>,
  insertedCutIndex: number
): Record<string, string> {
  const next: Record<string, string> = {}
  const keys = Object.keys(overrides)
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n) && n >= 1)
    .sort((a, b) => a - b)

  for (const sceneId of keys) {
    const idx = sceneId - 1
    if (idx < insertedCutIndex) {
      next[String(sceneId)] = overrides[String(sceneId)] || ""
    } else {
      next[String(sceneId + 1)] = overrides[String(sceneId)] || ""
    }
  }
  // 새 컷은 빈 대본 — 사용자가 채우거나 AI 재생성
  next[String(insertedCutIndex + 1)] = ""
  return next
}

/**
 * edit_plan에 수동 클립 1컷을 끼워 넣고, 이후 컷 output 시간을 밀어줍니다.
 */
export function insertClipIntoEditPlan(args: InsertClipPlanArgs): InsertClipPlanResult {
  const planSegs = args.result.editPlan?.edit_plan
  if (!planSegs?.length) {
    throw new Error("편집 플랜이 없습니다. 리믹스를 먼저 완료해 주세요.")
  }

  const clipDur = Math.max(0.4, Math.min(8, args.clipDurationSec))
  const after = Math.max(-1, Math.min(planSegs.length - 1, Math.floor(args.afterCutIndex)))
  const insertAt = after + 1

  const insertAtOutputSec =
    insertAt <= 0
      ? 0
      : planSegs[insertAt - 1]!.output_end

  const newSeg: EditPlanSegment = {
    video_id: args.videoId,
    source_start: 0,
    source_end: clipDur,
    output_start: insertAtOutputSec,
    output_end: insertAtOutputSec + clipDur,
    reason: args.reason || "수동 추가 영상",
    visual_caption: args.visualCaption || "사용자가 추가한 영상 클립",
  }

  const merged = [
    ...planSegs.slice(0, insertAt),
    newSeg,
    ...planSegs.slice(insertAt).map((seg) => ({
      ...seg,
      output_start: seg.output_start + clipDur,
      output_end: seg.output_end + clipDur,
    })),
  ]
  const retimed = retimePlan(merged)
  const totalDur = retimed[retimed.length - 1]?.output_end || clipDur
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
    mixInfo: args.result.mixInfo
      ? {
          ...args.result.mixInfo,
          // picks는 요약용 — 새 클립은 UI에서만 표시
        }
      : args.result.mixInfo,
  }

  return {
    result: nextResult,
    insertedCutIndex: insertAt,
    insertAtOutputSec,
    scriptOverrides: {},
  }
}

export type FillBlankClipPlanArgs = {
  result: AutoEditJobResult
  blankIndex: number
  clipDurationSec: number
  videoId: string
  reason?: string
  visualCaption?: string
}

/**
 * 공백 컷을 실제 영상으로 채웁니다.
 * 컷 개수·타임라인 길이는 유지하고, 넣을 길이는 항상 공백 길이와 같습니다.
 * (`clipDurationSec`는 호출부 호환용이며 무시됩니다.)
 */
export function fillBlankCutWithClip(args: FillBlankClipPlanArgs): InsertClipPlanResult {
  const planSegs = args.result.editPlan?.edit_plan
  if (!planSegs?.length) {
    throw new Error("편집 플랜이 없습니다. 리믹스를 먼저 완료해 주세요.")
  }

  const i = Math.max(0, Math.min(planSegs.length - 1, Math.floor(args.blankIndex)))
  const blank = planSegs[i]!
  if (!segmentIsBlank(blank)) {
    throw new Error("공백 컷 위에 놓아야 채울 수 있습니다.")
  }

  void args.clipDurationSec
  const blankStart = blank.output_start
  const blankEnd = blank.output_end
  const blankDur = Math.max(0.05, blankEnd - blankStart)
  // 공백 길이만큼만 채움 — 타임라인 길이는 변하지 않음
  const clipDur = blankDur

  const newSeg: EditPlanSegment = {
    video_id: args.videoId,
    source_start: 0,
    source_end: clipDur,
    output_start: blankStart,
    output_end: blankEnd,
    reason: args.reason || "공백에 추가한 영상",
    visual_caption: args.visualCaption || "공백을 채운 클립",
  }

  const merged = planSegs.map((seg, idx) => (idx === i ? newSeg : seg))
  const retimed = retimePlan(merged)
  const totalDur = retimed[retimed.length - 1]?.output_end || clipDur
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
  }

  return {
    result: nextResult,
    insertedCutIndex: i,
    insertAtOutputSec: blankStart,
    replaceEndOutputSec: blankEnd,
    scriptOverrides: {},
  }
}
