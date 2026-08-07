/**
 * 벤치마크 「장면 맞춤」— 컷(영상) 길이에 TTS 배속을 맞추고,
 * 음성이 짧으면 영상 끝을 음성에 맞춰 자릅니다.
 */

import type { NarrationSegment } from "@/lib/shotform-factory-narration-script"
import type { VoiceLineCue } from "@/lib/shotform-factory-line-tts"
import {
  estimateNarrationDurationSec,
  narrationPlainCharCount,
  clampNarrationForTtsFit,
} from "@/lib/shotform-narration-timing"
import {
  clampTtsSpeed,
  DEFAULT_TTS_SPEED,
  normalizeTtsSpeed,
  type TtsSpeedOption,
} from "@/lib/shotform-tts-speed"

function sceneAudioDurationSec(sceneIndex: number, cues: readonly VoiceLineCue[]): number {
  const sceneCues = cues.filter((c) => c.sceneIndex === sceneIndex)
  if (!sceneCues.length) return 0.05
  return Math.max(
    0.05,
    sceneCues.reduce((a, c) => a + Math.max(0.01, c.endSec - c.startSec), 0)
  )
}

/** 음성이 영상보다 살짝 짧게 나오도록 두는 비율 (이후 음성에 맞춰 자름) */
export const SCENE_FIT_AUDIO_FILL_RATIO = 0.92

/** 실측 후 재합성 허용 오차(초) */
export const SCENE_FIT_RETRY_SLACK_SEC = 0.2

/**
 * 장면 영상 길이에 맞춰 TTS 배속을 고릅니다.
 * - 말이 길면 배속을 올려 영상에 맞춤 (최대 1.35x — 그 이상은 말 뭉개짐·끊김 위험)
 * - 최대 배속으로도 안 들어가면 기준 배속 유지 → 영상 끝 홀드 (문장 전체를 말함)
 * - 말이 짧으면 기준 배속 유지 → 이후 영상을 음성에 맞춰 자름
 */
export function suggestSceneTtsSpeed(
  text: string,
  videoDurSec: number,
  baseSpeed: number = DEFAULT_TTS_SPEED
): TtsSpeedOption {
  const base = normalizeTtsSpeed(baseSpeed)
  const estAt1x = estimateNarrationDurationSec(text)
  if (!narrationPlainCharCount(text) || videoDurSec < 0.35 || estAt1x < 0.2) {
    return base
  }

  const targetAudio = Math.max(0.45, videoDurSec * SCENE_FIT_AUDIO_FILL_RATIO)
  const needed = estAt1x / targetAudio
  if (needed <= base) return base
  // 1.5x까지 강제하면 초단컷에서 발화가 뭉개지거나 중간에 끊긴 것처럼 들림
  const capped = Math.min(1.35, needed)
  if (capped > 1.35 - 1e-6 && needed > 1.45) {
    // 영상에 못 넣음 → 배속 올리지 않고 전체 문장 유지 (홀드)
    return base
  }
  return normalizeTtsSpeed(Math.max(base, capped))
}

/** 컷별 권장 TTS 배속 배열 */
export function suggestSceneTtsSpeeds(
  texts: readonly string[],
  videoDurationsSec: readonly number[],
  baseSpeed: number = DEFAULT_TTS_SPEED
): TtsSpeedOption[] {
  return texts.map((text, i) =>
    suggestSceneTtsSpeed(text, videoDurationsSec[i] ?? 3, baseSpeed)
  )
}

/**
 * 실측 음성 길이가 여전히 영상보다 길면 더 빠른 배속을 제안 (재합성용).
 * 이미 최대면 null.
 */
export function suggestFasterSpeedIfAudioOverflows(args: {
  measuredAudioSec: number
  videoDurSec: number
  currentSpeed: number
}): TtsSpeedOption | null {
  const { measuredAudioSec, videoDurSec, currentSpeed } = args
  if (videoDurSec < 0.35) return null
  if (measuredAudioSec <= videoDurSec + SCENE_FIT_RETRY_SLACK_SEC) return null
  const cur = clampTtsSpeed(currentSpeed)
  if (cur >= 1.35 - 1e-6) return null
  // duration ∝ 1/speed → newSpeed = cur * (measured / target)
  const target = Math.max(0.45, videoDurSec * SCENE_FIT_AUDIO_FILL_RATIO)
  const next = normalizeTtsSpeed(Math.min(1.35, cur * (measuredAudioSec / target)))
  return next > cur + 0.04 ? next : cur < 1.35 ? normalizeTtsSpeed(Math.min(1.35, cur + 0.1)) : null
}

