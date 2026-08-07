"use client"

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react"
import { flushSync } from "react-dom"
import {
  Camera,
  Clapperboard,
  Film,
  FolderUp,
  Globe2,
  ImageIcon,
  Images,
  Loader2,
  Maximize2,
  MonitorPlay,
  Music2,
  Pause,
  Play,
  Plus,
  Scissors,
  Search,
  Sparkles,
  Sticker,
  SkipBack,
  SkipForward,
  Star,
  Type,
  Upload,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
  FileText,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
  MVP_THUMBNAIL_INTRO_SEC,
  isMvpThumbnailIntroTime,
} from "@/lib/mvp-thumbnail-intro"
import { selectedThumbnailVariant } from "@/lib/mvp-thumbnail-gallery"
import {
  hydrateMvpThumbnailGallery,
  parseMvpThumbnailIdbRef,
} from "@/lib/mvp-thumbnail-persist"
import { extractClientVideoMetaForPicks } from "@/lib/shotform-client-video-meta"
import { fetchCnKeywordTranslation } from "@/lib/shotform-cn-keyword-translate-client"
import { trimSilenceFromAudioUrl } from "@/lib/shotform-factory-line-tts"
import { refreshExpiredMvpEditPicks } from "@/lib/shotform-mvp-pick-video-download"
import {
  videoPickKey,
  type AutoEditPick,
  type ClientVideoMetaEntry,
} from "@/lib/shotform-auto-edit-types"
import {
  STORY_SHOPPING_SFX_CATALOG,
  type StoryShoppingSfxCatalogItem,
} from "@/lib/story-shopping-sfx-catalog"
import {
  convertImageToVideoWithWan,
  generateCnVideoKeywordSuggestions,
  generateImageWithNanobanana,
  generatePixabayKeywordSuggestions,
  generateVideoPromptForImage,
  searchPixabayImages,
  searchPixabayVideos,
  translateFreeAssetSearchQuery,
  type PixabayKeywordSuggestion,
} from "../ai-shopping/actions"
import {
  DEFAULT_STORY_FRAME_SETTINGS,
  STORY_FRAME_TEMPLATES,
  StoryChannelFrame,
} from "./StoryChannelFrame"
import { isSameStoryAssetSlot, resolveStoryLineAsset } from "./story-line-assets"
import { shiftCaptionCuesForTrim } from "./story-caption-align"
import {
  clampStorySfxToTimeline,
  moveStorySfxClip,
  normalizedStorySfxClip,
  splitStorySfxClip,
} from "./story-sfx-utils"
import {
  downloadBlobAsFile,
  recordStoryPreviewStage,
  type StoryExportClip,
  type StoryExportProgress,
} from "./story-export-video"
import {
  buildStoryMashupLineSlots,
  type StoryMashupLineSlot,
} from "./story-mashup"
import { StorySfxWaveform } from "./StorySfxWaveform"
import { StoryThumbnailPanel } from "./StoryThumbnailPanel"
import {
  StoryPublishMetaPanel,
  type StoryPublishMeta,
} from "./StoryPublishMetaPanel"
import {
  StoryVideoTrimMosaicDialog,
  type StoryVideoEditResult,
} from "./StoryVideoTrimMosaicDialog"
import type {
  StoryEditSettings,
  StorySceneAsset,
  StoryShoppingBrief,
  StorySfxClip,
} from "./story-types"

const DEFAULT_EDIT: StoryEditSettings = {
  subtitleColor: "#000000",
  subtitleSize: 36,
  subtitlePosition: "bottom",
  backgroundColor: "#000000",
  subtitleFontFamily: "Pretendard, Noto Sans KR, sans-serif",
  subtitleFontWeight: 700,
  subtitleBackgroundEnabled: false,
  subtitleBackgroundColor: "#ffffff",
  subtitleOutlineWidth: 0,
  subtitleOutlineColor: "#ffffff",
}

const FREE_SUBTITLE_FONTS = [
  {
    label: "Pretendard · 기본 UI 고딕",
    value: "Pretendard, Noto Sans KR, sans-serif",
  },
  { label: "Noto Sans KR · 기본 고딕", value: "'Noto Sans KR', sans-serif" },
  { label: "나눔고딕 · 깔끔한 고딕", value: "'Nanum Gothic', sans-serif" },
  { label: "고운돋움 · 부드러운 고딕", value: "'Gowun Dodum', sans-serif" },
  { label: "함렛 · 현대적인 명조", value: "'Hahmlet', serif" },
  { label: "Noto Serif KR · 정통 명조", value: "'Noto Serif KR', serif" },
  { label: "나눔명조 · 단정한 명조", value: "'Nanum Myeongjo', serif" },
  { label: "고운바탕 · 감성 명조", value: "'Gowun Batang', serif" },
  { label: "송명 · 이야기 제목", value: "'Song Myung', serif" },
  { label: "검은고딕 · 강한 제목", value: "'Black Han Sans', sans-serif" },
  { label: "주아 · 둥근 제목", value: "'Jua', sans-serif" },
  { label: "도현 · 선명한 제목", value: "'Do Hyeon', sans-serif" },
  { label: "구기 · 개성 있는 제목", value: "'Gugi', sans-serif" },
  { label: "동글 · 귀여운 자막", value: "'Dongle', sans-serif" },
  { label: "감자꽃 · 손글씨", value: "'Gamja Flower', cursive" },
  { label: "개구 · 장난스러운 손글씨", value: "'Gaegu', cursive" },
  { label: "나눔펜 · 자연스러운 펜글씨", value: "'Nanum Pen Script', cursive" },
  { label: "나눔붓 · 힘 있는 붓글씨", value: "'Nanum Brush Script', cursive" },
] as const

type RightTab = "script" | "elements" | "sfx" | "thumbnail" | "publish"
type VideoEditDraft = {
  asset: Omit<StorySceneAsset, "sceneId" | "lineIndex">
  revokeOnCancel: boolean
}
type ActiveSfxPlayback = {
  source: AudioBufferSourceNode
  gain: GainNode
  volumePct: number
}
type ElementSource =
  | "upload"
  | "review-nano"
  | "lens"
  | "google"
  | "pixabay"
  | "klipy"
  | "douyin"
  | "xiaohongshu"

type SearchHit = {
  id: string
  title: string
  thumbnailUrl: string
  mediaUrl: string
  pageUrl: string
  mediaType: "image" | "video"
  source: StorySceneAsset["source"]
  attribution?: string
  license?: StorySceneAsset["license"]
  durationSec?: number
}

type AutoAssetPlan = {
  sceneId: string
  lineIndex: number
  needsProduct: boolean
  source:
    | "review-ai"
    | "review-original"
    | "pixabay-video"
    | "pixabay-image"
    | "douyin"
    | "xiaohongshu"
    | "klipy"
    | "ai-image"
    | "ai-video"
    | "product"
  queryKo: string
  reason: string
}

function clipKey(sceneId: string, lineIndex: number) {
  return `${sceneId}:${lineIndex}`
}

