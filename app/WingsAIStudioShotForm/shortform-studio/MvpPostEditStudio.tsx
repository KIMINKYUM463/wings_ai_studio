"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { AutoEditJobResult } from "@/lib/shotform-auto-edit-types"
import {
  audioTimeFromVideoSync,
  previewTimelineEndSec,
  previewPlaybackRateForCue,
  videoRangeFromVoiceCue,
  videoTimeFromAudioCueSync,
} from "@/lib/shotform-mvp-preview-sync"
import {
  buildVoiceLineCues,
  collectNarrationSubtitleLines,
  decodeAudioDurationSec,
  mergeAudioUrlsToWavBlobUrl,
  MIN_TTS_PLAIN_CHARS,
  voiceLineCueAtTime,
  voiceSubtitleAtLineCues,
  type VoiceLineCue,
} from "@/lib/shotform-factory-line-tts"
import { narrationPlainCharCount } from "@/lib/shotform-narration-timing"
import { normalizeTtsSpeed } from "@/lib/shotform-tts-speed"
import { MVP_THUMBNAIL_INTRO_SEC } from "@/lib/mvp-thumbnail-intro"
import {
  appendThumbnailVariant,
  migrateThumbnailGallery,
  removeThumbnailVariant,
  selectedThumbnailVariant,
} from "@/lib/mvp-thumbnail-gallery"
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
  ttsApiKeyMissingMessage,
  ttsProviderFromVoiceId,
  type ShotformTtsVoice,
  type TtsProviderId,
} from "@/lib/shotform-tts-providers"
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
} from "@/lib/shotform-cut-narration"
import { analysisByVideoId } from "@/lib/shotform-visual-scene-match"
import { cleanNarrationLineBreaks } from "@/lib/shotform-narration-timing"
import { sanitizeNarrationForOutput } from "@/lib/shotform-natural-shorts-script"
import type {
  MvpStudioPersistData,
  MvpStudioPhase,
  MvpScriptStyleState,
  MvpThumbnailHookingText,
  MvpThumbnailVariant,
} from "@/lib/mvp-studio-types"
import { normalizePlacedOverlays } from "@/lib/mvp-overlay-utils"
import type { PlacedStudioOverlay } from "@/lib/shotform-studio-overlay-catalog"
import {
  migrateStudioAudioToBgmClips,
  normalizeStudioPhase,
  normalizeSubtitleStyle,
  scriptStyleFromBundle,
  type MvpBgmClip,
  type MvpSubtitleStyle,
} from "@/lib/mvp-studio-types"
import { MvpPreviewAudioLayers } from "@/lib/mvp-preview-audio-mix"
import {
  loadMvpEditMp4,
  loadMvpTtsAudio,
  saveMvpEditMp4,
  saveMvpTtsAudio,
} from "@/lib/mvp-local-media-cache"
import { assertPreviewMp4Blob, probeVideoElementPlayable } from "@/lib/mvp-mp4-preview"
import { autoEditDownloadUrl } from "@/lib/shotform-auto-edit-download"
import { MvpCapCutEditor } from "./MvpCapCutEditor"
import { MvpExportPanel } from "./MvpExportPanel"
import { MvpScriptStyleEditor } from "./MvpScriptStyleEditor"
import { MvpStudioStepNav } from "./MvpStudioStepNav"
import { MvpThumbnailGenerator } from "./MvpThumbnailGenerator"

type Props = {
  projectId: string
  projectName: string
  result: AutoEditJobResult
  videoBlobUrl: string | null
  /** 짜집기 직후 메모리 blob — IndexedDB 저장 전에도 미리보기 */
  videoBlob?: Blob | null
  scriptOverrides?: Record<string, string>
  onScriptOverridesChange?: (overrides: Record<string, string>) => void
  studioPersist?: MvpStudioPersistData
  onStudioPersistChange?: (data: MvpStudioPersistData) => void
  onClose?: () => void
}

