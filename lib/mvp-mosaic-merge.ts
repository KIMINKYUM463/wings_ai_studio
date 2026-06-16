import type { PlacedStudioOverlay } from "@/lib/shotform-studio-overlay-catalog"
import { pctBoxToMosaicOverlay } from "@/lib/mvp-mosaic-overlay-utils"

export type DetectedChineseMosaicBox = {
  center_x_pct: number
  center_y_pct: number
  width_pct: number
  height_pct: number
  text?: string
}

export type MosaicFrameDetectRow = {
  timeSec: number
  boxes: DetectedChineseMosaicBox[]
}

export type MosaicTrackWindow = {
  startSec: number
  endSec: number
  centerXPct: number
  centerYPct: number
  widthPct: number
  heightPct: number
}

type Track = {
  centerXPct: number
  centerYPct: number
  widthPct: number
  heightPct: number
  text?: string
  startSec: number
  endSec: number
  samples: number
  /** 위치 산출용 프레임별 박스 */
  hits: { timeSec: number; box: DetectedChineseMosaicBox }[]
}

function median(nums: number[]): number {
  if (!nums.length) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

function boxRect(b: DetectedChineseMosaicBox | Track) {
  const cx = "center_x_pct" in b ? b.center_x_pct : b.centerXPct
  const cy = "center_y_pct" in b ? b.center_y_pct : b.centerYPct
  const w = "width_pct" in b ? b.width_pct : b.widthPct
  const h = "height_pct" in b ? b.height_pct : b.heightPct
  return {
    left: cx - w / 2,
    top: cy - h / 2,
    right: cx + w / 2,
    bottom: cy + h / 2,
    w,
    h,
  }
}

function boxIoU(a: DetectedChineseMosaicBox, track: Track): number {
  const ra = boxRect(a)
  const rb = boxRect(track)
  const ix = Math.max(0, Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left))
  const iy = Math.max(0, Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top))
  const inter = ix * iy
  if (inter <= 0) return 0
  const union = ra.w * ra.h + rb.w * rb.h - inter
  return union > 0 ? inter / union : 0
}

function trackDistance(box: DetectedChineseMosaicBox, track: Track): number {
  return Math.hypot(box.center_x_pct - track.centerXPct, box.center_y_pct - track.centerYPct)
}

function boxMatchesTrack(box: DetectedChineseMosaicBox, track: Track): boolean {
  const iou = boxIoU(box, track)
  const dist = trackDistance(box, track)
  if (iou >= 0.06 || dist <= 8) return true
  if (
    box.text &&
    track.text &&
    box.text === track.text &&
    dist <= 14
  ) {
    return true
  }
  return false
}

function recomputeTrackGeometry(track: Track): void {
  if (!track.hits.length) return
  const midT = (track.startSec + track.endSec) / 2
  const sorted = [...track.hits].sort(
    (a, b) => Math.abs(a.timeSec - midT) - Math.abs(b.timeSec - midT)
  )
  const core = sorted.slice(0, Math.max(3, Math.ceil(sorted.length * 0.6)))
  track.centerXPct = median(core.map((h) => h.box.center_x_pct))
  track.centerYPct = median(core.map((h) => h.box.center_y_pct))
  track.widthPct = median(core.map((h) => h.box.width_pct))
  track.heightPct = median(core.map((h) => h.box.height_pct))
}

function mergeFrameRows(rows: MosaicFrameDetectRow[]): Track[] {
  const tracks: Track[] = []
  const gapToleranceSec = 0.55
  const positionTolerance = 10

  for (const row of rows.sort((a, b) => a.timeSec - b.timeSec)) {
    for (const box of row.boxes) {
      let matched: Track | null = null
      let bestScore = 0

      for (const track of tracks) {
        if (row.timeSec - track.endSec > gapToleranceSec) continue
        const iou = boxIoU(box, track)
        const dist = trackDistance(box, track)
        const score = iou * 2.2 + Math.max(0, 1 - dist / positionTolerance)
        if (iou < 0.05 && dist > positionTolerance) continue
        if (
          box.text &&
          track.text &&
          box.text !== track.text &&
          iou < 0.15 &&
          dist > positionTolerance * 0.55
        ) {
          continue
        }
        if (score > bestScore) {
          bestScore = score
          matched = track
        }
      }

      if (matched) {
        matched.endSec = Math.max(matched.endSec, row.timeSec)
        matched.startSec = Math.min(matched.startSec, row.timeSec)
        matched.hits.push({ timeSec: row.timeSec, box })
        matched.samples += 1
        if (box.text) matched.text = box.text
        recomputeTrackGeometry(matched)
      } else {
        tracks.push({
          centerXPct: box.center_x_pct,
          centerYPct: box.center_y_pct,
          widthPct: box.width_pct,
          heightPct: box.height_pct,
          text: box.text,
          startSec: row.timeSec,
          endSec: row.timeSec,
          samples: 1,
          hits: [{ timeSec: row.timeSec, box }],
        })
      }
    }
  }

  return tracks
}

