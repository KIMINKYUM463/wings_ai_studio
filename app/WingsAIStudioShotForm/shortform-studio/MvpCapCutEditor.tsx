"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  ChevronRight,
  FilePenLine,
  FileText,
  Hash,
  ImageIcon,
  Info,
  Loader2,
  Music2,
  Pause,
  Play,
  RefreshCw,
  Sparkles,
  Type,
  UserRound,
  Volume2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
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
  MvpStudioSeoMeta,
  MvpSubtitleStyle,
  MvpThumbnailHookingText,
  MvpThumbnailVariant,
} from "@/lib/mvp-studio-types"
import { normalizeSubtitleStyle } from "@/lib/mvp-studio-types"
import { buildSubtitleOverlayStyle } from "@/lib/mvp-subtitle-style"
import { StudioPageCard, studio } from "../components/ShotFormStudioUI"
import { isMosaicOverlay, type PlacedStudioOverlay } from "@/lib/shotform-studio-overlay-catalog"
import { MvpCapCutTimeline } from "./MvpCapCutTimeline"
import { MvpAudioMixPanel } from "./MvpAudioMixPanel"
import { MVP_AUDIO_CATALOG } from "@/lib/mvp-studio-audio-catalog"
import { probeAudioDurationSec } from "@/lib/mvp-preview-audio-mix"
import {
  canAddMvpBgmClip,
  newMvpBgmClipId,
  type MvpBgmClip,
} from "@/lib/mvp-studio-types"
import { MvpOverlayLayer } from "./MvpOverlayLayer"
import { MvpOverlayElementsPanel } from "./MvpOverlayElementsPanel"
import { MvpSubtitleStylePanel } from "./MvpSubtitleStylePanel"
import { MvpTtsSpeedPicker } from "./MvpTtsSpeedPicker"
import { MvpThumbnailPanel } from "./MvpThumbnailPanel"
import { MvpSeoMetaPanel } from "./MvpSeoMetaPanel"
import { MvpAutoEditProductIntro } from "./MvpAutoEditProductIntro"
import { MvpChineseSubtitleRemovalPanel } from "./MvpChineseSubtitleRemovalPanel"
import { MvpVisualSceneList } from "./MvpVisualSceneList"
import { MvpVoicePickerDialog } from "./MvpVoicePickerDialog"
import {
  isMvpThumbnailIntroTime,
  mvpPreviewTimelineSec,
} from "@/lib/mvp-thumbnail-intro"

type NarrationSegment = {
  start: number
  end: number
  text: string
}

type Props = {
  result: AutoEditJobResult
  segments: NarrationSegment[]
  baseSegments: NarrationSegment[]
  segmentVisualHints: string[]
  scriptOverrides: Record<string, string>
  onScriptOverride: (sceneId: number, text: string) => void
  onScriptOverrideBlur: (sceneId: number, text: string, sceneDur: number) => void
  scriptGenerating: boolean
  scriptNeedsAi: boolean
  ttsNeedsRegen?: boolean
  onGenerateScript: () => void
  onRewriteScript: () => void
  scriptRevision?: number
  videoReady?: boolean
  resolvedVideoUrl: string | null
  videoLoading: boolean
  videoRef: React.RefObject<HTMLVideoElement | null>
  audioRef: React.RefObject<HTMLAudioElement | null>
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
  seoMeta: MvpStudioSeoMeta
  onSeoMetaChange: (next: MvpStudioSeoMeta) => void
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
  bgmClips: MvpBgmClip[]
  onBgmClipsChange: (next: MvpBgmClip[]) => void
}

