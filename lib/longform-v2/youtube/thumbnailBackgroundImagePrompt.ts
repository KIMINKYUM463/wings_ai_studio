/**
 * 썸네일 스튜디오 배경 AI — 텍스트 없는 배경 전용 (한글 자막·간판 렌더 방지)
 */

import {
  imageLocaleAutoPromptBlock,
  parseInferredRegionalLook,
  type ImageLocaleInferenceContext,
  type ImageLocaleMode,
  type ImageLocaleResolved,
} from './imageLocaleMode'

const HANGUL_RE = /[\uAC00-\uD7A3]/g

/** imagePromptEn 등에 섞인 한글·CJK 제거 */
export function sanitizeThumbnailImagePromptEn(text: string): string {
  return text
    .replace(HANGUL_RE, ' ')
    .replace(/[\u3040-\u30FF\u4E00-\u9FFF]/g, ' ')
    .replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .replace(/,\s+/g, ', ')
    .trim()
}

/** 클라이언트가 조립한 스튜디오 배경 프롬프트 — 서버 이중 래핑 방지 */
export function isPrebuiltStudioBackgroundPrompt(topic: string): boolean {
  const t = topic.trim()
  if (t.length < 80) return false
  return (
    /YOUTUBE BACKGROUND LAYOUT SPEC/i.test(t) ||
    /MANDATORY 1280x720 YouTube thumbnail BACKGROUND/i.test(t) ||
    /=== VIDEO SCRIPT & TOPIC/i.test(t) ||
    /SCRIPT-LITERAL THUMBNAIL/i.test(t) ||
    /TOPIC-DRIVEN BACKGROUND/i.test(t) ||
    /=== CTR SCENE PROMPT/i.test(t)
  )
}

/**
 * Replicate 입력용 — 한글·후킹 문구·지시문이 이미지 속 글자로 그려지는 것 방지.
 */
export function sanitizeStudioBackgroundPromptForImageModel(topic: string): string {
  const lines = topic.split('\n')
  const out: string[] = []
  let inKoreanScriptBlock = false

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line.trim()) {
      if (!inKoreanScriptBlock) out.push('')
      continue
    }
    if (/^=== /i.test(line.trim())) {
      inKoreanScriptBlock = false
      out.push(line)
      continue
    }
    if (/^On-thumbnail copy/i.test(line)) {
      inKoreanScriptBlock = true
      continue
    }
    if (inKoreanScriptBlock) {
      if (line.trim().startsWith('-')) continue
      inKoreanScriptBlock = false
    }
    if (/Script excerpt \(Korean/i.test(line)) {
      out.push('Visual keywords from script (English only — never paint as readable text):')
      inKoreanScriptBlock = true
      continue
    }
    if (inKoreanScriptBlock) {
      const en = sanitizeThumbnailImagePromptEn(line)
      if (en.length > 6) out.push(en)
      continue
    }
    const cleaned = sanitizeThumbnailImagePromptEn(line)
    if (cleaned) out.push(cleaned)
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** 배경 전용 locale — 간판·화면에 글자(한글 포함) 금지 */
export function imageLocaleBackgroundPromptBlock(mode: ImageLocaleResolved): string {
  if (mode === 'foreign') {
    return [
      'REGIONAL_LOOK (background only — NO readable text anywhere):',
      'Western/international visual culture when people or architecture appear.',
      'Non-Korean cast and settings unless narration explicitly requires Korea.',
      'All signs, screens, labels, newspapers — blank, blurred, or illegible. NO Hangul, NO letters.',
    ].join('\n')
  }
  return [
    'REGIONAL_LOOK (background only — NO readable text anywhere):',
    'Korean visual culture when people or architecture appear — East Asian Korean features, Korean contemporary or historical styling.',
    'All signs, storefronts, screens, documents — blank, blurred, or illegible. NEVER paint Hangul or readable Korean text in the image.',
    'Text copy is added in a separate editor layer — this image is background only.',
  ].join('\n')
}

export function imageLocaleBlockForThumbnailBackground(
  mode: ImageLocaleMode,
  ctx?: ImageLocaleInferenceContext,
): string {
  if (mode !== 'auto') return imageLocaleBackgroundPromptBlock(mode)
  const inferred = parseInferredRegionalLook(ctx?.inferredRegionalLook)
  if (inferred) return imageLocaleBackgroundPromptBlock(inferred)
  const auto = imageLocaleAutoPromptBlock(ctx)
  return `${auto}\nNO readable text, Hangul, captions, or watermarks on signs, screens, or labels in this background image.`
}

/** 배경 프롬프트용 — 후킹 카피(한글)는 텍스트 레이어에만 두고 이미지 프롬프트에는 넣지 않음 */
export function shouldOmitHookCopyFromBackgroundPrompt(backgroundOnly: boolean): boolean {
  return backgroundOnly === true
}
