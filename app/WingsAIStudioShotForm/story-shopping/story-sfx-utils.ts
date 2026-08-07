import type { StorySfxClip } from "./story-types"

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

export function normalizedStorySfxClip(clip: StorySfxClip): StorySfxClip {
  const sourceOffsetSec = Math.max(0, clip.sourceOffsetSec ?? 0)
  const sourceDurationSec = Math.max(
    sourceOffsetSec + Math.max(0.08, clip.durationSec),
    clip.sourceDurationSec ?? clip.durationSec
  )
  const durationSec = clamp(
    Math.max(0.08, clip.durationSec),
    0.08,
    Math.max(0.08, sourceDurationSec - sourceOffsetSec)
  )
  return {
    ...clip,
    startSec: Math.max(0, clip.startSec),
    durationSec,
    sourceOffsetSec,
    sourceDurationSec,
    volumePct: clamp(clip.volumePct ?? 100, 0, 200),
  }
}

/** 영상 길이(totalDuration)를 넘는 효과음은 잘라내거나 제외합니다. */
export function clampStorySfxToTimeline(
  clip: StorySfxClip,
  timelineDurationSec: number
): StorySfxClip | null {
  const normalized = normalizedStorySfxClip(clip)
  const timelineEnd = Math.max(0.08, timelineDurationSec)
  if (normalized.startSec >= timelineEnd - 0.01) return null
  const maxDuration = Math.max(0.08, timelineEnd - normalized.startSec)
  return {
    ...normalized,
    startSec: clamp(normalized.startSec, 0, Math.max(0, timelineEnd - 0.08)),
    durationSec: Math.min(normalized.durationSec, maxDuration),
  }
}

export function moveStorySfxClip(
  clip: StorySfxClip,
  nextStartSec: number,
  timelineDurationSec: number
): StorySfxClip {
  const normalized = normalizedStorySfxClip(clip)
  const maxStart = Math.max(0, timelineDurationSec - normalized.durationSec)
  return {
    ...normalized,
    startSec: clamp(nextStartSec, 0, maxStart),
  }
}

export function splitStorySfxClip(
  clip: StorySfxClip,
  playheadSec: number,
  minimumPieceSec = 0.08
): { left: StorySfxClip; right: StorySfxClip } | null {
  const normalized = normalizedStorySfxClip(clip)
  const relativeSec = playheadSec - normalized.startSec
  if (
    relativeSec < minimumPieceSec ||
    normalized.durationSec - relativeSec < minimumPieceSec
  ) {
    return null
  }

  return {
    left: {
      ...normalized,
      durationSec: relativeSec,
    },
    right: {
      ...normalized,
      id: `${normalized.id}-split-${Date.now()}`,
      startSec: playheadSec,
      durationSec: normalized.durationSec - relativeSec,
      sourceOffsetSec: (normalized.sourceOffsetSec || 0) + relativeSec,
      label: normalized.label,
    },
  }
}
