import type { NarrationSegment } from "@/lib/shotform-factory-narration-script"
import { voiceLineCueAtTime, type VoiceLineCue } from "@/lib/shotform-factory-line-tts"

/** TTS 큐(오디오 타임라인) → 짜집기 영상 타임라인 구간 — 1배속·앞부분만 사용 */
export function videoRangeFromVoiceCue(
  cue: VoiceLineCue,
  segments: readonly NarrationSegment[],
  allCues?: readonly VoiceLineCue[]
): { startSec: number; endSec: number } {
  const seg = segments[cue.sceneIndex]
  if (!seg) return { startSec: cue.startSec, endSec: cue.endSec }

  const segStart = seg.start
  const segEnd = Math.max(seg.start + 0.05, seg.end)

  const pool = allCues?.length ? allCues : [cue]
  const sceneCues = pool.filter((c) => c.sceneIndex === cue.sceneIndex)
  const audioStart = sceneCues[0]?.startSec ?? cue.startSec
  const offset = Math.max(0, cue.startSec - audioStart)
  const dur = Math.max(0.05, cue.endSec - cue.startSec)
  const start = Math.min(segEnd, segStart + offset)
  const end = Math.min(segEnd, start + dur)

  return { startSec: start, endSec: Math.max(start + 0.05, end) }
}

/** TTS 재생 시각 → 짜집기 영상 타임라인 (컷 시작부터 1배속, TTS만큼만 사용·나머지 컷은 자름) */
export function videoTimeFromAudioCueSync(
  audioTimeSec: number,
  cues: readonly VoiceLineCue[],
  segments: readonly NarrationSegment[],
  fallbackVideoDuration: number,
  _fallbackAudioDuration: number
): number {
  if (!cues.length || !segments.length) {
    if (fallbackVideoDuration > 0) {
      return Math.min(fallbackVideoDuration, Math.max(0, audioTimeSec))
    }
    return audioTimeSec
  }

  const cue = voiceLineCueAtTime(cues, audioTimeSec)
  if (!cue) return 0

  const { startSec: vidStart, endSec: vidEnd } = sceneVideoRange(cue.sceneIndex, segments)
  const sceneCues = cues.filter((c) => c.sceneIndex === cue.sceneIndex)
  const audioStart = sceneCues[0]?.startSec ?? cue.startSec
  const elapsed = Math.max(0, audioTimeSec - audioStart)
  const videoSpan = Math.max(0.05, vidEnd - vidStart)
  const audioSpan = sceneAudioDurationSec(cue.sceneIndex, cues)
  if (audioSpan > videoSpan + 0.08) {
    return vidStart + (elapsed % videoSpan)
  }
  return Math.min(vidEnd, vidStart + elapsed)
}

/** 영상 시각 → 오디오 시각 (슬라이더 역변환, 1배속 1:1) */
export function audioTimeFromVideoSync(
  videoTimeSec: number,
  cues: readonly VoiceLineCue[],
  segments: readonly NarrationSegment[],
  fallbackVideoDuration: number,
  fallbackAudioDuration: number
): number {
  if (!cues.length || !segments.length) {
    if (fallbackVideoDuration > 0 && fallbackAudioDuration > 0) {
      return Math.min(fallbackAudioDuration, Math.max(0, videoTimeSec))
    }
    return videoTimeSec
  }

  for (let sceneIndex = 0; sceneIndex < segments.length; sceneIndex++) {
    const { startSec: vidStart, endSec: vidEnd } = sceneVideoRange(sceneIndex, segments)
    if (videoTimeSec < vidStart - 0.02 || videoTimeSec >= vidEnd - 0.01) continue
    const sceneCues = cues.filter((c) => c.sceneIndex === sceneIndex)
    if (!sceneCues.length) continue
    const audioStart = sceneCues[0]!.startSec
    const audioEnd = sceneCues[sceneCues.length - 1]!.endSec
    const elapsed = Math.max(0, videoTimeSec - vidStart)
    return Math.min(audioEnd, audioStart + elapsed)
  }

  const lastSeg = segments[segments.length - 1]
  const lastCue = cues[cues.length - 1]
  if (lastSeg && lastCue && videoTimeSec >= lastSeg.start) {
    return lastCue.endSec
  }
  return 0
}

/** 장면(컷) 전체의 영상 구간 — 재생 동기화는 줄 단위가 아니라 이 범위를 씀 */
export function sceneVideoRange(
  sceneIndex: number,
  segments: readonly NarrationSegment[]
): { startSec: number; endSec: number } {
  const seg = segments[sceneIndex]
  if (!seg) return { startSec: 0, endSec: 0.05 }
  return { startSec: seg.start, endSec: Math.max(seg.start + 0.05, seg.end) }
}

