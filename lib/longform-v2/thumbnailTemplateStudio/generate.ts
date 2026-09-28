import { fetchUrlAsBase64, postThumbnailImage, type ThumbnailImageResult } from '@/lib/longform-v2/thumbnail-bridge/thumbnailAiApi'
import { AI_TOPIC_MAX } from '@/lib/longform-v2/thumbnail-bridge/thumbnailAiTopic'
import { getProTemplate } from './catalog'
import { generateTemplateCopyForDocument } from './copywriter'
import { generateCtrPackageCopyForDocument } from './ctrPackage'
import {
  applySlotReplacementsToDocument,
  collectTopicHookCopyLines,
  fillBackgroundImage,
  resolveBackgroundPrompt,
  syncTextLayersFromTemplateStyle,
} from './document'
import { fitStudioTextLayoutToBackground } from './backgroundTextLayout'
import { coverLayoutForImageSource } from './studioTransform'
import { buildCtrThumbnailBackgroundPrompt } from './templateLayout'
import { ensureThumbnailCopyFullyVisible } from './textLayoutScale'
import { translateStudioTextLayersToLanguage } from './textRewrite'
import type { ThumbnailStudioDocument } from './types'
import {
  applyV2TemplateDocument,
  V2_TEMPLATE_GENERATED_NOTE,
} from './v2BackgroundOnly'

import type { ImageLocaleMode } from '@/lib/longform-v2/youtube/imageLocaleMode'
import type { ThumbnailStudioVersion } from '@/lib/longform-v2/youtube/thumbnailStudioVersion'
import { isThumbnailStudioV2 } from '@/lib/longform-v2/youtube/thumbnailStudioVersion'

/** 템플릿 AI 생성 시 큰 글씨 + 30px 외곽선 */
const GENERATED_THUMB_TEXT_LAYOUT = { generatedBoldStyle: true as const }

async function resolveThumbnailImageDataUrl(result: ThumbnailImageResult): Promise<string> {
  if (result.imageDataUrl?.startsWith('data:')) return result.imageDataUrl
  if (result.base64?.trim()) {
    const mime = result.mimeType?.startsWith('image/') ? result.mimeType : 'image/png'
    return `data:${mime};base64,${result.base64}`
  }
  if (!result.imageUrl) throw new Error('이미지 URL이 없습니다.')
  const { base64, mimeType } = await fetchUrlAsBase64(result.imageUrl)
  const mime = mimeType.startsWith('image/') ? mimeType : 'image/png'
  return `data:${mime};base64,${base64}`
}

export type GenerateStudioLayersOpts = {
  document: ThumbnailStudioDocument
  topic: string
  script: string
  titleHint?: string
  outputLanguage?: string
  imageModel?: string
  imageStyle?: string
  thumbnailStyle?: 'realism' | 'animation' | null
  customStylePrompt?: string
  extraBackgroundHint?: string
  analyzedBenchmarkStyle?: string
  imagesLocaleMode?: ImageLocaleMode
  styleCategory?: string
  styleTemplateId?: string
  /** false면 생성 배경 비전으로 문구 재배치하지 않음 (템플릿 선택 1회 생성) */
  fitTextToBackground?: boolean
  /** CTR 패키지에서 생성된 영어 이미지 프롬프트 */
  ctrImagePrompt?: string
  /** CTR 패키지 10옵션 중 선택 인덱스 */
  ctrOptionIndex?: number
  /** v2 스튜디오 — 배경 프롬프트·한글 OCR 방지 개선 */
  studioVersion?: ThumbnailStudioVersion
}

export type GenerateStudioLayersResult = {
  document: ThumbnailStudioDocument
  replacements: Record<string, string>
  backgroundNote: string
}

/**
 * 템플릿 기반 1차 생성 — 배경(AI)·문구(AI)를 분리해 document 에 반영.
 */
