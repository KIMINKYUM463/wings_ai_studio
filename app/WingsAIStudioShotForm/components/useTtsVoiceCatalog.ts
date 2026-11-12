"use client"

import { useCallback, useRef, useState } from "react"
import {
  elevenlabsSampleVoiceCatalog,
  enrichTypecastVoice,
  formatVoiceLoadError,
  isElevenlabsVoicesReadError,
  mergeElevenlabsVoiceCatalog,
  normalizeElevenlabsVoiceRow,
  normalizeTypecastVoiceRow,
  shouldAutoLoadVoiceCatalog,
  shotformTtsApiKey,
  supertonicBuiltinVoiceCatalog,
  ttsApiKeyMissingMessage,
  type ShotformTtsVoice,
  type TtsProviderId,
} from "@/lib/shotform-tts-providers"
import { fetchSupertonicVoices } from "@/lib/supertonic-runtime-client"

export type TtsVoiceCatalogMap = Record<TtsProviderId, ShotformTtsVoice[]>
export type TtsVoiceLoadingMap = Record<TtsProviderId, boolean>
export type TtsVoiceErrorMap = Record<TtsProviderId, string | null>

const initialCatalog = (): TtsVoiceCatalogMap => ({
  supertonic: supertonicBuiltinVoiceCatalog(),
  elevenlabs: elevenlabsSampleVoiceCatalog(),
  typecast: [],
})

