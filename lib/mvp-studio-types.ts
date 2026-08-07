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

/** SEO 플랫폼 키 (탭 순서와 동일) */
export type MvpSeoPlatformKey =
  | "common"
  | "youtube"
  | "tiktok"
  | "instagram"
  | "threads"
  | "naverclip"

/** 공통 탭 — CapCut·flat 필드와 동기화 */
export type MvpSeoCommonOutput = {
  title: string
  description: string
  tags: string[]
  hashtags: string[]
  hookShort: string
  commentCue: string
}

export type MvpSeoYoutubeOutput = {
  title: string
  description: string
  tags: string[]
  hashtags: string[]
  recommendedTitles: string[]
  pinnedComment: string
}

/** TikTok / Instagram / Threads / 네이버 클립 — 숏폼형 */
export type MvpSeoShortformOutput = {
  title: string
  body: string
  hashtags: string[]
  commentPrompt: string
  cta: string
}

export type MvpSeoPlatformOutputs = {
  common: MvpSeoCommonOutput
  youtube: MvpSeoYoutubeOutput
  tiktok: MvpSeoShortformOutput
  instagram: MvpSeoShortformOutput
  threads: MvpSeoShortformOutput
  naverclip: MvpSeoShortformOutput
}

/** 유튜브·숏폼 업로드용 제목·설명·태그 */
export type MvpStudioSeoMeta = {
  title: string
  recommendedTitles?: string[]
  description: string
  tags: string[]
  hashtags: string[]
  hookShort?: string
  commentCue?: string
  /** 플랫폼별 업로드 카피 (공통·YT·숏폼·네이버) */
  platformOutputs?: MvpSeoPlatformOutputs
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

/** 짧게 한 번 재생되는 타임라인 효과음 */
export type MvpEffectClip = {
  id: string
  catalogId?: string
  label: string
  src: string
  startSec: number
  durationSec: number
  sourceOffsetSec: number
  sourceDurationSec: number
  volumePct: number
  autoPlaced?: boolean
  autoReason?: string
}

export function normalizeMvpEffectClips(
  raw?: readonly Partial<MvpEffectClip>[] | null,
  videoDurationSec = 30
): MvpEffectClip[] {
  if (!raw?.length) return []
  const maxT = Math.max(0.1, videoDurationSec)
  return raw
    .map((clip, index) => {
      const src = typeof clip.src === "string" ? clip.src.trim() : ""
      if (!src) return null
      const startSec = Math.max(0, Math.min(maxT, Number(clip.startSec) || 0))
      const sourceDurationSec = Math.max(
        0.1,
        Math.min(30, Number(clip.sourceDurationSec) || Number(clip.durationSec) || 1.2)
      )
      const sourceOffsetSec = Math.max(
        0,
        Math.min(sourceDurationSec - 0.05, Number(clip.sourceOffsetSec) || 0)
      )
      const durationSec = Math.max(
        0.05,
        Math.min(
          maxT - startSec || 0.05,
          sourceDurationSec - sourceOffsetSec,
          Number(clip.durationSec) || sourceDurationSec
        )
      )
      return {
        id:
          typeof clip.id === "string" && clip.id
            ? clip.id
            : `effect_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`,
        catalogId: typeof clip.catalogId === "string" ? clip.catalogId : undefined,
        label:
          typeof clip.label === "string" && clip.label.trim()
            ? clip.label.trim()
            : "효과음",
        src,
        startSec,
        durationSec,
        sourceOffsetSec,
        sourceDurationSec,
        volumePct: Math.min(100, Math.max(0, Number(clip.volumePct ?? 50) || 50)),
        autoPlaced: Boolean(clip.autoPlaced),
        autoReason:
          typeof clip.autoReason === "string" ? clip.autoReason : undefined,
      } satisfies MvpEffectClip
    })
    .filter(Boolean) as MvpEffectClip[]
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
  /** TTS 나레이션 배속 (0.8~1.5) — 장면 맞춤 OFF일 때 전역 기본값 */
  speechSpeed?: number
  /**
   * 장면 맞춤 ON — 컷 길이에 맞춰 장면별 TTS 배속 자동 (벤치마크)
   * 기본 true
   */
  sceneFitEnabled?: boolean
  /** 장면별 TTS 배속 (장면 맞춤 결과) */
  sceneSpeeds?: number[]
  /**
   * 음성에 맞춰 자른 컷 end(초, 출력 타임라인).
   * 원본 컷보다 짧을 때만 저장 — 미리보기·내보내기 동기화에 사용
   */
  audioFitEnds?: number[]
  phase?: MvpStudioPhase
  /** IndexedDB에 MP4가 저장된 짜집기 jobId (이 브라우저 로컬) */
  editMp4CachedJobId?: string
  /** IndexedDB에 TTS WAV가 저장된 jobId (이 브라우저 로컬) */
  editTtsCachedJobId?: string
  /** 배경음·효과음 통합 클립 */
  bgmClips?: MvpBgmClip[]
  /** 스토리 효과음 카탈로그에서 배치한 one-shot 효과음 */
  effectClips?: MvpEffectClip[]
  /** 영상 소스별 미리보기 확대·좌우반전 (video_id 키) */
  videoSourceTransforms?: import("@/lib/mvp-video-source-transform").MvpVideoSourceTransforms
  /** 제목·설명·태그 (SEO) */
  seoMeta?: MvpStudioSeoMeta
  /** @deprecated */
  bgm?: MvpBgmSettings
  /** @deprecated */
  sfxClips?: MvpSfxClip[]
}

export const MVP_STUDIO_PHASES: Array<{ id: Exclude<MvpStudioPhase, MvpStudioPhaseLegacy>; n: number; label: string }> = [
  { id: "edit", n: 1, label: "영상 편집" },
  { id: "script-style", n: 2, label: "자막·대본" },
  { id: "thumbnail", n: 3, label: "썸네일" },
  { id: "export", n: 2, label: "내보내기" },
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
    sizePx: 26,
    color: "#ffffff",
    y: DEFAULT_SUBTITLE_Y_PERCENT,
    x: 50,
    fontId: "pretendard-bold",
    fontWeight: "bold",
    textAlign: "center",
    outlineOn: true,
    outlineColor: "#000000",
    outlineWidthPx: 2,
    bgOn: false,
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
  // 구 기본값(22·32)은 새 기본(26)으로 맞춥니다.
  const rawSize = Number(merged.sizePx)
  const sizePx = !Number.isFinite(rawSize)
    ? 26
    : rawSize === 22 || rawSize === 32
      ? 26
      : rawSize
  return {
    sizePx: Math.min(64, Math.max(14, sizePx)),
    color: merged.color?.startsWith("#") ? merged.color : "#ffffff",
    y: migrateSubtitleY(merged.y),
    x: Math.min(90, Math.max(10, Number(merged.x ?? 50) || 50)),
    fontId: merged.fontId || "pretendard-bold",
    fontWeight: merged.fontWeight ?? "bold",
    textAlign: merged.textAlign ?? "center",
    outlineOn: merged.outlineOn !== false,
    outlineColor: merged.outlineColor?.startsWith("#") ? merged.outlineColor : "#000000",
    outlineWidthPx: Math.min(6, Math.max(0, Number(merged.outlineWidthPx ?? 2) || 2)),
    bgOn: merged.bgOn === true,
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
