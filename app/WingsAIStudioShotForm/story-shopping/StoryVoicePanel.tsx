"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  AudioLines,
  Check,
  Download,
  Globe2,
  Loader2,
  Mic2,
  Play,
  Radio,
  RefreshCw,
  Sparkles,
  Upload,
  UserRound,
  Volume2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { SUPERTONIC_BUILTIN_VOICES } from "@/lib/supertonic-local"
import { ensureSupertonicReady } from "@/lib/supertonic-ensure-client"
import {
  fetchSupertonicTts,
  fetchSupertonicVoices,
} from "@/lib/supertonic-runtime-client"
import { uploadTtsBlobToStorage } from "@/lib/shotform-tts-storage-upload"
import { SupertonicSetupBar } from "../components/SupertonicSetupBar"
import { splitNarrationIntoMeaningLines } from "./StoryChannelFrame"
import { alignStoryCaptionsWithWhisper } from "./story-caption-align"
import type { StoryShoppingBrief, StoryVoiceTrack } from "./story-types"

type Provider = "supertone" | "supertonic" | "typecast" | "elevenlabs"
type CatalogVoice = {
  voice_id: string
  name: string
  name_en?: string
  styles?: string[]
  thumbnail_image_url?: string
  gender?: string
}

const ELEVEN_PRESETS: CatalogVoice[] = [
  { voice_id: "jB1Cifc2UQbq1gR3wnb0", name: "Rachel", gender: "female" },
  { voice_id: "8jHHF8rMqMlg8if2mOUe", name: "Voice 2", gender: "female" },
  { voice_id: "uyVNoMrnUku1dZyVEXwD", name: "Voice 3", gender: "female" },
  { voice_id: "1KNqBv4TutQtzSIACsMC", name: "Voice 4", gender: "male" },
  { voice_id: "4JJwo477JUAx3HV0T7n7", name: "Voice 5", gender: "male" },
]

function measureAudioDuration(audioUrl: string): Promise<number | undefined> {
  return new Promise((resolve) => {
    const audio = new Audio()
    let settled = false
    let timer = 0
    const finish = (duration?: number) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      audio.removeAttribute("src")
      audio.load()
      resolve(duration)
    }
    timer = window.setTimeout(() => finish(undefined), 15_000)
    audio.onloadedmetadata = () => {
      const duration = Number(audio.duration)
      finish(Number.isFinite(duration) && duration > 0 ? duration : undefined)
    }
    audio.onerror = () => finish(undefined)
    audio.preload = "metadata"
    audio.src = audioUrl
  })
}

function guessExtFromMime(mime: string): string {
  const m = mime.toLowerCase()
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3"
  if (m.includes("ogg")) return "ogg"
  if (m.includes("webm")) return "webm"
  if (m.includes("mp4") || m.includes("m4a")) return "m4a"
  return "wav"
}

async function audioUrlToBlob(audioUrl: string): Promise<Blob> {
  const response = await fetch(audioUrl)
  if (!response.ok) throw new Error("오디오를 불러오지 못했습니다.")
  return response.blob()
}

async function downloadAudioUrl(audioUrl: string, filename: string) {
  const blob = await audioUrlToBlob(audioUrl)
  const ext = guessExtFromMime(blob.type || "audio/wav")
  const safeName = filename.replace(/\.[^.]+$/, "") + `.${ext}`
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = objectUrl
  anchor.download = safeName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500)
}

function isEphemeralAudioUrl(url: string): boolean {
  return url.startsWith("blob:") || url.startsWith("data:")
}

const PROVIDERS: Array<{
  id: Provider
  title: string
  description: string
  icon: typeof Radio
}> = [
  {
    id: "supertone",
    title: "SuperTone",
    description: "쇼츠 나레이션용 클라우드 보이스",
    icon: Radio,
  },
  {
    id: "supertonic",
    title: "Supertonic 3",
    description: "PC 설치형 로컬 무료 TTS",
    icon: Sparkles,
  },
  {
    id: "typecast",
    title: "타입캐스트",
    description: "한국어 캐릭터와 감정 보이스",
    icon: UserRound,
  },
  {
    id: "elevenlabs",
    title: "ElevenLabs",
    description: "한국어·다국어 공유 보이스",
    icon: Globe2,
  },
]