export async function generateStudioLayersFromTemplate(
  opts: GenerateStudioLayersOpts,
): Promise<GenerateStudioLayersResult> {
  const tpl = getProTemplate(opts.document.templateId)
  if (!tpl) throw new Error('템플릿을 찾을 수 없습니다.')

  const script = opts.script.trim()
  const topicBase = opts.topic.trim() || opts.titleHint?.trim() || 'YouTube thumbnail'

  let doc = opts.document

  const styleSpec = doc.templateStyle ?? null
  const hookCopyLines = isThumbnailStudioV2(opts.studioVersion)
    ? []
    : collectTopicHookCopyLines(doc)
  const ctrPrompt = opts.ctrImagePrompt?.trim()
  const promptRaw = ctrPrompt
    ? buildCtrThumbnailBackgroundPrompt(
        tpl,
        ctrPrompt,
        hookCopyLines,
        {
          styleCategory: opts.styleCategory,
          styleTemplateId: opts.styleTemplateId,
        },
        {
          topic: topicBase,
          scriptExcerpt: script,
          titleHint: opts.titleHint?.trim() || undefined,
        },
      )
    : resolveBackgroundPrompt(
        tpl,
        {
          topic: topicBase,
          scriptExcerpt: script.slice(0, 2400),
          hookCopyLines,
          titleHint: opts.titleHint?.trim() || undefined,
          styleCategory: opts.styleCategory,
          styleTemplateId: opts.styleTemplateId,
        },
        styleSpec,
      )
  const extra = opts.extraBackgroundHint?.trim()
  let topic = extra ? `${promptRaw}\n\n${extra}` : promptRaw
  if (topic.length > AI_TOPIC_MAX) topic = `${topic.slice(0, AI_TOPIC_MAX - 1)}…`

  const imageResult = await postThumbnailImage({
    topic,
    imageModel: opts.imageModel?.trim() || undefined,
    imageStyle: opts.imageStyle?.trim() || undefined,
    thumbnailStyle: opts.thumbnailStyle ?? null,
    customStylePrompt: opts.customStylePrompt?.trim() || undefined,
    withoutText: true,
    promptPrebuilt: isThumbnailStudioV2(opts.studioVersion),
    analyzedBenchmarkStyle: opts.analyzedBenchmarkStyle?.trim() || undefined,
    imagesLocaleMode: opts.imagesLocaleMode,
    scriptExcerpt: script.slice(0, 2400) || undefined,
    styleCategory: opts.styleCategory?.trim() || undefined,
    styleTemplateId: opts.styleTemplateId?.trim() || undefined,
  })
  const dataUrl = await resolveThumbnailImageDataUrl(imageResult)

  const cover = await coverLayoutForImageSource(dataUrl).catch(() => null)
  doc = fillBackgroundImage(doc, dataUrl, 'ai', cover)

  if (opts.fitTextToBackground === false) {
    if (!isThumbnailStudioV2(opts.studioVersion)) {
      doc = syncTextLayersFromTemplateStyle(doc)
      doc = ensureThumbnailCopyFullyVisible(doc, GENERATED_THUMB_TEXT_LAYOUT)
    } else {
      doc = applyV2TemplateDocument(doc)
    }
    return {
      document: doc,
      replacements: {},
      backgroundNote: isThumbnailStudioV2(opts.studioVersion)
        ? V2_TEMPLATE_GENERATED_NOTE
        : '주제·대본 기반 배경을 생성했습니다. 문구는 템플릿 미리보기와 동일한 위치·스타일을 유지합니다.',
    }
  }

  const fitted = await fitStudioTextLayoutToBackground(doc)
  if (isThumbnailStudioV2(opts.studioVersion)) {
    doc = applyV2TemplateDocument(fitted.document)
    return {
      document: doc,
      replacements: {},
      backgroundNote: V2_TEMPLATE_GENERATED_NOTE,
    }
  }
  doc = ensureThumbnailCopyFullyVisible(fitted.document, GENERATED_THUMB_TEXT_LAYOUT)
  const layoutNote =
    fitted.note.includes('실패') || fitted.note.includes('없어')
      ? '주제·대본 기반 배경을 생성했습니다. 문구는 「배경에 맞춰 문구 배치」 또는 「문구만 AI 재생성」을 사용하세요.'
      : fitted.note

  return {
    document: doc,
    replacements: {},
    backgroundNote: layoutNote,
  }
}

/**
 * 템플릿 선택 후 1회 실행 — 분석된 레이아웃에 맞춰 배경(AI)·문구(AI)를 순서대로 생성.
 */
