import type { AnalyzedTemplateStyleSpec } from '@/lib/longform-v2/youtube/templateStyleAnalysis'
import { mergeBlocksWithCatalogForBackground } from '@/lib/longform-v2/youtube/templateStyleAnalysis'
import { isThumbnailPhotorealisticStyle } from '@/lib/longform-v2/youtube/thumbnailPhotorealismPolicy'
import { buildTopicHumanPlacementGuardBlock } from '@/lib/longform-v2/youtube/topicVisualCoherence'
import {
  THUMBNAIL_SCRIPT_LITERAL_VISUAL_BLOCK_EN,
  buildThumbnailScriptContentBlockEn,
} from '@/lib/longform-v2/youtube/thumbnailScriptLiteralVisual'
import type { ThumbnailProTemplate } from './types'
import { getProTemplate } from './catalog'
import { buildFallbackTemplateStyleSpec } from './fallbackStyle'
import { mergeTemplatePreviewStyleWithCatalog } from './templateTextSlots'

/** 템플릿 미리보기 AI — OCR·배경 프롬프트·초기 문구. 위치·크기는 생성 배경 분석으로 덮어씀 */
export function canonicalTemplateStyleSpec(
  templateId: string,
  vision?: AnalyzedTemplateStyleSpec | null,
): AnalyzedTemplateStyleSpec | null {
  const base = buildFallbackTemplateStyleSpec(templateId)
  if (!base) return null

  const tpl = getProTemplate(templateId)
  const slots = tpl?.textSlots ?? []

  if (vision?.layoutFromTemplatePreview && vision.textBlocks?.length === slots.length) {
    return { ...vision, analyzedAt: Date.now() }
  }

  const textBlocks = vision?.textBlocks?.length
    ? mergeTemplatePreviewStyleWithCatalog(vision, slots)
    : base.textBlocks

  return {
    ...base,
    layoutSummary: vision?.layoutSummary?.trim() || base.layoutSummary,
    subjectZone: vision?.subjectZone ?? base.subjectZone,
    colorPalette: vision?.colorPalette ?? base.colorPalette,
    backgroundPromptEn: vision?.backgroundPromptEn?.trim() || base.backgroundPromptEn,
    textBlocks,
    layoutFromTemplatePreview: true,
    layoutFromGeneratedBackground: false,
    analyzedAt: Date.now(),
  }
}

/** AI 생성 배경 비전 — 문구 좌표·크기·색을 분석값으로 적용 */
export function canonicalTemplateStyleSpecFromBackground(
  templateId: string,
  vision: AnalyzedTemplateStyleSpec,
): AnalyzedTemplateStyleSpec | null {
  const base = buildFallbackTemplateStyleSpec(templateId)
  if (!base || !vision.textBlocks?.length) return null

  const tpl = getProTemplate(templateId)
  const slots = tpl?.textSlots ?? []
  const textBlocks = mergeBlocksWithCatalogForBackground(vision.textBlocks, slots)

  return {
    ...base,
    layoutSummary: vision.layoutSummary?.trim() || base.layoutSummary,
    subjectZone: vision.subjectZone ?? base.subjectZone,
    colorPalette: vision.colorPalette ?? base.colorPalette,
    textBlocks,
    layoutFromTemplatePreview: false,
    layoutFromGeneratedBackground: true,
    analyzedAt: Date.now(),
  }
}

type TextOverlayZone = 'LEFT' | 'RIGHT' | 'BOTTOM-CENTER' | 'BOTTOM-LEFT' | 'TOP-LEFT'

function resolveTextOverlayZone(tpl: ThumbnailProTemplate): TextOverlayZone {
  const slots = tpl.textSlots
  if (!slots.length) return 'LEFT'
  const avgX = slots.reduce((s, sl) => s + sl.xn, 0) / slots.length
  const avgY = slots.reduce((s, sl) => s + sl.yn, 0) / slots.length
  if (avgY >= 0.62 && avgX >= 0.35 && avgX <= 0.65) return 'BOTTOM-CENTER'
  if (avgY >= 0.62 && avgX < 0.35) return 'BOTTOM-LEFT'
  if (avgX >= 0.55) return 'RIGHT'
  if (avgX <= 0.35 && avgY < 0.45) return 'TOP-LEFT'
  return 'LEFT'
}

