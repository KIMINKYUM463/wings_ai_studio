import type { VoiceLineCue } from "@/lib/shotform-factory-line-tts"
import {
  mvpAudioCatalogItem,
  normalizeMvpAudioCatalogId,
} from "@/lib/mvp-studio-audio-catalog"
import type { PlacedStudioOverlay } from "@/lib/shotform-studio-overlay-catalog"
import { legacySfxToBgmCatalogId } from "@/lib/shotform-mvp-sfx-catalog"

/** @deprecated legacy — `edit`로 통합 */
export type MvpStudioPhaseLegacy = "tts" | "timeline"

export type MvpStudioPhase = "edit" | "script-style" | "thumbnail" | "export" | MvpStudioPhaseLegacy

export type MvpSubtitleFontWeight = "normal" | "bold" | "extrabold"

export type MvpSubtitleTextAlign = "left" | "center" | "right"

export type MvpSubtitleStyle = {
  sizePx: number
  color: string
  /** 화면 상단 기준 세로 % (50=중앙) */
  y: number
  /** 화면 좌측 기준 가로 % (50=중앙) */
  x?: number
  fontId?: string
  fontWeight?: MvpSubtitleFontWeight
  textAlign?: MvpSubtitleTextAlign
  outlineOn: boolean
  outlineColor?: string
  outlineWidthPx?: number
  bgOn: boolean
  bgColor?: string
  /** 0~100 */
  bgOpacity?: number
  textShadow?: boolean
}

export type MvpScriptStyleState = {
  conversionScript: string
  storytellingScript: string
  headcopies: string[][]
  commentKeyword: string
}

export type MvpThumbnailHookingText = {
  line1: string
  line2: string
}

export type MvpThumbnailSource = "ai" | "studio"

export type MvpThumbnailVariant = {
  id: string
  url: string
  source: MvpThumbnailSource
  hookingText?: MvpThumbnailHookingText
  /** 스튜디오 적용 시 편집 상태 — 재진입 시 텍스트 중복 방지 */
  studioDesign?: import("@/lib/mvp-thumbnail-design").MvpThumbnailDesign
  createdAt: number
}

/** @deprecated — `bgmClips`로 통합 */
export type MvpBgmSettings = {
  trackId: string
  volumePct: number
}

/** @deprecated — `MvpBgmClip`로 통합 */
export type MvpSfxClip = {
  id: string
  sfxId: string
  label: string
  src: string
  startSec: number
  volumePct: number
  durationSec: number
}

/** 배경음·효과음 통합 클립 — 영상 타임라인 start~end 구간 재생 */
export type MvpBgmClip = {
  id: string
  catalogId: string
  label: string
  src: string
  /** 영상 타임라인 시작(초) */
  startSec: number
  /** 영상 타임라인 끝(초) */
  endSec: number
  volumePct: number
  sourceDurationSec: number
}

export const MVP_BGM_CLIP_MIN_SEC = 0.35
/** 배경음 트랙에 올릴 수 있는 클립 최대 개수 */
export const MVP_MAX_BGM_CLIPS = 1

export function canAddMvpBgmClip(clips: readonly MvpBgmClip[]): boolean {
  return clips.length < MVP_MAX_BGM_CLIPS
}

