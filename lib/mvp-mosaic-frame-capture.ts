/** AI 모자이크 스캔용 — 짜집기 영상에서 균등·정밀 샘플 프레임 캡처 */

import type { MosaicFrameDetectRow } from "@/lib/mvp-mosaic-merge"

const DEFAULT_MAX_FRAMES = 52
const DEFAULT_MAX_WIDTH = 640
const REFINE_MAX_WIDTH = 768
const BOUNDARY_MAX_WIDTH = 768
const SEEK_TIMEOUT_MS = 2500

export type MosaicSceneSegment = { start: number; end: number }

export type MosaicScanFrame = {
  timeSec: number
  /** data:image/jpeg;base64,... prefix 제외 */
  imageBase64: string
}

export function nativeMosaicCaptureWidth(video: HTMLVideoElement, cap = REFINE_MAX_WIDTH): number {
  const vw = video.videoWidth
  if (!vw) return cap
  return Math.min(cap, vw)
}

/** 배속 재생 중에도 정확한 프레임 캡처 — 1배속 고정 (seek 없이 즉시 반환) */
export function prepareVideoForMosaicCapture(video: HTMLVideoElement): { restore: () => void } {
  const savedTime = video.currentTime
  const wasPaused = video.paused
  const savedRate = video.playbackRate
  video.pause()
  video.playbackRate = 1
  return {
    restore: () => {
      video.playbackRate = savedRate > 0 ? savedRate : 1
      video.currentTime = savedTime
      if (!wasPaused) void video.play().catch(() => {})
    },
  }
}
export function effectiveMosaicCaptureDuration(
  video: HTMLVideoElement,
  timelineDurationSec: number
): number {
  const videoDur = Number.isFinite(video.duration) && video.duration > 0.1 ? video.duration : 0
  const timelineDur = Number.isFinite(timelineDurationSec) && timelineDurationSec > 0.1 ? timelineDurationSec : 0
  if (videoDur && timelineDur) return Math.min(videoDur, timelineDur)
  return videoDur || timelineDur || 0.5
}

function clampSeekTime(video: HTMLVideoElement, timeSec: number): number {
  const dur = Number.isFinite(video.duration) && video.duration > 0.1 ? video.duration : timeSec
  return Math.min(Math.max(0.05, timeSec), Math.max(0.1, dur - 0.05))
}

function stripDataUrlPrefix(dataUrl: string): string {
  const i = dataUrl.indexOf(",")
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl
}

export async function waitForVideoReady(video: HTMLVideoElement, timeoutMs = 8000): Promise<void> {
  if (video.readyState >= 2) return
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error("영상 로드 시간 초과. MP4가 준비된 뒤 다시 시도해 주세요."))
    }, timeoutMs)
    const onReady = () => {
      cleanup()
      resolve()
    }
    const onErr = () => {
      cleanup()
      reject(new Error("영상을 불러올 수 없습니다."))
    }
    const cleanup = () => {
      clearTimeout(timer)
      video.removeEventListener("loadeddata", onReady)
      video.removeEventListener("canplay", onReady)
      video.removeEventListener("error", onErr)
    }
    video.addEventListener("loadeddata", onReady)
    video.addEventListener("canplay", onReady)
    video.addEventListener("error", onErr)
  })
}

async function seekVideoAccurate(video: HTMLVideoElement, timeSec: number): Promise<void> {
  const target = clampSeekTime(video, timeSec)
  if (Math.abs(video.currentTime - target) < 0.04) return

  await new Promise<void>((resolve, reject) => {
    let settled = false
    const cleanup = () => {
      clearTimeout(timer)
      video.removeEventListener("seeked", onSeeked)
    }
    const finish = () => {
      if (settled) return
      settled = true
      cleanup()
      resolve()
    }
    const fail = (msg: string) => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error(msg))
    }
    const onSeeked = () => finish()
    const timer = window.setTimeout(() => {
      if (Math.abs(video.currentTime - target) < 0.25) finish()
      else fail(`영상 프레임 이동 시간 초과 (${target.toFixed(1)}초)`)
    }, SEEK_TIMEOUT_MS)
    video.addEventListener("seeked", onSeeked)
    try {
      video.currentTime = target
    } catch {
      fail("영상 시간 이동에 실패했습니다.")
    }
  })
}

async function resizeJpegBase64(dataUrl: string, maxWidth: number, quality = 0.76): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width)
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("캔버스를 사용할 수 없습니다."))
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      resolve(stripDataUrlPrefix(canvas.toDataURL("image/jpeg", quality)))
    }
    img.onerror = () => reject(new Error("프레임 리사이즈 실패"))
    img.src = dataUrl
  })
}