function subjectZoneForTextOverlay(zone: TextOverlayZone): string {
  switch (zone) {
    case 'LEFT':
    case 'TOP-LEFT':
    case 'BOTTOM-LEFT':
      return 'RIGHT two-thirds of frame (main subject / focal point)'
    case 'RIGHT':
      return 'LEFT two-thirds of frame (main subject / focal point)'
    case 'BOTTOM-CENTER':
      return 'UPPER 55–65% of frame (skyline, scene, figure — leave lower third slightly darker for text)'
    default:
      return 'opposite side from text overlay zone'
  }
}

/**
 * 템플릿별 **구도만** — 우주·역사·SF 등 테마는 절대 넣지 않음 (미리보기 PNG와 무관).
 */
function layoutCompositionEn(tpl: ThumbnailProTemplate): string {
  const textZone = resolveTextOverlayZone(tpl)
  const subjectZone = subjectZoneForTextOverlay(textZone)

  return [
    'YOUTUBE BACKGROUND LAYOUT SPEC (internal instructions — never render these words as visible text):',
    '- 16:9 background photo only. Template preview PNG is ONLY a layout sample — do NOT copy its scenery, era, or genre.',
    '- ENTIRE frame SHARP in focus (NO blur halves, NO gaussian blur, NO mosaic, NO split sharp/blur).',
    `- Future text overlay zone: ${textZone} — slightly darker scrim only; do NOT draw letters, numbers, or labels.`,
    `- Place the scroll-stopping focal subject in: ${subjectZone}.`,
    '- Subject matter MUST come from VIDEO TOPIC / script below — not from template name or preview image.',
    '- ZERO readable text, letters, numbers, watermark, logo, or UI anywhere in the image.',
  ].join('\n')
}

export type TopicBackgroundPromptOpts = {
  topic: string
  scriptExcerpt: string
  /** AI가 채운 썸네일 문구 — 배경 비주얼은 이 스토리를 뒷받침 */
  hookCopyLines?: string[]
  titleHint?: string
  styleCategory?: string
  styleTemplateId?: string
}

/**
 * 배경 AI — 주제·후킹·대본 우선. 템플릿 PNG·테마 미사용.
 */
export function resolveTopicBackgroundPrompt(
  tpl: ThumbnailProTemplate,
  opts: TopicBackgroundPromptOpts,
  _styleSpec?: AnalyzedTemplateStyleSpec | null,
): string {
  const topic = opts.topic.trim() || opts.titleHint?.trim() || 'YouTube video topic'
  const scriptExcerpt = opts.scriptExcerpt.trim().slice(0, 2400)
  const titleHint = opts.titleHint?.trim()
  const hookLines = (opts.hookCopyLines ?? []).map((l) => l.trim()).filter(Boolean)
  const photoreal = isThumbnailPhotorealisticStyle(opts.styleCategory, opts.styleTemplateId)

  const contentBlock = buildThumbnailScriptContentBlockEn({
    titleHint,
    topic,
    scriptExcerpt,
    hookCopyLines: hookLines,
    backgroundOnly: true,
  })

  const visualStyleBlock = photoreal
    ? [
        'PHOTOREALISM (mandatory):',
        '- Must look like a real photograph or high-end documentary still — NOT AI illustration, NOT 3D render, NOT cartoon, NOT plastic CGI.',
        '- Natural lighting, realistic textures, believable color grading (avoid neon oversaturation and fake HDR glow).',
        '- Subtle film grain or sensor noise acceptable; avoid uncanny AI artifacts, warped anatomy, melted faces.',
        '- Include a visible person ONLY when hook/topic is about that person or human drama — NOT for abstract cosmos/science.',
        '- For space/cosmos topics without a named human: nebulae, planets, telescopes — NO random astronauts or floating humans.',
        '- If people appear: natural proportions and authentic photo realism — not uncanny AI face or unrelated stock model.',
        '',
        'ENGAGEMENT (subtle, still photoreal):',
        '- One clear focal point with readable contrast at mobile feed size.',
        '- Pick the most relevant visual beat from topic/script/hook: scale, danger, twist, wonder, iconic object.',
        '- Match the channel/topic genre: history → period artifacts; science/cosmos → relevant astronomy still; NOT unrelated stock (space for history, random person for data topics).',
        '- Cinematic but natural lighting (rim light, depth). Avoid flat boring wallpaper.',
      ].join('\n')
    : [
        'ILLUSTRATED STYLE (mandatory — NOT photorealistic):',
        '- Flat 2D cartoon / stick-figure / stylized illustration for YouTube thumbnail — NOT live-action photo, NOT cinematic real-person photography, NOT 3D CGI render.',
        '- Bold clean outlines, solid flat colors, simplified shapes, readable at mobile feed size.',
        '- Match the selected art style preset (e.g. stick-figure, anime, watercolor) — never override with realistic human photography.',
        '',
        'ENGAGEMENT (illustrated):',
        '- One clear focal point with high contrast.',
        '- Pick the most relevant visual beat from topic/script/hook.',
        '- Prefer mid-shot or wide-shot that shows the situation; avoid hyper-realistic close-up faces.',
      ].join('\n')

  const topicGuard = buildTopicHumanPlacementGuardBlock(
    [opts.topic, opts.scriptExcerpt, ...(opts.hookCopyLines ?? []), opts.titleHint]
      .filter(Boolean)
      .join('\n'),
  )

  return [
    layoutCompositionEn(tpl),
    '',
    contentBlock,
    '',
    THUMBNAIL_SCRIPT_LITERAL_VISUAL_BLOCK_EN,
    '',
    visualStyleBlock,
    ...(topicGuard ? ['', topicGuard] : []),
    '',
    'OUTPUT: single background image only. Visual storytelling without any written characters.',
  ]
    .filter(Boolean)
    .join('\n')
}

