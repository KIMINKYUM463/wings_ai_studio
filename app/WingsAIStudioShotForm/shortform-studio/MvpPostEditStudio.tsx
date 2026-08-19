"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { AutoEditJobResult, AutoEditPick } from "@/lib/shotform-auto-edit-types"
import {
  audioTimeFromVideoSync,
  previewTimelineEndSec,
  syncMvpPreviewVideoToAudio,
  timelineUsesAudioAxis,
  videoTimeFromAudioCueSync,
  previewPlaybackRateForCue,
  audioRangeForSceneIndex,
} from "@/lib/shotform-mvp-preview-sync"
import {
  buildVoiceLineCues,
  collectNarrationSubtitleLines,
  mergeAudioUrlsToWavBlobUrl,
  padAudioUrlEnd,
  rebakeWavBlobUrl,
  MIN_TTS_PLAIN_CHARS,
  narrationTtsTextFromScene,
  voiceLineCueAtTime,
  voiceSubtitleAtLineCues,
  type VoiceLineCue,
} from "@/lib/shotform-factory-line-tts"
import { narrationPlainCharCount, estimateNarrationDurationSec, cleanNarrationLineBreaks } from "@/lib/shotform-narration-timing"
import { normalizeTtsSpeed } from "@/lib/shotform-tts-speed"
import {
  applyAudioFitEnds,
  audioFitEndsFromCues,
  suggestFasterSpeedIfAudioOverflows,
  suggestSceneTtsSpeeds,
} from "@/lib/shotform-scene-fit-tts"
import { MVP_THUMBNAIL_INTRO_SEC } from "@/lib/mvp-thumbnail-intro"
import {
  appendThumbnailVariant,
  migrateThumbnailGallery,
  removeThumbnailVariant,
  selectedThumbnailVariant,
} from "@/lib/mvp-thumbnail-gallery"
import {
  cacheMvpThumbnailGalleryForSave,
  hydrateMvpThumbnailGallery,
  mergeHydratedThumbnailGallery,
  normalizeMvpHookingText,
  safeJsonKey,
  slimStudioPersistForSave,
} from "@/lib/mvp-thumbnail-persist"
import { narrationSegmentDuration } from "@/lib/shotform-factory-narration-script"
import {
  filterSupertoneKoreanVoices,
  normalizeSupertoneVoiceRow,
} from "@/lib/shotform-factory-tts"
import {
  buildTtsVoiceKey,
  defaultStyleForTtsVoice,
  ELEVENLABS_DEFAULT_VOICE_ID,
  elevenlabsSampleVoiceCatalog,
  mergeElevenlabsVoiceCatalog,
  normalizeElevenlabsVoiceRow,
  normalizeTypecastVoiceRow,
  parseBareVoiceId,
  shotformTtsApiKey,
  formatVoiceLoadError,
  isElevenlabsVoicesReadError,
  synthesizeTtsLine,
  synthesizeTtsPreview,
  supertonicBuiltinVoiceCatalog,
  ttsApiKeyMissingMessage,
  ttsProviderFromVoiceId,
  type ShotformTtsVoice,
  type TtsProviderId,
} from "@/lib/shotform-tts-providers"
import { labelSupertonicVoice } from "@/lib/supertonic-local"
import { ensureSupertonicReady } from "@/lib/supertonic-ensure-client"
import { fetchSupertonicVoices } from "@/lib/supertonic-runtime-client"
import {
  buildLineSubtitleSchedule,
  fillScriptOverridesForAllCuts,
  narrationSegmentsFromAutoEdit,
  resolveSceneNarrationText,
  narrationTotalSec,
  sceneIndexAtTime,
  subtitleFromSchedule,
} from "@/lib/shotform-mvp-edit-script"
import {
  cutVisualHintForSegment,
  formatSceneDescriptionHint,
  needsAiNarrationFromScenes,
  sanitizeProductNameForNarration,
} from "@/lib/shotform-cut-narration"
import {
  ensureRewriteDiffersFromPrevious,
} from "@/lib/shotform-narration-script-quality"
import {
  normalizeUserSourceKeywords,
  resolveNarrationSourceKeywords,
} from "@/lib/shotform-user-keyword-product"
import { analysisByVideoId } from "@/lib/shotform-visual-scene-match"
import { sanitizeNarrationForOutput } from "@/lib/shotform-natural-shorts-script"
import type {
  MvpStudioPersistData,
  MvpStudioPhase,
  MvpScriptStyleState,
  MvpStudioSeoMeta,
  MvpThumbnailHookingText,
  MvpThumbnailVariant,
} from "@/lib/mvp-studio-types"
import { emptyMvpStudioSeoMeta } from "@/lib/mvp-studio-seo"
import { normalizePlacedOverlays } from "@/lib/mvp-overlay-utils"
import type { PlacedStudioOverlay } from "@/lib/shotform-studio-overlay-catalog"
import {
  normalizeMvpEffectClips,
  normalizeStudioPhase,
  normalizeSubtitleStyle,
  scriptStyleFromBundle,
  type MvpBgmClip,
  type MvpEffectClip,
  type MvpSubtitleStyle,
} from "@/lib/mvp-studio-types"
import { MvpPreviewAudioLayers } from "@/lib/mvp-preview-audio-mix"
import {
  normalizeMvpVideoSourceTransforms,
  type MvpVideoSourceTransforms,
} from "@/lib/mvp-video-source-transform"
import {
  deleteMvpThumbnail,
  loadMvpEditMp4,
  loadMvpTtsAudio,
  saveMvpEditMp4,
  saveMvpTtsAudio,
  saveMvpThumbnail,
} from "@/lib/mvp-local-media-cache"
import { assertPreviewMp4Blob, probeVideoElementPlayable } from "@/lib/mvp-mp4-preview"
import { autoEditDownloadUrl } from "@/lib/shotform-auto-edit-download"
import { resolveLocalCompanionMp4 } from "@/lib/shotform-local-companion-client"
import { MvpCapCutEditor } from "./MvpCapCutEditor"
import { MvpExportPanel } from "./MvpExportPanel"
import { MvpScriptStyleEditor } from "./MvpScriptStyleEditor"
import { MvpStudioStepNav } from "./MvpStudioStepNav"
import { MvpThumbnailGenerator } from "./MvpThumbnailGenerator"
import { MvpInsertClipDialog, type InsertClipChoice } from "./MvpInsertClipDialog"
import { MvpBlankFillTrimDialog } from "./MvpBlankFillTrimDialog"
import {
  fillBlankCutWithClip,
  insertClipIntoEditPlan,
  shiftScriptOverridesForInsert,
} from "@/lib/mvp-edit-plan-insert"
import {
  clearMvpInsertClipDrag,
  peekMvpInsertClipDrag,
} from "@/lib/mvp-insert-clip-drag"
import { splitEditPlanAtOutputTime, convertEditPlanCutToBlank, isEditPlanBlank, removeEditPlanCut, reorderEditPlanCut } from "@/lib/mvp-edit-plan-split"
import {
  appendRemixMediaToForm,
  throwIfRemixFfmpegFailed,
} from "@/lib/mvp-upload-blob-for-ffmpeg"
import styles from "./MvpPostEditStudio.module.css"
import { useEditorChromeSlot } from "../components/ShotFormEditorDialogShell"

const LOCAL_WORK_DIR_STORAGE_KEY = "shotform_local_work_dir"

type Props = {
  projectId: string
  projectName: string
  result: AutoEditJobResult
  /** 1단계 사용자 입력 키워드 — 대본 제품 정체성 기준 */
  sourceKeywords?: string[]
  videoBlobUrl: string | null
  /** 리믹스 직후 메모리 blob — IndexedDB 저장 전에도 미리보기 */
  videoBlob?: Blob | null
  scriptOverrides?: Record<string, string>
  onScriptOverridesChange?: (overrides: Record<string, string>) => void
  studioPersist?: MvpStudioPersistData
  onStudioPersistChange?: (data: MvpStudioPersistData) => void
  onClose?: () => void
  active?: boolean
  detailMode?: boolean
  /** 리믹스에 쓴 픽 (하위 호환) */
  editPicks?: AutoEditPick[]
  /**
   * 키워드 검색으로 가져온 전체 영상 소스(샤오홍슈·도우인).
   * 추가 영상 팝업에 표시. 없으면 editPicks로 폴백.
   */
  sourceLibraryPicks?: AutoEditPick[]
  /** 컷 삽입 후 editPlan·메타 갱신 */
  onResultChange?: (result: AutoEditJobResult, videoBlob?: Blob | null) => void
}

function shotformOpenAIKey(): string {
  if (typeof window === "undefined") return ""
  return (localStorage.getItem("shotform_openai_api_key") || "").trim()
}

