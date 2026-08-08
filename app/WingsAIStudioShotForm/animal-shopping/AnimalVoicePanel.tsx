"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Check,
  CheckCircle2,
  Globe2,
  Loader2,
  Mic2,
  PawPrint,
  Play,
  Radio,
  RefreshCw,
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

const PROVIDERS: Array<{
  id: Provider
  title: string
  blurb: string
  emoji: string
  icon: typeof Radio
}> = [
  { id: "supertone", title: "SuperTone", blurb: "쇼츠 나레이션", emoji: "📻", icon: Radio },
  { id: "supertonic", title: "Supertonic 3", blurb: "로컬 무료 TTS", emoji: "✨", icon: Sparkles },
  { id: "typecast", title: "타입캐스트", blurb: "감정·캐릭터", emoji: "🎭", icon: UserRound },
  { id: "elevenlabs", title: "ElevenLabs", blurb: "다국어 보이스", emoji: "🌍", icon: Globe2 },
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
  if (voiceId.startsWith("ttsmaker-")) return "elevenlabs-jB1Cifc2UQbq1gR3wnb0"
  if (/^[FM]\\d+$/i.test(voiceId)) return `supertonic-${voiceId}`
  return voiceId
}

function providerFromVoiceId(voiceId: string): Provider {
  if (voiceId.startsWith("supertonic-")) return "supertonic"
  if (voiceId.startsWith("supertone-")) return "supertone"
  if (voiceId.startsWith("typecast-")) return "typecast"
  return "elevenlabs"
}

