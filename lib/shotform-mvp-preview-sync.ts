import type { NarrationSegment } from "@/lib/shotform-factory-narration-script"
import { voiceLineCueAtTime, type VoiceLineCue } from "@/lib/shotform-factory-line-tts"

/** TTS 큐(오디오 타임라인) → 짜집기 영상 타임라인 구간 — 미리보기·타임라인 표시용 */
export function videoRangeFromVoiceCue(
  cue: VoiceLineCue,
  segments: readonly NarrationSegment[],
  allCues?: readonly VoiceLineCue[]
): { startSec: number; endSec: number } {
  const seg = segments[cue.sceneIndex]
  if (!seg) return { startSec: cue.startSec, endSec: cue.endSec }

  const segStart = seg.start
  const segEnd = seg.end
  const segLen = Math.max(0.05, segEnd - segStart)

  const pool = allCues?.length ? allCues : [cue]
  const sceneCues = pool.filter((c) => c.sceneIndex === cue.sceneIndex)
  if (sceneCues.length <= 1) {
    return { startSec: segStart, endSec: segEnd }
  }

  const totalAudio = sceneCues.reduce((a, c) => a + Math.max(0.01, c.endSec - c.startSec), 0)
  const idx = sceneCues.indexOf(cue)
  if (idx < 0) return { startSec: segStart, endSec: segEnd }

  let start = segStart
  for (let j = 0; j < idx; j++) {
    const w = Math.max(0.01, sceneCues[j]!.endSec - sceneCues[j]!.startSec)
    start += (w / totalAudio) * segLen
  }

  const myW = Math.max(0.01, cue.endSec - cue.startSec)
  const end = idx === sceneCues.length - 1 ? segEnd : start + (myW / totalAudio) * segLen

  return { startSec: start, endSec: Math.max(start + 0.05, end) }
}

/** TTS 재생 시각 → 짜집기 영상 타임라인 (컷 구간 기준, 1배속) */
export function videoTimeFromAudioCueSync(
  audioTimeSec: number,
  cues: readonly VoiceLineCue[],
  segments: readonly NarrationSegment[],
  fallbackVideoDuration: number,
  fallbackAudioDuration: number
): number {
  if (!cues.length || !segments.length) {
    if (fallbackAudioDuration > 0 && fallbackVideoDuration > 0) {
      return Math.min(
        fallbackVideoDuration,
        (audioTimeSec / fallbackAudioDuration) * fallbackVideoDuration
      )
    }
    return audioTimeSec
  }

  const cue = voiceLineCueAtTime(cues, audioTimeSec)
  if (!cue) return 0

  const { startSec: vidStart, endSec: vidEnd } = videoRangeFromVoiceCue(cue, segments, cues)
  const cueDur = Math.max(0.01, cue.endSec - cue.startSec)
  const elapsed = Math.max(0, audioTimeSec - cue.startSec)
  const ratio = Math.min(1, elapsed / cueDur)
  return vidStart + ratio * Math.max(0.05, vidEnd - vidStart)
}

/** 영상 시각 → 오디오 시각 (슬라이더 역변환) */
export function audioTimeFromVideoSync(
  videoTimeSec: number,
  cues: readonly VoiceLineCue[],
  segments: readonly NarrationSegment[],
  fallbackVideoDuration: number,
  fallbackAudioDuration: number
): number {
  if (!cues.length || !segments.length) {
    if (fallbackVideoDuration > 0 && fallbackAudioDuration > 0) {
      return Math.min(fallbackAudioDuration, (videoTimeSec / fallbackVideoDuration) * fallbackAudioDuration)
    }
    return videoTimeSec
  }

  for (const cue of cues) {
    const { startSec: vidStart, endSec: vidEnd } = videoRangeFromVoiceCue(cue, segments, cues)
    if (videoTimeSec >= vidStart - 0.02 && videoTimeSec < vidEnd - 0.01) {
      const span = Math.max(0.05, vidEnd - vidStart)
      const ratio = Math.min(1, (videoTimeSec - vidStart) / span)
      return cue.startSec + ratio * (cue.endSec - cue.startSec)
    }
  }

  const lastSeg = segments[segments.length - 1]
  const lastCue = cues[cues.length - 1]
  if (lastSeg && lastCue && videoTimeSec >= lastSeg.start) {
    return lastCue.endSec
  }
  return 0
}

/** TTS 큐 길이에 맞춰 영상 구간을 자연스럽게 재생할 배속 (1 = 동일 길이) */
export function previewPlaybackRateForCue(
  cue: VoiceLineCue,
  segments: readonly NarrationSegment[],
  cues: readonly VoiceLineCue[]
): number {
  const { startSec: vidStart, endSec: vidEnd } = videoRangeFromVoiceCue(cue, segments, cues)
  const videoSpan = Math.max(0.05, vidEnd - vidStart)
  const cueDur = Math.max(0.01, cue.endSec - cue.startSec)
  return Math.min(4, Math.max(0.25, videoSpan / cueDur))
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

/**
 * 타임라인·슬라이더 총 길이 (영상 시간축).
 * TTS 배속으로 오디오가 짧아져도 빨간 playhead가 끝까지 자연스럽게 이동하도록
 * 큐 끝·오디오 종료 시점의 영상 시각을 사용합니다.
 */
export function previewTimelineEndSec(
  videoDuration: number,
  audioDuration: number,
  voiceLineCues?: readonly VoiceLineCue[] | null,
  segments?: readonly NarrationSegment[]
): number {
  const vid = videoDuration > 0 ? videoDuration : 0

  if (voiceLineCues?.length && segments?.length && audioDuration > 0) {
    const atAudioEnd = videoTimeFromAudioCueSync(
      Math.max(0, audioDuration - 0.02),
      voiceLineCues,
      segments,
      vid || audioDuration,
      audioDuration
    )
    let blockEnd = 0
    for (const cue of voiceLineCues) {
      const { endSec } = videoRangeFromVoiceCue(cue, segments, voiceLineCues)
      blockEnd = Math.max(blockEnd, endSec)
    }
    const contentEnd = Math.max(atAudioEnd, blockEnd)
    if (contentEnd > 0) {
      return Math.max(0.5, vid > 0 ? Math.min(vid, contentEnd + 0.05) : contentEnd + 0.05)
    }
  }

  if (!voiceLineCues?.length && audioDuration > 0 && vid > 0) {
    return Math.max(0.5, vid)
  }

  return Math.max(0.5, previewDurationSec(vid, audioDuration, audioDuration > 0))
}
