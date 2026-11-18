import type { NarrationSegment } from "@/lib/shotform-factory-narration-script"
import { voiceLineCueAtTime, type VoiceLineCue } from "@/lib/shotform-factory-line-tts"
import { isV2RemixPicture, type AutoEditJobResult } from "@/lib/shotform-auto-edit-types"

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
  _fallbackAudioDuration: number,
  linearPicture = false
): number {
  if (linearPicture) {
    if (fallbackVideoDuration > 0) {
      return Math.min(fallbackVideoDuration, Math.max(0, audioTimeSec))
    }
    return Math.max(0, audioTimeSec)
  }
  if (!cues.length || !segments.length) {
    if (fallbackVideoDuration > 0) {
      return Math.min(fallbackVideoDuration, Math.max(0, audioTimeSec))
    }
    return audioTimeSec
  }

  const cue = voiceLineCueAtTime(cues, audioTimeSec)
  if (!cue) return 0
  return expectedVideoTimeInScene(audioTimeSec, cue.sceneIndex, segments, cues)
}

/** 영상 시각 → 오디오 시각 (슬라이더 역변환, 1배속 1:1) */
export function audioTimeFromVideoSync(
  videoTimeSec: number,
  cues: readonly VoiceLineCue[],
  segments: readonly NarrationSegment[],
  fallbackVideoDuration: number,
  fallbackAudioDuration: number,
  linearPicture = false
): number {
  if (linearPicture) {
    if (fallbackAudioDuration > 0) {
      return Math.min(fallbackAudioDuration, Math.max(0, videoTimeSec))
    }
    return Math.max(0, videoTimeSec)
  }
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
    const rate = sceneVideoPlaybackRate(sceneIndex, segments, cues)
    return Math.min(audioEnd, audioStart + elapsed / rate)
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

/** TTS가 컷보다 길면 이 배속까지 느리게 늘림. 그래도 모자라면 끝 프레임을 붙잡지 않고 컷 영상을 다시 재생 */
export const MVP_SCENE_MIN_STRETCH_RATE = 0.6

/**
 * 장면 영상 배속 — 음성은 그대로, 영상이 음성 길이에 맞춘다.
 * - TTS ≤ 컷: 1배속 (구간은 applyAudioFitEnds가 컷 가운데로 잘라 둠)
 * - TTS > 컷: 컷 ÷ TTS 배속으로 느리게 (최저 0.6x), 남는 시간은 같은 컷 영상을 처음부터 다시 재생
 */
export function sceneVideoPlaybackRate(
  sceneIndex: number,
  segments: readonly NarrationSegment[],
  cues: readonly VoiceLineCue[]
): number {
  const { startSec, endSec } = sceneVideoRange(sceneIndex, segments)
  const videoSpan = Math.max(0.05, endSec - startSec)
  const audioSpan = sceneAudioDurationSec(sceneIndex, cues)
  if (audioSpan <= videoSpan + 0.08) return 1
  return Math.max(MVP_SCENE_MIN_STRETCH_RATE, videoSpan / audioSpan)
}

/** 컷 끝 프레임에서 멈추는 시간(초) */
function sceneHoldSec(sceneIndex: number, segments: readonly NarrationSegment[], cues: readonly VoiceLineCue[]): number {
  const { startSec, endSec } = sceneVideoRange(sceneIndex, segments)
  const rate = sceneVideoPlaybackRate(sceneIndex, segments, cues)
  return Math.max(0, sceneAudioDurationSec(sceneIndex, cues) - (endSec - startSec) / rate)
}

/** 컷 목록 배지용 — 늘림 배속이면 "0.8x", 끝 프레임 정지가 생기면 "+1.2s 정지", 1배속이면 null */
export function sceneVideoFitBadge(
  sceneIndex: number,
  segments: readonly NarrationSegment[],
  cues: readonly VoiceLineCue[] | null | undefined
): { label: string; looped: boolean } | null {
  if (!cues?.length || !segments[sceneIndex]) return null
  const hold = sceneHoldSec(sceneIndex, segments, cues)
  if (hold > 0.15) return { label: "영상 반복", looped: true }
  const rate = sceneVideoPlaybackRate(sceneIndex, segments, cues)
  if (rate < 1) return { label: `${rate.toFixed(2)}x`, looped: false }
  return null
}

export function previewPlaybackRateForCue(
  cue: VoiceLineCue,
  segments: readonly NarrationSegment[],
  cues: readonly VoiceLineCue[]
): number {
  return sceneVideoPlaybackRate(cue.sceneIndex, segments, cues)
}

/** 장면 TTS 경과 → 영상 시각. 늘림 배속을 반영하고, 컷 끝을 넘지 않음(넘는 시간은 정지) */
function expectedVideoTimeInScene(
  audioT: number,
  sceneIndex: number,
  segments: readonly NarrationSegment[],
  cues: readonly VoiceLineCue[]
): number {
  const { startSec: vidStart, endSec: vidEnd } = sceneVideoRange(sceneIndex, segments)
  const sceneCues = cues.filter((c) => c.sceneIndex === sceneIndex)
  if (!sceneCues.length) return vidStart
  const elapsed = Math.max(0, audioT - sceneCues[0]!.startSec)
  const rate = sceneVideoPlaybackRate(sceneIndex, segments, cues)
  return Math.min(vidEnd, vidStart + elapsed * rate)
}

export type MvpVideoAudioSyncState = {
  lastScene: number
  lastCueKey: string
  /** 음성이 컷보다 길어 끝 프레임에서 정지 중 */
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
 * - TTS가 컷보다 짧음 → 컷 가운데를 TTS 길이만큼 1배속 재생 (구간은 applyAudioFitEnds가 정함)
 * - TTS가 컷보다 김 → `sceneVideoPlaybackRate`로 느리게 늘려 재생, 그래도 모자라면 그 컷 영상을 다시 재생
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
  const rate = sceneVideoPlaybackRate(cue.sceneIndex, segments, cues)
  if (Math.abs(video.playbackRate - rate) > 0.02) {
    video.playbackRate = rate
  }

  const cueKey = `${cue.sceneIndex}:${cue.startSec.toFixed(3)}`
  const sceneChanged = cue.sceneIndex !== state.lastScene
  const expected = expectedVideoTimeInScene(audioT, cue.sceneIndex, segments, cues)
  const holdAt = Math.max(vidStart, vidEnd - 0.04)
  const clampedExpected = Math.min(holdAt, Math.max(vidStart, expected))

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

  // 음성이 컷보다 김: 끝 프레임을 캡처처럼 붙잡지 않고, 그 컷 영상을 다시 재생
  if (expected >= holdAt && audioStillGoing) {
    const span = Math.max(0.2, vidEnd - vidStart)
    const sceneCues = cues.filter((item) => item.sceneIndex === cue.sceneIndex)
    const elapsed = Math.max(0, audioT - (sceneCues[0]?.startSec ?? audioT))
    const looped = vidStart + ((elapsed * rate) % span)
    state.holdingEnd = false
    if (!video.seeking && Math.abs(video.currentTime - looped) > 0.3) {
      video.currentTime = looped
    }
    ensurePlaying()
    return
  }

  if (video.ended || video.paused) {
    if (audioStillGoing) {
      // play() 대기 중에도 paused=true — 매 틱 다시 seek하면 디코딩이 계속 리셋돼 화면이 멈춤
      if (video.ended || (!video.seeking && Math.abs(video.currentTime - clampedExpected) > 0.25)) {
        video.currentTime = clampedExpected
      }
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

/**
 * 버전2 리믹스 그림은 문장 길이에 맞춰 이미 이어져 있다.
 * 플래그가 저장에서 빠져도, 컷 길이와 음성 길이가 거의 같으면 예전 컷 정지·반복을 쓰지 않는다.
 */
export function remixPicturePlaysStraight(
  result: Pick<AutoEditJobResult, "v2Picture" | "editPlan"> | null | undefined,
  segments: readonly { start: number; end: number }[],
  cues: readonly { startSec: number; endSec: number }[] | null | undefined
): boolean {
  if (isV2RemixPicture(result)) return true
  if (!cues?.length || cues.length !== segments.length) return false
  let close = 0
  for (let i = 0; i < segments.length; i++) {
    const video = segments[i]!.end - segments[i]!.start
    const audio = cues[i]!.endSec - cues[i]!.startSec
    if (video > 0.4 && Math.abs(video - audio) < 0.35) close += 1
  }
  return close >= Math.max(1, Math.ceil(segments.length * 0.75))
}
