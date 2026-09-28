import { getScriptForLanguage } from '@/lib/longform-v2/thumbnail-bridge/scriptApi'

/** 썸네일 AI 문구 생성에 쓸 대본 — 선택 언어 번역본 우선, 없으면 한국어 대본 */
export function resolveScriptForThumbnailOutputLanguage(opts: {
  scriptKo?: string | null
  scriptByLanguage?: Record<string, string> | null
  outputLanguage: string
}): string {
  const lang = (opts.outputLanguage || 'ko').trim() || 'ko'
  if (lang === 'ko' || lang === '한국어') {
    return (opts.scriptKo ?? '').trim()
  }
  const translated = getScriptForLanguage(
    { script: opts.scriptKo ?? '', script_by_language: opts.scriptByLanguage ?? undefined },
    lang,
  ).trim()
  if (translated) return translated
  return (opts.scriptKo ?? '').trim()
}
