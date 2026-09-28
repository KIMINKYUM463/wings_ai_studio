/** 서버 Gemini·`script_by_language` 키와 동일한 출력 언어 ID */
export const THUMBNAIL_OUTPUT_LANGUAGE_OPTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'English', label: '영어' },
  { id: '日本語', label: '일본어' },
  { id: '中文(简体)', label: '중국어(간체)' },
  { id: 'Español', label: '스페인어' },
  { id: 'Tiếng Việt', label: '베트남어' },
  { id: 'Français', label: '프랑스어' },
  { id: 'Deutsch', label: '독일어' },
  { id: 'Italiano', label: '이탈리아어' },
  { id: 'Português', label: '포르투갈어' },
  { id: 'Nederlands', label: '네덜란드어' },
  { id: 'Русский', label: '러시아어' },
  { id: 'العربية', label: '아랍어' },
  { id: 'हिन्दी', label: '힌디어' },
  { id: 'Bahasa Indonesia', label: '인도네시아어' },
  { id: 'ภาษาไทย', label: '태국어' },
  { id: 'Türkçe', label: '터키어' },
  { id: 'Polski', label: '폴란드어' },
]

export const THUMBNAIL_TAB_OUTPUT_LANGUAGE_OPTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'ko', label: '한국어' },
  ...THUMBNAIL_OUTPUT_LANGUAGE_OPTIONS,
]

const VALID_OUTPUT_LANGUAGE_IDS = new Set(
  THUMBNAIL_TAB_OUTPUT_LANGUAGE_OPTIONS.map((o) => o.id),
)

export function normalizeTabOutputLanguage(raw?: string | null, fallback = 'ko'): string {
  const lang = (raw ?? fallback).trim() || fallback
  if (VALID_OUTPUT_LANGUAGE_IDS.has(lang)) return lang
  const fb = (fallback || 'ko').trim() || 'ko'
  return VALID_OUTPUT_LANGUAGE_IDS.has(fb) ? fb : 'ko'
}

export function tabOutputLanguageLabel(lang: string): string {
  const id = normalizeTabOutputLanguage(lang)
  return THUMBNAIL_TAB_OUTPUT_LANGUAGE_OPTIONS.find((o) => o.id === id)?.label ?? id
}

/** 탭 칩에 표시할 짧은 코드 */
export function tabOutputLanguageShort(lang: string): string {
  const id = normalizeTabOutputLanguage(lang)
  const shorts: Record<string, string> = {
    ko: 'KO',
    English: 'EN',
    '日本語': 'JP',
    '中文(简体)': 'ZH',
    Español: 'ES',
    'Tiếng Việt': 'VI',
    Français: 'FR',
    Deutsch: 'DE',
    Italiano: 'IT',
    Português: 'PT',
    Nederlands: 'NL',
    Русский: 'RU',
    العربية: 'AR',
    हिन्दी: 'HI',
    'Bahasa Indonesia': 'ID',
    'ภาษาไทย': 'TH',
    Türkçe: 'TR',
    Polski: 'PL',
  }
  return shorts[id] ?? id.slice(0, 2).toUpperCase()
}
