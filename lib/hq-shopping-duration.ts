/** 고퀄리티 AI 쇼핑숏폼 — Seedance 2.5 영상 길이 옵션 (클라이언트·서버 공용) */

export const HQ_DURATION_OPTIONS = [5, 8, 10, 12, 15] as const
export type HqDurationSec = (typeof HQ_DURATION_OPTIONS)[number]
export const HQ_DEFAULT_DURATION_SEC: HqDurationSec = 15

export function clampHqDurationSec(raw: unknown): HqDurationSec {
  const n = typeof raw === "number" ? raw : Number(raw)
  if (HQ_DURATION_OPTIONS.includes(n as HqDurationSec)) return n as HqDurationSec
  let best: HqDurationSec = HQ_DEFAULT_DURATION_SEC
  let bestDiff = Infinity
  for (const opt of HQ_DURATION_OPTIONS) {
    const d = Math.abs(opt - (Number.isFinite(n) ? n : HQ_DEFAULT_DURATION_SEC))
    if (d < bestDiff) {
      best = opt
      bestDiff = d
    }
  }
  return best
}
