/** TTS·나레이션 배속 (0.8x ~ 1.5x) */

export const TTS_SPEED_OPTIONS = [0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5] as const

export type TtsSpeedOption = (typeof TTS_SPEED_OPTIONS)[number]

export const DEFAULT_TTS_SPEED: TtsSpeedOption = 1.1

export function clampTtsSpeed(raw: number): number {
  if (!Number.isFinite(raw)) return DEFAULT_TTS_SPEED
  return Math.min(1.5, Math.max(0.8, Math.round(raw * 10) / 10))
}

export function normalizeTtsSpeed(raw: unknown): TtsSpeedOption {
  const n = typeof raw === "number" ? raw : Number(raw)
  const clamped = clampTtsSpeed(n)
  return (TTS_SPEED_OPTIONS as readonly number[]).includes(clamped)
    ? (clamped as TtsSpeedOption)
    : DEFAULT_TTS_SPEED
}

export function labelTtsSpeed(speed: number): string {
  return `${clampTtsSpeed(speed)}x`
}
