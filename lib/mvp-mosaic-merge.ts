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

export type MosaicSceneSegment = { start: number; end: number }

function sceneSegmentAtTime(
  segments: MosaicSceneSegment[] | undefined,
  timeSec: number
): MosaicSceneSegment | null {
  if (!segments?.length) return null
  for (const seg of segments) {
    if (timeSec >= seg.start - 0.05 && timeSec <= seg.end + 0.05) return seg
  }
  return null
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

const CHINESE_RE = /[\u4e00-\u9fff\u3400-\u4dbf]/

function isSuspiciousMosaicBox(box: DetectedChineseMosaicBox): boolean {
  const { center_x_pct: cx, center_y_pct: cy, width_pct: w, height_pct: h } = box
  if (box.text && CHINESE_RE.test(box.text)) return false
  // 상단 한국어 TTS 자막 띠 (중국어는 보통 중·하단)
  if (cy < 22 && w > 55 && h > 8) return true
  // 화면 거의 전체를 덮는 박스만 제외 (하단 중국어 1~2줄은 허용)
  if (w > 94 && h > 38) return true
  if (w > 88 && h > 48) return true
  return false
}

function filterReliableHits(hits: { timeSec: number; box: DetectedChineseMosaicBox }[]) {
  const clean = hits.filter((h) => !isSuspiciousMosaicBox(h.box))
  return clean.length >= Math.max(1, Math.ceil(hits.length * 0.35)) ? clean : hits
}

function buildTrackFromHits(
  hits: { timeSec: number; box: DetectedChineseMosaicBox }[],
  text?: string
): Track {
  const reliable = filterReliableHits(hits)
  const midT = reliable[Math.floor(reliable.length / 2)]?.timeSec ?? hits[0]!.timeSec
  const sorted = [...reliable].sort((a, b) => Math.abs(a.timeSec - midT) - Math.abs(b.timeSec - midT))
  const core = sorted.slice(0, Math.max(2, Math.ceil(sorted.length * 0.65)))
  const times = reliable.map((h) => h.timeSec)

  const heights = core.map((h) => h.box.height_pct).sort((a, b) => a - b)
  const widths = core.map((h) => h.box.width_pct).sort((a, b) => a - b)
  const hIdx = Math.floor(heights.length * 0.3)
  const wIdx = Math.floor(widths.length * 0.45)

  return {
    centerXPct: median(core.map((h) => h.box.center_x_pct)),
    centerYPct: median(core.map((h) => h.box.center_y_pct)),
    widthPct: widths[wIdx] ?? widths[0]!,
    heightPct: heights[hIdx] ?? heights[0]!,
    text: text ?? core.find((h) => h.box.text)?.box.text,
    startSec: Math.min(...times),
    endSec: Math.max(...times),
    samples: reliable.length,
    hits: reliable,
  }
}

function tightenTrackGeometry(track: Track): void {
  if (track.hits.length < 2) return
  const rebuilt = buildTrackFromHits(track.hits, track.text)
  track.centerXPct = rebuilt.centerXPct
  track.centerYPct = rebuilt.centerYPct
  track.widthPct = rebuilt.widthPct
  track.heightPct = rebuilt.heightPct
}

function positionClusterDistance(a: DetectedChineseMosaicBox, b: DetectedChineseMosaicBox): number {
  return Math.hypot(a.center_x_pct - b.center_x_pct, a.center_y_pct - b.center_y_pct)
}

/** 위치가 크게 바뀌면 구간별로 트랙 분리 */
function explodeTracksByPosition(tracks: Track[]): Track[] {
  const out: Track[] = []
  for (const track of tracks) {
    if (track.hits.length <= 2) {
      out.push(track)
      continue
    }
    const sorted = [...track.hits].sort((a, b) => a.timeSec - b.timeSec)
    let bucket: typeof sorted = []
    for (const hit of sorted) {
      if (!bucket.length || positionClusterDistance(bucket[bucket.length - 1]!.box, hit.box) <= 7) {
        bucket.push(hit)
      } else {
        out.push(buildTrackFromHits(bucket, track.text))
        bucket = [hit]
      }
    }
    if (bucket.length) out.push(buildTrackFromHits(bucket, track.text))
  }
  return out
}

function recomputeTrackGeometry(track: Track): void {
  const rebuilt = buildTrackFromHits(track.hits, track.text)
  track.centerXPct = rebuilt.centerXPct
  track.centerYPct = rebuilt.centerYPct
  track.widthPct = rebuilt.widthPct
  track.heightPct = rebuilt.heightPct
  track.startSec = Math.min(track.startSec, rebuilt.startSec)
  track.endSec = Math.max(track.endSec, rebuilt.endSec)
  track.hits = rebuilt.hits
  track.samples = rebuilt.samples
  if (rebuilt.text) track.text = rebuilt.text
}

function mergeFrameRows(rows: MosaicFrameDetectRow[]): Track[] {
  const tracks: Track[] = []
  const gapToleranceSec = 0.55
  const positionTolerance = 10

  for (const row of rows.sort((a, b) => a.timeSec - b.timeSec)) {
    for (const box of row.boxes) {
      if (isSuspiciousMosaicBox(box)) continue
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
      if (row.timeSec < track.startSec - 0.45) continue
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

function trackIoUTracks(a: Track, b: Track): number {
  const ra = boxRect(a)
  const rb = boxRect(b)
  const ix = Math.max(0, Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left))
  const iy = Math.max(0, Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top))
  const inter = ix * iy
  if (inter <= 0) return 0
  const union = ra.w * ra.h + rb.w * rb.h - inter
  return union > 0 ? inter / union : 0
}

function tracksOverlapInTime(a: Track, b: Track): boolean {
  return a.startSec < b.endSec - 0.02 && b.startSec < a.endSec - 0.02
}

function mergeTrackUnion(into: Track, other: Track): void {
  const ra = boxRect(into)
  const rb = boxRect(other)
  const left = Math.min(ra.left, rb.left)
  const top = Math.min(ra.top, rb.top)
  const right = Math.max(ra.right, rb.right)
  const bottom = Math.max(ra.bottom, rb.bottom)
  into.centerXPct = (left + right) / 2
  into.centerYPct = (top + bottom) / 2
  into.widthPct = right - left
  into.heightPct = bottom - top
  into.startSec = Math.min(into.startSec, other.startSec)
  into.endSec = Math.max(into.endSec, other.endSec)
  into.hits.push(...other.hits)
  into.samples += other.samples
  if (other.text) {
    into.text =
      into.text && into.text !== other.text
        ? `${into.text.slice(0, 18)}…${other.text.slice(0, 18)}`
        : other.text
  }
}

/** 같은 구간·겹치는 위치의 중복 트랙을 하나로 합침 */
function consolidateOverlappingTracks(tracks: Track[]): Track[] {
  const sorted = [...tracks].sort((a, b) => a.startSec - b.startSec || a.centerYPct - b.centerYPct)
  const out: Track[] = []

  for (const t of sorted) {
    let merged = false
    for (const existing of out) {
      if (!tracksOverlapInTime(existing, t)) continue

      const vertGap = Math.abs(existing.centerYPct - t.centerYPct)
      const iou = trackIoUTracks(existing, t)
      const stackedLines = vertGap >= 5 && vertGap <= 20 && trackIoUTracks(existing, t) < 0.08

      if (stackedLines) continue

      if (iou > 0.12 || vertGap < 4.5) {
        mergeTrackUnion(existing, t)
        merged = true
        break
      }
    }
    if (!merged) {
      out.push({
        ...t,
        hits: [...t.hits],
      })
    }
  }
  return out
}

/** 같은 장면 안 2줄은 각각 유지 (세로 합치면 위아래 과다 모자이크) — 비활성 */

function resolveTrackTiming(
  track: Track,
  durationSec: number,
  step: number,
  seg: MosaicSceneSegment | null
): { startSec: number; endSec: number } {
  const leadSec = Math.min(0.28, Math.max(0.1, step * 0.65))
  const tailSec = Math.min(0.1, Math.max(0.03, step * 0.22))

  let startSec = Math.max(0, track.startSec - leadSec)
  let endSec = Math.min(durationSec, track.endSec + tailSec)

  if (seg) {
    const segDur = Math.max(0.12, seg.end - seg.start)
    const detectDelay = track.startSec - seg.start
    if (detectDelay > 0.05 && detectDelay < segDur * 0.7) {
      startSec = Math.min(startSec, seg.start + 0.02)
    }
    const coverRatio = (track.endSec - track.startSec) / segDur
    if (coverRatio >= 0.62) {
      startSec = Math.min(startSec, seg.start + 0.02)
      endSec = Math.max(endSec, seg.end - 0.02)
    }
  }

  return { startSec, endSec }
}

export function buildMosaicTracks(rows: MosaicFrameDetectRow[]): Track[] {
  const tracks = explodeTracksByPosition(mergeFrameRows(rows))
  if (tracks.length) refineTrackBoundaries(tracks, rows)
  const consolidated = consolidateOverlappingTracks(tracks)
  for (const t of consolidated) tightenTrackGeometry(t)
  return consolidated
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

/** 트랙 등장 직전 프레임 — 글자보다 늦게 켜지는 현상 보정 */
export function buildMosaicAppearanceProbeTimes(
  tracks: Array<Pick<Track, "startSec">>,
  existingTimes: number[],
  options?: { maxExtra?: number }
): number[] {
  const maxExtra = options?.maxExtra ?? 24
  const existing = new Set(existingTimes.map((t) => Math.round(t * 1000) / 1000))
  const extra: number[] = []
  const push = (t: number) => {
    const clamped = Math.round(Math.max(0.04, t) * 1000) / 1000
    if (existing.has(clamped)) return
    if (!extra.some((x) => Math.abs(x - clamped) < 0.025)) extra.push(clamped)
  }

  for (const track of tracks) {
    for (const d of [-0.2, -0.14, -0.09, -0.05, -0.02]) push(track.startSec + d)
  }

  return extra.slice(0, maxExtra)
}

export function mergeMosaicRowsToOverlays(
  rows: MosaicFrameDetectRow[],
  durationSec: number,
  options?: { videoW?: number; videoH?: number; sceneSegments?: MosaicSceneSegment[] }
): PlacedStudioOverlay[] {
  const tracks = buildMosaicTracks(rows)
  if (!tracks.length) return []

  const step = estimateSampleStep(rows)

  return tracks.map((t, i) => {
    const trackMid = (t.startSec + t.endSec) / 2
    const seg =
      sceneSegmentAtTime(options?.sceneSegments, trackMid) ??
      sceneSegmentAtTime(options?.sceneSegments, t.startSec) ??
      sceneSegmentAtTime(options?.sceneSegments, t.endSec)

    const { startSec, endSec } = resolveTrackTiming(t, durationSec, step, seg)

    return pctBoxToMosaicOverlay({
      id: `ov-ai-${i + 1}`,
      centerXPct: t.centerXPct,
      centerYPct: t.centerYPct,
      widthPct: Math.min(94, t.widthPct + 1.2),
      heightPct: Math.min(14, t.heightPct + 0.5),
      startSec,
      endSec,
      detectedText: t.text,
      videoW: options?.videoW,
      videoH: options?.videoH,
    })
  })
}

/** 트랙 중심 시각 — 위치 재정밀 캡처용 */
export function buildMosaicPositionRefineTimes(
  tracks: MosaicTrackWindow[],
  existingTimes: number[]
): number[] {
  const existing = new Set(existingTimes.map((t) => Math.round(t * 1000) / 1000))
  const times: number[] = []
  for (const track of tracks) {
    const mid = Math.round(((track.startSec + track.endSec) / 2) * 1000) / 1000
    if (!existing.has(mid)) times.push(mid)
  }
  return times
}
