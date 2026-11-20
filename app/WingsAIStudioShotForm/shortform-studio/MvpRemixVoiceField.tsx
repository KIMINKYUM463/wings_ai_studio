"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { MvpVoicePickerDialog } from "./MvpVoicePickerDialog"
import {
  DEFAULT_TTS_PROVIDER,
  TTS_PROVIDER_META,
  adamVoiceCatalog,
  buildTtsVoiceKey,
  defaultStyleForTtsVoice,
  elevenlabsSampleVoiceCatalog,
  isRetiredSupertoneVoiceId,
  mergeElevenlabsVoiceCatalog,
  normalizeElevenlabsVoiceRow,
  normalizeTypecastVoiceRow,
  parseBareVoiceId,
  shotformTtsApiKey,
  supertonicBuiltinVoiceCatalog,
  synthesizeTtsPreview,
  ttsApiKeyMissingMessage,
  ttsProviderFromVoiceId,
  type ShotformTtsVoice,
  type TtsProviderId,
} from "@/lib/shotform-tts-providers"
import { labelTtsSpeed, normalizeTtsSpeed, TTS_SPEED_OPTIONS } from "@/lib/shotform-tts-speed"
import { labelSupertonicVoice } from "@/lib/supertonic-local"
import { fetchSupertonicVoices } from "@/lib/supertonic-runtime-client"

export const REMIX_VOICE_STORAGE_KEY = "shotform_remix_voice"

export type RemixVoiceSelection = {
  voiceId: string
  style: string
  speed: number
}

const EMPTY_CATALOG = (): Record<TtsProviderId, ShotformTtsVoice[]> => ({
  typecast: [],
  supertonic: supertonicBuiltinVoiceCatalog(),
  elevenlabs: elevenlabsSampleVoiceCatalog(),
  adam: adamVoiceCatalog(),
})

export function readSavedRemixVoice(): RemixVoiceSelection {
  if (typeof window === "undefined") return { voiceId: "", style: "", speed: 1.1 }
  try {
    const raw = localStorage.getItem(REMIX_VOICE_STORAGE_KEY)
    if (!raw) return { voiceId: "", style: "", speed: 1.1 }
    const saved = JSON.parse(raw) as Partial<RemixVoiceSelection>
    const voiceId = typeof saved.voiceId === "string" ? saved.voiceId : ""
    return {
      voiceId: isRetiredSupertoneVoiceId(voiceId) ? "" : voiceId,
      style: typeof saved.style === "string" ? saved.style : "",
      speed: normalizeTtsSpeed(saved.speed),
    }
  } catch {
    return { voiceId: "", style: "", speed: 1.1 }
  }
}

function voiceLabel(voiceId: string, catalog: Record<TtsProviderId, ShotformTtsVoice[]>): string {
  const parsed = parseBareVoiceId(voiceId)
  if (!parsed) return "모델을 고르고 목소리를 선택하세요"
  const row = catalog[parsed.provider]?.find(
    (voice) => buildTtsVoiceKey(parsed.provider, voice.voice_id) === voiceId || voice.voice_id === parsed.bareId
  )
  const name = row?.name || parsed.bareId
  return `${TTS_PROVIDER_META[parsed.provider].label} · ${name}`
}

