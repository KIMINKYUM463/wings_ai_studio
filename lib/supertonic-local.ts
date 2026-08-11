/** 로컬 Supertonic HTTP 서버 (기본 127.0.0.1:7788) */

export function getSupertonicBaseUrl(): string {
  const fromEnv =
    (typeof process !== "undefined" &&
      (process.env.SUPERTONIC_BASE_URL || process.env.NEXT_PUBLIC_SUPERTONIC_BASE_URL)) ||
    ""
  return (fromEnv || "http://127.0.0.1:7788").replace(/\/$/, "")
}

/** 기본 내장 보이스 M1–M5 / F1–F5 */
export const SUPERTONIC_BUILTIN_VOICES = [
  { voice_id: "F1", name: "F1 · 여성1", gender: "female" as const },
  { voice_id: "F2", name: "F2 · 여성2", gender: "female" as const },
  { voice_id: "F3", name: "F3 · 여성3", gender: "female" as const },
  { voice_id: "F4", name: "F4 · 여성4", gender: "female" as const },
  { voice_id: "F5", name: "F5 · 여성5", gender: "female" as const },
  { voice_id: "M1", name: "M1 · 남성1", gender: "male" as const },
  { voice_id: "M2", name: "M2 · 남성2", gender: "male" as const },
  { voice_id: "M3", name: "M3 · 남성3", gender: "male" as const },
  { voice_id: "M4", name: "M4 · 남성4", gender: "male" as const },
  { voice_id: "M5", name: "M5 · 남성5", gender: "male" as const },
] as const

/** Voice Builder로 추가한 커스텀 보이스 표시명 (ASCII id → 한국어 라벨) */
export const SUPERTONIC_CUSTOM_VOICE_META: Record<
  string,
  { name: string; gender: "female" | "male" }
> = {
  yeoseong1: { name: "여자목소리1", gender: "female" },
  namseong1: { name: "남자목소리1", gender: "male" },
  dasom: { name: "다솜", gender: "female" },
}

/**
 * UI/목록에서 잠시 숨길 보이스 id (파일·서버 등록은 유지).
 * 다시 쓰려면 여기서 제거하면 됩니다.
 */
export const SUPERTONIC_HIDDEN_VOICE_IDS = new Set<string>([
  "namseong1", // 남자목소리1 — 일단 비표시
  "voice_1784370002793", // 여성 커스텀 — 일단 비표시
])

export function isSupertonicVoiceHidden(voiceId: string): boolean {
  return SUPERTONIC_HIDDEN_VOICE_IDS.has(voiceId.trim())
}

export const SUPERTONIC_VOICE_PREFIX = "supertonic-"

export function parseSupertonicVoiceId(fullId: string): string | null {
  if (!fullId.startsWith(SUPERTONIC_VOICE_PREFIX)) return null
  return fullId.slice(SUPERTONIC_VOICE_PREFIX.length).trim() || null
}

export function buildSupertonicVoiceId(bareId: string): string {
  const id = bareId.trim()
  return id.startsWith(SUPERTONIC_VOICE_PREFIX) ? id : `${SUPERTONIC_VOICE_PREFIX}${id}`
}

export function labelSupertonicVoice(
  voiceId: string,
  kind?: string
): { name: string; gender?: "female" | "male"; custom: boolean } {
  const id = voiceId.trim()
  const builtin = SUPERTONIC_BUILTIN_VOICES.find((v) => v.voice_id === id)
  if (builtin) return { name: builtin.name, gender: builtin.gender, custom: false }
  const custom = SUPERTONIC_CUSTOM_VOICE_META[id]
  if (custom) return { ...custom, custom: true }

  // 학습 녹음: n1 → 내1 (두 글자)
  const recorded = /^n(\d{1,3})$/i.exec(id)
  if (recorded) {
    return { name: `내${recorded[1]}`, gender: undefined, custom: true }
  }

  const gender: "female" | "male" | undefined = /^F/i.test(id)
    ? "female"
    : /^M/i.test(id)
      ? "male"
      : /여|female|yeo|woman/i.test(id)
        ? "female"
        : /남|male|nam|man/i.test(id)
          ? "male"
          : undefined
  const customFlag = kind === "custom" || Boolean(custom)
  // 긴 id는 잘리지 않게 짧게 (myvoice_날짜 → 내*)
  if (/^myvoice_/i.test(id)) {
    return { name: "내*", gender, custom: true }
  }
  return {
    name: customFlag ? id : id,
    gender,
    custom: customFlag,
  }
}
