"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ChevronRight,
  FilePenLine,
  FlipHorizontal,
  Film,
  Hash,
  ImageIcon,
  Loader2,
  Maximize2,
  Music2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  SkipBack,
  SkipForward,
  Sparkles,
  Type,
  ZoomIn,
  ZoomOut,
  UserRound,
  Volume2,
  VolumeX,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TypecastApiErrorNotice } from "@/components/TypecastApiGuideCard"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  ShotFormMobileEditorTabs,
  type ShotFormMobileEditorPane,
} from "@/app/WingsAIStudioShotForm/components/ShotFormMobileEditorTabs"
import { voiceAvatarFallbackColor } from "@/lib/shotform-factory-tts"
import {
  ELEVENLABS_DEFAULT_VOICE_ID,
  TTS_PROVIDER_META,
  TTS_PROVIDER_ORDER,
  buildTtsVoiceKey,
  customTtsVoiceLabel,
  defaultStyleForTtsVoice,
  isCatalogVoice,
  labelTtsStyle,
  parseBareVoiceId,
  resolveTtsVoiceDisplay,
  shouldAutoLoadVoiceCatalog,
  stylesForTtsVoice,
  ttsProviderFromVoiceId,
  type ShotformTtsVoice,
  type TtsProviderId,
} from "@/lib/shotform-tts-providers"
import { buildThumbnailHookingInput } from "@/lib/shotform-mvp-thumbnail"
import { SupertonicSetupBar } from "../components/SupertonicSetupBar"
import type { AutoEditJobResult } from "@/lib/shotform-auto-edit-types"
import type { VoiceLineCue } from "@/lib/shotform-factory-line-tts"
import type { LineSubtitleCue } from "@/lib/shotform-mvp-edit-script"
import { formatNarrationClock, narrationSegmentDuration } from "@/lib/shotform-factory-narration-script"
import {
  formatNarrationForSceneDuration,
  narrationFitForScene,
} from "@/lib/shotform-narration-timing"
import type {
  MvpScriptStyleState,
  MvpSubtitleStyle,
  MvpThumbnailHookingText,
  MvpThumbnailVariant,
} from "@/lib/mvp-studio-types"
import { normalizeSubtitleStyle } from "@/lib/mvp-studio-types"
import { buildSubtitleOverlayStyle, subtitleStageScale } from "@/lib/mvp-subtitle-style"
import { StudioPageCard, studio } from "../components/ShotFormStudioUI"
import { isMosaicOverlay, type PlacedStudioOverlay } from "@/lib/shotform-studio-overlay-catalog"
import { MvpCapCutTimeline } from "./MvpCapCutTimeline"
import { MvpEffectSoundPanel } from "./MvpEffectSoundPanel"
import {
  type MvpBgmClip,
  type MvpEffectClip,
} from "@/lib/mvp-studio-types"
import { MvpOverlayLayer } from "./MvpOverlayLayer"
import { MvpOverlayElementsPanel } from "./MvpOverlayElementsPanel"
import { MvpSubtitleStylePanel } from "./MvpSubtitleStylePanel"
import { MvpFitOneLineSubtitle } from "./MvpFitOneLineSubtitle"
import { MvpVideoClipTransformFrame } from "./MvpVideoClipTransformFrame"
import { MvpTtsSpeedPicker } from "./MvpTtsSpeedPicker"
import { MvpSceneFitPanel } from "./MvpSceneFitPanel"
import { MvpThumbnailPanel } from "./MvpThumbnailPanel"
import { MvpScriptAnalysisPanel } from "./MvpScriptAnalysisPanel"
import { MvpChineseSubtitleRemovalPanel } from "./MvpChineseSubtitleRemovalPanel"
import { MvpVisualSceneList } from "./MvpVisualSceneList"
import { MvpVoicePickerDialog } from "./MvpVoicePickerDialog"
import {
  isMvpThumbnailIntroTime,
  mvpPreviewTimelineSec,
} from "@/lib/mvp-thumbnail-intro"
import { isDisplayableThumbnailUrl } from "@/lib/mvp-thumbnail-persist"
import {
  audioRangeForSceneIndex,
  MVP_HOLD_END_ZOOM_MAX,
  mvpHoldEndZoomInfo,
  mvpSceneBoundaryFadeOpacity,
  timelineUsesAudioAxis,
  videoTimeFromAudioCueSync,
} from "@/lib/shotform-mvp-preview-sync"
import { MVP_EDIT_PLAN_SPLIT_MIN_SEC, isEditPlanBlank } from "@/lib/mvp-edit-plan-split"
import {
  drawVideoContainWithSourceTransform,
  editPlanSegmentIndexAtOutputTime,
  getMvpEditPlanClipTransform,
  isDefaultMvpVideoSourceTransform,
  mvpEditPlanClipKey,
  mvpVideoSourceTransformStyle,
  videoSourceLabel,
  type MvpVideoSourceTransform,
  type MvpVideoSourceTransforms,
} from "@/lib/mvp-video-source-transform"
import { useMvpVideoSourceZoom } from "./useMvpVideoSourceZoom"
import { insp } from "./mvpInspectorUi"

function formatPlayerTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  return [hours, minutes, secs].map((value) => String(value).padStart(2, "0")).join(":")
}

type NarrationSegment = {
  start: number
  end: number
  text: string
}

type Props = {
  active?: boolean
  popupMode?: boolean
  detailMode?: boolean
  result: AutoEditJobResult
  segments: NarrationSegment[]
  baseSegments: NarrationSegment[]
  segmentVisualHints: string[]
  scriptOverrides: Record<string, string>
  onScriptOverride: (sceneId: number, text: string) => void
  onScriptOverrideBlur: (sceneId: number, text: string, sceneDur: number) => void
  /** 씬 단위 TTS 재생성 */
  onRunTtsForScene?: (sceneIndex: number) => void
  sceneTtsLoadingIndex?: number | null
  scriptGenerating: boolean
  scriptNeedsAi: boolean
  ttsNeedsRegen?: boolean
  onGenerateScript: () => void
  onRewriteScript: () => void
  onRestoreScript?: () => void
  canRestoreScript?: boolean
  scriptDirtyFromBaseline?: boolean
  scriptRevision?: number
  videoReady?: boolean
  resolvedVideoUrl: string | null
  videoLoading: boolean
  videoRef: React.RefObject<HTMLVideoElement>
  audioRef: React.RefObject<HTMLAudioElement>
  audioUrl: string | null
  audioKey: number
  playing: boolean
  playhead: number
  audioPlayhead: number
  previewTotalSec: number
  subtitleLine: string
  subtitleStyle: MvpSubtitleStyle
  onSubtitleStyleChange: (patch: Partial<MvpSubtitleStyle>) => void
  placedOverlays: PlacedStudioOverlay[]
  onPlacedOverlaysChange: (next: PlacedStudioOverlay[]) => void
  scriptStyle: MvpScriptStyleState
  thumbnailUrl: string
  thumbnailGallery: MvpThumbnailVariant[]
  selectedThumbnailId: string | null
  thumbnailIntroOn: boolean
  thumbnailHookingText: MvpThumbnailHookingText
  onAddThumbnail: (entry: {
    url: string
    source: MvpThumbnailVariant["source"]
    hookingText?: MvpThumbnailHookingText
    studioDesign?: MvpThumbnailVariant["studioDesign"]
  }) => void
  onSelectThumbnail: (id: string) => void
  onRemoveThumbnail: (id: string) => void
  onThumbnailIntroOnChange: (on: boolean) => void
  onThumbnailHookingTextChange: (text: MvpThumbnailHookingText) => void
  projectName?: string
  sourceKeywords?: string[]
  voiceCatalog: Record<TtsProviderId, ShotformTtsVoice[]>
  voicesLoading: Record<TtsProviderId, boolean>
  voiceLoadErrors: Record<TtsProviderId, string | null>
  voiceListUnavailable: Record<TtsProviderId, boolean>
  selectedVoiceId: string
  onVoiceIdChange: (id: string) => void
  voiceStyle: string
  onVoiceStyleChange: (s: string) => void
  onReloadVoices: (provider: TtsProviderId) => void
  onPreviewVoice: (voiceId: string, style: string) => void | Promise<void>
  previewingVoiceId: string | null
  ttsLoading: boolean
  ttsProgress: number
  speechSpeed: number
  onSpeechSpeedChange: (speed: number) => void
  speedNeedsRegen?: boolean
  sceneFitEnabled?: boolean
  onSceneFitEnabledChange?: (on: boolean) => void
  sceneSpeeds?: number[] | null
  onTrimSceneToAudio?: (sceneIndex: number) => void
  onTrimAllScenesToAudio?: () => void
  onRunTts: (opts?: { voiceId?: string; style?: string; speed?: number }) => void
  audioDuration: number
  voiceLineCues: VoiceLineCue[] | null
  draftSubtitleCues?: LineSubtitleCue[]
  onVoiceLineCuesChange: (cues: VoiceLineCue[] | null) => void
  err: string | null
  onPlayToggle: () => void
  onSeek: (t: number) => void
  onVideoLoaded: (duration: number) => void
  onVideoTimeUpdate: () => void
  onVideoEnded: () => void
  onVideoPlay: () => void
  onAudioLoaded: (duration: number) => void
  onAudioTimeUpdate: () => void
  onAudioEnded: () => void
  onPlaySceneOnly: (index: number) => void
  activeScene: number
  onClose?: () => void
  onNext: () => void
  onVideoReplaced?: (blob: Blob) => void | Promise<void>
  projectId?: string
  videoBlobRef?: React.MutableRefObject<Blob | null>
  /** 대본/음성 — 부족한 초 채울 추가 영상 (TTS 생성 후) */
  onOpenInsertClip?: () => void
  insertClipBusy?: boolean
  /** false면 TTS 미생성 — 추가 영상 버튼 비활성 */
  insertClipAllowed?: boolean
  /** 팝업에서 타임라인으로 드래그 드롭 */
  onInsertClipDrop?: (args: {
    afterCutIndex: number
    replaceCutIndex?: number | null
  }) => void
  insertClipDropEnabled?: boolean
  bgmClips: MvpBgmClip[]
  onBgmClipsChange: (next: MvpBgmClip[]) => void
  effectClips: MvpEffectClip[]
  onEffectClipsChange: (next: MvpEffectClip[]) => void
  videoSourceTransforms: MvpVideoSourceTransforms
  onVideoSourceTransformsChange: (next: MvpVideoSourceTransforms) => void
  /** 선택 컷을 출력 타임라인 시각에서 자르기 */
  onSplitEditPlanClip?: (cutIndex: number, splitOutputSec: number) => void
  /** 선택 컷을 공백으로 (TTS·길이 유지) */
  onBlankEditPlanClip?: (cutIndex: number) => void
  /** 선택 컷을 타임라인에서 삭제 (Delete) */
  onDeleteEditPlanClip?: (cutIndex: number) => void
  /** 선택 컷 잘라내기 (Ctrl+X) */
  onCutEditPlanClip?: (cutIndex: number) => void
  /** 타임라인 편집 되돌리기 (Ctrl+Z) */
  onTimelineUndo?: () => void
  timelineEditBusy?: boolean
  /** 영상 컷 드래그로 순서 변경 (TTS 유지) */
  onReorderEditPlanClip?: (fromIndex: number, toIndex: number) => void
}