export function newMvpBgmClipId(): string {
  return `bgm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export function normalizeMvpBgmClips(
  raw?: readonly Partial<MvpBgmClip>[] | null,
  videoDurationSec = 30
): MvpBgmClip[] {
  if (!raw?.length) return []
  const maxT = Math.max(1, videoDurationSec)
  return raw
    .map((c) => {
      const src = typeof c.src === "string" ? c.src.trim() : ""
      if (!src) return null
      const sourceDurationSec = Math.max(
        0.2,
        Math.min(120, Number(c.sourceDurationSec) || 1.2)
      )
      let startSec = Math.max(0, Number(c.startSec) || 0)
      let endSec = Number(c.endSec)
      if (!Number.isFinite(endSec)) {
        endSec = Math.min(maxT, startSec + sourceDurationSec)
      }
      endSec = Math.min(maxT, Math.max(startSec + MVP_BGM_CLIP_MIN_SEC, endSec))
      startSec = Math.min(startSec, endSec - MVP_BGM_CLIP_MIN_SEC)
      const catalogId = normalizeMvpAudioCatalogId(
        typeof c.catalogId === "string" ? c.catalogId : "upload"
      )
      const catalog = mvpAudioCatalogItem(catalogId)
      return {
        id: typeof c.id === "string" && c.id ? c.id : newMvpBgmClipId(),
        catalogId,
        label:
          catalog?.label ??
          (typeof c.label === "string" && c.label.trim() ? c.label.trim() : "배경음"),
        src,
        startSec,
        endSec,
        volumePct: Math.min(100, Math.max(0, Number(c.volumePct ?? 22) || 22)),
        sourceDurationSec,
      } satisfies MvpBgmClip
    })
    .filter(Boolean) as MvpBgmClip[]
}

/** 레거시 bgm·sfxClips → 통합 bgmClips */
export function migrateStudioAudioToBgmClips(
  persist?: {
    bgmClips?: readonly Partial<MvpBgmClip>[]
    bgm?: MvpBgmSettings
    sfxClips?: readonly MvpSfxClip[]
  } | null,
  videoDurationSec = 30
): MvpBgmClip[] {
  const fromClips = normalizeMvpBgmClips(persist?.bgmClips, videoDurationSec)
  if (fromClips.length) return fromClips

  const out: MvpBgmClip[] = []
  const maxT = Math.max(1, videoDurationSec)

  if (persist?.bgm?.trackId && persist.bgm.trackId !== "off") {
    const src = `/shotform-factory-bgm/bgm${persist.bgm.trackId}.mp3`
    out.push({
      id: newMvpBgmClipId(),
      catalogId: `bgm-${persist.bgm.trackId}`,
      label: `배경음 ${persist.bgm.trackId}`,
      src,
      startSec: 0,
      endSec: maxT,
      volumePct: persist.bgm.volumePct ?? 22,
      sourceDurationSec: 30,
    })
  }

  for (const s of persist?.sfxClips ?? []) {
    const dur = Math.max(MVP_BGM_CLIP_MIN_SEC, s.durationSec || 1.2)
    const catalogId =
      (s.sfxId ? legacySfxToBgmCatalogId(s.sfxId) : null) ?? "upload"
    const catalog = mvpAudioCatalogItem(catalogId)
    out.push({
      id: s.id || newMvpBgmClipId(),
      catalogId,
      label: catalog?.label ?? s.label ?? "배경음악",
      src: s.src,
      startSec: s.startSec,
      endSec: Math.min(maxT, s.startSec + dur),
      volumePct: s.volumePct ?? 22,
      sourceDurationSec: dur,
    })
  }

  return out
}

export type MvpStudioPersistData = {
  scriptOverrides?: Record<string, string>
  subtitleStyle?: MvpSubtitleStyle
  /** 미리보기 도형·화살표·아이콘 오버레이 */
  placedOverlays?: PlacedStudioOverlay[]
  scriptStyle?: MvpScriptStyleState
  /** 선택 중인 썸네일 URL (레거시·보내기 호환) */
  thumbnailUrl?: string
  thumbnailHookingText?: MvpThumbnailHookingText
  /** AI·스튜디오로 만든 썸네일 목록 */
  thumbnailGallery?: MvpThumbnailVariant[]
  selectedThumbnailId?: string
  /** 영상 0초(첫 프레임)에 썸네일 표시 */
  thumbnailIntroOn?: boolean
  voiceLineCues?: VoiceLineCue[]
  selectedVoiceId?: string
  supertoneStyle?: string
  /** TTS 나레이션 배속 (0.8~1.5) */
  speechSpeed?: number
  phase?: MvpStudioPhase
  /** IndexedDB에 MP4가 저장된 짜집기 jobId (이 브라우저 로컬) */
  editMp4CachedJobId?: string
  /** IndexedDB에 TTS WAV가 저장된 jobId (이 브라우저 로컬) */
  editTtsCachedJobId?: string
  /** 배경음·효과음 통합 클립 */
  bgmClips?: MvpBgmClip[]
  /** @deprecated */
  bgm?: MvpBgmSettings
  /** @deprecated */
  sfxClips?: MvpSfxClip[]
}

export const MVP_STUDIO_PHASES: Array<{ id: Exclude<MvpStudioPhase, MvpStudioPhaseLegacy>; n: number; label: string }> = [
  { id: "edit", n: 5, label: "영상 편집" },
  { id: "script-style", n: 6, label: "자막·대본" },
  { id: "thumbnail", n: 7, label: "썸네일" },
  { id: "export", n: 8, label: "내보내기" },
]

export function normalizeStudioPhase(phase?: MvpStudioPhase): Exclude<MvpStudioPhase, MvpStudioPhaseLegacy> {
  if (phase === "tts" || phase === "timeline") return "edit"
  if (phase === "script-style" || phase === "thumbnail" || phase === "export") return phase
  return "edit"
}

/** 자막 세로 기본값 — 화면 중앙(50%)보다 약간 위 */
export const DEFAULT_SUBTITLE_Y_PERCENT = 42

export function defaultSubtitleStyle(): MvpSubtitleStyle {
  return {
    sizePx: 22,
    color: "#ffffff",
    y: DEFAULT_SUBTITLE_Y_PERCENT,
    x: 50,
    fontId: "pretendard-bold",
    fontWeight: "bold",
    textAlign: "center",
    outlineOn: true,
    outlineColor: "#000000",
    outlineWidthPx: 2,
    bgOn: true,
    bgColor: "#000000",
    bgOpacity: 55,
    textShadow: true,
  }
}

/** 레거시 슬라이더(80–220, 150=중앙) → 화면 상단 기준 % (50=중앙) */
export function migrateSubtitleY(y: number | undefined | null): number {
  if (y == null || !Number.isFinite(y)) return 50
  if (y >= 75 && y <= 225) return Math.min(85, Math.max(15, 50 + (150 - y) / 25))
  return Math.min(85, Math.max(15, y))
}

export function subtitlePreviewTopPercent(y: number | undefined | null): number {
  return migrateSubtitleY(y)
}

export function normalizeSubtitleStyle(style?: Partial<MvpSubtitleStyle> | null): MvpSubtitleStyle {
  const base = defaultSubtitleStyle()
  if (!style) return { ...base }
  const merged = { ...base, ...style }
  return {
    sizePx: Math.min(48, Math.max(12, Number(merged.sizePx) || 22)),
    color: merged.color?.startsWith("#") ? merged.color : "#ffffff",
    y: migrateSubtitleY(merged.y),
    x: Math.min(90, Math.max(10, Number(merged.x ?? 50) || 50)),
    fontId: merged.fontId || "pretendard-bold",
    fontWeight: merged.fontWeight ?? "bold",
    textAlign: merged.textAlign ?? "center",
    outlineOn: merged.outlineOn !== false,
    outlineColor: merged.outlineColor?.startsWith("#") ? merged.outlineColor : "#000000",
    outlineWidthPx: Math.min(6, Math.max(0, Number(merged.outlineWidthPx ?? 2) || 2)),
    bgOn: merged.bgOn !== false,
    bgColor: merged.bgColor?.startsWith("#") ? merged.bgColor : "#000000",
    bgOpacity: Math.min(100, Math.max(0, Number(merged.bgOpacity ?? 55) || 55)),
    textShadow: merged.textShadow !== false,
  }
}

export function scriptStyleFromBundle(
  bundle?: {
    scripts?: { conversion?: string; storytelling?: string }
    headcopies?: string[][]
    commentKeyword?: string
  } | null
): MvpScriptStyleState {
  return {
    conversionScript: bundle?.scripts?.conversion?.trim() ?? "",
    storytellingScript: bundle?.scripts?.storytelling?.trim() ?? "",
    headcopies: bundle?.headcopies?.length ? bundle.headcopies.map((r) => [...r]) : [["", ""]],
    commentKeyword: bundle?.commentKeyword?.trim() ?? "",
  }
}
