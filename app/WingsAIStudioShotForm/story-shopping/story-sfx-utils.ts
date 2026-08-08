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
  if (normalized.startSec >= timelineEnd - 0.02) return null
  const maxDuration = Math.max(0, timelineEnd - normalized.startSec)
  if (maxDuration < 0.08) return null
  return {
    ...normalized,
    startSec: clamp(normalized.startSec, 0, Math.max(0, timelineEnd - 0.08)),
    durationSec: Math.min(normalized.durationSec, maxDuration),
  }
}

/**
 * AI/자동 효과음 시작·길이를 해당 클립과 영상 끝 안으로 넣습니다.
 * 영상 종료 이후에 들어가면 null (배치 스킵).
 */
export function placeAutoSfxWithinContent(opts: {
  slotStartSec: number
  slotEndSec: number
  slotDurationSec: number
  offsetSec: number
  maxDurationSec: number
  sourceDurationSec: number
  totalDurationSec: number
}): { startSec: number; durationSec: number } | null {
  const contentEnd = Math.max(0.08, opts.totalDurationSec)
  const slotStart = Math.max(0, opts.slotStartSec)
  const slotEnd = Math.min(contentEnd, Math.max(slotStart + 0.08, opts.slotEndSec))
  const slotDuration = Math.max(0.08, opts.slotDurationSec)
  const offset = clamp(
    opts.offsetSec,
    0,
    Math.max(0, slotDuration - 0.12)
  )
  let startSec = slotStart + offset
  // 슬롯 끝을 넘기면 슬롯 안으로 당김 (다음 빈 구간·영상 밖으로 밀지 않음)
  startSec = Math.min(startSec, Math.max(slotStart, slotEnd - 0.12))
  if (startSec >= contentEnd - 0.05) return null
  if (startSec >= slotEnd - 0.04) return null

  const durationSec = Math.min(
    Math.max(0.08, opts.sourceDurationSec || 0.08),
    Math.max(0.08, opts.maxDurationSec || 0.08),
    Math.max(0.08, slotEnd - startSec),
    Math.max(0.08, contentEnd - startSec)
  )
  if (durationSec < 0.08) return null
  if (startSec + durationSec > contentEnd + 0.001) {
    const clipped = contentEnd - startSec
    if (clipped < 0.08) return null
    return { startSec, durationSec: clipped }
  }
  return { startSec, durationSec }
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