function shotformOpenAIKey(): string {
  if (typeof window === "undefined") return ""
  return (localStorage.getItem("shotform_openai_api_key") || "").trim()
}

export function MvpPostEditStudio({
  projectId,
  projectName,
  result,
  videoBlobUrl,
  videoBlob = null,
  scriptOverrides: scriptOverridesProp = {},
  onScriptOverridesChange,
  studioPersist,
  onStudioPersistChange,
  onClose,
}: Props) {
  const baseSegments = useMemo(() => narrationSegmentsFromAutoEdit(result), [result])

  const segmentVisualHints = useMemo(() => {
    const plan = result.editPlan?.edit_plan
    if (!plan?.length) return [] as string[]
    const analyses = result.analyses?.length
      ? result.analyses
      : result.analysis
        ? [result.analysis]
        : []
    const byId = analysisByVideoId(analyses)
    return plan.map((seg) => {
      const hint = cutVisualHintForSegment(seg, byId.get(seg.video_id))
      return hint ? formatSceneDescriptionHint(hint) : ""
    })
  }, [result])
  const [scriptOverrides, setScriptOverrides] = useState<Record<string, string>>(scriptOverridesProp)

  useEffect(() => {
    setScriptOverrides(fillScriptOverridesForAllCuts(baseSegments, scriptOverridesProp))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- jobId 변경 시에만 부모에서 복원
  }, [result.jobId])

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
        text: resolveSceneNarrationText(i, baseSegments, scriptOverrides),
      })),
    [baseSegments, scriptOverrides]
  )

  const scriptNeedsAi = useMemo(
    () => needsAiNarrationFromScenes(result, scriptOverrides),
    [result, scriptOverrides]
  )
  const totalSec = useMemo(() => narrationTotalSec(segments), [segments])

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fetchedBlobRef = useRef<string | null>(null)

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
    elevenlabs: elevenlabsSampleVoiceCatalog(),
    typecast: [],
  })
  const [voicesLoading, setVoicesLoading] = useState<Record<TtsProviderId, boolean>>({
    supertone: false,
    elevenlabs: false,
    typecast: false,
  })
  const [voiceLoadErrors, setVoiceLoadErrors] = useState<Record<TtsProviderId, string | null>>({
    supertone: null,
    elevenlabs: null,
    typecast: null,
  })
  const [voiceListUnavailable, setVoiceListUnavailable] = useState<Record<TtsProviderId, boolean>>({
    supertone: false,
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
  const [voiceLineCues, setVoiceLineCues] = useState<VoiceLineCue[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [scriptGenerating, setScriptGenerating] = useState(false)
  const [phase, setPhase] = useState<MvpStudioPhase>(() => normalizeStudioPhase(studioPersist?.phase))
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
  const activeThumbnail = useMemo(
    () => selectedThumbnailVariant(thumbnailGallery, selectedThumbnailId),
    [thumbnailGallery, selectedThumbnailId]
  )
  const thumbnailUrl = activeThumbnail?.url ?? ""
  const ttsBlobRef = useRef<Blob | null>(null)
  const fetchedTtsUrlRef = useRef<string | null>(null)
  const audioLayersRef = useRef<MvpPreviewAudioLayers | null>(null)
  if (!audioLayersRef.current) {
    audioLayersRef.current = new MvpPreviewAudioLayers()
  }
  /** play() Promise가 pause 이후 sync를 호출하지 않도록 */
  const previewPlayGenRef = useRef(0)

  const [bgmClips, setBgmClips] = useState<MvpBgmClip[]>(() =>
    migrateStudioAudioToBgmClips(studioPersist, totalSec || 30)
  )
  const [editMp4CachedJobId, setEditMp4CachedJobId] = useState(studioPersist?.editMp4CachedJobId ?? "")
  const [editTtsCachedJobId, setEditTtsCachedJobId] = useState(studioPersist?.editTtsCachedJobId ?? "")
  const onStudioPersistChangeRef = useRef(onStudioPersistChange)
  onStudioPersistChangeRef.current = onStudioPersistChange
  const lastPersistKeyRef = useRef("")

  useEffect(() => {
    setEditMp4CachedJobId(studioPersist?.editMp4CachedJobId ?? "")
    setEditTtsCachedJobId(studioPersist?.editTtsCachedJobId ?? "")
    setScriptStyle(studioPersist?.scriptStyle ?? scriptStyleFromBundle(result.script?.bundle))
    setVoiceLineCues(studioPersist?.voiceLineCues?.length ? studioPersist.voiceLineCues : null)
    setPhase(normalizeStudioPhase(studioPersist?.phase))
    if (studioPersist?.selectedVoiceId) setSelectedVoiceId(studioPersist.selectedVoiceId)
    if (studioPersist?.supertoneStyle) setSupertoneStyle(studioPersist.supertoneStyle)
    if (studioPersist?.speechSpeed != null) setSpeechSpeed(normalizeTtsSpeed(studioPersist.speechSpeed))
    setTtsGeneratedSpeed(null)
    if (studioPersist?.subtitleStyle) {
      setSubtitleStyle(normalizeSubtitleStyle(studioPersist.subtitleStyle))
    }
    setPlacedOverlays(normalizePlacedOverlays(studioPersist?.placedOverlays))
    const migrated = migrateThumbnailGallery(studioPersist)
    setThumbnailGallery(migrated.gallery)
    setSelectedThumbnailId(migrated.selectedId)
    setThumbnailHookingText(studioPersist?.thumbnailHookingText ?? { line1: "", line2: "" })
    setThumbnailIntroOn(
      studioPersist?.thumbnailIntroOn ?? Boolean(migrated.selectedId)
    )
    setBgmClips(migrateStudioAudioToBgmClips(studioPersist, totalSec || 30))
    if (fetchedTtsUrlRef.current) {
      URL.revokeObjectURL(fetchedTtsUrlRef.current)
      fetchedTtsUrlRef.current = null
    }
    setAudioUrl(null)
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
      voiceLineCues: voiceLineCues ?? undefined,
      selectedVoiceId,
      supertoneStyle,
      speechSpeed,
      phase,
      editMp4CachedJobId: editMp4CachedJobId || undefined,
      editTtsCachedJobId: editTtsCachedJobId || undefined,
      bgmClips: bgmClips.length ? bgmClips : undefined,
    }
    const key = JSON.stringify(payload)
    if (key === lastPersistKeyRef.current) return
    lastPersistKeyRef.current = key
    onStudioPersistChangeRef.current?.(payload)
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
    voiceLineCues,
    selectedVoiceId,
    supertoneStyle,
    speechSpeed,
    phase,
    editMp4CachedJobId,
    editTtsCachedJobId,
    bgmClips,
  ])

  useEffect(() => {
    audioLayersRef.current?.updateConfig(bgmClips)
  }, [bgmClips])

  useEffect(() => {
    return () => {
      audioLayersRef.current?.dispose()
    }
  }, [])

  const loadVoicesForProvider = useCallback(async (provider: TtsProviderId) => {
    if (skipVoiceListLoadRef.current.has(provider)) return

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
    ttsBlobRef.current = null
    setAudioUrl(null)
    setAudioKey((k) => k + 1)
    setAudioDuration(0)
    setVoiceLineCues(null)
    setEditTtsCachedJobId("")
    setPlaying(false)
  }, [])

  const generateNarrationScript = useCallback(async (opts?: { rewrite?: boolean }) => {
    const rewrite = Boolean(opts?.rewrite)
    const openai = shotformOpenAIKey()
    if (!openai) {
      setErr("ShotForm 설정에 OpenAI API 키(shotform_openai_api_key)를 저장해 주세요.")
      return
    }
    if (rewrite && audioUrl) {
      const ok = window.confirm(
        "대본을 다시 쓰면 기존 TTS·자막 싱크가 초기화됩니다.\n영상은 그대로 두고 대본만 새로 작성할까요?"
      )
      if (!ok) return
    }
    setScriptGenerating(true)
    setErr(null)
    try {
      const currentScripts = fillScriptOverridesForAllCuts(baseSegments, scriptOverrides)
      const res = await fetch("/api/shotform/mvp-narration-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openaiApiKey: openai,
          result,
          projectName,
          mode: rewrite ? "rewrite" : "generate",
          previousScripts: rewrite ? currentScripts : undefined,
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
      if (data.overrides && Object.keys(data.overrides).length) {
        const formatted = fillScriptOverridesForAllCuts(baseSegments, data.overrides)
        setScriptOverrides(formatted)
        onScriptOverridesChange?.(formatted)
        autoScriptRequestedRef.current = result.jobId
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
      }
    } catch (e) {
      if (!opts?.rewrite) autoScriptRequestedRef.current = null
      setErr(e instanceof Error ? e.message : rewrite ? "대본 다시쓰기 실패" : "AI 대본 생성 실패")
    } finally {
      setScriptGenerating(false)
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
      setResolvedVideoUrl(url)
      setErr(null)
      if (projectId && result.jobId) {
        await saveMvpEditMp4(projectId, result.jobId, blob)
        markMp4Cached(result.jobId)
      }
    },
    [projectId, result.jobId, markMp4Cached]
  )

  useEffect(() => {
    if (videoBlob) {
      void applyVideoBlob(videoBlob)
      return
    }
    if (videoBlobUrl) {
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
        if (result.renderSkipped) {
          if (!cancelled) {
            setErr(
              result.renderSkipReason ||
                "짜집기 MP4 렌더가 생략되었습니다. 짜집기를 다시 실행해 주세요."
            )
          }
          return
        }
        const downloadTarget =
          (result.downloadUrl?.includes("inline=1")
            ? result.downloadUrl
            : result.jobId
              ? autoEditDownloadUrl(result.jobId, { inline: true })
              : result.downloadUrl) || ""
        if (!downloadTarget) {
          if (!cancelled) setErr("짜집기 MP4가 없습니다. 짜집기를 다시 실행해 주세요.")
          return
        }
        const res = await fetch(downloadTarget)
        if (!res.ok) {
          const detail = await res.text().catch(() => "")
          let msg = `MP4 조회 실패 (${res.status})`
          try {
            const j = JSON.parse(detail) as { error?: string }
            if (j.error) msg = j.error
          } catch {
            /* ignore */
          }
          throw new Error(msg)
        }
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
                ? "브라우저 로컬 캐시를 찾지 못했습니다(저장소 삭제·시크릿 모드 등). 짜집기를 다시 실행해 주세요."
                : "짜집기 MP4를 불러오지 못했습니다. 짜집기를 다시 실행해 주세요.")
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
        if (fetchedTtsUrlRef.current) URL.revokeObjectURL(fetchedTtsUrlRef.current)
        const url = URL.createObjectURL(blob)
        fetchedTtsUrlRef.current = url
        ttsBlobRef.current = blob
        const dur = await decodeAudioDurationSec(url)
        if (cancelled) return
        setAudioUrl(url)
        setAudioDuration(dur)
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
  }, [projectId, result.jobId, voiceLineCues, audioUrl])

  useEffect(
    () => () => {
      if (fetchedBlobRef.current) {
        URL.revokeObjectURL(fetchedBlobRef.current)
        fetchedBlobRef.current = null
      }
      if (fetchedTtsUrlRef.current) {
        URL.revokeObjectURL(fetchedTtsUrlRef.current)
        fetchedTtsUrlRef.current = null
      }
    },
    []
  )

  const getSceneText = useCallback(
    (i: number) => resolveSceneNarrationText(i, baseSegments, scriptOverrides),
    [scriptOverrides, baseSegments]
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
        segments
      ),
    [videoDuration, totalSec, audioDuration, voiceLineCues, segments]
  )

  const lastSyncSceneRef = useRef(-1)
  const lastSyncCueKeyRef = useRef("")
  const sceneStopAtRef = useRef<number | null>(null)

  const syncVideoToAudio = useCallback(
    (audioT: number, forceSeek = false) => {
      const v = videoRef.current
      if (!v || !voiceLineCues?.length) return

      const cue = voiceLineCueAtTime(voiceLineCues, audioT)
      if (!cue) return

      const { startSec: vidStart, endSec: vidEnd } = videoRangeFromVoiceCue(
        cue,
        segments,
        voiceLineCues
      )
      const rate = previewPlaybackRateForCue(cue, segments, voiceLineCues)
      const cueKey = `${cue.sceneIndex}:${cue.startSec.toFixed(3)}`
      const sceneChanged = cue.sceneIndex !== lastSyncSceneRef.current
      const cueChanged = cueKey !== lastSyncCueKeyRef.current

      v.playbackRate = rate

      if (forceSeek) {
        v.currentTime = vidStart
        lastSyncSceneRef.current = cue.sceneIndex
        lastSyncCueKeyRef.current = cueKey
        return
      }

      if (cueChanged) {
        lastSyncCueKeyRef.current = cueKey
        if (sceneChanged) {
          v.currentTime = vidStart
          lastSyncSceneRef.current = cue.sceneIndex
        } else if (v.currentTime < vidStart - 0.12 || v.currentTime > vidEnd + 0.08) {
          v.currentTime = vidStart
        }
        return
      }

      if (v.paused) return

      if (v.currentTime < vidStart - 0.2) {
        v.currentTime = vidStart
      } else if (v.currentTime > vidEnd + 0.15) {
        v.currentTime = Math.max(vidStart, vidEnd - 0.04)
      }
    },
    [voiceLineCues, segments]
  )

  const pausePreview = useCallback(() => {
    previewPlayGenRef.current += 1
    const v = videoRef.current
    const a = audioRef.current
    a?.pause()
    v?.pause()
    if (v) v.playbackRate = 1
    audioLayersRef.current?.stop()
    setPlaying(false)
    lastSyncSceneRef.current = -1
    lastSyncCueKeyRef.current = ""
    sceneStopAtRef.current = null
  }, [])

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
          segments,
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
    [audioUrl, audioDuration, voiceLineCues, segments, videoDuration, totalSec]
  )

  const handleAudioTimeUpdate = useCallback(() => {
    const a = audioRef.current
    const v = videoRef.current
    if (!a) return
    if (a.paused) {
      audioLayersRef.current?.stop()
      return
    }
    const t = a.currentTime
    setAudioPlayhead(t)
    const layersPlaying = !a.paused && !(v?.paused ?? false)
    if (voiceLineCues?.length) {
      const vt =
        v && !v.paused && Number.isFinite(v.currentTime)
          ? v.currentTime
          : videoTimeFromAudioCueSync(
              t,
              voiceLineCues,
              segments,
              videoDuration || totalSec,
              audioDuration
            )
      setPlayhead(vt)
      syncVideoToAudio(t)
      audioLayersRef.current?.sync(vt, layersPlaying)
      if (sceneStopAtRef.current != null && vt >= sceneStopAtRef.current) {
        pausePreview()
        if (v) v.currentTime = sceneStopAtRef.current
        setPlayhead(sceneStopAtRef.current)
      }
    } else if (videoDuration > 0 && audioDuration > 0) {
      const vt = Math.min(videoDuration, (t / audioDuration) * videoDuration)
      setPlayhead(vt)
      audioLayersRef.current?.sync(vt, layersPlaying)
      if (sceneStopAtRef.current != null && vt >= sceneStopAtRef.current) {
        pausePreview()
        if (v) v.currentTime = sceneStopAtRef.current
      }
    }
  }, [voiceLineCues, segments, videoDuration, totalSec, audioDuration, syncVideoToAudio, pausePreview])

  const handleVideoTimeUpdate = useCallback(() => {
    const v = videoRef.current
    if (!v) return
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
  }, [audioUrl])

  const playSceneOnly = useCallback(
    (index: number) => {
      const seg = segments[index]
      if (!seg) return
      pausePreview()
      sceneStopAtRef.current = Math.max(seg.start + 0.05, seg.end - 0.04)
      setPlayhead(seg.start)
      syncVideoToPlayhead(seg.start)
      const v = videoRef.current
      const a = audioRef.current
      const gen = previewPlayGenRef.current
      if (v) {
        v.currentTime = seg.start
        void v.play().then(() => {
          if (gen !== previewPlayGenRef.current) return
          setPlaying(true)
        }).catch(() => {})
      }
      audioLayersRef.current?.onSeek(seg.start)
      if (audioUrl && a) {
        void a.play().then(() => {
          if (gen !== previewPlayGenRef.current) return
          audioLayersRef.current?.sync(seg.start, true)
        }).catch(() => {})
      }
    },
    [segments, pausePreview, syncVideoToPlayhead, audioUrl]
  )

  const handlePlayToggle = useCallback(() => {
    const v = videoRef.current
    const a = audioRef.current
    if (audioUrl && a) {
      if (playing) {
        pausePreview()
        return
      }
      if (audioPlayhead >= audioDuration - 0.05) {
        a.currentTime = 0
        setAudioPlayhead(0)
        setPlayhead(0)
        if (v) {
          v.currentTime = 0
          v.playbackRate = 1
        }
        lastSyncSceneRef.current = -1
        lastSyncCueKeyRef.current = ""
      }
      syncVideoToAudio(a.currentTime, true)
      const vt =
        voiceLineCues?.length
          ? videoTimeFromAudioCueSync(
              a.currentTime,
              voiceLineCues,
              segments,
              videoDuration || totalSec,
              audioDuration
            )
          : Math.min(videoDuration || totalSec, (a.currentTime / audioDuration) * (videoDuration || totalSec))
      audioLayersRef.current?.onSeek(vt)
      const gen = previewPlayGenRef.current
      void a.play().then(() => {
        if (gen !== previewPlayGenRef.current) return
        setPlaying(true)
        audioLayersRef.current?.sync(vt, true)
        void v?.play().catch(() => {})
      })
      return
    }
    if (!v) return
    if (playing) {
      pausePreview()
      return
    }
    audioLayersRef.current?.onSeek(v.currentTime)
    const gen = previewPlayGenRef.current
    void v.play().then(() => {
      if (gen !== previewPlayGenRef.current) return
      setPlaying(true)
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
    segments,
    videoDuration,
    totalSec,
  ])

  const runTts = useCallback(async (opts?: { voiceId?: string; style?: string; speed?: number }) => {
    setErr(null)
    const voiceId = opts?.voiceId?.trim() || selectedVoiceId
    const style = opts?.style ?? supertoneStyle
    const speed = normalizeTtsSpeed(opts?.speed ?? speechSpeed)
    const provider = ttsProviderFromVoiceId(voiceId)
    if (!provider) {
      setErr("목소리를 선택해 주세요. (수퍼톤 / ElevenLabs / 타입캐스트)")
      return
    }
    if (!shotformTtsApiKey(provider)) {
      setErr(ttsApiKeyMissingMessage(provider))
      return
    }
    if (voiceId !== selectedVoiceId) {
      setSelectedVoiceId(voiceId)
      setSupertoneStyle(style)
    }
    const lines = collectNarrationSubtitleLines(segments, getSceneText)
    const uncovered = segments
      .map((_, i) => i)
      .filter((i) => !lines.some((l) => l.sceneIndex === i))
    if (!lines.length) {
      setErr("짜집기 대본이 없습니다. 편집을 다시 실행해 주세요.")
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
      const audioUrls: string[] = []
      const measured: Array<{
        text: string
        sceneIndex: number
        durationSec: number
        displayLines?: string[]
      }> = []

      for (let i = 0; i < lines.length; i++) {
        const { text, sceneIndex } = lines[i]!
        setTtsProgress(Math.min(92, Math.round(4 + ((i + 0.3) / lines.length) * 88)))

        const url = await synthesizeTtsLine({
          fullVoiceId: voiceId,
          text,
          style,
          speed,
        })
        audioUrls.push(url)
      }

      const { blobUrl, totalDurationSec, lineDurationsSec } = await mergeAudioUrlsToWavBlobUrl(audioUrls, {
        trimSilence: true,
      })

      lines.forEach(({ text, sceneIndex, displayLines }, i) => {
        measured.push({
          text,
          sceneIndex,
          durationSec: lineDurationsSec[i] ?? 0.5,
          displayLines,
        })
      })

      const cues = buildVoiceLineCues(measured)

      setVoiceLineCues(cues)
      if (fetchedTtsUrlRef.current) {
        URL.revokeObjectURL(fetchedTtsUrlRef.current)
        fetchedTtsUrlRef.current = null
      }
      fetchedTtsUrlRef.current = blobUrl
      setAudioUrl(blobUrl)
      setAudioDuration(totalDurationSec)
      try {
        const wavRes = await fetch(blobUrl)
        const wavBlob = await wavRes.blob()
        ttsBlobRef.current = wavBlob
        if (projectId && result.jobId && wavBlob.size >= 512) {
          await saveMvpTtsAudio(projectId, result.jobId, wavBlob)
          setEditTtsCachedJobId(result.jobId)
        }
      } catch {
        ttsBlobRef.current = null
      }
      setAudioPlayhead(0)
      setPlayhead(0)
      setAudioKey((k) => k + 1)
      setTtsProgress(100)
      setTtsGeneratedSpeed(speed)
      if (opts?.speed != null && Math.abs(opts.speed - speechSpeed) > 0.01) {
        setSpeechSpeed(speed)
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "TTS 생성 실패")
      setTtsProgress(0)
    } finally {
      setTtsLoading(false)
    }
  }, [segments, getSceneText, selectedVoiceId, supertoneStyle, speechSpeed, projectId, result.jobId])

  const handleAddThumbnail = useCallback(
    (entry: {
      url: string
      source: MvpThumbnailVariant["source"]
      hookingText?: MvpThumbnailHookingText
      studioDesign?: MvpThumbnailVariant["studioDesign"]
    }) => {
      const { gallery, selectedId } = appendThumbnailVariant(thumbnailGallery, entry)
      setThumbnailGallery(gallery)
      setSelectedThumbnailId(selectedId)
      setThumbnailIntroOn(true)
      if (entry.hookingText?.line1?.trim() || entry.hookingText?.line2?.trim()) {
        setThumbnailHookingText(entry.hookingText)
      }
    },
    [thumbnailGallery]
  )

  const handleSelectThumbnail = useCallback(
    (id: string) => {
      setSelectedThumbnailId(id)
      const variant = thumbnailGallery.find((v) => v.id === id)
      if (variant?.hookingText?.line1?.trim() || variant?.hookingText?.line2?.trim()) {
        setThumbnailHookingText(variant.hookingText)
      }
    },
    [thumbnailGallery]
  )

  const handleRemoveThumbnail = useCallback(
    (id: string) => {
      const { gallery, selectedId } = removeThumbnailVariant(
        thumbnailGallery,
        id,
        selectedThumbnailId
      )
      setThumbnailGallery(gallery)
      setSelectedThumbnailId(selectedId)
    },
    [thumbnailGallery, selectedThumbnailId]
  )

  if (!segments.length && !resolvedVideoUrl && !result.downloadUrl) return null

  const ttsReady = Boolean(audioUrl && voiceLineCues?.length)

  const ttsNeedsRegen = useMemo(() => {
    if (!voiceLineCues?.length || !segments.length) return false
    const lastCue = voiceLineCues[voiceLineCues.length - 1]!
    const lastSeg = segments[segments.length - 1]!
    const { endSec } = videoRangeFromVoiceCue(lastCue, segments, voiceLineCues)
    return endSec < lastSeg.end - 0.4
  }, [voiceLineCues, segments])

  const speedNeedsRegen = useMemo(() => {
    if (ttsGeneratedSpeed == null || !audioUrl) return false
    return Math.abs(ttsGeneratedSpeed - speechSpeed) > 0.01
  }, [ttsGeneratedSpeed, speechSpeed, audioUrl])

  const studioPhase = normalizeStudioPhase(phase)

  return (
    <div className="space-y-4">
      <MvpStudioStepNav phase={phase} onPhaseChange={setPhase} ttsReady={ttsReady} />

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
          result={result}
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
          result={result}
          videoUrl={resolvedVideoUrl}
          audioUrl={audioUrl}
          ttsBlobRef={ttsBlobRef}
          voiceLineCues={voiceLineCues}
          sceneText={(i) => getSceneText(i)}
          voiceId={selectedVoiceId}
          voiceStyle={supertoneStyle}
          videoDurationSec={videoDuration || totalSec}
          audioDurationSec={audioDuration}
          scriptStyle={scriptStyle}
          segments={segments}
          lineSchedule={lineSchedule}
          subtitleStyle={subtitleStyle}
          placedOverlays={placedOverlays}
          thumbnailUrl={thumbnailUrl || undefined}
          thumbnailIntroOn={thumbnailIntroOn}
          bgmClips={bgmClips}
        />
      ) : null}

      {studioPhase === "edit" ? (
        <MvpCapCutEditor
          result={result}
          segments={segments}
          baseSegments={baseSegments}
          segmentVisualHints={segmentVisualHints}
          scriptOverrides={scriptOverrides}
          onScriptOverride={(sceneId, text) => updateOverride(sceneId, text)}
          onScriptOverrideBlur={(sceneId, text) => {
            const cleaned = sanitizeNarrationForOutput(text)
            if (cleaned !== text.trim()) updateOverride(sceneId, cleaned)
          }}
          scriptGenerating={scriptGenerating}
          scriptNeedsAi={scriptNeedsAi}
          ttsNeedsRegen={ttsNeedsRegen}
          speechSpeed={speechSpeed}
          onSpeechSpeedChange={setSpeechSpeed}
          speedNeedsRegen={speedNeedsRegen}
          onGenerateScript={() => void generateNarrationScript()}
          onRewriteScript={() => void generateNarrationScript({ rewrite: true })}
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
          onSeek={(t) => {
            pausePreview()
            const seekT = Math.max(0, t)
            setPlayhead(seekT)
            syncVideoToPlayhead(seekT)
            audioLayersRef.current?.onSeek(seekT)
            if (audioUrl && seekT < MVP_THUMBNAIL_INTRO_SEC) {
              const a = audioRef.current
              if (a) a.currentTime = 0
              setAudioPlayhead(0)
            }
          }}
          onVideoLoaded={setVideoDuration}
          onVideoTimeUpdate={handleVideoTimeUpdate}
          onVideoEnded={() => {
            if (!audioUrl) pausePreview()
          }}
          onVideoPlay={() => {
            if (videoRef.current) videoRef.current.playbackRate = 1
          }}
          onAudioLoaded={setAudioDuration}
          onAudioTimeUpdate={handleAudioTimeUpdate}
          onAudioEnded={pausePreview}
          onPlaySceneOnly={playSceneOnly}
          activeScene={activeScene}
          onClose={onClose}
          onNext={() => setPhase("script-style")}
        />
      ) : null}
    </div>
  )
}