export async function generateStudioOnTemplateSelect(
  opts: GenerateStudioLayersOpts,
): Promise<GenerateStudioLayersResult> {
  let doc = opts.document
  let replacements: Record<string, string> = {}
  let textNote = ''

  /** 배경 생성 전에 CTR 패키지로 메인 2줄·서브카피를 먼저 채움 */
  let ctrImagePrompt = opts.ctrImagePrompt?.trim()
  try {
    const text = await generateCtrPackageCopyForDocument({
      document: doc,
      topic: opts.topic,
      script: opts.script,
      titleHint: opts.titleHint,
      outputLanguage: opts.outputLanguage,
      optionIndex: opts.ctrOptionIndex ?? 0,
    })
    doc = text.document
    replacements = text.replacements
    ctrImagePrompt = text.option.imagePromptEn
    const subNote = text.subCopyApplied ? ` 서브카피: ${text.subCopyApplied}.` : ''
    textNote = `CTR 패키지로 메인 2줄·서브카피를 생성했습니다.${subNote}`
  } catch (e) {
    const msg = e instanceof Error ? e.message : '문구 생성 실패'
    try {
      const fallback = await generateTemplateCopyForDocument({
        document: doc,
        topic: opts.topic,
        script: opts.script,
        titleHint: opts.titleHint,
        outputLanguage: opts.outputLanguage,
      })
      doc = fallback.document
      replacements = fallback.replacements
      textNote = `CTR 패키지 실패 — 기존 방식으로 문구 생성. (${msg})`
    } catch (e2) {
      const msg2 = e2 instanceof Error ? e2.message : '문구 생성 실패'
      textNote = `문구: ${msg2} — 「문구만 AI 재생성」을 시도해 보세요.`
    }
  }

  const bg = await generateStudioLayersFromTemplate({
    ...opts,
    document: doc,
    fitTextToBackground: false,
    ctrImagePrompt,
  }).catch((e) => {
    const msg = e instanceof Error ? e.message : '배경 생성 실패'
    return {
      document: doc,
      replacements: {} as Record<string, string>,
      backgroundNote: `배경 생성 실패: ${msg} (Replicate API 키·할당량을 확인하세요)`,
    }
  })
  doc = bg.document

  if (replacements && Object.values(replacements).some((v) => v?.trim())) {
    doc = applySlotReplacementsToDocument(doc, replacements)
    if (isThumbnailStudioV2(opts.studioVersion)) {
      doc = applyV2TemplateDocument(doc)
    }
  }

  if (replacements && Object.keys(replacements).length > 0) {
    textNote = [textNote, '템플릿 미리보기와 동일한 문구 위치·스타일을 유지했습니다.'].filter(Boolean).join(' ')
  }

  const layoutHint = doc.templateStyle?.layoutSummary?.trim()
  const backgroundNote = [layoutHint, textNote, bg.backgroundNote].filter(Boolean).join(' ')

  doc = ensureThumbnailCopyFullyVisible(doc, GENERATED_THUMB_TEXT_LAYOUT)

  return { document: doc, replacements, backgroundNote }
}

