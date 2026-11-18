/**
 * shorts-maker에서 확인한 최종 화질·싱크 규칙.
 * 실제 카메라 원본을 대체하지 않고, 우리 출력의 해상도·압축·음성 길이 기준만 맞춘다.
 */

export const SHORTS_MASTER = {
  width: 1080,
  height: 1920,
  fps: 30,
  crf: "20",
  preset: "veryfast",
  audioBitrate: "192k",
} as const

/** 음성 끝과 장면 끝이 붙지 않도록 두는 여백 */
export const VOICE_PAD_SEC = 0.08
/** 이보다 느리게 재생하면 동작이 부자연스러워 마지막 프레임 정지로 채운다 */
export const MIN_PLAYBACK_SPEED = 0.75
/** 정지 사진을 움직일 때 확대 배율. 6%만 움직여 실제 카메라처럼 보이게 한다 */
export const STILL_PAN_ZOOM = 1.06

export function voiceLedTargetSeconds(speechSec: number, maxSec = 12): number {
  const speech = Number.isFinite(speechSec) ? Math.max(0.3, speechSec) : 1
  const target = Math.round((speech + VOICE_PAD_SEC) * 100) / 100
  return Math.min(Math.max(0.3, maxSec), target)
}

export type VoiceLedClipPlan = {
  targetSec: number
  speed: number
  freezeAfterSec: number
  sourceUsedSec: number
}

/**
 * 음성 길이가 기준이다.
 * 원본이 충분하면 그대로 쓰고, 조금 짧으면 0.75배까지만 느리게 하며,
 * 그보다 짧으면 느린 재생 뒤에 마지막 프레임을 정지한다.
 */
export function planVoiceLedClip(sourceSec: number, speechSec: number): VoiceLedClipPlan {
  const targetSec = voiceLedTargetSeconds(speechSec, Number.POSITIVE_INFINITY)
  const source = Number.isFinite(sourceSec) ? Math.max(0.05, sourceSec) : targetSec
  if (source >= targetSec) {
    return { targetSec, speed: 1, freezeAfterSec: 0, sourceUsedSec: targetSec }
  }
  const speed = Math.max(MIN_PLAYBACK_SPEED, source / targetSec)
  const played = source / speed
  return {
    targetSec,
    speed: Math.round(speed * 1000) / 1000,
    freezeAfterSec: Math.max(0, Math.round((targetSec - played) * 1000) / 1000),
    sourceUsedSec: source,
  }
}

export function stillMasterSize() {
  const zoomW = Math.round((SHORTS_MASTER.width * STILL_PAN_ZOOM) / 2) * 2
  const zoomH = Math.round((SHORTS_MASTER.height * STILL_PAN_ZOOM) / 2) * 2
  return { zoomW, zoomH, width: SHORTS_MASTER.width, height: SHORTS_MASTER.height }
}

/** 9:16 화면을 꽉 채운 뒤 좌우로 6%만 이동하는 ffmpeg 필터 */
export function stillPanFilter(durationSec: number, pan: "left" | "right"): string {
  const { zoomW, zoomH, width, height } = stillMasterSize()
  const duration = Math.max(0.3, durationSec).toFixed(3)
  const x =
    pan === "right"
      ? `(iw-ow)*min(t/${duration},1)`
      : `(iw-ow)*(1-min(t/${duration},1))`
  return [
    `scale=${zoomW}:${zoomH}:force_original_aspect_ratio=increase`,
    `crop=${zoomW}:${zoomH}`,
    `crop=${width}:${height}:x='${x}':y=(ih-oh)/2`,
    "setsar=1",
    `fps=${SHORTS_MASTER.fps}`,
    "format=yuv420p",
  ].join(",")
}

export function masterScaleCropFilter(): string {
  return `scale=${SHORTS_MASTER.width}:${SHORTS_MASTER.height}:force_original_aspect_ratio=increase,crop=${SHORTS_MASTER.width}:${SHORTS_MASTER.height},fps=${SHORTS_MASTER.fps},format=yuv420p`
}