const TYPECAST_EMOTIONS = [
  { id: "normal", label: "보통" },
  { id: "happy", label: "밝은" },
  { id: "sad", label: "차분" },
  { id: "angry", label: "강한" },
  { id: "whisper", label: "속삭임" },
  { id: "smart", label: "스마트" },
]

function normalizeVoiceId(voiceId?: string) {
  if (!voiceId) return "elevenlabs-jB1Cifc2UQbq1gR3wnb0"
  if (/^[FM]\d+$/i.test(voiceId)) return `supertonic-${voiceId}`
  return voiceId
}

function providerFromVoiceId(voiceId: string): Provider {
  if (voiceId.startsWith("supertonic-")) return "supertonic"
  if (voiceId.startsWith("supertone-")) return "supertone"
  if (voiceId.startsWith("typecast-")) return "typecast"
  return "elevenlabs"
}

export function StoryVoicePanel({
  brief,
  onChange,
  userId,
  projectId,
}: {
  brief: StoryShoppingBrief
  onChange: (brief: StoryShoppingBrief) => void
  userId?: string
  projectId?: string
}) {
  const initialVoiceId = normalizeVoiceId(brief.voiceData?.voiceId)
  const [provider, setProvider] = useState<Provider>(
    brief.voiceData?.provider || providerFromVoiceId(initialVoiceId)
  )
  const [selectedVoiceId, setSelectedVoiceId] = useState(initialVoiceId)
  const [speed, setSpeed] = useState(brief.voiceData?.speed || 1.05)
  const [style, setStyle] = useState(brief.voiceData?.style || "normal")
  const [supertoneVoices, setSupertoneVoices] = useState<CatalogVoice[]>([])
  const [supertonicVoices, setSupertonicVoices] = useState<CatalogVoice[]>(
    SUPERTONIC_BUILTIN_VOICES.map((voice) => ({ ...voice }))
  )
  const [typecastVoices, setTypecastVoices] = useState<CatalogVoice[]>([])
  const [customElevenId, setCustomElevenId] = useState("")
  const [isLoadingVoices, setIsLoadingVoices] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isTransferring, setIsTransferring] = useState(false)
  const [previewingVoiceId, setPreviewingVoiceId] = useState("")
  const [progress, setProgress] = useState("")
  const [error, setError] = useState("")
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadTargetSceneId, setUploadTargetSceneId] = useState<string | null>(null)

  const canPersistCloud = Boolean(userId && userId !== "anonymous" && projectId)

  const voices = useMemo(() => {
    if (provider === "supertone") return supertoneVoices
    if (provider === "supertonic") return supertonicVoices
    if (provider === "typecast") return typecastVoices
    return ELEVEN_PRESETS
  }, [provider, supertoneVoices, supertonicVoices, typecastVoices])

  const selectedBareId = selectedVoiceId.replace(
    /^(supertone|supertonic|typecast|elevenlabs)-/,
    ""
  )
  const selectedVoice = voices.find((voice) => voice.voice_id === selectedBareId)

  useEffect(() => {
    if (provider === "supertonic") void loadSupertonicVoices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectProvider = (nextProvider: Provider) => {
    setProvider(nextProvider)
    setError("")
    if (nextProvider === "supertone") void loadSupertoneVoices()
    if (nextProvider === "supertonic") void loadSupertonicVoices()
    if (nextProvider === "typecast") void loadTypecastVoices()
    if (nextProvider === "elevenlabs" && ELEVEN_PRESETS[0]) {
      setSelectedVoiceId(`elevenlabs-${ELEVEN_PRESETS[0].voice_id}`)
    }
  }

  const loadSupertoneVoices = async () => {
    const apiKey = (
      localStorage.getItem("shotform_supertone_api_key") ||
      localStorage.getItem("supertone_api_key") ||
      ""
    ).trim()
    if (!apiKey) {
      setError("SuperTone API 키가 필요합니다. 설정에서 API 키를 등록해주세요.")
      return
    }
    setIsLoadingVoices(true)
    setError("")
    try {
      const response = await fetch("/api/supertone-voices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "SuperTone 음성 목록을 가져오지 못했습니다.")
      const excluded = ["아동", "아이", "어린이", "키즈", "baby", "child", "kid"]
      const nextVoices = (payload.voices || []).filter(
        (voice: CatalogVoice) => !excluded.some((name) => voice.name.includes(name))
      )
      setSupertoneVoices(nextVoices)
      if (nextVoices[0]) {
        setSelectedVoiceId(`supertone-${nextVoices[0].voice_id}`)
        setStyle(
          nextVoices[0].styles?.includes("neutral")
            ? "neutral"
            : nextVoices[0].styles?.[0] || "neutral"
        )
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "음성 목록 조회에 실패했습니다.")
    } finally {
      setIsLoadingVoices(false)
    }
  }

  const loadTypecastVoices = async () => {
    const apiKey = (
      localStorage.getItem("shotform_typecast_api_key") ||
      localStorage.getItem("typecast_api_key") ||
      ""
    ).trim()
    if (!apiKey) {
      setError("타입캐스트 API 키가 필요합니다. 설정에서 API 키를 등록해주세요.")
      return
    }
    setIsLoadingVoices(true)
    setError("")
    try {
      const response = await fetch(`/api/typecast-voices?apiKey=${encodeURIComponent(apiKey)}`)
      const payload = await response.json()
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || "타입캐스트 음성 목록을 가져오지 못했습니다.")
      }
      const nextVoices = (payload.voices || []) as CatalogVoice[]
      setTypecastVoices(nextVoices)
      if (nextVoices[0]) {
        setSelectedVoiceId(`typecast-${nextVoices[0].voice_id}`)
        setStyle(
          nextVoices[0].styles?.includes("normal")
            ? "normal"
            : nextVoices[0].styles?.[0] || "normal"
        )
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "음성 목록 조회에 실패했습니다.")
    } finally {
      setIsLoadingVoices(false)
    }
  }

  const loadSupertonicVoices = async () => {
    try {
      await ensureSupertonicReady()
      const response = await fetchSupertonicVoices()
      const payload = await response.json()
      const fromServer = Array.isArray(payload.voices) ? payload.voices : []
      const merged: CatalogVoice[] = SUPERTONIC_BUILTIN_VOICES.map((voice) => ({
        ...voice,
      }))
      for (const voice of fromServer as CatalogVoice[]) {
        if (!merged.some((item) => item.voice_id === voice.voice_id)) merged.push(voice)
      }
      setSupertonicVoices(merged)
    } catch {
      // 로컬 서버가 꺼져 있어도 내장 보이스 목록은 선택할 수 있습니다.
    }
  }

  const resolveSpeed = (voiceId: string) => {
    if (voiceId.startsWith("elevenlabs-")) {
      return Math.min(1.5, Math.max(0.8, Math.round(speed * 10) / 10))
    }
    if (voiceId.startsWith("supertonic-")) {
      return Math.min(2, Math.max(0.7, Math.round(speed * 100) / 100))
    }
    return Math.min(2, Math.max(0.5, Math.round(speed * 10) / 10))
  }

  const requestTts = async (text: string, voiceId = selectedVoiceId) => {
    const bareId = voiceId.replace(/^(supertone|supertonic|typecast|elevenlabs)-/, "")
    let endpoint = ""
    let body: Record<string, unknown> = { text, voiceId: bareId, speed: resolveSpeed(voiceId) }

    if (voiceId.startsWith("supertonic-")) {
      endpoint = "/api/supertonic-tts"
      body = { ...body, voiceId: bareId }
    } else if (voiceId.startsWith("supertone-")) {
      endpoint = "/api/supertone-tts"
      const apiKey = (
        localStorage.getItem("shotform_supertone_api_key") ||
        localStorage.getItem("supertone_api_key") ||
        ""
      ).trim()
      body = { ...body, apiKey, style }
    } else if (voiceId.startsWith("typecast-")) {
      endpoint = "/api/typecast-tts"
      const apiKey = (
        localStorage.getItem("shotform_typecast_api_key") ||
        localStorage.getItem("typecast_api_key") ||
        ""
      ).trim()
      body = { ...body, apiKey, emotion: style }
    } else {
      endpoint = "/api/elevenlabs-tts"
      const apiKey = (
        localStorage.getItem("shotform_elevenlabs_api_key") ||
        localStorage.getItem("elevenlabs_api_key") ||
        ""
      ).trim()
      body = { ...body, apiKey }
    }

    const response = voiceId.startsWith("supertonic-")
      ? await fetchSupertonicTts(body)
      : await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || payload.message || "TTS 생성에 실패했습니다.")
    if (payload.audioUrl) return String(payload.audioUrl)
    if (payload.audioBase64) return `data:audio/wav;base64,${payload.audioBase64}`
    throw new Error("생성된 오디오가 없습니다.")
  }

  /** blob/data URL → Supabase 공개 URL (로그인·프로젝트 있을 때) */
  const persistAudioUrl = async (audioUrl: string, sceneLabel: string): Promise<string> => {
    if (!canPersistCloud || !userId || !projectId) return audioUrl
    if (!isEphemeralAudioUrl(audioUrl) && audioUrl.includes("supabase")) return audioUrl
    try {
      setProgress(`${sceneLabel} 클라우드에 저장 중…`)
      const blob = await audioUrlToBlob(audioUrl)
      return await uploadTtsBlobToStorage(blob, userId, projectId)
    } catch (reason) {
      console.warn("[StoryVoice] 클라우드 저장 실패, 로컬 URL 유지:", reason)
      return audioUrl
    }
  }

  const previewVoice = async (voiceId: string) => {
    setPreviewingVoiceId(voiceId)
    setError("")
    try {
      const audioUrl = await requestTts("이 목소리로 흥미로운 이야기를 들려드릴게요.", voiceId)
      const audio = new Audio(audioUrl)
      audio.onended = () => setPreviewingVoiceId("")
      audio.onerror = () => setPreviewingVoiceId("")
      await audio.play()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "미리듣기에 실패했습니다.")
      setPreviewingVoiceId("")
    }
  }

  const buildLineTracksForScene = async (
    scene: { id: string; narration: string },
    audioUrl: string,
    durationSec?: number
  ) => {
    const lines = splitNarrationIntoMeaningLines(scene.narration)
      .map((line) => line.replace(/\.{2,}|…+/g, "").trim())
      .filter(Boolean)
    const narrationLines = lines.length ? lines : [scene.narration]
    const cues = await alignStoryCaptionsWithWhisper({
      audioUrl,
      script: scene.narration,
      lines: narrationLines,
      durationSec,
    })
    const syncedDuration =
      cues[cues.length - 1]?.endSec ||
      durationSec ||
      cues.reduce((sum, cue) => sum + (cue.endSec - cue.startSec), 0)
    return {
      durationSec: syncedDuration,
      lineTracks: cues.map((cue) => ({
        lineIndex: cue.lineIndex,
        text: cue.text,
        durationSec: Math.max(0.12, cue.endSec - cue.startSec),
        startSec: cue.startSec,
        endSec: cue.endSec,
        alignmentSource: cue.alignmentSource,
      })),
    }
  }

  const generate = async () => {
    if (!brief.generatedStory) return
    setIsGenerating(true)
    setError("")
    const tracks: StoryVoiceTrack[] = []
    try {
      for (let index = 0; index < brief.generatedStory.scenes.length; index += 1) {
        const scene = brief.generatedStory.scenes[index]!
        setProgress(`장면 ${index + 1}/${brief.generatedStory.scenes.length} 통 TTS 생성 중`)
        let audioUrl = await requestTts(scene.narration)
        audioUrl = await persistAudioUrl(audioUrl, `장면 ${index + 1}`)
        const durationSec = await measureAudioDuration(audioUrl)

        setProgress(
          `장면 ${index + 1}/${brief.generatedStory.scenes.length} Whisper로 자막 싱크 분석 중…`
        )
        try {
          const aligned = await buildLineTracksForScene(scene, audioUrl, durationSec)
          tracks.push({
            sceneId: scene.id,
            audioUrl,
            durationSec: aligned.durationSec,
            lineTracks: aligned.lineTracks,
          })
        } catch (alignError) {
          throw new Error(
            alignError instanceof Error
              ? `장면 ${index + 1} 자막 싱크 실패: ${alignError.message}`
              : `장면 ${index + 1} 자막 싱크 분석에 실패했습니다.`
          )
        }
      }
      onChange({
        ...brief,
        voiceData: {
          voiceId: selectedVoiceId,
          provider,
          style,
          speed,
          tracks,
          generatedAt: new Date().toISOString(),
        },
      })
      setProgress(
        canPersistCloud
          ? "모든 장면 음성 클라우드 저장 + Whisper 싱크 완료 · 상단에서 프로젝트도 저장하세요"
          : "모든 장면 음성 + Whisper 싱크 완료 (새로고침 전에 다운로드하세요)"
      )
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "음성 생성에 실패했습니다.")
    } finally {
      setIsGenerating(false)
    }
  }

  const realignCaptionsOnly = async () => {
    if (!brief.generatedStory || !brief.voiceData?.tracks?.length) return
    setIsGenerating(true)
    setError("")
    try {
      const tracks: StoryVoiceTrack[] = []
      for (let index = 0; index < brief.generatedStory.scenes.length; index += 1) {
        const scene = brief.generatedStory.scenes[index]!
        const existing = brief.voiceData.tracks.find((item) => item.sceneId === scene.id)
        if (!existing?.audioUrl) {
          throw new Error(`장면 ${index + 1}에 TTS가 없습니다. 먼저 음성을 생성해주세요.`)
        }
        setProgress(
          `장면 ${index + 1}/${brief.generatedStory.scenes.length} Whisper 자막 싱크 재분석 중…`
        )
        const measured = await measureAudioDuration(existing.audioUrl)
        const aligned = await buildLineTracksForScene(
          scene,
          existing.audioUrl,
          measured || existing.durationSec
        )
        tracks.push({
          ...existing,
          durationSec: aligned.durationSec,
          lineTracks: aligned.lineTracks,
        })
      }
      onChange({
        ...brief,
        voiceData: {
          ...brief.voiceData,
          tracks,
          generatedAt: new Date().toISOString(),
        },
      })
      setProgress("Whisper 자막 싱크 재분석 완료")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "자막 싱크 재분석에 실패했습니다.")
    } finally {
      setIsGenerating(false)
    }
  }

  const downloadScene = async (sceneIndex: number, audioUrl: string) => {
    setIsTransferring(true)
    setError("")
    try {
      await downloadAudioUrl(audioUrl, `story-scene-${sceneIndex + 1}-tts`)
      setProgress(`장면 ${sceneIndex + 1} 음성 다운로드 완료`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "다운로드에 실패했습니다.")
    } finally {
      setIsTransferring(false)
    }
  }

  const downloadAllScenes = async () => {
    if (!brief.voiceData?.tracks?.length || !brief.generatedStory) return
    setIsTransferring(true)
    setError("")
    try {
      for (let index = 0; index < brief.generatedStory.scenes.length; index += 1) {
        const scene = brief.generatedStory.scenes[index]!
        const track = brief.voiceData.tracks.find((item) => item.sceneId === scene.id)
        if (!track?.audioUrl) continue
        setProgress(`장면 ${index + 1} 다운로드 중…`)
        await downloadAudioUrl(track.audioUrl, `story-scene-${index + 1}-tts`)
        await new Promise((resolve) => window.setTimeout(resolve, 350))
      }
      setProgress("모든 장면 음성 다운로드 완료")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "다운로드에 실패했습니다.")
    } finally {
      setIsTransferring(false)
    }
  }

  const persistAllToCloud = async () => {
    if (!canPersistCloud || !brief.voiceData?.tracks?.length || !brief.generatedStory) {
      setError("로그인된 프로젝트에서만 클라우드 저장이 가능합니다.")
      return
    }
    setIsTransferring(true)
    setError("")
    try {
      const tracks: StoryVoiceTrack[] = []
      for (let index = 0; index < brief.generatedStory.scenes.length; index += 1) {
        const scene = brief.generatedStory.scenes[index]!
        const existing = brief.voiceData.tracks.find((item) => item.sceneId === scene.id)
        if (!existing?.audioUrl) continue
        const audioUrl = await persistAudioUrl(existing.audioUrl, `장면 ${index + 1}`)
        tracks.push({ ...existing, audioUrl })
      }
      onChange({
        ...brief,
        voiceData: {
          ...brief.voiceData,
          tracks,
          generatedAt: new Date().toISOString(),
        },
      })
      setProgress("클라우드 저장 완료 · 상단에서 프로젝트도 저장해주세요")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "클라우드 저장에 실패했습니다.")
    } finally {
      setIsTransferring(false)
    }
  }

  const openUploadForScene = (sceneId: string) => {
    setUploadTargetSceneId(sceneId)
    window.setTimeout(() => uploadInputRef.current?.click(), 0)
  }

  const handleUploadFile = async (file: File | null) => {
    if (!file || !uploadTargetSceneId || !brief.generatedStory) return
    const scene = brief.generatedStory.scenes.find((item) => item.id === uploadTargetSceneId)
    if (!scene) return
    setIsTransferring(true)
    setError("")
    setProgress("업로드한 음성 처리 중…")
    try {
      let audioUrl = URL.createObjectURL(file)
      audioUrl = await persistAudioUrl(audioUrl, "업로드 음성")
      const durationSec = await measureAudioDuration(audioUrl)
      setProgress("Whisper로 자막 싱크 분석 중…")
      const aligned = await buildLineTracksForScene(scene, audioUrl, durationSec)
      const nextTrack: StoryVoiceTrack = {
        sceneId: scene.id,
        audioUrl,
        durationSec: aligned.durationSec,
        lineTracks: aligned.lineTracks,
      }
      const prevTracks = brief.voiceData?.tracks || []
      const tracks = prevTracks.some((item) => item.sceneId === scene.id)
        ? prevTracks.map((item) => (item.sceneId === scene.id ? nextTrack : item))
        : [...prevTracks, nextTrack]
      onChange({
        ...brief,
        voiceData: {
          voiceId: brief.voiceData?.voiceId || selectedVoiceId,
          provider: brief.voiceData?.provider || provider,
          style: brief.voiceData?.style || style,
          speed: brief.voiceData?.speed || speed,
          tracks,
          generatedAt: new Date().toISOString(),
        },
      })
      setProgress("업로드 + 자막 싱크 완료")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "음성 업로드에 실패했습니다.")
    } finally {
      setIsTransferring(false)
      setUploadTargetSceneId(null)
      if (uploadInputRef.current) uploadInputRef.current.value = ""
    }
  }

  if (!brief.generatedStory) {
    return <EmptyStep message="스토리 대본을 먼저 생성해주세요." />
  }

  const busy = isGenerating || isTransferring

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
      <input
        ref={uploadInputRef}
        type="file"
        accept="audio/*,.wav,.mp3,.m4a,.ogg,.webm"
        className="hidden"
        onChange={(event) => void handleUploadFile(event.target.files?.[0] || null)}
      />

      <section className="rounded-[28px] border border-cyan-400/20 bg-[#0c0e10] p-5">
        <div className="flex items-center gap-2 text-[9px] font-black tracking-[0.18em] text-cyan-300">
          <Mic2 className="h-4 w-4" />
          AI VOICE MODELS
        </div>
        <h2 className="mt-2 text-xl font-black text-white">AI 쇼핑 숏폼 음성 모델</h2>
        <p className="mt-2 text-xs leading-6 text-zinc-400">
          장면 대본을 <span className="text-cyan-200">통째로 1번</span> 읽은 뒤 Whisper로 자막을 맞춥니다.
          임시 URL은 새로고침 시 사라지니 <span className="text-cyan-200">다운로드</span>
          {canPersistCloud ? " 또는 클라우드 저장" : ""} 후, 상단에서 프로젝트를 저장하세요.
        </p>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {PROVIDERS.map((item) => {
            const Icon = item.icon
            const active = provider === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectProvider(item.id)}
                className={`rounded-2xl border p-3 text-left transition ${
                  active
                    ? "border-cyan-400/50 bg-cyan-500/10"
                    : "border-white/10 bg-black/20 hover:border-white/20"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${active ? "text-cyan-300" : "text-zinc-400"}`} />
                  <span className="text-sm font-black text-white">{item.title}</span>
                  {active ? <Check className="ml-auto h-3.5 w-3.5 text-cyan-300" /> : null}
                </div>
                <p className="mt-1 text-[10px] leading-4 text-zinc-500">{item.description}</p>
              </button>
            )
          })}
        </div>

        {provider === "supertonic" ? (
          <div className="mt-4">
            <SupertonicSetupBar
              disabled={busy}
              onReady={(info) => {
                if (info.online) void loadSupertonicVoices()
              }}
            />
          </div>
        ) : null}

        <div className="mt-5">
          <Label className="text-xs text-zinc-300">
            {provider === "supertonic" ? "로컬 보이스" : "보이스"}
            {isLoadingVoices ? " · 불러오는 중…" : ""}
          </Label>
          <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-black/25 p-2">
            {voices.map((voice) => {
              const id = `${provider}-${voice.voice_id}`
              const active = selectedVoiceId === id
              return (
                <div
                  key={voice.voice_id}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                    active ? "bg-cyan-500/15" : "hover:bg-white/5"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVoiceId(id)
                      if (provider === "supertone") {
                        setStyle(
                          voice.styles?.includes("neutral")
                            ? "neutral"
                            : voice.styles?.[0] || "neutral"
                        )
                      }
                      if (provider === "typecast") {
                        setStyle(
                          voice.styles?.includes("normal")
                            ? "normal"
                            : voice.styles?.[0] || "normal"
                        )
                      }
                    }}
                    className="min-w-0 flex-1 text-left text-xs font-bold text-zinc-200"
                  >
                    {voice.name}
                    {voice.gender ? (
                      <span className="ml-1 text-[9px] font-medium text-zinc-500">
                        · {voice.gender}
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => void previewVoice(id)}
                    disabled={Boolean(previewingVoiceId)}
                    className="rounded-md border border-white/10 p-1.5 text-zinc-400 hover:text-cyan-200"
                  >
                    {previewingVoiceId === id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              )
            })}
            {!voices.length ? (
              <p className="px-2 py-3 text-center text-[10px] text-zinc-500">
                보이스 목록이 없습니다. API 키를 확인해주세요.
              </p>
            ) : null}
          </div>
          {provider === "elevenlabs" ? (
            <div className="mt-2 flex gap-2">
              <Input
                value={customElevenId}
                onChange={(event) => setCustomElevenId(event.target.value)}
                placeholder="커스텀 ElevenLabs voice id"
                className="h-9 border-white/10 bg-black/30 text-xs"
              />
              <Button
                type="button"
                variant="outline"
                className="h-9 border-white/15"
                onClick={() => {
                  if (!customElevenId.trim()) return
                  setSelectedVoiceId(`elevenlabs-${customElevenId.trim()}`)
                }}
              >
                적용
              </Button>
            </div>
          ) : null}
          {selectedVoice ? (
            <p className="mt-2 text-[10px] text-zinc-500">선택: {selectedVoice.name}</p>
          ) : null}
        </div>

        {provider === "supertone" ? (
          <div className="mt-4">
            <Label className="text-xs text-zinc-300">SuperTone 스타일</Label>
            <Input
              value={style}
              onChange={(event) => setStyle(event.target.value)}
              className="mt-2 h-10 border-white/10 bg-black/30 text-xs"
            />
          </div>
        ) : null}

        {provider === "typecast" ? (
          <div className="mt-4">
            <Label className="text-xs text-zinc-300">타입캐스트 감정</Label>
            <select
              value={style}
              onChange={(event) => setStyle(event.target.value)}
              className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-xs text-white"
            >
              {TYPECAST_EMOTIONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="mt-5">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-zinc-200">말하기 속도</Label>
            <span className="text-xs font-black text-cyan-300">{speed.toFixed(2)}x</span>
          </div>
          <Slider
            value={[speed]}
            min={0.7}
            max={1.5}
            step={0.05}
            onValueChange={([value]) => setSpeed(value)}
            className="mt-4"
          />
        </div>

        <Button
          onClick={generate}
          disabled={busy || !selectedVoiceId}
          className="mt-6 h-11 w-full bg-cyan-500 font-black text-black hover:bg-cyan-300"
        >
          {isGenerating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : brief.voiceData ? (
            <RefreshCw className="mr-2 h-4 w-4" />
          ) : (
            <Volume2 className="mr-2 h-4 w-4" />
          )}
          {brief.voiceData ? "장면별 통 TTS + 싱크 다시 생성" : "장면별 통 TTS + 싱크 생성"}
        </Button>
        {brief.voiceData?.tracks?.length ? (
          <Button
            type="button"
            variant="outline"
            onClick={realignCaptionsOnly}
            disabled={busy}
            className="mt-2 h-10 w-full border-cyan-400/30 bg-cyan-500/5 font-bold text-cyan-100 hover:bg-cyan-500/15"
          >
            {isGenerating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            TTS 유지 · 자막 싱크만 재분석
          </Button>
        ) : null}
        {progress ? <p className="mt-3 text-center text-[10px] text-cyan-200">{progress}</p> : null}
        {error ? (
          <p className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-xs leading-5 text-red-200">
            {error}
          </p>
        ) : null}
      </section>

      <section className="rounded-[28px] border border-white/10 bg-[#0d0d0c] p-5">
        <div className="flex flex-wrap items-center gap-2">
          <AudioLines className="h-4 w-4 text-cyan-300" />
          <h3 className="text-sm font-black text-white">장면별 음성 트랙</h3>
          {brief.voiceData?.tracks?.length ? (
            <div className="ml-auto flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void downloadAllScenes()}
                className="h-8 border-white/15 bg-white/5 text-[10px] font-bold text-zinc-200"
              >
                <Download className="mr-1 h-3.5 w-3.5" />
                전체 다운로드
              </Button>
              {canPersistCloud ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void persistAllToCloud()}
                  className="h-8 border-cyan-400/30 bg-cyan-500/10 text-[10px] font-bold text-cyan-100"
                >
                  <Upload className="mr-1 h-3.5 w-3.5" />
                  클라우드 저장
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        <p className="mt-2 text-[10px] leading-4 text-zinc-500">
          장면마다 다운로드하거나, 로컬 오디오를 업로드하면 Whisper 싱크를 다시 맞춥니다.
        </p>
        <div className="mt-4 space-y-3">
          {brief.generatedStory.scenes.map((scene, index) => {
            const track = brief.voiceData?.tracks.find((item) => item.sceneId === scene.id)
            const ephemeral = track?.audioUrl ? isEphemeralAudioUrl(track.audioUrl) : false
            return (
              <div key={scene.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-xs font-black text-cyan-200">
                    {index + 1}
                  </span>
                  <p className="line-clamp-2 flex-1 text-xs leading-5 text-zinc-300">
                    {scene.narration}
                  </p>
                </div>
                {track ? (
                  <div className="mt-3 space-y-2">
                    <audio controls src={track.audioUrl} className="h-9 w-full" />
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void downloadScene(index, track.audioUrl)}
                        className="h-7 border-white/15 bg-white/5 px-2 text-[10px] font-bold text-zinc-200"
                      >
                        <Download className="mr-1 h-3 w-3" />
                        다운로드
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => openUploadForScene(scene.id)}
                        className="h-7 border-cyan-400/25 bg-cyan-500/10 px-2 text-[10px] font-bold text-cyan-100"
                      >
                        <Upload className="mr-1 h-3 w-3" />
                        업로드 교체
                      </Button>
                      {ephemeral ? (
                        <span className="text-[9px] font-bold text-amber-300/90">
                          임시 URL · 다운로드/클라우드 저장 권장
                        </span>
                      ) : (
                        <span className="text-[9px] text-zinc-500">영구 URL</span>
                      )}
                    </div>
                    <p className="text-[9px] text-zinc-500">
                      장면 통 TTS · 자막 줄은 Whisper 발화 싱크
                    </p>
                    {(track.lineTracks?.length
                      ? track.lineTracks
                      : [{ lineIndex: 0, text: scene.narration }]
                    ).map((lineTrack) => (
                      <div
                        key={`${scene.id}-${lineTrack.lineIndex}`}
                        className="rounded-xl border border-cyan-400/10 bg-cyan-500/[0.04] px-2.5 py-2"
                      >
                        <p className="text-[9px] font-bold text-cyan-200">
                          자막 {lineTrack.lineIndex + 1}
                          {typeof lineTrack.startSec === "number" &&
                          typeof lineTrack.endSec === "number"
                            ? ` · ${lineTrack.startSec.toFixed(2)}–${lineTrack.endSec.toFixed(2)}s`
                            : ""}
                          {lineTrack.alignmentSource === "whisper"
                            ? " · AI싱크"
                            : lineTrack.alignmentSource === "estimated"
                              ? " · 추정"
                              : ""}
                        </p>
                        <p className="mt-0.5 text-[10px] leading-4 text-zinc-300">{lineTrack.text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    <div className="rounded-lg border border-dashed border-white/10 py-2 text-center text-[9px] text-zinc-500">
                      음성 생성 대기
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => openUploadForScene(scene.id)}
                      className="h-7 w-full border-cyan-400/25 bg-cyan-500/10 text-[10px] font-bold text-cyan-100"
                    >
                      <Upload className="mr-1 h-3 w-3" />
                      이 장면에 음성 업로드
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function EmptyStep({ message }: { message: string }) {
  return (
    <div className="rounded-[28px] border border-dashed border-white/15 bg-white/[0.02] py-24 text-center text-sm text-zinc-400">
      {message}
    </div>
  )
}
