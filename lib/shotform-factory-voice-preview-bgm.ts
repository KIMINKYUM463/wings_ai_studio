/** 음성 생성(5단계) 배경음 — `public/shotform-factory-bgm/` 정적 파일 */

export type VoicePreviewBgmOption = {
  id: string
  label: string
  src: string
}

export const VOICE_PREVIEW_BGM_OPTIONS: readonly VoicePreviewBgmOption[] = [
  { id: "1", label: "배경음 1", src: "/shotform-factory-bgm/bgm1.mp3" },
  { id: "2", label: "배경음 2", src: "/shotform-factory-bgm/bgm2.mp3" },
  { id: "3", label: "배경음 3", src: "/shotform-factory-bgm/bgm3.mp3" },
  { id: "4", label: "배경음 4", src: "/shotform-factory-bgm/bgm4.mp3" },
  { id: "5", label: "배경음 5", src: "/shotform-factory-bgm/bgm5.mp3" },
] as const

export function voicePreviewBgmSrc(trackId: string): string | null {
  return VOICE_PREVIEW_BGM_OPTIONS.find((o) => o.id === trackId)?.src ?? null
}
