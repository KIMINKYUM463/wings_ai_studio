/**
 * 효과음 파일에서 실제 소리가 나는 구간을 찾습니다.
 * (앞부분 2~3초 무음이 있는 카탈로그 파일이 있어 sourceOffset으로 건너뜁니다.)
 */

export type MvpAudibleAudioRange = {
  /** 전체 파일 길이(초) */
  durationSec: number
  /** 소리가 시작되는 시각(초) */
  startSec: number
  /** 소리가 끝나는 시각(초) */
  endSec: number
}

const DEFAULT_THRESHOLD = 0.018
/** 너무 짧은 클릭음도 잡히도록 샘플 단위가 아닌 짧은 창 RMS 사용 */
const WINDOW_SEC = 0.012

function rmsInWindow(
  buffer: AudioBuffer,
  startSample: number,
  endSample: number
): number {
  const channels = buffer.numberOfChannels
  let sum = 0
  let count = 0
  for (let ch = 0; ch < channels; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = startSample; i < endSample; i++) {
      const s = data[i] ?? 0
      sum += s * s
      count += 1
    }
  }
  if (count <= 0) return 0
  return Math.sqrt(sum / count)
}

export async function detectAudibleAudioRange(
  audioUrl: string,
  threshold = DEFAULT_THRESHOLD
): Promise<MvpAudibleAudioRange> {
  const ctx = new AudioContext()
  try {
    // suspended 상태면 decode/분석이 불안정할 수 있어 resume
    if (ctx.state === "suspended") {
      await ctx.resume().catch(() => undefined)
    }
    const res = await fetch(audioUrl)
    if (!res.ok) throw new Error(`효과음 로드 실패 (${res.status})`)
    const decoded = await ctx.decodeAudioData((await res.arrayBuffer()).slice(0))
    const durationSec = decoded.duration
    const sr = decoded.sampleRate
    const win = Math.max(64, Math.floor(sr * WINDOW_SEC))
    const length = decoded.length

    let startSample = 0
    let endSample = length

    findStart: for (let i = 0; i < length; i += win) {
      const end = Math.min(length, i + win)
      if (rmsInWindow(decoded, i, end) > threshold) {
        startSample = i
        break findStart
      }
    }

    findEnd: for (let i = length; i > startSample; i -= win) {
      const begin = Math.max(startSample, i - win)
      if (rmsInWindow(decoded, begin, i) > threshold) {
        endSample = i
        break findEnd
      }
    }

    // 아주 짧은 어택이 잘리지 않게 앞을 살짝 남김
    const padStart = Math.floor(sr * 0.02)
    const padEnd = Math.floor(sr * 0.04)
    startSample = Math.max(0, startSample - padStart)
    endSample = Math.min(length, endSample + padEnd)

    if (endSample <= startSample + Math.floor(sr * 0.05)) {
      return { durationSec, startSec: 0, endSec: durationSec }
    }

    return {
      durationSec,
      startSec: startSample / sr,
      endSec: endSample / sr,
    }
  } finally {
    void ctx.close()
  }
}

/** 자동배치용 — 소리 나는 구간만 쓰도록 offset·길이 보정 */
export function applyAudibleRangeToEffectTiming(input: {
  audible: MvpAudibleAudioRange
  maxDurationSec: number
  timelineRemainSec: number
}): { sourceOffsetSec: number; durationSec: number; sourceDurationSec: number } {
  const audibleLen = Math.max(0.08, input.audible.endSec - input.audible.startSec)
  const durationSec = Math.max(
    0.08,
    Math.min(audibleLen, input.maxDurationSec, Math.max(0.08, input.timelineRemainSec))
  )
  return {
    sourceOffsetSec: input.audible.startSec,
    durationSec,
    sourceDurationSec: input.audible.durationSec,
  }
}