export function MvpRemixVoiceField({
  disabled,
  value,
  onChange,
  tone = "dark",
  preferredProvider,
  autoOpen = false,
  geminiTab,
}: {
  disabled?: boolean
  value: RemixVoiceSelection
  onChange: (next: RemixVoiceSelection) => void
  tone?: "dark" | "light"
  /** 아직 고른 목소리가 없을 때 먼저 보여줄 제공사 */
  preferredProvider?: TtsProviderId
  /** 처음 그려질 때 선택 창을 바로 연다 */
  autoOpen?: boolean
  /** 선택 창에 제미나이 탭을 더한다 (썰·리믹스 v2) */
  geminiTab?: import("./MvpVoicePickerDialog").GeminiTab
}) {
  const [open, setOpen] = useState(autoOpen)
  // 적용 버튼이 목소리·스타일을 연달아 바꾼다 → 두 번째 변경이 예전 값(빈 목소리)으로 덮어쓰지 않게 최신 값을 이어서 쓴다
  const latest = useRef(value)
  latest.current = value
  const emit = (next: typeof value) => {
    latest.current = next
    onChange(next)
  }
  const [catalog, setCatalog] = useState(EMPTY_CATALOG)
  const [loading, setLoading] = useState<Record<TtsProviderId, boolean>>({
    typecast: false,
    supertonic: false,
    elevenlabs: false,
    adam: false,
  })
  const [errors, setErrors] = useState<Record<TtsProviderId, string | null>>({
    typecast: null,
    supertonic: null,
    elevenlabs: null,
    adam: null,
  })
  const [previewing, setPreviewing] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState("")

  const load = useCallback(async (provider: TtsProviderId) => {
    if (provider === "adam") {
      setCatalog((prev) => ({ ...prev, adam: adamVoiceCatalog() }))
      return
    }
    if (provider === "supertonic") {
      setLoading((prev) => ({ ...prev, supertonic: true }))
      try {
        const res = await fetchSupertonicVoices()
        const data = (await res.json().catch(() => ({}))) as {
          voices?: Array<{ voice_id?: string; name?: string; gender?: string }>
        }
        const list = (data.voices ?? [])
          .filter((voice) => voice.voice_id)
          .map((voice) => {
            const meta = labelSupertonicVoice(String(voice.voice_id))
            return {
              voice_id: String(voice.voice_id),
              name: voice.name?.trim() || meta.name,
              gender: voice.gender || meta.gender,
            }
          })
        setCatalog((prev) => ({
          ...prev,
          supertonic: list.length ? list : supertonicBuiltinVoiceCatalog(),
        }))
        setErrors((prev) => ({ ...prev, supertonic: null }))
      } catch {
        setCatalog((prev) => ({ ...prev, supertonic: supertonicBuiltinVoiceCatalog() }))
        setErrors((prev) => ({ ...prev, supertonic: ttsApiKeyMissingMessage("supertonic") }))
      } finally {
        setLoading((prev) => ({ ...prev, supertonic: false }))
      }
      return
    }

    const key = shotformTtsApiKey(provider)
    if (!key) {
      setErrors((prev) => ({ ...prev, [provider]: ttsApiKeyMissingMessage(provider) }))
      if (provider === "elevenlabs") {
        setCatalog((prev) => ({ ...prev, elevenlabs: elevenlabsSampleVoiceCatalog() }))
      }
      return
    }
    setLoading((prev) => ({ ...prev, [provider]: true }))
    try {
      const endpoint =
        provider === "elevenlabs"
          ? `/api/elevenlabs-voices?apiKey=${encodeURIComponent(key)}`
          : `/api/typecast-voices?apiKey=${encodeURIComponent(key)}`
      const res = await fetch(endpoint)
      const data = (await res.json().catch(() => ({}))) as { voices?: unknown[]; error?: string }
      if (!res.ok) throw new Error(data.error || "목소리 목록을 불러오지 못했습니다.")
      const raw = Array.isArray(data.voices) ? data.voices : []
      const list =
        provider === "elevenlabs"
          ? mergeElevenlabsVoiceCatalog(
              raw
                .map((row) => normalizeElevenlabsVoiceRow(row as Record<string, unknown>))
                .filter((row) => row.voice_id)
            )
          : raw
              .map((row) => normalizeTypecastVoiceRow(row as Record<string, unknown>))
              .filter((row): row is ShotformTtsVoice => Boolean(row))
      setCatalog((prev) => ({ ...prev, [provider]: list }))
      setErrors((prev) => ({ ...prev, [provider]: null }))
    } catch (e) {
      if (provider === "elevenlabs") {
        setCatalog((prev) => ({ ...prev, elevenlabs: elevenlabsSampleVoiceCatalog() }))
        setErrors((prev) => ({ ...prev, elevenlabs: null }))
      } else {
        setErrors((prev) => ({
          ...prev,
          typecast: e instanceof Error ? e.message : "타입캐스트 목소리 목록 실패",
        }))
      }
    } finally {
      setLoading((prev) => ({ ...prev, [provider]: false }))
    }
  }, [])

  useEffect(() => {
    const provider = ttsProviderFromVoiceId(value.voiceId) ?? preferredProvider ?? DEFAULT_TTS_PROVIDER
    void load(provider)
  }, [load, value.voiceId, preferredProvider])

  const preview = useCallback(
    async (voiceId: string, style: string) => {
      setPreviewing(voiceId)
      setPreviewError("")
      try {
        const url = await synthesizeTtsPreview(voiceId, style, value.speed)
        const audio = new Audio(url)
        audio.onended = () => setPreviewing(null)
        await audio.play()
      } catch (e) {
        setPreviewing(null)
        setPreviewError(e instanceof Error && e.message ? e.message : "미리듣기를 만들지 못했어요. API 키와 목소리를 확인해 주세요.")
      }
    },
    [value.speed]
  )

  const light = tone === "light"

  return (
    <div
      className={cn(
        "rounded-xl border px-3.5 py-3",
        light ? "border-[#d5deea] bg-[#eef2f7]/65" : "border-white/10 bg-black/30 px-3 py-2.5"
      )}
    >
      <p className={cn("mb-2 text-xs font-medium", light ? "text-[#5d6b80]" : "text-slate-400")}>목소리</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn(
            "h-9 text-xs font-semibold",
            light
              ? "border-[#d5deea] bg-white text-[#1c2433] hover:bg-slate-50"
              : "h-8 border-white/15 bg-transparent text-slate-100"
          )}
          onClick={() => setOpen(true)}
        >
          <Volume2 className="mr-1.5 h-3.5 w-3.5" />
          {voiceLabel(value.voiceId, catalog)}
        </Button>
        <div className="flex flex-wrap gap-1">
          {TTS_SPEED_OPTIONS.map((speed) => (
            <button
              key={speed}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...value, speed })}
              className={cn(
                "rounded-md px-2 py-1 text-xs tabular-nums transition-colors",
                value.speed === speed
                  ? light
                    ? "bg-[#f0a020] font-semibold text-[#2a1c00]"
                    : "bg-violet-500/30 text-violet-100"
                  : light
                    ? "text-[#5d6b80] hover:bg-white hover:text-[#1c2433]"
                    : "text-slate-500 hover:text-slate-300"
              )}
            >
              {labelTtsSpeed(speed)}
            </button>
          ))}
        </div>
      </div>
      <p className={cn("mt-1.5 text-[11px]", light ? "text-[#5d6b80]" : "mt-1.5 text-[10px] text-slate-500")}>
        타입캐스트, 수퍼토닉3, ElevenLabs, 아담 중에서 고릅니다. 이 목소리 길이에 맞춰 장면을 자릅니다.
      </p>
      <MvpVoicePickerDialog
        open={open}
        onOpenChange={setOpen}
        initialProvider={preferredProvider ?? ttsProviderFromVoiceId(value.voiceId) ?? DEFAULT_TTS_PROVIDER}
        voiceCatalog={catalog}
        voicesLoading={loading}
        voiceLoadErrors={errors}
        selectedVoiceId={value.voiceId}
        voiceStyle={value.style}
        onVoiceIdChange={(voiceId) => {
          const provider = ttsProviderFromVoiceId(voiceId)
          const parsed = parseBareVoiceId(voiceId)
          const row =
            provider && parsed
              ? catalog[provider]?.find((voice) => voice.voice_id === parsed.bareId) ?? null
              : null
          emit({
            ...latest.current,
            voiceId,
            style: provider ? defaultStyleForTtsVoice(provider, row) : latest.current.style,
          })
        }}
        onStyleChange={(style) => emit({ ...latest.current, style })}
        onReloadVoices={(provider) => void load(provider)}
        onPreviewVoice={(voiceId, style) => void preview(voiceId, style)}
        previewingVoiceId={previewing}
        previewError={previewError}
        geminiTab={geminiTab}
      />
    </div>
  )
}
