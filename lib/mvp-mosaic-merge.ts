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

type Track = {
  centerXPct: number
  centerYPct: number
  widthPct: number
  heightPct: number
  text?: string
  startSec: number
  endSec: number
}

function trackDistance(box: DetectedChineseMosaicBox, track: Track): number {
  return Math.hypot(box.center_x_pct - track.centerXPct, box.center_y_pct - track.centerYPct)
}

function mergeFrameRows(rows: MosaicFrameDetectRow[]): Track[] {
  const tracks: Track[] = []
  const gapToleranceSec = 0.55
  const positionTolerance = 14

  for (const row of rows.sort((a, b) => a.timeSec - b.timeSec)) {
    for (const box of row.boxes) {
      let matched: Track | null = null
      for (const track of tracks) {
        if (row.timeSec - track.endSec > gapToleranceSec) continue
        if (trackDistance(box, track) > positionTolerance) continue
        if (
          box.text &&
          track.text &&
          box.text !== track.text &&
          trackDistance(box, track) > positionTolerance * 0.45
        ) {
          continue
        }
        matched = track
        break
      }

      if (matched) {
        matched.endSec = row.timeSec
        matched.centerXPct = (matched.centerXPct + box.center_x_pct) / 2
        matched.centerYPct = (matched.centerYPct + box.center_y_pct) / 2
        matched.widthPct = Math.max(matched.widthPct, box.width_pct)
        matched.heightPct = Math.max(matched.heightPct, box.height_pct)
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
  const pad = 0.18
  return mergeFrameRows(rows).map((t, i) =>
    pctBoxToMosaicOverlay({
      id: `ov-ai-${i + 1}`,
      centerXPct: t.centerXPct,
      centerYPct: t.centerYPct,
      widthPct: Math.min(98, t.widthPct + 4),
      heightPct: Math.min(40, t.heightPct + 3),
      startSec: Math.max(0, t.startSec - pad),
      endSec: Math.min(durationSec, t.endSec + pad + 0.35),
      detectedText: t.text,
    })
  )
}