/** 장면 TTS 총 길이 */
export function sceneAudioDurationSec(
  sceneIndex: number,
  cues: readonly VoiceLineCue[]
): number {
  const sceneCues = cues.filter((c) => c.sceneIndex === sceneIndex)
  if (!sceneCues.length) return 0.05
  return Math.max(
    0.05,
    sceneCues.reduce((a, c) => a + Math.max(0.01, c.endSec - c.startSec), 0)
  )
}

/**
 * 영상 배속 — 항상 1.
 * 장면 맞춤: TTS 배속으로 음성 길이를 컷에 맞추고, 음성이 짧으면 컷 앞부분만 재생(나머지 자름).
 * TTS가 길면 컷 영상을 반복 재생해 음성 길이에 맞춤.
 */
export function previewPlaybackRateForCue(
  _cue: VoiceLineCue,
  _segments: readonly NarrationSegment[],
  _cues: readonly VoiceLineCue[]
): number {
  return 1
}

/** 장면 TTS 경과 → 영상 시각 (1배속). TTS가 더 길면 컷 안에서 루프 */
function expectedVideoTimeInScene(
  audioT: number,
  sceneIndex: number,
  segments: readonly NarrationSegment[],
  cues: readonly VoiceLineCue[]
): number {
  const { startSec: vidStart, endSec: vidEnd } = sceneVideoRange(sceneIndex, segments)
  const sceneCues = cues.filter((c) => c.sceneIndex === sceneIndex)
  if (!sceneCues.length) return vidStart
  const audioStart = sceneCues[0]!.startSec
  const elapsed = Math.max(0, audioT - audioStart)
  const videoSpan = Math.max(0.05, vidEnd - vidStart)
  const audioSpan = sceneAudioDurationSec(sceneIndex, cues)
  if (audioSpan > videoSpan + 0.08) {
    const looped = elapsed % videoSpan
    return vidStart + looped
  }
  return Math.min(vidEnd, vidStart + elapsed)
}

export type MvpVideoAudioSyncState = {
  lastScene: number
  lastCueKey: string
  /** @deprecated TTS 길면 루프 — 홀드 미사용 */
  holdingEnd?: boolean
}

/** 홀드 줌 비활성 — 끝 프레임만 유지하고 확대하지 않음 */
export const MVP_HOLD_END_ZOOM_MAX = 1.0

/** 다음 컷 선행 시작 길이(초) — 홀드 직후 점프 완화 */
export const MVP_SCENE_CROSSFADE_SEC = 0.28

/** 컷 전환 깜빡 반폭(초). 경계 전후 아주 짧게만 어두워짐 */
export const MVP_SCENE_BLINK_HALF_SEC = 0.06
/** 깜빡 최저 밝기(1=그대로). 완전 암전 대신 살짝만 */
export const MVP_SCENE_BLINK_FLOOR = 0.45

export type MvpHoldEndZoomInfo = {
  sceneIndex: number
  /** 홀드 구간 길이(초) */
  holdPadSec: number
  /** 0~1 */
  progress: number
}

/**
 * 홀드 줌 정보 — 확대 효과는 쓰지 않음(항상 null).
 */
export function mvpHoldEndZoomInfo(
  _audioT: number,
  _cues: readonly VoiceLineCue[] | null | undefined,
  _segments: readonly NarrationSegment[]
): MvpHoldEndZoomInfo | null {
  return null
}

/**
 * TTS가 컷보다 길어서 끝 프레임을 유지하는 구간의 진행도 (0~1).
 * 홀드가 아니면 0.
 */
export function mvpHoldEndZoomProgress(
  audioT: number,
  cues: readonly VoiceLineCue[] | null | undefined,
  segments: readonly NarrationSegment[]
): number {
  return mvpHoldEndZoomInfo(audioT, cues, segments)?.progress ?? 0
}

/** ease-in-out cubic — 가속·감속이 대칭이라 Ken Burns에 자연스러움 */
export function mvpHoldEndZoomScale(
  progress: number,
  maxScale: number = MVP_HOLD_END_ZOOM_MAX
): number {
  const p = Math.min(1, Math.max(0, progress))
  if (p <= 0) return 1
  const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
  return 1 + eased * (Math.max(1, maxScale) - 1)
}