/** 음성 길이에 맞춰 컷 end를 앞으로 당긴 세그먼트 */
export function trimSegmentsToMatchAudio(
  segments: readonly NarrationSegment[],
  cues: readonly VoiceLineCue[]
): NarrationSegment[] {
  return segments.map((seg, i) => {
    const audioDur = sceneAudioDurationSec(i, cues)
    const videoDur = Math.max(0.05, seg.end - seg.start)
    if (audioDur <= 0.05) return { ...seg }
    // 음성이 더 짧을 때만 영상 끝 자르기 (길면 배속으로 맞춘 뒤에도 남으면 홀드)
    if (audioDur + 0.05 >= videoDur) return { ...seg }
    const end = Math.round((seg.start + audioDur) * 100) / 100
    return { ...seg, end: Math.max(seg.start + 0.08, end) }
  })
}

/** 컷별 맞춤 end만 추출 (persist용) — 원본보다 짧을 때만 */
export function audioFitEndsFromCues(
  segments: readonly NarrationSegment[],
  cues: readonly VoiceLineCue[]
): number[] {
  return trimSegmentsToMatchAudio(segments, cues).map((s) => s.end)
}

export type SceneFitRow = {
  sceneIndex: number
  videoDurSec: number
  audioDurSec: number
  speed: number
  /** 음성 < 영상 → 자를 수 있음 */
  canTrimToAudio: boolean
  /** 음성 > 영상 → 홀드 위험 */
  audioOverflows: boolean
  status: "ok" | "trim" | "overflow"
}

export function buildSceneFitRows(
  segments: readonly NarrationSegment[],
  cues: readonly VoiceLineCue[] | null | undefined,
  sceneSpeeds: readonly number[] | null | undefined,
  baseSpeed: number = DEFAULT_TTS_SPEED
): SceneFitRow[] {
  return segments.map((seg, i) => {
    const videoDurSec = Math.max(0.05, seg.end - seg.start)
    const audioDurSec = cues?.length ? sceneAudioDurationSec(i, cues) : 0
    const speed = normalizeTtsSpeed(sceneSpeeds?.[i] ?? baseSpeed)
    const canTrimToAudio = audioDurSec > 0.05 && audioDurSec + 0.08 < videoDurSec
    const audioOverflows = audioDurSec > 0.05 && audioDurSec > videoDurSec + 0.08
    const status: SceneFitRow["status"] = audioOverflows
      ? "overflow"
      : canTrimToAudio
        ? "trim"
        : "ok"
    return {
      sceneIndex: i,
      videoDurSec: Math.round(videoDurSec * 10) / 10,
      audioDurSec: Math.round(audioDurSec * 10) / 10,
      speed,
      canTrimToAudio,
      audioOverflows,
      status,
    }
  })
}

/** playback용 — fitEnds가 있으면 end 덮어쓰기 */
export function applyAudioFitEnds(
  segments: readonly NarrationSegment[],
  fitEnds: readonly number[] | null | undefined
): NarrationSegment[] {
  if (!fitEnds?.length) return segments.map((s) => ({ ...s }))
  return segments.map((seg, i) => {
    const end = fitEnds[i]
    if (end == null || !Number.isFinite(end)) return { ...seg }
    const clamped = Math.min(seg.end, Math.max(seg.start + 0.08, end))
    return { ...seg, end: clamped }
  })
}

/** TTS 직전 — 최대 배속으로도 영상에 들어가게 대본 축약 */
export function clampSceneTextForVideoFit(
  text: string,
  videoDurSec: number,
  maxSpeed = 1.5
): string {
  return clampNarrationForTtsFit(text, videoDurSec, maxSpeed)
}

/**
 * 실측 음성이 여전히 길면 더 짧게 축약 (재합성용).
 */
export function shrinkSceneTextForRetry(
  text: string,
  videoDurSec: number,
  maxSpeed = 1.5
): string {
  return clampNarrationForTtsFit(text, Math.max(0.6, videoDurSec * 0.7), maxSpeed)
}