export function MvpPostEditStudio({
  projectId,
  projectName,
  result,
  sourceKeywords = [],
  videoBlobUrl,
  videoBlob = null,
  scriptOverrides: scriptOverridesProp = {},
  onScriptOverridesChange,
  studioPersist,
  onStudioPersistChange,
  onClose,
  active = true,
  detailMode = false,
  editPicks = [],
  sourceLibraryPicks,
  onResultChange,
}: Props) {
  const insertClipPicks =
    sourceLibraryPicks && sourceLibraryPicks.length > 0 ? sourceLibraryPicks : editPicks
  const [resultDraft, setResultDraft] = useState<AutoEditJobResult | null>(null)
  useEffect(() => {
    setResultDraft(null)
  }, [result.jobId])
  const liveResult = resultDraft ?? result

  const baseSegments = useMemo(() => narrationSegmentsFromAutoEdit(liveResult), [liveResult])

  const segmentVisualHints = useMemo(() => {
    const plan = liveResult.editPlan?.edit_plan
    if (!plan?.length) return [] as string[]
    const analyses = liveResult.analyses?.length
      ? liveResult.analyses
      : liveResult.analysis
        ? [liveResult.analysis]
        : []
    const byId = analysisByVideoId(analyses)
    return plan.map((seg) => {
      const hint = cutVisualHintForSegment(seg, byId.get(seg.video_id))
      return hint ? formatSceneDescriptionHint(hint) : ""
    })
  }, [liveResult])
  const [scriptOverrides, setScriptOverrides] = useState<Record<string, string>>(() =>
    fillScriptOverridesForAllCuts(baseSegments, scriptOverridesProp, segmentVisualHints)
  )
  /** AI 대본 생성 직후 스냅샷 — TTS 전 「원상복구」용 */
  const [scriptBaseline, setScriptBaseline] = useState<Record<string, string> | null>(null)
  const syncedOverridesJobIdRef = useRef<string | null>(null)

  /** 프로젝트(job) 전환 시에만 부모 overrides 복원 — 매 렌더마다 덮어쓰면 「대본만 다시쓰기」가 무효화됨 */
  useEffect(() => {
    if (syncedOverridesJobIdRef.current === result.jobId) return
    syncedOverridesJobIdRef.current = result.jobId
    setScriptOverrides(fillScriptOverridesForAllCuts(baseSegments, scriptOverridesProp, segmentVisualHints))
  }, [result.jobId, scriptOverridesProp, baseSegments])

  // 프로젝트 로드 시 저장된 AI 대본을 원상복구 기준으로 한 번만 잡음
  useEffect(() => {
    setScriptBaseline(null)
  }, [result.jobId])

  useEffect(() => {
    if (scriptBaseline) return
    if (!Object.keys(scriptOverridesProp).length) return
    if (needsAiNarrationFromScenes(liveResult, scriptOverridesProp)) return
    setScriptBaseline(fillScriptOverridesForAllCuts(baseSegments, scriptOverridesProp, segmentVisualHints))
  }, [liveResult, scriptOverridesProp, baseSegments, scriptBaseline])

  const updateOverride = useCallback(
    (sceneId: number, text: string) => {
      setScriptOverrides((prev) => {
        const next = { ...prev, [String(sceneId)]: text }
        onScriptOverridesChange?.(next)
        return next
      })
    },
    [onScriptOverridesChange]
  )

  const segments = useMemo(
    () =>
      baseSegments.map((seg, i) => ({
        ...seg,
        text: resolveSceneNarrationText(i, baseSegments, scriptOverrides, segmentVisualHints[i]),
      })),
    [baseSegments, scriptOverrides, segmentVisualHints]
  )

  /** 벤치마크 장면 맞춤 — 컷별 TTS 배속 + 음성에 맞춰 영상 자르기 */
  const [sceneFitEnabled, setSceneFitEnabled] = useState(
    () => studioPersist?.sceneFitEnabled !== false
  )
  const [sceneSpeeds, setSceneSpeeds] = useState<number[] | null>(
    () => (studioPersist?.sceneSpeeds?.length ? studioPersist.sceneSpeeds : null)
  )
  const [audioFitEnds, setAudioFitEnds] = useState<number[] | null>(
    () => (studioPersist?.audioFitEnds?.length ? studioPersist.audioFitEnds : null)
  )

  /** 미리보기·내보내기용 — 음성에 맞춰 자른 컷 end 반영 */
  const playbackSegments = useMemo(
    () => applyAudioFitEnds(segments, audioFitEnds),
    [segments, audioFitEnds]
  )

  const scriptNeedsAi = useMemo(
    () => needsAiNarrationFromScenes(liveResult, scriptOverrides),
    [liveResult, scriptOverrides]
  )
  const totalSec = useMemo(() => narrationTotalSec(segments), [segments])

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fetchedBlobRef = useRef<string | null>(null)
  const mp4BlobRef = useRef<Blob | null>(null)

  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string | null>(videoBlobUrl)
  const [videoLoading, setVideoLoading] = useState(false)

  const [playhead, setPlayhead] = useState(0)
  const [audioPlayhead, setAudioPlayhead] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [videoDuration, setVideoDuration] = useState(totalSec || 30)

  const [subtitleStyle, setSubtitleStyle] = useState<MvpSubtitleStyle>(() =>
    normalizeSubtitleStyle(studioPersist?.subtitleStyle)
  )
  const [placedOverlays, setPlacedOverlays] = useState<PlacedStudioOverlay[]>(() =>
    normalizePlacedOverlays(studioPersist?.placedOverlays)
  )

  const [voiceCatalog, setVoiceCatalog] = useState<Record<TtsProviderId, ShotformTtsVoice[]>>({
    supertone: [],
    supertonic: supertonicBuiltinVoiceCatalog(),
    elevenlabs: elevenlabsSampleVoiceCatalog(),
    typecast: [],
  })
  const [voicesLoading, setVoicesLoading] = useState<Record<TtsProviderId, boolean>>({
    supertone: false,
    supertonic: false,
    elevenlabs: false,
    typecast: false,
  })
  const [voiceLoadErrors, setVoiceLoadErrors] = useState<Record<TtsProviderId, string | null>>({
    supertone: null,
    supertonic: null,
    elevenlabs: null,
    typecast: null,
  })
  const [voiceListUnavailable, setVoiceListUnavailable] = useState<Record<TtsProviderId, boolean>>({
    supertone: false,
    supertonic: false,
    elevenlabs: false,
    typecast: false,
  })
  const skipVoiceListLoadRef = useRef<Set<TtsProviderId>>(new Set())
  const [selectedVoiceId, setSelectedVoiceId] = useState(studioPersist?.selectedVoiceId ?? "")
  const [supertoneStyle, setSupertoneStyle] = useState(studioPersist?.supertoneStyle ?? "neutral")
  const [speechSpeed, setSpeechSpeed] = useState(() => normalizeTtsSpeed(studioPersist?.speechSpeed))
  const [ttsGeneratedSpeed, setTtsGeneratedSpeed] = useState<number | null>(null)
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)

  const [ttsLoading, setTtsLoading] = useState(false)
  const [ttsProgress, setTtsProgress] = useState(0)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioKey, setAudioKey] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)
  /** decode로 확정한 TTS 길이 — HTMLAudio metadata가 짧게 나와도 덮어쓰지 않음 */
  const audioDurationKnownRef = useRef(0)
  const commitAudioDuration = useCallback((sec: number, mode: "replace" | "max" = "max") => {
    if (!Number.isFinite(sec) || sec <= 0.05) return
    if (mode === "replace") {
      audioDurationKnownRef.current = sec
      setAudioDuration(sec)
      return
    }
    const next = Math.max(audioDurationKnownRef.current, sec)
    audioDurationKnownRef.current = next
    setAudioDuration(next)
  }, [])
  const [voiceLineCues, setVoiceLineCues] = useState<VoiceLineCue[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [insertClipOpen, setInsertClipOpen] = useState(false)
  const [insertClipBusy, setInsertClipBusy] = useState(false)
  const [timelineEditBusy, setTimelineEditBusy] = useState(false)
  const [blankFillEditor, setBlankFillEditor] = useState<{
    blob: Blob
    previewUrl: string
    label: string
    blankIndex: number
    blankDurationSec: number
  } | null>(null)
  const undoStackRef = useRef<
    Array<{
      result: AutoEditJobResult
      videoBlob: Blob | null
      voiceLineCues: VoiceLineCue[] | null
      scriptOverrides: Record<string, string>
      videoSourceTransforms: MvpVideoSourceTransforms
    }>
  >([])
  const cutClipboardRef = useRef<{
    label: string
    durationSec: number
    reason?: string
  } | null>(null)

  const [scriptGenerating, setScriptGenerating] = useState(false)
  const [scriptRevision, setScriptRevision] = useState(0)
  const [phase, setPhase] = useState<MvpStudioPhase>(() => normalizeStudioPhase(studioPersist?.phase))

  const restoreScriptBaseline = useCallback(() => {
    if (!scriptBaseline) {
      setErr("복구할 AI 대본 원본이 없습니다. 먼저 「AI 대본」을 생성해 주세요.")
      return
    }
    if (audioUrl || voiceLineCues?.length) {
      setErr("TTS가 이미 생성된 뒤에는 원상복구를 사용할 수 없습니다.")
      return
    }
    const restored = fillScriptOverridesForAllCuts(baseSegments, scriptBaseline, segmentVisualHints)
    setScriptOverrides(restored)
    setScriptRevision((r) => r + 1)
    onScriptOverridesChange?.(restored)
    setErr(null)
  }, [
    scriptBaseline,
    audioUrl,
    voiceLineCues,
    baseSegments,
    onScriptOverridesChange,
  ])

  const canRestoreScript =
    Boolean(scriptBaseline) && !audioUrl && !voiceLineCues?.length && !scriptGenerating
  const scriptDirtyFromBaseline = useMemo(() => {
    if (!scriptBaseline) return false
    const current = fillScriptOverridesForAllCuts(baseSegments, scriptOverrides, segmentVisualHints)
    return JSON.stringify(current) !== JSON.stringify(scriptBaseline)
  }, [scriptBaseline, baseSegments, scriptOverrides])

  const [scriptStyle, setScriptStyle] = useState<MvpScriptStyleState>(() =>
    studioPersist?.scriptStyle ?? scriptStyleFromBundle(result.script?.bundle)
  )
  const [thumbnailGallery, setThumbnailGallery] = useState<MvpThumbnailVariant[]>(
    () => migrateThumbnailGallery(studioPersist).gallery
  )
  const [selectedThumbnailId, setSelectedThumbnailId] = useState<string | null>(
    () => migrateThumbnailGallery(studioPersist).selectedId
  )
  const [thumbnailHookingText, setThumbnailHookingText] = useState<MvpThumbnailHookingText>(
    () => studioPersist?.thumbnailHookingText ?? { line1: "", line2: "" }
  )
  const [thumbnailIntroOn, setThumbnailIntroOn] = useState(
    () =>
      studioPersist?.thumbnailIntroOn ??
      Boolean(migrateThumbnailGallery(studioPersist).selectedId)
  )
  const [seoMeta, setSeoMeta] = useState<MvpStudioSeoMeta>(
    () => studioPersist?.seoMeta ?? emptyMvpStudioSeoMeta()
  )
  const activeThumbnail = useMemo(
    () => selectedThumbnailVariant(thumbnailGallery, selectedThumbnailId),
    [thumbnailGallery, selectedThumbnailId]
  )
  const thumbnailUrl = activeThumbnail?.url ?? ""
  /** 장면별 TTS 원본 URL — 장면 재생 시 말꼬리까지 보장 */
  const sceneLineAudioUrlsRef = useRef<string[] | null>(null)
  /** 장면별 TTS 원본 URL (머지 전) — 씬 단위 재생성용 */
  const ttsLineUrlsRef = useRef<string[] | null>(null)
  const [sceneTtsLoadingIndex, setSceneTtsLoadingIndex] = useState<number | null>(null)
  const sceneSoloAudioRef = useRef<HTMLAudioElement | null>(null)
  const ttsBlobRef = useRef<Blob | null>(null)
  const fetchedTtsUrlRef = useRef<string | null>(null)
  const audioLayersRef = useRef<MvpPreviewAudioLayers | null>(null)
  if (!audioLayersRef.current) {
    audioLayersRef.current = new MvpPreviewAudioLayers()
  }
  /** play() Promise가 pause 이후 sync를 호출하지 않도록 */
  const previewPlayGenRef = useRef(0)
  /** React state보다 먼저 동기 반영 — rAF가 pause 직후 play() 다시 호출하는 것 방지 */
  const playingRef = useRef(false)
  /** 타임라인 빨간바/클릭 시크 중 — 자동 재생 방지 */
  const timelineScrubLockRef = useRef(false)
  const timelineScrubUnlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewClockRafRef = useRef<number | null>(null)
  const lastPreviewUiUpdateRef = useRef(0)

  const stopPreviewClock = useCallback(() => {
    if (previewClockRafRef.current != null) {
      cancelAnimationFrame(previewClockRafRef.current)
      previewClockRafRef.current = null
    }
  }, [])

  const [bgmClips, setBgmClips] = useState<MvpBgmClip[]>([])
  const [effectClips, setEffectClips] = useState<MvpEffectClip[]>(() =>
    normalizeMvpEffectClips(studioPersist?.effectClips, totalSec || 30)
  )
  const [videoSourceTransforms, setVideoSourceTransforms] = useState<MvpVideoSourceTransforms>(() =>
    normalizeMvpVideoSourceTransforms(studioPersist?.videoSourceTransforms)
  )
  const [editMp4CachedJobId, setEditMp4CachedJobId] = useState(studioPersist?.editMp4CachedJobId ?? "")
  const [editTtsCachedJobId, setEditTtsCachedJobId] = useState(studioPersist?.editTtsCachedJobId ?? "")
  const onStudioPersistChangeRef = useRef(onStudioPersistChange)
  onStudioPersistChangeRef.current = onStudioPersistChange
  const lastPersistKeyRef = useRef("")
  const thumbnailBlobUrlsRef = useRef<string[]>([])

  const revokeThumbnailBlobUrls = useCallback(() => {
    for (const url of thumbnailBlobUrlsRef.current) {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url)
    }
    thumbnailBlobUrlsRef.current = []
  }, [])

  useEffect(() => {
    return () => {
      revokeThumbnailBlobUrls()
    }
  }, [revokeThumbnailBlobUrls])

  const thumbnailPersistKey = useMemo(
    () =>
      safeJsonKey({
        gallery: studioPersist?.thumbnailGallery,
        selectedId: studioPersist?.selectedThumbnailId,
        url: studioPersist?.thumbnailUrl,
      }) ?? "",
    [studioPersist?.thumbnailGallery, studioPersist?.selectedThumbnailId, studioPersist?.thumbnailUrl]
  )

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    const migrated = migrateThumbnailGallery(studioPersist)
    void hydrateMvpThumbnailGallery(projectId, migrated.gallery).then((hydrated) => {
      if (cancelled) return
      setThumbnailGallery((prev) => {
        const merged = mergeHydratedThumbnailGallery(prev, hydrated)
        // 새로 만든 blob만 추적 — 이전 표시용 blob은 merge가 유지할 수 있어 revoke는 안전하게
        const keep = new Set(
          merged.map((v) => v.url).filter((u) => u.startsWith("blob:"))
        )
        for (const url of thumbnailBlobUrlsRef.current) {
          if (url.startsWith("blob:") && !keep.has(url)) URL.revokeObjectURL(url)
        }
        thumbnailBlobUrlsRef.current = [...keep]
        return merged
      })
      setSelectedThumbnailId((prev) => {
        const still = migrated.selectedId
        if (still) return still
        return prev
      })
    })
    return () => {
      cancelled = true
    }
  }, [projectId, result.jobId, thumbnailPersistKey])

  useEffect(() => {
    setEditMp4CachedJobId(studioPersist?.editMp4CachedJobId ?? "")
    setEditTtsCachedJobId(studioPersist?.editTtsCachedJobId ?? "")
    setScriptStyle(studioPersist?.scriptStyle ?? scriptStyleFromBundle(result.script?.bundle))
    setVoiceLineCues(studioPersist?.voiceLineCues?.length ? studioPersist.voiceLineCues : null)
    setPhase(normalizeStudioPhase(studioPersist?.phase))
    if (studioPersist?.selectedVoiceId) setSelectedVoiceId(studioPersist.selectedVoiceId)
    if (studioPersist?.supertoneStyle) setSupertoneStyle(studioPersist.supertoneStyle)
    if (studioPersist?.speechSpeed != null) setSpeechSpeed(normalizeTtsSpeed(studioPersist.speechSpeed))
    setSceneFitEnabled(studioPersist?.sceneFitEnabled !== false)
    setSceneSpeeds(studioPersist?.sceneSpeeds?.length ? studioPersist.sceneSpeeds : null)
    setAudioFitEnds(studioPersist?.audioFitEnds?.length ? studioPersist.audioFitEnds : null)
    setTtsGeneratedSpeed(null)
    if (studioPersist?.subtitleStyle) {
      setSubtitleStyle(normalizeSubtitleStyle(studioPersist.subtitleStyle))
    }
    setPlacedOverlays(normalizePlacedOverlays(studioPersist?.placedOverlays))
    setThumbnailHookingText(studioPersist?.thumbnailHookingText ?? { line1: "", line2: "" })
    setThumbnailIntroOn(
      studioPersist?.thumbnailIntroOn ??
        Boolean(migrateThumbnailGallery(studioPersist).selectedId)
    )
    setSeoMeta(studioPersist?.seoMeta ?? emptyMvpStudioSeoMeta())
    // 배경음악 기능 제거 — 예전 저장분에 남아 있어도 복원하지 않음
    setBgmClips([])
    setEffectClips(normalizeMvpEffectClips(studioPersist?.effectClips, totalSec || 30))
    setVideoSourceTransforms(normalizeMvpVideoSourceTransforms(studioPersist?.videoSourceTransforms))
    if (fetchedTtsUrlRef.current) {
      URL.revokeObjectURL(fetchedTtsUrlRef.current)
      fetchedTtsUrlRef.current = null
    }
    setAudioUrl(null)
    audioDurationKnownRef.current = 0
    setAudioDuration(0)
    setAudioPlayhead(0)
    ttsBlobRef.current = null
    setAudioKey((k) => k + 1)
    lastPersistKeyRef.current = ""
    // eslint-disable-next-line react-hooks/exhaustive-deps -- jobId 변경 시에만 복원 (studioPersist는 해당 시점 스냅샷)
  }, [result.jobId])

  useEffect(() => {
    const payload: MvpStudioPersistData = {
      scriptOverrides,
      subtitleStyle,
      placedOverlays: placedOverlays.length ? placedOverlays : undefined,
      scriptStyle,
      thumbnailUrl: thumbnailUrl || undefined,
      thumbnailHookingText:
        thumbnailHookingText.line1 || thumbnailHookingText.line2 ? thumbnailHookingText : undefined,
      thumbnailGallery: thumbnailGallery.length ? thumbnailGallery : undefined,
      selectedThumbnailId: selectedThumbnailId ?? undefined,
      thumbnailIntroOn: thumbnailUrl ? thumbnailIntroOn : undefined,
      seoMeta:
        seoMeta.title ||
        seoMeta.description ||
        seoMeta.tags.length ||
        seoMeta.hashtags.length
          ? seoMeta
          : undefined,
      voiceLineCues: voiceLineCues ?? undefined,
      selectedVoiceId,
      supertoneStyle,
      speechSpeed,
      sceneFitEnabled,
      sceneSpeeds: sceneSpeeds ?? undefined,
      audioFitEnds: audioFitEnds ?? undefined,
      phase,
      editMp4CachedJobId: editMp4CachedJobId || undefined,
      editTtsCachedJobId: editTtsCachedJobId || undefined,
      bgmClips: undefined,
      effectClips: effectClips.length ? effectClips : undefined,
      videoSourceTransforms: Object.keys(videoSourceTransforms).length
        ? videoSourceTransforms
        : undefined,
    }

    let cancelled = false
    void (async () => {
      await cacheMvpThumbnailGalleryForSave(projectId, payload.thumbnailGallery)
      if (cancelled) return

      const slimmed = slimStudioPersistForSave(payload)
      const key = safeJsonKey(slimmed)
      if (!key) {
        console.warn("[MvpPostEditStudio] persist payload too large — skipped")
        return
      }
      if (key === lastPersistKeyRef.current) return
      lastPersistKeyRef.current = key
      onStudioPersistChangeRef.current?.(slimmed)
    })()

    return () => {
      cancelled = true
    }
  }, [
    scriptOverrides,
    subtitleStyle,
    placedOverlays,
    scriptStyle,
    thumbnailUrl,
    thumbnailGallery,
    selectedThumbnailId,
    thumbnailHookingText,
    thumbnailIntroOn,
    seoMeta,
    voiceLineCues,
    selectedVoiceId,
    supertoneStyle,
    speechSpeed,
    sceneFitEnabled,
    sceneSpeeds,
    audioFitEnds,
    phase,
    editMp4CachedJobId,
    editTtsCachedJobId,
    bgmClips,
    effectClips,
    videoSourceTransforms,
    projectId,
  ])

  useEffect(() => {
    // 배경음악 재생 비활성 — 항상 빈 설정
    audioLayersRef.current?.updateConfig([])
  }, [])

  useEffect(() => {
    audioLayersRef.current?.updateEffects(effectClips)
  }, [effectClips])

  useEffect(() => {
    return () => {
      audioLayersRef.current?.dispose()
    }
  }, [])

  const loadVoicesForProvider = useCallback(async (provider: TtsProviderId) => {
    if (skipVoiceListLoadRef.current.has(provider)) return

    // 수퍼토닉3는 로컬 서버 — 없으면 자동 설치·기동 후 보이스 목록 조회
    if (provider === "supertonic") {
      setVoicesLoading((prev) => ({ ...prev, supertonic: true }))
      setVoiceLoadErrors((prev) => ({ ...prev, supertonic: null }))
      try {
        const ensured = await ensureSupertonicReady({
          onProgress: (s) => {
            if (s.message && !s.online) {
              setVoiceLoadErrors((prev) => ({ ...prev, supertonic: s.message || null }))
            }
          },
        })
        if (!ensured.online && ensured.phase === "error") {
          setVoiceLoadErrors((prev) => ({
            ...prev,
            supertonic:
              ensured.message ||
              "Supertonic 자동 설치·기동에 실패했습니다. Python 3 설치 후 다시 시도하세요.",
          }))
        } else if (ensured.online) {
          setVoiceLoadErrors((prev) => ({ ...prev, supertonic: null }))
        }

        const [voicesRes, recordedRes] = await Promise.all([
          fetchSupertonicVoices(),
          fetch("/api/supertonic-recorded"),
        ])
        const voicesData = (await voicesRes.json().catch(() => ({}))) as {
          success?: boolean
          online?: boolean
          voices?: Array<{ voice_id?: string; name?: string; gender?: string; kind?: string }>
          error?: string
          note?: string
        }
        const recordedData = (await recordedRes.json().catch(() => ({}))) as {
          voices?: Array<{ voice_id?: string; name?: string }>
        }

        const fromApi = Array.isArray(voicesData.voices) ? voicesData.voices : []
        const list: ShotformTtsVoice[] = []
        const seen = new Set<string>()
        const push = (voice_id: string, name?: string, gender?: string) => {
          const id = voice_id.trim()
          if (!id || seen.has(id)) return
          seen.add(id)
          const meta = labelSupertonicVoice(id)
          list.push({
            voice_id: id,
            name: name?.trim() || meta.name,
            gender: gender || meta.gender,
          })
        }

        for (const v of fromApi) {
          if (v?.voice_id) push(String(v.voice_id), v.name, v.gender)
        }
        for (const v of Array.isArray(recordedData.voices) ? recordedData.voices : []) {
          if (v?.voice_id) push(String(v.voice_id), v.name)
        }
        if (!list.length) {
          for (const v of supertonicBuiltinVoiceCatalog()) {
            push(v.voice_id, v.name, v.gender)
          }
        }

        setVoiceCatalog((prev) => ({ ...prev, supertonic: list }))

        if (!ensured.online && voicesData.online === false) {
          setVoiceLoadErrors((prev) => ({
            ...prev,
            supertonic:
              ensured.message ||
              voicesData.note ||
              "로컬 Supertonic 기동에 실패했습니다. Python 설치 후 다시 시도하세요.",
          }))
        }

        if (list[0]) {
          setSelectedVoiceId((prev) => {
            if (ttsProviderFromVoiceId(prev) !== "supertonic") return prev
            const bare = parseBareVoiceId(prev)?.bareId ?? ""
            if (list.some((r) => r.voice_id === bare)) return prev
            if (bare) return prev
            return buildTtsVoiceKey("supertonic", list[0]!.voice_id)
          })
        }
      } catch (e) {
        const raw = e instanceof Error ? e.message : "수퍼토닉3 목소리 목록을 불러오지 못했습니다."
        setVoiceCatalog((prev) => ({
          ...prev,
          supertonic: prev.supertonic.length ? prev.supertonic : supertonicBuiltinVoiceCatalog(),
        }))
        setVoiceLoadErrors((prev) => ({
          ...prev,
          supertonic: formatVoiceLoadError("supertonic", raw),
        }))
      } finally {
        setVoicesLoading((prev) => ({ ...prev, supertonic: false }))
      }
      return
    }

    const key = shotformTtsApiKey(provider)
    if (!key) {
      setVoiceLoadErrors((prev) => ({
        ...prev,
        [provider]: ttsApiKeyMissingMessage(provider),
      }))
      return
    }
    setVoicesLoading((prev) => ({ ...prev, [provider]: true }))
    setVoiceLoadErrors((prev) => ({ ...prev, [provider]: null }))
    try {
      const endpoint =
        provider === "supertone"
          ? `/api/supertone-voices?apiKey=${encodeURIComponent(key)}`
          : provider === "elevenlabs"
            ? `/api/elevenlabs-voices?apiKey=${encodeURIComponent(key)}`
            : `/api/typecast-voices?apiKey=${encodeURIComponent(key)}`

      const res = await fetch(endpoint)
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean
        voices?: unknown[]
        error?: string
        code?: string
      }
      if (!res.ok || data.success === false) {
        const errText = data.error || `목소리 목록 실패 (${res.status})`
        if (provider === "elevenlabs" && isElevenlabsVoicesReadError(errText, data.code)) {
          skipVoiceListLoadRef.current.add("elevenlabs")
          setVoiceListUnavailable((prev) => ({ ...prev, elevenlabs: true }))
          setVoiceCatalog((prev) => ({ ...prev, elevenlabs: elevenlabsSampleVoiceCatalog() }))
          setVoiceLoadErrors((prev) => ({ ...prev, elevenlabs: null }))
          return
        }
        throw new Error(errText)
      }

      const raw = Array.isArray(data.voices) ? data.voices : []
      let list: ShotformTtsVoice[] = []
      if (provider === "supertone") {
        list = filterSupertoneKoreanVoices(
          raw.map((v) => normalizeSupertoneVoiceRow(v as Record<string, unknown>))
        )
        if (!list.length && raw.length > 0) {
          setVoiceLoadErrors((prev) => ({
            ...prev,
            supertone: "한국어 지원 수퍼톤 목소리가 없습니다. API 키·계정을 확인해 주세요.",
          }))
        }
      } else if (provider === "elevenlabs") {
        const apiList = raw
          .map((v) => normalizeElevenlabsVoiceRow(v as Record<string, unknown>))
          .filter((v) => v.voice_id)
        list = mergeElevenlabsVoiceCatalog(apiList)
      } else {
        list = raw
          .map((v) => normalizeTypecastVoiceRow(v as Record<string, unknown>))
          .filter((v): v is ShotformTtsVoice => Boolean(v))
      }

      setVoiceCatalog((prev) => ({ ...prev, [provider]: list }))

      if (list[0]) {
        setSelectedVoiceId((prev) => {
          if (ttsProviderFromVoiceId(prev) !== provider) return prev
          const bare = parseBareVoiceId(prev)?.bareId ?? ""
          if (list.some((r) => r.voice_id === bare)) return prev
          if (bare) return prev
          return buildTtsVoiceKey(provider, list[0]!.voice_id)
        })
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : `${provider} 목소리 목록을 불러오지 못했습니다.`
      if (provider === "elevenlabs" && isElevenlabsVoicesReadError(raw)) {
        skipVoiceListLoadRef.current.add("elevenlabs")
        setVoiceListUnavailable((prev) => ({ ...prev, elevenlabs: true }))
        setVoiceCatalog((prev) => ({ ...prev, elevenlabs: elevenlabsSampleVoiceCatalog() }))
        setVoiceLoadErrors((prev) => ({ ...prev, elevenlabs: null }))
        return
      }
      const message = formatVoiceLoadError(provider, raw)
      if (message) {
        setVoiceLoadErrors((prev) => ({
          ...prev,
          [provider]: message,
        }))
      }
    } finally {
      setVoicesLoading((prev) => ({ ...prev, [provider]: false }))
    }
  }, [])

  const previewVoice = useCallback(async (voiceId: string, style: string) => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause()
      previewAudioRef.current = null
    }

    setPreviewingVoiceId(voiceId)
    setErr(null)
    try {
      const audioUrl = await synthesizeTtsPreview(voiceId, style, speechSpeed)
      const audio = new Audio(audioUrl)
      previewAudioRef.current = audio
      audio.onended = () => {
        setPreviewingVoiceId(null)
        previewAudioRef.current = null
      }
      audio.onerror = () => {
        setPreviewingVoiceId(null)
        previewAudioRef.current = null
      }
      await audio.play()
    } catch (e) {
      setPreviewingVoiceId(null)
      previewAudioRef.current = null
      setErr(e instanceof Error ? e.message : "목소리 미리듣기 실패")
    }
  }, [speechSpeed])

  const handleVoiceIdChange = useCallback(
    (id: string) => {
      setSelectedVoiceId(id)
      const parsed = parseBareVoiceId(id)
      if (!parsed) return
      const voice =
        voiceCatalog[parsed.provider]?.find((v) => buildTtsVoiceKey(parsed.provider, v.voice_id) === id) ??
        voiceCatalog[parsed.provider]?.find((v) => v.voice_id === parsed.bareId) ??
        null
      setSupertoneStyle(defaultStyleForTtsVoice(parsed.provider, voice))
    },
    [voiceCatalog]
  )

  const clearTtsAfterScriptChange = useCallback(() => {
    if (fetchedTtsUrlRef.current) {
      URL.revokeObjectURL(fetchedTtsUrlRef.current)
      fetchedTtsUrlRef.current = null
    }
    if (sceneLineAudioUrlsRef.current?.length) {
      for (const u of sceneLineAudioUrlsRef.current) {
        if (u.startsWith("blob:")) URL.revokeObjectURL(u)
      }
      sceneLineAudioUrlsRef.current = null
    }
    if (ttsLineUrlsRef.current?.length) {
      for (const u of ttsLineUrlsRef.current) {
        if (u.startsWith("blob:")) URL.revokeObjectURL(u)
      }
      ttsLineUrlsRef.current = null
    }
    sceneSoloAudioRef.current?.pause()
    sceneSoloAudioRef.current = null
    sceneSoloMetaRef.current = null
    ttsBlobRef.current = null
    setAudioUrl(null)
    setAudioKey((k) => k + 1)
    audioDurationKnownRef.current = 0
    setAudioDuration(0)
    setVoiceLineCues(null)
    setEditTtsCachedJobId("")
    setPlaying(false)
  }, [])

  const generateNarrationScript = useCallback(async (opts?: {
    rewrite?: boolean
    /** 자동 연쇄 다시쓰기 — 확인창 생략 */
    autoChain?: boolean
    skipAutoRewrite?: boolean
  }) => {
    const rewrite = Boolean(opts?.rewrite)
    const openai = shotformOpenAIKey()
    if (!openai) {
      setErr("ShotForm 설정에 OpenAI API 키(shotform_openai_api_key)를 저장해 주세요.")
      return
    }
    if (rewrite && audioUrl && !opts?.autoChain) {
      const ok = window.confirm(
        "대본을 다시 쓰면 기존 TTS·자막 싱크가 초기화됩니다.\n영상은 그대로 두고 대본만 새로 작성할까요?"
      )
      if (!ok) return
    }
    setScriptGenerating(true)
    setErr(null)
    let chainAutoRewrite = false
    try {
      const currentScripts = fillScriptOverridesForAllCuts(baseSegments, scriptOverrides, segmentVisualHints)
      const userKeywords = resolveNarrationSourceKeywords(sourceKeywords, result.sourceKeywords)
      const rewriteNonce = rewrite ? Date.now() : undefined
      const res = await fetch("/api/shotform/mvp-narration-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openaiApiKey: openai,
          result,
          projectName,
          sourceKeywords: userKeywords.length ? userKeywords : undefined,
          mode: rewrite ? "rewrite" : "generate",
          previousScripts: rewrite ? currentScripts : undefined,
          rewriteNonce,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        overrides?: Record<string, string>
        lines?: string[]
        scriptExtras?: {
          thumbnailTitle?: string
          headcopies?: string[][]
          commentKeyword?: string
          youtubeDescription?: string
          seoTags?: string
          tiktokCaption?: string
          instagramCaption?: string
        }
        naturalShorts?: boolean
        error?: string
      }
      if (!res.ok) throw new Error(data.error || "AI 대본 생성 실패")

      const rawOverrides =
        data.overrides && Object.keys(data.overrides).length
          ? data.overrides
          : data.lines?.length
            ? Object.fromEntries(data.lines.map((line, i) => [String(i + 1), line]))
            : null
      if (!rawOverrides || !Object.keys(rawOverrides).length) {
        throw new Error("AI가 대본을 반환하지 않았습니다. 잠시 후 다시 시도해 주세요.")
      }

      const beforeJson = JSON.stringify(fillScriptOverridesForAllCuts(baseSegments, scriptOverrides, segmentVisualHints))
      let formatted = fillScriptOverridesForAllCuts(baseSegments, rawOverrides, segmentVisualHints)
      let afterJson = JSON.stringify(formatted)

      if (rewrite && beforeJson === afterJson) {
        const visualBlob = segmentVisualHints.join("\n")
        const productName =
          sanitizeProductNameForNarration(
            userKeywords[0] || result.productAnalysis?.productName || projectName,
            {
              category: result.productAnalysis?.category,
              summary: result.productAnalysis?.summary,
              visualHint: `${userKeywords.join(" ")}\n${visualBlob}`,
              userKeywords,
            }
          ) || projectName || "제품"
        const contexts = baseSegments.map((seg, i) => ({
          visual_card: segmentVisualHints[i] || seg.text,
          duration:
            Number(narrationSegmentDuration(seg)) ||
            Math.max(0.5, (seg.end ?? 0) - (seg.start ?? 0)),
        }))
        const forced = ensureRewriteDiffersFromPrevious(
          baseSegments.map((_, i) => formatted[String(i + 1)] ?? ""),
          currentScripts,
          contexts,
          productName,
          (rewriteNonce ?? Date.now()) % 9000 + 201
        )
        formatted = fillScriptOverridesForAllCuts(
          baseSegments,
          Object.fromEntries(forced.map((line, i) => [String(i + 1), line])),
          segmentVisualHints
        )
        afterJson = JSON.stringify(formatted)
      }

      setScriptOverrides(formatted)
      setScriptBaseline({ ...formatted })
      setScriptRevision((r) => r + 1)
      onScriptOverridesChange?.(formatted)
      autoScriptRequestedRef.current = result.jobId

      if (rewrite && beforeJson === afterJson) {
        setErr("생성된 대본이 이전과 동일합니다. 잠시 후 다시 「대본만 다시쓰기」를 눌러 주세요.")
      } else if (rewrite) {
        setErr(null)
      }

      if (data.naturalShorts && data.scriptExtras) {
        const conversionScript = (data.lines ?? Object.values(formatted)).join("\n")
        const headcopies =
          data.scriptExtras.headcopies?.length
            ? data.scriptExtras.headcopies
            : [["", ""]]
        setScriptStyle((prev) => ({
          ...prev,
          conversionScript,
          storytellingScript: conversionScript,
          headcopies,
          commentKeyword: data.scriptExtras?.commentKeyword || prev.commentKeyword,
        }))
        const hook = headcopies[0]
        if (hook?.[0] || hook?.[1] || data.scriptExtras.thumbnailTitle) {
          setThumbnailHookingText({
            line1: hook?.[0] || data.scriptExtras.thumbnailTitle || "",
            line2: hook?.[1] || data.scriptExtras.thumbnailTitle || "",
          })
        }
      }
      if (rewrite || audioUrl || voiceLineCues?.length) {
        clearTtsAfterScriptChange()
      }
      if (rewrite) {
        setPhase("edit")
      }

      /** 첫 생성 직후 자동으로 「대본만 다시쓰기」 1회 — 수동 클릭 시와 동일한 고품질 경로 */
      if (!rewrite && !opts?.skipAutoRewrite) {
        chainAutoRewrite = true
      }
    } catch (e) {
      if (!opts?.rewrite) autoScriptRequestedRef.current = null
      setErr(e instanceof Error ? e.message : rewrite ? "대본 다시쓰기 실패" : "AI 대본 생성 실패")
    } finally {
      if (!chainAutoRewrite) setScriptGenerating(false)
    }

    if (chainAutoRewrite) {
      await generateNarrationScript({ rewrite: true, autoChain: true, skipAutoRewrite: true })
    }
  }, [
    result,
    onScriptOverridesChange,
    baseSegments,
    scriptOverrides,
    audioUrl,
    voiceLineCues,
    clearTtsAfterScriptChange,
    projectName,
    segmentVisualHints,
    sourceKeywords,
  ])

  const autoScriptRequestedRef = useRef<string | null>(null)

  useEffect(() => {
    autoScriptRequestedRef.current = null
  }, [result.jobId])

  useEffect(() => {
    if (scriptGenerating) return
    if (Object.keys(scriptOverridesProp).length > 0) return
    if (!needsAiNarrationFromScenes(result, scriptOverridesProp)) return
    if (!shotformOpenAIKey()) return
    if (autoScriptRequestedRef.current === result.jobId) return
    void generateNarrationScript()
  }, [result, scriptOverridesProp, scriptGenerating, generateNarrationScript])

  const markMp4Cached = useCallback((jobId: string) => {
    setEditMp4CachedJobId(jobId)
  }, [])

  const applyVideoBlob = useCallback(
    async (blob: Blob) => {
      await assertPreviewMp4Blob(blob)
      if (fetchedBlobRef.current) URL.revokeObjectURL(fetchedBlobRef.current)
      const url = URL.createObjectURL(blob)
      try {
        await probeVideoElementPlayable(url)
      } catch {
        /* blob URL은 유지 */
      }
      fetchedBlobRef.current = url
      mp4BlobRef.current = blob
      setResolvedVideoUrl(url)
      setErr(null)
      if (projectId && result.jobId) {
        try {
          await saveMvpEditMp4(projectId, result.jobId, blob)
          markMp4Cached(result.jobId)
        } catch (e) {
          // 미리보기 반영은 성공했는데 로컬 캐시 저장만 실패한 경우 — 오류로 보이지 않게
          console.warn("[applyVideoBlob] local MP4 cache save failed:", e)
        }
      }
    },
    [projectId, result.jobId, markMp4Cached]
  )

  const clearTtsForClipInsert = useCallback(() => {
    if (audioUrl?.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(audioUrl)
      } catch {
        /* ignore */
      }
    }
    ttsBlobRef.current = null
    setAudioUrl(null)
    setVoiceLineCues(null)
    setAudioDuration(0)
    audioDurationKnownRef.current = 0
  }, [audioUrl])

  const pushTimelineUndo = useCallback(() => {
    undoStackRef.current = [
      ...undoStackRef.current.slice(-24),
      {
        result: liveResult,
        videoBlob: mp4BlobRef.current,
        voiceLineCues: voiceLineCues ? voiceLineCues.map((c) => ({ ...c })) : null,
        scriptOverrides: { ...scriptOverrides },
        videoSourceTransforms: { ...videoSourceTransforms },
      },
    ]
  }, [liveResult, voiceLineCues, scriptOverrides, videoSourceTransforms])

  const handleTimelineUndo = useCallback(async () => {
    const prev = undoStackRef.current.pop()
    if (!prev) {
      setErr("되돌릴 편집이 없습니다. (Ctrl+Z)")
      return
    }
    setScriptOverrides(prev.scriptOverrides)
    onScriptOverridesChange?.(prev.scriptOverrides)
    setVoiceLineCues(prev.voiceLineCues)
    setVideoSourceTransforms(prev.videoSourceTransforms)
    setResultDraft(prev.result)
    onResultChange?.(prev.result, prev.videoBlob)
    if (prev.videoBlob && prev.videoBlob.size >= 1000) {
      await applyVideoBlob(prev.videoBlob)
    }
    setErr("Ctrl+Z — 직전 타임라인 편집을 되돌렸습니다.")
  }, [onScriptOverridesChange, onResultChange, applyVideoBlob])

  const handleInsertClipConfirm = useCallback(
    async (choice: InsertClipChoice): Promise<boolean> => {
      setInsertClipBusy(true)
      setErr(null)
      let undoPushed = false
      try {
        // 공백 채우기·영상 추가는 TTS 타임라인이 잡힌 뒤에만 (먼저 넣으면 빈 대본으로 TTS 실패)
        if (!audioUrl || !voiceLineCues?.length) {
          throw new Error(
            "TTS를 먼저 생성한 뒤 「추가 영상」으로 공백을 채워 주세요."
          )
        }

        const mainBlob = mp4BlobRef.current
        if (!mainBlob || mainBlob.size < 1000) {
          throw new Error(
            "리믹스 영상 MP4가 아직 없습니다. 미리보기가 나온 뒤 다시 시도해 주세요."
          )
        }

        const fillingBlank =
          choice.replaceCutIndex != null &&
          choice.replaceCutIndex >= 0 &&
          isEditPlanBlank(liveResult.editPlan?.edit_plan?.[choice.replaceCutIndex] ?? null)

        // 공백 채우기는 TTS 유지. 끼워넣기만 TTS 초기화 확인.
        if (!fillingBlank && (audioUrl || voiceLineCues?.length)) {
          const ok = window.confirm(
            "이미 TTS가 있습니다. 클립을 넣으면 음성을 지우고 다시 만들어야 합니다. 계속할까요?"
          )
          if (!ok) {
            clearMvpInsertClipDrag()
            return false
          }
          clearTtsForClipInsert()
        }

        const videoId = `manual_insert_${Date.now()}`
        pushTimelineUndo()
        undoPushed = true
        const planned = fillingBlank
          ? fillBlankCutWithClip({
              result: liveResult,
              blankIndex: choice.replaceCutIndex!,
              clipDurationSec: choice.durationSec,
              videoId,
              reason: `공백 채움 · ${choice.label}`,
              visualCaption: choice.label,
            })
          : insertClipIntoEditPlan({
              result: liveResult,
              afterCutIndex: choice.afterCutIndex,
              clipDurationSec: choice.durationSec,
              videoId,
              reason: `수동 추가 · ${choice.label}`,
              visualCaption: choice.label,
            })

        const clipDurSec =
          fillingBlank && planned.replaceEndOutputSec != null
            ? Math.max(0.4, planned.replaceEndOutputSec - planned.insertAtOutputSec)
            : choice.durationSec

        setResultDraft(planned.result)

        const form = new FormData()
        await appendRemixMediaToForm(form, {
          blob: mainBlob,
          projectId,
          blobField: "video",
          urlField: "videoUrl",
          fileName: "main.mp4",
        })
        await appendRemixMediaToForm(form, {
          blob: choice.blob,
          projectId,
          blobField: "clip",
          urlField: "clipUrl",
          fileName: "clip.mp4",
        })
        form.append("insertAtSec", String(planned.insertAtOutputSec))
        form.append("clipDurationSec", String(clipDurSec))
        form.append("clipStartSec", String(Math.max(0, choice.trimStartSec || 0)))
        if (planned.replaceEndOutputSec != null) {
          form.append("replaceEndSec", String(planned.replaceEndOutputSec))
        }
        const mainDur =
          liveResult.outputDuration ||
          liveResult.editPlan?.edit_plan?.at(-1)?.output_end ||
          videoDuration ||
          0
        if (mainDur > 0.1) form.append("mainDurationSec", String(mainDur))

        const res = await fetch("/api/shotform/mvp-insert-clip", {
          method: "POST",
          body: form,
        })
        await throwIfRemixFfmpegFailed(res, "클립 합성")
        const outBlob = await res.blob()
        if (outBlob.size < 4096) throw new Error("합성된 영상이 비어 있습니다.")

        if (!fillingBlank) {
          const shifted = shiftScriptOverridesForInsert(
            scriptOverrides,
            planned.insertedCutIndex
          )
          setScriptOverrides(shifted)
          onScriptOverridesChange?.(shifted)
          setScriptBaseline(null)
          setScriptRevision((r) => r + 1)
        }

        setResultDraft(planned.result)

        onResultChange?.(planned.result, outBlob)
        await applyVideoBlob(outBlob)
        setInsertClipOpen(false)
        clearMvpInsertClipDrag()
        setErr(
          fillingBlank
            ? `공백(장면 ${planned.insertedCutIndex + 1})을 ${choice.durationSec}초 영상으로 채웠습니다.`
            : `장면 ${planned.insertedCutIndex + 1}에 ${choice.durationSec}초 클립을 넣었습니다. 대본을 채운 뒤 TTS를 생성하세요.`
        )
        return true
      } catch (e) {
        if (undoPushed) await handleTimelineUndo()
        setErr(e instanceof Error ? e.message : "추가 영상 넣기 실패")
        return false
      } finally {
        setInsertClipBusy(false)
      }
    },
    [
      liveResult,
      audioUrl,
      voiceLineCues,
      clearTtsForClipInsert,
      scriptOverrides,
      onScriptOverridesChange,
      onResultChange,
      applyVideoBlob,
      videoDuration,
      pushTimelineUndo,
      handleTimelineUndo,
      projectId,
    ]
  )

  const closeBlankFillEditor = useCallback(() => {
    setBlankFillEditor((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
      return null
    })
  }, [])

  const handleInsertClipDrop = useCallback(
    async (args: { afterCutIndex: number; replaceCutIndex?: number | null }) => {
      if (!audioUrl || !voiceLineCues?.length) {
        setErr("TTS를 먼저 생성한 뒤 「추가 영상」으로 공백을 채워 주세요.")
        clearMvpInsertClipDrag()
        return
      }
      const payload = peekMvpInsertClipDrag()
      if (!payload) {
        setErr("드래그한 영상 정보를 찾지 못했습니다. 팝업에서 다시 드래그해 주세요.")
        return
      }
      setErr(null)
      try {
        const blob = await payload.resolveBlob()
        clearMvpInsertClipDrag()

        // 공백 위 드롭 → 공백 길이 기준 트림 편집기
        if (args.replaceCutIndex != null && args.replaceCutIndex >= 0) {
          const blank = liveResult.editPlan?.edit_plan?.[args.replaceCutIndex]
          if (!isEditPlanBlank(blank)) {
            throw new Error("공백 컷 위에 놓아 주세요.")
          }
          const blankDur = Math.max(0.4, blank!.output_end - blank!.output_start)
          const previewUrl = URL.createObjectURL(blob)
          setBlankFillEditor((prev) => {
            if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
            return {
              blob,
              previewUrl,
              label: payload.label,
              blankIndex: args.replaceCutIndex!,
              blankDurationSec: blankDur,
            }
          })
          setInsertClipOpen(true)
          setErr(
            `공백 장면 ${args.replaceCutIndex + 1}(${blankDur.toFixed(1)}초) — 오른쪽에서 넣을 구간을 고르세요.`
          )
          return
        }

        // 일반 삽입 — 기존처럼 바로 넣기
        setInsertClipBusy(true)
        await handleInsertClipConfirm({
          blob,
          label: payload.label,
          durationSec: payload.durationSec,
          trimStartSec: payload.trimStartSec,
          afterCutIndex: args.afterCutIndex,
          replaceCutIndex: null,
        })
      } catch (e) {
        setErr(e instanceof Error ? e.message : "드래그로 영상 넣기 실패")
        setInsertClipBusy(false)
        clearMvpInsertClipDrag()
      }
    },
    [handleInsertClipConfirm, liveResult, audioUrl, voiceLineCues]
  )

  const handleSplitEditPlanClip = useCallback(
    (cutIndex: number, splitOutputSec: number) => {
      try {
        pushTimelineUndo()
        const split = splitEditPlanAtOutputTime({
          result: liveResult,
          cutIndex,
          splitOutputSec,
        })
        // 캡컷식: 영상만 앞/뒤. TTS는 시간축 유지(큐 쪼개지 않음).
        if (voiceLineCues?.length) {
          setVoiceLineCues(split.voiceLineCuesShift(voiceLineCues))
        }
        const shiftedScripts = split.scriptOverridesShift(scriptOverrides)
        setScriptOverrides(shiftedScripts)
        onScriptOverridesChange?.(shiftedScripts)
        setScriptBaseline(null)
        setScriptRevision((r) => r + 1)
        setVideoSourceTransforms((prev) => split.videoTransformsShift(prev))
        setResultDraft(split.result)
        onResultChange?.(split.result, mp4BlobRef.current)
        setErr(
          `컷 ${split.leftCutIndex + 1}을 잘랐습니다 → ${split.leftCutIndex + 1}·${split.rightCutIndex + 1}. ` +
            "앞/뒤 중 지울 쪽을 고른 뒤 Delete(자리 공백 유지). Ctrl+Z로 되돌릴 수 있습니다."
        )
      } catch (e) {
        setErr(e instanceof Error ? e.message : "자르기에 실패했습니다.")
      }
    },
    [
      liveResult,
      voiceLineCues,
      scriptOverrides,
      onScriptOverridesChange,
      onResultChange,
      pushTimelineUndo,
    ]
  )

  /** 선택 컷 → 공백 (Delete: 영상만 지우고 자리 유지) */
  const handleBlankEditPlanClip = useCallback(
    (cutIndex: number) => {
      try {
        const seg = liveResult.editPlan?.edit_plan?.[cutIndex]
        if (isEditPlanBlank(seg)) {
          setErr(`컷 ${cutIndex + 1}은 이미 공백입니다. 자리는 유지됩니다.`)
          return
        }
        pushTimelineUndo()
        const next = convertEditPlanCutToBlank(liveResult, cutIndex)
        setResultDraft(next)
        onResultChange?.(next, mp4BlobRef.current)
        setErr(
          `컷 ${cutIndex + 1}을 삭제했습니다. 자리는 공백으로 유지됩니다. (뒤 클립은 당겨지지 않음 · TTS 유지 · Ctrl+Z 되돌리기)`
        )
      } catch (e) {
        setErr(e instanceof Error ? e.message : "삭제(공백)에 실패했습니다.")
      }
    },
    [liveResult, onResultChange, pushTimelineUndo]
  )

  /** Ctrl+X — 선택 컷을 타임라인·MP4에서 완전히 제거하고 뒤를 당김 */
  const handleDeleteEditPlanClip = useCallback(
    async (cutIndex: number, opts?: { cut?: boolean }) => {
      if (timelineEditBusy || insertClipBusy) return
      setTimelineEditBusy(true)
      setErr(null)
      let undoPushed = false
      try {
        const mainBlob = mp4BlobRef.current
        if (!mainBlob || mainBlob.size < 1000) {
          throw new Error("리믹스 MP4가 없습니다. 미리보기가 나온 뒤 다시 시도해 주세요.")
        }
        const planned = removeEditPlanCut(liveResult, cutIndex)
        if (opts?.cut) {
          const seg = liveResult.editPlan?.edit_plan?.[cutIndex]
          cutClipboardRef.current = {
            label: seg?.visual_caption || seg?.reason || `컷 ${cutIndex + 1}`,
            durationSec: planned.removedDurationSec,
            reason: seg?.reason,
          }
        }

        pushTimelineUndo()
        undoPushed = true
        setResultDraft(planned.result)

        const form = new FormData()
        await appendRemixMediaToForm(form, {
          blob: mainBlob,
          projectId,
          blobField: "video",
          urlField: "videoUrl",
          fileName: "main.mp4",
        })
        form.append("removeStartSec", String(planned.removeStartSec))
        form.append("removeEndSec", String(planned.removeEndSec))
        const mainDur =
          liveResult.outputDuration ||
          liveResult.editPlan?.edit_plan?.at(-1)?.output_end ||
          videoDuration ||
          0
        if (mainDur > 0.1) form.append("mainDurationSec", String(mainDur))

        const res = await fetch("/api/shotform/mvp-remove-clip-range", {
          method: "POST",
          body: form,
        })
        await throwIfRemixFfmpegFailed(res, "컷 삭제")
        const outBlob = await res.blob()
        if (outBlob.size < 4096) throw new Error("삭제 결과 영상이 비어 있습니다.")

        if (voiceLineCues?.length) {
          setVoiceLineCues(planned.voiceLineCuesShift(voiceLineCues))
        }
        const shiftedScripts = planned.scriptOverridesShift(scriptOverrides)
        setScriptOverrides(shiftedScripts)
        onScriptOverridesChange?.(shiftedScripts)
        setScriptBaseline(null)
        setScriptRevision((r) => r + 1)
        setVideoSourceTransforms((prev) => planned.videoTransformsShift(prev))
        setResultDraft(planned.result)
        onResultChange?.(planned.result, outBlob)
        await applyVideoBlob(outBlob)
        setErr(
          opts?.cut
            ? `Ctrl+X — 컷 ${cutIndex + 1}을 완전 제거했고 뒤를 당겼습니다. Ctrl+Z로 되돌릴 수 있습니다.`
            : `컷 ${cutIndex + 1}을 완전 제거했고 뒤를 당겼습니다. Ctrl+Z로 되돌릴 수 있습니다.`
        )
      } catch (e) {
        if (undoPushed) await handleTimelineUndo()
        setErr(e instanceof Error ? e.message : "컷 삭제에 실패했습니다.")
      } finally {
        setTimelineEditBusy(false)
      }
    },
    [
      timelineEditBusy,
      insertClipBusy,
      liveResult,
      voiceLineCues,
      scriptOverrides,
      onScriptOverridesChange,
      onResultChange,
      applyVideoBlob,
      videoDuration,
      pushTimelineUndo,
      handleTimelineUndo,
      projectId,
    ]
  )

  const handleReorderEditPlanClip = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (timelineEditBusy || insertClipBusy) return
      if (fromIndex === toIndex) return
      setTimelineEditBusy(true)
      setErr(null)
      let undoPushed = false
      try {
        const mainBlob = mp4BlobRef.current
        if (!mainBlob || mainBlob.size < 1000) {
          throw new Error("리믹스 MP4가 없습니다. 미리보기가 나온 뒤 다시 시도해 주세요.")
        }
        const planned = reorderEditPlanCut(liveResult, fromIndex, toIndex)
        if (planned.fromIndex === planned.toIndex) return

        pushTimelineUndo()
        undoPushed = true
        setResultDraft(planned.result)

        const form = new FormData()
        await appendRemixMediaToForm(form, {
          blob: mainBlob,
          projectId,
          blobField: "video",
          urlField: "videoUrl",
          fileName: "main.mp4",
        })
        form.append("rangesJson", JSON.stringify(planned.concatRanges))

        const res = await fetch("/api/shotform/mvp-reorder-clips", {
          method: "POST",
          body: form,
        })
        await throwIfRemixFfmpegFailed(res, "컷 이동")
        const outBlob = await res.blob()
        if (outBlob.size < 4096) throw new Error("이동 결과 영상이 비어 있습니다.")

        // TTS는 시간축·큐 그대로 유지
        const shiftedScripts = planned.scriptOverridesShift(scriptOverrides)
        setScriptOverrides(shiftedScripts)
        onScriptOverridesChange?.(shiftedScripts)
        setScriptBaseline(null)
        setScriptRevision((r) => r + 1)
        setVideoSourceTransforms((prev) => planned.videoTransformsShift(prev))
        setResultDraft(planned.result)
        onResultChange?.(planned.result, outBlob)
        await applyVideoBlob(outBlob)
        setErr(
          `컷 ${fromIndex + 1}을 ${toIndex + 1}번 위치로 옮겼습니다. TTS는 그대로입니다. Ctrl+Z로 되돌릴 수 있습니다.`
        )
      } catch (e) {
        if (undoPushed) await handleTimelineUndo()
        setErr(e instanceof Error ? e.message : "컷 이동에 실패했습니다.")
      } finally {
        setTimelineEditBusy(false)
      }
    },
    [
      timelineEditBusy,
      insertClipBusy,
      liveResult,
      scriptOverrides,
      onScriptOverridesChange,
      onResultChange,
      applyVideoBlob,
      pushTimelineUndo,
      handleTimelineUndo,
      projectId,
    ]
  )

  useEffect(() => {
    if (videoBlob) {
      void applyVideoBlob(videoBlob)
      return
    }
    if (videoBlobUrl) {
      if (videoBlobUrl.startsWith("https://")) {
        setResolvedVideoUrl(videoBlobUrl)
        setErr(null)
        void (async () => {
          try {
            const res = await fetch(videoBlobUrl, { cache: "no-store" })
            const blob = await res.blob()
            if (blob.size >= 50_000) await applyVideoBlob(blob)
          } catch {
            /* Supabase URL — video 태그 직접 재생 */
          }
        })()
        return
      }
      setResolvedVideoUrl(videoBlobUrl)
      void (async () => {
        try {
          const res = await fetch(videoBlobUrl)
          const blob = await res.blob()
          if (blob.size >= 20_000) await applyVideoBlob(blob)
        } catch {
          /* ignore */
        }
      })()
      return
    }
    setResolvedVideoUrl(null)
  }, [videoBlob, videoBlobUrl, applyVideoBlob])

  useEffect(() => {
    if (videoBlob || videoBlobUrl) return
    if (!result.jobId) return
    let cancelled = false
    setVideoLoading(true)
    void (async () => {
      try {
        const cached = await loadMvpEditMp4(projectId, result.jobId)
        if (!cancelled && cached) {
          await applyVideoBlob(cached)
          return
        }
        if (result.renderSkipped && result.renderMode !== "local" && !result.localRenderPending) {
          if (!cancelled) {
            setErr(
              result.renderSkipReason ||
                "리믹스 MP4 렌더가 생략되었습니다. 리믹스를 다시 실행해 주세요."
            )
          }
          return
        }

        const localWorkDir =
          result.localWorkDir?.trim() ||
          (typeof window !== "undefined"
            ? localStorage.getItem(LOCAL_WORK_DIR_STORAGE_KEY)?.trim()
            : "") ||
          ""
        const shouldTryLocalCompanion =
          Boolean(localWorkDir && result.jobId) &&
          (result.renderMode === "local" ||
            result.localRenderPending ||
            Boolean(result.localOutputPath))

        if (shouldTryLocalCompanion) {
          try {
            const { blob } = await resolveLocalCompanionMp4({
              localWorkDir,
              jobId: result.jobId,
              editPlan: result.editPlan,
              localRenderPending: result.localRenderPending,
              onProgress: () => {
                /* studio 로드 — 별도 힌트 UI 없음 */
              },
            })
            if (!cancelled) {
              await applyVideoBlob(blob)
              await saveMvpEditMp4(projectId, result.jobId, blob)
            }
            return
          } catch (localErr) {
            if (!cancelled) {
              const detail = localErr instanceof Error ? localErr.message : ""
              const pathHint = `${localWorkDir}\\jobs\\${result.jobId}\\output.mp4`
              setErr(
                detail
                  ? `${detail}\n\n로컬 파일: ${pathHint}`
                  : `로컬 MP4를 불러오지 못했습니다.\n\n파일 위치: ${pathHint}\n\n로컬 에이전트(npm run shotform:local-agent)가 실행 중인지 확인해 주세요.`
              )
            }
            return
          }
        }

        if (!result.jobId) {
          if (!cancelled) setErr("리믹스 MP4가 없습니다. 리믹스를 다시 실행해 주세요.")
          return
        }

        const metaRes = await fetch(autoEditDownloadUrl(result.jobId, { mode: "url" }), {
          cache: "no-store",
        })
        const meta = (await metaRes.json().catch(() => ({}))) as {
          url?: string
          kind?: "supabase" | "api"
          error?: string
        }
        if (!metaRes.ok || !meta.url) {
          throw new Error(meta.error || `재생 URL 조회 실패 (${metaRes.status})`)
        }
        if (cancelled) return

        if (meta.kind === "supabase") {
          setResolvedVideoUrl(meta.url)
          setErr(null)
          try {
            const res = await fetch(meta.url, { cache: "no-store" })
            if (res.ok) {
              const blob = await res.blob()
              if (blob.size >= 50_000) await applyVideoBlob(blob)
            }
          } catch {
            /* video src로 직접 재생 */
          }
          return
        }

        const res = await fetch(meta.url, { cache: "no-store" })
        if (!res.ok) throw new Error(`MP4 조회 실패 (${res.status})`)
        const blob = await res.blob()
        if (cancelled) return
        await applyVideoBlob(blob)
      } catch (e) {
        if (!cancelled) {
          const detail = e instanceof Error ? e.message : ""
          const hadCache = editMp4CachedJobId === result.jobId
          setErr(
            detail ||
              (hadCache
                ? "브라우저 로컬 캐시를 찾지 못했습니다(저장소 삭제·시크릿 모드 등). 리믹스를 다시 실행해 주세요."
                : "리믹스 MP4를 불러오지 못했습니다. 리믹스를 다시 실행해 주세요.")
          )
        }
      } finally {
        if (!cancelled) setVideoLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    videoBlob,
    videoBlobUrl,
    result.downloadUrl,
    result.jobId,
    result.renderMode,
    result.localWorkDir,
    result.localRenderPending,
    result.localOutputPath,
    result.editPlan,
    result.renderSkipped,
    projectId,
    applyVideoBlob,
    editMp4CachedJobId,
  ])

  useEffect(() => {
    if (!projectId || !result.jobId) return
    if (!voiceLineCues?.length || audioUrl) return
    let cancelled = false
    void (async () => {
      try {
        const blob = await loadMvpTtsAudio(projectId, result.jobId)
        if (cancelled || !blob) return
        const url = URL.createObjectURL(blob)
        const baked = await rebakeWavBlobUrl(blob)
        URL.revokeObjectURL(url)
        if (cancelled) {
          URL.revokeObjectURL(baked.blobUrl)
          return
        }
        if (fetchedTtsUrlRef.current) URL.revokeObjectURL(fetchedTtsUrlRef.current)
        fetchedTtsUrlRef.current = baked.blobUrl
        ttsBlobRef.current = baked.wavBlob
        setAudioUrl(baked.blobUrl)
        commitAudioDuration(baked.durationSec, "replace")
        setAudioPlayhead(0)
        setAudioKey((k) => k + 1)
        setEditTtsCachedJobId(result.jobId)
      } catch {
        /* IndexedDB 없음 — TTS 다시 생성 */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId, result.jobId, voiceLineCues, audioUrl, commitAudioDuration])

  useEffect(
    () => () => {
      if (fetchedBlobRef.current) {
        URL.revokeObjectURL(fetchedBlobRef.current)
        fetchedBlobRef.current = null
      }
      mp4BlobRef.current = null
      if (fetchedTtsUrlRef.current) {
        URL.revokeObjectURL(fetchedTtsUrlRef.current)
        fetchedTtsUrlRef.current = null
      }
    },
    []
  )

  const getSceneText = useCallback(
    (i: number) => resolveSceneNarrationText(i, baseSegments, scriptOverrides, segmentVisualHints[i]),
    [scriptOverrides, baseSegments, segmentVisualHints]
  )

  const lineSchedule = useMemo(
    () => buildLineSubtitleSchedule(segments, getSceneText),
    [segments, getSceneText]
  )

  const subtitleLine = useMemo(() => {
    if (voiceLineCues?.length && audioUrl) {
      return voiceSubtitleAtLineCues(voiceLineCues, audioPlayhead)
    }
    return subtitleFromSchedule(lineSchedule, playhead)
  }, [voiceLineCues, audioUrl, audioPlayhead, lineSchedule, playhead])

  const activeScene = sceneIndexAtTime(segments, playhead)

  useEffect(() => {
    void loadVoicesForProvider("supertone")
  }, [loadVoicesForProvider])

  useEffect(() => {
    setVoiceLoadErrors((prev) => {
      if (!prev.elevenlabs || !isElevenlabsVoicesReadError(prev.elevenlabs)) return prev
      skipVoiceListLoadRef.current.add("elevenlabs")
      setVoiceListUnavailable((v) => ({ ...v, elevenlabs: true }))
      return { ...prev, elevenlabs: null }
    })
  }, [])

  const previewTotalSec = useMemo(
    () =>
      previewTimelineEndSec(
        videoDuration || totalSec,
        audioDuration,
        voiceLineCues,
        playbackSegments
      ),
    [videoDuration, totalSec, audioDuration, voiceLineCues, playbackSegments]
  )

  const lastSyncSceneRef = useRef(-1)
  const lastSyncCueKeyRef = useRef("")
  const holdingEndRef = useRef(false)
  const sceneStopAtRef = useRef<number | null>(null)
  /** 장면만 재생 시 오디오 타임라인 정지점 */
  const sceneAudioStopAtRef = useRef<number | null>(null)
  /** 장면 단독 TTS 재생 시 타임라인(빨간바) 오프셋 */
  const sceneSoloMetaRef = useRef<{
    audioStartSec: number
    videoStart: number
    videoEnd: number
  } | null>(null)

  const syncVideoToAudio = useCallback(
    (audioT: number, forceSeek = false) => {
      const v = videoRef.current
      if (!v) return
      const state = {
        lastScene: lastSyncSceneRef.current,
        lastCueKey: lastSyncCueKeyRef.current,
        holdingEnd: holdingEndRef.current,
      }
      syncMvpPreviewVideoToAudio(
        v,
        audioT,
        voiceLineCues,
        playbackSegments,
        videoDuration || totalSec,
        audioDuration,
        state,
        {
          forceSeek,
          holdOnEnd: true,
          // 시크·일시정지 중에는 영상 자동 play 금지
          allowAutoPlay: playingRef.current && !forceSeek && !timelineScrubLockRef.current,
        }
      )
      lastSyncSceneRef.current = state.lastScene
      lastSyncCueKeyRef.current = state.lastCueKey
      holdingEndRef.current = Boolean(state.holdingEnd)
    },
    [voiceLineCues, playbackSegments, videoDuration, totalSec, audioDuration]
  )

  const pausePreview = useCallback(() => {
    previewPlayGenRef.current += 1
    playingRef.current = false
    // React re-render 전에 rAF가 한 프레임 더 돌며 a.play() 하던 문제 차단
    stopPreviewClock()
    const v = videoRef.current
    const a = audioRef.current
    a?.pause()
    v?.pause()
    if (sceneSoloAudioRef.current) {
      sceneSoloAudioRef.current.pause()
      sceneSoloAudioRef.current = null
    }
    sceneSoloMetaRef.current = null
    if (v) v.playbackRate = 1
    audioLayersRef.current?.stop()
    setPlaying(false)
    lastSyncSceneRef.current = -1
    lastSyncCueKeyRef.current = ""
    holdingEndRef.current = false
    sceneStopAtRef.current = null
    sceneAudioStopAtRef.current = null
  }, [stopPreviewClock])

  useEffect(() => {
    if (active) return
    pausePreview()
    previewAudioRef.current?.pause()
    setPreviewingVoiceId(null)
  }, [active, pausePreview])

  const syncVideoToPlayhead = useCallback(
    (t: number) => {
      const v = videoRef.current
      const a = audioRef.current
      if (!v || !Number.isFinite(v.duration)) return
      v.currentTime = Math.min(t, v.duration)
      v.playbackRate = 1
      if (audioUrl && a && voiceLineCues?.length) {
        const audioT = audioTimeFromVideoSync(
          t,
          voiceLineCues,
          playbackSegments,
          videoDuration || totalSec,
          audioDuration
        )
        a.currentTime = Math.min(audioDuration - 0.01, Math.max(0, audioT))
        setAudioPlayhead(a.currentTime)
      } else if (audioUrl && a && audioDuration > 0 && v.duration > 0) {
        a.currentTime = Math.min(audioDuration - 0.01, Math.max(0, (t / v.duration) * audioDuration))
        setAudioPlayhead(a.currentTime)
      }
    },
    [audioUrl, audioDuration, voiceLineCues, playbackSegments, videoDuration, totalSec]
  )

  const handleAudioTimeUpdate = useCallback(() => {
    const a = audioRef.current
    const v = videoRef.current
    if (!a) return
    // 시크/일시정지 의도인데 오디오가 돌고 있으면 즉시 멈춤
    if (!playingRef.current || timelineScrubLockRef.current) {
      if (!a.paused) a.pause()
      v?.pause()
      audioLayersRef.current?.stop()
      return
    }
    if (a.paused) {
      audioLayersRef.current?.stop()
      return
    }
    const t = a.currentTime
    // TTS가 마스터일 때 영상 hold(pause)와 무관하게 효과음은 계속 재생
    const layersPlaying = !a.paused
    if (voiceLineCues?.length) {
      // 재생 중 영상 sync는 rAF 루프만 담당 — timeupdate와 이중 seek하면 끊김
      const vt =
        v && !v.paused && Number.isFinite(v.currentTime)
          ? v.currentTime
          : videoTimeFromAudioCueSync(
              t,
              voiceLineCues,
              playbackSegments,
              videoDuration || totalSec,
              audioDuration
            )
      setPlayhead(vt)
      setAudioPlayhead(t)
      audioLayersRef.current?.sync(vt, layersPlaying)
      // TTS 큐가 있으면 영상 end로 끊지 않음 (sceneAudioStopAt / rAF만 담당)
      if (
        !voiceLineCues?.length &&
        sceneStopAtRef.current != null &&
        vt >= sceneStopAtRef.current
      ) {
        pausePreview()
        if (v) v.currentTime = sceneStopAtRef.current
        setPlayhead(sceneStopAtRef.current)
      }
    } else if (videoDuration > 0 && audioDuration > 0) {
      const vt = Math.min(videoDuration, (t / audioDuration) * videoDuration)
      setPlayhead(vt)
      setAudioPlayhead(t)
      audioLayersRef.current?.sync(vt, layersPlaying)
      if (
        !voiceLineCues?.length &&
        sceneStopAtRef.current != null &&
        vt >= sceneStopAtRef.current
      ) {
        pausePreview()
        if (v) v.currentTime = sceneStopAtRef.current
      }
    }
  }, [voiceLineCues, playbackSegments, videoDuration, totalSec, audioDuration, pausePreview])

  const handleVideoTimeUpdate = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    // TTS 재생 중에는 영상 구간 end로 오디오를 끊지 않음
    if (audioUrl && voiceLineCues?.length) return
    if (sceneStopAtRef.current != null && v.currentTime >= sceneStopAtRef.current) {
      v.pause()
      v.currentTime = sceneStopAtRef.current
      setPlayhead(sceneStopAtRef.current)
      sceneStopAtRef.current = null
      setPlaying(false)
      audioRef.current?.pause()
      audioLayersRef.current?.stop()
      return
    }
    if (audioUrl) return
    const vt = v.currentTime
    setPlayhead(vt)
    audioLayersRef.current?.sync(vt, !v.paused)
  }, [audioUrl, voiceLineCues])

  useEffect(() => {
    stopPreviewClock()
    if (!playing || !playingRef.current) return

    lastPreviewUiUpdateRef.current = 0
    const tick = (now: number) => {
      // pausePreview가 state보다 먼저 playingRef=false — 즉시 루프 종료
      if (!playingRef.current || timelineScrubLockRef.current) {
        previewClockRafRef.current = null
        return
      }

      const v = videoRef.current
      const a = audioRef.current
      let vt: number | null = null
      let at: number | null = null
      const useAudioAxis = Boolean(
        audioUrl && voiceLineCues?.length && audioDuration > 0.05
      )

      // 장면 단독 TTS 재생 중 — 메인 오디오 대신 솔로 진행으로 빨간바·플레이헤드 갱신
      if (sceneSoloAudioRef.current) {
        const solo = sceneSoloAudioRef.current
        const meta = sceneSoloMetaRef.current
        if (meta && Number.isFinite(solo.currentTime)) {
          const at = meta.audioStartSec + Math.max(0, solo.currentTime)
          const vidDur = Math.max(0.05, meta.videoEnd - meta.videoStart)
          const vt =
            solo.currentTime < vidDur - 0.04
              ? meta.videoStart + solo.currentTime
              : Math.max(meta.videoStart, meta.videoEnd - 0.02)
          if (now - lastPreviewUiUpdateRef.current >= 1000 / 30) {
            lastPreviewUiUpdateRef.current = now
            setAudioPlayhead(at)
            setPlayhead(vt)
          }
        }
        if (playingRef.current && !timelineScrubLockRef.current) {
          previewClockRafRef.current = requestAnimationFrame(tick)
        } else {
          previewClockRafRef.current = null
        }
        return
      }

      if (audioUrl && a) {
        // 의도적으로 재생 중일 때만 버퍼/정책으로 멈춘 오디오 재개
        if (
          a.paused &&
          !a.ended &&
          playingRef.current &&
          !timelineScrubLockRef.current &&
          !sceneSoloAudioRef.current
        ) {
          void a.play().catch(() => {})
        }
        at = a.currentTime
        if (!a.paused && playingRef.current) {
          if (voiceLineCues?.length) {
            syncVideoToAudio(at)
            vt =
              v && Number.isFinite(v.currentTime)
                ? v.currentTime
                : videoTimeFromAudioCueSync(
                    at,
                    voiceLineCues,
                    playbackSegments,
                    videoDuration || totalSec,
                    audioDuration
                  )
          } else if (videoDuration > 0 && audioDuration > 0) {
            vt = Math.min(videoDuration, (at / audioDuration) * videoDuration)
          }
        } else if (
          // 장면 단독 재생 중에는 영상→오디오 역산으로 stopAt을 앞당기지 않음
          sceneAudioStopAtRef.current == null &&
          v &&
          !v.paused &&
          Number.isFinite(v.currentTime)
        ) {
          vt = v.currentTime
          if (voiceLineCues?.length) {
            at = audioTimeFromVideoSync(
              vt,
              voiceLineCues,
              playbackSegments,
              videoDuration || totalSec,
              audioDuration
            )
          }
        }
      } else if (v && !v.paused && Number.isFinite(v.currentTime)) {
        vt = v.currentTime
      }

      const canUpdateUi = useAudioAxis ? at != null : vt != null
      if (canUpdateUi && playingRef.current) {
        // 장면만 재생: 오디오 큐가 끝나면 정지 (말 중간 절단 방지)
        const audioStopAt = sceneAudioStopAtRef.current
        if (audioStopAt != null && at != null && at >= audioStopAt) {
          playingRef.current = false
          v?.pause()
          a?.pause()
          sceneAudioStopAtRef.current = null
          sceneStopAtRef.current = null
          audioLayersRef.current?.stop()
          if (at != null) setAudioPlayhead(at)
          if (vt != null) setPlayhead(vt)
          setPlaying(false)
          previewClockRafRef.current = null
          return
        }

        // 자동 재생: TTS 끝에서 정지 (이후 영상은 빨간바 수동 시크로만 탐색)
        if (
          useAudioAxis &&
          at != null &&
          audioDuration > 0.05 &&
          at >= audioDuration - 0.04
        ) {
          playingRef.current = false
          v?.pause()
          a?.pause()
          audioLayersRef.current?.stop()
          const endAt = Math.min(at, Math.max(0, audioDuration - 0.01))
          setAudioPlayhead(endAt)
          if (vt != null) setPlayhead(vt)
          else if (voiceLineCues?.length) {
            setPlayhead(
              videoTimeFromAudioCueSync(
                endAt,
                voiceLineCues,
                playbackSegments,
                videoDuration || totalSec,
                audioDuration
              )
            )
          }
          setPlaying(false)
          previewClockRafRef.current = null
          return
        }

        const stopAt = sceneStopAtRef.current
        const stopClock = useAudioAxis ? at : vt
        if (stopAt != null && stopClock != null && vt != null && !useAudioAxis && vt >= stopAt) {
          playingRef.current = false
          v?.pause()
          a?.pause()
          if (v) v.currentTime = stopAt
          sceneStopAtRef.current = null
          audioLayersRef.current?.stop()
          setPlayhead(stopAt)
          if (at != null) setAudioPlayhead(at)
          setPlaying(false)
          previewClockRafRef.current = null
          return
        }

        // 효과음은 TTS 있으면 음성 타임라인 축에 저장되므로 audioT로 동기화
        const layerTime =
          at != null && voiceLineCues?.length
            ? at
            : vt ??
              (at != null
                ? videoTimeFromAudioCueSync(
                    at,
                    voiceLineCues ?? [],
                    playbackSegments,
                    videoDuration || totalSec,
                    audioDuration
                  )
                : 0)
        audioLayersRef.current?.sync(
          layerTime,
          Boolean(audioUrl ? a && !a.paused : v && !v.paused)
        )

        if (now - lastPreviewUiUpdateRef.current >= 1000 / 30) {
          lastPreviewUiUpdateRef.current = now
          if (at != null) setAudioPlayhead(at)
          if (vt != null) setPlayhead(vt)
          else if (at != null && voiceLineCues?.length) {
            setPlayhead(
              videoTimeFromAudioCueSync(
                at,
                voiceLineCues,
                playbackSegments,
                videoDuration || totalSec,
                audioDuration
              )
            )
          }
        }
      }

      if (playingRef.current && !timelineScrubLockRef.current) {
        previewClockRafRef.current = requestAnimationFrame(tick)
      } else {
        previewClockRafRef.current = null
      }
    }

    previewClockRafRef.current = requestAnimationFrame(tick)
    return () => {
      stopPreviewClock()
    }
  }, [
    playing,
    audioUrl,
    voiceLineCues,
    playbackSegments,
    videoDuration,
    totalSec,
    audioDuration,
    syncVideoToAudio,
    stopPreviewClock,
  ])

  const playSceneOnly = useCallback(
    (index: number) => {
      const seg = playbackSegments[index] ?? baseSegments[index]
      if (!seg) return
      pausePreview()
      if (timelineScrubUnlockTimerRef.current) {
        clearTimeout(timelineScrubUnlockTimerRef.current)
        timelineScrubUnlockTimerRef.current = null
      }
      timelineScrubLockRef.current = false

      const v = videoRef.current
      const a = audioRef.current
      const gen = previewPlayGenRef.current
      playingRef.current = true
      setPlaying(true)

      // 1) 장면별 원본 TTS가 있으면 그걸 끝까지 재생 (말꼬리 보장)
      const cueLineIdx =
        voiceLineCues?.findIndex((c) => c.sceneIndex === index) ?? -1
      const lineUrl =
        (cueLineIdx >= 0
          ? sceneLineAudioUrlsRef.current?.[cueLineIdx]
          : null) ?? sceneLineAudioUrlsRef.current?.[index]
      const audioRangeForScene =
        voiceLineCues?.length ? audioRangeForSceneIndex(index, voiceLineCues) : null
      if (lineUrl) {
        sceneStopAtRef.current = null
        sceneAudioStopAtRef.current = null
        a?.pause()
        const audioStartSec = audioRangeForScene?.startSec ?? 0
        sceneSoloMetaRef.current = {
          audioStartSec,
          videoStart: seg.start,
          videoEnd: seg.end,
        }
        setAudioPlayhead(audioStartSec)
        if (v) {
          v.currentTime = seg.start
          setPlayhead(seg.start)
          void v.play().catch(() => {})
        }
        const solo = new Audio(lineUrl)
        sceneSoloAudioRef.current = solo
        const syncSoloVideo = () => {
          if (gen !== previewPlayGenRef.current || !playingRef.current) return
          const vid = videoRef.current
          if (!vid) return
          const vidDur = Math.max(0.05, seg.end - seg.start)
          const at = audioStartSec + Math.max(0, solo.currentTime)
          if (solo.currentTime < vidDur - 0.04) {
            const target = seg.start + solo.currentTime
            if (Math.abs(vid.currentTime - target) > 0.2) vid.currentTime = target
            if (vid.paused) void vid.play().catch(() => {})
            setPlayhead(target)
          } else {
            // TTS가 영상보다 길면 컷 루프
            const looped = solo.currentTime % vidDur
            const target = seg.start + looped
            if (Math.abs(vid.currentTime - target) > 0.25) vid.currentTime = target
            if (vid.paused) void vid.play().catch(() => {})
            setPlayhead(target)
          }
          setAudioPlayhead(at)
        }
        solo.ontimeupdate = syncSoloVideo
        solo.onended = () => {
          if (gen !== previewPlayGenRef.current) return
          playingRef.current = false
          videoRef.current?.pause()
          sceneSoloAudioRef.current = null
          sceneSoloMetaRef.current = null
          setPlaying(false)
        }
        void solo.play().then(() => {
          if (gen !== previewPlayGenRef.current) return
          if (!playingRef.current) solo.pause()
        }).catch(() => {})
        return
      }

      // 2) 폴백: 합본 오디오의 큐 구간 (끝 + 여유)
      const audioRange =
        audioUrl && voiceLineCues?.length
          ? audioRangeForSceneIndex(index, voiceLineCues)
          : null

      if (audioRange && a && audioUrl) {
        sceneStopAtRef.current = null
        // 다음 장면 시작 직전까지만 — 말꼬리 패딩은 큐 duration에 포함됨
        const nextStart =
          voiceLineCues.find((c) => c.sceneIndex === index + 1)?.startSec ??
          audioRange.endSec
        sceneAudioStopAtRef.current = Math.max(audioRange.endSec, nextStart) + 0.05
        a.currentTime = Math.max(0, audioRange.startSec)
        setAudioPlayhead(audioRange.startSec)
        syncVideoToAudio(audioRange.startSec, true)
        const vt = videoTimeFromAudioCueSync(
          audioRange.startSec,
          voiceLineCues!,
          playbackSegments,
          videoDuration || totalSec,
          audioDuration
        )
        setPlayhead(vt)
        void a.play().then(() => {
          if (gen !== previewPlayGenRef.current) return
          if (!playingRef.current) a.pause()
        }).catch(() => {})
        if (v) {
          void v.play().then(() => {
            if (gen !== previewPlayGenRef.current) return
            if (!playingRef.current) v.pause()
          }).catch(() => {})
        }
        return
      }

      // TTS 없음 — 영상 구간만 재생
      sceneAudioStopAtRef.current = null
      sceneStopAtRef.current = Math.max(seg.start + 0.05, seg.end - 0.04)
      setPlayhead(seg.start)
      syncVideoToPlayhead(seg.start)
      if (v) {
        v.currentTime = seg.start
        void v.play().then(() => {
          if (gen !== previewPlayGenRef.current) return
          if (!playingRef.current) v.pause()
        }).catch(() => {})
      }
    },
    [
      playbackSegments,
      baseSegments,
      pausePreview,
      syncVideoToPlayhead,
      syncVideoToAudio,
      audioUrl,
      voiceLineCues,
      videoDuration,
      totalSec,
      audioDuration,
    ]
  )

  const handlePlayToggle = useCallback(() => {
    const v = videoRef.current
    const a = audioRef.current
    if (audioUrl && a) {
      if (playing || playingRef.current) {
        pausePreview()
        return
      }
      if (timelineScrubUnlockTimerRef.current) {
        clearTimeout(timelineScrubUnlockTimerRef.current)
        timelineScrubUnlockTimerRef.current = null
      }
      timelineScrubLockRef.current = false
      if (audioPlayhead >= audioDuration - 0.05) {
        // TTS 끝(또는 그 이후 시크)에서 재생 → 처음부터
        a.currentTime = 0
        setAudioPlayhead(0)
        setPlayhead(0)
        if (v) {
          v.currentTime = 0
          v.playbackRate = 1
        }
        lastSyncSceneRef.current = -1
        lastSyncCueKeyRef.current = ""
        holdingEndRef.current = false
      }
      playingRef.current = true
      setPlaying(true)
      syncVideoToAudio(a.currentTime, true)
      const vt =
        voiceLineCues?.length
          ? videoTimeFromAudioCueSync(
              a.currentTime,
              voiceLineCues,
              playbackSegments,
              videoDuration || totalSec,
              audioDuration
            )
          : Math.min(videoDuration || totalSec, (a.currentTime / audioDuration) * (videoDuration || totalSec))
      // 효과음 축 = TTS 있으면 음성 시간
      const layerT = voiceLineCues?.length ? a.currentTime : vt
      audioLayersRef.current?.onSeek(layerT)
      const gen = previewPlayGenRef.current
      void a.play().then(() => {
        // 이전 play()가 새 재생을 pause로 끊지 않도록 — 세대가 다르면 no-op
        if (gen !== previewPlayGenRef.current) return
        if (!playingRef.current) {
          a.pause()
          v?.pause()
          return
        }
        audioLayersRef.current?.sync(layerT, true)
        void v?.play().catch(() => {})
      })
      return
    }
    if (!v) return
    if (playing || playingRef.current) {
      pausePreview()
      return
    }
    if (timelineScrubUnlockTimerRef.current) {
      clearTimeout(timelineScrubUnlockTimerRef.current)
      timelineScrubUnlockTimerRef.current = null
    }
    timelineScrubLockRef.current = false
    playingRef.current = true
    setPlaying(true)
    audioLayersRef.current?.onSeek(v.currentTime)
    const gen = previewPlayGenRef.current
    void v.play().then(() => {
      if (gen !== previewPlayGenRef.current) return
      if (!playingRef.current) {
        v.pause()
        return
      }
      audioLayersRef.current?.sync(v.currentTime, true)
    })
  }, [
    playing,
    audioUrl,
    audioPlayhead,
    audioDuration,
    syncVideoToAudio,
    pausePreview,
    voiceLineCues,
    playbackSegments,
    videoDuration,
    totalSec,
  ])

  const runTts = useCallback(async (opts?: { voiceId?: string; style?: string; speed?: number }) => {
    setErr(null)
    const voiceId = opts?.voiceId?.trim() || selectedVoiceId
    const style = opts?.style ?? supertoneStyle
    const baseSpeed = normalizeTtsSpeed(opts?.speed ?? speechSpeed)
    const provider = ttsProviderFromVoiceId(voiceId)
    if (!provider) {
      setErr("목소리를 선택해 주세요. (수퍼톤 / 수퍼토닉3 / ElevenLabs / 타입캐스트)")
      return
    }
    // 수퍼토닉3는 로컬 서버 — API 키 검사 생략
    if (provider !== "supertonic" && !shotformTtsApiKey(provider)) {
      setErr(ttsApiKeyMissingMessage(provider))
      return
    }
    if (voiceId !== selectedVoiceId) {
      setSelectedVoiceId(voiceId)
      setSupertoneStyle(style)
    }
    const lines = collectNarrationSubtitleLines(segments, getSceneText)
    const planSegs = liveResult.editPlan?.edit_plan
    // 공백 컷은 대본·TTS 대상 아님 — TTS 먼저 만든 뒤 「추가 영상」으로 채움
    const uncovered = segments
      .map((_, i) => i)
      .filter((i) => {
        if (isEditPlanBlank(planSegs?.[i])) return false
        return !lines.some((l) => l.sceneIndex === i)
      })
    if (!lines.length) {
      setErr("리믹스 대본이 없습니다. 편집을 다시 실행해 주세요.")
      return
    }
    if (uncovered.length > 0) {
      setErr(
        `${uncovered.length}개 장면(컷 ${uncovered.map((i) => i + 1).join(", ")})에 대본이 비어 있습니다. 「AI 대본」을 실행하거나 대본 탭에서 직접 입력한 뒤 TTS를 다시 생성해 주세요.`
      )
      return
    }

    const tooShort = lines.find((l) => narrationPlainCharCount(l.text) < MIN_TTS_PLAIN_CHARS)
    if (tooShort) {
      setErr(
        `컷 ${tooShort.sceneIndex + 1} 대본이 너무 짧습니다("${tooShort.text}"). 대본이 중간에 잘렸을 수 있어요. 「대본만 다시쓰기」 후 TTS를 다시 시도해 주세요.`
      )
      return
    }

    setTtsLoading(true)
    setTtsProgress(4)

    try {
      const videoDurs = lines.map((l) => {
        const seg = baseSegments[l.sceneIndex]
        return seg ? Math.max(0.1, seg.end - seg.start) : 3
      })

      // 대본 원문 그대로 TTS (자동 축약·대본 덮어쓰기 금지 — 말이 중간에 끊기는 원인)
      let fittedLines = lines.map((l) => ({ ...l }))

      let speeds = sceneFitEnabled
        ? suggestSceneTtsSpeeds(
            fittedLines.map((l) => l.text),
            videoDurs,
            baseSpeed
          )
        : fittedLines.map(() => baseSpeed)

      const synthAll = async (
        items: typeof fittedLines,
        spd: number[]
      ) => {
        const urls: string[] = []
        for (let i = 0; i < items.length; i++) {
          const { text } = items[i]!
          setTtsProgress(Math.min(88, Math.round(4 + ((i + 0.3) / items.length) * 80)))
          const url = await synthesizeTtsLine({
            fullVoiceId: voiceId,
            text,
            style,
            speed: spd[i] ?? baseSpeed,
          })
          urls.push(url)
        }
        return urls
      }

      let audioUrls = await synthAll(fittedLines, speeds)
      // TTS 원문은 절대 자르지 않음 — 앞무음 trim이 말꼬리를 깎는 사례 방지
      let merged = await mergeAudioUrlsToWavBlobUrl(audioUrls, {
        trimSilence: true,
        interClipPadSec: 0.02,
      })

      // 장면 맞춤: 배속만 올리고, 대본을 잘라 재합성하지 않음 (말 중간 끊김 방지)
      if (sceneFitEnabled) {
        let needSpeedRetry = false
        const retrySpeeds = [...speeds]
        for (let i = 0; i < fittedLines.length; i++) {
          const measured = merged.lineDurationsSec[i] ?? 0.5
          const text = fittedLines[i]!.text
          const spd = speeds[i] ?? baseSpeed
          const est = estimateNarrationDurationSec(text) / Math.max(0.5, spd)
          // 예상보다 너무 짧으면 배속을 낮춰 재합성 (API/배속으로 말꼬리 유실)
          if (est > 0.4 && measured < est * 0.72) {
            retrySpeeds[i] = normalizeTtsSpeed(Math.min(spd, Math.max(baseSpeed, 1.0)))
            needSpeedRetry = true
            continue
          }
          const faster = suggestFasterSpeedIfAudioOverflows({
            measuredAudioSec: measured,
            videoDurSec: videoDurs[i]!,
            currentSpeed: spd,
          })
          // 실측이 충분한 경우에만 배속 업 (말 잘린 채로 더 빠르게 만들지 않음)
          if (faster != null && measured >= est * 0.75) {
            retrySpeeds[i] = faster
            needSpeedRetry = true
          }
        }
        if (needSpeedRetry) {
          setTtsProgress(90)
          speeds = retrySpeeds
          audioUrls = await synthAll(fittedLines, speeds)
          merged = await mergeAudioUrlsToWavBlobUrl(audioUrls, {
            trimSilence: true,
            interClipPadSec: 0.02,
          })
        }
      }

      const measured = fittedLines.map(({ text, sceneIndex, displayLines }, i) => ({
        text,
        sceneIndex,
        durationSec: merged.lineDurationsSec[i] ?? 0.5,
        displayLines,
        speed: speeds[i],
      }))

      const cues = buildVoiceLineCues(measured)

      setVoiceLineCues(cues)
      setSceneSpeeds(speeds)
      // 장면 맞춤 ON: 음성이 영상보다 짧은 컷만 영상 끝을 맞춤 (음성은 절대 안 자름)
      if (sceneFitEnabled) {
        setAudioFitEnds(audioFitEndsFromCues(baseSegments, cues))
      } else {
        setAudioFitEnds(null)
      }

      if (sceneLineAudioUrlsRef.current?.length) {
        for (const u of sceneLineAudioUrlsRef.current) {
          if (u.startsWith("blob:")) URL.revokeObjectURL(u)
        }
      }
      if (ttsLineUrlsRef.current?.length) {
        for (const u of ttsLineUrlsRef.current) {
          if (u.startsWith("blob:") && !audioUrls.includes(u)) URL.revokeObjectURL(u)
        }
      }
      ttsLineUrlsRef.current = audioUrls
      // 장면 재생용 — 말꼬리만 아주 짧게 (장면 사이 무음과 무관)
      const paddedLineUrls: string[] = []
      for (const url of audioUrls) {
        paddedLineUrls.push(await padAudioUrlEnd(url, 0.08))
      }
      sceneLineAudioUrlsRef.current = paddedLineUrls

      if (fetchedTtsUrlRef.current) {
        URL.revokeObjectURL(fetchedTtsUrlRef.current)
        fetchedTtsUrlRef.current = null
      }
      // 브라우저 duration 메타 오류 방지 — decode 후 WAV 재기록
      const baked = await rebakeWavBlobUrl(merged.wavBlob)
      if (merged.blobUrl.startsWith("blob:")) URL.revokeObjectURL(merged.blobUrl)
      fetchedTtsUrlRef.current = baked.blobUrl
      setAudioUrl(baked.blobUrl)
      const authoritativeDur = Math.max(
        baked.durationSec,
        merged.totalDurationSec,
        cues.at(-1)?.endSec ?? 0
      )
      commitAudioDuration(authoritativeDur, "replace")
      ttsBlobRef.current = baked.wavBlob
      try {
        if (projectId && result.jobId && baked.wavBlob.size >= 512) {
          await saveMvpTtsAudio(projectId, result.jobId, baked.wavBlob)
          setEditTtsCachedJobId(result.jobId)
        }
      } catch {
        /* IndexedDB 저장 실패는 TTS 재생과 무관 */
      }
      setAudioPlayhead(0)
      setPlayhead(0)
      setAudioKey((k) => k + 1)
      setTtsProgress(100)
      setTtsGeneratedSpeed(baseSpeed)
      if (opts?.speed != null && Math.abs(opts.speed - speechSpeed) > 0.01) {
        setSpeechSpeed(baseSpeed)
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "TTS 생성 실패")
      setTtsProgress(0)
    } finally {
      setTtsLoading(false)
    }
  }, [
    segments,
    baseSegments,
    getSceneText,
    selectedVoiceId,
    supertoneStyle,
    speechSpeed,
    sceneFitEnabled,
    projectId,
    result.jobId,
    commitAudioDuration,
    liveResult.editPlan?.edit_plan,
  ])

  /** 해당 씬 대본만 TTS 재생성 — 짧으면 영상 트림, 길면 재생 시 루프 */
  const runTtsForScene = useCallback(
    async (sceneIndex: number) => {
      setErr(null)
      const voiceId = selectedVoiceId
      const style = supertoneStyle
      const baseSpeed = normalizeTtsSpeed(speechSpeed)
      const provider = ttsProviderFromVoiceId(voiceId)
      if (!provider) {
        setErr("목소리를 선택해 주세요. (수퍼톤 / 수퍼토닉3 / ElevenLabs / 타입캐스트)")
        return
      }
      if (provider !== "supertonic" && !shotformTtsApiKey(provider)) {
        setErr(ttsApiKeyMissingMessage(provider))
        return
      }

      const lines = collectNarrationSubtitleLines(segments, getSceneText)
      const lineIdx = lines.findIndex((l) => l.sceneIndex === sceneIndex)
      if (lineIdx < 0) {
        setErr(
          `컷 ${sceneIndex + 1} 대본이 비어 있거나 너무 짧습니다. 대본을 입력한 뒤 다시 시도해 주세요.`
        )
        return
      }
      const target = lines[lineIdx]!
      if (narrationPlainCharCount(target.text) < MIN_TTS_PLAIN_CHARS) {
        setErr(`컷 ${sceneIndex + 1} 대본이 너무 짧습니다.`)
        return
      }

      setSceneTtsLoadingIndex(sceneIndex)
      setTtsLoading(true)
      setTtsProgress(8)
      try {
        const videoDurs = lines.map((l) => {
          const seg = baseSegments[l.sceneIndex]
          return seg ? Math.max(0.1, seg.end - seg.start) : 3
        })
        let speeds = sceneFitEnabled
          ? suggestSceneTtsSpeeds(
              lines.map((l) => l.text),
              videoDurs,
              baseSpeed
            )
          : lines.map(() => baseSpeed)
        if (sceneSpeeds?.length) {
          speeds = lines.map((l, i) => {
            const prev = sceneSpeeds[l.sceneIndex]
            return prev != null ? normalizeTtsSpeed(prev) : speeds[i]!
          })
        }

        const prevUrls = ttsLineUrlsRef.current
        const canPatch =
          Boolean(prevUrls?.length) &&
          prevUrls!.length === lines.length &&
          Boolean(voiceLineCues?.length)

        const audioUrls: string[] = canPatch ? [...prevUrls!] : []
        if (!canPatch) {
          for (let i = 0; i < lines.length; i++) {
            setTtsProgress(Math.min(80, Math.round(8 + ((i + 0.4) / lines.length) * 70)))
            audioUrls.push(
              await synthesizeTtsLine({
                fullVoiceId: voiceId,
                text: lines[i]!.text,
                style,
                speed: speeds[i] ?? baseSpeed,
              })
            )
          }
        } else {
          setTtsProgress(40)
          const old = audioUrls[lineIdx]
          const nextUrl = await synthesizeTtsLine({
            fullVoiceId: voiceId,
            text: target.text,
            style,
            speed: speeds[lineIdx] ?? baseSpeed,
          })
          audioUrls[lineIdx] = nextUrl
          if (old?.startsWith("blob:") && old !== nextUrl) URL.revokeObjectURL(old)
        }

        setTtsProgress(88)
        const merged = await mergeAudioUrlsToWavBlobUrl(audioUrls, {
          trimSilence: true,
          interClipPadSec: 0.02,
        })
        const measured = lines.map(({ text, sceneIndex: si, displayLines }, i) => ({
          text,
          sceneIndex: si,
          durationSec: merged.lineDurationsSec[i] ?? 0.5,
          displayLines,
          speed: speeds[i],
        }))
        const cues = buildVoiceLineCues(measured)
        setVoiceLineCues(cues)
        setSceneSpeeds(speeds)
        // 짧으면 영상 끝 맞춤 / 길면 재생 루프(segments는 원본 유지)
        setAudioFitEnds(audioFitEndsFromCues(baseSegments, cues))

        if (sceneLineAudioUrlsRef.current?.length) {
          for (const u of sceneLineAudioUrlsRef.current) {
            if (u.startsWith("blob:")) URL.revokeObjectURL(u)
          }
        }
        if (ttsLineUrlsRef.current?.length && ttsLineUrlsRef.current !== audioUrls) {
          for (const u of ttsLineUrlsRef.current) {
            if (u.startsWith("blob:") && !audioUrls.includes(u)) URL.revokeObjectURL(u)
          }
        }
        ttsLineUrlsRef.current = audioUrls
        const paddedLineUrls: string[] = []
        for (const url of audioUrls) {
          paddedLineUrls.push(await padAudioUrlEnd(url, 0.08))
        }
        sceneLineAudioUrlsRef.current = paddedLineUrls

        if (fetchedTtsUrlRef.current) {
          URL.revokeObjectURL(fetchedTtsUrlRef.current)
          fetchedTtsUrlRef.current = null
        }
        const baked = await rebakeWavBlobUrl(merged.wavBlob)
        if (merged.blobUrl.startsWith("blob:")) URL.revokeObjectURL(merged.blobUrl)
        fetchedTtsUrlRef.current = baked.blobUrl
        setAudioUrl(baked.blobUrl)
        const authoritativeDur = Math.max(
          baked.durationSec,
          merged.totalDurationSec,
          cues.at(-1)?.endSec ?? 0
        )
        commitAudioDuration(authoritativeDur, "replace")
        ttsBlobRef.current = baked.wavBlob
        try {
          if (projectId && result.jobId && baked.wavBlob.size >= 512) {
            await saveMvpTtsAudio(projectId, result.jobId, baked.wavBlob)
            setEditTtsCachedJobId(result.jobId)
          }
        } catch {
          /* ignore */
        }
        const range = audioRangeForSceneIndex(sceneIndex, cues)
        if (range) {
          setAudioPlayhead(range.startSec)
          const vt = videoTimeFromAudioCueSync(
            range.startSec,
            cues,
            applyAudioFitEnds(baseSegments, audioFitEndsFromCues(baseSegments, cues)),
            videoDuration || totalSec,
            authoritativeDur
          )
          setPlayhead(vt)
        }
        setAudioKey((k) => k + 1)
        setTtsProgress(100)
        setTtsGeneratedSpeed(baseSpeed)
        setErr(
          `컷 ${sceneIndex + 1} TTS를 다시 만들었습니다. (짧으면 영상 자름 · 길면 영상 반복)`
        )
      } catch (e) {
        setErr(e instanceof Error ? e.message : "씬 TTS 생성 실패")
        setTtsProgress(0)
      } finally {
        setSceneTtsLoadingIndex(null)
        setTtsLoading(false)
      }
    },
    [
      segments,
      baseSegments,
      getSceneText,
      selectedVoiceId,
      supertoneStyle,
      speechSpeed,
      sceneFitEnabled,
      sceneSpeeds,
      voiceLineCues,
      projectId,
      result.jobId,
      commitAudioDuration,
      videoDuration,
      totalSec,
    ]
  )

  const trimSceneToAudio = useCallback(
    (sceneIndex: number) => {
      if (!voiceLineCues?.length) return
      const ends = audioFitEndsFromCues(baseSegments, voiceLineCues)
      setAudioFitEnds((prev) => {
        const next = prev?.length === baseSegments.length ? [...prev] : baseSegments.map((s) => s.end)
        next[sceneIndex] = ends[sceneIndex] ?? next[sceneIndex]!
        return next
      })
    },
    [voiceLineCues, baseSegments]
  )

  const trimAllScenesToAudio = useCallback(() => {
    if (!voiceLineCues?.length) return
    setAudioFitEnds(audioFitEndsFromCues(baseSegments, voiceLineCues))
  }, [voiceLineCues, baseSegments])

  // TTS가 있는데 장면 맞춤 끝이 없으면 자동으로 맞춤 (재생이 원본 길이에 묶이지 않도록)
  useEffect(() => {
    if (!sceneFitEnabled) return
    if (!voiceLineCues?.length || !baseSegments.length) return
    if (audioFitEnds?.length === baseSegments.length) return
    setAudioFitEnds(audioFitEndsFromCues(baseSegments, voiceLineCues))
  }, [sceneFitEnabled, voiceLineCues, baseSegments, audioFitEnds?.length])

  const handleAddThumbnail = useCallback(
    (entry: {
      url: string
      source: MvpThumbnailVariant["source"]
      hookingText?: MvpThumbnailHookingText
      studioDesign?: MvpThumbnailVariant["studioDesign"]
    }) => {
      void (async () => {
        let displayUrl = entry.url.trim()
        let blob: Blob | null = null
        try {
          const res = await fetch(displayUrl)
          blob = await res.blob()
          // data URL은 용량이 커서 persist 후 깨지기 쉬움 → blob URL로 표시
          if (blob.size >= 512 && displayUrl.startsWith("data:")) {
            displayUrl = URL.createObjectURL(blob)
            thumbnailBlobUrlsRef.current.push(displayUrl)
          }
        } catch {
          /* 원본 URL 유지 */
        }

        const { gallery, selectedId } = appendThumbnailVariant(thumbnailGallery, {
          ...entry,
          url: displayUrl,
        })

        if (projectId && blob && blob.size >= 512) {
          await saveMvpThumbnail(projectId, selectedId, blob)
        }

        setThumbnailGallery(gallery)
        setSelectedThumbnailId(selectedId)
        setThumbnailIntroOn(true)
        if (entry.hookingText) {
          setThumbnailHookingText(normalizeMvpHookingText(entry.hookingText))
        }
      })()
    },
    [thumbnailGallery, projectId]
  )

  const handleSelectThumbnail = useCallback(
    (id: string) => {
      setSelectedThumbnailId(id)
      const variant = thumbnailGallery.find((v) => v.id === id)
      if (variant?.hookingText) {
        setThumbnailHookingText(normalizeMvpHookingText(variant.hookingText))
      }
    },
    [thumbnailGallery]
  )

  const handleRemoveThumbnail = useCallback(
    (id: string) => {
      void deleteMvpThumbnail(projectId, id)
      const { gallery, selectedId } = removeThumbnailVariant(
        thumbnailGallery,
        id,
        selectedThumbnailId
      )
      setThumbnailGallery(gallery)
      setSelectedThumbnailId(selectedId)
    },
    [thumbnailGallery, selectedThumbnailId, projectId]
  )

  if (!segments.length && !resolvedVideoUrl && !result.downloadUrl) return null

  const ttsReady = Boolean(audioUrl && voiceLineCues?.length)

  /** 대본↔TTS 큐 불일치·누락 시 재생성 필요 (캡컷식: 공백·영상만 컷은 제외) */
  const ttsNeedsRegen = useMemo(() => {
    if (!voiceLineCues?.length || !segments.length) return false
    const plan = liveResult.editPlan?.edit_plan
    const stripNoise = (s: string) =>
      s
        .replace(/\s+/g, "")
        .replace(/[.,!?~…·\-'"“”‘’、。！？]/g, "")
    for (let i = 0; i < segments.length; i++) {
      if (isEditPlanBlank(plan?.[i])) continue
      const rawScript = (segments[i]?.text ?? "").replace(/\r/g, "").trim()
      // 자르기 뒤쪽처럼 대본 없는 「영상만」 컷 — TTS 재생성 불필요
      if (!rawScript) continue
      const sceneCues = voiceLineCues.filter((c) => c.sceneIndex === i)
      if (!sceneCues.length) return true
      // TTS에 넣은 문자열과 같은 규칙으로 비교 (줄바꿈·표시용 공백 차이로 오탐 방지)
      const scriptTts = narrationTtsTextFromScene(rawScript).replace(/\s+/g, " ").trim()
      const cueText = sceneCues
        .map((c) => c.text ?? "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
      const cueNorm = narrationTtsTextFromScene(cueText).replace(/\s+/g, " ").trim()
      if (!scriptTts || !cueNorm) continue
      if (scriptTts === cueNorm) continue
      if (scriptTts.startsWith(cueNorm) || cueNorm.startsWith(scriptTts)) continue
      if (stripNoise(scriptTts) === stripNoise(cueNorm)) continue
      return true
    }
    return false
  }, [voiceLineCues, segments, liveResult.editPlan?.edit_plan])

  const speedNeedsRegen = useMemo(() => {
    if (ttsGeneratedSpeed == null || !audioUrl) return false
    return Math.abs(ttsGeneratedSpeed - speechSpeed) > 0.01
  }, [ttsGeneratedSpeed, speechSpeed, audioUrl])

  const studioPhase = normalizeStudioPhase(phase)
  const chromeSlot = useEditorChromeSlot()

  useEffect(() => {
    if (!chromeSlot?.autoHideChrome) return
    chromeSlot.setChromeExtra(
      <MvpStudioStepNav phase={phase} onPhaseChange={setPhase} ttsReady={ttsReady} />
    )
    return () => chromeSlot.setChromeExtra(null)
    // setChromeExtra는 셸에서 안정 참조로 제공됩니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chromeSlot?.autoHideChrome, chromeSlot?.setChromeExtra, phase, ttsReady])

  return (
    <div className={`flex h-full min-h-0 flex-col overflow-hidden ${styles.lightTheme}`}>
      {!chromeSlot?.autoHideChrome ? (
        <div className="shrink-0">
          <MvpStudioStepNav phase={phase} onPhaseChange={setPhase} ttsReady={ttsReady} />
        </div>
      ) : null}

      <div
        className={
          studioPhase === "edit"
            ? "min-h-0 flex-1 overflow-hidden"
            : "min-h-0 flex-1 overflow-y-auto"
        }
      >
        {studioPhase === "script-style" ? (
          <MvpScriptStyleEditor
          value={scriptStyle}
          onChange={setScriptStyle}
          subtitleStyle={subtitleStyle}
          onSubtitleStyleChange={(patch) =>
            setSubtitleStyle((prev) => normalizeSubtitleStyle({ ...prev, ...patch }))
          }
          onBack={() => setPhase("edit")}
          onNext={() => setPhase("thumbnail")}
        />
        ) : null}

        {studioPhase === "thumbnail" ? (
        <MvpThumbnailGenerator
          result={liveResult}
          videoUrl={resolvedVideoUrl}
          segments={segments}
          scriptStyle={scriptStyle}
          thumbnailUrl={thumbnailUrl}
          thumbnailGallery={thumbnailGallery}
          selectedThumbnailId={selectedThumbnailId}
          hookingText={thumbnailHookingText}
          thumbnailIntroOn={thumbnailIntroOn}
          onAddThumbnail={handleAddThumbnail}
          onSelectThumbnail={handleSelectThumbnail}
          onRemoveThumbnail={handleRemoveThumbnail}
          onHookingTextChange={setThumbnailHookingText}
          onThumbnailIntroOnChange={setThumbnailIntroOn}
          onBack={() => setPhase("script-style")}
          onNext={() => setPhase("export")}
        />
        ) : null}

        {studioPhase === "export" ? (
        <MvpExportPanel
          projectName={projectName}
          projectId={projectId}
          result={liveResult}
          videoUrl={resolvedVideoUrl}
          videoBlobRef={mp4BlobRef}
          audioUrl={audioUrl}
          ttsBlobRef={ttsBlobRef}
          voiceLineCues={voiceLineCues}
          sceneText={(i) => getSceneText(i)}
          voiceId={selectedVoiceId}
          voiceStyle={supertoneStyle}
          videoDurationSec={videoDuration || totalSec}
          audioDurationSec={audioDuration}
          scriptStyle={scriptStyle}
          segments={playbackSegments}
          lineSchedule={lineSchedule}
          subtitleStyle={subtitleStyle}
          placedOverlays={placedOverlays}
          thumbnailUrl={thumbnailUrl || undefined}
          thumbnailIntroOn={thumbnailIntroOn}
          seoMeta={seoMeta}
          onSeoMetaChange={setSeoMeta}
          productName={
            liveResult.productAnalysis?.productName ||
            (liveResult.sourceKeywords?.length ? liveResult.sourceKeywords[0] : undefined) ||
            sourceKeywords[0]
          }
          sourceKeywords={
            liveResult.sourceKeywords?.length ? liveResult.sourceKeywords : sourceKeywords
          }
          bgmClips={bgmClips}
          effectClips={effectClips}
          videoSourceTransforms={videoSourceTransforms}
        />
        ) : null}

        {studioPhase === "edit" ? (
        <MvpCapCutEditor
          active={active}
          popupMode
          detailMode={detailMode}
          result={liveResult}
          segments={playbackSegments}
          baseSegments={baseSegments}
          segmentVisualHints={segmentVisualHints}
          scriptOverrides={scriptOverrides}
          onScriptOverride={(sceneId, text) => updateOverride(sceneId, text)}
          onScriptOverrideBlur={(sceneId, text) => {
            // 컷 길이에 맞춰 대본을 자르지 않음 — 사용자가 쓴 문장 유지 후 씬 TTS로 맞춤
            const cleaned = sanitizeNarrationForOutput(
              cleanNarrationLineBreaks(text.replace(/\r/g, "").trim())
            )
            if (cleaned !== text.trim()) updateOverride(sceneId, cleaned)
          }}
          onRunTtsForScene={(sceneIndex) => void runTtsForScene(sceneIndex)}
          sceneTtsLoadingIndex={sceneTtsLoadingIndex}
          scriptGenerating={scriptGenerating}
          scriptNeedsAi={scriptNeedsAi}
          ttsNeedsRegen={ttsNeedsRegen}
          speechSpeed={speechSpeed}
          onSpeechSpeedChange={(speed) => setSpeechSpeed(normalizeTtsSpeed(speed))}
          speedNeedsRegen={speedNeedsRegen}
          sceneFitEnabled={sceneFitEnabled}
          onSceneFitEnabledChange={(on) => {
            setSceneFitEnabled(on)
            if (!on) setAudioFitEnds(null)
          }}
          sceneSpeeds={sceneSpeeds}
          onTrimSceneToAudio={trimSceneToAudio}
          onTrimAllScenesToAudio={trimAllScenesToAudio}
          onGenerateScript={() => void generateNarrationScript()}
          onRewriteScript={() => void generateNarrationScript({ rewrite: true })}
          onRestoreScript={restoreScriptBaseline}
          canRestoreScript={canRestoreScript}
          scriptDirtyFromBaseline={scriptDirtyFromBaseline}
          scriptRevision={scriptRevision}
          videoReady={Boolean(resolvedVideoUrl)}
          resolvedVideoUrl={resolvedVideoUrl}
          videoLoading={videoLoading}
          videoRef={videoRef}
          audioRef={audioRef}
          audioUrl={audioUrl}
          audioKey={audioKey}
          playing={playing}
          playhead={playhead}
          audioPlayhead={audioPlayhead}
          previewTotalSec={previewTotalSec}
          subtitleLine={subtitleLine}
          subtitleStyle={subtitleStyle}
          onSubtitleStyleChange={(patch) =>
            setSubtitleStyle((prev) => normalizeSubtitleStyle({ ...prev, ...patch }))
          }
          placedOverlays={placedOverlays}
          onPlacedOverlaysChange={(next) => setPlacedOverlays(normalizePlacedOverlays(next))}
          scriptStyle={scriptStyle}
          thumbnailUrl={thumbnailUrl}
          thumbnailGallery={thumbnailGallery}
          selectedThumbnailId={selectedThumbnailId}
          thumbnailHookingText={thumbnailHookingText}
          thumbnailIntroOn={thumbnailIntroOn}
          onAddThumbnail={handleAddThumbnail}
          onSelectThumbnail={handleSelectThumbnail}
          onRemoveThumbnail={handleRemoveThumbnail}
          onThumbnailHookingTextChange={setThumbnailHookingText}
          onThumbnailIntroOnChange={setThumbnailIntroOn}
          projectName={projectName}
          sourceKeywords={
            result.sourceKeywords?.length ? result.sourceKeywords : sourceKeywords
          }
          voiceCatalog={voiceCatalog}
          voicesLoading={voicesLoading}
          voiceLoadErrors={voiceLoadErrors}
          voiceListUnavailable={voiceListUnavailable}
          selectedVoiceId={selectedVoiceId}
          onVoiceIdChange={handleVoiceIdChange}
          voiceStyle={supertoneStyle}
          onVoiceStyleChange={setSupertoneStyle}
          onReloadVoices={(provider) => void loadVoicesForProvider(provider)}
          onPreviewVoice={(voiceId, style) => void previewVoice(voiceId, style)}
          previewingVoiceId={previewingVoiceId}
          ttsLoading={ttsLoading}
          ttsProgress={ttsProgress}
          onRunTts={(opts) => void runTts(opts)}
          audioDuration={audioDuration}
          voiceLineCues={voiceLineCues}
          draftSubtitleCues={lineSchedule}
          onVoiceLineCuesChange={setVoiceLineCues}
          err={err}
          onPlayToggle={handlePlayToggle}
          bgmClips={bgmClips}
          onBgmClipsChange={setBgmClips}
          effectClips={effectClips}
          onEffectClipsChange={setEffectClips}
          videoSourceTransforms={videoSourceTransforms}
          onVideoSourceTransformsChange={setVideoSourceTransforms}
          onSplitEditPlanClip={handleSplitEditPlanClip}
          onBlankEditPlanClip={handleBlankEditPlanClip}
          onDeleteEditPlanClip={(cutIndex) => void handleDeleteEditPlanClip(cutIndex)}
          onCutEditPlanClip={(cutIndex) => void handleDeleteEditPlanClip(cutIndex, { cut: true })}
          onTimelineUndo={() => void handleTimelineUndo()}
          timelineEditBusy={timelineEditBusy}
          onReorderEditPlanClip={(from, to) => void handleReorderEditPlanClip(from, to)}
          onSeek={(t) => {
            // 빨간바·타임라인 클릭 이동: 항상 일시정지 유지 (자동 재생 금지)
            timelineScrubLockRef.current = true
            if (timelineScrubUnlockTimerRef.current) {
              clearTimeout(timelineScrubUnlockTimerRef.current)
              timelineScrubUnlockTimerRef.current = null
            }
            playingRef.current = false
            pausePreview()
            const seekT = Math.max(0, Math.min(previewTotalSec, t))
            const v = videoRef.current
            const a = audioRef.current
            // TTS 생성 후: TTS 구간은 음성 축, TTS 이후는 영상만 시크 (오버분 탐색)
            if (timelineUsesAudioAxis(voiceLineCues, audioDuration) && audioUrl) {
              const ttsEnd = Math.max(0.05, audioDuration)
              if (seekT <= ttsEnd + 0.02) {
                const audioT = Math.min(Math.max(0, ttsEnd - 0.01), seekT)
                if (a) {
                  a.pause()
                  a.currentTime = audioT
                }
                setAudioPlayhead(audioT)
                syncVideoToAudio(audioT, true)
                v?.pause()
                const vt = videoTimeFromAudioCueSync(
                  audioT,
                  voiceLineCues!,
                  playbackSegments,
                  videoDuration || totalSec,
                  audioDuration
                )
                setPlayhead(vt)
                audioLayersRef.current?.onSeek(audioT)
                audioLayersRef.current?.stop()
              } else {
                // TTS 끝 이후 — 음성은 끝에 두고, 빨간바·영상만 해당 위치로
                if (a) {
                  a.pause()
                  try {
                    a.currentTime = Math.max(0, ttsEnd - 0.01)
                  } catch {
                    /* ignore */
                  }
                }
                setAudioPlayhead(seekT)
                const vt = Math.min(
                  Math.max(0, videoDuration || totalSec),
                  seekT
                )
                if (v) {
                  v.pause()
                  try {
                    if (Number.isFinite(v.duration) && v.duration > 0) {
                      v.currentTime = Math.min(v.duration - 0.05, vt)
                    } else {
                      v.currentTime = vt
                    }
                  } catch {
                    /* ignore */
                  }
                }
                setPlayhead(vt)
                audioLayersRef.current?.onSeek(ttsEnd)
                audioLayersRef.current?.stop()
              }
              setPlaying(false)
              timelineScrubUnlockTimerRef.current = setTimeout(() => {
                timelineScrubLockRef.current = false
                timelineScrubUnlockTimerRef.current = null
                videoRef.current?.pause()
                audioRef.current?.pause()
              }, 250)
              return
            }
            setPlayhead(seekT)
            syncVideoToPlayhead(seekT)
            v?.pause()
            a?.pause()
            audioLayersRef.current?.onSeek(seekT)
            audioLayersRef.current?.stop()
            if (audioUrl && seekT < MVP_THUMBNAIL_INTRO_SEC) {
              if (a) a.currentTime = 0
              setAudioPlayhead(0)
            }
            setPlaying(false)
            timelineScrubUnlockTimerRef.current = setTimeout(() => {
              timelineScrubLockRef.current = false
              timelineScrubUnlockTimerRef.current = null
              videoRef.current?.pause()
              audioRef.current?.pause()
            }, 250)
          }}
          onVideoLoaded={setVideoDuration}
          onVideoTimeUpdate={handleVideoTimeUpdate}
          onVideoPlay={() => {
            if (!playingRef.current || timelineScrubLockRef.current) {
              videoRef.current?.pause()
              return
            }
            setPlaying(true)
          }}
          onVideoEnded={() => {
            if (!audioUrl) pausePreview()
          }}
          onAudioLoaded={(d) => {
            // HTMLAudio duration 메타는 WAV보다 짧게 나오는 경우가 많음 — 절대 줄이지 않음
            commitAudioDuration(d, "max")
          }}
          onAudioTimeUpdate={handleAudioTimeUpdate}
          onAudioEnded={() => {
            const el = audioRef.current
            const known = Math.max(
              audioDurationKnownRef.current,
              audioDuration,
              voiceLineCues?.at(-1)?.endSec ?? 0
            )
            if (el && known > 0.2) {
              // 실제 끝이 남았으면 ended를 무시하고 이어서 재생
              if (el.currentTime < known - 0.25) {
                try {
                  if (el.ended || el.paused) {
                    // ended 상태면 currentTime을 살짝 앞으로 옮겨 재개 시도
                    const resumeAt = Math.min(known - 0.05, Math.max(0, el.currentTime))
                    el.currentTime = resumeAt
                    void el.play().catch(() => {})
                  }
                } catch {
                  /* ignore */
                }
                return
              }
            }
            pausePreview()
          }}
          onPlaySceneOnly={playSceneOnly}
          activeScene={activeScene}
          onClose={onClose}
          onNext={() => setPhase("script-style")}
          onVideoReplaced={applyVideoBlob}
          projectId={projectId}
          videoBlobRef={mp4BlobRef}
          onOpenInsertClip={() => {
            if (!ttsReady) {
              setErr("TTS를 먼저 생성한 뒤 「추가 영상」으로 공백을 채워 주세요.")
              return
            }
            setInsertClipOpen(true)
          }}
          insertClipBusy={insertClipBusy}
          insertClipAllowed={ttsReady}
          onInsertClipDrop={(args) => void handleInsertClipDrop(args)}
          insertClipDropEnabled={insertClipOpen && !insertClipBusy && ttsReady}
        />
        ) : null}
      </div>

      <MvpInsertClipDialog
        open={insertClipOpen}
        onOpenChange={setInsertClipOpen}
        cutCount={baseSegments.length}
        activeCutIndex={Math.max(0, activeScene)}
        cutIsBlank={(liveResult.editPlan?.edit_plan ?? []).map((seg) => isEditPlanBlank(seg))}
        cutDurationsSec={(liveResult.editPlan?.edit_plan ?? []).map((seg) =>
          Math.max(0.4, (seg.output_end ?? 0) - (seg.output_start ?? 0))
        )}
        picks={insertClipPicks}
        busy={insertClipBusy}
        onConfirm={(choice) => void handleInsertClipConfirm(choice)}
      />

      <MvpBlankFillTrimDialog
        open={Boolean(blankFillEditor)}
        onOpenChange={(next) => {
          if (!next) closeBlankFillEditor()
        }}
        previewUrl={blankFillEditor?.previewUrl ?? null}
        blob={blankFillEditor?.blob ?? null}
        label={blankFillEditor?.label ?? ""}
        blankIndex={blankFillEditor?.blankIndex ?? 0}
        blankDurationSec={blankFillEditor?.blankDurationSec ?? 2}
        busy={insertClipBusy}
        onConfirm={(result) => {
          void (async () => {
            const ok = await handleInsertClipConfirm({
              blob: result.blob,
              label: result.label,
              durationSec: result.durationSec,
              trimStartSec: result.trimStartSec,
              afterCutIndex: result.replaceCutIndex - 1,
              replaceCutIndex: result.replaceCutIndex,
            })
            if (ok) closeBlankFillEditor()
          })()
        }}
      />
    </div>
  )
}
