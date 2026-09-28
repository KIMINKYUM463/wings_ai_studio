/** 장면·인트로 이미지 — 한국풍 / 외국풍 / AI 판단 */

export type ImageLocaleResolved = 'korean' | 'foreign'
export type ImageLocaleMode = ImageLocaleResolved | 'auto'

export type ImageLocaleInferenceContext = {
  promptEn?: string
  promptKo?: string
  narrationText?: string
  /** 장면 프롬프트 LLM이 auto 모드에서 채운 regionalLook */
  inferredRegionalLook?: string | null
  /** 인트로 전체 맥락(요약 대본) */
  scriptExcerpt?: string
}

export function resolveImageLocaleMode(opts: {
  mode?: string | null
}): ImageLocaleMode {
  const m = (opts.mode ?? '').trim().toLowerCase()
  if (
    m === 'auto' ||
    m === 'ai' ||
    m === 'ai_auto' ||
    m === 'ai판단' ||
    m === 'ai 판단' ||
    m === '판단'
  ) {
    return 'auto'
  }
  if (m === 'foreign' || m === 'western' || m === 'international' || m === '외국' || m === '외국풍') {
    return 'foreign'
  }
  return 'korean'
}

export function parseInferredRegionalLook(raw: unknown): ImageLocaleResolved | null {
  const m = (typeof raw === 'string' ? raw : '').trim().toLowerCase()
  if (m === 'foreign' || m === 'western' || m === 'international' || m === '외국' || m === '외국풍') {
    return 'foreign'
  }
  if (m === 'korean' || m === 'kr' || m === '한국' || m === '한국풍') {
    return 'korean'
  }
  return null
}

export function imageLocaleModeLabel(mode: ImageLocaleMode): string {
  if (mode === 'auto') return 'AI 판단'
  return mode === 'foreign' ? '외국풍' : '한국풍'
}

/** 이미지 생성 API에 붙이는 고정 블록 (한국풍 / 외국풍) */
export function imageLocalePromptBlock(mode: ImageLocaleResolved): string {
  if (mode === 'foreign') {
    return [
      'REGIONAL_LOOK (mandatory):',
      'Visual culture reads as Western/international — when people appear: non-Korean cast (European, American, Middle Eastern, African, Latin American, etc. as fits the scene).',
      'Architecture, street signs, interiors, and everyday props should feel non-Korean unless the narration explicitly describes Korea.',
      'Do NOT default to East Asian Korean faces, hanbok, hanok, or Korean-only urban cues unless the script clearly requires Korea.',
    ].join('\n')
  }
  return [
    'REGIONAL_LOOK (mandatory):',
    'Visual culture reads as Korean — when people appear: East Asian Korean appearance (Korean facial features, Korean contemporary or historical styling as appropriate).',
    'Architecture, signage (Hangul where natural), interiors, and cultural details should feel Korean unless the narration explicitly describes another country.',
    'Do NOT substitute Western-only cast or non-Korean street/architecture unless the script clearly requires abroad.',
  ].join('\n')
}

/** auto 모드 — 나레이션·장면 묘사에서 지역 풍을 추론 */
export function imageLocaleAutoPromptBlock(ctx?: ImageLocaleInferenceContext): string {
  const lines = [
    'REGIONAL_LOOK (AI-inferred — mandatory):',
    'Read the narration and visual description below, then decide whether this shot should read as Korean or foreign/international.',
    'Korean look: Korean daily life, Korean history, Hangul signage, Seoul/Korea places, K-culture, Korean-named figures → East Asian Korean cast, Korean architecture and props.',
    'Foreign look: Western/European/American history, abroad travel, non-Korean historical figures, international settings → matching non-Korean cast, architecture, and signage.',
    'Location-agnostic science/space/abstract: pick the look that best matches what the narration actually describes; do not force Korean or Western if neither fits.',
    'Apply your inference consistently to ethnicity (if people appear), architecture, street signs, and cultural props in this single shot.',
  ]
  const ctxLines: string[] = []
  if (ctx?.scriptExcerpt?.trim()) {
    ctxLines.push(`Video intro/script context (Korean): ${ctx.scriptExcerpt.trim().slice(0, 600)}`)
  }
  if (ctx?.narrationText?.trim()) {
    ctxLines.push(`Narration (Korean): ${ctx.narrationText.trim()}`)
  }
  if (ctx?.promptKo?.trim()) ctxLines.push(`Scene (Korean): ${ctx.promptKo.trim()}`)
  if (ctx?.promptEn?.trim()) ctxLines.push(`Scene (English): ${ctx.promptEn.trim()}`)
  if (ctxLines.length > 0) {
    lines.push('', 'CONTEXT FOR YOUR INFERENCE:', ...ctxLines)
  }
  return lines.join('\n')
}

