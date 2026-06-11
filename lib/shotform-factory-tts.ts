import { FACTORY_NARRATION_SEGMENTS } from "@/lib/shotform-factory-narration-script"

/** 나레이션 전체를 한 번에 TTS로 넘길 때 사용하는 본문(구간 사이 빈 줄). */
export function factoryNarrationTtsFullText(): string {
  return FACTORY_NARRATION_SEGMENTS.map((s) => s.text.trim()).filter(Boolean).join("\n\n")
}

/** 쇼핑 숏폼과 동일: 롱폼 키 후 ShotForm 전용 키. */
export function shotformSupertoneKey(): string {
  if (typeof window === "undefined") return ""
  return (localStorage.getItem("supertone_api_key") || localStorage.getItem("shotform_supertone_api_key") || "").trim()
}

/** 수퍼톤 목소리 미리듣기 샘플 문장 */
export const SUPERTONE_VOICE_PREVIEW_TEXT = "안녕하세요, 쇼핑 숏폼 나레이션 음성입니다."

export type ShotformSupertoneVoice = {
  voice_id: string
  name: string
  language?: string[]
  styles?: string[]
  thumbnail_image_url?: string
}

export const SUPERTONE_STYLE_LABELS: Record<string, string> = {
  neutral: "중립",
  happy: "밝은",
  sad: "차분한",
  angry: "강한",
}

export function labelSupertoneStyle(style: string): string {
  return SUPERTONE_STYLE_LABELS[style.toLowerCase()] ?? style
}

export function supertoneVoiceKey(voiceId: string): string {
  return voiceId.startsWith("supertone-") ? voiceId : `supertone-${voiceId}`
}

export function parseSupertoneVoiceId(fullId: string): string {
  return fullId.replace(/^supertone-/, "")
}

export function stylesForSupertoneVoice(voice: ShotformSupertoneVoice): string[] {
  if (voice.styles?.length) return voice.styles
  return ["neutral", "happy", "sad", "angry"]
}

export function defaultStyleForSupertoneVoice(voice: ShotformSupertoneVoice): string {
  const styles = stylesForSupertoneVoice(voice)
  const neutral = styles.find((s) => s.toLowerCase().includes("neutral") || s === "중립")
  return neutral ?? styles[0] ?? "neutral"
}

/** 캐릭터 썸네일 없을 때 아바타 배경색 */
export function voiceAvatarFallbackColor(name: string): string {
  const hues = [198, 262, 318, 158, 38, 278, 12, 220]
  let idx = 0
  for (let i = 0; i < name.length; i++) idx = (idx + name.charCodeAt(i)) % hues.length
  return `hsl(${hues[idx]}, 52%, 40%)`
}

export function customSupertoneVoiceLabel(voiceId: string): ShotformSupertoneVoice {
  const id = parseSupertoneVoiceId(voiceId) || voiceId
  return {
    voice_id: id,
    name: `직접 입력 · ${id.length > 14 ? `${id.slice(0, 14)}…` : id}`,
  }
}

export function isCatalogSupertoneVoice(
  voiceId: string,
  voices: readonly ShotformSupertoneVoice[]
): boolean {
  const key = supertoneVoiceKey(parseSupertoneVoiceId(voiceId) || voiceId)
  return voices.some((v) => supertoneVoiceKey(v.voice_id) === key)
}

export function resolveSupertoneVoiceDisplay(
  voiceId: string,
  voices: readonly ShotformSupertoneVoice[]
): ShotformSupertoneVoice | null {
  if (!voiceId?.startsWith("supertone-")) return null
  const found =
    voices.find((v) => supertoneVoiceKey(v.voice_id) === voiceId) ??
    voices.find((v) => v.voice_id === parseSupertoneVoiceId(voiceId))
  return found ?? customSupertoneVoiceLabel(voiceId)
}

export function normalizeSupertoneVoiceRow(raw: Record<string, unknown>): ShotformSupertoneVoice {
  return {
    voice_id: String(raw.voice_id ?? raw.id ?? ""),
    name: String(raw.name ?? "목소리"),
    language: Array.isArray(raw.language) ? (raw.language as string[]) : undefined,
    styles: Array.isArray(raw.styles) ? (raw.styles as string[]) : undefined,
    thumbnail_image_url: String(raw.thumbnail_image_url ?? raw.thumbnail ?? "").trim() || undefined,
  }
}

export function supertoneVoiceSupportsKorean(languages: string[] | undefined): boolean {
  if (!languages?.length) return false
  return languages.some((l) => {
    const code = String(l).toLowerCase().trim()
    return code === "ko" || code === "ko-kr" || code.startsWith("ko-") || code === "korean"
  })
}

export function filterSupertoneKoreanVoices<T extends { language?: string[] }>(voices: T[]): T[] {
  return voices.filter((v) => supertoneVoiceSupportsKorean(v.language))
}