export function AnimalVoicePanel({
  script,
  characterName,
  ttsAudioUrl,
  selectedVoiceId,
  selectedStyle,
  ttsSpeed,
  isGeneratingTTS,
  ttsProgress,
  onVoiceChange,
  onStyleChange,
  onSpeedChange,
  onGenerate,
  onSupertoneVoicesLoaded,
}: {
  script: string
  characterName: string
  ttsAudioUrl: string
  selectedVoiceId: string
  selectedStyle: string
  ttsSpeed: number
  isGeneratingTTS: boolean
  ttsProgress: { current: number; total: number }
  onVoiceChange: (voiceId: string) => void
  onStyleChange: (style: string) => void
  onSpeedChange: (speed: number) => void
  onGenerate: () => void
  onSupertoneVoicesLoaded?: (
    voices: Array<{
      voice_id: string
      name: string
      language: string[]
      styles: string[]
      thumbnail_image_url?: string
    }>
  ) => void
}) {
  const initialVoiceId = normalizeVoiceId(selectedVoiceId)
  const [provider, setProvider] = useState<Provider>(providerFromVoiceId(initialVoiceId))
  const [supertoneVoices, setSupertoneVoices] = useState<CatalogVoice[]>([])
  const [supertonicVoices, setSupertonicVoices] = useState<CatalogVoice[]>(
    SUPERTONIC_BUILTIN_VOICES.map((voice) => ({ ...voice }))
  )
  const [typecastVoices, setTypecastVoices] = useState<CatalogVoice[]>([])
  const [customElevenId, setCustomElevenId] = useState("")
  const [isLoadingVoices, setIsLoadingVoices] = useState(false)
  const [previewingVoiceId, setPreviewingVoiceId] = useState("")
  const [error, setError] = useState("")

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
    void loadSupertonicVoices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const normalized = normalizeVoiceId(selectedVoiceId)
    setProvider(providerFromVoiceId(normalized))
  }, [selectedVoiceId])

  const selectProvider = (nextProvider: Provider) => {
    setProvider(nextProvider)
    setError("")
    if (nextProvider === "supertonic") {
      const id = supertonicVoices[0]?.voice_id || "F1"
      onVoiceChange(`supertonic-${id}`)
      void loadSupertonicVoices()
    } else if (nextProvider === "elevenlabs") {
      onVoiceChange(`elevenlabs-${ELEVEN_PRESETS[0].voice_id}`)
    } else if (nextProvider === "supertone") {
      if (supertoneVoices[0]) {
        onVoiceChange(`supertone-${supertoneVoices[0].voice_id}`)
        onStyleChange(
          supertoneVoices[0].styles?.includes("neutral")
            ? "neutral"
            : supertoneVoices[0].styles?.[0] || "neutral"
        )
      } else {
        void loadSupertoneVoices()
      }
    } else if (typecastVoices[0]) {
      onVoiceChange(`typecast-${typecastVoices[0].voice_id}`)
      onStyleChange("normal")
    } else {
      void loadTypecastVoices()
    }
  }

  const loadSupertoneVoices = async () => {
    const apiKey = (localStorage.getItem("shotform_supertone_api_key") || "").trim()
    if (!apiKey) {
      setError("SuperTone API 키가 필요합니다. 설정에서 API 키를 등록해주세요.")
      return
    }
    setIsLoadingVoices(true)
    setError("")
    try {
      const response = await fetch(`/api/supertone-voices?apiKey=${encodeURIComponent(apiKey)}`)
      const payload = await response.json()
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || "SuperTone 음성 목록을 가져오지 못했습니다.")
      }
      const excluded = ["팽팽이A", "기억력좋은엄마", "상세한설명엄마"]
      const nextVoices = ((payload.voices || []) as CatalogVoice[]).filter(
        (voice) => !excluded.some((name) => voice.name.includes(name))
      )
      setSupertoneVoices(nextVoices)
      onSupertoneVoicesLoaded?.(
        nextVoices.map((voice) => ({
          voice_id: voice.voice_id,
          name: voice.name,
          language: [],
          styles: voice.styles || [],
          thumbnail_image_url: voice.thumbnail_image_url,
        }))
      )
      if (nextVoices[0]) {
        onVoiceChange(`supertone-${nextVoices[0].voice_id}`)
        onStyleChange(
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
        onVoiceChange(`typecast-${nextVoices[0].voice_id}`)
        onStyleChange("normal")
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "음성 목록 조회에 실패했습니다.")
    } finally {
      setIsLoadingVoices(false)
    }
  }

  const loadSupertonicVoices = async () => {
    try {
      const response = await fetchSupertonicVoices()
      const payload = await response.json()
      const fromServer = Array.isArray(payload.voices) ? payload.voices : []
      const merged: CatalogVoice[] = SUPERTONIC_BUILTIN_VOICES.map((voice) => ({ ...voice }))
      for (const voice of fromServer as CatalogVoice[]) {
        if (!merged.some((item) => item.voice_id === voice.voice_id)) merged.push(voice)
      }
      setSupertonicVoices(merged)
    } catch {
      // 내장 보이스 유지
    }
  }

  const resolveSpeed = (voiceId: string) => {
    if (voiceId.startsWith("elevenlabs-")) {
      return Math.min(1.5, Math.max(0.8, Math.round(ttsSpeed * 10) / 10))
    }
    if (voiceId.startsWith("supertonic-")) {
      return Math.min(2, Math.max(0.7, Math.round(ttsSpeed * 100) / 100))
    }
    return Math.min(2, Math.max(0.5, Math.round(ttsSpeed * 10) / 10))
  }

  const requestTts = async (text: string, voiceId: string) => {
    const bareId = voiceId.replace(/^(supertone|supertonic|typecast|elevenlabs)-/, "")
    let endpoint = ""
    let body: Record<string, unknown> = {
      text,
      voiceId: bareId,
      speed: resolveSpeed(voiceId),
    }

    if (voiceId.startsWith("supertonic-")) {
      endpoint = "/api/supertonic-tts"
      body = { ...body, lang: "ko" }
    } else if (voiceId.startsWith("supertone-")) {
      const apiKey = (localStorage.getItem("shotform_supertone_api_key") || "").trim()
      if (!apiKey) throw new Error("SuperTone API 키가 필요합니다.")
      endpoint = "/api/supertone-tts"
      body = { ...body, apiKey, style: selectedStyle || "neutral", language: "ko" }
    } else if (voiceId.startsWith("typecast-")) {
      const apiKey = (
        localStorage.getItem("shotform_typecast_api_key") ||
        localStorage.getItem("typecast_api_key") ||
        ""
      ).trim()
      if (!apiKey) throw new Error("타입캐스트 API 키가 필요합니다.")
      endpoint = "/api/typecast-tts"
      body = { ...body, apiKey, emotion: selectedStyle || "normal" }
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
    if (!response.ok) throw new Error(payload.error || payload.message || "TTS 미리듣기에 실패했습니다.")
    if (payload.audioUrl) return String(payload.audioUrl)
    if (payload.audioBase64) return `data:audio/wav;base64,${payload.audioBase64}`
    throw new Error("생성된 오디오가 없습니다.")
  }

  const previewVoice = async (voiceId: string) => {
    setPreviewingVoiceId(voiceId)
    setError("")
    try {
      const sample = `${characterName}이에요! 오늘 장본 거 진짜 귀엽지 않아?`
      const audioUrl = await requestTts(sample, voiceId)
      const audio = new Audio(audioUrl)
      audio.onended = () => setPreviewingVoiceId("")
      audio.onerror = () => setPreviewingVoiceId("")
      await audio.play()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "미리듣기에 실패했습니다.")
      setPreviewingVoiceId("")
    }
  }

  const progressRatio =
    ttsProgress.total > 0 ? Math.min(100, (ttsProgress.current / ttsProgress.total) * 100) : 0

  return (
    <div className="overflow-hidden rounded-2xl border border-[rgba(125,211,168,0.28)] bg-gradient-to-br from-[#122018] via-[#141c18] to-[#1a1520] shadow-xl">
      <div className="border-b border-[rgba(255,246,238,0.08)] px-5 py-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="animal-bubble-chip inline-flex px-2.5 py-1 text-[10px]">🎙️ PET VOICE</p>
            <h3 className="animal-display mt-2 text-xl font-bold text-[#fff6ee]">
              {characterName}의 AI 목소리
            </h3>
            <p className="mt-1 text-sm leading-6 text-[#9aa89c]">
              다른 쇼핑숏폼과 같은 음성 엔진이에요. 귀여운 친구 톤에 맞게 골라보세요.
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#ff8fab]/30 bg-[#ff8fab]/15">
            <PawPrint className="h-6 w-6 text-[#ff8fab]" />
          </div>
        </div>
      </div>

      <div className="space-y-5 px-5 py-5 md:px-6">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {PROVIDERS.map((item) => {
            const active = provider === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectProvider(item.id)}
                className={`relative shrink-0 rounded-full border px-4 py-2.5 text-left transition ${
                  active
                    ? "border-[#ff8fab]/50 bg-[#ff8fab]/20 shadow-md shadow-[#ff8fab]/15"
                    : "border-[rgba(255,246,238,0.1)] bg-black/25 hover:border-[#7dd3a8]/40"
                }`}
              >
                <span className="mr-1.5">{item.emoji}</span>
                <span className={`text-sm font-bold ${active ? "text-[#fff6ee]" : "text-[#d7e0d8]"}`}>
                  {item.title}
                </span>
                <span className="mt-0.5 block text-[10px] text-[#6b7a6e]">{item.blurb}</span>
                {active ? (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#7dd3a8] text-[#0d1a14]">
                    <Check className="h-3 w-3" />
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {provider === "supertone" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadSupertoneVoices()}
              disabled={isLoadingVoices}
              className="animal-mint-btn rounded-full border-[#7dd3a8]/30 bg-[#7dd3a8]/10 text-[#d7e0d8] hover:bg-[#7dd3a8]/20"
            >
              {isLoadingVoices ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              SuperTone 목록
            </Button>
          ) : null}
          {provider === "typecast" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadTypecastVoices()}
              disabled={isLoadingVoices}
              className="animal-mint-btn rounded-full border-[#7dd3a8]/30 bg-[#7dd3a8]/10 text-[#d7e0d8] hover:bg-[#7dd3a8]/20"
            >
              {isLoadingVoices ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              타입캐스트 목록
            </Button>
          ) : null}
          {provider === "supertonic" ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadSupertonicVoices()}
                className="animal-mint-btn rounded-full border-[#7dd3a8]/30 bg-[#7dd3a8]/10 text-[#d7e0d8] hover:bg-[#7dd3a8]/20"
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                로컬 보이스 확인
              </Button>
              <div className="w-full basis-full">
                <SupertonicSetupBar
                  onReady={(info) => {
                    if (info.online) void loadSupertonicVoices()
                  }}
                />
              </div>
            </>
          ) : null}
          {provider === "elevenlabs" ? (
            <div className="flex min-w-[240px] flex-1 gap-2">
              <Input
                value={customElevenId}
                onChange={(e) => setCustomElevenId(e.target.value)}
                placeholder="ElevenLabs 커스텀 Voice ID"
                className="h-9 border-[rgba(243,235,224,0.12)] bg-black/35 text-xs text-[#f3ebe0]"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  const id = customElevenId.trim()
                  if (id) onVoiceChange(`elevenlabs-${id}`)
                }}
                className="animal-mint-btn rounded-full border-[rgba(255,246,238,0.14)] text-[#d7e0d8]"
              >
                적용
              </Button>
            </div>
          ) : null}
        </div>

        <div className="max-h-[320px] overflow-y-auto pr-1">
          {voices.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {voices.map((voice, index) => {
                const fullId = `${provider}-${voice.voice_id}`
                const active = selectedVoiceId === fullId
                return (
                  <div
                    key={voice.voice_id}
                    className={`flex items-center gap-2 rounded-2xl border p-2.5 transition ${
                      active
                        ? "border-[#ff8fab]/45 bg-[#ff8fab]/12"
                        : "border-[rgba(255,246,238,0.08)] bg-black/20 hover:border-[#7dd3a8]/35"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onVoiceChange(fullId)
                        if (provider === "supertone") {
                          onStyleChange(
                            voice.styles?.includes("neutral")
                              ? "neutral"
                              : voice.styles?.[0] || "neutral"
                          )
                        }
                        if (provider === "typecast") {
                          onStyleChange(
                            voice.styles?.includes("normal")
                              ? "normal"
                              : voice.styles?.[0] || "normal"
                          )
                        }
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    >
                      {voice.thumbnail_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={voice.thumbnail_image_url}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
                            active
                              ? "bg-[#ff8fab]/30 text-[#fff6ee]"
                              : "bg-[#7dd3a8]/15 text-[#7dd3a8]"
                          }`}
                        >
                          {voice.gender === "male" ? "남" : voice.gender === "female" ? "여" : index + 1}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-[#f3ebe0]">
                          {voice.name}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] text-[#6b7a6e]">
                          {voice.name_en || voice.voice_id}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void previewVoice(fullId)}
                      className="rounded-xl border border-[rgba(255,246,238,0.1)] bg-black/30 p-2 text-[#9aa89c] hover:border-[#7dd3a8]/40 hover:text-[#7dd3a8]"
                      aria-label={`${voice.name} 미리듣기`}
                    >
                      {previewingVoiceId === fullId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[rgba(125,211,168,0.25)] py-10 text-center text-sm text-[#6b7a6e]">
              목록 불러오기 버튼을 눌러 음성을 가져오세요
            </div>
          )}
        </div>

        {provider === "supertone" && selectedVoice?.styles?.length ? (
          <div>
            <Label className="text-xs text-[#d7e0d8]">SuperTone 스타일</Label>
            <select
              value={selectedStyle}
              onChange={(e) => onStyleChange(e.target.value)}
              className="mt-2 h-10 w-full rounded-xl border border-[rgba(243,235,224,0.12)] bg-black/35 px-3 text-sm text-[#f3ebe0]"
            >
              {selectedVoice.styles.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {provider === "typecast" ? (
          <div>
            <Label className="text-xs text-[#d7e0d8]">타입캐스트 감정</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {TYPECAST_EMOTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onStyleChange(item.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    selectedStyle === item.id
                      ? "bg-[#ff8fab] text-white"
                      : "bg-black/30 text-[#9aa89c] hover:bg-black/45"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <div className="flex items-center justify-between">
            <Label className="text-xs text-[#d7e0d8]">말하는 속도</Label>
            <span className="text-sm font-bold text-[#7dd3a8]">{ttsSpeed.toFixed(2)}x</span>
          </div>
          <Slider
            value={[ttsSpeed]}
            min={0.7}
            max={1.5}
            step={0.05}
            onValueChange={([value]) => onSpeedChange(value ?? 1.05)}
            className="mt-3"
          />
        </div>

        {ttsProgress.total > 0 && isGeneratingTTS ? (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-[#9aa89c]">
              <span>음성 생성 중</span>
              <span>
                {ttsProgress.current} / {ttsProgress.total}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-black/40">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#7dd3a8] to-[#ff8fab] transition-all"
                style={{ width: `${progressRatio}%` }}
              />
            </div>
          </div>
        ) : null}

        {ttsAudioUrl ? (
          <div className="space-y-3 rounded-2xl border border-[#7dd3a8]/30 bg-[#7dd3a8]/10 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#7dd3a8]">
              <CheckCircle2 className="h-5 w-5" />
              {characterName} 음성 준비 완료
            </div>
            <audio controls src={ttsAudioUrl} className="w-full" preload="auto" />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[rgba(255,246,238,0.12)] bg-black/20 px-4 py-6 text-center text-sm text-[#6b7a6e]">
            음성을 만들면 여기에서 미리들을 수 있어요
          </div>
        )}

        <Button
          type="button"
          onClick={onGenerate}
          disabled={isGeneratingTTS || !script.trim()}
          className="animal-cta-cute h-12 w-full rounded-full text-base font-bold"
          size="lg"
        >
          {isGeneratingTTS ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {characterName} 목소리 만드는 중…
            </>
          ) : ttsAudioUrl ? (
            <>
              <RefreshCw className="mr-2 h-5 w-5" />
              AI 음성 다시 만들기
            </>
          ) : (
            <>
              <Mic2 className="mr-2 h-5 w-5" />
              AI 음성 생성하기
            </>
          )}
        </Button>

        {error ? (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        <p className="flex items-center justify-center gap-1.5 text-[11px] text-[#6b7a6e]">
          <Volume2 className="h-3.5 w-3.5" />
          SuperTone · Supertonic · Typecast · ElevenLabs (쇼핑쇼폼 공통 엔진)
        </p>
      </div>
    </div>
  )
}