/** 배경만 재생성 + 생성 이미지 비전으로 문구 위치·크기 재배치 (문구 텍스트는 유지) */
export async function regenerateStudioBackgroundOnly(
  opts: GenerateStudioLayersOpts,
): Promise<GenerateStudioLayersResult> {
  const tpl = getProTemplate(opts.document.templateId)
  if (!tpl) throw new Error('템플릿을 찾을 수 없습니다.')

  const script = opts.script.trim()
  const topicBase = opts.topic.trim() || opts.titleHint?.trim() || 'YouTube thumbnail'

  let doc = opts.document
  const styleSpec = doc.templateStyle ?? null
  const hookCopyLines = isThumbnailStudioV2(opts.studioVersion)
    ? []
    : collectTopicHookCopyLines(doc)

  const ctrPrompt = opts.ctrImagePrompt?.trim()
  let promptRaw = ctrPrompt
    ? buildCtrThumbnailBackgroundPrompt(
        tpl,
        ctrPrompt,
        hookCopyLines,
        {
          styleCategory: opts.styleCategory,
          styleTemplateId: opts.styleTemplateId,
        },
        {
          topic: topicBase,
          scriptExcerpt: script,
          titleHint: opts.titleHint?.trim() || undefined,
        },
      )
    : resolveBackgroundPrompt(
        tpl,
        {
          topic: topicBase,
          scriptExcerpt: script.slice(0, 2400),
          hookCopyLines,
          titleHint: opts.titleHint?.trim() || undefined,
          styleCategory: opts.styleCategory,
          styleTemplateId: opts.styleTemplateId,
        },
        styleSpec,
      )
  const extra = opts.extraBackgroundHint?.trim()
  if (extra) promptRaw = `${promptRaw}\n\n${extra}`
  let topic = promptRaw
  if (topic.length > AI_TOPIC_MAX) topic = `${topic.slice(0, AI_TOPIC_MAX - 1)}…`

  const imageResult = await postThumbnailImage({
    topic,
    imageModel: opts.imageModel?.trim() || undefined,
    imageStyle: opts.imageStyle?.trim() || undefined,
    thumbnailStyle: opts.thumbnailStyle ?? null,
    customStylePrompt: opts.customStylePrompt?.trim() || undefined,
    withoutText: true,
    promptPrebuilt: isThumbnailStudioV2(opts.studioVersion),
    analyzedBenchmarkStyle: opts.analyzedBenchmarkStyle?.trim() || undefined,
    imagesLocaleMode: opts.imagesLocaleMode,
    scriptExcerpt: script.slice(0, 2400) || undefined,
    styleCategory: opts.styleCategory?.trim() || undefined,
    styleTemplateId: opts.styleTemplateId?.trim() || undefined,
  })
  const dataUrl = await resolveThumbnailImageDataUrl(imageResult)

  const cover = await coverLayoutForImageSource(dataUrl).catch(() => null)
  doc = fillBackgroundImage(doc, dataUrl, 'ai', cover)

  const fitted = await fitStudioTextLayoutToBackground(doc)
  if (isThumbnailStudioV2(opts.studioVersion)) {
    doc = applyV2TemplateDocument(fitted.document)
    return { document: doc, replacements: {}, backgroundNote: V2_TEMPLATE_GENERATED_NOTE }
  }
  doc = ensureThumbnailCopyFullyVisible(fitted.document, GENERATED_THUMB_TEXT_LAYOUT)
  const layoutNote =
    fitted.note.includes('실패') || fitted.note.includes('없어')
      ? '배경만 다시 생성했습니다. 문구 내용은 그대로입니다.'
      : fitted.note

  return { document: doc, replacements: {}, backgroundNote: layoutNote }
}

/** 배경은 유지하고 문구 레이어만 AI로 다시 채움 (배경 기준 위치·크기 재조정 포함) */
export async function regenerateStudioTextOnly(opts: {
  document: ThumbnailStudioDocument
  topic: string
  script: string
  titleHint?: string
  outputLanguage?: string
  ctrOptionIndex?: number
}): Promise<{ document: ThumbnailStudioDocument; replacements: Record<string, string> }> {
  const topicBase = opts.topic.trim() || opts.titleHint?.trim() || 'YouTube thumbnail'
  const script =
    opts.script.trim() || [opts.titleHint, topicBase].filter(Boolean).join('\n')

  if (!script.trim()) {
    throw new Error('대본 또는 제목이 없어 문구를 생성할 수 없습니다.')
  }

  const text = await generateCtrPackageCopyForDocument({
    document: opts.document,
    topic: topicBase,
    script,
    titleHint: opts.titleHint,
    outputLanguage: opts.outputLanguage,
    optionIndex: opts.ctrOptionIndex ?? 0,
  }).catch(() =>
    generateTemplateCopyForDocument({
      document: opts.document,
      topic: topicBase,
      script,
      titleHint: opts.titleHint,
      outputLanguage: opts.outputLanguage,
    }),
  )

  if (text.document.background.imageDataUrl?.trim()) {
    const fitted = await fitStudioTextLayoutToBackground(text.document)
    return {
      ...text,
      document: ensureThumbnailCopyFullyVisible(
        applyV2TemplateDocument(fitted.document),
        GENERATED_THUMB_TEXT_LAYOUT,
      ),
    }
  }

  return { ...text, document: applyV2TemplateDocument(text.document) }
}

/** 탭 언어 적용 — 캔버스에 보이는 문구를 선택 언어로 번역 */
export async function applyStudioTabOutputLanguage(opts: {
  document: ThumbnailStudioDocument
  topic: string
  scriptKo: string
  scriptByLanguage?: Record<string, string> | null
  titleHint?: string
  outputLanguage: string
}): Promise<{ document: ThumbnailStudioDocument }> {
  const hasText = opts.document.textLayers.some((t) => t.text.trim())
  if (!hasText) {
    return { document: opts.document }
  }

  const doc = await translateStudioTextLayersToLanguage({
    document: opts.document,
    outputLanguage: opts.outputLanguage,
    topic: opts.topic,
    script: opts.scriptKo,
    titleHint: opts.titleHint,
  })
  return { document: ensureThumbnailCopyFullyVisible(doc) }
}
