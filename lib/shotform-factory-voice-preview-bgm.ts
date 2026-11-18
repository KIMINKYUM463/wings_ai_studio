/** 음성 생성(5단계) 배경음 — `public/shotform-factory-bgm/` 정적 파일 */

export type VoicePreviewBgmOption = {
  id: string
  label: string
  src: string
  /** 원본 길이(초) — 루프 위치 계산용 */
  durationSec: number
}

export const VOICE_PREVIEW_BGM_OPTIONS: readonly VoicePreviewBgmOption[] = [
  { id: "1", label: "배경음 1", src: "/shotform-factory-bgm/bgm1.mp3", durationSec: 74.2 },
  { id: "2", label: "배경음 2", src: "/shotform-factory-bgm/bgm2.mp3", durationSec: 109 },
  { id: "3", label: "배경음 3", src: "/shotform-factory-bgm/bgm3.mp3", durationSec: 63 },
  { id: "4", label: "배경음 4", src: "/shotform-factory-bgm/bgm4.mp3", durationSec: 101.2 },
  { id: "5", label: "배경음 5", src: "/shotform-factory-bgm/bgm5.mp3", durationSec: 79.8 },
] as const

export function voicePreviewBgmSrc(trackId: string): string | null {
  return VOICE_PREVIEW_BGM_OPTIONS.find((o) => o.id === trackId)?.src ?? null
}

/** 배경음 크기(0~100) → 실제 게인. 100이어도 나레이션보다 한참 작게 깔림 */
export function bgmGainFromVolumePct(volumePct: number): number {
  return Math.min(1, Math.max(0, (volumePct / 100) * 0.38))
}
