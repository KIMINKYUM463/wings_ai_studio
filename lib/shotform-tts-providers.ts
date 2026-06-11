import {
  SUPERTONE_VOICE_PREVIEW_TEXT,
  defaultStyleForSupertoneVoice,
  labelSupertoneStyle,
  parseSupertoneVoiceId,
  shotformSupertoneKey,
  stylesForSupertoneVoice,
  supertoneVoiceKey,
  type ShotformSupertoneVoice,
} from "@/lib/shotform-factory-tts"
import { clampTtsSpeed } from "@/lib/shotform-tts-speed"

export { shotformSupertoneKey } from "@/lib/shotform-factory-tts"

export type TtsProviderId = "supertone" | "elevenlabs" | "typecast"

export type ShotformTtsVoice = {
  voice_id: string
  name: string
  thumbnail_image_url?: string
  styles?: string[]
}

export const TTS_PROVIDER_ORDER: TtsProviderId[] = ["supertone", "elevenlabs", "typecast"]

export const TTS_PROVIDER_META: Record<
  TtsProviderId,
  { label: string; prefix: string; idPlaceholder: string; subtitle: string }
> = {
  supertone: {
    label: "수퍼톤",
    prefix: "supertone-",
    idPlaceholder: "수퍼톤 voice ID",
    subtitle: "한국어 나레이션 · 스타일(톤) 선택",
  },
  elevenlabs: {
    label: "ElevenLabs",
    prefix: "elevenlabs-",
    idPlaceholder: "jB1Cifc2UQbq1gR3wnb0",
    subtitle: "다국어 · 쇼핑숏폼 추천 음성 5종",
  },
  typecast: {
    label: "타입캐스트",
    prefix: "typecast-",
    idPlaceholder: "tc_672c5f5ce59fac2a48faeaee",
    subtitle: "한국어 캐릭터 · 감정 프리셋",
  },
}

/** 쇼핑숏폼(shopping/page.tsx)과 동일한 ElevenLabs 추천 음성 */
export const ELEVENLABS_SAMPLE_VOICES = [
  { id: "jB1Cifc2UQbq1gR3wnb0", name: "Rachel" },
  { id: "8jHHF8rMqMlg8if2mOUe", name: "Voice 2" },
  { id: "uyVNoMrnUku1dZyVEXwD", name: "Voice 3" },
  { id: "1KNqBv4TutQtzSIACsMC", name: "Voice 4" },
  { id: "4JJwo477JUAx3HV0T7n7", name: "Voice 5" },
] as const

export const ELEVENLABS_DEFAULT_VOICE_ID = ELEVENLABS_SAMPLE_VOICES[0]!.id

export function elevenlabsSampleVoiceCatalog(): ShotformTtsVoice[] {
  return ELEVENLABS_SAMPLE_VOICES.map((v) => ({
    voice_id: v.id,
    name: v.name,
  }))
}

/** ElevenLabs는 샘플 목록이 항상 있어 API 자동 로드가 필요 없음 */
export function shouldAutoLoadVoiceCatalog(provider: TtsProviderId, voices: readonly ShotformTtsVoice[]): boolean {
  if (provider === "elevenlabs") return false
  return voices.length === 0
}

export function mergeElevenlabsVoiceCatalog(apiVoices: ShotformTtsVoice[]): ShotformTtsVoice[] {
  const samples = elevenlabsSampleVoiceCatalog()
  if (!apiVoices.length) return samples
  const seen = new Set(apiVoices.map((v) => v.voice_id))
  return [...apiVoices, ...samples.filter((s) => !seen.has(s.voice_id))]
}

export const TTS_VOICE_PREVIEW_TEXT = SUPERTONE_VOICE_PREVIEW_TEXT
export const SHORT_VOICE_PREVIEW_TEXT = "안녕하세요"
/** 타입캐스트·수퍼톤 미리듣기 — 짧은 샘플만 재생 */
export const TYPECAST_VOICE_PREVIEW_TEXT = SHORT_VOICE_PREVIEW_TEXT