/** 경계 프레임으로 등장·퇴장 시각을 앞뒤로 정밀 보정 */
function refineTrackBoundaries(tracks: Track[], rows: MosaicFrameDetectRow[]): void {
  const sortedRows = [...rows].sort((a, b) => a.timeSec - b.timeSec)

  for (const track of tracks) {
    const probeBefore = sortedRows.filter(
      (r) => r.timeSec < track.startSec - 0.02 && r.timeSec >= track.startSec - 0.28
    )
    const probeAfter = sortedRows.filter(
      (r) => r.timeSec > track.endSec + 0.02 && r.timeSec <= track.endSec + 0.28
    )

    let earliest = track.startSec
    for (const row of sortedRows) {
      if (row.timeSec > track.endSec + 0.05) break
      if (row.timeSec < track.startSec - 0.3) continue
      const hit = row.boxes.some((b) => boxMatchesTrack(b, track))
      if (hit) earliest = Math.min(earliest, row.timeSec)
    }

    let latest = track.endSec
    for (let i = sortedRows.length - 1; i >= 0; i--) {
      const row = sortedRows[i]!
      if (row.timeSec < track.startSec - 0.05) break
      if (row.timeSec > track.endSec + 0.3) continue
      const hit = row.boxes.some((b) => boxMatchesTrack(b, track))
      if (hit) latest = Math.max(latest, row.timeSec)
    }

    for (const row of probeBefore) {
      const hit = row.boxes.some((b) => boxMatchesTrack(b, track))
      if (hit) earliest = Math.min(earliest, row.timeSec)
      else if (row.timeSec < earliest - 0.04) break
    }

    for (const row of probeAfter) {
      const hit = row.boxes.some((b) => boxMatchesTrack(b, track))
      if (hit) latest = Math.max(latest, row.timeSec)
      else if (row.timeSec > latest + 0.04) break
    }

    track.startSec = earliest
    track.endSec = latest
  }
}

function estimateSampleStep(rows: MosaicFrameDetectRow[]): number {
  const times = rows.map((r) => r.timeSec).sort((a, b) => a - b)
  if (times.length < 2) return 0.15
  const gaps: number[] = []
  for (let i = 1; i < times.length; i++) gaps.push(times[i]! - times[i - 1]!)
  gaps.sort((a, b) => a - b)
  return gaps[Math.floor(gaps.length / 2)] ?? 0.15
}

export function buildMosaicTracks(rows: MosaicFrameDetectRow[]): Track[] {
  const tracks = mergeFrameRows(rows)
  if (tracks.length) refineTrackBoundaries(tracks, rows)
  return tracks
}

export function tracksToWindows(tracks: Array<Pick<Track, "startSec" | "endSec" | "centerXPct" | "centerYPct" | "widthPct" | "heightPct">>): MosaicTrackWindow[] {
  return tracks.map((t) => ({
    startSec: t.startSec,
    endSec: t.endSec,
    centerXPct: t.centerXPct,
    centerYPct: t.centerYPct,
    widthPct: t.widthPct,
    heightPct: t.heightPct,
  }))
}

export function mergeMosaicRowsToOverlays(
  rows: MosaicFrameDetectRow[],
  durationSec: number
): PlacedStudioOverlay[] {
  const tracks = buildMosaicTracks(rows)
  if (!tracks.length) return []

  const step = estimateSampleStep(rows)
  const padStart = Math.min(0.14, Math.max(0.05, step * 0.55))
  const padEnd = Math.min(0.18, Math.max(0.06, step * 0.65))

  return tracks.map((t, i) =>
    pctBoxToMosaicOverlay({
      id: `ov-ai-${i + 1}`,
      centerXPct: t.centerXPct,
      centerYPct: t.centerYPct,
      widthPct: Math.min(96, t.widthPct + 2.4),
      heightPct: Math.min(40, t.heightPct + 1.6),
      startSec: Math.max(0, t.startSec - padStart),
      endSec: Math.min(durationSec, t.endSec + padEnd),
      detectedText: t.text,
    })
  )
}