/** 이미지 생성 시 locale 모드 + (auto면) LLM이 채운 regionalLook 반영 */
export function imageLocaleBlockForGeneration(
  mode: ImageLocaleMode,
  ctx?: ImageLocaleInferenceContext,
): string {
  if (mode !== 'auto') return imageLocalePromptBlock(mode)
  const inferred = parseInferredRegionalLook(ctx?.inferredRegionalLook)
  if (inferred) return imageLocalePromptBlock(inferred)
  return imageLocaleAutoPromptBlock(ctx)
}

/** 장면 프롬프트 LLM(user) 힌트 한 줄 */
export function imageLocalePipelineHint(mode: ImageLocaleMode): string {
  if (mode === 'auto') {
    return [
      'REGIONAL_STYLE: auto — YOU must infer Korean vs foreign/international per scene from narration and script.',
      'Set regionalLook on every sceneImages row to exactly "korean" or "foreign".',
      'Embed matching ethnicity, architecture, and signage in promptKo/promptEn for each row.',
    ].join(' ')
  }
  if (mode === 'foreign') {
    return 'REGIONAL_STYLE: foreign/international — non-Korean cast and settings unless script specifies Korea.'
  }
  return 'REGIONAL_STYLE: Korean — Korean cast appearance and culturally Korean settings unless script specifies abroad.'
}

/** 등장인물 appearance·시각 락용 보조 문구 */
export function imageLocaleCastAppearanceHint(mode: ImageLocaleMode): string {
  if (mode === 'auto') {
    return 'REGIONAL_AUTO: Infer cast ethnicity from script — Korean figures get Korean appearance; foreign-historical figures get matching international look. Each sceneImages[].regionalLook must be "korean" or "foreign" based on that scene\'s narration.'
  }
  if (mode === 'foreign') {
    return 'Cast appearance in analyzedCharacters and seriesVisualLock*: non-Korean international/Western features unless script names Korean ethnicity.'
  }
  return 'Cast appearance in analyzedCharacters and seriesVisualLock*: Korean (East Asian Korean features) unless script clearly names another ethnicity.'
}

/** scenePipeline JSON 스키마 — auto일 때만 regionalLook 필드 */
export function imageLocaleRegionalLookSchemaField(mode: ImageLocaleMode): string[] {
  if (mode !== 'auto') return []
  return [
    '      "regionalLook": "korean" or "foreign" (required — your per-scene inference from narrationText/script)',
  ]
}

/** scenePipeline Rules 배열에 넣을 auto 전용 규칙 */
export function imageLocaleRegionalLookPipelineRules(mode: ImageLocaleMode): string[] {
  if (mode !== 'auto') return []
  return [
    '- REGIONAL_AUTO: Each sceneImages[].regionalLook MUST be exactly "korean" or "foreign". Infer independently per scene from narrationText and script context.',
    '- Korean domestic life, Korean history, K-culture, Korea places → regionalLook "korean". Western history, abroad, non-Korean figures → "foreign".',
    '- promptKo/promptEn MUST match regionalLook (ethnicity when people appear, architecture, signage, props).',
  ]
}
