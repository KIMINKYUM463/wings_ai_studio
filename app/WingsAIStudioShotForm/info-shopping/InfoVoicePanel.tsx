"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Globe2,
  Loader2,
  Mic2,
  Pause,
  Play,
  Radio,
  Sparkles,
  UserRound,
  Volume2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { SUPERTONIC_BUILTIN_VOICES } from "@/lib/supertonic-local"
import {
  fetchSupertonicTts,
  fetchSupertonicVoices,
} from "@/lib/supertonic-runtime-client"
import { SupertonicSetupBar } from "../components/SupertonicSetupBar"
import { TypecastApiErrorNotice } from "@/components/TypecastApiGuideCard"
import { getInfoSlideTtsLines } from "./InfoCardFrame"
import {
  groupInfoTtsLines,
  hardenInfoTtsAudioUrl,
  INFO_TTS_CHAIN_TAIL_SKIP_SEC,
  playInfoTtsBuffer,
} from "./info-tts-audio"
import {
  INFO_SLIDE_LABELS,
  type InfoShoppingBrief,
  type InfoVoiceTrack,
} from "./info-types"

type Provider = "supertone" | "supertonic" | "typecast" | "elevenlabs"
type CatalogVoice = {
  voice_id: string
  name: string
  styles?: string[]
  gender?: string
}

const ELEVEN_PRESETS: CatalogVoice[] = [
  { voice_id: "jB1Cifc2UQbq1gR3wnb0", name: "Rachel", gender: "female" },
  { voice_id: "8jHHF8rMqMlg8if2mOUe", name: "Voice 2", gender: "female" },
  { voice_id: "uyVNoMrnUku1dZyVEXwD", name: "Voice 3", gender: "female" },
]