async function captureFrameAtTime(
  video: HTMLVideoElement,
  timeSec: number,
  maxWidth: number,
  quality = 0.8
): Promise<string> {
  await seekVideoAccurate(video, timeSec)
  const w = video.videoWidth
  const h = video.videoHeight
  if (!w || !h) throw new Error("영상 크기를 읽을 수 없습니다.")
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("캔버스를 사용할 수 없습니다.")
  ctx.drawImage(video, 0, 0, w, h)
  return resizeJpegBase64(canvas.toDataURL("image/jpeg", quality), maxWidth, quality)
}

function uniqueSortedTimes(times: number[], minGap = 0.035): number[] {
  const sorted = [...times].sort((a, b) => a - b)
  const out: number[] = []
  for (const t of sorted) {
    const rounded = Math.round(t * 1000) / 1000
    if (!out.some((x) => Math.abs(x - rounded) < minGap)) out.push(rounded)
  }
  return out
}

export function buildMosaicScanTimes(
  durationSec: number,
  options?: { intervalSec?: number; maxFrames?: number }
): number[] {
  const safeDur = Math.max(0.5, durationSec)
  const interval =
    options?.intervalSec ??
    (safeDur <= 12 ? 0.12 : safeDur <= 22 ? 0.15 : safeDur <= 35 ? 0.18 : safeDur <= 50 ? 0.22 : 0.28)
  const maxFrames = options?.maxFrames ?? DEFAULT_MAX_FRAMES
  const times: number[] = []
  for (let t = 0.04; t < safeDur - 0.03 && times.length < maxFrames; t += interval) {
    times.push(Math.round(t * 1000) / 1000)
  }
  if (!times.length) times.push(0.08)
  const last = times[times.length - 1]!
  if (safeDur - last > interval * 0.45 && times.length < maxFrames) {
    times.push(Math.round((safeDur - 0.04) * 1000) / 1000)
  }
  return times
}

/** 장면(컷) 구간마다 더 촘촘히 샘플 — 프레임 예산을 장면 길이에 비례 배분 */
export function buildMosaicScanTimesForSegments(
  durationSec: number,
  segments: MosaicSceneSegment[],
  options?: { maxFrames?: number }
): number[] {
  const maxFrames = options?.maxFrames ?? DEFAULT_MAX_FRAMES
  const valid = segments
    .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start + 0.05)
    .sort((a, b) => a.start - b.start)

  if (!valid.length) return buildMosaicScanTimes(durationSec, options)

  const totalSegDur = valid.reduce((a, s) => a + (s.end - s.start), 0)
  const times: number[] = []

  for (const seg of valid) {
    const segDur = Math.max(0.08, seg.end - seg.start)
    const budget = Math.max(3, Math.round((segDur / totalSegDur) * maxFrames))
    const interval =
      segDur / budget <= 0.12 ? 0.1 : segDur / budget <= 0.2 ? 0.14 : segDur / budget <= 0.35 ? 0.18 : 0.22

    let count = 0
    for (let t = seg.start + 0.04; t < seg.end - 0.02 && count < budget; t += interval) {
      times.push(Math.round(t * 1000) / 1000)
      count++
    }
    times.push(Math.round(((seg.start + seg.end) / 2) * 1000) / 1000)
    times.push(Math.round((seg.end - 0.05) * 1000) / 1000)
  }

  return uniqueSortedTimes(times, 0.03).slice(0, maxFrames)
}

/** 1차 감지 결과 주변을 더 촘촘히 재샘플 */
export function buildMosaicRefineTimes(
  rows: MosaicFrameDetectRow[],
  durationSec: number,
  options?: { maxExtra?: number; existingTimes?: number[] }
): number[] {
  const maxExtra = options?.maxExtra ?? 18
  const existing = new Set((options?.existingTimes ?? []).map((t) => Math.round(t * 1000) / 1000))
  const hits = rows.filter((r) => r.boxes.length > 0).map((r) => r.timeSec)
  if (!hits.length) return []

  const extra: number[] = []
  const push = (t: number) => {
    const clamped = Math.round(Math.min(Math.max(0.04, t), durationSec - 0.04) * 1000) / 1000
    if (existing.has(clamped)) return
    if (!extra.some((x) => Math.abs(x - clamped) < 0.03)) extra.push(clamped)
  }

  for (const t of hits) {
    for (const d of [-0.14, -0.1, -0.06, -0.03, 0.03, 0.06, 0.1, 0.14]) push(t + d)
  }

  for (let i = 0; i < hits.length - 1; i++) {
    const a = hits[i]!
    const b = hits[i + 1]!
    const gap = b - a
    if (gap > 0.1 && gap < 1.5) {
      push(a + gap * 0.33)
      push(a + gap * 0.66)
    }
  }

  return uniqueSortedTimes(extra).slice(0, maxExtra)
}