/** 엔진별(타입캐스트·수퍼토닉3·일레븐랩스) 목소리 목록 불러오기 상태 */
export function useTtsVoiceCatalog() {
  const [voiceCatalog, setVoiceCatalog] = useState<TtsVoiceCatalogMap>(initialCatalog)
  const [voicesLoading, setVoicesLoading] = useState<TtsVoiceLoadingMap>({
    supertonic: false,
    elevenlabs: false,
    typecast: false,
  })
  const [voiceLoadErrors, setVoiceLoadErrors] = useState<TtsVoiceErrorMap>({
    supertonic: null,
    elevenlabs: null,
    typecast: null,
  })
  /** 자동 로드 실패 후 빈 목록으로 재호출되는 무한 루프 방지 */
  const autoLoadAttemptedRef = useRef<Set<TtsProviderId>>(new Set())

  const loadVoices = useCallback(async (p: TtsProviderId) => {
    if (p === "supertonic") {
      setVoicesLoading((prev) => ({ ...prev, supertonic: true }))
      setVoiceLoadErrors((prev) => ({ ...prev, supertonic: null }))
      try {
        const res = await fetchSupertonicVoices()
        const data = (await res.json().catch(() => ({}))) as {
          voices?: Array<{ voice_id?: string; name?: string; gender?: string }>
        }
        const list =
          Array.isArray(data.voices) && data.voices.length
            ? data.voices
                .map((v) => ({
                  voice_id: String(v.voice_id || "").trim(),
                  name: String(v.name || v.voice_id || "Voice"),
                  gender: v.gender,
                }))
                .filter((v) => v.voice_id)
            : supertonicBuiltinVoiceCatalog()
        setVoiceCatalog((prev) => ({ ...prev, supertonic: list }))
      } catch (e) {
        setVoiceCatalog((prev) => ({
          ...prev,
          supertonic: prev.supertonic.length ? prev.supertonic : supertonicBuiltinVoiceCatalog(),
        }))
        setVoiceLoadErrors((prev) => ({
          ...prev,
          supertonic: formatVoiceLoadError(
            "supertonic",
            e instanceof Error ? e.message : "수퍼토닉3 목록 실패"
          ),
        }))
      } finally {
        autoLoadAttemptedRef.current.add("supertonic")
        setVoicesLoading((prev) => ({ ...prev, supertonic: false }))
      }
      return
    }

    if (p === "elevenlabs") {
      const key = shotformTtsApiKey("elevenlabs")
      if (!key) {
        setVoiceCatalog((prev) => ({ ...prev, elevenlabs: elevenlabsSampleVoiceCatalog() }))
        autoLoadAttemptedRef.current.add("elevenlabs")
        return
      }
      setVoicesLoading((prev) => ({ ...prev, elevenlabs: true }))
      setVoiceLoadErrors((prev) => ({ ...prev, elevenlabs: null }))
      try {
        const res = await fetch(`/api/elevenlabs-voices?apiKey=${encodeURIComponent(key)}`)
        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean
          voices?: unknown[]
          error?: string
          code?: string
        }
        if (!res.ok || data.success === false) {
          const errText = data.error || `목록 실패 (${res.status})`
          if (isElevenlabsVoicesReadError(errText, data.code)) {
            setVoiceCatalog((prev) => ({ ...prev, elevenlabs: elevenlabsSampleVoiceCatalog() }))
            return
          }
          throw new Error(errText)
        }
        const apiList = (Array.isArray(data.voices) ? data.voices : [])
          .map((v) => normalizeElevenlabsVoiceRow(v as Record<string, unknown>))
          .filter((v) => v.voice_id)
        setVoiceCatalog((prev) => ({ ...prev, elevenlabs: mergeElevenlabsVoiceCatalog(apiList) }))
      } catch (e) {
        const raw = e instanceof Error ? e.message : "ElevenLabs 목록 실패"
        setVoiceCatalog((prev) => ({ ...prev, elevenlabs: elevenlabsSampleVoiceCatalog() }))
        if (!isElevenlabsVoicesReadError(raw)) {
          setVoiceLoadErrors((prev) => ({ ...prev, elevenlabs: formatVoiceLoadError("elevenlabs", raw) }))
        }
      } finally {
        autoLoadAttemptedRef.current.add("elevenlabs")
        setVoicesLoading((prev) => ({ ...prev, elevenlabs: false }))
      }
      return
    }

    const key = shotformTtsApiKey(p)
    if (!key) {
      setVoiceLoadErrors((prev) => ({ ...prev, [p]: ttsApiKeyMissingMessage(p) }))
      autoLoadAttemptedRef.current.add(p)
      return
    }
    setVoicesLoading((prev) => ({ ...prev, [p]: true }))
    setVoiceLoadErrors((prev) => ({ ...prev, [p]: null }))
    try {
      const res = await fetch(`/api/typecast-voices?apiKey=${encodeURIComponent(key)}`)
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean
        voices?: unknown[]
        error?: string
      }
      if (!res.ok || data.success === false) {
        throw new Error(data.error || `목소리 목록 실패 (${res.status})`)
      }
      const raw = Array.isArray(data.voices) ? data.voices : []
      const list: ShotformTtsVoice[] = raw
        .map((v) => normalizeTypecastVoiceRow(v as Record<string, unknown>))
        .filter((v): v is ShotformTtsVoice => Boolean(v))
        .map(enrichTypecastVoice)
      if (!list.length) {
        setVoiceLoadErrors((prev) => ({
          ...prev,
          typecast: "타입캐스트 목소리 목록이 비어 있습니다. API 키·플랜을 확인해 주세요.",
        }))
      }
      setVoiceCatalog((prev) => ({ ...prev, [p]: list }))
    } catch (e) {
      setVoiceLoadErrors((prev) => ({
        ...prev,
        [p]: formatVoiceLoadError(p, e instanceof Error ? e.message : `${p} 목소리 목록 실패`),
      }))
    } finally {
      autoLoadAttemptedRef.current.add(p)
      setVoicesLoading((prev) => ({ ...prev, [p]: false }))
    }
  }, [])

  /**
   * 목록이 비어 있고 아직 자동 로드를 시도하지 않았을 때만 불러옵니다.
   * 수퍼토닉3는 로컬 엔진이 늦게 켜질 수 있어 `retrySupertonic`이면 재시도합니다.
   */
  const ensureVoices = useCallback(
    (p: TtsProviderId, opts?: { retrySupertonic?: boolean }) => {
      if (voiceLoadErrors[p] || voicesLoading[p]) return
      const attempted = autoLoadAttemptedRef.current.has(p)
      if (attempted && !(opts?.retrySupertonic && p === "supertonic")) return
      if (shouldAutoLoadVoiceCatalog(p, voiceCatalog[p] ?? [])) void loadVoices(p)
    },
    [loadVoices, voiceCatalog, voiceLoadErrors, voicesLoading]
  )

  /** 사용자가 직접 누른 새로고침 — 실패 이력과 무관하게 다시 불러옵니다. */
  const reloadVoices = useCallback(
    (p: TtsProviderId) => {
      autoLoadAttemptedRef.current.delete(p)
      void loadVoices(p)
    },
    [loadVoices]
  )

  return { voiceCatalog, voicesLoading, voiceLoadErrors, ensureVoices, reloadVoices }
}
