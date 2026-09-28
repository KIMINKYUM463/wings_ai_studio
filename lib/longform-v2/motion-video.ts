/** WingsStudio detailModeMotionVideo 와 동일 계열 — Seedance I2V */

export type MotionVideoResolution = "480p" | "720p" | "1080p"

export const MOTION_VIDEO_RESOLUTIONS: MotionVideoResolution[] = ["480p", "720p", "1080p"]

export const DEFAULT_MOTION_VIDEO_RESOLUTION: MotionVideoResolution = "480p"

export const MOTION_VIDEO_SEEDANCE_MAX_SEC = 12

/** 나레이션 글자 수 → 대략 초 (WingsStudio estimateSceneNarrationDurationSec) */
export function estimateNarrationDurationSec(text: string, knownSec?: number): number {
  if (typeof knownSec === "number" && knownSec > 0) return knownSec
  const t = (text || "").trim()
  if (!t) return 3
  return Math.max(0.7, Number((t.length / 8.8).toFixed(2)))
}

export function motionVideoTargetDurationSec(ttsDurationSec?: number): number {
  const base = typeof ttsDurationSec === "number" && ttsDurationSec > 0 ? ttsDurationSec : 3
  return Math.max(2, Math.round(base))
}

export function motionVideoSeedanceDurationSec(ttsDurationSec?: number): number {
  const target = motionVideoTargetDurationSec(ttsDurationSec)
  return Math.max(2, Math.min(MOTION_VIDEO_SEEDANCE_MAX_SEC, target))
}