export function ttsPreviewTextForProvider(provider: TtsProviderId): string {
  if (provider === "typecast") return TYPECAST_VOICE_PREVIEW_TEXT
  if (provider === "supertone") return SHORT_VOICE_PREVIEW_TEXT
  return TTS_VOICE_PREVIEW_TEXT
}

export function shotformElevenlabsKey(): string {
  if (typeof window === "undefined") return ""
  return (localStorage.getItem("elevenlabs_api_key") || localStorage.getItem("shotform_elevenlabs_api_key") || "").trim()
}

export function shotformTypecastKey(): string {
  if (typeof window === "undefined") return ""
  return (localStorage.getItem("typecast_api_key") || localStorage.getItem("shotform_typecast_api_key") || "").trim()
}

export function ttsProviderFromVoiceId(fullId: string): TtsProviderId | null {
  if (fullId.startsWith("supertone-")) return "supertone"
  if (fullId.startsWith("elevenlabs-")) return "elevenlabs"
  if (fullId.startsWith("typecast-")) return "typecast"
  return null
}

export function buildTtsVoiceKey(provider: TtsProviderId, bareId: string): string {
  const id = bareId.trim()
  const prefix = TTS_PROVIDER_META[provider].prefix
  return id.startsWith(prefix) ? id : `${prefix}${id}`
}

export function parseBareVoiceId(fullId: string): { provider: TtsProviderId; bareId: string } | null {
  const provider = ttsProviderFromVoiceId(fullId)
  if (!provider) return null
  return { provider, bareId: fullId.slice(TTS_PROVIDER_META[provider].prefix.length) }
}

export function providerLabelFromVoiceId(fullId: string): string {
  const p = ttsProviderFromVoiceId(fullId)
  return p ? TTS_PROVIDER_META[p].label : "TTS"
}

export function customTtsVoiceLabel(provider: TtsProviderId, fullId: string): ShotformTtsVoice {
  const bare = parseBareVoiceId(fullId)?.bareId ?? fullId
  return {
    voice_id: bare,
    name: `직접 입력 · ${bare.length > 14 ? `${bare.slice(0, 14)}…` : bare}`,
  }
}

export function isCatalogVoice(
  fullId: string,
  voices: readonly ShotformTtsVoice[],
  provider: TtsProviderId
): boolean {
  const key = buildTtsVoiceKey(provider, parseBareVoiceId(fullId)?.bareId ?? fullId)
  return voices.some((v) => buildTtsVoiceKey(provider, v.voice_id) === key)
}

export function resolveTtsVoiceDisplay(
  fullId: string,
  catalog: Partial<Record<TtsProviderId, readonly ShotformTtsVoice[]>>
): ShotformTtsVoice | null {
  const parsed = parseBareVoiceId(fullId)
  if (!parsed) return null
  const voices = catalog[parsed.provider] ?? []
  const key = buildTtsVoiceKey(parsed.provider, parsed.bareId)
  const found =
    voices.find((v) => buildTtsVoiceKey(parsed.provider, v.voice_id) === key) ??
    voices.find((v) => v.voice_id === parsed.bareId)
  return found ?? customTtsVoiceLabel(parsed.provider, fullId)
}

export function stylesForTtsVoice(provider: TtsProviderId, voice: ShotformTtsVoice | null): string[] {
  if (provider === "supertone" && voice) {
    return stylesForSupertoneVoice(voice as ShotformSupertoneVoice)
  }
  if (provider === "typecast") {
    if (voice?.styles?.length) return voice.styles
    return ["normal", "happy", "sad", "angry", "whisper"]
  }
  return []
}

