import type { PlacedStudioOverlay } from "@/lib/shotform-studio-overlay-catalog"
import { pctBoxToMosaicOverlay } from "@/lib/mvp-mosaic-overlay-utils"
import type { DetectedChineseMosaicBox, MosaicFrameDetectRow } from "@/lib/mvp-mosaic-merge"

export type { DetectedChineseMosaicBox, MosaicFrameDetectRow }

type Track = {
  centerXPct: number
  centerYPct: number
  widthPct: number
  heightPct: number
  text?: string
  startSec: number
  endSec: number
  samples: number
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

function mergeFrameRows(rows: MosaicFrameDetectRow[]): Track[] {
  const tracks: Track[] = []
  const gapToleranceSec = 0.38
  const positionTolerance = 9

  for (const row of rows.sort((a, b) => a.timeSec - b.timeSec)) {
    for (const box of row.boxes) {
      let matched: Track | null = null
      let bestScore = 0

      for (const track of tracks) {
        if (row.timeSec - track.endSec > gapToleranceSec) continue
        const iou = boxIoU(box, track)
        const dist = trackDistance(box, track)
        const score = iou * 2 + Math.max(0, 1 - dist / positionTolerance)
        if (iou < 0.08 && dist > positionTolerance) continue
        if (
          box.text &&
          track.text &&
          box.text !== track.text &&
          iou < 0.2 &&
          dist > positionTolerance * 0.5
        ) {
          continue
        }
        if (score > bestScore) {
          bestScore = score
          matched = track
        }
      }

      if (matched) {
        const n = matched.samples + 1
        matched.endSec = row.timeSec
        matched.centerXPct = (matched.centerXPct * matched.samples + box.center_x_pct) / n
        matched.centerYPct = (matched.centerYPct * matched.samples + box.center_y_pct) / n
        matched.widthPct = Math.max(matched.widthPct, box.width_pct)
        matched.heightPct = Math.max(matched.heightPct, box.height_pct)
        matched.samples = n
        if (box.text) matched.text = box.text
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
        })
      }
    }
  }

  return tracks
}

export function mergeMosaicRowsToOverlays(
  rows: MosaicFrameDetectRow[],
  durationSec: number
): PlacedStudioOverlay[] {
  const timePadStart = 0.08
  const timePadEnd = 0.14
  return mergeFrameRows(rows).map((t, i) =>
    pctBoxToMosaicOverlay({
      id: `ov-ai-${i + 1}`,
      centerXPct: t.centerXPct,
      centerYPct: t.centerYPct,
      widthPct: Math.min(96, t.widthPct + 1.2),
      heightPct: Math.min(36, t.heightPct + 0.8),
      startSec: Math.max(0, t.startSec - timePadStart),
      endSec: Math.min(durationSec, t.endSec + timePadEnd),
      detectedText: t.text,
    })
  )
}