export function mvpHoldEndZoomScaleAtAudioTime(
  audioT: number,
  cues: readonly VoiceLineCue[] | null | undefined,
  segments: readonly NarrationSegment[]
): number {
  return mvpHoldEndZoomScale(mvpHoldEndZoomProgress(audioT, cues, segments))
}

function sceneCountFromCues(cues: readonly VoiceLineCue[]): number {
  let max = -1
  for (const c of cues) if (c.sceneIndex > max) max = c.sceneIndex
  return max + 1
}

/**
 * 컷 전환 시 짧은 깜빡(0~1).
 * 긴 페이드가 아니라 경계 순간만 살짝 어두워졌다가 바로 복귀합니다.
 */
export function mvpSceneBoundaryFadeOpacity(
  audioT: number,
  cues: readonly VoiceLineCue[] | null | undefined,
  blinkHalfSec: number = MVP_SCENE_BLINK_HALF_SEC
): number {
  if (!cues?.length) return 1
  const cue = voiceLineCueAtTime(cues, audioT)
  if (!cue) return 1
  const range = audioRangeForSceneIndex(cue.sceneIndex, cues)
  if (!range) return 1

  const half = Math.max(0.03, blinkHalfSec)
  const sceneCount = sceneCountFromCues(cues)
  let dist = Number.POSITIVE_INFINITY
  // 첫 컷 시작은 깜빡 없음
  if (cue.sceneIndex > 0) {
    dist = Math.min(dist, Math.abs(audioT - range.startSec))
  }
  if (cue.sceneIndex < sceneCount - 1) {
    dist = Math.min(dist, Math.abs(audioT - range.endSec))
  }
  if (!Number.isFinite(dist) || dist >= half) return 1

  // 경계에서 floor, 반폭 끝에서 1 — 삼각 깜빡
  const u = dist / half
  return MVP_SCENE_BLINK_FLOOR + (1 - MVP_SCENE_BLINK_FLOOR) * u
}

/**
 * TTS ↔ 영상 동기화
 * - 영상은 항상 1배속
 * - TTS가 컷보다 짧음 → 컷 앞부분을 TTS 길이만큼만 재생(뒤 자름), 배속 없음
 * - TTS가 컷보다 김 → 끝 프레임 유지(홀드). 말은 끝까지 재생한 뒤 다음 컷으로 전환
 */
export function syncMvpPreviewVideoToAudio(
  video: HTMLVideoElement,
  audioT: number,
  cues: readonly VoiceLineCue[] | null | undefined,
  segments: readonly NarrationSegment[],
  videoDur: number,
  audioDur: number,
  state: MvpVideoAudioSyncState,
  opts?: { forceSeek?: boolean; holdOnEnd?: boolean; allowAutoPlay?: boolean }
): void {
  const allowAutoPlay = opts?.allowAutoPlay !== false

  if (!cues?.length) {
    if (videoDur > 0) {
      const target = Math.min(videoDur, Math.max(0, audioT))
      if (Math.abs(video.currentTime - target) > 0.08) {
        video.currentTime = target
      }
    }
    if (Math.abs(video.playbackRate - 1) > 0.02) video.playbackRate = 1
    return
  }

  const cue = voiceLineCueAtTime(cues, audioT)
  if (!cue) return

  const { startSec: vidStart, endSec: vidEnd } = sceneVideoRange(cue.sceneIndex, segments)
  if (Math.abs(video.playbackRate - 1) > 0.02) {
    video.playbackRate = 1
  }

  const cueKey = `${cue.sceneIndex}:${cue.startSec.toFixed(3)}`
  const sceneChanged = cue.sceneIndex !== state.lastScene
  const expected = expectedVideoTimeInScene(audioT, cue.sceneIndex, segments, cues)
  const audioSpan = sceneAudioDurationSec(cue.sceneIndex, cues)
  const videoSpan = Math.max(0.05, vidEnd - vidStart)
  const ttsLongerThanVideo = audioSpan > videoSpan + 0.08
  const clampedExpected = Math.min(vidEnd - 0.02, Math.max(vidStart, expected))

  const ensurePlaying = () => {
    if (!allowAutoPlay) {
      if (!video.paused) video.pause()
      return
    }
    if (video.paused) void video.play().catch(() => {})
  }

  if (opts?.forceSeek) {
    state.holdingEnd = false
    video.currentTime = clampedExpected
    if (!video.paused) video.pause()
    state.lastScene = cue.sceneIndex
    state.lastCueKey = cueKey
    return
  }

  if (sceneChanged) {
    state.lastScene = cue.sceneIndex
    state.lastCueKey = cueKey
    state.holdingEnd = false
    const alreadyInScene =
      video.currentTime >= vidStart - 0.05 && video.currentTime < vidEnd - 0.02
    if (!alreadyInScene) {
      video.currentTime = clampedExpected
    }
    ensurePlaying()
    return
  }

  state.lastCueKey = cueKey
  state.holdingEnd = false

  const audioStillGoing = audioDur <= 0 || audioT < audioDur - 0.05
  const atSceneEnd = video.ended || video.currentTime >= vidEnd - 0.04

  // TTS가 더 김: 컷 영상을 처음부터 다시 재생(루프)
  if (ttsLongerThanVideo && audioStillGoing) {
    if (atSceneEnd || video.ended) {
      video.currentTime = vidStart
      ensurePlaying()
      return
    }
    // 루프 위치와 크게 어긋나면 보정
    if (Math.abs(video.currentTime - clampedExpected) > 0.35) {
      video.currentTime = clampedExpected
    }
    ensurePlaying()
    return
  }

  if (video.ended || video.paused) {
    if (audioStillGoing) {
      video.currentTime = clampedExpected
      ensurePlaying()
    }
    return
  }

  // 1배속 자연 재생 — 크게 어긋날 때만 보정
  if (video.currentTime < vidStart - 0.2) {
    video.currentTime = vidStart
  } else if (Math.abs(video.currentTime - clampedExpected) > 0.55) {
    video.currentTime = clampedExpected
  }
}

