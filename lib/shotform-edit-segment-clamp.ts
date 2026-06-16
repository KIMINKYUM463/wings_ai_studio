/** 짜집기 컷 — 소스 실제 길이 안에서 source_start·duration 보정 */

export type EditSegmentTiming = {
  source_start: number
  source_end: number
  output_start: number
  output_end: number
}

export function clampEditSegmentTiming(
  seg: EditSegmentTiming,
  sourceDuration?: number
): { sourceStart: number; duration: number } {
  const clipDur = Math.max(0.15, seg.output_end - seg.output_start)
  const sourceAvail = Math.max(0.15, seg.source_end - seg.source_start)
  let duration = Math.min(clipDur, sourceAvail)
  let sourceStart = Math.max(0, seg.source_start)

  if (sourceDuration != null && Number.isFinite(sourceDuration) && sourceDuration > 0.25) {
    const maxStart = Math.max(0, sourceDuration - 0.2)
    if (sourceStart > maxStart) sourceStart = maxStart
    duration = Math.min(duration, Math.max(0.15, sourceDuration - sourceStart))
  }

  return { sourceStart, duration }
}

export function segmentFfmpegOutputArgs(outPath: string, w: number, h: number, crf: string): string[] {
  const vf = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}:(iw-${w})/2:(ih-${h})/2`
  return [
    "-map",
    "0:v:0?",
    "-sn",
    "-dn",
    "-vf",
    vf,
    "-r",
    "30",
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    crf,
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-avoid_negative_ts",
    "make_zero",
    outPath,
  ]
}