export function MvpCapCutEditor(props: Props) {
  const {
    active = true,
    popupMode = false,
    detailMode = false,
    result,
    segments,
    baseSegments,
    segmentVisualHints,
    scriptOverrides,
    onScriptOverride,
    onScriptOverrideBlur,
    onRunTtsForScene,
    sceneTtsLoadingIndex = null,
    scriptGenerating,
    scriptNeedsAi,
    ttsNeedsRegen = false,
    speechSpeed,
    onSpeechSpeedChange,
    speedNeedsRegen = false,
    sceneFitEnabled = true,
    onSceneFitEnabledChange,
    sceneSpeeds = null,
    onTrimSceneToAudio,
    onTrimAllScenesToAudio,
    onGenerateScript,
    onRewriteScript,
    onRestoreScript,
    canRestoreScript = false,
    scriptDirtyFromBaseline = false,
    scriptRevision = 0,
    videoReady = false,
    resolvedVideoUrl,
    videoLoading,
    videoRef,
    audioRef,
    audioUrl,
    audioKey,
    playing,
    playhead,
    audioPlayhead,
    previewTotalSec,
    subtitleLine,
    subtitleStyle,
    onSubtitleStyleChange,
    placedOverlays,
    onPlacedOverlaysChange,
    scriptStyle,
    thumbnailUrl,
    thumbnailGallery,
    selectedThumbnailId,
    thumbnailIntroOn,
    thumbnailHookingText,
    onAddThumbnail,
    onSelectThumbnail,
    onRemoveThumbnail,
    onThumbnailIntroOnChange,
    onThumbnailHookingTextChange,
    projectName,
    sourceKeywords = [],
    voiceCatalog,
    voicesLoading,
    voiceLoadErrors,
    voiceListUnavailable,
    selectedVoiceId,
    onVoiceIdChange,
    voiceStyle,
    onVoiceStyleChange,
    onReloadVoices,
    onPreviewVoice,
    previewingVoiceId,
    ttsLoading,
    ttsProgress,
    onRunTts,
    audioDuration,
    voiceLineCues,
    draftSubtitleCues = [],
    onVoiceLineCuesChange,
    err,
    onPlayToggle,
    onSeek,
    onVideoLoaded,
    onVideoTimeUpdate,
    onVideoEnded,
    onVideoPlay,
    onAudioLoaded,
    onAudioTimeUpdate,
    onAudioEnded,
  onPlaySceneOnly,
  activeScene,
  onClose,
  onNext,
  onVideoReplaced,
  projectId,
  videoBlobRef,
  onOpenInsertClip,
  insertClipBusy = false,
  insertClipAllowed = true,
  onInsertClipDrop,
  insertClipDropEnabled = false,
  bgmClips,
    onBgmClipsChange,
    effectClips,
    onEffectClipsChange,
    videoSourceTransforms,
    onVideoSourceTransformsChange,
    onSplitEditPlanClip,
    onBlankEditPlanClip,
    onDeleteEditPlanClip,
    onCutEditPlanClip,
    onTimelineUndo,
    timelineEditBusy = false,
    onReorderEditPlanClip,
  } = props

  const subStyle = normalizeSubtitleStyle(subtitleStyle)
  const previewStageRef = useRef<HTMLDivElement | null>(null)
  const [subtitleStageScalePx, setSubtitleStageScalePx] = useState(1)
  const [selectedCueIndex, setSelectedCueIndex] = useState(-1)
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null)
  const [inspectorTab, setInspectorTab] = useState<
    "script" | "voice" | "subtitle" | "audio" | "thumbnail"
  >("script")
  const [selectedBgmClipId, setSelectedBgmClipId] = useState<string | null>(null)
  const [selectedEffectClipId, setSelectedEffectClipId] = useState<string | null>(null)
  const [selectedEditPlanIndex, setSelectedEditPlanIndex] = useState<number | null>(null)
  const [clipThumbnails, setClipThumbnails] = useState<Record<number, string>>({})
  const [timelineHeight, setTimelineHeight] = useState(220)
  const [previewScale, setPreviewScale] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const timelineResizeCleanupRef = useRef<(() => void) | null>(null)
  const isMobile = useIsMobile()
  const mobileEditor = Boolean(popupMode && isMobile)
  const [mobilePane, setMobilePane] = useState<ShotFormMobileEditorPane>("preview")

  useEffect(() => {
    if (!mobileEditor) return
    // 폰에서는 타임라인을 더 높게 써서 트랙 편집 가능하게
    setTimelineHeight((h) => Math.max(h, 280))
  }, [mobileEditor])

  const deleteSelectedBgmClip = useCallback(() => {
    if (!selectedBgmClipId) return
    onBgmClipsChange(bgmClips.filter((c) => c.id !== selectedBgmClipId))
    setSelectedBgmClipId(null)
  }, [selectedBgmClipId, bgmClips, onBgmClipsChange])

  useEffect(() => {
    const stage = previewStageRef.current
    if (!stage) return
    const updateScale = () => {
      setSubtitleStageScalePx(subtitleStageScale(stage.clientWidth))
    }
    updateScale()
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateScale) : null
    ro?.observe(stage)
    return () => ro?.disconnect()
  }, [popupMode, previewScale, detailMode])

  const deleteSelectedOverlay = useCallback(() => {
    if (!selectedOverlayId) return false
    const target = placedOverlays.find((o) => o.id === selectedOverlayId)
    if (!target || !isMosaicOverlay(target.catalogId)) return false
    onPlacedOverlaysChange(placedOverlays.filter((o) => o.id !== selectedOverlayId))
    setSelectedOverlayId(null)
    return true
  }, [selectedOverlayId, placedOverlays, onPlacedOverlaysChange])

  useEffect(() => {
    if (!active) return
    const isTypingTarget = (el: Element | null) =>
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement ||
      (el instanceof HTMLElement && el.isContentEditable)

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(document.activeElement)) return

      // 스페이스 — 재생 / 일시정지 (입력 필드에 포커스 없을 때만)
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault()
        onPlayToggle()
        return
      }

      // Ctrl+Z — 되돌리기
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        if (onTimelineUndo) {
          e.preventDefault()
          onTimelineUndo()
        }
        return
      }

      // Ctrl+X — 선택 영상 컷 잘라내기
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x") {
        if (selectedEditPlanIndex != null && onCutEditPlanClip && !timelineEditBusy) {
          e.preventDefault()
          onCutEditPlanClip(selectedEditPlanIndex)
        }
        return
      }

      if (e.key !== "Delete" && e.key !== "Backspace") return
      if (deleteSelectedOverlay()) {
        e.preventDefault()
        return
      }
      if (selectedEffectClipId) {
        e.preventDefault()
        onEffectClipsChange(effectClips.filter((clip) => clip.id !== selectedEffectClipId))
        setSelectedEffectClipId(null)
        return
      }
      // 선택 영상 컷 → 삭제하되 자리는 공백으로 유지 (뒤 클립 당기지 않음)
      if (selectedEditPlanIndex != null && onBlankEditPlanClip) {
        e.preventDefault()
        onBlankEditPlanClip(selectedEditPlanIndex)
        return
      }
      if (!selectedBgmClipId) return
      e.preventDefault()
      deleteSelectedBgmClip()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [
    active,
    selectedBgmClipId,
    selectedEffectClipId,
    selectedOverlayId,
    selectedEditPlanIndex,
    onBlankEditPlanClip,
    onCutEditPlanClip,
    onTimelineUndo,
    timelineEditBusy,
    deleteSelectedBgmClip,
    deleteSelectedOverlay,
    effectClips,
    onEffectClipsChange,
    onPlayToggle,
  ])

  useEffect(
    () => () => {
      timelineResizeCleanupRef.current?.()
      timelineResizeCleanupRef.current = null
    },
    []
  )

  const startTimelineResize = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      timelineResizeCleanupRef.current?.()
      const startY = event.clientY
      const startHeight = timelineHeight

      const handleMove = (moveEvent: PointerEvent) => {
        const maximum = Math.min(560, Math.max(220, window.innerHeight * 0.58))
        setTimelineHeight(
          Math.round(Math.min(maximum, Math.max(128, startHeight - (moveEvent.clientY - startY))))
        )
      }
      const cleanup = () => {
        window.removeEventListener("pointermove", handleMove)
        window.removeEventListener("pointerup", cleanup)
        window.removeEventListener("pointercancel", cleanup)
        timelineResizeCleanupRef.current = null
      }

      timelineResizeCleanupRef.current = cleanup
      window.addEventListener("pointermove", handleMove)
      window.addEventListener("pointerup", cleanup)
      window.addEventListener("pointercancel", cleanup)
    },
    [timelineHeight]
  )

  const thumbnailProductName =
    result.productAnalysis?.productName || scriptStyle.commentKeyword || "제품"
  const thumbnailHookingInput = useMemo(
    () =>
      buildThumbnailHookingInput({
        productName: thumbnailProductName,
        productAnalysis: result.productAnalysis,
        scriptStyle,
        segments,
      }),
    [thumbnailProductName, result.productAnalysis, scriptStyle, segments]
  )
  const [scriptOpen, setScriptOpen] = useState(false)
  const [voicePickerOpen, setVoicePickerOpen] = useState(false)
  const [sidebarProvider, setSidebarProvider] = useState<TtsProviderId>(
    () => ttsProviderFromVoiceId(selectedVoiceId) ?? "supertone"
  )
  const [customIdDraft, setCustomIdDraft] = useState("")

  useEffect(() => {
    const p = ttsProviderFromVoiceId(selectedVoiceId)
    if (p) setSidebarProvider(p)
  }, [selectedVoiceId])

  useEffect(() => {
    if (ttsProviderFromVoiceId(selectedVoiceId) !== sidebarProvider) return
    const bare = parseBareVoiceId(selectedVoiceId)?.bareId ?? ""
    if (!bare) return
    if (!isCatalogVoice(selectedVoiceId, voiceCatalog[sidebarProvider] ?? [], sidebarProvider)) {
      setCustomIdDraft(bare)
    }
  }, [selectedVoiceId, sidebarProvider, voiceCatalog])

  useEffect(() => {
    if (sidebarProvider !== "typecast") return
    if (ttsProviderFromVoiceId(selectedVoiceId) === "typecast") return
    const first = voiceCatalog.typecast[0]
    if (!first || voicesLoading.typecast) return
    onVoiceIdChange(buildTtsVoiceKey("typecast", first.voice_id))
    onVoiceStyleChange(defaultStyleForTtsVoice("typecast", first))
  }, [
    sidebarProvider,
    selectedVoiceId,
    voiceCatalog.typecast,
    voicesLoading.typecast,
    onVoiceIdChange,
    onVoiceStyleChange,
  ])

  const providerMeta = TTS_PROVIDER_META[sidebarProvider]
  const providerVoiceError = voiceLoadErrors[sidebarProvider]
  const providerLoading = voicesLoading[sidebarProvider]
  const providerVoices = voiceCatalog[sidebarProvider] ?? []
  const voiceMatchesSidebar =
    Boolean(selectedVoiceId) && ttsProviderFromVoiceId(selectedVoiceId) === sidebarProvider
  const selectedVoice = voiceMatchesSidebar
    ? resolveTtsVoiceDisplay(selectedVoiceId, voiceCatalog)
    : null
  const resolveActiveVoiceId = useCallback((): string | null => {
    const draft = customIdDraft.trim()
    if (draft) return buildTtsVoiceKey(sidebarProvider, draft)
    if (voiceMatchesSidebar && selectedVoiceId) return selectedVoiceId
    return null
  }, [customIdDraft, sidebarProvider, voiceMatchesSidebar, selectedVoiceId])

  const activeVoiceId = resolveActiveVoiceId()
  const ttsReadyForProvider = Boolean(activeVoiceId)
  const isCustomVoice =
    Boolean(customIdDraft.trim()) ||
    (voiceMatchesSidebar &&
      Boolean(selectedVoiceId) &&
      !isCatalogVoice(selectedVoiceId, providerVoices, sidebarProvider))
  const displayVoice: ShotformTtsVoice | null =
    (voiceMatchesSidebar && selectedVoice) ||
    (activeVoiceId && customIdDraft.trim()
      ? customTtsVoiceLabel(sidebarProvider, activeVoiceId)
      : voiceMatchesSidebar && isCustomVoice
        ? customTtsVoiceLabel(sidebarProvider, selectedVoiceId)
        : null)
  const voiceStyles = stylesForTtsVoice(sidebarProvider, displayVoice)

  const switchSidebarProvider = useCallback(
    (next: TtsProviderId) => {
      setSidebarProvider(next)
      setCustomIdDraft("")
      if (!voicesLoading[next]) {
        if (next === "supertonic") {
          void onReloadVoices(next)
        } else if (
          shouldAutoLoadVoiceCatalog(next, voiceCatalog[next] ?? [])
        ) {
          void onReloadVoices(next)
        }
      }
      if (ttsProviderFromVoiceId(selectedVoiceId) === next) return
      const first =
        next === "elevenlabs"
          ? (voiceCatalog.elevenlabs.find((v) => v.voice_id === ELEVENLABS_DEFAULT_VOICE_ID) ??
            voiceCatalog.elevenlabs[0])
          : voiceCatalog[next]?.[0]
      if (first) {
        onVoiceIdChange(buildTtsVoiceKey(next, first.voice_id))
        onVoiceStyleChange(defaultStyleForTtsVoice(next, first))
      }
    },
    [onReloadVoices, onVoiceIdChange, onVoiceStyleChange, selectedVoiceId, voiceCatalog, voicesLoading]
  )

  const pickElevenlabsSample = useCallback(
    (bareId: string) => {
      setCustomIdDraft("")
      onVoiceIdChange(buildTtsVoiceKey("elevenlabs", bareId))
      onVoiceStyleChange(defaultStyleForTtsVoice("elevenlabs", null))
    },
    [onVoiceIdChange, onVoiceStyleChange]
  )

  const pickSupertonicVoice = useCallback(
    (bareId: string) => {
      setCustomIdDraft("")
      onVoiceIdChange(buildTtsVoiceKey("supertonic", bareId))
      onVoiceStyleChange("")
    },
    [onVoiceIdChange, onVoiceStyleChange]
  )

  const applyCustomVoiceId = useCallback(() => {
    const id = customIdDraft.trim()
    if (!id) return
    const key = buildTtsVoiceKey(sidebarProvider, id)
    onVoiceIdChange(key)
    onVoiceStyleChange(defaultStyleForTtsVoice(sidebarProvider, null))
  }, [customIdDraft, onVoiceIdChange, onVoiceStyleChange, sidebarProvider])

  const handleRunTts = useCallback(() => {
    const voiceId = resolveActiveVoiceId()
    if (!voiceId) return
    if (voiceId !== selectedVoiceId) {
      onVoiceIdChange(voiceId)
      onVoiceStyleChange(defaultStyleForTtsVoice(sidebarProvider, null))
    }
    onRunTts({ voiceId, style: voiceStyle, speed: speechSpeed })
  }, [
    onRunTts,
    speechSpeed,
    onVoiceIdChange,
    onVoiceStyleChange,
    resolveActiveVoiceId,
    selectedVoiceId,
    sidebarProvider,
    voiceStyle,
  ])

  const handlePreviewVoice = useCallback(() => {
    const voiceId = resolveActiveVoiceId()
    if (!voiceId) return
    void onPreviewVoice(voiceId, voiceStyle)
  }, [onPreviewVoice, resolveActiveVoiceId, voiceStyle])

  const updateOverlayById = useCallback(
    (id: string, patch: Partial<PlacedStudioOverlay>) => {
      onPlacedOverlaysChange(placedOverlays.map((o) => (o.id === id ? { ...o, ...patch } : o)))
    },
    [onPlacedOverlaysChange, placedOverlays]
  )
  const editPlan = result.editPlan?.edit_plan ?? []
  useEffect(() => {
    if (selectedEditPlanIndex == null) return
    if (editPlan.length === 0) {
      setSelectedEditPlanIndex(null)
      return
    }
    if (selectedEditPlanIndex >= editPlan.length) {
      setSelectedEditPlanIndex(editPlan.length - 1)
    }
  }, [editPlan.length, selectedEditPlanIndex])
  const useAudioTimeline = timelineUsesAudioAxis(voiceLineCues, audioDuration)
  // 타임라인 표시 시각: TTS 있으면 음성 시간, 없으면 영상 시간
  const previewTimelineSec = useAudioTimeline
    ? audioPlayhead
    : mvpPreviewTimelineSec(audioUrl, playhead)
  const showThumbnailIntro =
    thumbnailIntroOn &&
    isDisplayableThumbnailUrl(thumbnailUrl) &&
    isMvpThumbnailIntroTime(previewTimelineSec)
  // 활성 컷 인덱스는 항상 영상 재생 위치 기준
  const previewClipIndex = editPlanSegmentIndexAtOutputTime(editPlan, playhead)
  const previewTransform = getMvpEditPlanClipTransform(videoSourceTransforms, previewClipIndex)
  // React 30fps 리렌더마다 style 객체가 바뀌면 transform이 리셋되어 줌이 떨림
  const previewVideoStyle = useMemo(
    () => (showThumbnailIntro ? undefined : mvpVideoSourceTransformStyle(previewTransform)),
    [showThumbnailIntro, previewTransform.scale, previewTransform.flipH]
  )
  const holdFreezeCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const holdZoomAnimRef = useRef<Animation | null>(null)
  const holdZoomSceneRef = useRef(-1)
  const holdZoomLastAudioTRef = useRef(0)
  const sceneFadeLayerRef = useRef<HTMLDivElement | null>(null)
  const previewTransformRef = useRef(previewTransform)
  previewTransformRef.current = previewTransform

  /**
   * <video>에 CSS scale을 걸면 브라우저 비디오 레이어가 프레임마다 재합성되며 흔들림.
   * → 홀드 시작 시 마지막 프레임을 canvas에 고정하고, 그 정지 이미지만 WAAPI로 줌.
   */
  useEffect(() => {
    let raf = 0
    const canvasInit = holdFreezeCanvasRef.current
    if (canvasInit) {
      canvasInit.style.visibility = "hidden"
      canvasInit.style.willChange = "transform"
      canvasInit.style.transformOrigin = "center center"
    }

    const setVideoHidden = (hidden: boolean) => {
      const v = videoRef.current
      if (!v) return
      // 홀드 줌용만 제어. 썸네일 인트로는 React class(opacity-0)로 숨김 —
      // 여기에 intro 플래그를 넣으면 effect cleanup stale closure가
      // 인트로 종료 후에도 opacity:0을 남겨 영상이 검게 보임.
      v.style.transition = "none"
      v.style.opacity = hidden ? "0" : ""
    }

    const clearHoldZoom = () => {
      holdZoomAnimRef.current?.cancel()
      holdZoomAnimRef.current = null
      holdZoomSceneRef.current = -1
      const canvas = holdFreezeCanvasRef.current
      if (canvas) {
        canvas.style.visibility = "hidden"
        canvas.style.transform = "translateZ(0) scale(1)"
        const ctx = canvas.getContext("2d")
        if (ctx && canvas.width && canvas.height) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
      }
      setVideoHidden(false)
    }

    const captureFreezeFrame = (): boolean => {
      const video = videoRef.current
      const canvas = holdFreezeCanvasRef.current
      const stage = canvas?.parentElement
      if (!video || !canvas || !stage || video.readyState < 2) return false

      const cssW = Math.max(1, stage.clientWidth)
      const cssH = Math.max(1, stage.clientHeight)
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const cw = Math.round(cssW * dpr)
      const ch = Math.round(cssH * dpr)
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw
        canvas.height = ch
      }

      const ctx = canvas.getContext("2d")
      if (!ctx) return false
      try {
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.fillStyle = "#000000"
        ctx.fillRect(0, 0, cw, ch)
        drawVideoContainWithSourceTransform(ctx, video, cw, ch, previewTransformRef.current)
        return true
      } catch {
        // cross-origin 등으로 캡처 실패 시 비디오 줌으로 폴백하지 않음(흔들림) — 다음 프레임 재시도
        return false
      }
    }

    const tick = () => {
      const canvas = holdFreezeCanvasRef.current
      const fadeLayer = sceneFadeLayerRef.current
      const a = audioRef.current
      const audioT = a && Number.isFinite(a.currentTime) ? a.currentTime : 0

      // 컷 경계 페이드 — 홀드와 무관하게 매 프레임 적용
      if (fadeLayer) {
        if (voiceLineCues?.length && audioUrl) {
          const op = mvpSceneBoundaryFadeOpacity(audioT, voiceLineCues)
          fadeLayer.style.opacity = String(op)
        } else {
          fadeLayer.style.opacity = "1"
        }
      }

      if (!canvas || !voiceLineCues?.length || !audioUrl) {
        if (holdZoomSceneRef.current >= 0) clearHoldZoom()
        raf = requestAnimationFrame(tick)
        return
      }

      const info = mvpHoldEndZoomInfo(audioT, voiceLineCues, segments)
      const seeked = Math.abs(audioT - holdZoomLastAudioTRef.current) > 0.2
      holdZoomLastAudioTRef.current = audioT

      if (!info) {
        if (holdZoomSceneRef.current >= 0) clearHoldZoom()
        raf = requestAnimationFrame(tick)
        return
      }

      const audioPlaying = Boolean(a && !a.paused && !a.ended)

      if (holdZoomSceneRef.current !== info.sceneIndex || !holdZoomAnimRef.current) {
        holdZoomAnimRef.current?.cancel()
        if (!captureFreezeFrame()) {
          raf = requestAnimationFrame(tick)
          return
        }
        holdZoomSceneRef.current = info.sceneIndex
        // 비디오 레이어는 숨기고 정지 프레임만 줌 (흔들림 제거)
        setVideoHidden(true)
        canvas.style.visibility = "visible"
        canvas.style.transform = ""
        const anim = canvas.animate(
          [
            { transform: "translateZ(0) scale(1)" },
            { transform: `translateZ(0) scale(${MVP_HOLD_END_ZOOM_MAX})` },
          ],
          {
            duration: Math.max(250, info.holdPadSec * 1000),
            easing: "cubic-bezier(0.45, 0.05, 0.55, 0.95)",
            fill: "forwards",
          }
        )
        anim.currentTime = info.progress * Math.max(250, info.holdPadSec * 1000)
        if (!audioPlaying) anim.pause()
        holdZoomAnimRef.current = anim
      } else {
        const anim = holdZoomAnimRef.current
        const dur = Math.max(250, info.holdPadSec * 1000)
        const want = info.progress * dur
        if (seeked) {
          // 시크 시에만 프레임 다시 찍고 애니 위치 맞춤
          captureFreezeFrame()
          const cur = Number(anim.currentTime ?? 0)
          if (Math.abs(cur - want) > 40) anim.currentTime = want
        }
        if (audioPlaying && anim.playState === "paused") anim.play()
        if (!audioPlaying && anim.playState === "running") anim.pause()
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      clearHoldZoom()
    }
  }, [voiceLineCues, segments, audioUrl, audioRef, videoRef])

  // 썸네일 인트로가 끝나면 인라인 opacity 잔여를 제거해 영상이 다시 보이게
  useEffect(() => {
    if (showThumbnailIntro) return
    const v = videoRef.current
    if (!v) return
    if (v.style.opacity === "0") v.style.opacity = ""
  }, [showThumbnailIntro, videoRef])

  /** 영상 시각 → 타임라인 축 시각으로 변환 후 seek */
  const seekToSceneIndex = useCallback(
    (sceneIndex: number) => {
      if (useAudioTimeline && voiceLineCues?.length) {
        const range = audioRangeForSceneIndex(sceneIndex, voiceLineCues)
        if (range) {
          onSeek(range.startSec)
          return
        }
      }
      onSeek(editPlan[sceneIndex]?.output_start ?? 0)
    },
    [useAudioTimeline, voiceLineCues, editPlan, onSeek]
  )
  const selectedClipSegment =
    selectedEditPlanIndex != null ? editPlan[selectedEditPlanIndex] ?? null : null
  const selectedClipIsBlank = isEditPlanBlank(selectedClipSegment)
  const previewClipIsBlank = isEditPlanBlank(editPlan[previewClipIndex] ?? null)
  const selectedVideoTransform = getMvpEditPlanClipTransform(
    videoSourceTransforms,
    selectedEditPlanIndex
  )

  const splitSelectedVideoClip = useCallback(() => {
    if (!onSplitEditPlanClip) return
    if (selectedEditPlanIndex == null || !selectedClipSegment) {
      window.alert("자를 영상 컷을 타임라인에서 먼저 선택하세요.")
      return
    }
    const videoDur = Math.max(
      0.5,
      segments.at(-1)?.end ?? editPlan.at(-1)?.output_end ?? playhead
    )
    const splitOutputSec =
      useAudioTimeline && voiceLineCues?.length
        ? videoTimeFromAudioCueSync(
            audioPlayhead,
            voiceLineCues,
            segments,
            videoDur,
            audioDuration
          )
        : playhead

    const min = MVP_EDIT_PLAN_SPLIT_MIN_SEC
    if (
      splitOutputSec <= selectedClipSegment.output_start + min ||
      splitOutputSec >= selectedClipSegment.output_end - min
    ) {
      window.alert(
        `빨간바를 선택한 컷 안쪽(양끝 ${min}초 제외)에 두고 자르세요.`
      )
      return
    }
    onSplitEditPlanClip(selectedEditPlanIndex, splitOutputSec)
  }, [
    onSplitEditPlanClip,
    selectedEditPlanIndex,
    selectedClipSegment,
    useAudioTimeline,
    voiceLineCues,
    audioPlayhead,
    segments,
    editPlan,
    playhead,
    audioDuration,
  ])

  useEffect(() => {
    if (!popupMode || !resolvedVideoUrl || !editPlan.length) {
      setClipThumbnails({})
      return
    }

    let cancelled = false
    const video = document.createElement("video")
    video.muted = true
    video.playsInline = true
    video.preload = "auto"
    if (/^https?:\/\//i.test(resolvedVideoUrl)) video.crossOrigin = "anonymous"

    const waitForEvent = (eventName: "loadedmetadata" | "seeked") =>
      new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          cleanup()
          reject(new Error(`${eventName} timeout`))
        }, 10_000)
        const onDone = () => {
          cleanup()
          resolve()
        }
        const onError = () => {
          cleanup()
          reject(new Error("영상 프레임을 불러오지 못했습니다."))
        }
        const cleanup = () => {
          window.clearTimeout(timeout)
          video.removeEventListener(eventName, onDone)
          video.removeEventListener("error", onError)
        }
        video.addEventListener(eventName, onDone, { once: true })
        video.addEventListener("error", onError, { once: true })
      })

    const capture = async () => {
      video.src = resolvedVideoUrl
      if (video.readyState < 1) await waitForEvent("loadedmetadata")
      const canvas = document.createElement("canvas")
      canvas.width = 90
      canvas.height = 160
      const ctx = canvas.getContext("2d")
      if (!ctx || !video.videoWidth || !video.videoHeight) return

      const next: Record<number, string> = {}
      for (let index = 0; index < editPlan.length; index += 1) {
        if (cancelled) return
        const clip = editPlan[index]!
        const target = Math.max(
          0,
          Math.min(
            Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.05) : clip.output_start,
            clip.output_start + 0.04
          )
        )
        if (Math.abs(video.currentTime - target) > 0.015) {
          video.currentTime = target
          await waitForEvent("seeked")
        }

        const scale = Math.max(
          canvas.width / video.videoWidth,
          canvas.height / video.videoHeight
        )
        const drawWidth = video.videoWidth * scale
        const drawHeight = video.videoHeight * scale
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(
          video,
          (canvas.width - drawWidth) / 2,
          (canvas.height - drawHeight) / 2,
          drawWidth,
          drawHeight
        )
        next[index] = canvas.toDataURL("image/jpeg", 0.78)
        if (!cancelled) setClipThumbnails({ ...next })
      }
    }

    void capture().catch((reason) => {
      console.warn("[MvpCapCutEditor] 컷 썸네일 생성 실패:", reason)
    })

    return () => {
      cancelled = true
      video.pause()
      video.removeAttribute("src")
      video.load()
    }
  }, [editPlan, popupMode, resolvedVideoUrl])

  const patchVideoSourceTransform = useCallback(
    (clipIndex: number, patch: Partial<MvpVideoSourceTransform>) => {
      const key = mvpEditPlanClipKey(clipIndex)
      const prev = getMvpEditPlanClipTransform(videoSourceTransforms, clipIndex)
      const next = { ...prev, ...patch }
      if (isDefaultMvpVideoSourceTransform(next)) {
        const { [key]: _removed, ...rest } = videoSourceTransforms
        onVideoSourceTransformsChange(rest)
        return
      }
      onVideoSourceTransformsChange({ ...videoSourceTransforms, [key]: next })
    },
    [videoSourceTransforms, onVideoSourceTransformsChange]
  )

  const selectPreviewClip = useCallback(() => {
    if (showThumbnailIntro || !editPlan.length) return
    setSelectedEditPlanIndex(previewClipIndex)
    setSelectedCueIndex(-1)
    setSelectedOverlayId(null)
    setSelectedBgmClipId(null)
    setSelectedEffectClipId(null)
  }, [showThumbnailIntro, editPlan.length, previewClipIndex])

  const videoClipSelectedOnPreview =
    selectedEditPlanIndex != null &&
    selectedEditPlanIndex === previewClipIndex &&
    !showThumbnailIntro

  const videoZoom = useMvpVideoSourceZoom({
    enabled: videoClipSelectedOnPreview,
    scale: selectedVideoTransform.scale,
    onScaleChange: (scale) => {
      if (selectedEditPlanIndex == null) return
      patchVideoSourceTransform(selectedEditPlanIndex, { scale })
    },
  })
  const previewSubtitleText = showThumbnailIntro
    ? ""
    : subtitleLine || segments[0]?.text?.split("\n")[0] || ""

  const cues = voiceLineCues ?? []
  const selectedCue = selectedCueIndex >= 0 ? cues[selectedCueIndex] : null
  const ttsReady = Boolean(audioUrl && cues.length)

  const updateCue = (idx: number, partial: Partial<VoiceLineCue>) => {
    if (!voiceLineCues) return
    onVoiceLineCuesChange(voiceLineCues.map((c, i) => (i === idx ? { ...c, ...partial } : c)))
  }

  return (
    <StudioPageCard
      padded={false}
      className={cn(
        "overflow-hidden border-violet-500/25 bg-[#0c0c0e] p-0",
        popupMode &&
          "flex h-full min-h-0 flex-col rounded-none border-0 bg-[#f7f8fa] shadow-none"
      )}
      style={popupMode ? { backgroundColor: "#f7f8fa" } : undefined}
    >
      <div
        className={cn(
          "flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-4 py-3",
          popupMode && "hidden"
        )}
      >
        <div>
          <p className={studio.label}>5. 영상 편집</p>
          <h3 className="mt-0.5 text-lg font-semibold text-white">미리보기 · TTS · 자막 타임라인</h3>
          <p className="mt-1 text-xs text-slate-400">
            영상 위에서 자막을 확인하고, 타임라인에서 줄을 클릭해 편집하세요.
          </p>
        </div>
        <div className="flex gap-2">
          {ttsReady ? (
            <Button type="button" size="sm" variant="ghost" className={cn(studio.btnPrimary, "h-9")} onClick={onNext}>
              자막·대본 →
              <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          ) : null}
          {onClose ? (
            <Button type="button" size="sm" variant="ghost" className="text-slate-400" onClick={onClose}>
              닫기
            </Button>
          ) : null}
        </div>
      </div>

      {err ? (
        <div className="px-4 pt-3">
          <p className="text-sm text-red-300">{err}</p>
          <TypecastApiErrorNotice message={err} />
        </div>
      ) : null}

      {speedNeedsRegen && ttsReady ? (
        <div className="mx-4 mt-3 rounded-lg border border-violet-500/35 bg-violet-950/25 px-3 py-2.5 text-xs leading-relaxed text-violet-100">
          나레이션 속도가 변경되었습니다. <strong className="text-white">TTS 다시 생성</strong>을 눌러
          자막·영상 싱크를 맞춰 주세요.
        </div>
      ) : null}

      {ttsNeedsRegen && ttsReady ? (
        <div
          className={cn(
            "mx-4 mt-3 rounded-lg border px-3 py-2.5 text-xs leading-relaxed",
            popupMode
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-amber-500/35 bg-amber-950/25 text-amber-100"
          )}
        >
          일부 컷의 대본과 TTS가 맞지 않습니다. 「대본」 탭에서 확인한 뒤{" "}
          <strong className={popupMode ? "text-amber-950" : "text-white"}>TTS 다시 생성</strong>을 눌러
          주세요. (영상만 자르거나 공백으로 바꾼 경우는 TTS를 다시 만들 필요 없습니다.)
        </div>
      ) : null}

      {videoReady && segments.length > 0 ? (
        <div
          className={cn(
            "mx-4 mt-3 rounded-lg border px-3 py-2.5 text-xs leading-relaxed",
            popupMode && "hidden",
            scriptNeedsAi || scriptGenerating
              ? "border-amber-500/35 bg-amber-950/25 text-amber-100"
              : "border-emerald-500/30 bg-emerald-950/25 text-emerald-100"
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p>
              <strong className={scriptNeedsAi || scriptGenerating ? "text-amber-50" : "text-emerald-50"}>
                영상 리믹스는 완료되었습니다.
              </strong>{" "}
              {scriptGenerating ? (
                <>장면별 <strong className="text-white">AI 나레이션 대본</strong>을 작성 중입니다…</>
              ) : scriptNeedsAi ? (
                <>
                  지금 자막·대본 칸은 <strong className="text-white">장면 설명에서 뽑은 임시 문구</strong>입니다.
                  「AI 대본」으로 나레이션을 작성한 뒤 TTS를 생성하세요.
                </>
              ) : (
                <>
                  AI 나레이션 대본이 적용되었습니다. 수정하거나{" "}
                  <strong className="text-white">대본만 다시쓰기</strong>로 새 문장을 받을 수 있습니다.
                </>
              )}
            </p>
            {!scriptGenerating ? (
              <div className="flex shrink-0 flex-wrap gap-2">
                {scriptNeedsAi ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className={cn(studio.btnPrimary, "h-7 gap-1 text-[10px]")}
                    onClick={onGenerateScript}
                  >
                    <Sparkles className="h-3 w-3" />
                    AI 대본
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={cn(studio.btnOutline, "h-7 gap-1 text-[10px]")}
                      onClick={onRewriteScript}
                    >
                      <FilePenLine className="h-3 w-3" />
                      대본만 다시쓰기
                    </Button>
                    {canRestoreScript && scriptDirtyFromBaseline && onRestoreScript ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={cn(studio.btnGhost, "h-7 gap-1 text-[10px]")}
                        onClick={onRestoreScript}
                        title="AI 대본 생성 직후 상태로 되돌립니다 (TTS 생성 전만)"
                      >
                        <RotateCcw className="h-3 w-3" />
                        원상복구
                      </Button>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className={
          popupMode
            ? cn(
                "min-h-0 flex-1 gap-0",
                mobileEditor
                  ? "flex flex-col"
                  : "grid grid-cols-[112px_minmax(0,1fr)_340px]"
              )
            : "grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]"
        }
        style={
          popupMode && !mobileEditor
            ? { gridTemplateRows: `minmax(0, 1fr) ${timelineHeight}px` }
            : undefined
        }
      >
        {popupMode ? (
          <aside
            className={cn(
              "min-h-0 overflow-y-auto border-r border-white/10 bg-[#101012] p-2",
              mobileEditor &&
                (mobilePane === "preview"
                  ? "max-h-[88px] shrink-0 overflow-x-auto overflow-y-hidden border-b border-r-0 p-1.5"
                  : "hidden")
            )}
            style={{ backgroundColor: "#ffffff" }}
          >
            <p
              className={cn(
                "px-1 pb-2 text-[10px] font-semibold text-slate-500",
                mobileEditor && "sr-only"
              )}
            >
              전체 컷
            </p>
            <div className={cn("space-y-2", mobileEditor && "flex flex-row gap-2 space-y-0")}>
              {editPlan.map((clip, index) => {
                const selected = selectedEditPlanIndex === index
                const activeClip = previewClipIndex === index
                return (
                  <button
                    key={`${clip.video_id}-${clip.output_start}-${index}`}
                    type="button"
                    className={cn(
                      "overflow-hidden rounded-lg border text-left transition",
                      mobileEditor ? "w-[64px] shrink-0" : "w-full",
                      selected
                        ? "border-violet-400 bg-violet-500/15"
                        : activeClip
                          ? "border-emerald-400/50 bg-emerald-500/10"
                          : "border-white/10 bg-black/25 hover:border-white/20"
                    )}
                    onClick={() => {
                      setSelectedEditPlanIndex(index)
                      setSelectedCueIndex(-1)
                      setSelectedOverlayId(null)
                      setSelectedBgmClipId(null)
                      seekToSceneIndex(index)
                      if (mobileEditor) setMobilePane("preview")
                    }}
                  >
                    <div
                      className={cn(
                        "relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 to-black",
                        mobileEditor ? "aspect-square" : "aspect-[9/12]"
                      )}
                    >
                      {clipThumbnails[index] ? (
                        <img
                          src={clipThumbnails[index]}
                          alt={`컷 ${index + 1} 첫 장면`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-white/60" />
                          <span className="sr-only">컷 {index + 1} 썸네일 생성 중</span>
                        </>
                      )}
                      <span
                        data-keep-light-text="true"
                        className="absolute bottom-1 right-1 rounded bg-black/65 px-1 py-0.5 text-[9px] font-bold text-white"
                      >
                        {index + 1}
                      </span>
                    </div>
                    {!mobileEditor ? (
                      <div className="p-1.5">
                        <p className="truncate text-[10px] font-semibold text-slate-200">
                          컷 {index + 1}
                        </p>
                        <p className="mt-0.5 truncate text-[8px] text-slate-500">
                          {videoSourceLabel(result, clip.video_id)}
                        </p>
                        <p className="mt-0.5 font-mono text-[8px] text-violet-300/80">
                          {(clip.output_end - clip.output_start).toFixed(1)}초
                        </p>
                      </div>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </aside>
        ) : null}

        {/* preview + timeline */}
        <div
          className={cn(
            "space-y-0 border-r border-white/10",
            popupMode && !mobileEditor && "contents",
            mobileEditor &&
              (mobilePane === "preview"
                ? "flex min-h-0 flex-1 flex-col border-r-0"
                : mobilePane === "timeline"
                  ? "flex min-h-0 flex-1 flex-col border-r-0"
                  : "hidden")
          )}
        >
          <div
            className={cn(
              "flex flex-col bg-[#080808]",
              popupMode
                ? "relative min-h-0 items-stretch overflow-hidden px-2 pb-0 pt-0"
                : "items-center px-4 py-4",
              mobileEditor && mobilePane !== "preview" && "hidden",
              mobileEditor && mobilePane === "preview" && "min-h-0 flex-1"
            )}
            style={popupMode ? { backgroundColor: "#edf1f6" } : undefined}
          >
            {popupMode ? (
              <div className="absolute right-3 top-3 z-30 flex items-center justify-end gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 border-slate-300 bg-white text-xs text-slate-700"
                  onClick={() => {
                    const stage = previewStageRef.current
                    if (!stage) return
                    void stage.requestFullscreen?.()
                    if (!playing) onPlayToggle()
                  }}
                >
                  <Maximize2 className="mr-1.5 h-3.5 w-3.5" />
                  미리보기 실행
                </Button>
                {onVideoReplaced ? (
                  <MvpChineseSubtitleRemovalPanel
                    variant="toolbar"
                    videoUrl={resolvedVideoUrl}
                    videoLoading={videoLoading}
                    jobId={result.jobId}
                    projectId={projectId}
                    downloadUrl={result.downloadUrl}
                    videoBlobRef={videoBlobRef}
                    onVideoReplaced={onVideoReplaced}
                  />
                ) : null}
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label="미리보기 축소"
                  className="h-8 w-8 border-slate-300 bg-white text-slate-700"
                  onClick={() =>
                    setPreviewScale((scale) => Math.max(0.5, Math.round((scale - 0.1) * 10) / 10))
                  }
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 min-w-12 border-slate-300 bg-white px-2 text-[10px] text-slate-700"
                  onClick={() => setPreviewScale(1)}
                >
                  {Math.round(previewScale * 100)}%
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label="미리보기 확대"
                  className="h-8 w-8 border-slate-300 bg-white text-slate-700"
                  onClick={() =>
                    setPreviewScale((scale) => Math.min(1.5, Math.round((scale + 0.1) * 10) / 10))
                  }
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : null}
            <div
              className={cn(
                popupMode &&
                  "relative min-h-0 flex-1 overflow-hidden"
              )}
            >
            <div
              className={cn(
                popupMode &&
                  "absolute inset-0 flex items-center justify-center overflow-auto px-1 pb-1 pt-11"
              )}
              onPointerDown={(e) => {
                // 영상·오버레이 밖(회색 캔버스) 클릭 시 컷 선택 해제
                const t = e.target as HTMLElement
                if (t.closest("[data-remix-media-stage]")) return
                if (t.closest("[data-video-zoom-skip]")) return
                setSelectedEditPlanIndex(null)
                setSelectedCueIndex(-1)
                setSelectedOverlayId(null)
                setSelectedBgmClipId(null)
                setSelectedEffectClipId(null)
              }}
            >
            <div
              className={cn(
                "relative overflow-hidden rounded-lg border border-white/15 shadow-2xl",
                popupMode
                  ? "aspect-[9/16] h-full max-h-full w-auto max-w-full shrink-0"
                  : "aspect-[9/16] w-full max-w-[280px]"
              )}
              style={
                popupMode
                  ? {
                      transform: `scale(${previewScale})`,
                      transformOrigin: "center center",
                      transition: "transform 120ms ease-out",
                    }
                  : undefined
              }
            >
              <div
                ref={previewStageRef}
                data-remix-media-stage="true"
                className={cn(
                  "relative h-full w-full bg-black",
                  !popupMode && "aspect-[9/16]",
                  videoClipSelectedOnPreview && "cursor-ns-resize"
                )}
                onPointerDown={(e) => {
                  const t = e.target as HTMLElement
                  if (t.closest("[data-overlay-id]")) return
                  setSelectedOverlayId(null)
                  if (t.closest("[data-video-zoom-skip]")) return
                  if (showThumbnailIntro || !editPlan.length) return

                  const alreadySelected = selectedEditPlanIndex === previewClipIndex
                  selectPreviewClip()
                  // 이미 선택된 컷이면 위아래 드래그로 크기 조절
                  if (alreadySelected) videoZoom.onPointerDown(e)
                }}
                onPointerMove={videoZoom.onPointerMove}
                onPointerUp={videoZoom.onPointerUp}
                onWheel={videoZoom.onWheel}
              >
                {resolvedVideoUrl ? (
                  <div className="absolute inset-0 overflow-hidden bg-black">
                    {/* 컷 전환 페이드 레이어 — opacity만 JS로 갱신 */}
                    <div
                      ref={sceneFadeLayerRef}
                      className="absolute inset-0"
                      style={{ opacity: 1, willChange: "opacity" }}
                    >
                      {/* 실제 재생 비디오 — 홀드 줌 중에는 숨김(비디오 레이어 scale 금지) */}
                      <video
                        ref={videoRef}
                        src={resolvedVideoUrl}
                        className={cn(
                          "h-full w-full object-contain",
                          showThumbnailIntro && "opacity-0"
                        )}
                        style={previewVideoStyle}
                        playsInline
                        muted
                        preload="auto"
                        onLoadedMetadata={(e) => {
                          const d = e.currentTarget.duration
                          if (Number.isFinite(d) && d > 0.1) onVideoLoaded(d)
                          e.currentTarget.playbackRate = 1
                        }}
                        onError={() => {
                          console.error("[MvpCapCutEditor] video playback error", resolvedVideoUrl)
                        }}
                        onPlay={onVideoPlay}
                        onTimeUpdate={onVideoTimeUpdate}
                        onEnded={onVideoEnded}
                      />
                      {/* 홀드 시 캡처한 정지 프레임 — 이미지만 줌해서 흔들림 없음 */}
                      <canvas
                        ref={holdFreezeCanvasRef}
                        className="pointer-events-none absolute inset-0 h-full w-full origin-center [backface-visibility:hidden]"
                        aria-hidden
                      />
                      {/* 공백 컷 — TTS는 유지, 화면만 검정 */}
                      {previewClipIsBlank && !showThumbnailIntro ? (
                        <div
                          className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center bg-black"
                          aria-hidden
                        >
                          <span className="rounded-md border border-white/20 bg-white/5 px-2 py-1 text-[10px] text-white/70">
                            공백 · TTS 후 추가 영상으로 채우기
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : videoLoading ? (
                  <div className="flex h-full items-center justify-center gap-2 text-xs text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    MP4 불러오는 중…
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-500">리믹스 MP4 없음</div>
                )}
                {showThumbnailIntro && isDisplayableThumbnailUrl(thumbnailUrl) ? (
                  <img
                    src={thumbnailUrl}
                    alt="쇼츠 첫 프레임 썸네일"
                    className="absolute inset-0 z-[2] h-full w-full object-cover"
                  />
                ) : null}
                <MvpVideoClipTransformFrame
                  active={videoClipSelectedOnPreview}
                  scale={
                    selectedEditPlanIndex != null
                      ? getMvpEditPlanClipTransform(videoSourceTransforms, selectedEditPlanIndex)
                          .scale
                      : previewTransform.scale
                  }
                  onSelect={selectPreviewClip}
                  onScaleChange={(scale) => {
                    if (selectedEditPlanIndex == null) return
                    patchVideoSourceTransform(selectedEditPlanIndex, { scale })
                  }}
                />
                <MvpOverlayLayer
                  overlays={placedOverlays}
                  selectedId={selectedOverlayId}
                  onSelectId={setSelectedOverlayId}
                  onUpdateOverlay={updateOverlayById}
                  stageRef={previewStageRef}
                  videoRef={videoRef}
                  videoTimeSec={playhead}
                  videoDurationSec={previewTotalSec}
                  playing={playing}
                  onOverlayPointerDown={() => setInspectorTab("subtitle")}
                  sourceTransform={previewTransform}
                />
                {previewSubtitleText ? (
                  <MvpFitOneLineSubtitle style={buildSubtitleOverlayStyle(subStyle, subtitleStageScalePx)}>
                    {previewSubtitleText}
                  </MvpFitOneLineSubtitle>
                ) : null}
              </div>
            </div>
            </div>
            </div>

            {audioUrl ? (
              <audio
                ref={audioRef}
                key={audioKey}
                src={audioUrl}
                className="hidden"
                preload="auto"
                muted={isMuted}
                onLoadedMetadata={(e) => {
                  const d = e.currentTarget.duration
                  if (Number.isFinite(d)) onAudioLoaded(d)
                  e.currentTarget.muted = isMuted
                }}
                onTimeUpdate={onAudioTimeUpdate}
                onEnded={onAudioEnded}
              />
            ) : null}

            <div
              className={cn(
                "w-full overflow-hidden border",
                popupMode
                  ? "mt-0 shrink-0 rounded-none border-x-0 border-b-0 border-t border-slate-200 bg-white"
                  : "mt-3 max-w-xl rounded-xl border-white/10 bg-[#141414]"
              )}
            >
              <div
                className={cn(
                  "grid grid-cols-[1fr_auto_1fr] items-center px-3",
                  popupMode ? "h-12" : "h-12"
                )}
              >
                <span
                  className={cn(
                    "justify-self-start text-[10px] tabular-nums",
                    popupMode ? "text-slate-500" : "text-slate-400"
                  )}
                >
                  <strong className={cn("font-bold", popupMode ? "text-blue-500" : "text-cyan-300")}>
                    {formatPlayerTime(previewTimelineSec)}
                  </strong>
                  {" / "}
                  {formatPlayerTime(previewTotalSec)}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="이전 컷"
                    className={cn(
                      "h-8 w-8",
                      popupMode
                        ? "text-slate-500 hover:bg-slate-100"
                        : "text-slate-300 hover:bg-white/10"
                    )}
                    onClick={() => {
                      const index = Math.max(0, previewClipIndex - 1)
                      seekToSceneIndex(index)
                    }}
                  >
                    <SkipBack className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    aria-label={playing ? "일시 정지" : "재생"}
                    className={cn(
                      "h-8 w-8",
                      popupMode
                        ? "rounded-md bg-slate-900 text-white hover:bg-slate-700"
                        : "rounded-full bg-white text-slate-900 hover:bg-slate-200"
                    )}
                    onClick={onPlayToggle}
                  >
                    {playing ? (
                      <Pause className="h-4 w-4 fill-current" />
                    ) : (
                      <Play className="h-4 w-4 fill-current" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="다음 컷"
                    className={cn(
                      "h-8 w-8",
                      popupMode
                        ? "text-slate-500 hover:bg-slate-100"
                        : "text-slate-300 hover:bg-white/10"
                    )}
                    onClick={() => {
                      const index = Math.min(editPlan.length - 1, previewClipIndex + 1)
                      seekToSceneIndex(index)
                    }}
                  >
                    <SkipForward className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={isMuted ? "음소거 해제" : "음소거"}
                  className={cn(
                    "h-8 w-8 justify-self-end",
                    popupMode
                      ? "text-slate-500 hover:bg-slate-100"
                      : "text-slate-300 hover:bg-white/10"
                  )}
                  onClick={() => {
                    setIsMuted((muted) => {
                      const next = !muted
                      if (audioRef.current) audioRef.current.muted = next
                      return next
                    })
                  }}
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          <div
            className={cn(
              "px-3",
              popupMode
                ? cn(
                    "relative flex h-full min-h-0 flex-col overflow-hidden border-t border-slate-200 bg-[#f8fafc] px-2 pb-0 pt-3",
                    mobileEditor
                      ? mobilePane === "timeline"
                        ? "min-h-0 flex-1 border-t-0 pt-2"
                        : "hidden"
                      : "col-span-3 row-start-2"
                  )
                : "pb-4"
            )}
          >
            {popupMode && !mobileEditor ? (
              <div
                role="separator"
                aria-label="타임라인 높이 조절"
                aria-orientation="horizontal"
                tabIndex={0}
                className="absolute inset-x-0 top-0 z-40 flex h-3 cursor-ns-resize items-center justify-center bg-slate-200/80 hover:bg-cyan-100"
                onPointerDown={startTimelineResize}
                onDoubleClick={() => setTimelineHeight(220)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowUp") {
                    event.preventDefault()
                    setTimelineHeight((height) => Math.min(560, height + 20))
                  } else if (event.key === "ArrowDown") {
                    event.preventDefault()
                    setTimelineHeight((height) => Math.max(128, height - 20))
                  }
                }}
              >
                <span className="h-1 w-12 rounded-full bg-slate-400" />
              </div>
            ) : null}
            <div className={cn(popupMode && "min-h-0 flex-1")}>
            <MvpCapCutTimeline
              result={result}
              segments={segments}
              durationSec={previewTotalSec}
              playhead={previewTimelineSec}
              previewTimelineSec={previewTimelineSec}
              thumbnailUrl={thumbnailIntroOn && thumbnailUrl ? thumbnailUrl : undefined}
              voiceLineCues={voiceLineCues}
              draftSubtitleCues={draftSubtitleCues}
              audioDurationSec={audioDuration}
              hasAudio={Boolean(audioUrl)}
              selectedCueIndex={selectedCueIndex}
              fillHeight={popupMode}
              initialPxPerSec={mobileEditor ? 40 : 72}
              onSelectCue={(i) => {
                setSelectedCueIndex(i)
                setSelectedOverlayId(null)
                setSelectedEditPlanIndex(null)
                setInspectorTab("subtitle")
                if (mobileEditor) setMobilePane("edit")
              }}
              onSeek={onSeek}
              bgmClips={bgmClips}
              selectedBgmClipId={selectedBgmClipId}
              onSelectBgmClipId={(id) => {
                setSelectedBgmClipId(id)
                if (id) {
                  setSelectedOverlayId(null)
                  setSelectedEditPlanIndex(null)
                }
              }}
              onBgmClipsChange={onBgmClipsChange}
              effectClips={effectClips}
              selectedEffectClipId={selectedEffectClipId}
              onSelectEffectClipId={(id) => {
                setSelectedEffectClipId(id)
                if (id) {
                  setSelectedBgmClipId(null)
                  setSelectedOverlayId(null)
                  setSelectedEditPlanIndex(null)
                  setInspectorTab("audio")
                }
              }}
              onEffectClipsChange={onEffectClipsChange}
              placedOverlays={placedOverlays}
              selectedOverlayId={selectedOverlayId}
              onSelectOverlayId={(id) => {
                setSelectedOverlayId(id)
                if (id) {
                  setSelectedCueIndex(-1)
                  setSelectedBgmClipId(null)
                  setSelectedEditPlanIndex(null)
                  setInspectorTab("subtitle")
                }
              }}
              onPlacedOverlaysChange={onPlacedOverlaysChange}
              selectedEditPlanIndex={selectedEditPlanIndex}
              onSelectEditPlanIndex={(index) => {
                setSelectedEditPlanIndex(index)
                if (index != null) {
                  setSelectedCueIndex(-1)
                  setSelectedOverlayId(null)
                  setSelectedBgmClipId(null)
                }
              }}
              onSplitSelectedVideoClip={
                onSplitEditPlanClip ? splitSelectedVideoClip : undefined
              }
              onBlankSelectedVideoClip={
                onBlankEditPlanClip && selectedEditPlanIndex != null
                  ? () => onBlankEditPlanClip(selectedEditPlanIndex)
                  : undefined
              }
              onDeleteSelectedVideoClip={
                onBlankEditPlanClip && selectedEditPlanIndex != null
                  ? () => onBlankEditPlanClip(selectedEditPlanIndex)
                  : undefined
              }
              onReorderEditPlanClip={
                onReorderEditPlanClip && !timelineEditBusy
                  ? onReorderEditPlanClip
                  : undefined
              }
              onInsertClipDrop={onInsertClipDrop}
              insertClipDropEnabled={insertClipDropEnabled}
            />
            </div>
          </div>
        </div>

        {/* inspector */}
        <div
          className={cn(
            "flex max-h-[min(85vh,920px)] flex-col overflow-hidden",
            popupMode
              ? cn(insp.shell, "max-h-none min-h-0 border-l border-slate-200")
              : "bg-[#101012]",
            mobileEditor &&
              (mobilePane === "edit"
                ? "min-h-0 flex-1 border-l-0"
                : "hidden")
          )}
        >
          <div className={cn(popupMode ? insp.tabBar : "flex border-b border-white/10")}>
            <div className={cn(popupMode ? insp.tabTrack : "flex w-full")}>
              {(
                [
                  ["script", "대본", Sparkles],
                  ["voice", "음성", Volume2],
                  ["subtitle", "자막", Type],
                  ["audio", "효과음", Music2],
                  ["thumbnail", "썸네일", ImageIcon],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  className={cn(
                    popupMode
                      ? cn(insp.tab, inspectorTab === id ? insp.tabActive : insp.tabIdle)
                      : cn(
                          "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] transition",
                          inspectorTab === id
                            ? "border-b-2 border-violet-500 text-violet-200"
                            : "text-slate-500 hover:text-slate-300"
                        )
                  )}
                  onClick={() => setInspectorTab(id)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className={cn(popupMode ? insp.body : "flex-1 overflow-y-auto p-3")}>
            {selectedEditPlanIndex != null && selectedClipSegment ? (
              <div
                className={cn(
                  popupMode
                    ? insp.card
                    : "mb-3 rounded-xl border border-emerald-500/25 bg-emerald-950/20 p-3"
                )}
              >
                <p className={popupMode ? insp.title : "text-xs font-medium text-emerald-100"}>
                  컷 {selectedEditPlanIndex + 1} · {selectedClipIsBlank ? "공백" : "화면 크기"}
                </p>
                <p
                  className={cn(
                    "mt-1 text-[11px]",
                    popupMode ? "text-slate-600" : "text-white"
                  )}
                >
                  {selectedClipIsBlank
                    ? insertClipAllowed
                      ? "TTS는 유지됩니다. 「추가 영상」으로 이 자리에 다른 클립을 넣으세요."
                      : "먼저 「TTS 생성」을 한 뒤, 이 공백에 영상을 넣으세요."
                    : videoSourceLabel(result, selectedClipSegment.video_id)}
                </p>
                {selectedClipIsBlank ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {onOpenInsertClip ? (
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 bg-amber-500 text-xs font-semibold text-zinc-900 hover:bg-amber-400 disabled:opacity-50"
                        disabled={insertClipBusy || !insertClipAllowed}
                        title={
                          insertClipAllowed
                            ? undefined
                            : "TTS를 먼저 생성해 주세요"
                        }
                        onClick={() => onOpenInsertClip()}
                      >
                        공백에 영상 넣기
                      </Button>
                    ) : null}
                  </div>
                ) : (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label className={popupMode ? insp.label : "text-[10px] text-slate-400"}>크기</Label>
                    <span
                      className={cn(
                        "font-mono text-[10px]",
                        popupMode ? "text-slate-600" : "text-slate-300"
                      )}
                    >
                      {Math.round(selectedVideoTransform.scale * 100)}%
                    </span>
                  </div>
                  <Slider
                    min={50}
                    max={250}
                    step={1}
                    value={[Math.round(selectedVideoTransform.scale * 100)]}
                    onValueChange={(v) =>
                      patchVideoSourceTransform(selectedEditPlanIndex, {
                        scale: (v[0] ?? 100) / 100,
                      })
                    }
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={selectedVideoTransform.flipH ? "default" : "outline"}
                      className={cn(
                        "h-8 gap-1.5 text-xs font-medium",
                        selectedVideoTransform.flipH
                          ? popupMode
                            ? "border-slate-800 bg-slate-900 text-white hover:bg-slate-800"
                            : "border-emerald-400 bg-emerald-600 text-white hover:bg-emerald-500"
                          : popupMode
                            ? insp.secondaryBtn
                            : "border-emerald-500/50 bg-slate-900 text-emerald-100 hover:bg-emerald-950/60"
                      )}
                      onClick={() =>
                        patchVideoSourceTransform(selectedEditPlanIndex, {
                          flipH: !selectedVideoTransform.flipH,
                        })
                      }
                    >
                      <FlipHorizontal className="h-3.5 w-3.5" />
                      좌우 반전
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className={cn(
                        "h-8 text-xs",
                        popupMode
                          ? "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          : "text-slate-300 hover:bg-white/10 hover:text-white"
                      )}
                      onClick={() =>
                        patchVideoSourceTransform(selectedEditPlanIndex, {
                          scale: 1,
                          flipH: false,
                        })
                      }
                    >
                      초기화
                    </Button>
                  </div>
                </div>
                )}
                {!selectedClipIsBlank && onBlankEditPlanClip ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={cn(
                      "mt-2 h-8 w-full text-xs",
                      popupMode
                        ? "border-rose-200 text-rose-700 hover:bg-rose-50"
                        : "border-rose-400/40 text-rose-200 hover:bg-rose-500/10"
                    )}
                    onClick={() => onBlankEditPlanClip(selectedEditPlanIndex)}
                  >
                    이 컷 삭제 (Delete) · 자리(공백) 유지
                  </Button>
                ) : null}
                {onDeleteEditPlanClip && !selectedClipIsBlank ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={timelineEditBusy}
                    className={cn(
                      "mt-2 h-8 w-full text-xs",
                      popupMode
                        ? "border-slate-200 text-slate-600 hover:bg-slate-50"
                        : "border-white/20 text-slate-300 hover:bg-white/10"
                    )}
                    onClick={() => onDeleteEditPlanClip(selectedEditPlanIndex)}
                  >
                    컷 완전 제거 · 뒤 당김 (Ctrl+X)
                  </Button>
                ) : null}
              </div>
            ) : null}

            {inspectorTab === "voice" ? (
              <div className="space-y-3">
                {onOpenInsertClip ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={insertClipBusy || !insertClipAllowed}
                    title={
                      insertClipAllowed
                        ? "TTS 생성 후 공백에 넣을 영상을 가져옵니다"
                        : "TTS를 먼저 생성한 뒤 공백에 영상을 넣을 수 있습니다"
                    }
                    className={cn(
                      "h-8 w-full text-xs",
                      popupMode
                        ? "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100"
                        : "border-violet-400/40 bg-violet-500/10 text-violet-100 hover:bg-violet-500/20"
                    )}
                    onClick={onOpenInsertClip}
                  >
                    {insertClipBusy ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Film className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {insertClipAllowed ? "추가 영상 가져오기" : "추가 영상 (TTS 먼저)"}
                  </Button>
                ) : null}
                <div className={popupMode ? insp.card : "rounded-xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/[0.07] to-transparent p-3"}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className={popupMode ? insp.sectionHead : undefined}>
                        {popupMode ? <span className={insp.sectionIndex}>1</span> : null}
                        <p className={popupMode ? insp.title : "text-xs font-medium text-white"}>
                          음성 · TTS
                        </p>
                      </div>
                      <p className={popupMode ? insp.subtitle : "mt-0.5 text-[9px] text-slate-500"}>
                        {providerMeta.subtitle}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className={cn(
                        "h-7 w-7 shrink-0",
                        popupMode
                          ? "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          : "text-slate-500 hover:text-slate-300"
                      )}
                      disabled={providerLoading}
                      onClick={() => onReloadVoices(sidebarProvider)}
                    >
                      <RefreshCw className={cn("h-3.5 w-3.5", providerLoading && "animate-spin")} />
                    </Button>
                  </div>

                  <div
                    className={cn(
                      "mt-3 grid gap-1 rounded-lg p-0.5",
                      popupMode ? "grid-cols-2 bg-slate-100" : "grid-cols-2 gap-1 bg-transparent p-0"
                    )}
                  >
                    {TTS_PROVIDER_ORDER.map((id) => (
                      <button
                        key={id}
                        type="button"
                        className={cn(
                          "rounded-md py-1.5 text-[10px] font-medium transition",
                          popupMode
                            ? sidebarProvider === id
                              ? insp.providerActive
                              : "text-slate-500 hover:text-slate-800"
                            : sidebarProvider === id
                              ? "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/35"
                              : "bg-black/25 text-slate-500 hover:bg-white/5 hover:text-slate-300"
                        )}
                        onClick={() => switchSidebarProvider(id)}
                      >
                        {TTS_PROVIDER_META[id].label}
                      </button>
                    ))}
                  </div>

                  {sidebarProvider === "supertonic" ? (
                    <div className="mt-3">
                      <SupertonicSetupBar
                        onReady={(info) => {
                          if (info.online) onReloadVoices("supertonic")
                        }}
                      />
                    </div>
                  ) : null}

                  {sidebarProvider === "elevenlabs" && providerVoices.length > 0 ? (
                    <div className="mt-3">
                      <p className={popupMode ? insp.label : "text-[9px] text-slate-500"}>
                        추천 음성 (쇼핑숏폼)
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {providerVoices.map((v) => {
                          const key = buildTtsVoiceKey("elevenlabs", v.voice_id)
                          const active = selectedVoiceId === key
                          return (
                            <button
                              key={v.voice_id}
                              type="button"
                              className={cn(
                                "rounded-full border px-2.5 py-1 text-[9px] font-medium transition",
                                popupMode
                                  ? active
                                    ? insp.chipActive
                                    : insp.chipIdle
                                  : active
                                    ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-100"
                                    : "border-white/10 bg-black/30 text-slate-400 hover:border-white/20 hover:text-slate-200"
                              )}
                              onClick={() => pickElevenlabsSample(v.voice_id)}
                            >
                              {v.name}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}

                  {sidebarProvider === "supertonic" && providerVoices.length > 0 ? (
                    <div className="mt-3">
                      <p className={popupMode ? insp.label : "text-[9px] text-slate-500"}>
                        로컬 보이스 (F/M · 커스텀)
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {providerVoices.map((v) => {
                          const key = buildTtsVoiceKey("supertonic", v.voice_id)
                          const active = selectedVoiceId === key
                          return (
                            <button
                              key={v.voice_id}
                              type="button"
                              className={cn(
                                "rounded-full border px-2.5 py-1 text-[9px] font-medium transition",
                                popupMode
                                  ? active
                                    ? insp.chipActive
                                    : insp.chipIdle
                                  : active
                                    ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-100"
                                    : "border-white/10 bg-black/30 text-slate-400 hover:border-white/20 hover:text-slate-200"
                              )}
                              onClick={() => pickSupertonicVoice(v.voice_id)}
                            >
                              {v.name}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}

                  {providerVoiceError ? (
                    <p
                      className={cn(
                        "mt-3 rounded-lg px-2.5 py-2 text-[9px] leading-relaxed",
                        popupMode
                          ? "border border-amber-200 bg-amber-50 text-amber-800"
                          : "border border-amber-500/30 bg-amber-950/20 text-amber-100/95"
                      )}
                    >
                      {providerVoiceError}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    className={cn(
                      "mt-3 flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition",
                      popupMode
                        ? "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
                        : "border-white/10 bg-black/35 hover:border-emerald-400/30 hover:bg-black/50"
                    )}
                    disabled={providerLoading}
                    onClick={() => setVoicePickerOpen(true)}
                  >
                    {isCustomVoice ? (
                      <span
                        className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                          popupMode
                            ? "bg-slate-200 text-slate-700 ring-2 ring-slate-100"
                            : "bg-violet-500/20 ring-2 ring-violet-400/25"
                        )}
                      >
                        <Hash className={cn("h-5 w-5", popupMode ? "text-slate-600" : "text-violet-300")} />
                      </span>
                    ) : displayVoice?.thumbnail_image_url ? (
                      <img
                        src={displayVoice.thumbnail_image_url}
                        alt=""
                        className={cn(
                          "h-11 w-11 shrink-0 rounded-full object-cover",
                          popupMode ? "ring-2 ring-slate-200" : "ring-2 ring-white/10"
                        )}
                      />
                    ) : (
                      <span
                        className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white",
                          popupMode ? "ring-2 ring-slate-200" : "ring-2 ring-white/10"
                        )}
                        style={{
                          background: voiceAvatarFallbackColor(displayVoice?.name ?? "목소리"),
                        }}
                      >
                        {displayVoice?.name?.slice(0, 1) ?? <UserRound className="h-5 w-5" />}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate text-xs font-semibold",
                          popupMode ? "text-slate-900" : "text-white"
                        )}
                      >
                        {providerLoading
                          ? "불러오는 중…"
                          : displayVoice?.name ?? `${providerMeta.label} 목소리 선택`}
                      </p>
                      <p className="truncate text-[10px] text-slate-500">
                        {isCustomVoice
                          ? `ID · ${customIdDraft.trim() || parseBareVoiceId(selectedVoiceId)?.bareId || ""}`
                          : voiceMatchesSidebar && voiceStyle
                            ? `${labelTtsStyle(sidebarProvider, voiceStyle)}`
                            : providerVoices.length
                              ? "목록에서 선택하거나 ID를 입력하세요"
                              : "음성 ID 직접 입력 가능"}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                  </button>

                  {voiceStyles.length > 0 ? (
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {voiceStyles.map((s) => (
                        <button
                          key={s}
                          type="button"
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[9px] font-medium transition",
                            popupMode
                              ? voiceStyle === s
                                ? insp.chipActive
                                : insp.chipIdle
                              : voiceStyle === s
                                ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-100"
                                : "border-white/10 bg-black/30 text-slate-400 hover:border-white/20 hover:text-slate-200"
                          )}
                          disabled={!voiceMatchesSidebar}
                          onClick={() => onVoiceStyleChange(s)}
                        >
                          {labelTtsStyle(sidebarProvider, s)}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <div
                    className={cn(
                      "mt-3 rounded-lg px-2.5 py-2",
                      popupMode
                        ? "border border-slate-200 bg-slate-50"
                        : "border border-white/[0.08] bg-black/25"
                    )}
                  >
                    <p className={popupMode ? insp.label : "text-[9px] font-medium text-slate-400"}>
                      음성 ID 직접 입력
                    </p>
                    <div className="mt-1.5 flex gap-1.5">
                      <Input
                        className={cn(
                          "h-8 flex-1 font-mono text-[10px]",
                          popupMode ? insp.input : "border-white/10 bg-black/40"
                        )}
                        placeholder={providerMeta.idPlaceholder}
                        value={customIdDraft}
                        onChange={(e) => setCustomIdDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") applyCustomVoiceId()
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        className={cn(
                          "h-8 shrink-0 px-2.5 text-[10px] font-medium",
                          popupMode
                            ? insp.primaryBtn
                            : "border border-violet-400/50 bg-violet-600/90 text-white hover:bg-violet-500 disabled:opacity-40"
                        )}
                        disabled={!customIdDraft.trim()}
                        onClick={applyCustomVoiceId}
                      >
                        사용
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className={cn(
                        "h-8 flex-1 text-[10px] font-medium",
                        popupMode
                          ? insp.primaryBtn
                          : "border border-emerald-400/50 bg-emerald-600 text-white hover:bg-emerald-500"
                      )}
                      disabled={!ttsReadyForProvider || previewingVoiceId === activeVoiceId}
                      onClick={handlePreviewVoice}
                    >
                      {previewingVoiceId === activeVoiceId ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="mr-1 h-3 w-3" />
                      )}
                      미리듣기
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={cn(
                        "h-8 flex-1 text-[10px] font-medium",
                        popupMode
                          ? insp.secondaryBtn
                          : "border-white/20 bg-white/[0.08] text-slate-100 hover:bg-white/[0.14] hover:text-white"
                      )}
                      onClick={() => setVoicePickerOpen(true)}
                    >
                      목소리 변경
                    </Button>
                  </div>

                  {!ttsReadyForProvider && !providerLoading && !providerVoiceError ? (
                    <p
                      className={cn(
                        "mt-2.5 text-[9px] leading-relaxed",
                        popupMode ? "text-amber-700" : "text-amber-200/90"
                      )}
                    >
                      {providerMeta.label} 탭에서 목소리를 선택하거나 ID를 입력한 뒤 「TTS 생성」을 눌러 주세요.
                    </p>
                  ) : null}

                  <div className="mt-3">
                    <MvpTtsSpeedPicker
                      compact
                      tone={popupMode ? "light" : "dark"}
                      value={speechSpeed}
                      onChange={onSpeechSpeedChange}
                      disabled={ttsLoading}
                      sceneFitHint={sceneFitEnabled}
                    />
                  </div>

                  <Button
                    type="button"
                    className={cn(
                      "mt-3 h-10 w-full gap-2 text-xs font-semibold",
                      popupMode ? insp.primaryBtn : "bg-emerald-600 hover:bg-emerald-500"
                    )}
                    disabled={ttsLoading || !segments.length || !ttsReadyForProvider}
                    onClick={handleRunTts}
                  >
                    {ttsLoading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        TTS {ttsProgress}%
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-3.5 w-3.5" />
                        {audioUrl ? "TTS 다시 생성" : "TTS 생성"}
                      </>
                    )}
                  </Button>
                </div>

                {onSceneFitEnabledChange && onTrimSceneToAudio && onTrimAllScenesToAudio ? (
                  <div className="mt-3">
                    <MvpSceneFitPanel
                      segments={segments}
                      baseSegments={baseSegments}
                      voiceLineCues={voiceLineCues}
                      sceneSpeeds={sceneSpeeds}
                      baseSpeed={speechSpeed}
                      sceneFitEnabled={sceneFitEnabled}
                      onSceneFitEnabledChange={onSceneFitEnabledChange}
                      onTrimSceneToAudio={onTrimSceneToAudio}
                      onTrimAllToAudio={onTrimAllScenesToAudio}
                      onPlayScene={onPlaySceneOnly}
                      ttsLoading={ttsLoading}
                      light={popupMode}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {inspectorTab === "subtitle" ? (
              <div className="space-y-3">
                <div className={popupMode ? insp.card : "space-y-2 rounded-xl border border-white/10 bg-black/30 p-3"}>
                  <div className={popupMode ? insp.sectionHead : undefined}>
                    {popupMode ? <span className={insp.sectionIndex}>1</span> : null}
                    <p className={popupMode ? insp.title : "text-xs font-medium text-white"}>자막 스타일</p>
                  </div>
                  <p className={popupMode ? insp.subtitle : "text-[10px] leading-relaxed text-slate-500"}>
                    미리보기 영상 위에서 실시간으로 반영됩니다.
                  </p>
                  <div className="mt-3">
                    <MvpSubtitleStylePanel
                      value={subStyle}
                      onChange={onSubtitleStyleChange}
                      tone={popupMode ? "light" : "dark"}
                    />
                  </div>
                </div>

                {selectedCue ? (
                  <div
                    className={cn(
                      popupMode
                        ? insp.card
                        : "rounded-lg border border-amber-500/30 bg-amber-950/15 p-3"
                    )}
                  >
                    <div className={popupMode ? insp.sectionHead : undefined}>
                      {popupMode ? <span className={insp.sectionIndex}>·</span> : null}
                      <p
                        className={cn(
                          "text-[10px] font-semibold",
                          popupMode ? "text-slate-800" : "text-amber-200"
                        )}
                      >
                        선택 자막 · {formatNarrationClock(selectedCue.startSec)}–
                        {formatNarrationClock(selectedCue.endSec)}
                      </p>
                    </div>
                    <textarea
                      className={cn(
                        "mt-2 min-h-[72px] w-full resize-y rounded-lg border px-2.5 py-2 text-xs leading-relaxed",
                        popupMode
                          ? "border-slate-200 bg-slate-50 text-slate-800"
                          : "border-white/10 bg-black/50 text-white"
                      )}
                      value={selectedCue.text}
                      rows={3}
                      onChange={(e) => updateCue(selectedCueIndex, { text: e.target.value })}
                    />
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div>
                        <Label className={popupMode ? insp.label : "text-[9px] text-slate-500"}>
                          시작(초)
                        </Label>
                        <Input
                          type="number"
                          step={0.05}
                          className={cn(
                            "mt-0.5 h-8 text-xs",
                            popupMode ? insp.input : "border-white/10 bg-black/40"
                          )}
                          value={Math.round(selectedCue.startSec * 100) / 100}
                          onChange={(e) =>
                            updateCue(selectedCueIndex, { startSec: Math.max(0, Number(e.target.value) || 0) })
                          }
                        />
                      </div>
                      <div>
                        <Label className={popupMode ? insp.label : "text-[9px] text-slate-500"}>
                          끝(초)
                        </Label>
                        <Input
                          type="number"
                          step={0.05}
                          className={cn(
                            "mt-0.5 h-8 text-xs",
                            popupMode ? insp.input : "border-white/10 bg-black/40"
                          )}
                          value={Math.round(selectedCue.endSec * 100) / 100}
                          onChange={(e) =>
                            updateCue(selectedCueIndex, { endSec: Math.max(0, Number(e.target.value) || 0) })
                          }
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className={cn(popupMode ? insp.cardMuted : "rounded-lg border border-dashed border-white/10 px-3 py-6", "text-center text-[11px] text-slate-500")}>
                    {draftSubtitleCues.length
                      ? "타임라인의 자막을 클릭하면 여기서 수정할 수 있습니다"
                      : "TTS 생성 후 타임라인 자막을 클릭해 편집하세요"}
                  </p>
                )}

                {cues.length > 0 ? (
                  <div
                    className={cn(
                      "max-h-[220px] space-y-1 overflow-y-auto",
                      popupMode && cn(insp.card, "space-y-1 p-2")
                    )}
                  >
                    <p className={cn("px-1 pb-1", popupMode ? insp.label : "text-[9px] text-slate-500")}>
                      자막 목록
                    </p>
                    {cues.map((c, i) => (
                      <button
                        key={`list-${i}`}
                        type="button"
                        className={cn(
                          "w-full rounded-lg border px-2.5 py-2 text-left text-[10px] transition",
                          popupMode
                            ? selectedCueIndex === i
                              ? "border-slate-800 bg-slate-900 text-white"
                              : "border-transparent text-slate-600 hover:bg-slate-50"
                            : selectedCueIndex === i
                              ? "border-amber-500/40 bg-amber-950/25 text-amber-100"
                              : "border-white/5 text-slate-400 hover:bg-white/5"
                        )}
                        onClick={() => {
                          setSelectedCueIndex(i)
                          onSeek(c.startSec)
                        }}
                      >
                        <span
                          className={cn(
                            "font-mono",
                            popupMode
                              ? selectedCueIndex === i
                                ? "text-slate-300"
                                : "text-slate-400"
                              : "text-violet-400/80"
                          )}
                        >
                          {formatNarrationClock(c.startSec)}
                        </span>{" "}
                        {c.text}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className={popupMode ? insp.card : "space-y-2 rounded-xl border border-cyan-500/20 bg-black/30 p-3"}>
                  <div className={popupMode ? insp.sectionHead : undefined}>
                    {popupMode ? <span className={insp.sectionIndex}>2</span> : null}
                    <p className={popupMode ? insp.title : "text-xs font-medium text-white"}>중국어 모자이크</p>
                  </div>
                  <div className="mt-2">
                    <MvpOverlayElementsPanel
                      overlays={placedOverlays}
                      selectedId={selectedOverlayId}
                      onOverlaysChange={onPlacedOverlaysChange}
                      onSelectId={setSelectedOverlayId}
                      videoRef={videoRef}
                      videoDurationSec={previewTotalSec}
                      playheadSec={playhead}
                      onSeek={onSeek}
                      sceneSegments={segments}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {inspectorTab === "audio" ? (
              <MvpEffectSoundPanel
                clips={effectClips}
                onChange={onEffectClipsChange}
                // TTS 있으면 효과음도 음성 타임라인 축 — 재생바도 같은 축
                playhead={useAudioTimeline ? audioPlayhead : playhead}
                durationSec={previewTotalSec}
                videoDurationSec={Math.max(
                  0.1,
                  ...segments.map((seg) => seg.end),
                  playhead + 0.05
                )}
                voiceLineCues={voiceLineCues}
                segments={segments}
                selectedId={selectedEffectClipId}
                onSelectedIdChange={setSelectedEffectClipId}
                tone={popupMode ? "light" : "dark"}
              />
            ) : null}

            {inspectorTab === "thumbnail" ? (
              <div className={popupMode ? insp.card : undefined}>
                <MvpThumbnailPanel
                  layout="compact"
                  productName={thumbnailProductName}
                  hookingInput={thumbnailHookingInput}
                  videoUrl={resolvedVideoUrl}
                  segments={segments}
                  scriptStyle={scriptStyle}
                  thumbnailUrl={thumbnailUrl}
                  thumbnailGallery={thumbnailGallery}
                  selectedThumbnailId={selectedThumbnailId}
                  thumbnailIntroOn={thumbnailIntroOn}
                  hookingText={thumbnailHookingText}
                  onAddThumbnail={onAddThumbnail}
                  onSelectThumbnail={onSelectThumbnail}
                  onRemoveThumbnail={onRemoveThumbnail}
                  onThumbnailIntroOnChange={onThumbnailIntroOnChange}
                  onHookingTextChange={onThumbnailHookingTextChange}
                  tone={popupMode ? "light" : "dark"}
                />
              </div>
            ) : null}

            {inspectorTab === "script" ? (
              <MvpScriptAnalysisPanel
                light={popupMode}
                baseSegments={baseSegments}
                segments={segments}
                segmentVisualHints={segmentVisualHints}
                activeScene={activeScene}
                scriptRevision={scriptRevision}
                scriptNeedsAi={scriptNeedsAi}
                scriptGenerating={scriptGenerating}
                onGenerateScript={onGenerateScript}
                onRewriteScript={onRewriteScript}
                onRestoreScript={onRestoreScript}
                canRestoreScript={canRestoreScript}
                scriptDirtyFromBaseline={scriptDirtyFromBaseline}
                onScriptOverride={onScriptOverride}
                onScriptOverrideBlur={onScriptOverrideBlur}
                onRunTtsForScene={onRunTtsForScene}
                sceneTtsLoadingIndex={sceneTtsLoadingIndex}
                onPlaySceneOnly={onPlaySceneOnly}
                onOpenInsertClip={onOpenInsertClip}
                insertClipBusy={insertClipBusy}
                insertClipAllowed={insertClipAllowed}
              />
            ) : null}

          </div>

          {inspectorTab !== "script" && result.analyses?.length && scriptOpen ? (
            <div
              className={cn(
                "border-t p-2",
                popupMode ? "border-slate-200 bg-white" : "border-white/10"
              )}
            >
              <MvpVisualSceneList
                analyses={result.analyses}
                outputScenes={result.productAnalysis?.scenes}
                activeOutputStart={playhead}
              />
            </div>
          ) : null}
          {inspectorTab !== "script" ? (
            <button
              type="button"
              className={popupMode ? insp.footer : "border-t border-white/10 py-2 text-center text-[10px] text-slate-500 hover:text-slate-300"}
              onClick={() => setScriptOpen((o) => !o)}
            >
              {scriptOpen ? "소스 장면 목록 숨기기" : "소스 장면 목록 보기"}
            </button>
          ) : null}
        </div>

        {mobileEditor ? (
          <ShotFormMobileEditorTabs
            value={mobilePane}
            onChange={setMobilePane}
            light
            className="shrink-0"
          />
        ) : null}
      </div>

      <MvpVoicePickerDialog
        open={voicePickerOpen}
        onOpenChange={setVoicePickerOpen}
        initialProvider={sidebarProvider}
        voiceCatalog={voiceCatalog}
        voicesLoading={voicesLoading}
        voiceLoadErrors={voiceLoadErrors}
        selectedVoiceId={selectedVoiceId}
        voiceStyle={voiceStyle}
        onVoiceIdChange={onVoiceIdChange}
        onStyleChange={onVoiceStyleChange}
        onReloadVoices={onReloadVoices}
        onPreviewVoice={onPreviewVoice}
        previewingVoiceId={previewingVoiceId}
      />
    </StudioPageCard>
  )
}
