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

export function segmentScaleCropFilter(w: number, h: number): string {
  return `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}:(iw-${w})/2:(ih-${h})/2`
}

export function segmentScalePadFilter(w: number, h: number): string {
  return `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black`
}

/** 세그먼트 mp4 — -map 0:v:0? 는 디코드 실패 시 빈 출력을 만들어 사용하지 않음 */
export function segmentFfmpegEncodeTail(w: number, h: number, crf: string, outPath: string): string[] {
  return [
    "-vf",
    segmentScaleCropFilter(w, h),
    "-r",
    "30",
    "-an",
    "-sn",
    "-dn",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    crf,
    "-pix_fmt",
    "yuv420p",
    outPath,
  ]
}

export function segmentFfmpegInputArgs(sourceStart: number, duration: number): string[][] {
  const ss = String(sourceStart)
  const t = String(duration)
  return [
    ["-i", "SOURCE", "-ss", ss, "-t", t],
    ["-ss", ss, "-i", "SOURCE", "-t", t],
  ]
}