/** 1차에서 중국어가 안 잡힌 장면의 중간·끝 프레임 재스캔 */
export function buildMosaicMissedSegmentTimes(
  rows: MosaicFrameDetectRow[],
  segments: MosaicSceneSegment[],
  existingTimes: number[]
): number[] {
  const existing = new Set(existingTimes.map((t) => Math.round(t * 1000) / 1000))
  const extra: number[] = []
  const push = (t: number) => {
    const rounded = Math.round(t * 1000) / 1000
    if (existing.has(rounded)) return
    if (!extra.some((x) => Math.abs(x - rounded) < 0.04)) extra.push(rounded)
  }

  for (const seg of segments) {
    if (!Number.isFinite(seg.start) || !Number.isFinite(seg.end) || seg.end <= seg.start + 0.05) continue
    const hasHit = rows.some(
      (r) =>
        r.timeSec >= seg.start - 0.05 &&
        r.timeSec <= seg.end + 0.05 &&
        r.boxes.length > 0
    )
    if (hasHit) continue
    push(seg.start + (seg.end - seg.start) * 0.35)
    push((seg.start + seg.end) / 2)
    push(seg.end - (seg.end - seg.start) * 0.15)
  }

  return uniqueSortedTimes(extra, 0.04)
}

export type MosaicTrackWindow = {
  startSec: number
  endSec: number
  centerXPct: number
  centerYPct: number
}

/** 3차 — 트랙 등장·퇴장 경계를 0.03~0.05초 단위로 재탐색 */
export function buildMosaicBoundaryTimes(
  tracks: MosaicTrackWindow[],
  durationSec: number,
  options?: { existingTimes?: number[]; maxExtra?: number }
): number[] {
  const maxExtra = options?.maxExtra ?? 20
  const existing = new Set((options?.existingTimes ?? []).map((t) => Math.round(t * 1000) / 1000))
  const extra: number[] = []
  const push = (t: number) => {
    const clamped = Math.round(Math.min(Math.max(0.04, t), durationSec - 0.04) * 1000) / 1000
    if (existing.has(clamped)) return
    if (!extra.some((x) => Math.abs(x - clamped) < 0.025)) extra.push(clamped)
  }

  for (const track of tracks) {
    for (const d of [-0.24, -0.18, -0.12, -0.08, -0.05, -0.03, 0.03, 0.05, 0.08, 0.12, 0.18, 0.24]) {
      push(track.startSec + d)
      push(track.endSec + d)
    }
    push((track.startSec + track.endSec) / 2)
  }

  return uniqueSortedTimes(extra, 0.025).slice(0, maxExtra)
}

export async function captureMosaicFramesAtTimes(
  video: HTMLVideoElement,
  times: number[],
  options?: {
    maxWidth?: number
    onProgress?: (done: number, total: number) => void
    signal?: AbortSignal
  }
): Promise<MosaicScanFrame[]> {
  const maxWidth = options?.maxWidth ?? DEFAULT_MAX_WIDTH
  const savedTime = video.currentTime
  const wasPaused = video.paused
  const out: MosaicScanFrame[] = []

  if (video.readyState < 2) {
    await waitForVideoReady(video)
  }

  try {
    video.pause()
    video.playbackRate = 1
    for (let i = 0; i < times.length; i++) {
      if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError")
      const timeSec = times[i]!
      const quality = maxWidth >= REFINE_MAX_WIDTH ? 0.86 : maxWidth >= 640 ? 0.82 : 0.78
      const imageBase64 = await captureFrameAtTime(video, timeSec, maxWidth, quality)
      out.push({ timeSec, imageBase64 })
      options?.onProgress?.(i + 1, times.length)
    }
  } finally {
    video.currentTime = savedTime
    if (!wasPaused) void video.play().catch(() => {})
  }
  return out
}

export async function captureMosaicScanFramesFromVideo(
  video: HTMLVideoElement,
  durationSec: number,
  options?: {
    intervalSec?: number
    maxFrames?: number
    maxWidth?: number
    segments?: MosaicSceneSegment[]
    onProgress?: (done: number, total: number) => void
    signal?: AbortSignal
  }
): Promise<MosaicScanFrame[]> {
  const captureDur = effectiveMosaicCaptureDuration(video, durationSec)
  const times = options?.segments?.length
    ? buildMosaicScanTimesForSegments(captureDur, options.segments, options)
    : buildMosaicScanTimes(captureDur, options)
  const maxWidth = options?.maxWidth ?? nativeMosaicCaptureWidth(video, DEFAULT_MAX_WIDTH)
  return captureMosaicFramesAtTimes(video, times, { ...options, maxWidth })
}

export const MOSAIC_BOUNDARY_CAPTURE_WIDTH = BOUNDARY_MAX_WIDTH
