/** MVP 스튜디오 추가 배경음악 — `public/shotform-mvp-sfx/` 정적 파일 (배경음악 6~10) */

export type MvpExtraBgmOption = {
  id: string
  label: string
  src: string
}

export const MVP_EXTRA_BGM_OPTIONS: readonly MvpExtraBgmOption[] = [
  { id: "6", label: "배경음악 6", src: "/shotform-mvp-sfx/ding.mp3" },
  { id: "7", label: "배경음악 7", src: "/shotform-mvp-sfx/pop.mp3" },
  { id: "8", label: "배경음악 8", src: "/shotform-mvp-sfx/whoosh.mp3" },
  { id: "9", label: "배경음악 9", src: "/shotform-mvp-sfx/success.mp3" },
  { id: "10", label: "배경음악 10", src: "/shotform-mvp-sfx/camera.mp3" },
] as const

/** @deprecated 레거시 sfxId → 배경음악 번호 */
const LEGACY_SFX_ID_TO_BGM_NUM: Record<string, string> = {
  ding: "6",
  pop: "7",
  whoosh: "8",
  success: "9",
  camera: "10",
}

export function mvpExtraBgmSrc(bgmId: string): string | null {
  return MVP_EXTRA_BGM_OPTIONS.find((o) => o.id === bgmId)?.src ?? null
}

export function mvpExtraBgmLabel(bgmId: string, fallback = "배경음악"): string {
  return MVP_EXTRA_BGM_OPTIONS.find((o) => o.id === bgmId)?.label ?? fallback
}

/** @deprecated sfx-* catalogId 또는 sfxId → bgm-N */
export function legacySfxToBgmCatalogId(catalogOrSfxId: string): string | null {
  const raw = catalogOrSfxId.startsWith("sfx-")
    ? catalogOrSfxId.slice(4)
    : catalogOrSfxId
  const num = LEGACY_SFX_ID_TO_BGM_NUM[raw]
  return num ? `bgm-${num}` : null
}
