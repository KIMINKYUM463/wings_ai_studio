/** 장면 클립 재생 위치: 클립이 장면보다 짧으면 처음으로 되감지 않고 마지막 프레임에 머문다 */
export function sceneClipTime(sceneElapsedSec: number, clipDurationSec: number): number {
  if (!Number.isFinite(clipDurationSec) || clipDurationSec <= 0) return Math.max(0, sceneElapsedSec)
  return Math.max(0, Math.min(sceneElapsedSec, clipDurationSec - 0.05))
}

/** 카메라 고정 AI 클립에 얹는 느린 푸시인 배율 (장면 진행률 0→1) */
export const SCENE_PUSH_IN_MAX = 0.05

export function scenePushInScale(progress: number): number {
  const p = Math.max(0, Math.min(1, progress))
  const eased = p * p * (3 - 2 * p)
  return 1 + SCENE_PUSH_IN_MAX * eased
}