export function labelTtsStyle(provider: TtsProviderId, style: string): string {
  if (provider === "supertone") return labelSupertoneStyle(style)
  const typecastLabels: Record<string, string> = {
    smart: "스마트",
    normal: "보통",
    neutral: "중립",
    happy: "밝은",
    sad: "차분",
    angry: "강한",
    whisper: "속삭임",
    toneup: "톤업",
    tonedown: "톤다운",
  }
  if (provider === "typecast") return typecastLabels[style.toLowerCase()] ?? style
  return style
}

export function defaultStyleForTtsVoice(provider: TtsProviderId, voice: ShotformTtsVoice | null): string {
  if (provider === "supertone" && voice) {
    return defaultStyleForSupertoneVoice(voice as ShotformSupertoneVoice)
  }
  if (provider === "typecast") {
    const styles = stylesForTtsVoice(provider, voice)
    if (styles.includes("normal")) return "normal"
    if (styles.includes("smart")) return "smart"
    return styles[0] ?? "normal"
  }
  return ""
}

export function shotformTtsApiKey(provider: TtsProviderId): string {
  if (provider === "supertone") return shotformSupertoneKey()
  if (provider === "elevenlabs") return shotformElevenlabsKey()
  return shotformTypecastKey()
}

export function ttsApiKeyMissingMessage(provider: TtsProviderId): string {
  const names: Record<TtsProviderId, string> = {
    supertone: "수퍼톤(supertone_api_key)",
    elevenlabs: "ElevenLabs(elevenlabs_api_key)",
    typecast: "타입캐스트(typecast_api_key)",
  }
  return `ShotForm 설정에 ${names[provider]} API 키를 저장해 주세요.`
}

export function isElevenlabsVoicesReadError(raw: string, code?: string): boolean {
  return code === "voices_read_missing" || /voices_read|missing the permission/.test(raw)
}

/** 목소리 목록 API 실패 메시지 — 전역 오류 대신 탭 안내용으로 짧게 표시 */
export function formatVoiceLoadError(provider: TtsProviderId, raw: string): string {
  const label = TTS_PROVIDER_META[provider].label
  if (provider === "elevenlabs" && isElevenlabsVoicesReadError(raw)) {
    return ""
  }
  if (/API 키가 필요|키를 저장/.test(raw)) {
    return ttsApiKeyMissingMessage(provider)
  }
  const firstLine = raw.split("\n").find((l) => l.trim())?.trim() ?? raw.trim()
  if (!firstLine) return `${label} 목소리 목록을 불러오지 못했습니다.`
  return firstLine.length > 160 ? `${firstLine.slice(0, 157)}…` : firstLine
}

export function normalizeElevenlabsVoiceRow(raw: Record<string, unknown>): ShotformTtsVoice {
  return {
    voice_id: String(raw.id ?? raw.voice_id ?? ""),
    name: String(raw.name ?? "목소리"),
    thumbnail_image_url: String(raw.preview_url ?? "").trim() || undefined,
  }
}

export function extractTypecastVoiceRows(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) {
    return raw.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
  }
  if (!raw || typeof raw !== "object") return []
  const obj = raw as Record<string, unknown>
  for (const key of ["voices", "data", "items", "results"]) {
    const nested = obj[key]
    if (Array.isArray(nested)) {
      return nested.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    }
  }
  return []
}

export function normalizeTypecastVoiceRow(raw: Record<string, unknown>): ShotformTtsVoice | null {
  const voice_id = String(raw.voice_id ?? raw.id ?? "").trim()
  if (!voice_id) return null
  const name = String(raw.voice_name ?? raw.name ?? voice_id)
  const models = Array.isArray(raw.models) ? raw.models : []
  const emotions = new Set<string>()
  for (const m of models) {
    if (!m || typeof m !== "object") continue
    const row = m as Record<string, unknown>
    const version = String(row.version ?? "")
    if (version && version !== "ssfm-v30") continue
    const em = row.emotions
    if (Array.isArray(em)) em.forEach((e) => emotions.add(String(e)))
  }
  if (!emotions.size) {
    for (const m of models) {
      if (!m || typeof m !== "object") continue
      const em = (m as Record<string, unknown>).emotions
      if (Array.isArray(em)) em.forEach((e) => emotions.add(String(e)))
    }
  }
  const thumb = String(
    raw.image_url ?? raw.thumbnail_url ?? raw.avatar_url ?? raw.profile_image_url ?? ""
  ).trim()
  return {
    voice_id,
    name,
    thumbnail_image_url: thumb || undefined,
    styles: emotions.size ? [...emotions] : ["normal", "happy", "sad", "angry"],
  }
}