export function resolveMvpPreviewVideoTime(
  video: HTMLVideoElement | null | undefined,
  audioT: number,
  cues: readonly VoiceLineCue[] | null | undefined,
  segments: readonly NarrationSegment[],
  videoDur: number,
  audioDur: number,
  hasAudio: boolean
): number {
  if (hasAudio && cues?.length && segments.length) {
    if (video && !video.paused && Number.isFinite(video.currentTime) && video.currentTime >= 0) {
      return video.currentTime
    }
    return videoTimeFromAudioCueSync(audioT, cues, segments, videoDur, audioDur)
  }
  if (videoDur > 0) {
    return Math.min(videoDur, Math.max(0, audioT))
  }
  return video && Number.isFinite(video.currentTime) ? video.currentTime : Math.min(videoDur, Math.max(0, audioT))
}

export function previewDurationSec(
  videoDuration: number,
  audioDuration: number,
  hasAudio: boolean
): number {
  if (!hasAudio) return videoDuration
  if (videoDuration > 0 && audioDuration > 0) {
    return Math.max(videoDuration, audioDuration)
  }
  return videoDuration || audioDuration || 30
}

/** TTS가 있으면 타임라인은 음성(오디오) 시간축 — 배속↑ 시 총 길이가 줄어듦 */
export function timelineUsesAudioAxis(
  voiceLineCues?: readonly VoiceLineCue[] | null,
  audioDuration?: number
): boolean {
  return Boolean(voiceLineCues?.length && audioDuration && audioDuration > 0.05)
}

/** 장면(컷)에 해당하는 TTS 오디오 구간 */
export function audioRangeForSceneIndex(
  sceneIndex: number,
  cues: readonly VoiceLineCue[]
): { startSec: number; endSec: number } | null {
  const sceneCues = cues.filter((c) => c.sceneIndex === sceneIndex)
  if (!sceneCues.length) return null
  return {
    startSec: sceneCues[0]!.startSec,
    endSec: Math.max(sceneCues[0]!.startSec + 0.05, sceneCues[sceneCues.length - 1]!.endSec),
  }
}

/**
 * 타임라인·슬라이더 총 길이.
 * TTS 생성 후: 음성(TTS) 길이 기준 — 영상 클립도 TTS 구간에 맞춰 표시.
 * TTS 전: 영상 길이.
 */
export function previewTimelineEndSec(
  videoDuration: number,
  audioDuration: number,
  voiceLineCues?: readonly VoiceLineCue[] | null,
  _segments?: readonly NarrationSegment[]
): number {
  const vid = videoDuration > 0 ? videoDuration : 0

  if (timelineUsesAudioAxis(voiceLineCues, audioDuration)) {
    const cuesEnd = voiceLineCues!.at(-1)?.endSec ?? 0
    const ttsEnd = cuesEnd > 0.05 ? cuesEnd : audioDuration
    return Math.max(0.5, ttsEnd)
  }

  if (audioDuration > 0 && vid > 0) {
    return Math.max(0.5, vid)
  }

  return Math.max(0.5, previewDurationSec(vid, audioDuration, audioDuration > 0))
}