const PROVIDERS: Array<{ id: Provider; title: string; icon: typeof Radio }> = [
  { id: "supertone", title: "SuperTone", icon: Radio },
  { id: "supertonic", title: "Supertonic 3", icon: Sparkles },
  { id: "typecast", title: "타입캐스트", icon: UserRound },
  { id: "elevenlabs", title: "ElevenLabs", icon: Globe2 },
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

export function InfoVoicePanel({
  brief,
  onChange,
  onContinue,
}: {
  brief: InfoShoppingBrief
  onChange: (brief: InfoShoppingBrief) => void
  onContinue: () => void
}) {
  const initialVoiceId = normalizeVoiceId(brief.voiceData?.voiceId)
  const [provider, setProvider] = useState<Provider>(
    brief.voiceData?.provider || providerFromVoiceId(initialVoiceId)
  )
  const [selectedVoiceId, setSelectedVoiceId] = useState(initialVoiceId)
  const [speed, setSpeed] = useState(brief.voiceData?.speed || 1.15)
  const [style, setStyle] = useState(brief.voiceData?.style || "normal")
  const [supertoneVoices, setSupertoneVoices] = useState<CatalogVoice[]>([])
  const [supertonicVoices, setSupertonicVoices] = useState<CatalogVoice[]>(
    SUPERTONIC_BUILTIN_VOICES.map((voice) => ({ ...voice }))
  )
  const [typecastVoices, setTypecastVoices] = useState<CatalogVoice[]>([])
  const [isLoadingVoices, setIsLoadingVoices] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState("")
  const [error, setError] = useState("")
  /** "all" | slideId — 재생 중인 항목 */
  const [playingKey, setPlayingKey] = useState<string | null>(null)
  /** 전체/개별 재생 중 현재 슬라이드·문장 인덱스 */
  const [activeSlideId, setActiveSlideId] = useState<string | null>(null)
  const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null)
  const playGenRef = useRef(0)
  const playStopRef = useRef<(() => void) | null>(null)

  const slides = brief.generatedCards?.slides || []
  const tracks = brief.voiceData?.tracks || []

  const voices = useMemo(() => {
    if (provider === "supertone") return supertoneVoices
    if (provider === "supertonic") return supertonicVoices
    if (provider === "typecast") return typecastVoices
    return ELEVEN_PRESETS
  }, [provider, supertoneVoices, typecastVoices, supertonicVoices])

  useEffect(() => {
    if (provider === "supertonic") void loadSupertonicVoices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(
    () => () => {
      playGenRef.current += 1
      playStopRef.current?.()
      playStopRef.current = null
    },
    []
  )

  const stopListening = () => {
    playGenRef.current += 1
    playStopRef.current?.()
    playStopRef.current = null
    setPlayingKey(null)
    setActiveSlideId(null)
    setActiveLineIndex(null)
  }

  const scriptLinesForSlide = (slideId: string) => {
    const slide = slides.find((item) => item.id === slideId)
    const track = tracks.find((item) => item.slideId === slideId)
    if (track?.lineTracks?.length) {
      return track.lineTracks.map((line) => line.text).filter(Boolean)
    }
    return slide ? getInfoSlideTtsLines(slide) : []
  }

  const urlsForTrack = (track: InfoVoiceTrack): string[] => {
    if (track.lineTracks?.length) {
      return track.lineTracks.map((line) => line.audioUrl).filter(Boolean)
    }
    return track.audioUrl ? [track.audioUrl] : []
  }

  /**
   * 묶음 TTS 재생.
   * chainNext=true 이면 끝 무음 패딩을 건너뛰어 다음 구간/장면으로 바로 이어짐.
   */
  const playTrackLines = async (
    track: InfoVoiceTrack,
    gen: number,
    options?: { chainNext?: boolean }
  ) => {
    const lineTracks = track.lineTracks?.length
      ? track.lineTracks
      : track.audioUrl
        ? [{ lineIndex: 0, text: "", audioUrl: track.audioUrl }]
        : []
    const audioIndexes = lineTracks
      .map((entry, index) => (entry.audioUrl ? index : -1))
      .filter((index) => index >= 0)
    for (let ai = 0; ai < audioIndexes.length; ai += 1) {
      if (gen !== playGenRef.current) return
      const i = audioIndexes[ai]!
      const entry = lineTracks[i]!
      let end = i
      while (end + 1 < lineTracks.length && !lineTracks[end + 1]!.audioUrl) {
        end += 1
      }
      const hasMoreInTrack = ai < audioIndexes.length - 1
      const skipTail =
        options?.chainNext || hasMoreInTrack ? INFO_TTS_CHAIN_TAIL_SKIP_SEC : 0
      setActiveLineIndex(i)
      playStopRef.current?.()
      const span = end - i + 1
      const handle = playInfoTtsBuffer(entry.audioUrl, {
        isCancelled: () => gen !== playGenRef.current,
        skipTailSec: skipTail,
        onTick: (localSec, durationSec) => {
          if (durationSec <= 0.05 || span <= 1) {
            setActiveLineIndex(i)
            return
          }
          const ratio = Math.min(0.999, Math.max(0, localSec / durationSec))
          setActiveLineIndex(Math.min(end, i + Math.floor(ratio * span)))
        },
      })
      playStopRef.current = handle.stop
      try {
        await handle.done
      } finally {
        if (playStopRef.current === handle.stop) playStopRef.current = null
      }
      if (gen !== playGenRef.current) return
      setActiveLineIndex(end)
    }
  }

  const listenSlide = async (slideId: string) => {
    if (playingKey === slideId) {
      stopListening()
      return
    }
    const track = tracks.find((item) => item.slideId === slideId)
    if (!track || !urlsForTrack(track).length) {
      setError("이 슬라이드 음성이 없습니다. 먼저 TTS를 생성해주세요.")
      return
    }
    stopListening()
    const gen = playGenRef.current
    setPlayingKey(slideId)
    setActiveSlideId(slideId)
    setError("")
    try {
      await playTrackLines(track, gen)
    } catch (reason) {
      if (gen === playGenRef.current) {
        setError(reason instanceof Error ? reason.message : "재생 실패")
      }
    } finally {
      if (gen === playGenRef.current) {
        setPlayingKey(null)
        setActiveSlideId(null)
        setActiveLineIndex(null)
      }
    }
  }

  const listenAll = async () => {
    if (playingKey === "all") {
      stopListening()
      return
    }
    if (!tracks.length) {
      setError("먼저 전체 TTS를 생성해주세요.")
      return
    }
    stopListening()
    const gen = playGenRef.current
    setPlayingKey("all")
    setError("")
    try {
      for (let slideIndex = 0; slideIndex < slides.length; slideIndex += 1) {
        const slide = slides[slideIndex]!
        const track = tracks.find((item) => item.slideId === slide.id)
        if (!track || !urlsForTrack(track).length) continue
        if (gen !== playGenRef.current) return
        setActiveSlideId(slide.id)
        // 다음 장면이 있으면 끝 무음 스킵 → 장면 사이 공백 제거
        const hasNextSlide = slides
          .slice(slideIndex + 1)
          .some((s) => {
            const t = tracks.find((item) => item.slideId === s.id)
            return Boolean(t && urlsForTrack(t).length)
          })
        await playTrackLines(track, gen, { chainNext: hasNextSlide })
        if (gen !== playGenRef.current) return
      }
    } catch (reason) {
      if (gen === playGenRef.current) {
        setError(reason instanceof Error ? reason.message : "재생 실패")
      }
    } finally {
      if (gen === playGenRef.current) {
        setPlayingKey(null)
        setActiveSlideId(null)
        setActiveLineIndex(null)
      }
    }
  }

  const loadSupertoneVoices = async () => {
    const apiKey = (localStorage.getItem("shotform_supertone_api_key") || "").trim()
    if (!apiKey) {
      setError("SuperTone API 키가 필요합니다.")
      return
    }
    setIsLoadingVoices(true)
    try {
      const response = await fetch(`/api/supertone-voices?apiKey=${encodeURIComponent(apiKey)}`)
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "목록 실패")
      const nextVoices = (payload.voices || []) as CatalogVoice[]
      setSupertoneVoices(nextVoices)
      if (nextVoices[0]) setSelectedVoiceId(`supertone-${nextVoices[0].voice_id}`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "음성 목록 실패")
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
      setError("타입캐스트 API 키가 필요합니다.")
      return
    }
    setIsLoadingVoices(true)
    try {
      const response = await fetch(`/api/typecast-voices?apiKey=${encodeURIComponent(apiKey)}`)
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "목록 실패")
      const nextVoices = (payload.voices || []) as CatalogVoice[]
      setTypecastVoices(nextVoices)
      if (nextVoices[0]) setSelectedVoiceId(`typecast-${nextVoices[0].voice_id}`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "음성 목록 실패")
    } finally {
      setIsLoadingVoices(false)
    }
  }

  const loadSupertonicVoices = async () => {
    try {
      const response = await fetchSupertonicVoices()
      const payload = await response.json()
      const fromServer = Array.isArray(payload.voices) ? payload.voices : []
      const merged: CatalogVoice[] = SUPERTONIC_BUILTIN_VOICES.map((v) => ({ ...v }))
      for (const voice of fromServer as CatalogVoice[]) {
        if (!merged.some((item) => item.voice_id === voice.voice_id)) merged.push(voice)
      }
      setSupertonicVoices(merged)
    } catch {
      // keep builtins
    }
  }

  const selectProvider = (next: Provider) => {
    setProvider(next)
    setError("")
    if (next === "supertonic") {
      setSelectedVoiceId(`supertonic-${supertonicVoices[0]?.voice_id || "F1"}`)
      void loadSupertonicVoices()
    } else if (next === "elevenlabs") {
      setSelectedVoiceId(`elevenlabs-${ELEVEN_PRESETS[0].voice_id}`)
    } else if (next === "supertone") {
      if (supertoneVoices[0]) setSelectedVoiceId(`supertone-${supertoneVoices[0].voice_id}`)
      else void loadSupertoneVoices()
    } else {
      if (typecastVoices[0]) setSelectedVoiceId(`typecast-${typecastVoices[0].voice_id}`)
      else void loadTypecastVoices()
    }
  }

  const resolveSpeed = (voiceId: string) => {
    if (voiceId.startsWith("elevenlabs-")) return Math.min(1.5, Math.max(0.8, speed))
    return Math.min(2, Math.max(0.5, speed))
  }

  const requestTts = async (
    text: string,
    voiceId = selectedVoiceId,
    speedOverride?: number
  ) => {
    const bareId = voiceId.replace(/^(supertone|supertonic|typecast|elevenlabs)-/, "")
    const ttsSpeed =
      typeof speedOverride === "number" && Number.isFinite(speedOverride)
        ? speedOverride
        : resolveSpeed(voiceId)
    let endpoint = ""
    let body: Record<string, unknown> = { text, voiceId: bareId, speed: ttsSpeed }

    if (voiceId.startsWith("supertonic-")) {
      endpoint = "/api/supertonic-tts"
      body = { ...body, lang: "ko" }
    } else if (voiceId.startsWith("supertone-")) {
      const apiKey = (localStorage.getItem("shotform_supertone_api_key") || "").trim()
      if (!apiKey) throw new Error("SuperTone API 키가 필요합니다.")
      endpoint = "/api/supertone-tts"
      body = { ...body, apiKey, style: style || "neutral", language: "ko" }
    } else if (voiceId.startsWith("typecast-")) {
      const apiKey = (
        localStorage.getItem("shotform_typecast_api_key") ||
        localStorage.getItem("typecast_api_key") ||
        ""
      ).trim()
      if (!apiKey) throw new Error("타입캐스트 API 키가 필요합니다.")
      endpoint = "/api/typecast-tts"
      body = { ...body, apiKey, emotion: style || "normal" }
    } else {
      const apiKey = (localStorage.getItem("shotform_elevenlabs_api_key") || "").trim()
      if (!apiKey) throw new Error("ElevenLabs API 키가 필요합니다.")
      endpoint = "/api/elevenlabs-tts"
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
    if (!response.ok) throw new Error(payload.error || "TTS 실패")
    const rawUrl = payload.audioUrl
      ? String(payload.audioUrl)
      : payload.audioBase64
        ? `data:audio/wav;base64,${payload.audioBase64}`
        : ""
    if (!rawUrl) throw new Error("오디오가 없습니다.")

    try {
      return await hardenInfoTtsAudioUrl(rawUrl)
    } catch {
      return rawUrl
    }
  }

  const generate = async () => {
    if (!slides.length) return
    setIsGenerating(true)
    setError("")
    const tracks: InfoVoiceTrack[] = []
    try {
      for (let index = 0; index < slides.length; index += 1) {
        const slide = slides[index]
        // 본문만 TTS — 「첫째」 없이 내용만
        const lines = getInfoSlideTtsLines(slide)
        if (!lines.length) {
          throw new Error(`${index + 1}번 슬라이드에 읽을 문구가 없습니다.`)
        }
        // 짧은 연결 문장은 묶어서 한 번에 생성 (조각 TTS가 말꼬리 잘리는 경우 방지)
        const groups = groupInfoTtsLines(lines)
        const lineTracks: NonNullable<InfoVoiceTrack["lineTracks"]> = lines.map(
          (text, lineIndex) => ({
            lineIndex,
            text,
            audioUrl: "",
          })
        )
        for (let g = 0; g < groups.length; g += 1) {
          const group = groups[g]!
          setProgress(
            `슬라이드 ${index + 1}/${slides.length} · 구간 ${g + 1}/${groups.length}`
          )
          // 짧은 조각은 속도를 살짝 낮춰 엔진이 끝음까지 합성하도록
          const shortGroup = group.text.replace(/\s/g, "").length <= 22
          const audioUrl = await requestTts(
            group.text,
            selectedVoiceId,
            shortGroup ? Math.min(resolveSpeed(selectedVoiceId), 1.05) : undefined
          )
          // 그룹 첫 줄에만 오디오 — 재생 시 빈 URL은 건너뜀
          const first = group.lineIndexes[0]!
          lineTracks[first] = {
            ...lineTracks[first]!,
            audioUrl,
            text: lines[first]!,
          }
        }
        tracks.push({
          slideId: slide.id,
          audioUrl: lineTracks.find((t) => t.audioUrl)?.audioUrl || "",
          lineTracks,
        })
      }
      onChange({
        ...brief,
        voiceData: {
          voiceId: selectedVoiceId,
          provider,
          style,
          speed: resolveSpeed(selectedVoiceId),
          tracks,
          generatedAt: new Date().toISOString(),
        },
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "TTS 생성 실패")
    } finally {
      setIsGenerating(false)
      setProgress("")
    }
  }

  if (!slides.length) {
    return (
      <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
        먼저 카드 대본을 생성해주세요.
      </p>
    )
  }

  return (
    <section className="space-y-6">
      <div className="rounded-[28px] border border-white/[0.08] bg-[#11100e]/95 p-6 md:p-8">
        <p className="text-[10px] font-black tracking-[0.2em] text-sky-400">STEP 04 · VOICE</p>
        <h2 className="mt-2 text-3xl font-black text-white">AI 음성</h2>
        <p className="mt-2 text-sm text-zinc-400">
          본문만 TTS로 만듭니다. 연결형(~는데/~고)은 끊김 없이 읽고, 줄 사이 간격도 짧게 맞춰
          둡니다. 말꼬리는 잘리지 않도록 끝 여유를 둡니다. 재생 시 한 줄마다 뽁 효과음이 납니다.
          이미 만든 음성이 끊기면 <span className="text-zinc-200">전체 TTS 생성</span>을 다시
          해주세요.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PROVIDERS.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectProvider(item.id)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left ${
                  provider === item.id
                    ? "border-sky-400 bg-sky-500/15 text-white"
                    : "border-white/10 bg-white/[0.03] text-zinc-400"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-sm font-semibold">{item.title}</span>
              </button>
            )
          })}
        </div>

        {provider === "supertonic" ? (
          <div className="mt-4">
            <SupertonicSetupBar
              disabled={isGenerating}
              onReady={(info) => {
                if (info.online) void loadSupertonicVoices()
              }}
            />
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          {(provider === "supertone" || provider === "typecast") && !voices.length ? (
            <Button
              type="button"
              variant="secondary"
              disabled={isLoadingVoices}
              onClick={() =>
                void (provider === "supertone" ? loadSupertoneVoices() : loadTypecastVoices())
              }
            >
              {isLoadingVoices ? <Loader2 className="h-4 w-4 animate-spin" /> : "음성 목록 불러오기"}
            </Button>
          ) : null}
          {voices.map((voice) => {
            const fullId = `${provider}-${voice.voice_id}`
            return (
              <button
                key={fullId}
                type="button"
                onClick={() => setSelectedVoiceId(fullId)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  selectedVoiceId === fullId
                    ? "bg-sky-500 text-white"
                    : "bg-white/5 text-zinc-400 hover:bg-white/10"
                }`}
              >
                {voice.name}
              </button>
            )
          })}
        </div>

        <div className="mt-5 max-w-md">
          <Label className="text-zinc-400">속도 {speed.toFixed(2)}</Label>
          <Slider
            value={[speed]}
            min={0.8}
            max={1.4}
            step={0.05}
            onValueChange={(value) => setSpeed(value[0] || 1)}
            className="mt-2"
          />
        </div>

        {provider === "typecast" ? (
          <div className="mt-4 max-w-xs">
            <Label className="text-zinc-400">감정</Label>
            <Input
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="mt-1 border-white/10 bg-black/40 text-white"
              placeholder="normal"
            />
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            type="button"
            disabled={isGenerating}
            onClick={() => void generate()}
            className="bg-sky-500 font-bold text-white hover:bg-sky-400"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {progress || "생성 중…"}
              </>
            ) : (
              <>
                <Mic2 className="mr-2 h-4 w-4" />
                전체 TTS 생성
              </>
            )}
          </Button>
          {tracks.length ? (
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={isGenerating}
                onClick={() => void listenAll()}
                className="bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
              >
                {playingKey === "all" ? (
                  <>
                    <Pause className="mr-2 h-4 w-4" />
                    재생 중지
                  </>
                ) : (
                  <>
                    <Volume2 className="mr-2 h-4 w-4" />
                    전체 들어보기
                  </>
                )}
              </Button>
              <Button type="button" onClick={onContinue} className="font-semibold">
                <Play className="mr-2 h-4 w-4" />
                미리보기로
              </Button>
            </>
          ) : null}
        </div>

        {tracks.length ? (
          <div className="mt-5 space-y-3">
            <p className="flex items-center gap-2 text-sm text-emerald-300">
              <Volume2 className="h-4 w-4" />
              {tracks.length}개 슬라이드 음성 준비됨 · 아래에서 바로 들어보세요
              {playingKey === "all" && activeSlideId ? (
                <span className="ml-1 rounded-full bg-emerald-500/25 px-2 py-0.5 text-[11px] font-semibold text-emerald-100">
                  재생 중 ·{" "}
                  {String(
                    slides.findIndex((s) => s.id === activeSlideId) + 1
                  ).padStart(2, "0")}
                  번 장면
                  {activeLineIndex != null ? ` · ${activeLineIndex + 1}문장` : ""}
                </span>
              ) : null}
            </p>
            <div className="space-y-2">
              {slides.map((slide, index) => {
                const track = tracks.find((item) => item.slideId === slide.id)
                const ready = Boolean(track && urlsForTrack(track).length)
                const scriptLines = scriptLinesForSlide(slide.id)
                const isActiveSlide = activeSlideId === slide.id
                const isPlayingThis =
                  playingKey === slide.id || (playingKey === "all" && isActiveSlide)
                return (
                  <div
                    key={slide.id}
                    className={`rounded-xl border px-3 py-2.5 transition ${
                      isPlayingThis
                        ? "border-emerald-400/60 bg-emerald-500/15 ring-1 ring-emerald-400/30"
                        : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-white">
                            {String(index + 1).padStart(2, "0")} ·{" "}
                            {INFO_SLIDE_LABELS[slide.type]}
                          </p>
                          {isPlayingThis ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
                              <Volume2 className="h-3 w-3 animate-pulse" />
                              재생 중
                              {activeLineIndex != null
                                ? ` · ${activeLineIndex + 1}/${Math.max(1, scriptLines.length)}`
                                : ""}
                            </span>
                          ) : null}
                        </div>
                        <p className="truncate text-xs text-zinc-500">
                          {ready
                            ? `${urlsForTrack(track!).length}문장 · ${slide.title}`
                            : "음성 없음"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!ready || isGenerating}
                        className="border-white/15 bg-transparent text-zinc-100"
                        onClick={() => void listenSlide(slide.id)}
                      >
                        {playingKey === slide.id ? (
                          <>
                            <Pause className="mr-1.5 h-3.5 w-3.5" />
                            중지
                          </>
                        ) : (
                          <>
                            <Play className="mr-1.5 h-3.5 w-3.5" />
                            들어보기
                          </>
                        )}
                      </Button>
                    </div>
                    {scriptLines.length ? (
                      <ol className="mt-2 space-y-1 border-t border-white/10 pt-2">
                        {scriptLines.map((line, lineIndex) => {
                          const isActiveLine =
                            isPlayingThis && activeLineIndex === lineIndex
                          return (
                            <li
                              key={`${slide.id}-line-${lineIndex}`}
                              className={`rounded-md px-2 py-1 text-[12px] leading-relaxed ${
                                isActiveLine
                                  ? "bg-emerald-400/20 font-medium text-emerald-50"
                                  : "text-zinc-400"
                              }`}
                            >
                              <span className="mr-1.5 font-mono text-[10px] text-zinc-500">
                                {lineIndex + 1}.
                              </span>
                              {line}
                            </li>
                          )
                        })}
                      </ol>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        <TypecastApiErrorNotice message={error} />
      </div>
    </section>
  )
}