/** CTR 패키지 imagePromptEn + 대본·템플릿 구도 + 사진가 스타일 */
export function buildCtrThumbnailBackgroundPrompt(
  tpl: ThumbnailProTemplate,
  ctrImagePromptEn: string,
  hookCopyLines?: string[],
  styleOpts?: Pick<TopicBackgroundPromptOpts, 'styleCategory' | 'styleTemplateId'>,
  contentOpts?: Pick<TopicBackgroundPromptOpts, 'scriptExcerpt' | 'titleHint' | 'topic'>,
): string {
  const prompt = ctrImagePromptEn.trim()
  if (!prompt) {
    return resolveTopicBackgroundPrompt(tpl, {
      topic: contentOpts?.topic ?? '',
      scriptExcerpt: contentOpts?.scriptExcerpt ?? '',
      titleHint: contentOpts?.titleHint,
      hookCopyLines,
      ...styleOpts,
    })
  }

  const hookLines = (hookCopyLines ?? []).map((l) => l.trim()).filter(Boolean)
  const photoreal = isThumbnailPhotorealisticStyle(styleOpts?.styleCategory, styleOpts?.styleTemplateId)
  const scriptBlock = buildThumbnailScriptContentBlockEn({
    titleHint: contentOpts?.titleHint,
    topic: contentOpts?.topic,
    scriptExcerpt: contentOpts?.scriptExcerpt?.trim().slice(0, 2400),
    hookCopyLines: hookLines,
    backgroundOnly: true,
  })

  const styleNote = photoreal
    ? 'Match the selected photorealistic photographer / documentary still style preset.'
    : 'Match the selected illustrated / cartoon / stick-figure art style preset — NOT live-action photography.'

  const topicGuard = buildTopicHumanPlacementGuardBlock(
    [
      contentOpts?.topic,
      contentOpts?.scriptExcerpt,
      contentOpts?.titleHint,
      prompt,
      ...hookLines,
    ]
      .filter(Boolean)
      .join('\n'),
  )

  return [
    layoutCompositionEn(tpl),
    '',
    scriptBlock,
    '',
    THUMBNAIL_SCRIPT_LITERAL_VISUAL_BLOCK_EN,
    '',
    '=== CTR SCENE PROMPT (primary visual — must match script above) ===',
    prompt,
    '',
    styleNote,
    ...(topicGuard ? ['', topicGuard] : []),
    '',
    'OUTPUT: single 1280x720 background image only. One literal scene, one message. No written characters in the image.',
  ]
    .filter(Boolean)
    .join('\n')
}

/** 배경 AI — 템플릿 미리보기·벤치마크 스타일 미사용 (주제·대본 프롬프트만) */
export function buildLayoutOnlyImageStyleHint(
  _styleSpec?: AnalyzedTemplateStyleSpec | null,
): string | undefined {
  return undefined
}