export function MvpCapCutEditor(props: Props) {
  const {
    result,
    segments,
    baseSegments,
    segmentVisualHints,
    scriptOverrides,
    onScriptOverride,
    onScriptOverrideBlur,
    scriptGenerating,
    scriptNeedsAi,
    ttsNeedsRegen = false,
    speechSpeed,
    onSpeechSpeedChange,
    speedNeedsRegen = false,
    onGenerateScript,
    onRewriteScript,
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
    seoMeta,
    onSeoMetaChange,
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
    bgmClips,
    onBgmClipsChange,
  } = props

  const subStyle = normalizeSubtitleStyle(subtitleStyle)
  const previewStageRef = useRef<HTMLDivElement | null>(null)
  const [selectedCueIndex, setSelectedCueIndex] = useState(-1)
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null)
  const [inspectorTab, setInspectorTab] = useState<
    "info" | "subtitle" | "thumbnail" | "seo" | "script" | "audio"
  >("subtitle")
  const [selectedBgmClipId, setSelectedBgmClipId] = useState<string | null>(null)
  const [pendingCatalogId, setPendingCatalogId] = useState(
    MVP_AUDIO_CATALOG[0]?.id ?? "bgm-1"
  )

  const deleteSelectedBgmClip = useCallback(() => {
    if (!selectedBgmClipId) return
    onBgmClipsChange(bgmClips.filter((c) => c.id !== selectedBgmClipId))
    setSelectedBgmClipId(null)
  }, [selectedBgmClipId, bgmClips, onBgmClipsChange])

  const deleteSelectedOverlay = useCallback(() => {
    if (!selectedOverlayId) return false
    const target = placedOverlays.find((o) => o.id === selectedOverlayId)
    if (!target || !isMosaicOverlay(target.catalogId)) return false
    onPlacedOverlaysChange(placedOverlays.filter((o) => o.id !== selectedOverlayId))
    setSelectedOverlayId(null)
    return true
  }, [selectedOverlayId, placedOverlays, onPlacedOverlaysChange])

  useEffect(() => {
    const isTypingTarget = (el: Element | null) =>
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement ||
      (el instanceof HTMLElement && el.isContentEditable)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return
      if (isTypingTarget(document.activeElement)) return
      if (deleteSelectedOverlay()) {
        e.preventDefault()
        return
      }
      if (!selectedBgmClipId) return
      e.preventDefault()
      deleteSelectedBgmClip()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [selectedBgmClipId, selectedOverlayId, deleteSelectedBgmClip, deleteSelectedOverlay])

  const placeBgmAt = useCallback(
    async (startSec: number) => {
      if (!canAddMvpBgmClip(bgmClips)) return
      const item = MVP_AUDIO_CATALOG.find((o) => o.id === pendingCatalogId)
      if (!item) return
      const sourceDurationSec = await probeAudioDurationSec(item.src)
      const start = Math.max(0, Math.min(previewTotalSec - 0.35, startSec))
      const clip: MvpBgmClip = {
        id: newMvpBgmClipId(),
        catalogId: item.id,
        label: item.label,
        src: item.src,
        startSec: start,
        endSec: Math.max(start + 0.35, previewTotalSec),
        volumePct: 22,
        sourceDurationSec,
      }
      onBgmClipsChange([...bgmClips, clip])
      setSelectedBgmClipId(clip.id)
      setInspectorTab("audio")
    },
    [pendingCatalogId, previewTotalSec, bgmClips, onBgmClipsChange]
  )

  const thumbnailProductName =
    result.productAnalysis?.productName || scriptStyle.commentKeyword || "제품"
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
      if (shouldAutoLoadVoiceCatalog(next, voiceCatalog[next] ?? []) && !voicesLoading[next]) {
        void onReloadVoices(next)
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
  const previewTimelineSec = mvpPreviewTimelineSec(audioUrl, playhead)
  const showThumbnailIntro =
    thumbnailIntroOn && Boolean(thumbnailUrl) && isMvpThumbnailIntroTime(previewTimelineSec)
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
    <StudioPageCard className="border-violet-500/25 bg-[#0c0c0e] p-0 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
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

      {err ? <p className="px-4 pt-3 text-sm text-red-300">{err}</p> : null}

      {speedNeedsRegen && ttsReady ? (
        <div className="mx-4 mt-3 rounded-lg border border-violet-500/35 bg-violet-950/25 px-3 py-2.5 text-xs leading-relaxed text-violet-100">
          나레이션 속도가 변경되었습니다. <strong className="text-white">TTS 다시 생성</strong>을 눌러
          자막·영상 싱크를 맞춰 주세요.
        </div>
      ) : null}

      {ttsNeedsRegen && ttsReady ? (
        <div className="mx-4 mt-3 rounded-lg border border-amber-500/35 bg-amber-950/25 px-3 py-2.5 text-xs leading-relaxed text-amber-100">
          TTS·자막이 영상 끝까지 닿지 않습니다. 「대본」 탭에서 누락된 컷을 확인한 뒤{" "}
          <strong className="text-white">TTS 다시 생성</strong>을 눌러 주세요.
        </div>
      ) : null}

      {videoReady && segments.length > 0 ? (
        <div
          className={cn(
            "mx-4 mt-3 rounded-lg border px-3 py-2.5 text-xs leading-relaxed",
            scriptNeedsAi || scriptGenerating
              ? "border-amber-500/35 bg-amber-950/25 text-amber-100"
              : "border-emerald-500/30 bg-emerald-950/25 text-emerald-100"
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p>
              <strong className={scriptNeedsAi || scriptGenerating ? "text-amber-50" : "text-emerald-50"}>
                영상 짜집기는 완료되었습니다.
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
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
        {/* preview + timeline */}
        <div className="space-y-0 border-r border-white/10">
          <div className="flex flex-col items-center bg-[#080808] px-4 py-4">
            <div className="relative w-full max-w-[280px] overflow-hidden rounded-lg border border-white/15 shadow-2xl">
              <div
                ref={previewStageRef}
                className="relative aspect-[9/16] bg-black"
                onPointerDown={(e) => {
                  const t = e.target as HTMLElement
                  if (!t.closest("[data-overlay-id]")) setSelectedOverlayId(null)
                }}
              >
                {resolvedVideoUrl ? (
                  <video
                    ref={videoRef}
                    src={resolvedVideoUrl}
                    className={cn(
                      "h-full w-full object-contain transition-opacity",
                      showThumbnailIntro && "opacity-0"
                    )}
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
                ) : videoLoading ? (
                  <div className="flex h-full items-center justify-center gap-2 text-xs text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    MP4 불러오는 중…
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-500">짜집기 MP4 없음</div>
                )}
                {showThumbnailIntro ? (
                  <img
                    src={thumbnailUrl}
                    alt="쇼츠 첫 프레임 썸네일"
                    className="absolute inset-0 z-[2] h-full w-full object-cover"
                  />
                ) : null}
                <MvpOverlayLayer
                  overlays={placedOverlays}
                  selectedId={selectedOverlayId}
                  onSelectId={setSelectedOverlayId}
                  onUpdateOverlay={updateOverlayById}
                  stageRef={previewStageRef}
                  videoRef={videoRef}
                  videoTimeSec={playhead}
                  videoDurationSec={previewTotalSec}
                  onOverlayPointerDown={() => setInspectorTab("subtitle")}
                />
                {previewSubtitleText ? (
                  <div style={buildSubtitleOverlayStyle(subStyle)}>{previewSubtitleText}</div>
                ) : null}
              </div>
            </div>

            {audioUrl ? (
              <audio
                ref={audioRef}
                key={audioKey}
                src={audioUrl}
                className="hidden"
                preload="auto"
                onLoadedMetadata={(e) => {
                  const d = e.currentTarget.duration
                  if (Number.isFinite(d)) onAudioLoaded(d)
                }}
                onTimeUpdate={onAudioTimeUpdate}
                onEnded={onAudioEnded}
              />
            ) : null}

            <div className="mt-3 flex w-full max-w-md items-center gap-2 rounded-lg border border-white/10 bg-[#141414] px-2 py-2">
              <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={onPlayToggle}>
                {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
              </Button>
              <Slider
                className="flex-1"
                min={0}
                max={Math.max(0.01, previewTotalSec)}
                step={0.05}
                value={[Math.min(playhead, previewTotalSec)]}
                onValueChange={(v) => onSeek(v[0] ?? 0)}
              />
              <span className="shrink-0 font-mono text-[10px] text-slate-400">
                {formatNarrationClock(previewTimelineSec)}
              </span>
            </div>
          </div>

          <div className="px-3 pb-4">
            <MvpCapCutTimeline
              result={result}
              segments={segments}
              durationSec={previewTotalSec}
              playhead={playhead}
              previewTimelineSec={playhead}
              thumbnailUrl={thumbnailIntroOn && thumbnailUrl ? thumbnailUrl : undefined}
              voiceLineCues={voiceLineCues}
              draftSubtitleCues={draftSubtitleCues}
              audioDurationSec={audioDuration}
              hasAudio={Boolean(audioUrl)}
              selectedCueIndex={selectedCueIndex}
              onSelectCue={(i) => {
                setSelectedCueIndex(i)
                setSelectedOverlayId(null)
                setInspectorTab("subtitle")
              }}
              onSeek={onSeek}
              bgmClips={bgmClips}
              selectedBgmClipId={selectedBgmClipId}
              onSelectBgmClipId={(id) => {
                setSelectedBgmClipId(id)
                if (id) setSelectedOverlayId(null)
              }}
              onBgmClipsChange={onBgmClipsChange}
              onPlaceBgmAt={(t) => void placeBgmAt(t)}
              placedOverlays={placedOverlays}
              selectedOverlayId={selectedOverlayId}
              onSelectOverlayId={(id) => {
                setSelectedOverlayId(id)
                if (id) {
                  setSelectedCueIndex(-1)
                  setSelectedBgmClipId(null)
                  setInspectorTab("subtitle")
                }
              }}
              onPlacedOverlaysChange={onPlacedOverlaysChange}
            />
          </div>
        </div>

        {/* inspector */}
        <div className="flex max-h-[min(85vh,920px)] flex-col overflow-hidden bg-[#101012]">
          <div className="flex border-b border-white/10">
            {(
              [
                ["info", "정보", Info],
                ["subtitle", "자막", Type],
                ["audio", "음악", Music2],
                ["thumbnail", "썸네일", ImageIcon],
                ["seo", "제목·태그", FileText],
                ["script", "대본", Sparkles],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11px] transition",
                  inspectorTab === id
                    ? "border-b-2 border-violet-500 text-violet-200"
                    : "text-slate-500 hover:text-slate-300"
                )}
                onClick={() => setInspectorTab(id)}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {inspectorTab === "info" ? (
              <div className="space-y-3">
                {onVideoReplaced ? (
                  <MvpChineseSubtitleRemovalPanel
                    videoUrl={resolvedVideoUrl}
                    videoLoading={videoLoading}
                    jobId={result.jobId}
                    projectId={projectId}
                    downloadUrl={result.downloadUrl}
                    videoBlobRef={videoBlobRef}
                    onVideoReplaced={onVideoReplaced}
                  />
                ) : null}
                {result.productAnalysis ? (
                  <MvpAutoEditProductIntro
                    result={result}
                    videoUrl={resolvedVideoUrl}
                    playhead={playhead}
                  />
                ) : null}
              </div>
            ) : null}

            {inspectorTab === "subtitle" ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/[0.07] to-transparent p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-white">TTS · 나레이션 캐릭터</p>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 shrink-0 text-slate-500 hover:text-slate-300"
                      disabled={providerLoading}
                      onClick={() => onReloadVoices(sidebarProvider)}
                    >
                      <RefreshCw className={cn("h-3 w-3", providerLoading && "animate-spin")} />
                    </Button>
                  </div>

                  <div className="mt-2 flex gap-1">
                    {TTS_PROVIDER_ORDER.map((id) => (
                      <button
                        key={id}
                        type="button"
                        className={cn(
                          "flex-1 rounded-lg py-1.5 text-[10px] font-medium transition",
                          sidebarProvider === id
                            ? "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/35"
                            : "bg-black/25 text-slate-500 hover:bg-white/5 hover:text-slate-300"
                        )}
                        onClick={() => switchSidebarProvider(id)}
                      >
                        {TTS_PROVIDER_META[id].label}
                      </button>
                    ))}
                  </div>

                  <p className="mt-1.5 text-[9px] text-slate-500">{providerMeta.subtitle}</p>

                  {sidebarProvider === "elevenlabs" && providerVoices.length > 0 ? (
                    <div className="mt-2">
                      <p className="text-[9px] text-slate-500">추천 음성 (쇼핑숏폼)</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {providerVoices.map((v) => {
                          const key = buildTtsVoiceKey("elevenlabs", v.voice_id)
                          const active = selectedVoiceId === key
                          return (
                            <button
                              key={v.voice_id}
                              type="button"
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-[9px] transition",
                                active
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
                  ) : providerVoiceError ? (
                    <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-950/20 px-2.5 py-2 text-[9px] leading-relaxed text-amber-100/95">
                      {providerVoiceError}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    className="mt-2 flex w-full items-center gap-3 rounded-xl border border-white/10 bg-black/35 p-2.5 text-left transition hover:border-emerald-400/30 hover:bg-black/50"
                    disabled={providerLoading}
                    onClick={() => setVoicePickerOpen(true)}
                  >
                    {isCustomVoice ? (
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-500/20 ring-2 ring-violet-400/25">
                        <Hash className="h-5 w-5 text-violet-300" />
                      </span>
                    ) : displayVoice?.thumbnail_image_url ? (
                      <img
                        src={displayVoice.thumbnail_image_url}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-white/10"
                      />
                    ) : (
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ring-2 ring-white/10"
                        style={{
                          background: voiceAvatarFallbackColor(displayVoice?.name ?? "목소리"),
                        }}
                      >
                        {displayVoice?.name?.slice(0, 1) ?? <UserRound className="h-5 w-5" />}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-white">
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
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                  </button>

                  {voiceStyles.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {voiceStyles.map((s) => (
                        <button
                          key={s}
                          type="button"
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[9px] transition",
                            voiceStyle === s
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

                  <div className="mt-2 rounded-lg border border-white/[0.08] bg-black/25 px-2.5 py-2">
                    <p className="text-[9px] font-medium text-slate-400">음성 ID 직접 입력</p>
                    <div className="mt-1.5 flex gap-1.5">
                      <Input
                        className="h-8 flex-1 border-white/10 bg-black/40 font-mono text-[10px]"
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
                        className="h-8 shrink-0 border border-violet-400/50 bg-violet-600/90 px-2.5 text-[10px] font-medium text-white hover:bg-violet-500 disabled:opacity-40"
                        disabled={!customIdDraft.trim()}
                        onClick={applyCustomVoiceId}
                      >
                        사용
                      </Button>
                    </div>
                  </div>

                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 flex-1 border border-emerald-400/50 bg-emerald-600 text-[10px] font-medium text-white hover:bg-emerald-500"
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
                      className="h-8 flex-1 border border-white/20 bg-white/[0.08] text-[10px] font-medium text-slate-100 hover:bg-white/[0.14] hover:text-white"
                      onClick={() => setVoicePickerOpen(true)}
                    >
                      목소리 변경
                    </Button>
                  </div>

                  {!ttsReadyForProvider && !providerLoading && !providerVoiceError ? (
                    <p className="mt-2 text-[9px] leading-relaxed text-amber-200/90">
                      {providerMeta.label} 탭에서 목소리를 선택하거나 ID를 입력한 뒤 「TTS 생성」을 눌러 주세요.
                    </p>
                  ) : null}

                  <div className="mt-3">
                    <MvpTtsSpeedPicker
                      compact
                      value={speechSpeed}
                      onChange={onSpeechSpeedChange}
                      disabled={ttsLoading}
                    />
                  </div>

                  <Button
                    type="button"
                    className="mt-2 h-9 w-full gap-2 bg-emerald-600 text-xs hover:bg-emerald-500"
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

                {selectedCue ? (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-950/15 p-3">
                    <p className="text-[10px] font-medium text-amber-200">
                      선택된 자막 · {formatNarrationClock(selectedCue.startSec)}–
                      {formatNarrationClock(selectedCue.endSec)}
                    </p>
                    <textarea
                      className="mt-2 min-h-[72px] w-full resize-y rounded-md border border-white/10 bg-black/50 px-2 py-1.5 text-xs leading-relaxed text-white"
                      value={selectedCue.text}
                      rows={3}
                      onChange={(e) => updateCue(selectedCueIndex, { text: e.target.value })}
                    />
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[9px] text-slate-500">시작(초)</Label>
                        <Input
                          type="number"
                          step={0.05}
                          className="mt-0.5 h-7 border-white/10 bg-black/40 text-xs"
                          value={Math.round(selectedCue.startSec * 100) / 100}
                          onChange={(e) =>
                            updateCue(selectedCueIndex, { startSec: Math.max(0, Number(e.target.value) || 0) })
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-[9px] text-slate-500">끝(초)</Label>
                        <Input
                          type="number"
                          step={0.05}
                          className="mt-0.5 h-7 border-white/10 bg-black/40 text-xs"
                          value={Math.round(selectedCue.endSec * 100) / 100}
                          onChange={(e) =>
                            updateCue(selectedCueIndex, { endSec: Math.max(0, Number(e.target.value) || 0) })
                          }
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-[11px] text-slate-500">
                    {draftSubtitleCues.length
                      ? "타임라인의 대본 자막을 클릭하거나, TTS 생성 후 줄 단위로 편집할 수 있습니다"
                      : "타임라인에서 자막 클립을 클릭하면 여기서 텍스트·시간을 편집할 수 있습니다"}
                  </p>
                )}

                {cues.length > 0 ? (
                  <div className="max-h-[200px] space-y-1 overflow-y-auto">
                    {cues.map((c, i) => (
                      <button
                        key={`list-${i}`}
                        type="button"
                        className={cn(
                          "w-full rounded border px-2 py-1.5 text-left text-[10px] transition",
                          selectedCueIndex === i
                            ? "border-amber-500/40 bg-amber-950/25 text-amber-100"
                            : "border-white/5 text-slate-400 hover:bg-white/5"
                        )}
                        onClick={() => {
                          setSelectedCueIndex(i)
                          onSeek(c.startSec)
                        }}
                      >
                        <span className="font-mono text-violet-400/80">
                          {formatNarrationClock(c.startSec)}
                        </span>{" "}
                        {c.text}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="space-y-2 rounded-xl border border-white/10 bg-black/30 p-3">
                  <p className="text-xs font-medium text-white">자막 스타일</p>
                  <p className="text-[10px] leading-relaxed text-slate-500">
                    미리보기 영상 위에서 실시간으로 반영됩니다.
                  </p>
                  <MvpSubtitleStylePanel value={subStyle} onChange={onSubtitleStyleChange} />
                </div>

                <div className="space-y-2 rounded-xl border border-cyan-500/20 bg-black/30 p-3">
                  <p className="text-xs font-medium text-white">중국어 모자이크</p>
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
            ) : null}

            {inspectorTab === "audio" ? (
              <MvpAudioMixPanel
                bgmClips={bgmClips}
                onBgmClipsChange={onBgmClipsChange}
                selectedBgmClipId={selectedBgmClipId}
                onSelectBgmClipId={(id) => {
                  setSelectedBgmClipId(id)
                  if (id) setSelectedOverlayId(null)
                }}
                pendingCatalogId={pendingCatalogId}
                onPendingCatalogIdChange={setPendingCatalogId}
                durationSec={previewTotalSec}
              />
            ) : null}

            {inspectorTab === "thumbnail" ? (
              <MvpThumbnailPanel
                layout="compact"
                productName={thumbnailProductName}
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
              />
            ) : null}

            {inspectorTab === "seo" ? (
              <MvpSeoMetaPanel
                productName={thumbnailProductName}
                projectName={projectName}
                sourceKeywords={sourceKeywords}
                referenceTitles={
                  scriptStyle.commentKeyword ? [scriptStyle.commentKeyword] : undefined
                }
                segments={segments}
                videoDurationSec={previewTotalSec}
                value={seoMeta}
                onChange={onSeoMetaChange}
              />
            ) : null}

            {inspectorTab === "script" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-white">장면별 나레이션 ({segments.length})</p>
                    {scriptNeedsAi ? (
                      <p className="mt-0.5 text-[10px] text-amber-300/90">임시 문구 · AI로 대본 작성 필요</p>
                    ) : (
                      <p className="mt-0.5 text-[10px] text-emerald-400/90">AI 나레이션 대본 적용됨</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {scriptNeedsAi ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 border-amber-500/40 text-[10px] text-amber-100"
                        disabled={scriptGenerating}
                        onClick={onGenerateScript}
                      >
                        {scriptGenerating ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                        AI 대본
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={cn(studio.btnOutline, "h-7 gap-1 text-[10px]")}
                        disabled={scriptGenerating}
                        onClick={onRewriteScript}
                      >
                        {scriptGenerating ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <FilePenLine className="h-3 w-3" />
                        )}
                        대본만 다시쓰기
                      </Button>
                    )}
                  </div>
                </div>
                <ul className="max-h-[min(50vh,420px)] space-y-2 overflow-y-auto">
                  {baseSegments.map((seg, i) => {
                    const sceneId = i + 1
                    const text = segments[i]?.text ?? seg.text
                    const sceneDur = narrationSegmentDuration(seg)
                        const fit = narrationFitForScene(text, sceneDur)
                    const visualDesc = segmentVisualHints[i]
                    return (
                      <li
                        key={`${seg.start}-${i}-${scriptRevision}`}
                        className={cn(
                          "rounded-md border p-2",
                          activeScene === i ? "border-emerald-500/35 bg-emerald-950/20" : "border-white/5"
                        )}
                      >
                        <p className="font-mono text-[9px] text-violet-300">
                          {formatNarrationClock(seg.start)}–{formatNarrationClock(seg.end)} ({sceneDur}초)
                        </p>
                        {visualDesc ? (
                          <p className="mt-0.5 text-[10px] text-slate-500">
                            <span className="text-slate-600">화면 설명 · </span>
                            {visualDesc}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[9px] font-medium text-slate-500">나레이션 대본 (TTS·자막)</p>
                        <textarea
                          value={text}
                          rows={3}
                          disabled={scriptGenerating}
                          className="mt-1.5 w-full resize-y rounded border border-white/10 bg-black/40 px-2 py-1 text-[11px] leading-relaxed text-slate-100"
                          onChange={(e) => onScriptOverride(sceneId, e.target.value)}
                          onBlur={(e) => onScriptOverrideBlur(sceneId, e.target.value, sceneDur)}
                          onFocus={() => onPlaySceneOnly(i)}
                        />
                        <p className="mt-1 text-[9px] text-slate-500">
                          {fit.charCount}자 · {fit.estimatedSec}초
                          {fit.status === "ok" ? " · ✓" : fit.status === "warn" ? " · ⚠️" : ""}
                        </p>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : null}

          </div>

          {result.analyses?.length && scriptOpen ? (
            <div className="border-t border-white/10 p-2">
              <MvpVisualSceneList
                analyses={result.analyses}
                outputScenes={result.productAnalysis?.scenes}
                activeOutputStart={playhead}
              />
            </div>
          ) : null}
          <button
            type="button"
            className="border-t border-white/10 py-2 text-center text-[10px] text-slate-500 hover:text-slate-300"
            onClick={() => setScriptOpen((o) => !o)}
          >
            {scriptOpen ? "소스 장면 목록 숨기기" : "소스 장면 목록 보기"}
          </button>
        </div>
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
