import { sanitizeThumbnailImagePromptEn } from './thumbnailBackgroundImagePrompt'

/**
 * 썸네일 배경 — 대본·주제와 직관적으로 맞는 단일 장면 (중구난방·무관 스톡 금지).
 */

/** CTR 패키지 Gemini — imagePromptEn 생성 규칙 (한국어) */
export function buildThumbnailImageLiteralRulesKo(): string {
  return `썸네일 이미지 프롬프트 (imagePromptEn) 추가 규칙 — 최우선:
- 영어로 작성. 마지막에 no text, no letters, no words, no logo, no watermark 포함.
- 대본에서 **가장 핵심인 사건·인물·장소·사물·시대** 1가지를 골라 **한눈에 내용이 보이는** 단일 장면으로 묘사.
- 이미지만 봐도 "이 영상이 무슨 이야기인지" 바로 떠오를 것 — 추상 배경·랜덤 우주·무관한 스톡 인물·장식용 이펙트 금지.
- 반드시 명시: 주체(WHO/WHAT) + 핵심 오브젝트 + 배경 힌트(WHERE/ERA).
- 복잡한 콜라주·여러 장면 섞기·중구난방 요소 금지 — **한 컷, 한 메시지, 한 초점**.
- 극적 감정·대비·구도는 유지하되 **대본과 무관한 비주얼**은 절대 넣지 말 것.
- 역사 → 시대에 맞는 유물·유적·지도 / 과학 → 해당 실험·천체·장비 / 인물 → 그 인물·상징물 / 경제 → 차트·화폐·건물 등 **주제 도메인에 맞는 사물**만.`
}

/** Replicate·배경 합성 프롬프트용 (영어) */
export const THUMBNAIL_SCRIPT_LITERAL_VISUAL_BLOCK_EN = [
  'SCRIPT-LITERAL THUMBNAIL (mandatory — viewer understands video topic in 1 second):',
  '- ONE single clear scene from the script/title below — NOT abstract wallpaper, NOT random collage, NOT unrelated stock imagery.',
  '- Pick the most recognizable visual beat: named person, iconic object, place, era, event, or product from the script.',
  '- Must answer at a glance: WHO or WHAT is this about? Use one bold focal subject + one supporting context clue.',
  '- NO clutter: no split panels, no multiple unrelated subjects, no chaotic mixed genres (e.g. galaxy behind ancient ruins unless script is about space archaeology).',
  '- NO decorative noise: no random astronauts, floating faces, generic office workers, or sci-fi unless the script explicitly requires it.',
  '- Domain match literally: history → period artifacts/maps/ruins; medicine → clinical objects; finance → charts/currency; nature → specific landscape — not unrelated AI slop.',
  '- Dramatic lighting and contrast OK — but every visual element must support the script story.',
].join('\n')

export function buildThumbnailScriptContentBlockEn(opts: {
  titleHint?: string
  topic?: string
  scriptExcerpt?: string
  hookCopyLines?: string[]
  /** true — 배경만 생성. 후킹 문구를 이미지 속 글자로 그리지 말 것(한글 훅 → AI가 자막처럼 렌더하는 문제 방지) */
  backgroundOnly?: boolean
}): string {
  const bgOnly = opts.backgroundOnly === true
  const title = bgOnly
    ? sanitizeThumbnailImagePromptEn(opts.titleHint?.trim() ?? '')
    : opts.titleHint?.trim()
  const topic = bgOnly
    ? sanitizeThumbnailImagePromptEn(opts.topic?.trim() ?? '')
    : opts.topic?.trim()
  const scriptRaw = opts.scriptExcerpt?.trim() ?? ''
  const script = bgOnly ? sanitizeThumbnailImagePromptEn(scriptRaw).slice(0, 480) : scriptRaw
  const hookLines = (opts.hookCopyLines ?? []).map((l) => l.trim()).filter(Boolean)
  const includeHooks = hookLines.length > 0 && !bgOnly

  const hookBlock = includeHooks
    ? ['On-thumbnail copy (scene must match this story):', ...hookLines.map((l) => `- ${l}`)].join('\n')
    : ''

  const lines = [
    '=== VIDEO SCRIPT & TOPIC (image MUST illustrate THIS — not generic stock) ===',
    bgOnly
      ? 'CRITICAL: Background image only — zero text, letters, numbers, Hangul, captions, or watermarks in the output.'
      : '',
    title ? `YouTube title (visual mood — never render as text): ${title}` : '',
    topic && topic !== title ? `Topic (visual mood — never render as text): ${topic}` : '',
    script
      ? bgOnly
        ? `Visual keywords from script (English only — never paint as readable text):\n${script}`
        : `Script excerpt:\n${script}`
      : bgOnly && scriptRaw
        ? 'Visual keywords from script: illustrate the video topic — no readable text in the image.'
        : '',
    hookBlock,
  ].filter(Boolean)

  return lines.join('\n')
}