function audioUrlFromTtsResponse(data: {
  audioUrl?: string
  audioBase64?: string
  mime?: string
}): string | null {
  if (data.audioUrl) return data.audioUrl
  if (data.audioBase64) {
    const mime = data.mime ?? "audio/wav"
    return `data:${mime};base64,${data.audioBase64}`
  }
  return null
}

/** 한 줄 TTS 합성 → blob/data URL (speed는 각 TTS API voice_settings / audio_tempo로 적용) */
export async function synthesizeTtsLine(args: {
  fullVoiceId: string
  text: string
  style?: string
  speed?: number
}): Promise<string> {
  const parsed = parseBareVoiceId(args.fullVoiceId)
  if (!parsed) throw new Error("목소리 형식이 올바르지 않습니다.")

  const speed = clampTtsSpeed(args.speed ?? 1)
  const apiKey = shotformTtsApiKey(parsed.provider)
  if (!apiKey) throw new Error(ttsApiKeyMissingMessage(parsed.provider))

  if (parsed.provider === "supertone") {
    const res = await fetch("/api/supertone-tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: args.text,
        voiceId: parsed.bareId,
        apiKey,
        style: args.style || "neutral",
        language: "ko",
        speed,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean
      audioUrl?: string
      audioBase64?: string
      error?: string
    }
    if (!res.ok || data.success === false) throw new Error(data.error || `수퍼톤 TTS 실패 (${res.status})`)
    const url = audioUrlFromTtsResponse({ ...data, mime: "audio/wav" })
    if (!url) throw new Error("수퍼톤 오디오 응답이 비어 있습니다.")
    return url
  }

  if (parsed.provider === "elevenlabs") {
    const res = await fetch("/api/elevenlabs-tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: args.text,
        voiceId: parsed.bareId,
        apiKey,
        speed,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean
      audioUrl?: string
      audioBase64?: string
      error?: string
    }
    if (!res.ok || data.success === false) throw new Error(data.error || `ElevenLabs TTS 실패 (${res.status})`)
    const url = audioUrlFromTtsResponse({ ...data, mime: "audio/mpeg" })
    if (!url) throw new Error("ElevenLabs 오디오 응답이 비어 있습니다.")
    return url
  }

  const res = await fetch("/api/typecast-tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: args.text,
      voiceId: parsed.bareId,
      apiKey,
      emotion: args.style || "smart",
      speed,
    }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean
    audioUrl?: string
    audioBase64?: string
    error?: string
  }
  if (!res.ok || data.success === false) throw new Error(data.error || `타입캐스트 TTS 실패 (${res.status})`)
  const url = audioUrlFromTtsResponse({ ...data, mime: "audio/wav" })
  if (!url) throw new Error("타입캐스트 오디오 응답이 비어 있습니다.")
  return url
}

export async function synthesizeTtsPreview(
  fullVoiceId: string,
  style?: string,
  speed?: number
): Promise<string> {
  const parsed = parseBareVoiceId(fullVoiceId)
  return synthesizeTtsLine({
    fullVoiceId,
    text: parsed ? ttsPreviewTextForProvider(parsed.provider) : TTS_VOICE_PREVIEW_TEXT,
    style,
    speed,
  })
}