/** 같은 Pixabay 사진의 _1280/_640 등 크기만 다른 URL을 한 장으로 취급 */
function mediaFingerprint(url: string): string {
  const raw = (url || "").trim()
  if (!raw) return ""
  try {
    const parsed = new URL(raw)
    const path = parsed.pathname
      .toLowerCase()
      .replace(/_(\d+)(?=\.(?:jpe?g|png|webp|gif)$)/i, "")
      .replace(/\/get\/[a-z0-9_-]+/gi, "/get")
    return `${parsed.hostname}${path}`
  } catch {
    return raw
      .toLowerCase()
      .replace(/[?#].*$/, "")
      .replace(/_(\d+)(?=\.(?:jpe?g|png|webp|gif)$)/i, "")
  }
}

/** 클립마다 검색 각도를 살짝 바꿔 같은 1등 결과가 반복되지 않게 함 */
const PIXABAY_DIVERSITY_HINTS = [
  "wide shot",
  "close up",
  "lifestyle scene",
  "detail view",
  "natural light",
  "home interior",
  "everyday moment",
  "side angle",
] as const

function parseClipKey(key: string): { sceneId: string; lineIndex: number } | null {
  const idx = key.lastIndexOf(":")
  if (idx < 0) return null
  const sceneId = key.slice(0, idx)
  const lineIndex = Number(key.slice(idx + 1))
  if (!sceneId || !Number.isFinite(lineIndex)) return null
  return { sceneId, lineIndex }
}

function formatTimelineTime(seconds: number) {
  const safe = Math.max(0, seconds)
  const minutes = Math.floor(safe / 60)
  const remaining = safe - minutes * 60
  const value =
    remaining % 1 === 0
      ? String(Math.floor(remaining)).padStart(2, "0")
      : remaining.toFixed(1).padStart(4, "0")
  return `${minutes}:${value}`
}

function formatPlayerTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  return [hours, minutes, secs].map((value) => String(value).padStart(2, "0")).join(":")
}

function getSerpKey() {
  return (
    localStorage.getItem("shotform_serpapi_key") ||
    localStorage.getItem("serpapi_api_key") ||
    ""
  ).trim()
}

function getProductImage(brief: StoryShoppingBrief) {
  const candidates = [
    brief.productImage,
    brief.selectedShoppingTag?.imageUrl,
    ...(brief.collectorData?.productImages || []),
  ]
  for (const raw of candidates) {
    const url = String(raw || "").trim()
    if (url.startsWith("http://") || url.startsWith("https://")) return url
  }
  return ""
}

const ELEMENT_SOURCES: Array<{
  id: ElementSource
  label: string
  description: string
  icon: LucideIcon
}> = [
  { id: "upload", label: "파일 업로드", description: "내 이미지·영상", icon: FolderUp },
  { id: "review-nano", label: "AI 리뷰 사진", description: "리뷰 사진 변형", icon: Sparkles },
  { id: "lens", label: "Google 렌즈", description: "제품 사진으로 검색", icon: Camera },
  { id: "google", label: "Google 이미지", description: "웹 이미지 검색", icon: ImageIcon },
  { id: "pixabay", label: "무료 이미지·영상", description: "Pixabay 무료 소재", icon: Images },
  { id: "klipy", label: "GIF 스티커", description: "Klipy 움직이는 GIF", icon: Sticker },
  { id: "douyin", label: "도우인 영상", description: "중국 숏폼 검색", icon: Clapperboard },
  { id: "xiaohongshu", label: "샤오홍슈 영상", description: "중국 리뷰 영상", icon: Globe2 },
]

export type StoryEditorHandle = {
  downloadVideo: () => Promise<void>
}

export const StoryEditorWorkspace = forwardRef<
  StoryEditorHandle,
  {
    brief: StoryShoppingBrief
    onChange: Dispatch<SetStateAction<StoryShoppingBrief>>
    detailMode?: boolean
    projectId: string
    onDownloadProgress?: (progress: StoryExportProgress | null) => void
    publishMeta?: StoryPublishMeta
    onPublishMetaChange?: (next: StoryPublishMeta) => void
  }
>(function StoryEditorWorkspace(
  {
    brief,
    onChange,
    detailMode = false,
    projectId,
    onDownloadProgress,
    publishMeta,
    onPublishMetaChange,
  },
  ref
) {
  const story = brief.generatedStory
  const scenes = story?.scenes || []
  const editSettings = { ...DEFAULT_EDIT, ...(brief.editSettings || {}) }
  const slots = useMemo(
    () => (story ? buildStoryMashupLineSlots(story, brief.voiceData) : []),
    [brief.voiceData, story]
  )

  const [selectedKey, setSelectedKey] = useState("")
  const [selectedElementKey, setSelectedElementKey] = useState<string | null>(null)
  const [selectedSfxId, setSelectedSfxId] = useState<string | null>(null)
  const [rightTab, setRightTab] = useState<RightTab>("elements")
  const [elementSource, setElementSource] = useState<ElementSource>("review-nano")
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<SearchHit[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isAutoPlacing, setIsAutoPlacing] = useState(false)
  const [autoPlacementProgress, setAutoPlacementProgress] = useState("")
  const [isSuggestingCnKeywords, setIsSuggestingCnKeywords] = useState(false)
  const [cnKeywordSuggestions, setCnKeywordSuggestions] = useState<
    Array<{ labelKo: string; reason: string }>
  >([])
  const [pixabayKeywordSuggestions, setPixabayKeywordSuggestions] = useState<
    PixabayKeywordSuggestion[]
  >([])
  const [isSuggestingPixabayKeywords, setIsSuggestingPixabayKeywords] =
    useState(false)
  const [translatedSearchQuery, setTranslatedSearchQuery] = useState("")
  const [isTransforming, setIsTransforming] = useState<string | null>(null)
  const [preparingVideoUrl, setPreparingVideoUrl] = useState<string | null>(null)
  const [selectedRemixHits, setSelectedRemixHits] = useState<SearchHit[]>([])
  const [isRemixAutoAssigning, setIsRemixAutoAssigning] = useState(false)
  const [remixAssignProgress, setRemixAssignProgress] = useState("")
  const [searchError, setSearchError] = useState("")
  const [sfxLabel, setSfxLabel] = useState("")
  const [sfxSearch, setSfxSearch] = useState("")
  const [previewingSfxId, setPreviewingSfxId] = useState<string | null>(null)
  const [favoriteSfxIds, setFavoriteSfxIds] = useState<string[]>([])
  const [showFavoriteSfxOnly, setShowFavoriteSfxOnly] = useState(false)
  const [isAutoPlacingSfx, setIsAutoPlacingSfx] = useState(false)
  const [autoSfxMessage, setAutoSfxMessage] = useState("")
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [playheadSec, setPlayheadSec] = useState(0)
  const [thumbnailIntroPreview, setThumbnailIntroPreview] = useState<{
    url: string | null
    enabled: boolean
  }>({ url: null, enabled: false })
  const [timelineHeight, setTimelineHeight] = useState(220)
  const [timelineZoom, setTimelineZoom] = useState(1)
  const [previewZoom, setPreviewZoom] = useState(1)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [subtitleSizeDraft, setSubtitleSizeDraft] = useState(editSettings.subtitleSize)
  const [videoEditDraft, setVideoEditDraft] = useState<VideoEditDraft | null>(null)
  const [expandedSourceImage, setExpandedSourceImage] = useState<{
    url: string
    title: string
  } | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const sfxPreviewAudioRef = useRef<HTMLAudioElement | null>(null)
  const playingSfxRef = useRef(new Map<string, ActiveSfxPlayback>())
  const sfxBufferCacheRef = useRef(
    new Map<string, Promise<AudioBuffer | null>>()
  )
  const sfxAudioContextRef = useRef<AudioContext | null>(null)
  const mediaElementSourcesRef = useRef(
    new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>()
  )
  const exportStageRef = useRef<HTMLDivElement | null>(null)
  const isDownloadingRef = useRef(false)
  const selectedKeyRef = useRef("")
  const timelineRef = useRef<
    Array<{
      sceneId: string
      lineIndex: number
      startSec: number
      endSec: number
      durationSec: number
    }>
  >([])
  const briefRef = useRef(brief)
  const editSettingsRef = useRef(editSettings)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadStatusText, setDownloadStatusText] = useState(
    "영상 다운로드 중…"
  )
  const playGenRef = useRef(0)
  const playheadRef = useRef(0)
  const previousThumbnailIntroEnabledRef = useRef(false)
  const togglePlaybackRef = useRef<() => void>(() => undefined)
  const trimmedCacheRef = useRef(
    new Map<
      string,
      { blobUrl: string; trimStartSec: number; durationSec: number }
    >()
  )
  const rafRef = useRef<number | null>(null)
  const sfxSchedulerRafRef = useRef<number | null>(null)
  const timelinePanelRef = useRef<HTMLDivElement | null>(null)
  const timelineScrollRef = useRef<HTMLDivElement | null>(null)
  const autoPlacementRunRef = useRef(0)
  playheadRef.current = playheadSec

  const handleThumbnailIntroPreviewChange = useCallback(
    (url: string | null, enabled: boolean) => {
      setThumbnailIntroPreview((current) =>
        current.url === url && current.enabled === enabled
          ? current
          : { url, enabled }
      )
    },
    []
  )

  const showThumbnailIntro =
    thumbnailIntroPreview.enabled &&
    Boolean(thumbnailIntroPreview.url) &&
    (isMvpThumbnailIntroTime(playheadSec) ||
      (!isPlaying && (playheadSec <= 0.05 || rightTab === "thumbnail")))

  useEffect(() => {
    selectedKeyRef.current = selectedKey
  }, [selectedKey])

  useEffect(() => {
    const thumbnailState = brief.thumbnailState
    if (!thumbnailState?.gallery.length || !thumbnailState.selectedId) {
      setThumbnailIntroPreview({ url: null, enabled: false })
      return
    }

    let active = true
    void hydrateMvpThumbnailGallery(projectId, thumbnailState.gallery)
      .then((gallery) => {
        if (!active) return
        const selected = selectedThumbnailVariant(
          gallery,
          thumbnailState.selectedId
        )
        if (selected?.url && parseMvpThumbnailIdbRef(selected.url)) return
        setThumbnailIntroPreview({
          url: selected?.url || null,
          enabled:
            (thumbnailState.introOn ?? true) && Boolean(selected?.url),
        })
      })
      .catch(() => {
        if (!active) return
        const selected = selectedThumbnailVariant(
          thumbnailState.gallery,
          thumbnailState.selectedId
        )
        if (selected?.url && parseMvpThumbnailIdbRef(selected.url)) return
        setThumbnailIntroPreview({
          url: selected?.url || null,
          enabled:
            (thumbnailState.introOn ?? true) && Boolean(selected?.url),
        })
      })

    return () => {
      active = false
    }
  }, [brief.thumbnailState, projectId])

  useEffect(() => {
    if (!slots.length) return
    if (!selectedKey || !slots.some((s) => clipKey(s.sceneId, s.lineIndex) === selectedKey)) {
      setSelectedKey(clipKey(slots[0]!.sceneId, slots[0]!.lineIndex))
    }
  }, [selectedKey, slots])

  useEffect(() => {
    if (!selectedElementKey) return
    const parsed = parseClipKey(selectedElementKey)
    if (
      !parsed ||
      !resolveStoryLineAsset(brief.sceneAssets, parsed.sceneId, parsed.lineIndex)
    ) {
      setSelectedElementKey(null)
    }
  }, [brief.sceneAssets, selectedElementKey])

  useEffect(() => {
    if (
      selectedSfxId &&
      !(brief.sfxClips || []).some((clip) => clip.id === selectedSfxId)
    ) {
      setSelectedSfxId(null)
    }
  }, [brief.sfxClips, selectedSfxId])

  useEffect(() => {
    if (
      !(brief.sfxClips || []).some(
        (clip) => clip.autoPlaced && clip.autoVolumeVersion !== 2
      )
    ) {
      return
    }
    onChange((current) => ({
      ...current,
      sfxClips: (current.sfxClips || []).map((clip) =>
        clip.autoPlaced && clip.autoVolumeVersion !== 2
          ? {
              ...clip,
              volumePct: Math.max(1, (clip.volumePct ?? 100) * 0.5),
              autoVolumeVersion: 2,
            }
          : clip
      ),
    }))
  }, [brief.sfxClips, onChange])

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("story-shopping-sfx-favorites") || "[]")
      if (Array.isArray(saved)) {
        setFavoriteSfxIds(saved.filter((id): id is string => typeof id === "string"))
      }
    } catch {
      setFavoriteSfxIds([])
    }
  }, [])

  useEffect(() => {
    setSubtitleSizeDraft(editSettings.subtitleSize)
  }, [editSettings.subtitleSize])

  const selected = useMemo(() => {
    const parsed = parseClipKey(selectedKey)
    if (!parsed) return slots[0] || null
    return (
      slots.find(
        (s) => s.sceneId === parsed.sceneId && s.lineIndex === parsed.lineIndex
      ) ||
      slots[0] ||
      null
    )
  }, [selectedKey, slots])

  const filteredSfxCatalog = useMemo(() => {
    const keyword = sfxSearch.trim().toLocaleLowerCase("ko")
    const favorites = new Set(favoriteSfxIds)
    return STORY_SHOPPING_SFX_CATALOG.filter(
      (item) =>
        (!showFavoriteSfxOnly || favorites.has(item.id)) &&
        (!keyword ||
          item.label.toLocaleLowerCase("ko").includes(keyword) ||
          String(item.number).includes(keyword))
    ).sort((left, right) => {
      const favoriteOrder =
        Number(favorites.has(right.id)) - Number(favorites.has(left.id))
      return favoriteOrder || left.number - right.number
    })
  }, [favoriteSfxIds, sfxSearch, showFavoriteSfxOnly])

  const selectedScene = scenes.find((s) => s.id === selected?.sceneId)
  const selectedAsset = selected
    ? resolveStoryLineAsset(brief.sceneAssets, selected.sceneId, selected.lineIndex)
    : undefined
  const prefetchMedia = useMemo(() => {
    if (!selected) return []
    const index = slots.findIndex(
      (slot) =>
        slot.sceneId === selected.sceneId && slot.lineIndex === selected.lineIndex
    )
    if (index < 0) return []
    return slots
      .slice(index + 1, index + 3)
      .map((slot) => {
        const nextAsset = resolveStoryLineAsset(
          brief.sceneAssets,
          slot.sceneId,
          slot.lineIndex
        )
        if (!nextAsset?.mediaUrl) return null
        return {
          url: nextAsset.mediaUrl,
          mediaType: nextAsset.mediaType,
          trimStartSec: nextAsset.trimStartSec,
        }
      })
      .filter(
        (
          item
        ): item is {
          url: string
          mediaType: "image" | "video"
          trimStartSec?: number
        } => Boolean(item?.url)
      )
  }, [brief.sceneAssets, selected, slots])

  const timeline = useMemo(() => {
    let cursor = 0
    return slots.map((slot) => {
      const startSec = cursor
      const durationSec = Math.max(0.8, slot.durationSec)
      cursor += durationSec
      return { ...slot, startSec, endSec: cursor, durationSec }
    })
  }, [slots])

  const totalDuration = timeline[timeline.length - 1]?.endSec || 1
  timelineRef.current = timeline
  briefRef.current = brief
  editSettingsRef.current = editSettings
  const basePxPerSec = Math.max(28, Math.min(72, 900 / Math.max(8, totalDuration)))
  const pxPerSec = Math.max(16, Math.min(240, basePxPerSec * timelineZoom))

  // 영상 길이를 넘는 효과음은 잘라내거나 제거 (끝난 뒤 울림 방지)
  useEffect(() => {
    const clips = brief.sfxClips || []
    if (!clips.length || totalDuration <= 0) return
    let changed = false
    const next = clips.flatMap((clip) => {
      const clamped = clampStorySfxToTimeline(clip, totalDuration)
      if (!clamped) {
        changed = true
        return []
      }
      if (
        Math.abs(clamped.startSec - clip.startSec) > 0.001 ||
        Math.abs(clamped.durationSec - clip.durationSec) > 0.001
      ) {
        changed = true
      }
      return [clamped]
    })
    if (!changed) return
    onChange((current) => ({
      ...current,
      sfxClips: next,
    }))
  }, [brief.sfxClips, onChange, totalDuration])

  const selectedTimeline = timeline.find(
    (item) =>
      selected &&
      item.sceneId === selected.sceneId &&
      item.lineIndex === selected.lineIndex
  )
  const selectedSfx = selectedSfxId
    ? (brief.sfxClips || []).find((clip) => clip.id === selectedSfxId) || null
    : null

  const frameSettings = {
    ...DEFAULT_STORY_FRAME_SETTINGS,
    videoTitle: story?.title || DEFAULT_STORY_FRAME_SETTINGS.videoTitle,
    ...brief.frameSettings,
  }
  const activeElementSource =
    ELEMENT_SOURCES.find((source) => source.id === elementSource) ||
    ELEMENT_SOURCES[0]!
  const ActiveElementSourceIcon = activeElementSource.icon

  const displayLines = selected ? [selected.text] : []
  const subtitleFrameStyle = {
    textColor: editSettings.subtitleColor,
    textScale: Math.max(0.75, Math.min(1.35, editSettings.subtitleSize / 36)),
    textFontFamily: editSettings.subtitleFontFamily,
    textFontWeight: editSettings.subtitleFontWeight,
    textBackgroundColor: editSettings.subtitleBackgroundEnabled
      ? editSettings.subtitleBackgroundColor
      : "transparent",
    textOutlineWidth: editSettings.subtitleOutlineWidth,
    textOutlineColor: editSettings.subtitleOutlineColor,
  }
  const activeSubtitleFrameStyle = {
    ...subtitleFrameStyle,
    textScale: Math.max(0.75, Math.min(1.35, subtitleSizeDraft / 36)),
  }

  const patchEdit = (patch: Partial<StoryEditSettings>) => {
    onChange((current) => ({
      ...current,
      editSettings: { ...(current.editSettings || DEFAULT_EDIT), ...patch },
    }))
  }

  const applyAssetToSlot = useCallback(
    (
      sceneId: string,
      lineIndex: number,
      next: Omit<StorySceneAsset, "sceneId" | "lineIndex"> &
        Partial<Pick<StorySceneAsset, "sceneId" | "lineIndex">>
    ) => {
      const asset: StorySceneAsset = {
        ...next,
        sceneId,
        lineIndex,
        rightsConfirmed: next.rightsConfirmed ?? true,
        motionEffect: next.motionEffect || "zoom-in",
        mediaScale: next.mediaScale ?? 1,
        mediaOffsetX: next.mediaOffsetX ?? 0,
        mediaOffsetY: next.mediaOffsetY ?? 0,
        mediaFit: next.mediaFit || "cover",
      }
      onChange((current) => ({
        ...current,
        sceneAssets: [
          ...(current.sceneAssets || []).filter((item) => !isSameStoryAssetSlot(item, asset)),
          asset,
        ],
      }))
    },
    [onChange]
  )

  const applyAsset = useCallback(
    (
      next: Omit<StorySceneAsset, "sceneId" | "lineIndex"> &
        Partial<Pick<StorySceneAsset, "sceneId" | "lineIndex">>
    ) => {
      if (!selected) return
      applyAssetToSlot(selected.sceneId, selected.lineIndex, next)
    },
    [applyAssetToSlot, selected]
  )

  const filledCount = useMemo(() => {
    let n = 0
    for (const slot of slots) {
      if (resolveStoryLineAsset(brief.sceneAssets, slot.sceneId, slot.lineIndex)?.mediaUrl) n += 1
    }
    return n
  }, [brief.sceneAssets, slots])

  const reviewPhotoPool = useMemo(() => {
    const fromReviews = (brief.collectorData?.reviews || []).flatMap((r) => r.images || [])
    const groups = [
      [...(brief.collectorData?.reviewImages || []), ...fromReviews],
      [...(brief.collectorData?.productImages || []), brief.productImage],
    ]
    const candidates: string[] = []
    const maxGroupLength = Math.max(0, ...groups.map((group) => group.length))
    for (let index = 0; index < maxGroupLength; index += 1) {
      for (const group of groups) {
        const url = group[index]
        if (typeof url === "string") candidates.push(url)
      }
    }
    return Array.from(
      new Set(
        candidates.filter(
          (url): url is string =>
            typeof url === "string" && /^https?:\/\//i.test(url)
        )
      )
    )
  }, [
    brief.collectorData?.productImages,
    brief.collectorData?.reviewImages,
    brief.collectorData?.reviews,
    brief.productImage,
  ])

  const runAutomaticAssetPlacement = async () => {
    if (!slots.length || isAutoPlacing) return
    const runId = autoPlacementRunRef.current + 1
    autoPlacementRunRef.current = runId
    const openAiKey =
      localStorage.getItem("shotform_openai_api_key") || undefined
    const replicateKey =
      localStorage.getItem("shotform_replicate_api_key") || undefined
    const pixabayKey =
      localStorage.getItem("shotform_pixabay_api_key") || undefined
    const apifyKey =
      localStorage.getItem("shotform_apify_token") || undefined
    const klipyKey =
      localStorage.getItem("shotform_klipy_api_key") || undefined
    const productImage = getProductImage(brief)
    const usedUrls = new Set<string>()
    const usedFingerprints = new Set<string>()
    const usedPixabayIds = new Set<number>()
    const pixabayIdByMediaUrl = new Map<string, number>()
    const usedReferenceUrls = new Set<string>()
    const markMediaUsed = (url: string, pixabayId?: number) => {
      if (!url) return
      usedUrls.add(url)
      const fp = mediaFingerprint(url)
      if (fp) usedFingerprints.add(fp)
      if (typeof pixabayId === "number" && Number.isFinite(pixabayId)) {
        usedPixabayIds.add(pixabayId)
      }
    }
    const isMediaUsed = (url: string, pixabayId?: number) => {
      if (typeof pixabayId === "number" && usedPixabayIds.has(pixabayId)) {
        return true
      }
      if (!url) return false
      if (usedUrls.has(url)) return true
      const fp = mediaFingerprint(url)
      return Boolean(fp && usedFingerprints.has(fp))
    }
    const pickUnused = <T,>(
      items: T[],
      getMediaUrl: (item: T) => string,
      getSearchText?: (item: T) => string,
      relevanceQuery?: string,
      getPixabayId?: (item: T) => number | undefined,
      diversityIndex = 0
    ) => {
      const tokens = (relevanceQuery || "")
        .toLowerCase()
        .split(/[\s,./_-]+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2)
      const unused = [...items].filter((item) => {
        const url = getMediaUrl(item)
        return Boolean(url) && !isMediaUsed(url, getPixabayId?.(item))
      })
      if (!unused.length) return undefined
      const ranked = unused.sort((a, b) => {
        const score = (item: T) => {
          const text = (getSearchText?.(item) || "").toLowerCase()
          return tokens.reduce(
            (sum, token) => sum + (text.includes(token) ? 2 : 0),
            0
          )
        }
        return score(b) - score(a)
      })
      // 상위 후보 안에서 클립 번호로 돌려 가며 고름 → 같은 1등 반복 방지
      const pool = ranked.slice(0, Math.min(6, ranked.length))
      return pool[diversityIndex % pool.length]
    }
    const pickAiRelevant = async <T,>(
      items: T[],
      getMediaUrl: (item: T) => string,
      getPreviewUrl: (item: T) => string,
      getLabel: (item: T) => string,
      visualQuery: string,
      sceneText: string,
      needsProduct: boolean,
      getPixabayId?: (item: T) => number | undefined,
      diversityIndex = 0
    ): Promise<T | undefined> => {
      const candidates = items
        .filter(
          (item) =>
            Boolean(getMediaUrl(item)) &&
            !isMediaUsed(getMediaUrl(item), getPixabayId?.(item)) &&
            /^https?:\/\//i.test(getPreviewUrl(item))
        )
        .slice(0, 12)
      if (!candidates.length) return undefined
      try {
        const response = await fetch(
          "/api/shotform/story-shopping/asset-search",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              source: "rank_candidates",
              sceneText,
              productName: needsProduct ? brief.productName : "",
              visualQuery,
              openaiApiKey: openAiKey,
              candidates: candidates.map((item, index) => ({
                id: String(index),
                imageUrl: getPreviewUrl(item),
                label: getLabel(item),
              })),
            }),
          }
        )
        const payload = await response.json().catch(() => ({}))
        if (response.ok && payload.selectedId != null) {
          const selected = candidates[Number(payload.selectedId)]
          if (selected) {
            // 선택된 것을 맨 앞에 두고, 클립별로 상위 풀에서 순환 선택
            const ordered = [
              selected,
              ...candidates.filter((item) => item !== selected),
            ]
            const pool = ordered.slice(0, Math.min(5, ordered.length))
            return pool[diversityIndex % pool.length]
          }
        }
      } catch {
        // ranking 실패 시 아래 키워드 매칭으로 폴백
      }
      return pickUnused(
        items,
        getMediaUrl,
        getLabel,
        visualQuery,
        getPixabayId,
        diversityIndex
      )
    }

    setIsAutoPlacing(true)
    setSearchError("")
    // Replicate(Nano Banana)가 한 번이라도 500/503이면 같은 실행에서 AI 생성은 건너뛰고 검색으로 폴백
    let replicateUnavailable = false
    const isReplicateOutageMessage = (message: string) =>
      /\b(500|502|503|504)\b/.test(message) ||
      /Internal server error|Service Temporarily Unavailable|replicate/i.test(
        message
      )

    // 이미 이미지가 있는 클립은 유지하되, 앞에 쓴 이미지와 중복이면 다시 채웁니다.
    const filledKeys = new Set<string>()
    for (const slot of slots) {
      const existing = resolveStoryLineAsset(
        brief.sceneAssets,
        slot.sceneId,
        slot.lineIndex
      )
      if (!existing?.mediaUrl) continue
      if (isMediaUsed(existing.mediaUrl)) {
        // 같은 이미지가 앞 클립에 이미 있음 → 이 슬롯은 빈 것으로 보고 재배치
        continue
      }
      filledKeys.add(clipKey(slot.sceneId, slot.lineIndex))
      markMediaUsed(existing.mediaUrl)
    }
    const emptySlots = slots.filter(
      (slot) => !filledKeys.has(clipKey(slot.sceneId, slot.lineIndex))
    )
    if (!emptySlots.length) {
      setIsAutoPlacing(false)
      setAutoPlacementProgress("이미 모든 클립에 이미지가 있습니다.")
      return
    }

    setAutoPlacementProgress(
      filledKeys.size
        ? `고유 이미지 ${filledKeys.size}개 유지 · 빈/중복 ${emptySlots.length}개 재배치 준비…`
        : `빈 클립 ${emptySlots.length}개 배치 준비 중…`
    )

    try {
      const planningSlots = emptySlots.map((slot) => {
        const globalIndex = slots.findIndex(
          (item) =>
            item.sceneId === slot.sceneId && item.lineIndex === slot.lineIndex
        )
        const scene = scenes.find((item) => item.id === slot.sceneId)
        const contextStart = Math.max(0, globalIndex - 1)
        const contextEnd = Math.min(slots.length, globalIndex + 2)
        return {
          sceneId: slot.sceneId,
          lineIndex: slot.lineIndex,
          text: slot.text,
          contextText: slots
            .slice(contextStart, contextEnd)
            .map((item) => item.text)
            .join(" → "),
          visualPrompt: scene?.visualPrompt,
          durationSec: slot.durationSec,
        }
      })
      const planResponse = await fetch(
        "/api/shotform/story-shopping/asset-search",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "auto_plan",
            productName: brief.productName,
            productDescription: brief.productDescription,
            openaiApiKey: openAiKey,
            availability: {
              review: reviewPhotoPool.length > 0,
              product: Boolean(productImage),
              pixabay: Boolean(pixabayKey),
              apify: Boolean(apifyKey),
              klipy: Boolean(klipyKey),
              replicate: Boolean(replicateKey),
            },
            slots: planningSlots,
          }),
        }
      )
      const planPayload = await planResponse.json().catch(() => ({}))
      if (!planResponse.ok) {
        throw new Error(planPayload.error || "AI 장면 계획 생성 실패")
      }
      const plans = (planPayload.plans || []) as AutoAssetPlan[]
      const planByKey = new Map(
        plans.map((plan) => [
          `${plan.sceneId}:${plan.lineIndex}`,
          plan,
        ])
      )

      const buildAsset = async (
        plan: AutoAssetPlan,
        slot: StoryMashupLineSlot,
        slotIndex: number
      ): Promise<
        | (Omit<StorySceneAsset, "sceneId" | "lineIndex"> &
            Partial<Pick<StorySceneAsset, "sceneId" | "lineIndex">>)
        | null
      > => {
        const queryKo = plan.queryKo || slot.text || brief.productName
        const sceneContext = slots
          .slice(Math.max(0, slotIndex - 1), Math.min(slots.length, slotIndex + 2))
          .map((contextSlot, contextIndex) =>
            contextIndex === Math.min(1, slotIndex)
              ? `[현재] ${contextSlot.text}`
              : contextSlot.text
          )
          .join(" → ")
        const reviewImage =
          Array.from(
            { length: reviewPhotoPool.length },
            (_, offset) =>
              reviewPhotoPool[
                (slotIndex + offset) % reviewPhotoPool.length
              ]!
          ).find((url) => !usedReferenceUrls.has(url)) ||
          reviewPhotoPool[slotIndex % Math.max(1, reviewPhotoPool.length)]

        // Replicate 장애 시: AI 변형 없이 리뷰/제품 원본으로라도 빈 슬롯을 채움
        if (
          (plan.source === "review-original" || plan.source === "product") &&
          plan.needsProduct
        ) {
          const fallbackUrl =
            (plan.source === "review-original" ? reviewImage : null) ||
            productImage ||
            reviewImage
          if (fallbackUrl && !usedUrls.has(fallbackUrl)) {
            if (reviewImage && fallbackUrl === reviewImage) {
              usedReferenceUrls.add(reviewImage)
            }
            return {
              mediaUrl: fallbackUrl,
              mediaType: "image",
              source: "upload",
              license: "user-upload",
              rightsConfirmed: true,
              motionEffect: "zoom-in",
              editorNote: `AI 자동 배치 · 원본 사진 폴백 · ${plan.reason}`,
            }
          }
        }

        if (plan.source === "review-ai" && plan.needsProduct && reviewImage) {
          if (replicateUnavailable) return null
          try {
            const imageUrl = await generateImageWithNanobanana(
              [
                `대본 장면: ${slot.text}`,
                `앞뒤 대본 문맥: ${sceneContext}`,
                `화면 행동: ${queryKo}`,
                "실제 리뷰 사진 속 제품의 모양, 색상, 재질, 버튼, 비율을 정확히 유지한다.",
                "참조 사진의 구도, 카메라 각도, 피사체 위치, 제품 방향은 그대로 복사하지 않고 완전히 새롭게 구성한다.",
                "참조 사진에 사람의 손·팔·신체가 있으면 사람과 제품의 사용 관계만 유지하고, 손동작·잡는 자세·제품 접촉 위치·촬영 각도는 자연스럽게 다르게 연출한다.",
                "손에 감겨 있거나 손으로 쥔 제품은 새로운 손동작으로 다시 사용하되 제품만 있는 정물 사진으로 바꾸지 않는다.",
                "참조 사진에 사람이 없다면 대본에서 실제 사용 행동이 필요한 경우에만 새로운 자연스러운 손을 추가한다.",
                "제품이 화면 중심을 차지하고 사용 행동이 한눈에 이해되는 사실적인 세로형 9:16 사진.",
                "제품과 손의 관계는 유지하되 배경, 조명, 색감, 피사계 심도는 대본 상황에 맞는 새로운 생활 공간으로 눈에 띄게 재연출한다.",
                "원본 사진을 그대로 복사하지 말고 광고 촬영처럼 선명하고 완성도 높은 새 사진으로 변형한다.",
                "제품을 다른 물건으로 바꾸거나 추가 제품, 글자, 로고, 워터마크를 만들지 않는다.",
              ].join("\n"),
              brief.productName || "product",
              reviewImage,
              replicateKey,
              slotIndex,
              brief.productDescription,
              "9:16",
              "nano-banana",
              "strict-review",
              openAiKey
            )
            if (imageUrl.trim() === reviewImage.trim()) {
              throw new Error("AI가 참조 사진을 그대로 반환함")
            }
            const approvedImage = await pickAiRelevant(
              [imageUrl],
              (url) => url,
              (url) => url,
              () => "리뷰 사진을 바탕으로 생성한 제품 사용 장면",
              queryKo,
              sceneContext,
              true
            )
            if (!approvedImage) {
              throw new Error("생성 이미지가 대본 장면과 일치하지 않음")
            }
            usedReferenceUrls.add(reviewImage)
            return {
              mediaUrl: approvedImage,
              mediaType: "image",
              source: "ai",
              license: "generated",
              rightsConfirmed: true,
              generatedFromImageUrl: reviewImage,
              motionEffect: "zoom-in",
              editorNote: `AI 자동 배치 · 상세페이지/리뷰 기반 생성 · ${plan.reason}`,
            }
          } catch (reviewAiError) {
            const message =
              reviewAiError instanceof Error
                ? reviewAiError.message
                : String(reviewAiError)
            if (isReplicateOutageMessage(message)) {
              replicateUnavailable = true
              console.warn(
                "[StoryEditor] Replicate 장애 감지 → 이후 AI 생성 건너뛰고 검색 폴백"
              )
            }
            return null
          }
        }

        if (
          (plan.source === "pixabay-video" ||
            plan.source === "pixabay-image")
        ) {
          const queryEnBase = await translateFreeAssetSearchQuery(
            queryKo,
            sceneContext,
            openAiKey
          )
          const diversityHint =
            PIXABAY_DIVERSITY_HINTS[slotIndex % PIXABAY_DIVERSITY_HINTS.length]
          const queryEn = `${queryEnBase} ${diversityHint}`.trim()
          const searchPage = (slotIndex % 3) + 1
          if (plan.source === "pixabay-video") {
            const result = await searchPixabayVideos(queryEn, pixabayKey, {
              perPage: 24,
              page: searchPage,
            })
            const picked = await pickAiRelevant(
              result.hits,
              (item) => item.videoURL,
              (item) => item.previewURL,
              (item) => item.tags,
              queryEn,
              sceneContext,
              plan.needsProduct,
              (item) => item.id,
              slotIndex
            )
            if (picked) {
              pixabayIdByMediaUrl.set(picked.videoURL, picked.id)
              return {
                mediaUrl: picked.videoURL,
                mediaType: "video",
                source: "pixabay",
                sourcePageUrl: picked.pageURL,
                attribution: picked.user,
                license: "pixabay",
                rightsConfirmed: true,
                trimEndSec: picked.duration,
                editorNote: `AI 자동 배치 · 무료 영상 · ${plan.reason}`,
              }
            }
          }
          const result = await searchPixabayImages(queryEn, pixabayKey, {
            perPage: 24,
            page: searchPage,
            orientation: "vertical",
          })
          const picked = await pickAiRelevant(
            result.hits,
            (item) => item.largeImageURL || item.webformatURL,
            (item) => item.previewURL || item.webformatURL,
            (item) => item.tags,
            queryEn,
            sceneContext,
            plan.needsProduct,
            (item) => item.id,
            slotIndex
          )
          if (picked) {
            const mediaUrl = picked.largeImageURL || picked.webformatURL
            pixabayIdByMediaUrl.set(mediaUrl, picked.id)
            // 크기별 URL도 같은 사진으로 막아 둠
            if (picked.webformatURL) {
              pixabayIdByMediaUrl.set(picked.webformatURL, picked.id)
            }
            if (picked.largeImageURL) {
              pixabayIdByMediaUrl.set(picked.largeImageURL, picked.id)
            }
            return {
              mediaUrl,
              mediaType: "image",
              source: "pixabay",
              sourcePageUrl: picked.pageURL,
              attribution: picked.user,
              license: "pixabay",
              rightsConfirmed: true,
              motionEffect: "zoom-in",
              editorNote: `AI 자동 배치 · 무료 이미지 · ${plan.reason}`,
            }
          }
        }

        if (
          (plan.source === "douyin" ||
            plan.source === "xiaohongshu")
        ) {
          const translated = await fetchCnKeywordTranslation({
            keywords: [queryKo],
            platform: plan.source,
            openaiApiKey: openAiKey || null,
          })
          const queries =
            translated.searchQueries?.length > 0
              ? translated.searchQueries
              : [queryKo]
          const response = await fetch(
            "/api/shotform/story-shopping/asset-search",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                source: plan.source,
                query: queries[0],
                keywords: queries,
                apifyApiKey: apifyKey,
              }),
            }
          )
          const payload = await response.json().catch(() => ({}))
          if (response.ok) {
            const picked = await pickAiRelevant(
              (payload.items || []) as Array<SearchHit & { source?: string }>,
              (item) => item.mediaUrl,
              (item) => item.thumbnailUrl || item.mediaUrl,
              (item) => item.title,
              queries[0],
              sceneContext,
              plan.needsProduct
            )
            if (picked?.mediaUrl) {
              const playableResponse = await fetch(
                "/api/shotform/mvp-download",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    apifyApiKey: apifyKey,
                    items: [
                      {
                        url: picked.pageUrl,
                        videoUrl: picked.mediaUrl,
                        platform: plan.source,
                        title: picked.title,
                      },
                    ],
                  }),
                }
              )
              const playablePayload = (await playableResponse
                .json()
                .catch(() => ({}))) as {
                results?: Array<{ downloadUrl?: string | null }>
              }
              const playableUrl =
                playablePayload.results?.[0]?.downloadUrl || ""
              if (!playableResponse.ok || !playableUrl) return null
              return {
                mediaUrl: playableUrl,
                mediaType: "video",
                source: plan.source,
                sourcePageUrl: picked.pageUrl,
                attribution: picked.attribution,
                license: "permission-required",
                rightsConfirmed: false,
                trimEndSec: picked.durationSec,
                editorNote: `AI 자동 배치 · 해외 숏폼 · 권리 확인 필요 · ${plan.reason}`,
              }
            }
          }
        }

        if (plan.source === "klipy") {
          const params = new URLSearchParams({ q: queryKo, limit: "20" })
          if (klipyKey) params.set("apiKey", klipyKey)
          const response = await fetch(
            `/api/shotform/klipy/search?${params.toString()}`
          )
          const payload = await response.json().catch(() => ({}))
          const picked = response.ok
            ? await pickAiRelevant(
                (payload.items || []) as SearchHit[],
                (item) => item.mediaUrl,
                (item) => item.thumbnailUrl || item.mediaUrl,
                (item) => item.title,
                queryKo,
                sceneContext,
                false
              )
            : null
          if (picked?.mediaUrl) {
            return {
              mediaUrl: picked.mediaUrl,
              mediaType: "image",
              source: "klipy",
              sourcePageUrl: picked.pageUrl,
              attribution: picked.attribution || "Klipy GIF",
              license: "permission-required",
              rightsConfirmed: false,
              editorNote: `AI 자동 배치 · GIF 강조 요소 · ${plan.reason}`,
            }
          }
        }

        if (
          plan.source === "ai-image" ||
          plan.source === "ai-video"
        ) {
          if (replicateUnavailable) return null
          try {
            const generationPrompt = plan.needsProduct
              ? [
                  `대본 장면: ${slot.text}`,
                  `앞뒤 대본 문맥: ${sceneContext}`,
                  `반드시 보여줄 행동: ${queryKo}`,
                  `제품: ${brief.productName}`,
                  "참조 제품의 외형, 색상, 구조, 버튼, 크기 비율을 정확히 유지한다.",
                  "사람의 손이 제품을 실제 생활 공간에서 직접 사용·설치·세척·보관하는 구체적인 순간을 연출한다.",
                  "제품과 손의 행동을 클로즈업하고 배경은 대본 상황과 일치시킨다.",
                  "추상적인 분위기 사진, 제품만 놓인 정물 사진, 관련 없는 사람 사진을 만들지 않는다.",
                  "글자, 자막, 로고, 워터마크, 가짜 기능, 추가 제품을 생성하지 않는다.",
                  "사실적인 세로형 9:16 쇼츠 장면.",
                ]
              : [
                  `대본 장면: ${slot.text}`,
                  `앞뒤 대본 문맥: ${sceneContext}`,
                  `반드시 보여줄 상황과 행동: ${queryKo}`,
                  "대본의 장소, 인물 감정, 문제 상황 또는 행동을 구체적으로 보여준다.",
                  "상품, 제품 패키지, 쇼핑몰 상세페이지, 리뷰 사진은 화면에 등장시키지 않는다.",
                  "단순한 제품 정물 사진 대신 문맥을 즉시 이해할 수 있는 자연스러운 생활 장면을 만든다.",
                  "글자, 자막, 로고, 워터마크를 생성하지 않는다.",
                  "사실적인 세로형 9:16 쇼츠 장면.",
                ]
            const imageUrl = await generateImageWithNanobanana(
              generationPrompt.join("\n"),
              plan.needsProduct
                ? brief.productName || "product"
                : "story context scene",
              plan.needsProduct ? productImage || reviewImage || "" : "",
              replicateKey,
              slotIndex,
              plan.needsProduct ? brief.productDescription : slot.text,
              "9:16",
              "nano-banana",
              "product-recompose",
              openAiKey
            )
            const approvedImage = await pickAiRelevant(
              [imageUrl],
              (url) => url,
              (url) => url,
              () =>
                plan.needsProduct
                  ? "AI가 생성한 제품 사용 장면"
                  : "AI가 생성한 대본 상황 장면",
              queryKo,
              sceneContext,
              plan.needsProduct
            )
            if (!approvedImage) {
              throw new Error("생성 이미지가 대본 장면과 일치하지 않음")
            }
            if (plan.source === "ai-video") {
              try {
                const prompt = await generateVideoPromptForImage(
                  (slotIndex % 3) as 0 | 1 | 2,
                  plan.needsProduct ? brief.productName : "story scene",
                  plan.needsProduct
                    ? `${brief.productDescription}\n장면: ${slot.text}`
                    : `제품 없이 대본 상황과 행동만 영상화\n장면: ${slot.text}`,
                  Math.min(10, Math.max(5, Math.ceil(slot.durationSec))),
                  openAiKey
                )
                const videoUrl = await convertImageToVideoWithWan(
                  approvedImage,
                  prompt,
                  undefined,
                  replicateKey,
                  Math.min(10, Math.max(5, Math.ceil(slot.durationSec)))
                )
                return {
                  mediaUrl: videoUrl,
                  mediaType: "video",
                  source: "image-to-video",
                  license: "generated",
                  rightsConfirmed: true,
                  generatedFromImageUrl: imageUrl,
                  editorNote: `AI 자동 배치 · AI 영상 · ${plan.reason}`,
                }
              } catch {
                // 영상화 실패 시 생성 이미지를 사용해 빈 장면을 방지합니다.
              }
            }
            return {
              mediaUrl: approvedImage,
              mediaType: "image",
              source: "ai",
              license: "generated",
              rightsConfirmed: true,
              motionEffect: "zoom-in",
              editorNote: `AI 자동 배치 · AI 이미지 · ${plan.reason}`,
            }
          } catch (aiError) {
            // Replicate Nano Banana 일시 장애(500/503) 시 Pixabay 등으로 폴백
            const message =
              aiError instanceof Error ? aiError.message : String(aiError)
            if (isReplicateOutageMessage(message)) {
              replicateUnavailable = true
              console.warn(
                "[StoryEditor] Replicate 장애 감지 → 이후 AI 생성 건너뛰고 관련 이미지 검색"
              )
            }
            console.warn(
              "[StoryEditor] AI 이미지 생성 실패, 다른 소스 폴백:",
              message
            )
            return null
          }
        }

        return null
      }

      let completed = 0
      const failed: string[] = []
      const skipped = filledKeys.size
      for (let emptyIndex = 0; emptyIndex < emptySlots.length; emptyIndex += 1) {
        if (autoPlacementRunRef.current !== runId) return
        const slot = emptySlots[emptyIndex]!
        const globalIndex = slots.findIndex(
          (item) =>
            item.sceneId === slot.sceneId && item.lineIndex === slot.lineIndex
        )
        const slotKey = `${slot.sceneId}:${slot.lineIndex}`
        const scene = scenes.find((item) => item.id === slot.sceneId)
        const rawPlan =
          planByKey.get(slotKey) ||
          ({
            sceneId: slot.sceneId,
            lineIndex: slot.lineIndex,
            source: "product",
            needsProduct:
              /제품|상품|사용|설치|세척|버튼|기능|작동|후기|리뷰|구매/.test(
                slot.text
              ),
            queryKo: scene?.visualPrompt || slot.text,
            reason: "기본 상품 장면",
          } satisfies AutoAssetPlan)
        const plan: AutoAssetPlan =
          rawPlan.needsProduct &&
          (rawPlan.source === "review-original" || rawPlan.source === "product")
            ? {
                ...rawPlan,
                source: reviewPhotoPool.length ? "review-ai" : "ai-image",
                reason: "원본 사진을 직접 쓰지 않고 AI로 변형",
              }
            : !rawPlan.needsProduct &&
                (rawPlan.source === "review-ai" ||
                  rawPlan.source === "review-original" ||
                  rawPlan.source === "product")
              ? {
                  ...rawPlan,
                  source: "ai-image",
                  reason: "제품이 필요 없는 문맥을 상황 이미지로 생성",
                }
            : rawPlan
        setAutoPlacementProgress(
          `빈 클립 ${emptyIndex + 1}/${emptySlots.length}` +
            (skipped ? ` · 유지 ${skipped}개` : "") +
            ` · ${plan.reason} · ${plan.source}`
        )

        let asset: Awaited<ReturnType<typeof buildAsset>> = null
        const isAiImagePlan =
          plan.source === "review-ai" ||
          plan.source === "ai-image" ||
          plan.source === "ai-video"
        // AI 생성 실패/장애 시 관련 무료 이미지를 바로 찾도록 Pixabay를 앞에 둡니다.
        const fallbackSources: AutoAssetPlan["source"][] = [
          ...(replicateUnavailable && isAiImagePlan ? [] : [plan.source]),
          ...(plan.needsProduct && reviewPhotoPool.length && !replicateUnavailable
            ? (["review-ai"] as const)
            : []),
          ...(!replicateUnavailable && isAiImagePlan
            ? (["ai-image"] as const)
            : []),
          "pixabay-video",
          "pixabay-image",
          "douyin",
          "xiaohongshu",
          // Replicate 장애 + 제품 장면: 검색 실패해도 원본 사진으로 채움
          ...(replicateUnavailable && plan.needsProduct
            ? (["review-original", "product"] as const)
            : []),
          ...(!replicateUnavailable && !isAiImagePlan
            ? (["ai-image"] as const)
            : []),
        ]
        if (replicateUnavailable) {
          setAutoPlacementProgress(
            `빈 클립 ${emptyIndex + 1}/${emptySlots.length}` +
              (skipped ? ` · 유지 ${skipped}개` : "") +
              ` · Replicate 장애 · 관련 이미지 검색 중`
          )
        }
        for (const source of Array.from(new Set(fallbackSources))) {
          if (autoPlacementRunRef.current !== runId) return
          try {
            asset = await buildAsset(
              { ...plan, source },
              slot,
              globalIndex >= 0 ? globalIndex : emptyIndex
            )
            if (!asset?.mediaUrl) continue
            if (isMediaUsed(asset.mediaUrl, pixabayIdByMediaUrl.get(asset.mediaUrl))) {
              asset = null
              continue
            }
            break
          } catch {
            asset = null
          }
        }

        if (!asset?.mediaUrl) {
          failed.push(`${(globalIndex >= 0 ? globalIndex : emptyIndex) + 1}`)
          continue
        }
        if (autoPlacementRunRef.current !== runId) return
        markMediaUsed(
          asset.mediaUrl,
          pixabayIdByMediaUrl.get(asset.mediaUrl)
        )
        applyAssetToSlot(slot.sceneId, slot.lineIndex, asset)
        completed += 1
      }

      setAutoPlacementProgress(
        failed.length
          ? `${completed}개 새로 배치 · 기존 ${skipped}개 유지 · 실패 ${failed.join(", ")}번` +
              (replicateUnavailable ? " · (Replicate 일시 장애로 일부는 검색 소재 사용)" : "")
          : skipped
            ? `기존 ${skipped}개 유지 · 빈 클립 ${completed}개 새 배치 완료` +
              (replicateUnavailable ? " · (Replicate 장애 → 관련 이미지 검색으로 채움)" : "")
            : `${completed}개 전체 새 배치 완료` +
              (replicateUnavailable ? " · (Replicate 장애 → 관련 이미지 검색으로 채움)" : "")
      )
      if (failed.length) {
        setSearchError(
          replicateUnavailable
            ? "Replicate가 일시 장애라 AI 생성은 건너뛰었습니다. Pixabay API 키를 설정하면 관련 이미지로 빈 클립을 채울 수 있습니다."
            : "일부 장면은 사용 가능한 원본 사진이나 API 키가 없어 채우지 못했습니다."
        )
      } else if (replicateUnavailable) {
        setSearchError(
          "Replicate가 일시적으로 불안정해 AI 이미지 대신 관련 검색 소재로 채웠습니다. 잠시 후 다시 시도하면 생성 품질이 더 나을 수 있습니다."
        )
      }
    } catch (reason) {
      setSearchError(
        reason instanceof Error ? reason.message : "자동 소재 배치 실패"
      )
      setAutoPlacementProgress("")
    } finally {
      if (autoPlacementRunRef.current === runId) setIsAutoPlacing(false)
    }
  }

  const transformReviewWithNano = async (imageUrl: string) => {
    if (!selected) {
      setSearchError("왼쪽에서 클립을 먼저 선택하세요.")
      return
    }
    const replicateKey = localStorage.getItem("shotform_replicate_api_key") || undefined
    if (!replicateKey) {
      setSearchError("설정에서 Replicate API 키를 저장해주세요.")
      return
    }
    setIsTransforming(imageUrl)
    setSearchError("")
    try {
      const prompt = [
        "Transform this real Coupang customer review photo into a clean vertical 9:16 shopping short-form visual.",
        "Keep the exact product identity, color, material, proportions, and function, but DO NOT copy the original composition or pose.",
        "If the reference contains a human hand, arm, or body, keep a human using the product but create a different natural hand gesture, grip, finger placement, product orientation, camera angle, framing, and subject position.",
        "Never remove a hand-held context and replace it with a product-only still life. Change the pose and staging while preserving the same type of real-world product use.",
        "Visibly redesign the composition, background, lighting, color grade, depth of field, and surrounding lifestyle environment.",
        "Do not return a near-copy of the input. Create an obviously transformed commercial lifestyle photograph where only the product identity and usage meaning remain consistent.",
        "Remove watermarks/text overlays and rebuild the result as a full-bleed vertical 9:16 scene.",
        `Scene narration context: ${selected.text}`,
        brief.productName ? `Product: ${brief.productName}` : "",
      ]
        .filter(Boolean)
        .join(" ")
      const openAiKey =
        localStorage.getItem("shotform_openai_api_key") || undefined
      const outUrl = await generateImageWithNanobanana(
        prompt,
        brief.productName || "product",
        imageUrl,
        replicateKey,
        selected.lineIndex,
        brief.productDescription,
        "9:16",
        "nano-banana",
        "strict-review",
        openAiKey
      )
      if (outUrl.trim() === imageUrl.trim()) {
        throw new Error("AI가 원본과 동일한 이미지를 반환했습니다. 다시 시도해주세요.")
      }
      applyAsset({
        mediaUrl: outUrl,
        mediaType: "image",
        source: "ai",
        license: "generated",
        generatedFromImageUrl: imageUrl,
        editorNote: "리뷰 사진 → AI 변형",
      })
    } catch (reason) {
      setSearchError(reason instanceof Error ? reason.message : "AI 변형 실패")
    } finally {
      setIsTransforming(null)
    }
  }

  const recommendCnSearchKeywords = async (
    platform: "douyin" | "xiaohongshu"
  ) => {
    setIsSuggestingCnKeywords(true)
    setCnKeywordSuggestions([])
    setSearchError("")
    try {
      const suggestions = await generateCnVideoKeywordSuggestions(
        brief.productName,
        brief.productDescription,
        platform,
        localStorage.getItem("shotform_openai_api_key") || undefined
      )
      if (!suggestions.length) throw new Error("추천 검색어를 만들지 못했습니다.")
      setCnKeywordSuggestions(suggestions)
      setQuery(suggestions[0]!.labelKo)
    } catch (reason) {
      setSearchError(
        reason instanceof Error ? reason.message : "검색어 추천에 실패했습니다."
      )
    } finally {
      setIsSuggestingCnKeywords(false)
    }
  }

  const recommendPixabaySearchKeywords = async () => {
    setIsSuggestingPixabayKeywords(true)
    setPixabayKeywordSuggestions([])
    setTranslatedSearchQuery("")
    setSearchError("")
    try {
      const sceneContext = [
        selected?.text,
        selectedScene?.visualPrompt,
        brief.generatedStory?.hook,
      ]
        .filter(Boolean)
        .join("\n")
      const suggestions = await generatePixabayKeywordSuggestions(
        sceneContext || brief.productName,
        brief.productName,
        localStorage.getItem("shotform_openai_api_key") || undefined
      )
      if (!suggestions.length) {
        throw new Error("이 장면에 어울리는 무료 소재 검색어를 만들지 못했습니다.")
      }
      setPixabayKeywordSuggestions(suggestions)
      setQuery(suggestions[0]!.labelKo)
      setTranslatedSearchQuery(suggestions[0]!.queryEn)
    } catch (reason) {
      setSearchError(
        reason instanceof Error ? reason.message : "무료 소재 검색어 추천에 실패했습니다."
      )
    } finally {
      setIsSuggestingPixabayKeywords(false)
    }
  }

  const runSearch = async () => {
    setIsSearching(true)
    setSearchError("")
    setHits([])
    try {
      if (elementSource === "upload") return

      if (elementSource === "review-nano") {
        if (!reviewPhotoPool.length) {
          throw new Error(
            "리뷰/제품 사진이 없습니다. 상품 서칭·수집기에서 쿠팡 데이터를 다시 불러오세요."
          )
        }
        setHits(
          reviewPhotoPool.map((url, index) => ({
            id: `review-${index}`,
            title: `리뷰/제품 사진 ${index + 1}`,
            thumbnailUrl: url,
            mediaUrl: url,
            pageUrl: url,
            mediaType: "image",
            source: "ai",
            attribution: "Coupang review",
            license: "permission-confirmed",
          }))
        )
        return
      }

      if (elementSource === "lens") {
        const imageUrl = getProductImage(brief)
        if (!imageUrl) throw new Error("쿠팡 제품 메인 사진이 없습니다.")
        const serp = getSerpKey()
        if (!serp) throw new Error("SerpAPI 키가 필요합니다.")
        const res = await fetch("/api/shotform/story-shopping/asset-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "google_lens", imageUrl, serpApiKey: serp }),
        })
        const payload = await res.json()
        if (!res.ok) throw new Error(payload.error || "렌즈 검색 실패")
        setHits(
          (payload.items || []).map((item: SearchHit & { source?: string }) => ({
            id: item.id,
            title: item.title,
            thumbnailUrl: item.thumbnailUrl,
            mediaUrl: item.mediaUrl,
            pageUrl: item.pageUrl,
            mediaType: "image",
            source: "google",
            attribution: item.attribution,
            license: "permission-confirmed",
          }))
        )
        return
      }

      if (elementSource === "google") {
        const serp = getSerpKey()
        if (!serp) throw new Error("SerpAPI 키가 필요합니다.")
        const q = query.trim() || brief.productName || selected?.text || "product"
        const res = await fetch("/api/shotform/story-shopping/asset-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "google", query: q, serpApiKey: serp }),
        })
        const payload = await res.json()
        if (!res.ok) throw new Error(payload.error || "Google 검색 실패")
        setHits(
          (payload.items || []).map((item: SearchHit) => ({
            ...item,
            mediaType: "image",
            source: "google",
            license: "permission-confirmed",
          }))
        )
        return
      }

      if (elementSource === "pixabay") {
        const key = localStorage.getItem("shotform_pixabay_api_key") || undefined
        const openAi = localStorage.getItem("shotform_openai_api_key") || undefined
        const inputQuery = query.trim()
        const sceneContext = [
          selected?.text,
          selectedScene?.visualPrompt,
          brief.generatedStory?.hook,
        ]
          .filter(Boolean)
          .join("\n")
        let q = inputQuery
        const matchedSuggestion = pixabayKeywordSuggestions.find(
          (suggestion) => suggestion.labelKo === inputQuery
        )
        if (matchedSuggestion) {
          q = matchedSuggestion.queryEn
        } else if (/[가-힣]/.test(inputQuery)) {
          q = await translateFreeAssetSearchQuery(
            inputQuery,
            sceneContext,
            openAi
          )
        } else if (!q) {
          try {
            const suggestions = pixabayKeywordSuggestions.length
              ? pixabayKeywordSuggestions
              : await generatePixabayKeywordSuggestions(
                  sceneContext || brief.productName,
                  brief.productName,
                  openAi
                )
            setPixabayKeywordSuggestions(suggestions)
            q = suggestions[0]?.queryEn || brief.productName
            if (suggestions[0]?.labelKo) setQuery(suggestions[0].labelKo)
          } catch {
            q = brief.productName || "product"
          }
        }
        setTranslatedSearchQuery(q)
        const videos = await searchPixabayVideos(q, key, { perPage: 12 })
        const images = await searchPixabayImages(q, key, { perPage: 12 })
        const next: SearchHit[] = [
          ...videos.hits.slice(0, 8).map((item) => ({
            id: `pixabay-v-${item.id}`,
            title: item.tags || "Pixabay video",
            thumbnailUrl: item.previewURL,
            mediaUrl: item.videoURL,
            pageUrl: item.pageURL,
            mediaType: "video" as const,
            source: "pixabay" as const,
            attribution: item.user,
            license: "pixabay" as const,
            durationSec: item.duration,
          })),
          ...images.hits.slice(0, 8).map((item) => ({
            id: `pixabay-i-${item.id}`,
            title: item.tags || "Pixabay image",
            thumbnailUrl: item.previewURL,
            mediaUrl: item.largeImageURL || item.previewURL,
            pageUrl: item.pageURL,
            mediaType: "image" as const,
            source: "pixabay" as const,
            attribution: item.user,
            license: "pixabay" as const,
          })),
        ]
        setHits(next)
        return
      }

      if (elementSource === "klipy") {
        const q = query.trim() || selected?.text || brief.productName || "funny"
        const apiKey = (localStorage.getItem("shotform_klipy_api_key") || "").trim()
        const params = new URLSearchParams({ q, limit: "24" })
        if (apiKey) params.set("apiKey", apiKey)
        const res = await fetch(`/api/shotform/klipy/search?${params.toString()}`)
        const payload = await res.json()
        if (!res.ok) throw new Error(payload.error || "Klipy 검색 실패")
        setHits(
          (payload.items || []).map((item: SearchHit) => ({
            ...item,
            mediaType: "image",
            source: "upload",
            license: "permission-confirmed",
          }))
        )
        return
      }

      if (elementSource === "douyin" || elementSource === "xiaohongshu") {
        const q = query.trim() || selected?.text || brief.productName
        if (!q) throw new Error("검색어를 입력해주세요.")
        const translated = await fetchCnKeywordTranslation({
          keywords: [q],
          platform: elementSource,
          openaiApiKey: localStorage.getItem("shotform_openai_api_key") || null,
        })
        const translatedQueries = translated.searchQueries?.length
          ? translated.searchQueries
          : translated.pairs?.map((pair) => pair.zh).filter(Boolean) || []
        const translatedQuery = translatedQueries[0]
        if (!translatedQuery) throw new Error("중국어 검색어를 만들지 못했습니다.")
        const res = await fetch("/api/shotform/story-shopping/asset-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: elementSource,
            query: translatedQuery,
            originalQuery: q,
            keywords: translatedQueries,
            apifyApiKey: localStorage.getItem("shotform_apify_token") || undefined,
            serpApiKey: getSerpKey() || undefined,
          }),
        })
        const payload = await res.json()
        if (!res.ok) throw new Error(payload.error || "중국 영상 검색 실패")
        setHits(
          (payload.items || []).map((item: SearchHit & { source: string }) => ({
            id: item.id,
            title: item.title,
            thumbnailUrl: item.thumbnailUrl,
            mediaUrl: item.mediaUrl,
            pageUrl: item.pageUrl,
            mediaType: "video",
            source: item.source as StorySceneAsset["source"],
            attribution: item.attribution,
            durationSec: item.durationSec,
            license: "permission-confirmed",
          }))
        )
      }
    } catch (reason) {
      setSearchError(reason instanceof Error ? reason.message : "검색 실패")
    } finally {
      setIsSearching(false)
    }
  }

  const toggleRemixVideoSelection = (hit: SearchHit) => {
    const key = videoPickKey(hit.pageUrl, hit.mediaUrl)
    setSelectedRemixHits((current) => {
      if (
        current.some(
          (item) => videoPickKey(item.pageUrl, item.mediaUrl) === key
        )
      ) {
        return current.filter(
          (item) => videoPickKey(item.pageUrl, item.mediaUrl) !== key
        )
      }
      if (current.length >= 3) {
        setSearchError("리믹스 정밀 분석은 한 번에 영상 3개까지 선택할 수 있습니다.")
        return current
      }
      setSearchError("")
      return [...current, hit]
    })
  }

  const runRemixVideoAutoAssignment = async () => {
    if (isRemixAutoAssigning || !selectedRemixHits.length) return
    setIsRemixAutoAssigning(true)
    setSearchError("")
    try {
      const initialPicks: AutoEditPick[] = selectedRemixHits.map(
        (hit, index) => ({
          key: videoPickKey(hit.pageUrl, hit.mediaUrl),
          video_id: `story_remix_${String(index + 1).padStart(3, "0")}`,
          videoUrl: hit.mediaUrl,
          title: hit.title,
          noteUrl: hit.pageUrl,
          platform: hit.source,
        })
      )
      setRemixAssignProgress("선택 영상의 만료 주소를 확인하고 있어요…")
      const refreshed = await refreshExpiredMvpEditPicks(
        initialPicks,
        setRemixAssignProgress
      )
      const activePicks = refreshed.picks.filter((pick) =>
        pick.videoUrl.startsWith("http")
      )
      if (!activePicks.length) {
        throw new Error(
          refreshed.errors[0] || "분석 가능한 영상 주소가 없습니다."
        )
      }

      const extracted = await extractClientVideoMetaForPicks(
        activePicks,
        setRemixAssignProgress,
        { precision: true }
      )
      const analyzablePicks = activePicks.filter(
        (pick) =>
          (extracted.meta[pick.video_id]?.precisionKeyframes?.length || 0) >= 6
      )
      if (!analyzablePicks.length) {
        throw new Error(
          "선택 영상에서 분석 프레임을 추출하지 못했습니다. 영상 주소를 다시 검색해주세요."
        )
      }

      setRemixAssignProgress(
        "AI가 영상 장면과 각 대본의 TTS 구간을 정밀 매칭 중…"
      )
      const response = await fetch(
        "/api/shotform/story-shopping/mashup-assign",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productName: brief.productName,
            productDescription: brief.productDescription,
            openaiApiKey:
              localStorage.getItem("shotform_openai_api_key") || undefined,
            lines: timeline.map((slot) => ({
              sceneId: slot.sceneId,
              lineIndex: slot.lineIndex,
              text: slot.text,
              visualPrompt: scenes.find(
                (scene) => scene.id === slot.sceneId
              )?.visualPrompt,
              durationSec: slot.durationSec,
            })),
            pool: analyzablePicks.map((pick) => {
              const meta: ClientVideoMetaEntry | undefined =
                extracted.meta[pick.video_id]
              return {
                id: pick.video_id,
                title: pick.title,
                mediaType: "video",
                durationSec: meta?.duration,
                source: pick.platform,
                frames: meta?.precisionKeyframes || [],
              }
            }),
          }),
        }
      )
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
        assignments?: unknown
      }
      if (!response.ok) {
        throw new Error(payload.error || "AI 영상 구간 배치에 실패했습니다.")
      }

      setRemixAssignProgress("선택 영상의 재생 주소를 준비 중…")
      const downloadResponse = await fetch("/api/shotform/mvp-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apifyApiKey:
            localStorage.getItem("shotform_apify_token") || undefined,
          items: analyzablePicks.map((pick) => ({
            url: pick.noteUrl,
            videoUrl: pick.videoUrl,
            platform: pick.platform,
            title: pick.title,
          })),
        }),
      })
      const downloadPayload = (await downloadResponse
        .json()
        .catch(() => ({}))) as {
        results?: Array<{ downloadUrl?: string | null }>
      }
      const playableById = new Map<string, string>()
      analyzablePicks.forEach((pick, index) => {
        const playable =
          downloadPayload.results?.[index]?.downloadUrl || pick.videoUrl
        playableById.set(pick.video_id, playable)
      })
      const picksById = new Map(
        analyzablePicks.map((pick) => [pick.video_id, pick])
      )
      const assignments = (
        Array.isArray(payload.assignments) ? payload.assignments : []
      ) as Array<{
        sceneId: string
        lineIndex: number
        poolItemId: string
        trimStartSec: number
        trimEndSec: number
        reason: string
      }>
      const assignedAssets: StorySceneAsset[] = assignments.flatMap(
        (assignment) => {
          const pick = picksById.get(assignment.poolItemId)
          const mediaUrl = playableById.get(assignment.poolItemId)
          if (!pick || !mediaUrl) return []
          return [
            {
              sceneId: assignment.sceneId,
              lineIndex: assignment.lineIndex,
              mediaUrl,
              mediaType: "video",
              source:
                pick.platform === "xiaohongshu" ? "xiaohongshu" : "douyin",
              sourcePageUrl: pick.noteUrl,
              attribution: pick.title,
              license: "permission-required",
              rightsConfirmed: false,
              trimStartSec: assignment.trimStartSec,
              trimEndSec: assignment.trimEndSec,
              mediaScale: 1,
              mediaOffsetX: 0,
              mediaOffsetY: 0,
              mediaFit: "cover",
              motionEffect: "none",
              editorNote: `리믹스 AI 정밀 분석 · ${assignment.reason}`,
            } satisfies StorySceneAsset,
          ]
        }
      )
      if (!assignedAssets.length) {
        throw new Error("AI가 적용 가능한 영상 구간을 만들지 못했습니다.")
      }
      onChange((current) => ({
        ...current,
        sceneAssets: [
          ...(current.sceneAssets || []).filter(
            (asset) =>
              !assignedAssets.some((next) =>
                isSameStoryAssetSlot(asset, next)
              )
          ),
          ...assignedAssets,
        ],
      }))
      setRemixAssignProgress(
        `${assignedAssets.length}개 클립에 AI 영상 구간 배치 완료`
      )
    } catch (error) {
      setSearchError(
        error instanceof Error
          ? error.message
          : "리믹스 영상 자동 배치에 실패했습니다."
      )
      setRemixAssignProgress("")
    } finally {
      setIsRemixAutoAssigning(false)
    }
  }

  const onUploadFile = (file: File) => {
    if (!selected) return
    const url = URL.createObjectURL(file)
    const isVideo = file.type.startsWith("video/")
    if (isVideo) {
      setVideoEditDraft({
        asset: {
          mediaUrl: url,
          mediaType: "video",
          source: "upload",
          license: "owned",
          rightsConfirmed: true,
          mediaScale: 1,
          mediaOffsetX: 0,
          mediaOffsetY: 0,
          mediaFit: "cover",
          editorNote: file.name,
        },
        revokeOnCancel: true,
      })
      return
    }
    applyAsset({
      mediaUrl: url,
      mediaType: "image",
      source: "upload",
      license: "owned",
      editorNote: file.name,
    })
  }

  const openSearchVideoEditor = async (hit: SearchHit) => {
    if (!selected || hit.mediaType !== "video" || preparingVideoUrl) return
    setPreparingVideoUrl(hit.mediaUrl)
    setSearchError("")
    try {
      let playableUrl = hit.mediaUrl
      if (hit.source === "douyin" || hit.source === "xiaohongshu") {
        const response = await fetch("/api/shotform/mvp-download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apifyApiKey:
              localStorage.getItem("shotform_apify_token") || undefined,
            items: [
              {
                url: hit.pageUrl,
                videoUrl: hit.mediaUrl,
                platform: hit.source,
                title: hit.title,
              },
            ],
          }),
        })
        const payload = await response.json().catch(() => ({}))
        const resolved = payload.results?.[0]
        if (!response.ok || !resolved?.downloadUrl) {
          throw new Error(
            resolved?.error ||
              payload.error ||
              "중국 영상의 재생 가능한 주소를 가져오지 못했습니다."
          )
        }
        playableUrl = resolved.downloadUrl
      }
      setVideoEditDraft({
        asset: {
          mediaUrl: playableUrl,
          mediaType: "video",
          source: hit.source,
          sourcePageUrl: hit.pageUrl,
          attribution: hit.attribution,
          license: hit.license,
          rightsConfirmed: hit.license !== "permission-required",
          trimEndSec: hit.durationSec,
          mediaScale: 1,
          mediaOffsetX: 0,
          mediaOffsetY: 0,
          mediaFit: "cover",
          editorNote: `${hit.title} · 자르기 확인 후 적용`,
        },
        revokeOnCancel: false,
      })
    } catch (error) {
      setSearchError(
        error instanceof Error
          ? error.message
          : "비디오 편집 준비에 실패했습니다."
      )
    } finally {
      setPreparingVideoUrl(null)
    }
  }

  const closeVideoEditor = () => {
    if (videoEditDraft?.revokeOnCancel && videoEditDraft.asset.mediaUrl.startsWith("blob:")) {
      URL.revokeObjectURL(videoEditDraft.asset.mediaUrl)
    }
    setVideoEditDraft(null)
  }

  const applyVideoEdit = (result: StoryVideoEditResult) => {
    if (!videoEditDraft) return
    applyAsset({
      ...videoEditDraft.asset,
      ...result,
    })
    setVideoEditDraft(null)
  }

  const addSfxFromFile = async (file: File) => {
    const url = URL.createObjectURL(file)
    const startSec = selectedTimeline?.startSec ?? playheadSec
    const sourceDurationSec = await readAudioDuration(url)
    const clip: StorySfxClip = {
      id: `sfx-${Date.now()}`,
      label: sfxLabel.trim() || file.name,
      audioUrl: url,
      startSec,
      durationSec: Math.max(
        0.08,
        Math.min(sourceDurationSec, Math.max(0.08, totalDuration - startSec))
      ),
      sourceOffsetSec: 0,
      sourceDurationSec,
      volumePct: 100,
      clipKey: selectedKey || undefined,
    }
    onChange((current) => ({
      ...current,
      sfxClips: [...(current.sfxClips || []), clip],
    }))
    setSelectedElementKey(null)
    setSelectedSfxId(clip.id)
    setSfxLabel("")
  }

  const readAudioDuration = (src: string) =>
    new Promise<number>((resolve) => {
      const audio = new Audio(src)
      audio.preload = "metadata"
      const finish = () => {
        const duration =
          Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 1.5
        resolve(duration)
      }
      audio.addEventListener("loadedmetadata", finish, { once: true })
      audio.addEventListener("error", () => resolve(1.5), { once: true })
      window.setTimeout(() => resolve(1.5), 2500)
      audio.load()
    })

  const addSfxFromLibrary = async (item: StoryShoppingSfxCatalogItem) => {
    const startSec = selectedTimeline?.startSec ?? playheadRef.current
    const duration = await readAudioDuration(item.src)
    const clip: StorySfxClip = {
      id: `sfx-${item.id}-${Date.now()}`,
      label: `${item.number}. ${item.label}`,
      audioUrl: item.src,
      startSec,
      durationSec: Math.max(
        0.08,
        Math.min(duration, Math.max(0.08, totalDuration - startSec))
      ),
      sourceOffsetSec: 0,
      sourceDurationSec: duration,
      volumePct: 100,
      clipKey: selectedKey || undefined,
    }
    onChange((current) => ({
      ...current,
      sfxClips: [...(current.sfxClips || []), clip],
    }))
    setSelectedElementKey(null)
    setSelectedSfxId(clip.id)
  }

  const runAutomaticSfxPlacement = async () => {
    if (isAutoPlacingSfx || !timeline.length) return
    setIsAutoPlacingSfx(true)
    setAutoSfxMessage("AI가 대본의 감정과 행동을 분석하고 있어요…")
    stopPlayback()
    try {
      const response = await fetch(
        "/api/shotform/story-shopping/asset-search",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "sfx_plan",
            productName: brief.productName,
            openaiApiKey:
              localStorage.getItem("shotform_openai_api_key") || undefined,
            slots: timeline.map((slot) => ({
              sceneId: slot.sceneId,
              lineIndex: slot.lineIndex,
              text: slot.text,
              startSec: slot.startSec,
              durationSec: slot.durationSec,
            })),
          }),
        }
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || "AI 효과음 분석에 실패했습니다.")
      }
      const plans = (Array.isArray(payload.plans) ? payload.plans : []) as Array<{
        sceneId: string
        lineIndex: number
        catalogId: string
        offsetSec: number
        volumePct: number
        maxDurationSec: number
        reason: string
      }>
      setAutoSfxMessage(
        `${plans.length}개의 중요한 순간에 맞는 효과음을 준비 중…`
      )
      const nextClips: StorySfxClip[] = []
      for (let index = 0; index < plans.length; index += 1) {
        const plan = plans[index]!
        const slot = timeline.find(
          (item) =>
            item.sceneId === plan.sceneId &&
            item.lineIndex === plan.lineIndex
        )
        const item = STORY_SHOPPING_SFX_CATALOG.find(
          (candidate) => candidate.id === plan.catalogId
        )
        if (!slot || !item) continue
        setAutoSfxMessage(
          `${index + 1}/${plans.length} · ${plan.reason || item.label}`
        )
        const sourceDurationSec = await readAudioDuration(item.src)
        const startSec = Math.min(
          totalDuration - 0.08,
          slot.startSec + Math.max(0, Number(plan.offsetSec) || 0)
        )
        nextClips.push({
          id: `sfx-auto-${item.id}-${Date.now()}-${index}`,
          label: `AI · ${item.number}. ${item.label}`,
          audioUrl: item.src,
          startSec: Math.max(0, startSec),
          durationSec: Math.max(
            0.08,
            Math.min(
              sourceDurationSec,
              Number(plan.maxDurationSec) || 1.4,
              Math.max(0.08, totalDuration - startSec)
            )
          ),
          clipKey: clipKey(slot.sceneId, slot.lineIndex),
          catalogId: item.id,
          source: "bundled",
          sourceOffsetSec: 0,
          sourceDurationSec,
          volumePct: Math.min(
            33,
            Math.max(18, Number(plan.volumePct) || 24)
          ),
          autoPlaced: true,
          autoReason: plan.reason,
          autoVolumeVersion: 2,
        })
      }
      const coveredClipKeys = new Set(
        nextClips
          .map((clip) => clip.clipKey)
          .filter((key): key is string => Boolean(key))
      )
      const fallbackCatalogIds = [
        "008",
        "004",
        "005",
        "036",
        "019",
        "168",
        "122",
      ]
      for (let index = 0; index < timeline.length; index += 1) {
        const slot = timeline[index]!
        const key = clipKey(slot.sceneId, slot.lineIndex)
        if (coveredClipKeys.has(key)) continue
        const item =
          fallbackCatalogIds
            .map((id) =>
              STORY_SHOPPING_SFX_CATALOG.find(
                (candidate) => candidate.id === id
              )
            )
            .filter(
              (candidate): candidate is StoryShoppingSfxCatalogItem =>
                Boolean(candidate)
            )[index % fallbackCatalogIds.length] ||
          STORY_SHOPPING_SFX_CATALOG[index % STORY_SHOPPING_SFX_CATALOG.length]
        if (!item) continue
        const sourceDurationSec = await readAudioDuration(item.src)
        const startSec = Math.min(
          totalDuration - 0.08,
          slot.startSec + Math.min(0.08, slot.durationSec / 3)
        )
        nextClips.push({
          id: `sfx-auto-required-${item.id}-${Date.now()}-${index}`,
          label: `AI · ${item.number}. ${item.label}`,
          audioUrl: item.src,
          startSec: Math.max(0, startSec),
          durationSec: Math.max(
            0.08,
            Math.min(
              sourceDurationSec,
              1.2,
              Math.max(0.08, totalDuration - startSec)
            )
          ),
          clipKey: key,
          catalogId: item.id,
          source: "bundled",
          sourceOffsetSec: 0,
          sourceDurationSec,
          volumePct: 20,
          autoPlaced: true,
          autoReason: "모든 대본 클립에 필요한 장면 전환 효과",
          autoVolumeVersion: 2,
        })
        coveredClipKeys.add(key)
      }
      onChange((current) => ({
        ...current,
        sfxClips: [
          ...(current.sfxClips || []).filter((clip) => !clip.autoPlaced),
          ...nextClips,
        ],
      }))
      setSelectedSfxId(null)
      setAutoSfxMessage(
        nextClips.length
          ? `${nextClips.length}개 효과음 자동 배치 완료`
          : "효과음이 꼭 필요한 장면이 없어 배치하지 않았습니다."
      )
    } catch (error) {
      setAutoSfxMessage(
        error instanceof Error
          ? error.message
          : "AI 효과음 자동 배치에 실패했습니다."
      )
    } finally {
      setIsAutoPlacingSfx(false)
    }
  }

  const patchSfxClip = (id: string, patch: Partial<StorySfxClip>) => {
    onChange((current) => ({
      ...current,
      sfxClips: (current.sfxClips || []).map((clip) =>
        clip.id === id ? { ...clip, ...patch } : clip
      ),
    }))
  }

  const deleteSfxClip = (id: string) => {
    stopPlayback()
    onChange((current) => ({
      ...current,
      sfxClips: (current.sfxClips || []).filter((clip) => clip.id !== id),
    }))
    setSelectedSfxId((selectedId) => (selectedId === id ? null : selectedId))
  }

  const splitSelectedSfxAtPlayhead = () => {
    if (!selectedSfx) return false
    const result = splitStorySfxClip(selectedSfx, playheadRef.current)
    if (!result) return false
    stopPlayback()
    const left = clampStorySfxToTimeline(result.left, totalDuration)
    const right = clampStorySfxToTimeline(result.right, totalDuration)
    if (!left) return false
    onChange((current) => ({
      ...current,
      sfxClips: (current.sfxClips || []).flatMap((clip) =>
        clip.id === selectedSfx.id
          ? right
            ? [left, right]
            : [left]
          : [clip]
      ),
    }))
    setSelectedSfxId(right?.id || left.id)
    return true
  }

  const beginSfxDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    clip: StorySfxClip
  ) => {
    event.preventDefault()
    event.stopPropagation()
    stopPlayback()
    setSelectedSfxId(clip.id)
    setSelectedElementKey(null)
    const startX = event.clientX
    const original = normalizedStorySfxClip(clip)
    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect
    document.body.style.cursor = "grabbing"
    document.body.style.userSelect = "none"

    const move = (moveEvent: PointerEvent) => {
      const next = moveStorySfxClip(
        original,
        original.startSec + (moveEvent.clientX - startX) / pxPerSec,
        totalDuration
      )
      patchSfxClip(clip.id, {
        startSec: next.startSec,
        sourceOffsetSec: next.sourceOffsetSec,
        sourceDurationSec: next.sourceDurationSec,
        volumePct: next.volumePct,
      })
    }
    const stop = () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", stop)
      window.removeEventListener("pointercancel", stop)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", stop)
    window.addEventListener("pointercancel", stop)
  }

  const toggleFavoriteSfx = (id: string) => {
    setFavoriteSfxIds((current) => {
      const next = current.includes(id)
        ? current.filter((favoriteId) => favoriteId !== id)
        : [...current, id]
      localStorage.setItem("story-shopping-sfx-favorites", JSON.stringify(next))
      return next
    })
  }

  const toggleSfxPreview = (item: StoryShoppingSfxCatalogItem) => {
    if (isPlaying) stopPlayback()
    sfxPreviewAudioRef.current?.pause()
    if (previewingSfxId === item.id) {
      sfxPreviewAudioRef.current = null
      setPreviewingSfxId(null)
      return
    }

    const audio = new Audio(item.src)
    audio.muted = isMuted
    audioRef.current?.pause()
    audio.addEventListener(
      "ended",
      () => {
        if (sfxPreviewAudioRef.current === audio) {
          sfxPreviewAudioRef.current = null
          setPreviewingSfxId(null)
        }
      },
      { once: true }
    )
    sfxPreviewAudioRef.current = audio
    setPreviewingSfxId(item.id)
    void audio.play().catch(() => {
      sfxPreviewAudioRef.current = null
      setPreviewingSfxId(null)
    })
  }

  const stopPlayback = () => {
    playGenRef.current += 1
    audioRef.current?.pause()
    sfxPreviewAudioRef.current?.pause()
    sfxPreviewAudioRef.current = null
    setPreviewingSfxId(null)
    for (const playback of playingSfxRef.current.values()) {
      try {
        playback.source.stop()
      } catch {
        // 이미 끝난 예약 소스입니다.
      }
      playback.source.disconnect()
      playback.gain.disconnect()
    }
    playingSfxRef.current.clear()
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (sfxSchedulerRafRef.current) {
      cancelAnimationFrame(sfxSchedulerRafRef.current)
      sfxSchedulerRafRef.current = null
    }
    setIsPlaying(false)
  }

  useEffect(() => {
    const wasEnabled = previousThumbnailIntroEnabledRef.current
    const isEnabled =
      thumbnailIntroPreview.enabled && Boolean(thumbnailIntroPreview.url)
    previousThumbnailIntroEnabledRef.current = isEnabled
    if (!isEnabled || wasEnabled) return

    stopPlayback()
    playheadRef.current = 0
    setPlayheadSec(0)
    if (audioRef.current) audioRef.current.currentTime = 0
  }, [thumbnailIntroPreview.enabled, thumbnailIntroPreview.url])

  const moveToAdjacentClip = (offset: -1 | 1) => {
    stopPlayback()
    const currentIndex = timeline.findIndex(
      (item) =>
        item.sceneId === selected?.sceneId && item.lineIndex === selected?.lineIndex
    )
    const nextIndex = Math.max(0, Math.min(timeline.length - 1, currentIndex + offset))
    const next = timeline[nextIndex]
    if (!next) return
    setSelectedKey(clipKey(next.sceneId, next.lineIndex))
    setPlayheadSec(next.startSec)
  }

  const playFromClip = async (
    startSlot: StoryMashupLineSlot,
    requestedStartSec?: number,
    recordOptions?: {
      audioDestination?: AudioNode
      audioContext?: AudioContext
    }
  ) => {
    stopPlayback()
    const gen = ++playGenRef.current
    const sfxContext =
      recordOptions?.audioContext ||
      sfxAudioContextRef.current ||
      (sfxAudioContextRef.current = new AudioContext())
    if (!recordOptions?.audioContext) {
      sfxAudioContextRef.current = sfxContext
    }
    void sfxContext.resume().catch(() => undefined)
    const recordDest = recordOptions?.audioDestination
    const isExportRecording = Boolean(recordDest)
    let lastUiPlayheadAt = 0
    const routeAudioElement = (audio: HTMLAudioElement) => {
      if (!recordDest) return
      try {
        let source = mediaElementSourcesRef.current.get(audio)
        if (!source) {
          source = sfxContext.createMediaElementSource(audio)
          mediaElementSourcesRef.current.set(audio, source)
        }
        source.disconnect()
        source.connect(recordDest)
        // 녹화 중에도 미리 들을 수 있게 스피커 출력
        source.connect(sfxContext.destination)
      } catch (error) {
        console.warn("[StoryEditor] TTS 녹화 라우팅 실패:", error)
      }
    }
    const syncPlayhead = (nextSec: number) => {
      playheadRef.current = nextSec
      // 다운로드 녹화 중엔 매 프레임 setState 하면 메인스레드가 끊겨 영상이 뚝뚝 끊김
      if (isExportRecording) {
        const now = performance.now()
        if (now - lastUiPlayheadAt < 200) return
        lastUiPlayheadAt = now
      }
      setPlayheadSec(nextSec)
    }
    const startIdx = slots.findIndex(
      (s) => s.sceneId === startSlot.sceneId && s.lineIndex === startSlot.lineIndex
    )
    const order = startIdx >= 0 ? slots.slice(startIdx) : slots

    const getTrimmed = async (url: string) => {
      const cached = trimmedCacheRef.current.get(url)
      if (cached) return cached
      try {
        const result = await trimSilenceFromAudioUrl(url, 0.018)
        const entry = {
          blobUrl: result.blobUrl,
          trimStartSec: result.trimStartSec,
          durationSec: result.durationSec,
        }
        trimmedCacheRef.current.set(url, entry)
        return entry
      } catch {
        return { blobUrl: url, trimStartSec: 0, durationSec: 0 }
      }
    }

    // 모든 장면 음성을 먼저 준비해 다음 장면으로 넘어갈 때의 네트워크 지연을 제거합니다.
    // 통 TTS도 앞뒤 무음을 잘라 장면 사이 공백을 없애고, Whisper 큐는 trimStartSec로 보정합니다.
    const preparedAudio = new Map<
      string,
      Promise<{ audio: HTMLAudioElement; trimStartSec: number; durationSec: number }>
    >()
    const prepareAudio = (url: string) => {
      const existing = preparedAudio.get(url)
      if (existing) return existing
      const pending = getTrimmed(url).then(
        (trimmed) =>
          new Promise<{
            audio: HTMLAudioElement
            trimStartSec: number
            durationSec: number
          }>((resolve) => {
            const audio = new Audio(trimmed.blobUrl)
            audio.preload = "auto"
            const finish = () =>
              resolve({
                audio,
                trimStartSec: trimmed.trimStartSec,
                durationSec:
                  Number.isFinite(audio.duration) && audio.duration > 0
                    ? audio.duration
                    : trimmed.durationSec,
              })
            audio.addEventListener("canplaythrough", finish, { once: true })
            audio.addEventListener("loadedmetadata", finish, { once: true })
            audio.addEventListener("error", finish, { once: true })
            audio.load()
            window.setTimeout(finish, 1600)
          })
      )
      preparedAudio.set(url, pending)
      return pending
    }

    const audioUrls = new Set<string>()
    for (const slot of order) {
      const track = brief.voiceData?.tracks.find((item) => item.sceneId === slot.sceneId)
      if (track?.audioUrl) audioUrls.add(track.audioUrl)
      const cue = track?.lineTracks?.find((item) => item.lineIndex === slot.lineIndex)
      if (cue?.audioUrl) audioUrls.add(cue.audioUrl)
    }
    const prepareSfxBuffer = (url: string) => {
      const cached = sfxBufferCacheRef.current.get(url)
      if (cached) return cached
      const pending = (async () => {
        try {
          const response = await fetch(url, { cache: "force-cache" })
          if (!response.ok) return null
          const bytes = await response.arrayBuffer()
          return await sfxContext.decodeAudioData(bytes.slice(0))
        } catch {
          return null
        }
      })()
      sfxBufferCacheRef.current.set(url, pending)
      return pending
    }
    const sfxBuffers = new Map<string, AudioBuffer>()
    await Promise.all([
      ...Array.from(audioUrls, (url) => prepareAudio(url)),
      ...(brief.sfxClips || []).map(async (clip) => {
        const buffer = await prepareSfxBuffer(clip.audioUrl)
        if (buffer) sfxBuffers.set(clip.id, buffer)
      }),
    ])
    if (gen !== playGenRef.current) return
    await sfxContext.resume().catch(() => undefined)

    const playbackTimelineStart =
      requestedStartSec ??
      timeline.find(
        (item) =>
          item.sceneId === startSlot.sceneId &&
          item.lineIndex === startSlot.lineIndex
      )?.startSec ??
      0
    playheadRef.current = playbackTimelineStart
    const scheduledSfxIds = new Set<string>()
    const stopAllSfx = () => {
      if (sfxSchedulerRafRef.current) {
        cancelAnimationFrame(sfxSchedulerRafRef.current)
        sfxSchedulerRafRef.current = null
      }
      for (const playback of playingSfxRef.current.values()) {
        try {
          playback.source.stop()
        } catch {
          // 이미 종료된 소스입니다.
        }
        playback.source.disconnect()
        playback.gain.disconnect()
      }
      playingSfxRef.current.clear()
    }
    const scheduleSfxNearPlayhead = () => {
      if (gen !== playGenRef.current) return
      const currentPlayheadSec = playheadRef.current
      // 영상 타임라인이 끝나면 효과음도 즉시 중단
      if (currentPlayheadSec >= totalDuration - 0.02) {
        stopAllSfx()
        return
      }
      const lookAheadSec = 0.06
      for (const clip of brief.sfxClips || []) {
        if (scheduledSfxIds.has(clip.id)) continue
        const clamped = clampStorySfxToTimeline(clip, totalDuration)
        if (!clamped) {
          scheduledSfxIds.add(clip.id)
          continue
        }
        const clipEndSec = clamped.startSec + Math.max(0.08, clamped.durationSec)
        if (clipEndSec <= currentPlayheadSec) {
          scheduledSfxIds.add(clip.id)
          continue
        }
        if (clamped.startSec > currentPlayheadSec + lookAheadSec) continue
        scheduledSfxIds.add(clip.id)
        const buffer = sfxBuffers.get(clip.id)
        if (!buffer) continue
        const elapsedSec = Math.max(0, currentPlayheadSec - clamped.startSec)
        const sourceOffsetSec = Math.max(0, clamped.sourceOffsetSec ?? 0)
        const bufferOffsetSec = Math.min(
          Math.max(0, buffer.duration - 0.01),
          sourceOffsetSec + elapsedSec
        )
        const remainingToVideoEnd = Math.max(
          0,
          totalDuration - Math.max(clamped.startSec, currentPlayheadSec)
        )
        const playableDurationSec = Math.min(
          Math.max(0, clamped.durationSec - elapsedSec),
          Math.max(0, buffer.duration - bufferOffsetSec),
          remainingToVideoEnd
        )
        if (playableDurationSec < 0.02) continue
        const source = sfxContext.createBufferSource()
        const gain = sfxContext.createGain()
        const volumePct = Math.max(
          0,
          Math.min(200, clamped.volumePct ?? 100)
        )
        // 녹화 시에는 미리보기 음소거와 무관하게 효과음을 트랙에 넣음
        const sfxMuted = recordDest ? false : isMuted
        source.buffer = buffer
        gain.gain.value = sfxMuted ? 0 : volumePct / 100
        source.connect(gain)
        gain.connect(sfxContext.destination)
        if (recordDest) gain.connect(recordDest)
        playingSfxRef.current.set(clip.id, {
          source,
          gain,
          volumePct,
        })
        source.addEventListener(
          "ended",
          () => {
            const active = playingSfxRef.current.get(clip.id)
            if (active?.source !== source) return
            source.disconnect()
            gain.disconnect()
            playingSfxRef.current.delete(clip.id)
          },
          { once: true }
        )
        source.start(
          sfxContext.currentTime +
            Math.max(0, clamped.startSec - currentPlayheadSec),
          bufferOffsetSec,
          playableDurationSec
        )
      }
      sfxSchedulerRafRef.current = requestAnimationFrame(
        scheduleSfxNearPlayhead
      )
    }
    setIsPlaying(true)
    scheduleSfxNearPlayhead()

    let orderIndex = 0
    let visibleKey = ""
    while (orderIndex < order.length) {
      if (gen !== playGenRef.current) return
      const firstSlot = order[orderIndex]!
      const sceneRun: StoryMashupLineSlot[] = []
      while (
        orderIndex + sceneRun.length < order.length &&
        order[orderIndex + sceneRun.length]!.sceneId === firstSlot.sceneId
      ) {
        sceneRun.push(order[orderIndex + sceneRun.length]!)
      }

      const scene = scenes.find((item) => item.id === firstSlot.sceneId)
      const track = brief.voiceData?.tracks.find((item) => item.sceneId === firstSlot.sceneId)
      const hasSplitLineAudio = Boolean(
        track?.lineTracks?.some(
          (cue) => cue.audioUrl && cue.audioUrl !== track.audioUrl
        )
      )

      // 신형 장면 통 TTS: Audio를 끊지 않고 한 번 재생하며 화면 슬롯만 교체합니다.
      // 앞뒤 무음은 잘라 장면 사이 공백을 없애고, Whisper 큐는 trimStartSec로 보정합니다.
      if (scene && track?.audioUrl && !hasSplitLineAudio) {
        try {
          const prepared = await prepareAudio(track.audioUrl)
          if (gen !== playGenRef.current) return
          const audio = prepared.audio
          audio.muted = recordDest ? false : isMuted
          routeAudioElement(audio)
          audioRef.current = audio
          const fullDur =
            prepared.durationSec > 0
              ? prepared.durationSec
              : Number.isFinite(audio.duration) && audio.duration > 0
                ? audio.duration
                : Math.max(0.8, track.durationSec || scene.durationSec)
          const allSceneSlots = slots.filter((item) => item.sceneId === firstSlot.sceneId)
          const weights = allSceneSlots.map((item) => Math.max(8, item.text.length))
          const weightSum = weights.reduce((sum, value) => sum + value, 0) || 1
          let weightCursor = 0
          const rawCues = allSceneSlots.map((slot, index) => {
            const fallbackStart = fullDur * (weightCursor / weightSum)
            weightCursor += weights[index] || 0
            const fallbackEnd =
              index === allSceneSlots.length - 1
                ? fullDur
                : fullDur * (weightCursor / weightSum)
            const saved = track.lineTracks?.find(
              (item) => item.lineIndex === slot.lineIndex
            )
            const hasSavedTiming =
              Number.isFinite(saved?.startSec) &&
              Number.isFinite(saved?.endSec) &&
              Number(saved?.endSec) > Number(saved?.startSec)
            return {
              lineIndex: slot.lineIndex,
              text: slot.text,
              startSec: hasSavedTiming ? Number(saved?.startSec) : fallbackStart,
              endSec: hasSavedTiming ? Number(saved?.endSec) : fallbackEnd,
              alignmentSource: (saved?.alignmentSource ||
                (hasSavedTiming ? "whisper" : "estimated")) as
                | "whisper"
                | "estimated",
              slot,
            }
          })
          // 원본 Whisper 시각 → 무음 트림본 타임라인으로 보정
          const normalized = shiftCaptionCuesForTrim(
            rawCues.map(({ lineIndex, text, startSec, endSec, alignmentSource }) => ({
              lineIndex,
              text,
              startSec,
              endSec,
              alignmentSource,
            })),
            prepared.trimStartSec,
            fullDur
          )
          const cues = normalized.map((cue) => {
            const slot =
              rawCues.find((item) => item.lineIndex === cue.lineIndex)?.slot ||
              allSceneSlots.find((item) => item.lineIndex === cue.lineIndex)!
            return { slot, startSec: cue.startSec, endSec: cue.endSec }
          })
          const runCues = sceneRun
            .map((slot) => cues.find((cue) => cue.slot.lineIndex === slot.lineIndex))
            .filter((cue): cue is (typeof cues)[number] => Boolean(cue))
          const firstCue = runCues[0]
          const lastCue = runCues[runCues.length - 1]
          if (!firstCue || !lastCue) throw new Error("장면 음성 큐가 없습니다.")

          const firstTimeline = timeline.find(
            (item) =>
              item.sceneId === firstCue.slot.sceneId &&
              item.lineIndex === firstCue.slot.lineIndex
          )
          const resumeOffset =
            requestedStartSec != null && firstTimeline
              ? Math.max(
                  0,
                  Math.min(
                    firstTimeline.durationSec,
                    requestedStartSec - firstTimeline.startSec
                  )
                )
              : 0
          const firstCueDuration = Math.max(0.1, firstCue.endSec - firstCue.startSec)
          audio.currentTime = Math.min(
            lastCue.endSec - 0.02,
            firstCue.startSec +
              firstCueDuration *
                (resumeOffset / Math.max(0.1, firstTimeline?.durationSec || 0.1))
          )
          // 다음 장면 오디오를 미리 깨워 전환 지연을 줄입니다.
          const nextSceneId = order[orderIndex + sceneRun.length]?.sceneId
          if (nextSceneId) {
            const nextTrack = brief.voiceData?.tracks.find(
              (item) => item.sceneId === nextSceneId
            )
            if (nextTrack?.audioUrl) void prepareAudio(nextTrack.audioUrl)
          }
          await audio.play()

          const pickCueAtTime = (timeSec: number) => {
            const exact = runCues.find(
              (cue) => timeSec >= cue.startSec && timeSec < cue.endSec
            )
            if (exact) return exact
            // 공백 구간: 직전 자막 유지 (마지막 자막으로 점프하지 않음)
            let fallback = runCues[0]!
            for (const cue of runCues) {
              if (cue.startSec <= timeSec) fallback = cue
              else break
            }
            return fallback
          }

          await new Promise<void>((resolve) => {
            const tick = () => {
              if (gen !== playGenRef.current) {
                audio.pause()
                resolve()
                return
              }
              const currentCue = pickCueAtTime(audio.currentTime)
              const currentTimeline = timeline.find(
                (item) =>
                  item.sceneId === currentCue.slot.sceneId &&
                  item.lineIndex === currentCue.slot.lineIndex
              )
              const key = clipKey(currentCue.slot.sceneId, currentCue.slot.lineIndex)
              if (key !== visibleKey) {
                visibleKey = key
                selectedKeyRef.current = key
                if (isExportRecording) {
                  // flushSync 없이 ref만 — 녹화 캔버스가 playhead로 장면을 그림
                  setSelectedKey(key)
                } else {
                  flushSync(() => {
                    setSelectedKey(key)
                  })
                }
              }
              if (currentTimeline) {
                const cueProgress = Math.max(
                  0,
                  Math.min(
                    1,
                    (audio.currentTime - currentCue.startSec) /
                      Math.max(0.08, currentCue.endSec - currentCue.startSec)
                  )
                )
                syncPlayhead(
                  currentTimeline.startSec + cueProgress * currentTimeline.durationSec
                )
              }
              if (audio.ended || audio.currentTime >= lastCue.endSec - 0.02) {
                audio.pause()
                resolve()
                return
              }
              rafRef.current = requestAnimationFrame(tick)
            }
            rafRef.current = requestAnimationFrame(tick)
          })
          orderIndex += sceneRun.length
          requestedStartSec = undefined
          continue
        } catch {
          // 준비 실패 시 아래의 구형 줄 단위/무음 타이머로 폴백합니다.
        }
      }

      // 구형 줄별 TTS 또는 음성이 없는 프로젝트 호환 경로
      for (const slot of sceneRun) {
        if (gen !== playGenRef.current) return
        const key = clipKey(slot.sceneId, slot.lineIndex)
        const slotTimeline = timeline.find(
          (item) => item.sceneId === slot.sceneId && item.lineIndex === slot.lineIndex
        )
        const resumeOffset =
          slot === order[0] && requestedStartSec != null && slotTimeline
            ? Math.max(0, requestedStartSec - slotTimeline.startSec)
            : 0
        visibleKey = key
        selectedKeyRef.current = key
        if (isExportRecording) {
          setSelectedKey(key)
          if (slotTimeline) {
            syncPlayhead(slotTimeline.startSec + resumeOffset)
          }
        } else {
          flushSync(() => {
            setSelectedKey(key)
            if (slotTimeline) {
              syncPlayhead(slotTimeline.startSec + resumeOffset)
            }
          })
        }

        const cue = track?.lineTracks?.find((item) => item.lineIndex === slot.lineIndex)
        const lineAudioUrl =
          cue?.audioUrl && cue.audioUrl !== track?.audioUrl ? cue.audioUrl : undefined
        if (lineAudioUrl) {
          const prepared = await prepareAudio(lineAudioUrl)
          if (gen !== playGenRef.current) return
          const audio = prepared.audio
          audio.muted = recordDest ? false : isMuted
          routeAudioElement(audio)
          audioRef.current = audio
          const duration =
            prepared.durationSec > 0
              ? prepared.durationSec
              : Number.isFinite(audio.duration) && audio.duration > 0
                ? audio.duration
                : slot.durationSec
          audio.currentTime = Math.min(
            Math.max(0, duration - 0.02),
            duration * (resumeOffset / Math.max(0.1, slot.durationSec))
          )
          await audio.play().catch(() => undefined)
          await new Promise<void>((resolve) => {
            const tick = () => {
              if (gen !== playGenRef.current) {
                audio.pause()
                resolve()
                return
              }
              if (slotTimeline) {
                syncPlayhead(
                  slotTimeline.startSec +
                    (audio.currentTime / Math.max(0.1, duration)) *
                      slotTimeline.durationSec
                )
              }
              if (audio.ended) {
                resolve()
                return
              }
              rafRef.current = requestAnimationFrame(tick)
            }
            rafRef.current = requestAnimationFrame(tick)
          })
          continue
        }

        await new Promise<void>((resolve) => {
          const ms = Math.max(100, (slot.durationSec - resumeOffset) * 1000)
          const startedAt = performance.now()
          const tick = (now: number) => {
            if (gen !== playGenRef.current) {
              resolve()
              return
            }
            if (slotTimeline) {
              syncPlayhead(
                slotTimeline.startSec + resumeOffset + (now - startedAt) / 1000
              )
            }
            if (now - startedAt >= ms) {
              resolve()
              return
            }
            rafRef.current = requestAnimationFrame(tick)
          }
          rafRef.current = requestAnimationFrame(tick)
        })
      }
      orderIndex += sceneRun.length
      requestedStartSec = undefined
    }

    if (gen === playGenRef.current) {
      stopAllSfx()
      audioRef.current?.pause()
      setIsPlaying(false)
      syncPlayhead(Math.min(playheadRef.current, totalDuration))
    }
  }

  togglePlaybackRef.current = () => {
    if (isPlaying) {
      stopPlayback()
      return
    }
    if (selected) void playFromClip(selected, playheadRef.current)
  }

  const runVideoDownload = async () => {
    if (isDownloadingRef.current) return
    if (!slots.length) {
      setSearchError("다운로드할 클립이 없습니다.")
      return
    }
    const firstSlot = slots[0]
    if (!firstSlot) return

    isDownloadingRef.current = true
    setIsDownloading(true)
    setDownloadStatusText("클립 이미지를 불러오는 중…")
    setSearchError("")
    stopPlayback()
    const previousPreviewZoom = previewZoom
    setPreviewZoom(1)

    const recordContext = new AudioContext()
    const recordDest = recordContext.createMediaStreamDestination()

    try {
      onDownloadProgress?.({
        phase: "prepare",
        message: "다운로드 준비 중…",
        ratio: 0.02,
      })
      flushSync(() => {
        const key = clipKey(firstSlot.sceneId, firstSlot.lineIndex)
        selectedKeyRef.current = key
        setSelectedKey(key)
        setPlayheadSec(0)
        playheadRef.current = 0
        setIsPreviewMode(false)
      })
      await new Promise((resolve) => window.setTimeout(resolve, 200))

      const stageEl =
        exportStageRef.current ||
        (document.querySelector(
          '[data-story-export-stage="true"]'
        ) as HTMLElement | null)
      if (!stageEl) {
        throw new Error(
          "미리보기 화면을 찾을 수 없습니다. 영상 편집 화면에서 다시 시도해주세요."
        )
      }

      // 캡처 안정화: 미리보기 박스를 고정 비율로
      const previousInline = {
        width: stageEl.style.width,
        height: stageEl.style.height,
        maxHeight: stageEl.style.maxHeight,
        zoom: (stageEl.style as CSSStyleDeclaration & { zoom?: string }).zoom,
      }
      stageEl.style.width = "360px"
      stageEl.style.height = "640px"
      stageEl.style.maxHeight = "640px"
      ;(stageEl.style as CSSStyleDeclaration & { zoom?: string }).zoom = "1"

      const downloadGen = playGenRef.current
      const exportClips: StoryExportClip[] = timeline.map((slot) => {
        const asset = resolveStoryLineAsset(
          brief.sceneAssets,
          slot.sceneId,
          slot.lineIndex
        )
        return {
          key: clipKey(slot.sceneId, slot.lineIndex),
          startSec: slot.startSec,
          endSec: slot.endSec,
          durationSec: slot.durationSec,
          text: slot.text,
          mediaUrl: asset?.mediaUrl,
          mediaType: asset?.mediaType,
          trimStartSec: asset?.trimStartSec,
          trimEndSec: asset?.trimEndSec,
          mediaFit: asset?.mediaFit,
          mediaScale: asset?.mediaScale,
          mediaOffsetX: asset?.mediaOffsetX,
          mediaOffsetY: asset?.mediaOffsetY,
          motionEffect: asset?.motionEffect,
          backgroundColor: editSettings.backgroundColor,
        }
      })
      const headerColor =
        STORY_FRAME_TEMPLATES.find(
          (template) => template.id === frameSettings.templateId
        )?.color || "#f7cf68"

      try {
        const { blob, filename } = await recordStoryPreviewStage({
          stageEl,
          clips: exportClips,
          frameSettings,
          headerColor,
          totalDurationSec: totalDuration,
          audioStream: recordDest.stream,
          getPlayheadSec: () => playheadRef.current,
          getClipKey: () => selectedKeyRef.current || selectedKey,
          isActive: () =>
            isDownloadingRef.current && playGenRef.current >= downloadGen,
          fileBaseName: (
            brief.generatedStory?.title ||
            brief.productName ||
            "story-shopping"
          )
            .replace(/[\\/:*?"<>|]+/g, "")
            .slice(0, 40) || "story-shopping",
          onProgress: (progress) => {
            if (progress?.message) setDownloadStatusText(progress.message)
            onDownloadProgress?.(progress)
          },
          play: async () => {
            await playFromClip(firstSlot, 0, {
              audioContext: recordContext,
              audioDestination: recordDest,
            })
          },
        })

        await downloadBlobAsFile(blob, filename)
        onDownloadProgress?.({
          phase: "done",
          message: "다운로드 완료",
          ratio: 1,
        })
      } finally {
        stageEl.style.width = previousInline.width
        stageEl.style.height = previousInline.height
        stageEl.style.maxHeight = previousInline.maxHeight
        ;(stageEl.style as CSSStyleDeclaration & { zoom?: string }).zoom =
          previousInline.zoom || ""
      }
    } catch (reason) {
      console.error("[StoryEditor] 다운로드 실패:", reason)
      setSearchError(
        reason instanceof Error ? reason.message : "영상 다운로드에 실패했습니다."
      )
      onDownloadProgress?.({
        phase: "error",
        message:
          reason instanceof Error ? reason.message : "영상 다운로드에 실패했습니다.",
        ratio: 0,
      })
    } finally {
      try {
        await recordContext.close()
      } catch {
        /* ignore */
      }
      setPreviewZoom(previousPreviewZoom)
      isDownloadingRef.current = false
      setIsDownloading(false)
      window.setTimeout(() => onDownloadProgress?.(null), 2500)
    }
  }

  useImperativeHandle(ref, () => ({
    downloadVideo: () => runVideoDownload(),
  }))

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) return
      const target = event.target as HTMLElement | null
      if (target?.closest("input, textarea, select, button, [contenteditable='true']")) return
      event.preventDefault()
      togglePlaybackRef.current()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    const onDeleteSelectedElement = (event: KeyboardEvent) => {
      if (
        !selectedElementKey ||
        event.repeat ||
        (event.key !== "Delete" && event.key !== "Backspace")
      ) {
        return
      }
      const target = event.target as HTMLElement | null
      const selectedTimelineElement = target?.closest(
        "[data-story-element-clip='true']"
      )
      if (
        target?.closest("input, textarea, select, [contenteditable='true']") ||
        (target?.closest("button") && !selectedTimelineElement)
      ) {
        return
      }
      const parsed = parseClipKey(selectedElementKey)
      if (!parsed) return
      const asset = resolveStoryLineAsset(
        brief.sceneAssets,
        parsed.sceneId,
        parsed.lineIndex
      )
      if (!asset) return

      event.preventDefault()
      stopPlayback()
      onChange((current) => ({
        ...current,
        sceneAssets: (current.sceneAssets || []).filter((item) => item !== asset),
      }))
      setSelectedElementKey(null)
    }
    document.addEventListener("keydown", onDeleteSelectedElement)
    return () => document.removeEventListener("keydown", onDeleteSelectedElement)
  }, [brief.sceneAssets, onChange, selectedElementKey])

  useEffect(() => {
    const onSfxShortcut = (event: KeyboardEvent) => {
      if (!selectedSfxId || event.repeat) return
      const target = event.target as HTMLElement | null
      if (
        target?.closest(
          "input, textarea, select, button, [contenteditable='true'], [role='slider']"
        )
      ) {
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") {
        if (splitSelectedSfxAtPlayhead()) event.preventDefault()
        return
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault()
        deleteSfxClip(selectedSfxId)
        return
      }
      if (event.key === "Escape") {
        event.preventDefault()
        setSelectedSfxId(null)
      }
    }
    document.addEventListener("keydown", onSfxShortcut)
    return () => document.removeEventListener("keydown", onSfxShortcut)
  }, [selectedSfxId, selectedSfx])

  useEffect(() => {
    return () => {
      stopPlayback()
      for (const entry of trimmedCacheRef.current.values()) {
        if (entry.blobUrl.startsWith("blob:")) URL.revokeObjectURL(entry.blobUrl)
      }
      trimmedCacheRef.current.clear()
      void sfxAudioContextRef.current?.close().catch(() => undefined)
      sfxAudioContextRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = isMuted
    if (sfxPreviewAudioRef.current) sfxPreviewAudioRef.current.muted = isMuted
    for (const playback of playingSfxRef.current.values()) {
      playback.gain.gain.value = isMuted ? 0 : playback.volumePct / 100
    }
  }, [isMuted])

  useEffect(() => {
    if (!isPlaying) {
      if (sfxSchedulerRafRef.current) {
        cancelAnimationFrame(sfxSchedulerRafRef.current)
        sfxSchedulerRafRef.current = null
      }
      for (const playback of playingSfxRef.current.values()) {
        try {
          playback.source.stop()
        } catch {
          // 이미 종료된 소스는 중지할 필요가 없습니다.
        }
        playback.source.disconnect()
        playback.gain.disconnect()
      }
      playingSfxRef.current.clear()
      return
    }

    const clipsById = new Map(
      (brief.sfxClips || []).map((clip) => [clip.id, clip])
    )
    for (const [id, playback] of playingSfxRef.current) {
      const clip = clipsById.get(id)
      if (!clip) {
        try {
          playback.source.stop()
        } catch {
          // 이미 종료된 소스입니다.
        }
        playback.source.disconnect()
        playback.gain.disconnect()
        playingSfxRef.current.delete(id)
        continue
      }
      const volumePct = Math.max(
        0,
        Math.min(200, clip.volumePct ?? playback.volumePct)
      )
      playback.volumePct = volumePct
      playback.gain.gain.value = isMuted ? 0 : volumePct / 100
    }
  }, [brief.sfxClips, isMuted, isPlaying])

  const beginTimelineResize = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault()
      const startY = event.clientY
      const startHeight = timelineHeight
      const previousCursor = document.body.style.cursor
      const previousUserSelect = document.body.style.userSelect
      document.body.style.cursor = "row-resize"
      document.body.style.userSelect = "none"

      const onPointerMove = (moveEvent: PointerEvent) => {
        const maxHeight = Math.max(220, Math.min(560, window.innerHeight - 280))
        const nextHeight = startHeight + startY - moveEvent.clientY
        setTimelineHeight(Math.round(Math.max(128, Math.min(maxHeight, nextHeight))))
      }
      const stopResize = () => {
        document.body.style.cursor = previousCursor
        document.body.style.userSelect = previousUserSelect
        window.removeEventListener("pointermove", onPointerMove)
        window.removeEventListener("pointerup", stopResize)
        window.removeEventListener("pointercancel", stopResize)
      }

      window.addEventListener("pointermove", onPointerMove)
      window.addEventListener("pointerup", stopResize)
      window.addEventListener("pointercancel", stopResize)
    },
    [timelineHeight]
  )

  const seekPlayheadFromClientX = (clientX: number) => {
    const viewport = timelineScrollRef.current
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    const contentX = clientX - rect.left + viewport.scrollLeft
    // 스크롤 영역 좌측 패딩 12px + 트랙 라벨/간격 64px
    const nextTime = Math.max(0, Math.min(totalDuration, (contentX - 76) / pxPerSec))
    setPlayheadSec(nextTime)
    const nextSlot =
      timeline.find((item) => nextTime >= item.startSec && nextTime < item.endSec) ||
      timeline[timeline.length - 1]
    if (nextSlot) setSelectedKey(clipKey(nextSlot.sceneId, nextSlot.lineIndex))
  }

  const beginPlayheadDrag = (event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    stopPlayback()
    seekPlayheadFromClientX(event.clientX)
    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect
    document.body.style.cursor = "ew-resize"
    document.body.style.userSelect = "none"

    const onPointerMove = (moveEvent: PointerEvent) => {
      seekPlayheadFromClientX(moveEvent.clientX)
    }
    const stopDrag = () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", stopDrag)
      window.removeEventListener("pointercancel", stopDrag)
    }
    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", stopDrag)
    window.addEventListener("pointercancel", stopDrag)
  }

  const handleTimelineWheel = useCallback(
    (event: WheelEvent) => {
      const viewport = timelineScrollRef.current
      if (!viewport) return

      if (event.ctrlKey) {
        event.preventDefault()
        event.stopPropagation()
        const rect = viewport.getBoundingClientRect()
        const pointerX = Math.max(0, Math.min(rect.width, event.clientX - rect.left))
        const contentAtPointer = viewport.scrollLeft + pointerX
        const nextZoom = Math.max(
          0.35,
          Math.min(4, timelineZoom * (event.deltaY < 0 ? 1.15 : 1 / 1.15))
        )
        const nextPxPerSec = Math.max(16, Math.min(240, basePxPerSec * nextZoom))
        const scale = nextPxPerSec / pxPerSec
        setTimelineZoom(nextZoom)
        requestAnimationFrame(() => {
          viewport.scrollLeft = contentAtPointer * scale - pointerX
        })
        return
      }

      if (event.shiftKey) {
        event.preventDefault()
        event.stopPropagation()
        const amount = Math.max(24, Math.abs(event.deltaY || event.deltaX))
        // 요청 동작: 휠 아래=왼쪽, 휠 위=오른쪽
        viewport.scrollLeft += event.deltaY > 0 ? -amount : amount
      }
    },
    [basePxPerSec, pxPerSec, timelineZoom]
  )

  useEffect(() => {
    const panel = timelinePanelRef.current
    if (!panel) return
    panel.addEventListener("wheel", handleTimelineWheel, { passive: false })
    return () => panel.removeEventListener("wheel", handleTimelineWheel)
  }, [handleTimelineWheel])

  if (!story || !slots.length) {
    return (
      <div className="rounded-[28px] border border-dashed border-white/15 py-24 text-center text-zinc-400">
        스토리 대본을 먼저 생성해주세요.
      </div>
    )
  }

  const rulerStepSec = pxPerSec >= 120 ? 0.5 : pxPerSec >= 60 ? 1 : pxPerSec >= 30 ? 2 : 5
  const rulerTicks = Array.from(
    { length: Math.floor(totalDuration / rulerStepSec) + 1 },
    (_, index) => index * rulerStepSec
  )
  const launchPreview = () => {
    setIsPreviewMode(true)
    if (!isPlaying) {
      requestAnimationFrame(() => togglePlaybackRef.current())
    }
  }
  const closePreview = () => {
    setIsPreviewMode(false)
    stopPlayback()
  }
  const autoProgressNumbers = autoPlacementProgress.match(
    /(\d+)\/(\d+)/
  )
  const autoProgressPercent = autoProgressNumbers
    ? Math.min(
        100,
        Math.round(
          (Number(autoProgressNumbers[1]) /
            Math.max(1, Number(autoProgressNumbers[2]))) *
            100
        )
      )
    : 6

  return (
    <div
      className="grid h-full min-h-0 overflow-hidden bg-[#f7f8fa] text-slate-900"
      style={{
        gridTemplateRows: `${detailMode ? 0 : 56}px minmax(180px, 1fr) ${timelineHeight}px`,
      }}
    >
      {expandedSourceImage ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="원본 사진 크게 보기"
          tabIndex={-1}
          autoFocus
          onKeyDown={(event) => {
            if (event.key === "Escape") setExpandedSourceImage(null)
          }}
          onPointerDown={() => setExpandedSourceImage(null)}
          className="fixed inset-0 z-[280] flex items-center justify-center bg-slate-950/85 p-5 backdrop-blur-sm outline-none"
        >
          <div
            className="relative flex max-h-[94vh] max-w-[94vw] flex-col overflow-hidden rounded-2xl border border-white/15 bg-slate-950 shadow-2xl"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4 text-white">
              <p className="max-w-[75vw] truncate text-xs font-bold">
                {expandedSourceImage.title}
              </p>
              <button
                type="button"
                onClick={() => setExpandedSourceImage(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20"
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            <div className="min-h-0 overflow-auto bg-black p-3">
              <img
                src={expandedSourceImage.url}
                alt={expandedSourceImage.title}
                className="mx-auto max-h-[84vh] max-w-[88vw] object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
      {isAutoPlacing ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="AI 자동 배치 진행 중"
          className="fixed inset-0 z-[260] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md"
        >
          <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/20 bg-slate-950 px-6 py-8 text-center text-white shadow-2xl shadow-violet-950/60">
            <div className="absolute -left-20 -top-20 h-52 w-52 rounded-full bg-cyan-500/20 blur-3xl" />
            <div className="absolute -bottom-24 -right-16 h-56 w-56 rounded-full bg-violet-500/25 blur-3xl" />
            <div className="relative mx-auto mb-5 flex h-24 w-24 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full border border-cyan-400/40" />
              <div className="absolute inset-2 animate-[spin_3s_linear_infinite] rounded-full border-2 border-transparent border-r-violet-400 border-t-cyan-400" />
              <div className="absolute inset-5 animate-pulse rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-600 shadow-lg shadow-violet-500/30" />
              <Sparkles className="relative h-8 w-8 animate-pulse text-white" />
              <span className="absolute right-0 top-3 h-2 w-2 animate-ping rounded-full bg-cyan-300" />
              <span className="absolute bottom-2 left-1 h-1.5 w-1.5 animate-ping rounded-full bg-violet-300 [animation-delay:500ms]" />
            </div>

            <p className="relative text-[11px] font-black uppercase tracking-[0.24em] text-cyan-300">
              AI Visual Director
            </p>
            <h3 className="relative mt-2 text-xl font-black">
              장면에 맞는 영상을 만들고 있어요
            </h3>
            <p className="relative mt-2 min-h-10 text-[11px] font-medium leading-5 text-white/65">
              {autoPlacementProgress ||
                "대본을 분석하고 가장 어울리는 소재를 찾는 중…"}
            </p>

            <div className="relative mt-5 overflow-hidden rounded-full bg-white/10 p-1">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 transition-[width] duration-500"
                style={{ width: `${autoProgressPercent}%` }}
              />
              <div className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>
            <div className="relative mt-2 flex items-center justify-between text-[9px] font-bold text-white/45">
              <span>이미지 분석</span>
              <span>{autoProgressPercent}%</span>
              <span>AI 영상 생성</span>
            </div>

            <div className="relative mt-5 flex justify-center gap-2">
              {[ImageIcon, Film, Sticker].map((Icon, index) => (
                <div
                  key={index}
                  className="flex h-9 w-9 animate-bounce items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/65"
                  style={{ animationDelay: `${index * 180}ms` }}
                >
                  <Icon className="h-4 w-4" />
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                autoPlacementRunRef.current += 1
                setIsAutoPlacing(false)
                setAutoPlacementProgress("자동 배치를 중단했습니다.")
              }}
              className="relative mt-6 h-9 border-white/15 bg-white/5 px-5 text-[10px] font-bold text-white hover:bg-white/10 hover:text-white"
            >
              자동 배치 중단
            </Button>
          </div>
        </div>
      ) : null}
      {isRemixAutoAssigning ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="리믹스 영상 AI 정밀 분석 중"
          className="fixed inset-0 z-[265] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md"
        >
          <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/20 bg-slate-950 px-6 py-8 text-center text-white shadow-2xl shadow-violet-950/60">
            <div className="absolute -left-20 -top-20 h-52 w-52 rounded-full bg-cyan-500/20 blur-3xl" />
            <div className="absolute -bottom-24 -right-16 h-56 w-56 rounded-full bg-violet-500/25 blur-3xl" />
            <div className="relative mx-auto mb-5 flex h-24 w-24 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full border border-cyan-400/40" />
              <div className="absolute inset-2 animate-[spin_3s_linear_infinite] rounded-full border-2 border-transparent border-r-violet-400 border-t-cyan-400" />
              <div className="absolute inset-5 animate-pulse rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-600 shadow-lg shadow-violet-500/30" />
              <Film className="relative h-8 w-8 text-white" />
            </div>
            <p className="relative text-[11px] font-black uppercase tracking-[0.22em] text-cyan-300">
              Remix Vision Editor
            </p>
            <h3 className="relative mt-2 text-xl font-black">
              대본에 맞는 영상 구간을 찾고 있어요
            </h3>
            <p className="relative mt-3 min-h-10 text-[11px] font-medium leading-5 text-white/65">
              {remixAssignProgress ||
                "영상을 프레임별로 분석하고 TTS 길이에 맞춰 자르는 중…"}
            </p>
            <div className="relative mt-5 flex justify-center gap-2">
              {[Film, Sparkles, Scissors].map((Icon, index) => (
                <div
                  key={index}
                  className="flex h-9 w-9 animate-bounce items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70"
                  style={{ animationDelay: `${index * 180}ms` }}
                >
                  <Icon className="h-4 w-4" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      <div
        className={`pointer-events-none absolute inset-x-0 top-14 z-[60] flex justify-center px-4 ${
          isDownloading ? "" : "hidden"
        }`}
      >
        <div className="pointer-events-auto rounded-full border border-blue-200 bg-white/95 px-4 py-2 text-xs font-bold text-blue-700 shadow-lg">
          <Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" />
          {downloadStatusText || "영상 다운로드 중… 완료될 때까지 기다려 주세요"}
        </div>
      </div>

      {isPreviewMode ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="영상 미리보기"
          tabIndex={-1}
          autoFocus
          onKeyDownCapture={(event) => {
            if (event.key === "Escape") {
              event.preventDefault()
              event.stopPropagation()
              closePreview()
            }
          }}
          className="fixed inset-0 z-[220] flex flex-col bg-[#111318] text-white outline-none"
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4 md:px-6">
            <div className="flex items-center gap-3">
              <MonitorPlay className="h-5 w-5 text-blue-400" />
              <div>
                <p className="text-sm font-black">영상 미리보기</p>
                <p className="text-[10px] text-white/45">편집 도구 없이 최종 화면만 확인합니다.</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={closePreview}
              className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              미리보기 종료
            </Button>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3 md:p-5">
            <div className="relative aspect-[9/16] h-full max-h-[calc(100vh-128px)] overflow-hidden rounded-xl bg-white shadow-[0_24px_80px_rgba(0,0,0,.55)] ring-1 ring-white/15">
              {selectedScene ? (
                <StoryChannelFrame
                  settings={frameSettings}
                  scene={selectedScene}
                  asset={selectedAsset}
                  isPlaying={isPlaying}
                  activeNarrationLine={0}
                  narrationDisplayLines={displayLines}
                  {...activeSubtitleFrameStyle}
                  mediaBackgroundColor={editSettings.backgroundColor}
                  motionDurationSec={selected?.durationSec}
                  prefetchMedia={prefetchMedia}
                  className="h-full w-full shadow-none"
                />
              ) : null}
              {showThumbnailIntro && thumbnailIntroPreview.url ? (
                <img
                  src={thumbnailIntroPreview.url}
                  alt="영상 시작 썸네일"
                  className="pointer-events-none absolute inset-0 z-50 h-full w-full object-cover"
                />
              ) : null}
            </div>
          </div>

          <div className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-t border-white/10 bg-black/25 px-4">
            <span className="justify-self-start text-xs tabular-nums text-white/55">
              <strong className="text-blue-400">{formatPlayerTime(playheadSec)}</strong>
              {" / "}
              {formatPlayerTime(totalDuration)}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="이전 클립"
                onClick={() => moveToAdjacentClip(-1)}
                className="text-white/70 hover:bg-white/10 hover:text-white"
              >
                <SkipBack className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                size="icon"
                aria-label={isPlaying ? "일시 정지" : "재생"}
                onClick={() => togglePlaybackRef.current()}
                className="h-10 w-10 rounded-full bg-white text-slate-950 hover:bg-blue-100"
              >
                {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="다음 클립"
                onClick={() => moveToAdjacentClip(1)}
                className="text-white/70 hover:bg-white/10 hover:text-white"
              >
                <SkipForward className="h-5 w-5" />
              </Button>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={isMuted ? "음소거 해제" : "음소거"}
              onClick={() => setIsMuted((muted) => !muted)}
              className="justify-self-end text-white/70 hover:bg-white/10 hover:text-white"
            >
              {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      ) : null}

      <div
        className={`flex flex-wrap items-center justify-between gap-2 overflow-hidden bg-white transition-all ${
          detailMode ? "border-b-0 px-0 opacity-0" : "border-b border-slate-200 px-5 opacity-100"
        }`}
        aria-hidden={detailMode}
      >
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-black text-slate-900">영상 편집</h2>
            <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-600">
              소재 {filledCount}/{slots.length}
            </span>
            <p className="hidden text-[11px] text-slate-500 md:block">
              대본 줄 단위로 클립을 선택하고 우측에서 요소를 추가하세요.
            </p>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 grid-cols-[112px_minmax(0,1fr)_340px] border-b border-slate-200">
        {/* 좌: 클립 */}
        <aside className="min-h-0 overflow-y-auto border-r border-slate-200 bg-white p-2">
          <p className="mb-2 px-1 text-[10px] font-black text-slate-500">전체 클립</p>
          <div className="space-y-2">
            {timeline.map((slot, index) => {
              const key = clipKey(slot.sceneId, slot.lineIndex)
              const asset = resolveStoryLineAsset(
                brief.sceneAssets,
                slot.sceneId,
                slot.lineIndex
              )
              const thumbnailScene = scenes.find((scene) => scene.id === slot.sceneId)
              const active = key === selectedKey
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    stopPlayback()
                    setSelectedKey(key)
                    setSelectedElementKey(null)
                    setSelectedSfxId(null)
                    setPlayheadSec(slot.startSec)
                  }}
                  className={`relative block w-full rounded-lg border p-1.5 text-left transition ${
                    active
                      ? "border-blue-500 bg-blue-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-400"
                  }`}
                >
                  <div className="relative aspect-[9/16] w-full overflow-hidden rounded-md bg-slate-100">
                    {thumbnailScene ? (
                      <StoryChannelFrame
                        settings={frameSettings}
                        scene={thumbnailScene}
                        asset={asset}
                        isPlaying={false}
                        activeNarrationLine={0}
                        narrationDisplayLines={[slot.text]}
                        {...subtitleFrameStyle}
                        mediaBackgroundColor={editSettings.backgroundColor}
                        motionDurationSec={slot.durationSec}
                        className="h-full w-full shadow-none"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-slate-200 text-slate-500">
                        <Film className="h-5 w-5" />
                      </div>
                    )}
                    <span className="absolute left-0.5 top-0.5 rounded bg-black/70 px-1 text-[8px] text-white">
                      {index + 1}
                    </span>
                  </div>
                  <div className="min-w-0 pt-1">
                    <p className="line-clamp-2 text-[9px] font-bold leading-3 text-slate-700">{slot.text}</p>
                    <p className="mt-1 text-[8px] text-slate-400">
                      {slot.durationSec.toFixed(1)}초 · 장면 {slot.sceneOrder}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        {/* 중: 미리보기 */}
        <section className="relative flex min-w-0 flex-col bg-[#eef1f5]">
          <div className="absolute right-3 top-3 z-40 flex items-center gap-1 rounded-lg border border-slate-200 bg-white/95 p-1 shadow-md backdrop-blur">
            <button
              type="button"
              onClick={launchPreview}
              className="mr-1 flex h-7 items-center gap-1.5 rounded-md bg-blue-600 px-2.5 text-[10px] font-black text-white hover:bg-blue-500"
            >
              <MonitorPlay className="h-3.5 w-3.5" />
              미리보기 실행
            </button>
            <button
              type="button"
              aria-label="미리보기 축소"
              title="미리보기 축소"
              onClick={() =>
                setPreviewZoom((zoom) => Math.max(0.5, Number((zoom - 0.1).toFixed(2))))
              }
              className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="미리보기 배율 초기화"
              title="100%로 초기화"
              onClick={() => setPreviewZoom(1)}
              className="flex h-7 min-w-12 items-center justify-center gap-1 rounded px-1 text-[9px] font-bold tabular-nums text-slate-600 hover:bg-slate-100"
            >
              <Maximize2 className="h-3 w-3" />
              {Math.round(previewZoom * 100)}%
            </button>
            <button
              type="button"
              aria-label="미리보기 확대"
              title="미리보기 확대"
              onClick={() =>
                setPreviewZoom((zoom) => Math.min(2, Number((zoom + 0.1).toFixed(2))))
              }
              className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-5">
            <div
              ref={exportStageRef}
              data-story-export-stage="true"
              className="relative aspect-[9/16] h-full max-h-[min(100%,680px)] shrink-0 overflow-hidden rounded-md border border-slate-300 bg-white shadow-[0_12px_40px_rgba(15,23,42,.16)]"
              style={{ zoom: previewZoom }}
            >
              {selectedScene ? (
                <StoryChannelFrame
                  settings={frameSettings}
                  scene={selectedScene}
                  asset={selectedAsset}
                  isPlaying={isPlaying}
                  activeNarrationLine={0}
                  narrationDisplayLines={displayLines}
                  {...activeSubtitleFrameStyle}
                  mediaBackgroundColor={editSettings.backgroundColor}
                  motionDurationSec={selected?.durationSec}
                  mediaEditable
                  prefetchMedia={prefetchMedia}
                  onMediaTransformCommit={(patch) => {
                    if (selectedAsset) applyAsset({ ...selectedAsset, ...patch })
                  }}
                  className="h-full w-full"
                />
              ) : null}
              {showThumbnailIntro && thumbnailIntroPreview.url ? (
                <img
                  src={thumbnailIntroPreview.url}
                  alt="영상 시작 썸네일"
                  className="pointer-events-none absolute inset-0 z-50 h-full w-full object-cover"
                />
              ) : null}
            </div>
          </div>
          <div className="grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-t border-slate-200 bg-white px-3">
            <span className="justify-self-start text-[10px] tabular-nums text-slate-500">
              <strong className="font-bold text-blue-500">{formatPlayerTime(playheadSec)}</strong>
              {" / "}
              {formatPlayerTime(totalDuration)}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="이전 클립"
                onClick={() => moveToAdjacentClip(-1)}
                className="h-8 w-8 text-slate-500 hover:bg-slate-100"
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                aria-label={isPlaying ? "일시 정지" : "재생"}
                onClick={() => togglePlaybackRef.current()}
                className="h-8 w-8 rounded-md bg-slate-900 text-white hover:bg-slate-700"
              >
                {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="다음 클립"
                onClick={() => moveToAdjacentClip(1)}
                className="h-8 w-8 text-slate-500 hover:bg-slate-100"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={isMuted ? "음소거 해제" : "음소거"}
              onClick={() => setIsMuted((muted) => !muted)}
              className="h-8 w-8 justify-self-end text-slate-500 hover:bg-slate-100"
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
          </div>
        </section>

        {/* 우: 탭 */}
        <aside className="flex min-h-0 flex-col overflow-hidden border-l border-slate-200 bg-white">
          <div className="grid grid-cols-5 border-b border-slate-200">
            {(
              [
                ["script", "대본", Type],
                ["elements", "요소", Film],
                ["sfx", "효과음", Music2],
                ["thumbnail", "썸네일", ImageIcon],
                ["publish", "게시", FileText],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setRightTab(id)}
                className={`flex flex-col items-center gap-1 border-b-2 px-1 py-2.5 text-[9px] font-bold ${
                  rightTab === id
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-transparent text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {rightTab === "script" ? (
              <div className="space-y-4">
                <p className="text-[10px] text-slate-500">현재 클립 대본</p>
                <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-slate-700">
                  {selected?.text || "—"}
                </p>
                <div>
                  <Label className="text-[10px] text-slate-500">글꼴</Label>
                  <select
                    value={editSettings.subtitleFontFamily}
                    onChange={(event) =>
                      patchEdit({ subtitleFontFamily: event.target.value })
                    }
                    className="mt-2 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-blue-500"
                  >
                    {FREE_SUBTITLE_FONTS.map((font) => (
                      <option
                        key={font.value}
                        value={font.value}
                        style={{ fontFamily: font.value }}
                      >
                        {font.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] text-slate-500">자막 크기</Label>
                    <span className="text-[10px] text-blue-600">{subtitleSizeDraft}px</span>
                  </div>
                  <Slider
                    value={[subtitleSizeDraft]}
                    min={20}
                    max={56}
                    step={1}
                    onValueChange={([value]) => setSubtitleSizeDraft(value)}
                    onValueCommit={([value]) => patchEdit({ subtitleSize: value })}
                    className="mt-3"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-slate-500">글자 굵기</Label>
                  <div className="mt-2 grid grid-cols-4 gap-1">
                    {(
                      [
                        [400, "보통"],
                        [600, "중간"],
                        [700, "굵게"],
                        [900, "매우 굵게"],
                      ] as const
                    ).map(([weight, label]) => (
                      <button
                        key={weight}
                        type="button"
                        onClick={() => patchEdit({ subtitleFontWeight: weight })}
                        className={`rounded-md border px-1 py-2 text-[9px] ${
                          editSettings.subtitleFontWeight === weight
                            ? "border-blue-500 bg-blue-50 font-bold text-blue-700"
                            : "border-slate-200 text-slate-500"
                        }`}
                        style={{ fontWeight: weight }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-[10px] text-slate-500">글자 색</Label>
                  <div className="mt-2 flex gap-2">
                    <Input
                      type="color"
                      value={editSettings.subtitleColor}
                      onChange={(event) => patchEdit({ subtitleColor: event.target.value })}
                      className="h-9 w-12 border-slate-200 bg-white p-1"
                    />
                    <Input
                      value={editSettings.subtitleColor}
                      onChange={(event) => patchEdit({ subtitleColor: event.target.value })}
                      className="h-9 flex-1 border-slate-200 bg-white font-mono text-xs text-slate-900"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] text-slate-500">자막 배경</Label>
                    <button
                      type="button"
                      onClick={() =>
                        patchEdit({
                          subtitleBackgroundEnabled: !editSettings.subtitleBackgroundEnabled,
                        })
                      }
                      className={`rounded-full px-2 py-1 text-[9px] font-bold ${
                        editSettings.subtitleBackgroundEnabled
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {editSettings.subtitleBackgroundEnabled ? "사용" : "없음"}
                    </button>
                  </div>
                  {editSettings.subtitleBackgroundEnabled ? (
                    <Input
                      type="color"
                      value={editSettings.subtitleBackgroundColor}
                      onChange={(event) =>
                        patchEdit({ subtitleBackgroundColor: event.target.value })
                      }
                      className="mt-2 h-9 w-full border-slate-200 bg-white p-1"
                    />
                  ) : null}
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] text-slate-500">글자 외곽선</Label>
                    <span className="text-[10px] text-blue-600">
                      {editSettings.subtitleOutlineWidth}px
                    </span>
                  </div>
                  <Slider
                    value={[editSettings.subtitleOutlineWidth || 0]}
                    min={0}
                    max={5}
                    step={1}
                    onValueChange={([value]) =>
                      patchEdit({ subtitleOutlineWidth: value })
                    }
                    className="mt-3"
                  />
                  {(editSettings.subtitleOutlineWidth || 0) > 0 ? (
                    <Input
                      type="color"
                      value={editSettings.subtitleOutlineColor}
                      onChange={(event) =>
                        patchEdit({ subtitleOutlineColor: event.target.value })
                      }
                      className="mt-2 h-9 w-full border-slate-200 bg-white p-1"
                    />
                  ) : null}
                </div>
                <p className="text-[10px] leading-5 text-slate-400">
                  TTS는 음성 단계에서 장면 통으로 생성됩니다. 재생 시 줄 타이밍에 맞춰 클립이
                  넘어갑니다.
                </p>
              </div>
            ) : null}

            {rightTab === "elements" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      선택한 클립
                    </p>
                    <p className="mt-0.5 text-[11px] font-black text-slate-700">
                      {selected
                        ? `장면 ${selected.sceneOrder} · 클립 ${selected.lineIndex + 1}`
                        : "클립을 선택해주세요"}
                    </p>
                  </div>
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      selectedAsset?.mediaUrl ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                    title={selectedAsset?.mediaUrl ? "요소 적용됨" : "요소 없음"}
                  />
                </div>
                <div className="rounded-xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-violet-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-black text-slate-900">
                        AI 이미지·영상 자동 배치
                      </p>
                      <p className="mt-1 text-[9px] leading-4 text-slate-500">
                        대본마다 리뷰·무료 소재·도우인·샤오홍슈·GIF·AI 생성 중
                        가장 적합한 소스를 판단해, 비어 있는 클립만 채웁니다.
                      </p>
                    </div>
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                  </div>
                  <p className="mt-3 rounded-md bg-white/70 px-2 py-1.5 text-[9px] font-bold text-violet-700">
                    이미 이미지나 영상이 있는 클립은 그대로 두고, 비어 있는
                    클립만 AI로 채웁니다. 새로 넣는 소재는 서로 겹치지 않게
                    배치합니다.
                  </p>
                  <Button
                    type="button"
                    onClick={() => {
                      if (isAutoPlacing) {
                        autoPlacementRunRef.current += 1
                        setIsAutoPlacing(false)
                        setAutoPlacementProgress("자동 배치를 중단했습니다.")
                        return
                      }
                      void runAutomaticAssetPlacement()
                    }}
                    className={`mt-3 h-9 w-full text-[10px] font-black text-white ${
                      isAutoPlacing
                        ? "bg-rose-600 hover:bg-rose-500"
                        : "bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500"
                    }`}
                  >
                    {isAutoPlacing ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        자동 배치 중단
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                        전체 클립 AI 자동 배치
                      </>
                    )}
                  </Button>
                  {autoPlacementProgress ? (
                    <p className="mt-2 rounded-md bg-white/70 px-2 py-1.5 text-[9px] font-bold leading-4 text-cyan-800">
                      {autoPlacementProgress}
                    </p>
                  ) : null}
                </div>
                {selectedAsset?.mediaUrl ? (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3">
                    <p className="text-[10px] font-bold text-slate-700">미리보기에서 직접 조절</p>
                    <p className="mt-1 text-[9px] leading-4 text-slate-500">
                      안쪽을 드래그하면 이동, 모서리 조절점을 끌거나 마우스 휠을 사용하면 크기가 조절됩니다.
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-1">
                      {(
                        [
                          ["cover", "화면 채우기"],
                          ["contain", "전체 맞춤"],
                        ] as const
                      ).map(([fit, label]) => (
                        <button
                          key={fit}
                          type="button"
                          onClick={() => applyAsset({ ...selectedAsset, mediaFit: fit })}
                          className={`rounded-md border py-2 text-[9px] font-bold ${
                            (selectedAsset.mediaFit || "cover") === fit
                              ? "border-blue-500 bg-blue-600 text-white"
                              : "border-slate-200 bg-white text-slate-500"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[9px] text-slate-500">
                        확대 {Math.round((selectedAsset.mediaScale || 1) * 100)}%
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          applyAsset({
                            ...selectedAsset,
                            mediaScale: 1,
                            mediaOffsetX: 0,
                            mediaOffsetY: 0,
                          })
                        }
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold text-slate-600 hover:bg-slate-100"
                      >
                        위치 초기화
                      </button>
                    </div>
                    {selectedAsset.mediaType === "video" ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setVideoEditDraft({
                            asset: selectedAsset,
                            revokeOnCancel: false,
                          })
                        }
                        className="mt-3 h-9 w-full border-blue-200 bg-white text-[10px] font-bold text-blue-700 hover:bg-blue-50"
                      >
                        비디오 자르기 · 모자이크 편집
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                {selectedAsset?.mediaUrl ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-slate-700">
                        캡컷형 화면 효과
                      </p>
                      <span className="text-[9px] text-slate-400">
                        이미지·영상 공통
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1">
                      {(
                        [
                          ["none", "없음"],
                          ["zoom-in", "줌인"],
                          ["zoom-out", "줌아웃"],
                          ["pan-left", "왼쪽 팬"],
                          ["pan-right", "오른쪽 팬"],
                          ["shake", "흔들림"],
                          ["pulse", "펄스"],
                          ["blur-in", "블러 등장"],
                          ["flash", "플래시"],
                        ] as const
                      ).map(([effect, label]) => {
                        const active =
                          (selectedAsset.motionEffect || "none") === effect
                        return (
                          <button
                            key={effect}
                            type="button"
                            onClick={() =>
                              applyAsset({ ...selectedAsset, motionEffect: effect })
                            }
                            className={`rounded-md border py-2 text-[9px] font-bold ${
                              active
                                ? "border-blue-500 bg-blue-600 text-white"
                                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                            }`}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
                <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <div>
                      <p className="text-[11px] font-black text-slate-800">새 요소 추가</p>
                      <p className="mt-0.5 text-[9px] text-slate-400">
                        원하는 소재 유형을 선택하세요.
                      </p>
                    </div>
                    <Plus className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {ELEMENT_SOURCES.map((item) => {
                      const Icon = item.icon
                      const active = elementSource === item.id
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setElementSource(item.id)
                            setHits([])
                            setSearchError("")
                            setCnKeywordSuggestions([])
                            setPixabayKeywordSuggestions([])
                            setTranslatedSearchQuery("")
                            if (item.id === "douyin" || item.id === "xiaohongshu") {
                              setQuery("")
                              void recommendCnSearchKeywords(item.id)
                            } else if (item.id === "pixabay") {
                              setQuery("")
                              void recommendPixabaySearchKeywords()
                            }
                          }}
                          className={`group flex min-h-16 items-center gap-2 rounded-lg border p-2 text-left transition ${
                            active
                              ? "border-blue-500 bg-blue-50 shadow-sm"
                              : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50"
                          }`}
                        >
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                              active
                                ? "bg-blue-600 text-white"
                                : "bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600"
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0">
                            <span
                              className={`block truncate text-[9px] font-black ${
                                active ? "text-blue-800" : "text-slate-700"
                              }`}
                            >
                              {item.label}
                            </span>
                            <span className="mt-0.5 block truncate text-[8px] text-slate-400">
                              {item.description}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <ActiveElementSourceIcon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[10px] font-black text-slate-800">
                      {activeElementSource.label}
                    </p>
                    <p className="text-[9px] text-slate-400">
                      {activeElementSource.description}
                    </p>
                  </div>
                </div>

                {elementSource === "upload" ? (
                  <label className="flex h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/40 text-[11px] font-bold text-blue-700 transition hover:border-blue-400 hover:bg-blue-50">
                    <Upload className="h-5 w-5" />
                    <span>이미지 또는 영상 업로드</span>
                    <span className="text-[8px] font-normal text-slate-400">
                      영상을 선택하면 자르기·모자이크 편집이 열립니다.
                    </span>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) onUploadFile(file)
                      }}
                    />
                  </label>
                ) : elementSource === "review-nano" ? (
                  <div className="space-y-2">
                    <p className="text-[10px] leading-relaxed text-slate-500">
                      쿠팡 리뷰 사진과 제품이 실제로 나온 상품 이미지만 불러와 선택
                      클립 대본 맥락에 맞게 AI로 변형합니다. 긴 상세페이지,
                      설명표, 도표 이미지는 제외합니다.
                    </p>
                    <Button
                      onClick={() => void runSearch()}
                      disabled={isSearching || Boolean(isTransforming)}
                      className="w-full bg-blue-600 font-black text-white hover:bg-blue-500"
                    >
                      {isSearching ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="mr-2 h-4 w-4" />
                      )}
                      리뷰/제품 사진 {reviewPhotoPool.length}장 불러오기
                    </Button>
                  </div>
                ) : (
                  <>
                    {elementSource === "pixabay" ? (
                      <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-[10px] font-black text-emerald-800">
                              장면 맞춤 무료 소재 키워드
                            </p>
                            <p className="mt-0.5 text-[9px] leading-4 text-emerald-700">
                              현재 대본과 장면 상황을 분석해 사진·영상 검색어를 추천합니다.
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={isSuggestingPixabayKeywords}
                            onClick={() => void recommendPixabaySearchKeywords()}
                            className="shrink-0 rounded-md border border-emerald-200 bg-white px-2 py-1 text-[9px] font-bold text-emerald-700 disabled:opacity-50"
                          >
                            {isSuggestingPixabayKeywords ? "추천 중…" : "다시 추천"}
                          </button>
                        </div>
                        {isSuggestingPixabayKeywords ? (
                          <div className="mt-3 flex items-center gap-2 text-[10px] text-emerald-700">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            대본에 맞는 무료 이미지·영상 키워드를 만드는 중…
                          </div>
                        ) : pixabayKeywordSuggestions.length ? (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {pixabayKeywordSuggestions.map((suggestion) => (
                              <button
                                key={`${suggestion.labelKo}-${suggestion.queryEn}`}
                                type="button"
                                title={`영어 검색어: ${suggestion.queryEn}`}
                                onClick={() => {
                                  setQuery(suggestion.labelKo)
                                  setTranslatedSearchQuery(suggestion.queryEn)
                                }}
                                className={`rounded-lg border px-2 py-1 text-left text-[9px] font-bold ${
                                  query === suggestion.labelKo
                                    ? "border-emerald-500 bg-emerald-600 text-white"
                                    : "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-100"
                                }`}
                              >
                                <span className="block">{suggestion.labelKo}</span>
                                <span className={`block text-[8px] font-normal ${
                                  query === suggestion.labelKo
                                    ? "text-emerald-100"
                                    : "text-emerald-600"
                                }`}>
                                  {suggestion.queryEn}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {elementSource === "douyin" || elementSource === "xiaohongshu" ? (
                      <div className="mb-3 rounded-xl border border-violet-200 bg-violet-50/70 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-[10px] font-black text-violet-800">
                              AI 제품 검색어 추천
                            </p>
                            <p className="mt-0.5 text-[9px] text-violet-600">
                              제품명·카테고리 키워드를 중국어로 자동 변환해 검색합니다.
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={isSuggestingCnKeywords}
                            onClick={() =>
                              void recommendCnSearchKeywords(elementSource)
                            }
                            className="shrink-0 rounded-md border border-violet-200 bg-white px-2 py-1 text-[9px] font-bold text-violet-700 disabled:opacity-50"
                          >
                            {isSuggestingCnKeywords ? "추천 중…" : "다시 추천"}
                          </button>
                        </div>
                        {isSuggestingCnKeywords ? (
                          <div className="mt-3 flex items-center gap-2 text-[10px] text-violet-700">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            제품에 맞는 검색어를 만드는 중…
                          </div>
                        ) : cnKeywordSuggestions.length ? (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {cnKeywordSuggestions.map((suggestion) => (
                              <button
                                key={suggestion.labelKo}
                                type="button"
                                title={suggestion.reason}
                                onClick={() => setQuery(suggestion.labelKo)}
                                className={`rounded-full border px-2 py-1 text-[9px] font-bold ${
                                  query === suggestion.labelKo
                                    ? "border-violet-500 bg-violet-600 text-white"
                                    : "border-violet-200 bg-white text-violet-700 hover:bg-violet-100"
                                }`}
                              >
                                {suggestion.labelKo}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {elementSource !== "lens" ? (
                      <>
                        <div className="flex gap-2">
                          <Input
                            value={query}
                            onChange={(e) => {
                              setQuery(e.target.value)
                              if (elementSource === "pixabay") {
                                setTranslatedSearchQuery("")
                              }
                            }}
                            placeholder={
                              elementSource === "douyin" ||
                              elementSource === "xiaohongshu"
                                ? "한국어 제품 검색어를 입력하세요"
                                : elementSource === "pixabay"
                                  ? "한국어로 입력하면 영어로 자동 검색됩니다"
                                  : "검색어"
                            }
                            className="border-slate-200 bg-white text-slate-900"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void runSearch()
                            }}
                          />
                          <Button
                            onClick={() => void runSearch()}
                            disabled={
                              isSearching ||
                              isSuggestingCnKeywords ||
                              isSuggestingPixabayKeywords
                            }
                            className="bg-blue-600 text-white hover:bg-blue-500"
                          >
                            {isSearching ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Search className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        {elementSource === "pixabay" && translatedSearchQuery ? (
                          <p className="mt-1.5 rounded-md bg-slate-100 px-2 py-1 text-[9px] text-slate-500">
                            실제 영어 검색어:{" "}
                            <strong className="text-emerald-700">
                              {translatedSearchQuery}
                            </strong>
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <Button
                        onClick={() => void runSearch()}
                        disabled={isSearching}
                        className="w-full bg-blue-600 font-black text-white hover:bg-blue-500"
                      >
                        {isSearching ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="mr-2 h-4 w-4" />
                        )}
                        제품 메인 사진으로 렌즈 검색
                      </Button>
                    )}
                  </>
                )}

                {selectedRemixHits.length ? (
                  <div className="rounded-xl border border-violet-300 bg-gradient-to-br from-violet-50 to-cyan-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-black text-violet-900">
                          리믹스 정밀 분석 영상 {selectedRemixHits.length}/3개
                        </p>
                        <p className="mt-0.5 text-[9px] leading-4 text-violet-600">
                          리믹스 쇼핑숏폼의 프레임 분석 시스템으로 대본별 최적
                          구간을 자동으로 자릅니다.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={isRemixAutoAssigning}
                        onClick={() => setSelectedRemixHits([])}
                        className="shrink-0 text-[9px] font-bold text-slate-400 hover:text-red-500"
                      >
                        초기화
                      </button>
                    </div>
                    <Button
                      type="button"
                      disabled={isRemixAutoAssigning}
                      onClick={() => void runRemixVideoAutoAssignment()}
                      className="mt-3 h-9 w-full bg-gradient-to-r from-violet-600 to-cyan-600 text-[10px] font-black text-white hover:from-violet-500 hover:to-cyan-500"
                    >
                      {isRemixAutoAssigning ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          {remixAssignProgress || "AI 영상 분석 중…"}
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                          선택 영상 AI 대본 맞춤 자동 자르기
                        </>
                      )}
                    </Button>
                    {remixAssignProgress && !isRemixAutoAssigning ? (
                      <p className="mt-2 rounded-md bg-white/80 px-2 py-1.5 text-[9px] font-bold text-violet-700">
                        {remixAssignProgress}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {searchError ? (
                  <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-[10px] text-red-700">
                    {searchError}
                  </p>
                ) : null}

                <div className="grid grid-cols-2 gap-2">
                  {hits.map((hit) => (
                    <div
                      key={hit.id}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                    >
                      <button
                        type="button"
                        title="사진 크게 보기"
                        onClick={() =>
                          setExpandedSourceImage({
                            url:
                              hit.mediaType === "image"
                                ? hit.mediaUrl || hit.thumbnailUrl
                                : hit.thumbnailUrl,
                            title: hit.title,
                          })
                        }
                        className="group relative block w-full overflow-hidden bg-slate-100"
                      >
                        <img
                          src={hit.thumbnailUrl}
                          alt={hit.title}
                          className="aspect-video w-full object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                        <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100">
                          <Maximize2 className="h-3 w-3" />
                        </span>
                      </button>
                      <p className="line-clamp-2 px-1.5 pt-1 text-[8px] text-slate-500">{hit.title}</p>
                      {hit.mediaType === "video" &&
                      (hit.source === "douyin" ||
                        hit.source === "xiaohongshu") ? (
                        <button
                          type="button"
                          onClick={() => toggleRemixVideoSelection(hit)}
                          className={`mx-1.5 mt-1 flex h-7 w-[calc(100%-12px)] items-center justify-center rounded-md border text-[9px] font-black ${
                            selectedRemixHits.some(
                              (item) =>
                                videoPickKey(item.pageUrl, item.mediaUrl) ===
                                videoPickKey(hit.pageUrl, hit.mediaUrl)
                            )
                              ? "border-violet-500 bg-violet-600 text-white"
                              : "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
                          }`}
                        >
                          {selectedRemixHits.some(
                            (item) =>
                              videoPickKey(item.pageUrl, item.mediaUrl) ===
                              videoPickKey(hit.pageUrl, hit.mediaUrl)
                          )
                            ? "AI 자동 자르기 선택됨"
                            : "AI 자동 자르기에 선택"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={
                          elementSource === "review-nano"
                            ? Boolean(isTransforming) || !selected
                            : !selected || Boolean(preparingVideoUrl)
                        }
                        onClick={() => {
                          if (elementSource === "review-nano") {
                            void transformReviewWithNano(hit.mediaUrl)
                            return
                          }
                          if (hit.mediaType === "video") {
                            void openSearchVideoEditor(hit)
                            return
                          }
                          applyAsset({
                            mediaUrl: hit.mediaUrl,
                            mediaType: hit.mediaType,
                            source: hit.source,
                            sourcePageUrl: hit.pageUrl,
                            attribution: hit.attribution,
                            license: hit.license,
                            trimEndSec: hit.durationSec,
                          })
                        }}
                        className="m-1.5 flex h-7 w-[calc(100%-12px)] items-center justify-center rounded-md bg-blue-600 text-[9px] font-black text-white disabled:opacity-50"
                      >
                        {elementSource === "review-nano" ? (
                          isTransforming === hit.mediaUrl ? (
                            <>
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              변형 중…
                            </>
                          ) : (
                            "AI로 변형"
                          )
                        ) : (
                          hit.mediaType === "video" ? (
                            preparingVideoUrl === hit.mediaUrl ? (
                              <>
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                편집 준비 중…
                              </>
                            ) : (
                              "자르기 후 클립에 넣기"
                            )
                          ) : (
                            "이 클립에 넣기"
                          )
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {rightTab === "sfx" ? (
              <div className="space-y-3">
                <div className="overflow-hidden rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-cyan-50 p-3">
                  <div className="flex items-start gap-2">
                    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 text-white shadow-md shadow-violet-200">
                      {isAutoPlacingSfx ? (
                        <>
                          <span className="absolute inset-0 animate-ping rounded-xl bg-violet-400/30" />
                          <Loader2 className="relative h-4 w-4 animate-spin" />
                        </>
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-black text-slate-900">
                        AI 효과음 자동 배치
                      </p>
                      <p className="mt-0.5 text-[9px] leading-4 text-slate-500">
                        모든 장면에 최소 1개씩, 놀람·반전·클릭·실패·깨달음에
                        어울리는 재미있는 효과음을 넣습니다.
                      </p>
                    </div>
                  </div>
                  {isAutoPlacingSfx ? (
                    <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-violet-950 px-3 py-2 text-[9px] font-bold text-violet-100">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-300" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-300 [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-pink-300 [animation-delay:300ms]" />
                      <span className="ml-1 truncate">
                        {autoSfxMessage || "AI 효과음 감독이 분석 중…"}
                      </span>
                    </div>
                  ) : null}
                  <Button
                    type="button"
                    disabled={isAutoPlacingSfx}
                    onClick={() => void runAutomaticSfxPlacement()}
                    className="mt-3 h-9 w-full bg-gradient-to-r from-violet-600 to-cyan-600 text-[10px] font-black text-white hover:from-violet-500 hover:to-cyan-500 disabled:opacity-70"
                  >
                    {isAutoPlacingSfx ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        AI가 효과음 고르는 중
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                        전체 대본 AI 효과음 배치
                      </>
                    )}
                  </Button>
                  {autoSfxMessage && !isAutoPlacingSfx ? (
                    <p className="mt-2 rounded-md bg-white/80 px-2 py-1.5 text-[9px] font-bold text-violet-700">
                      {autoSfxMessage}
                    </p>
                  ) : null}
                  <p className="mt-2 text-[8px] leading-3 text-slate-400">
                    다시 실행하면 기존 AI 효과음만 교체하며 직접 추가한 효과음은
                    유지합니다.
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-black text-slate-800">
                      효과음 라이브러리
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-pressed={showFavoriteSfxOnly}
                        onClick={() => setShowFavoriteSfxOnly((visible) => !visible)}
                        className={`flex h-7 items-center gap-1 rounded-md border px-2 text-[9px] font-bold ${
                          showFavoriteSfxOnly
                            ? "border-amber-300 bg-amber-50 text-amber-700"
                            : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        <Star
                          className={`h-3 w-3 ${
                            showFavoriteSfxOnly ? "fill-current" : ""
                          }`}
                        />
                        {favoriteSfxIds.length}
                      </button>
                      <span className="text-[9px] font-bold text-slate-400">
                        {filteredSfxCatalog.length}/{STORY_SHOPPING_SFX_CATALOG.length}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 text-[9px] text-slate-500">
                    재생 버튼으로 들어보고 선택 클립 시작점에 추가하세요.
                  </p>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={sfxSearch}
                    onChange={(event) => setSfxSearch(event.target.value)}
                    placeholder="효과음 이름 또는 번호 검색"
                    className="h-9 border-slate-200 bg-white pl-8 text-[10px] text-slate-900"
                  />
                </div>
                <div className="max-h-[360px] space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-1.5">
                  {filteredSfxCatalog.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-1.5 rounded-lg bg-white px-1.5 py-1.5 shadow-sm"
                    >
                      <button
                        type="button"
                        aria-label={`${item.label} 미리듣기`}
                        title="미리듣기"
                        onClick={() => toggleSfxPreview(item)}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                          previewingSfxId === item.id
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {previewingSfxId === item.id ? (
                          <Pause className="h-3 w-3" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                      </button>
                      <span
                        className="min-w-0 flex-1 truncate text-[10px] font-semibold text-slate-700"
                        title={`${item.number}. ${item.label}`}
                      >
                        {item.number}. {item.label}
                      </span>
                      <button
                        type="button"
                        aria-label={`${item.label} ${
                          favoriteSfxIds.includes(item.id)
                            ? "즐겨찾기 해제"
                            : "즐겨찾기 추가"
                        }`}
                        title={
                          favoriteSfxIds.includes(item.id)
                            ? "즐겨찾기 해제"
                            : "즐겨찾기 추가"
                        }
                        onClick={() => toggleFavoriteSfx(item.id)}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                          favoriteSfxIds.includes(item.id)
                            ? "bg-amber-50 text-amber-500"
                            : "text-slate-300 hover:bg-amber-50 hover:text-amber-500"
                        }`}
                      >
                        <Star
                          className={`h-3.5 w-3.5 ${
                            favoriteSfxIds.includes(item.id) ? "fill-current" : ""
                          }`}
                        />
                      </button>
                      <button
                        type="button"
                        aria-label={`${item.label} 타임라인에 추가`}
                        title="타임라인에 추가"
                        onClick={() => void addSfxFromLibrary(item)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {!filteredSfxCatalog.length ? (
                    <p className="py-8 text-center text-[10px] text-slate-400">
                      검색 결과가 없습니다.
                    </p>
                  ) : null}
                </div>
                {selectedSfx ? (
                  <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[10px] font-black text-amber-950">
                          {selectedSfx.label}
                        </p>
                        <p className="mt-0.5 text-[9px] text-amber-700">
                          타임라인에서 선택됨 · Ctrl+B로 분할
                        </p>
                      </div>
                      <button
                        type="button"
                        title="효과음 삭제"
                        onClick={() => deleteSfxClip(selectedSfx.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        삭제
                      </button>
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between text-[9px] font-bold text-amber-900">
                        <span>음량</span>
                        <span>{Math.round(selectedSfx.volumePct ?? 100)}%</span>
                      </div>
                      <Slider
                        value={[selectedSfx.volumePct ?? 100]}
                        min={0}
                        max={200}
                        step={5}
                        onValueChange={([volumePct]) =>
                          patchSfxClip(selectedSfx.id, { volumePct })
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => splitSelectedSfxAtPlayhead()}
                      className="h-8 w-full border-amber-300 bg-white text-[9px] font-bold text-amber-900 hover:bg-amber-100"
                    >
                      빨간 재생바 위치에서 분할 (Ctrl+B)
                    </Button>
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-[9px] leading-4 text-slate-500">
                    타임라인의 효과음을 선택하면 음량·분할·삭제 설정이 표시됩니다.
                  </p>
                )}
                <div className="border-t border-slate-200 pt-3">
                  <p className="mb-2 text-[10px] font-bold text-slate-600">
                    직접 파일 추가
                  </p>
                <Input
                  value={sfxLabel}
                  onChange={(e) => setSfxLabel(e.target.value)}
                  placeholder="효과음 이름"
                  className="border-slate-200 bg-white text-slate-900"
                />
                <label className="flex h-20 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 text-[11px] text-slate-600 hover:bg-slate-50">
                  <Volume2 className="h-4 w-4" />
                  오디오 파일 업로드
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void addSfxFromFile(file)
                    }}
                  />
                </label>
                </div>
                <div>
                  <p className="mb-1.5 text-[10px] font-bold text-slate-600">
                    타임라인에 추가됨 {(brief.sfxClips || []).length}
                  </p>
                  <div className="space-y-1">
                    {(brief.sfxClips || []).map((clip) => (
                      <div
                        key={clip.id}
                        className={`flex items-center justify-between rounded-lg border px-2 py-1.5 text-[10px] ${
                          selectedSfxId === clip.id
                            ? "border-amber-400 bg-amber-50 text-amber-950"
                            : "border-slate-200 text-slate-600"
                        }`}
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 truncate text-left"
                          onClick={() => {
                            setSelectedElementKey(null)
                            setSelectedSfxId(clip.id)
                          }}
                        >
                          {clip.label}
                        </button>
                        <button
                          type="button"
                          className="ml-2 text-red-600"
                          onClick={() => deleteSfxClip(clip.id)}
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {rightTab === "thumbnail" ? (
              <StoryThumbnailPanel
                brief={brief}
                onChange={onChange}
                projectId={projectId}
                selectedAsset={selectedAsset}
                onIntroPreviewChange={handleThumbnailIntroPreviewChange}
              />
            ) : null}

            {rightTab === "publish" && publishMeta && onPublishMetaChange ? (
              <StoryPublishMetaPanel
                productName={brief.productName}
                productDescription={brief.productDescription}
                script={
                  brief.generatedStory?.script ||
                  brief.generatedStory?.scenes.map((scene) => scene.narration).join("\n") ||
                  ""
                }
                value={publishMeta}
                onChange={onPublishMetaChange}
              />
            ) : null}
          </div>
        </aside>
      </div>

      {/* 하단 타임라인 */}
      <div
        ref={timelinePanelRef}
        className="flex min-h-0 flex-col overflow-hidden bg-white"
      >
        <button
          type="button"
          role="separator"
          aria-label="타임라인 높이 조절"
          aria-orientation="horizontal"
          aria-valuemin={128}
          aria-valuemax={560}
          aria-valuenow={timelineHeight}
          title="드래그하여 타임라인 높이 조절 · 더블클릭하여 초기화"
          onPointerDown={beginTimelineResize}
          onDoubleClick={() => setTimelineHeight(220)}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp") {
              event.preventDefault()
              setTimelineHeight((height) => Math.min(560, height + 20))
            }
            if (event.key === "ArrowDown") {
              event.preventDefault()
              setTimelineHeight((height) => Math.max(128, height - 20))
            }
          }}
          className="group flex h-2 shrink-0 cursor-row-resize items-center justify-center border-y border-slate-200 bg-slate-100 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
        >
          <span className="h-0.5 w-12 rounded-full bg-slate-300 transition group-hover:bg-blue-500" />
        </button>
        <div className="flex h-8 items-center justify-between border-b border-slate-200 px-3">
          <p className="text-[10px] font-black text-slate-500">
            타임라인 · 클립 {timeline.findIndex((t) => t.sceneId === selected?.sceneId && t.lineIndex === selected?.lineIndex) + 1}/{timeline.length}
          </p>
          <div className="flex items-center gap-3 text-[9px] text-slate-400">
            <span className="font-bold text-blue-600">{Math.round(timelineZoom * 100)}%</span>
            <span>Ctrl+휠 확대·축소 · Shift+휠 가로 이동</span>
          </div>
        </div>
        <div
          ref={timelineScrollRef}
          className="min-h-0 flex-1 overflow-auto p-3"
        >
          <div
            className="relative min-w-full space-y-2"
            style={{ width: Math.max(640, totalDuration * pxPerSec + 96) }}
          >
            <button
              type="button"
              aria-label={`재생 위치 ${formatTimelineTime(playheadSec)}`}
              title="좌우로 드래그하여 재생 위치 이동"
              onPointerDown={beginPlayheadDrag}
              className="absolute bottom-0 top-0 z-30 w-3 -translate-x-1/2 cursor-ew-resize touch-none"
              style={{ left: 64 + playheadSec * pxPerSec }}
            >
              <span className="absolute bottom-0 left-1/2 top-1.5 w-px -translate-x-1/2 bg-red-500" />
              <span className="absolute left-1/2 top-0 h-3 w-2.5 -translate-x-1/2 rounded-b bg-red-500" />
            </button>

            <div className="flex h-6 items-stretch gap-2">
              <div className="flex w-14 shrink-0 items-center text-[9px] font-bold tabular-nums text-slate-500">
                {formatTimelineTime(playheadSec)}
              </div>
              <div
                className="relative flex-1 cursor-ew-resize border-b border-slate-200 bg-white"
                onPointerDown={beginPlayheadDrag}
              >
                {rulerTicks.map((time) => (
                  <div
                    key={time}
                    className="absolute bottom-0 top-0 border-l border-slate-300"
                    style={{ left: time * pxPerSec }}
                  >
                    <span className="absolute left-1 top-0 whitespace-nowrap text-[8px] tabular-nums text-slate-400">
                      {formatTimelineTime(time)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {(
              [
                { id: "thumbnail", label: "썸네일" },
                { id: "clip", label: "클립" },
                { id: "element", label: "요소" },
                { id: "caption", label: "자막" },
                { id: "sfx", label: "효과음" },
              ] as const
            ).map((track) => (
              <div key={track.id} className="flex items-stretch gap-2">
                <div className="flex w-14 shrink-0 items-center text-[9px] font-bold text-slate-500">
                  {track.label}
                </div>
                <div className="relative h-10 flex-1 rounded-md border border-slate-200 bg-slate-50">
                  {track.id === "thumbnail"
                    ? thumbnailIntroPreview.enabled &&
                      thumbnailIntroPreview.url && (
                        <button
                          type="button"
                          onClick={() => {
                            stopPlayback()
                            setPlayheadSec(0)
                          }}
                          className="absolute left-0 top-1 h-8 min-w-[18px] overflow-hidden rounded bg-fuchsia-600 px-1 text-left text-[7px] font-black text-white ring-1 ring-fuchsia-300"
                          style={{
                            width: Math.max(
                              18,
                              MVP_THUMBNAIL_INTRO_SEC * pxPerSec
                            ),
                          }}
                          title="선택 썸네일 · 0~0.01초"
                        >
                          0.01s
                        </button>
                      )
                    : track.id === "clip" || track.id === "element" || track.id === "caption"
                    ? timeline.map((slot) => {
                        const key = clipKey(slot.sceneId, slot.lineIndex)
                        const asset = resolveStoryLineAsset(
                          brief.sceneAssets,
                          slot.sceneId,
                          slot.lineIndex
                        )
                        const active = key === selectedKey
                        const elementSelected =
                          track.id === "element" && key === selectedElementKey
                        if (track.id === "element" && !asset) return null
                        return (
                          <button
                            key={`${track.id}-${key}`}
                            type="button"
                            data-story-element-clip={
                              track.id === "element" ? "true" : undefined
                            }
                            onClick={() => {
                              stopPlayback()
                              setSelectedKey(key)
                              setPlayheadSec(slot.startSec)
                              setSelectedElementKey(
                                track.id === "element" ? key : null
                              )
                              setSelectedSfxId(null)
                            }}
                            className={`absolute top-1 h-8 overflow-hidden rounded px-1 text-left text-[8px] font-bold ${
                              elementSelected
                                ? "z-10 bg-amber-500 text-black ring-2 ring-red-500 ring-offset-1"
                                : track.id === "caption"
                                ? "bg-violet-500 text-white"
                                : active
                                  ? "bg-blue-600 text-white"
                                  : "bg-cyan-500 text-white"
                            }`}
                            style={{
                              left: slot.startSec * pxPerSec,
                              width: Math.max(18, slot.durationSec * pxPerSec - 2),
                            }}
                            title={
                              track.id === "element"
                                ? `${slot.text} · 선택 후 Delete로 삭제`
                                : slot.text
                            }
                          >
                            <span className="line-clamp-2">
                              {track.id === "caption" ? slot.text : `${slot.lineIndex + 1}`}
                            </span>
                          </button>
                        )
                      })
                    : (brief.sfxClips || []).map((rawSfx) => {
                        const sfx = normalizedStorySfxClip(rawSfx)
                        const width = Math.max(18, sfx.durationSec * pxPerSec)
                        const selected = selectedSfxId === sfx.id
                        return (
                          <button
                            key={sfx.id}
                            type="button"
                            onPointerDown={(event) => beginSfxDrag(event, sfx)}
                            className={`absolute top-1 h-8 touch-none overflow-hidden rounded text-left text-[8px] font-bold ${
                              selected
                                ? "z-20 bg-amber-600 text-white ring-2 ring-red-500 ring-offset-1"
                                : "bg-amber-400 text-amber-950 hover:bg-amber-500"
                            }`}
                            style={{
                              left: sfx.startSec * pxPerSec,
                              width,
                            }}
                            title={`${sfx.label} · 드래그로 이동 · Ctrl+B 분할 · Delete 삭제`}
                          >
                            <StorySfxWaveform
                              audioUrl={sfx.audioUrl}
                              sourceOffsetSec={sfx.sourceOffsetSec}
                              durationSec={sfx.durationSec}
                              width={width}
                              selected={selected}
                            />
                            <span className="pointer-events-none relative z-10 block truncate bg-gradient-to-r from-black/35 to-transparent px-1 py-0.5 text-[7px] text-white">
                              {sfx.label}
                            </span>
                          </button>
                        )
                      })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {videoEditDraft ? (
        <StoryVideoTrimMosaicDialog
          open
          src={videoEditDraft.asset.mediaUrl}
          minimumDurationSec={selectedTimeline?.durationSec || 0.8}
          initialTrimStartSec={videoEditDraft.asset.trimStartSec}
          initialTrimEndSec={videoEditDraft.asset.trimEndSec}
          initialMosaics={videoEditDraft.asset.videoMosaics}
          initialMediaScale={videoEditDraft.asset.mediaScale}
          initialMediaOffsetX={videoEditDraft.asset.mediaOffsetX}
          initialMediaOffsetY={videoEditDraft.asset.mediaOffsetY}
          fit={videoEditDraft.asset.mediaFit}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) closeVideoEditor()
          }}
          onApply={applyVideoEdit}
        />
      ) : null}
    </div>
  )
})