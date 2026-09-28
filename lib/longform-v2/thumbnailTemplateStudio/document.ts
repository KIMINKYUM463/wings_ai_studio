import type { AnalyzedTemplateStyleSpec } from '@/lib/longform-v2/youtube/templateStyleAnalysis'
import { clampSubCopyText } from '@/lib/longform-v2/youtube/thumbnailSubCopy'
import {
  clampCopyComboLine,
  MAIN_COPY_LINE2_VIRTUAL_KEY,
  type ThumbnailCopyCombo,
  type ThumbnailCopyComboSlotSpec,
} from '@/lib/longform-v2/youtube/thumbnailCopyCombos'
import { measureTextLineWidth, resolveSlotCanvasPivot } from './textCanvasAnchor'
import type { TextItem } from '@/app/WingsAIStudio/longform-v2/thumbnail-studio/YoutubeThumbnailManualEditor'
import { DEFAULT_PRO_TEMPLATE_ID, getProTemplate } from './catalog'
import { cloneExportFrameFromTemplate } from './exportFrame'
import { buildFallbackTemplateStyleSpec } from './fallbackStyle'
import { canonicalTemplateStyleSpec } from './templateLayout'
import { resolveTextLayersNoOverlap } from './textLayoutResolve'
import { applyThumbnailTextSizing } from './textLayoutScale'
import { fetchTemplatePreviewDataUrl } from './templateStyleAnalyze'
import { applyCatalogVisualStyleToTextItem, clampThumbnailSlotCopy, reapplyCatalogTextStyles } from './catalogTextStyle'
import { resolveTemplateTextSlots, catalogTextSlotsForDocument, usesCatalogTextLayout } from './templateTextSlots'
import type { ThumbnailProTemplate, ThumbnailStudioDocument, TemplateTextSlotDef } from './types'
import { DEFAULT_BACKGROUND_SCRIM, normalizeBackgroundScrim } from './backgroundScrim'
import {
  DEFAULT_IMAGE_GRADIENT_MASK,
  normalizeImageGradientMask,
  type StudioImageGradientMask,
} from './imageGradientMask'
import { STUDIO_CANVAS_H, STUDIO_CANVAS_W } from './types'
import type { StudioBackgroundScrim } from './types'
import { studioMaxZIndex } from './shapeLayers'

import { DEFAULT_THUMBNAIL_FONT_STACK } from '@/lib/longform-v2/thumbnail-bridge/bundledFonts'

const DEFAULT_FONT = DEFAULT_THUMBNAIL_FONT_STACK

/** 서브카피를 캔버스에 새 레이어로 추가할 때 기본 글자색 */
export const DEFAULT_SUB_COPY_FILL = '#42e736'

/** 추천 2줄 조합 — 위(1줄) / 아래(2줄) 기본 글자색 */
export const MAIN_COPY_COMBO_LINE1_FILL = '#ffffff'
export const MAIN_COPY_COMBO_LINE2_FILL = '#fde047'
/** 2줄 — 충격·반전 키워드일 때 레퍼런스 빨강 강조 */
export const MAIN_COPY_COMBO_LINE2_SHOCK_FILL = '#ef4444'

export function mainCopyLine2FillForText(line2: string): string {
  const t = line2.trim()
  if (
    /충격|진짜|TOP\d*|붕괴|망|비밀|폭발|대공황|거지|터짐|실직|개망|종교|미스터리|이유\??$|할까/u.test(
      t,
    )
  ) {
    return MAIN_COPY_COMBO_LINE2_SHOCK_FILL
  }
  return MAIN_COPY_COMBO_LINE2_FILL
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `stl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function slotToTextItem(
  slot: TemplateTextSlotDef,
  text: string,
  opts?: { measureCtx?: CanvasRenderingContext2D },
): TextItem {
  const anchor = slot.xnAnchor
  const needWidth =
    anchor === 'top-left' &&
    (slot.textAlign === 'center' || slot.textAlign === 'right')
  const textWidthPx =
    opts?.measureCtx && text.trim() && needWidth
      ? measureTextLineWidth(opts.measureCtx, text, slot.fontSize, slot.fontFamily)
      : undefined
  const { x, y } = resolveSlotCanvasPivot(slot, { textWidthPx })
  return {
    id: newId(),
    kind: 'text',
    text,
    x,
    y,
    fontSize: slot.fontSize,
    fontFamily: slot.fontFamily ?? DEFAULT_FONT,
    fill: slot.fill,
    stroke: slot.stroke,
    strokeWidth: slot.strokeWidth,
    textAlign: slot.textAlign,
    zIndex: slot.zIndex,
    boxBackground: slot.boxBackground ?? false,
    boxBackgroundColor: slot.boxBackgroundColor,
    boxPaddingX: slot.boxPaddingX,
    boxPaddingY: slot.boxPaddingY,
    boxRadius: slot.boxRadius,
    boxWidthPx: slot.boxWidthPx,
    rotation: slot.rotationDeg ?? 0,
    fillSpans: slot.fillSpans,
  }
}

/** 템플릿 적용 시 캔버스에 넣을 문구 — slotKey 우선 매칭, 샘플은 새 템플릿 샘플로 */
export function resolveTemplateSlotTexts(
  tpl: Pick<ThumbnailProTemplate, 'textSlots'>,
  existingLayers?: { text: string }[],
  previousTpl?: Pick<ThumbnailProTemplate, 'textSlots'> | null,
): string[] {
  const bySlotKey = new Map<string, string>()
  if (previousTpl && existingLayers?.length) {
    previousTpl.textSlots.forEach((slot, i) => {
      const kept = existingLayers[i]?.text?.trim()
      if (kept && !isTemplatePlaceholderText(slot, kept)) {
        bySlotKey.set(slot.slotKey, kept)
      }
    })
  }

  return tpl.textSlots.map((slot, i) => {
    const fromKey = bySlotKey.get(slot.slotKey)
    if (fromKey) return fromKey

    const kept = existingLayers?.[i]?.text?.trim()
    if (kept) {
      const refSlot = previousTpl?.textSlots[i] ?? slot
      if (!isTemplatePlaceholderText(refSlot, kept)) return kept
    }

    return slot.samplePreviewText?.trim() || ''
  })
}

export function createEmptyStudioDocument(templateId: string): ThumbnailStudioDocument {
  const tpl = getProTemplate(templateId) ?? getProTemplate(DEFAULT_PRO_TEMPLATE_ID)!
  const slotTexts = resolveTemplateSlotTexts(tpl)
  return {
    version: 1,
    templateId: tpl.id,
    background: { source: 'gradient', imageDataUrl: null, scrim: { ...DEFAULT_BACKGROUND_SCRIM } },
    textLayers: tpl.textSlots.map((s, i) => slotToTextItem(s, slotTexts[i] ?? '')),
    imageLayers: [],
    shapeLayers: [],
    overlayLayers: [],
    exportFrame: cloneExportFrameFromTemplate(tpl.id),
  }
}

/** 배경·문구·이미지·분석 스타일을 모두 비워 빈 캔버스로 */
export function clearStudioCanvas(doc: ThumbnailStudioDocument): ThumbnailStudioDocument {
  const tpl =
    getProTemplate(doc.templateId) ?? getProTemplate(DEFAULT_PRO_TEMPLATE_ID)!
  return {
    version: 1,
    templateId: tpl.id,
    templateStyle: undefined,
    background: { source: 'gradient', imageDataUrl: null, layout: null, scrim: { ...DEFAULT_BACKGROUND_SCRIM } },
    textLayers: tpl.textSlots.map((s) => slotToTextItem(s, '')),
    imageLayers: [],
    shapeLayers: [],
    overlayLayers: [],
  }
}

/** 업로드·AI 배경 이미지만 제거 — 그라데이션 배경으로 되돌림 (문구·스티커 등 유지) */
export function clearStudioBackgroundImage(doc: ThumbnailStudioDocument): ThumbnailStudioDocument {
  if (!doc.background.imageDataUrl) return doc
  return {
    ...doc,
    background: {
      ...doc.background,
      source: 'gradient',
      imageDataUrl: null,
      imageUpdatedAt: null,
      layout: null,
      layoutCustomized: false,
      locked: false,
      flipX: false,
      scrim: normalizeBackgroundScrim(doc.background.scrim),
    },
  }
}

/** 템플릿 적용 + 미리보기 PNG를 임시 배경으로 (AI 생성 전 검은 화면 방지) */
export async function applyTemplateToDocumentWithPreview(
  doc: ThumbnailStudioDocument,
  templateId: string,
  preserveTexts?: string[],
  styleSpec?: AnalyzedTemplateStyleSpec | null,
): Promise<ThumbnailStudioDocument> {
  let next = applyTemplateToDocument(doc, templateId, preserveTexts, styleSpec)
  const tpl = getProTemplate(templateId)
  if (!tpl?.previewImageUrl) return next
  try {
    const dataUrl = await fetchTemplatePreviewDataUrl(tpl.previewImageUrl)
    next = fillBackgroundImage(next, dataUrl, 'gradient', null)
  } catch {
    /* 미리보기 실패 시 그라데이션 유지 */
  }
  return next
}

export function applyTemplateToDocument(
  doc: ThumbnailStudioDocument,
  templateId: string,
  preserveTexts?: string[],
  styleSpec?: AnalyzedTemplateStyleSpec | null,
): ThumbnailStudioDocument {
  const tpl = getProTemplate(templateId)
  if (!tpl) return doc

  const previousTpl = doc.templateId === templateId ? null : getProTemplate(doc.templateId)
  const texts =
    preserveTexts ??
    resolveTemplateSlotTexts(tpl, doc.textLayers, previousTpl)

  const effectiveSpec: AnalyzedTemplateStyleSpec | null = styleSpec
    ? canonicalTemplateStyleSpec(templateId, styleSpec) ?? styleSpec
    : buildFallbackTemplateStyleSpec(templateId)

  const normalizedSpec =
    effectiveSpec && effectiveSpec.layoutFromGeneratedBackground
      ? canonicalTemplateStyleSpec(templateId, effectiveSpec) ?? effectiveSpec
      : effectiveSpec

  const slotDefs = tpl.textSlots
  const textLayers = slotDefs.map((slot, i) => slotToTextItem(slot, texts[i]?.trim() ?? ''))
  const applied: ThumbnailStudioDocument = {
    ...doc,
    templateId: tpl.id,
    templateStyle: normalizedSpec ?? undefined,
    textLayers,
    imageLayers: [],
    shapeLayers: [],
    overlayLayers: [],
    exportFrame: cloneExportFrameFromTemplate(tpl.id),
  }
  return syncTextLayersFromTemplateStyle(applied)
}

export function applyCopyLinesToDocument(
  doc: ThumbnailStudioDocument,
  lines: string[],
): ThumbnailStudioDocument {
  const next = [...doc.textLayers]
  for (let i = 0; i < next.length; i++) {
    const line = lines[i]?.trim()
    if (!line) continue
    const slot = getProTemplate(doc.templateId)?.textSlots[i]
    const text = slot ? clampThumbnailSlotCopy(line, slot.maxCharacters) : line
    next[i] = { ...next[i], text }
  }
  return { ...doc, textLayers: next }
}

/** 카탈로그 템플릿 슬롯 좌표·스타일로 텍스트 레이어 재정렬 */
export function syncTextLayersFromTemplateStyle(
  doc: ThumbnailStudioDocument,
): ThumbnailStudioDocument {
  const tpl = getProTemplate(doc.templateId)
  if (!tpl) return doc

  const slots = catalogTextSlotsForDocument(doc)
  let measureCtx: CanvasRenderingContext2D | null = null
  if (typeof OffscreenCanvas !== 'undefined') {
    const c = new OffscreenCanvas(STUDIO_CANVAS_W, STUDIO_CANVAS_H)
    measureCtx = c.getContext('2d') as CanvasRenderingContext2D | null
  } else if (typeof document !== 'undefined') {
    const c = document.createElement('canvas')
    c.width = STUDIO_CANVAS_W
    c.height = STUDIO_CANVAS_H
    measureCtx = c.getContext('2d')
  }

  const next = slots.map((slot, i) => {
    const layer = doc.textLayers[i]
    const text = layer?.text ?? ''
    const item = slotToTextItem(slot, text, { measureCtx: measureCtx ?? undefined })
    return layer
      ? {
          ...item,
          id: layer.id,
          text,
          letterSpacing: layer.letterSpacing,
          lineHeight: layer.lineHeight,
          scaleX: layer.scaleX,
          visible: layer.visible,
        }
      : item
  })

  if (doc.textLayers.length > slots.length) {
    for (let i = slots.length; i < doc.textLayers.length; i++) {
      next.push(doc.textLayers[i]!)
    }
  }

  if (usesCatalogTextLayout(doc)) {
    let out = { ...doc, textLayers: next }
    out = applyThumbnailTextSizing(out)
    out = resolveTextLayersNoOverlap(out)
    return reapplyCatalogTextStyles(out)
  }

  let out = applyThumbnailTextSizing({ ...doc, textLayers: next })
  const sizedSlots = resolveTemplateTextSlots(out.templateId, out.templateStyle)
  const positioned = sizedSlots.map((slot, i) => {
    const layer = out.textLayers[i]
    const text = layer?.text ?? ''
    const item = slotToTextItem(slot, text, { measureCtx: measureCtx ?? undefined })
    const fontSize = layer?.fontSize && layer.fontSize > 0 ? layer.fontSize : item.fontSize
    const styled = applyCatalogVisualStyleToTextItem(
      layer
        ? {
            ...item,
            id: layer.id,
            text,
            letterSpacing: layer.letterSpacing,
            lineHeight: layer.lineHeight,
            scaleX: layer.scaleX,
            visible: layer.visible,
          }
        : item,
      slot,
      fontSize,
    )
    return styled
  })
  if (out.textLayers.length > positioned.length) {
    for (let i = positioned.length; i < out.textLayers.length; i++) {
      positioned.push(out.textLayers[i]!)
    }
  }
  out = resolveTextLayersNoOverlap({ ...out, textLayers: positioned })
  return reapplyCatalogTextStyles(out)
}

function applyReplacementMapToTextLayers(
  tpl: ThumbnailProTemplate,
  layers: TextItem[],
  replacements: Record<string, string>,
): TextItem[] {
  const next = [...layers]
  while (next.length < tpl.textSlots.length) {
    const slot = tpl.textSlots[next.length]
    next.push(slotToTextItem(slot, ''))
  }

  tpl.textSlots.forEach((slot, i) => {
    let rep = replacements[slot.slotKey]?.trim()
    if (!rep) {
      for (const [key, val] of Object.entries(replacements)) {
        if (key.toLowerCase() === slot.slotKey.toLowerCase()) {
          rep = val.trim()
          break
        }
      }
    }
    if (!rep || !next[i]) return
    next[i] = {
      ...next[i],
      text: clampThumbnailSlotCopy(rep, slot.maxCharacters),
    }
  })

  return next
}

/** 템플릿 슬롯 키별 AI replacement 적용 */
export function applySlotReplacementsToDocument(
  doc: ThumbnailStudioDocument,
  replacements: Record<string, string>,
): ThumbnailStudioDocument {
  const tpl = getProTemplate(doc.templateId)
  if (!tpl) return doc
  if (!Object.values(replacements).some((v) => v?.trim())) return doc

  let layers = applyReplacementMapToTextLayers(tpl, doc.textLayers, replacements)
  let out = applyThumbnailTextSizing({ ...doc, textLayers: layers })
  out = syncTextLayersFromTemplateStyle(out)
  /** sync가 좌표만 맞추고 문구는 유지해야 하나, 슬롯 수·순서 불일치 시 재적용 */
  layers = applyReplacementMapToTextLayers(tpl, out.textLayers, replacements)
  out = applyThumbnailTextSizing({ ...out, textLayers: layers })
  return resolveTextLayersNoOverlap(out)
}

function isTemplatePlaceholderText(slot: TemplateTextSlotDef, text: string): boolean {
  const t = text.trim()
  if (!t) return true
  const sample = slot.samplePreviewText?.trim()
  if (sample && t === sample) return true
  if (t === slot.label.trim()) return true
  return false
}

/** 배경 AI용 — 문구 슬롯에서 샘플·라벨 제외한 후킹 텍스트 */
export function collectTopicHookCopyLines(doc: ThumbnailStudioDocument): string[] {
  const tpl = getProTemplate(doc.templateId)
  if (!tpl) {
    return doc.textLayers.map((l) => l.text.trim()).filter(Boolean)
  }
  const lines: string[] = []
  tpl.textSlots.forEach((slot, i) => {
    const t = doc.textLayers[i]?.text?.trim() ?? ''
    if (!t || isTemplatePlaceholderText(slot, t)) return
    lines.push(t)
  })
  return lines
}

export function buildCopywriterFramesFromDocument(
  doc: ThumbnailStudioDocument,
): { frameId: string; layers: { textKey: string; label: string; original: string; maxCharacters: number }[] } | null {
  const tpl = getProTemplate(doc.templateId)
  if (!tpl) return null
  return {
    frameId: tpl.id,
    layers: tpl.textSlots.map((slot, i) => ({
      textKey: slot.slotKey,
      label:
        slot.slotKey === 'hook'
          ? `${slot.label} — 상단 훅(짧은 충격)`
          : slot.slotKey === 'highlight'
            ? `${slot.label} — 중간 강조`
            : slot.slotKey === 'sub'
              ? `${slot.label} — 3번째 줄`
              : slot.slotKey === 'main_title'
                ? `${slot.label} — 하단 메인(필수, 가장 큼)`
                : `${slot.label} (좌측 ${i + 1}번째 줄)`,
      /** 샘플·라벨은 레이아웃용 — AI가 대본에서 새 카피를 쓰도록 original 비움 */
      original: isTemplatePlaceholderText(slot, doc.textLayers[i]?.text ?? '')
        ? ''
        : (doc.textLayers[i]?.text ?? '').trim(),
      maxCharacters: slot.maxCharacters,
    })),
  }
}

type BottomMainCopyPair = {
  line1Index: number
  line2Index: number
  line1Key: string
  line2Key: string
  line1Label: string
  line2Label: string
  line1Max: number
  line2Max: number
  virtualLine2: boolean
}

function buildBottomMainCopyPair(
  tpl: ThumbnailProTemplate,
  line1Index: number,
  line2Index: number,
  virtualLine2: boolean,
): BottomMainCopyPair {
  const line1Slot = tpl.textSlots[line1Index]!
  const line2Slot = virtualLine2 ? line1Slot : tpl.textSlots[line2Index]!
  return {
    line1Index,
    line2Index,
    line1Key: line1Slot.slotKey,
    line2Key: virtualLine2 ? MAIN_COPY_LINE2_VIRTUAL_KEY : line2Slot.slotKey,
    line1Label: line1Slot.label,
    line2Label: virtualLine2 ? '두번째 메인 문구' : line2Slot.label,
    line1Max: line1Slot.maxCharacters,
    line2Max: virtualLine2 ? line1Slot.maxCharacters : line2Slot.maxCharacters,
    virtualLine2,
  }
}

/** 썸네일 하단 2줄 메인 카피 슬롯 (hook·sub·accent 제외, 장식 hook은 건너뜀) */
function resolveBottomMainCopyPair(tpl: ThumbnailProTemplate): BottomMainCopyPair | null {
  const slots = tpl.textSlots
  const slotAt = (i: number) => slots[i]!
  const findKey = (key: string) => slots.findIndex((s) => s.slotKey === key)

  const highlightIdx = findKey('highlight')
  const mainIdx = findKey('main_title')
  const hookIdx = findKey('hook')

  if (highlightIdx >= 0 && mainIdx >= 0) {
    const [topIdx, bottomIdx] =
      slotAt(highlightIdx).yn <= slotAt(mainIdx).yn
        ? [highlightIdx, mainIdx]
        : [mainIdx, highlightIdx]
    return buildBottomMainCopyPair(tpl, topIdx, bottomIdx, false)
  }

  if (hookIdx >= 0 && mainIdx >= 0 && highlightIdx < 0) {
    const hook = slotAt(hookIdx)
    const main = slotAt(mainIdx)
    if (hook.yn >= 0.5 && main.yn > hook.yn) {
      return buildBottomMainCopyPair(tpl, hookIdx, mainIdx, false)
    }
    if (hook.yn < 0.45) {
      return buildBottomMainCopyPair(tpl, mainIdx, -1, true)
    }
  }

  if (hookIdx >= 0 && highlightIdx >= 0 && mainIdx < 0) {
    const hook = slotAt(hookIdx)
    const highlight = slotAt(highlightIdx)
    const [topIdx, bottomIdx] =
      hook.yn <= highlight.yn ? [hookIdx, highlightIdx] : [highlightIdx, hookIdx]
    return buildBottomMainCopyPair(tpl, topIdx, bottomIdx, false)
  }

  const bottom = slots
    .map((slot, i) => ({ slot, i }))
    .filter(({ slot }) => slot.slotKey !== 'sub' && slot.slotKey !== 'accent')
    .filter(({ slot }) => slot.yn >= 0.45)
    .sort((a, b) => a.slot.yn - b.slot.yn)

  if (bottom.length >= 2) {
    const top = bottom.length >= 3 ? bottom[bottom.length - 2]! : bottom[0]!
    const bot = bottom[bottom.length - 1]!
    return buildBottomMainCopyPair(tpl, top.i, bot.i, false)
  }

  if (mainIdx >= 0) {
    return buildBottomMainCopyPair(tpl, mainIdx, -1, true)
  }

  const nonSub = slots
    .map((slot, i) => ({ slot, i }))
    .filter(({ slot }) => slot.slotKey !== 'sub' && slot.slotKey !== 'accent')
  if (nonSub.length >= 2) {
    return buildBottomMainCopyPair(tpl, nonSub[0]!.i, nonSub[1]!.i, false)
  }

  return null
}

function patchMainCopyLayerText(layer: TextItem, text: string, fill: string): TextItem {
  return {
    ...layer,
    text,
    fill,
    fillSpans: undefined,
  }
}

function ensureTemplateTextLayerCount(
  tpl: ThumbnailProTemplate,
  layers: TextItem[],
): TextItem[] {
  const next = [...layers]
  while (next.length < tpl.textSlots.length) {
    next.push(slotToTextItem(tpl.textSlots[next.length]!, ''))
  }
  return next
}

/** AI 2줄 조합 — 메인 카피 2줄 슬롯 (서브·상단 훅 제외) */
export function resolveTwoLineCopySlotSpec(
  doc: ThumbnailStudioDocument,
): ThumbnailCopyComboSlotSpec | null {
  const tpl = getProTemplate(doc.templateId)
  const frame = buildCopywriterFramesFromDocument(doc)
  if (!tpl || !frame?.layers.length) return null

  const pair = resolveBottomMainCopyPair(tpl)
  if (!pair) return null

  const labelFor = (key: string, fallback: string) =>
    frame.layers.find((l) => l.textKey === key)?.label ?? fallback

  return {
    line1Key: pair.line1Key,
    line1Label: labelFor(pair.line1Key, pair.line1Label),
    line1Max: pair.line1Max,
    line2Key: pair.line2Key,
    line2Label: pair.virtualLine2 ? pair.line2Label : labelFor(pair.line2Key, pair.line2Label),
    line2Max: pair.line2Max,
  }
}

function addMainCopySecondLineLayer(
  doc: ThumbnailStudioDocument,
  mainSlotIndex: number,
  line2Text: string,
  maxChars: number,
): ThumbnailStudioDocument {
  const tpl = getProTemplate(doc.templateId)
  if (!tpl || mainSlotIndex < 0) return doc

  const mainSlot = tpl.textSlots[mainSlotIndex]!
  const mainLayer = doc.textLayers[mainSlotIndex]
  const text = clampCopyComboLine(line2Text, maxChars)

  const existingIdx = doc.textLayers.findIndex(
    (t, i) =>
      i !== mainSlotIndex &&
      Boolean(t.text.trim()) &&
      mainLayer != null &&
      t.y >= mainLayer.y + Math.round(mainLayer.fontSize * 0.45) &&
      t.y <= mainLayer.y + Math.round(mainLayer.fontSize * 1.6),
  )

  const line2Fill = mainCopyLine2FillForText(text)

  if (existingIdx >= 0) {
    const textLayers = [...doc.textLayers]
    textLayers[existingIdx] = patchMainCopyLayerText(
      textLayers[existingIdx]!,
      text,
      line2Fill,
    )
    return { ...doc, textLayers }
  }

  const secondSlot: TemplateTextSlotDef = {
    ...mainSlot,
    yn: Math.min(0.93, mainSlot.yn + 0.12),
    zIndex: (mainSlot.zIndex ?? 21) - 1,
  }
  let newItem = slotToTextItem(secondSlot, text)
  if (mainLayer) {
    newItem = {
      ...newItem,
      x: mainLayer.x,
      y: mainLayer.y + Math.round(mainLayer.fontSize * 1.08),
      textAlign: mainLayer.textAlign ?? newItem.textAlign,
      fontSize: mainLayer.fontSize,
      fill: line2Fill,
      stroke: mainLayer.stroke,
      strokeWidth: mainLayer.strokeWidth,
      fillSpans: undefined,
    }
  }

  return { ...doc, textLayers: [...doc.textLayers, newItem] }
}

/** AI 추천 2줄 조합 → 하단 메인 2줄에 문구만 적용 (크기·테두리·위치 유지) */
export function applyCopyComboToDocument(
  doc: ThumbnailStudioDocument,
  combo: ThumbnailCopyCombo,
  specOverride?: ThumbnailCopyComboSlotSpec | null,
): ThumbnailStudioDocument {
  const tpl = getProTemplate(doc.templateId)
  if (!tpl) return doc

  const pair = resolveBottomMainCopyPair(tpl)
  if (!pair) return doc

  const spec = specOverride ?? resolveTwoLineCopySlotSpec(doc)
  if (!spec) return doc

  const line1Text = clampCopyComboLine(combo.line1, spec.line1Max)
  const line2Text = clampCopyComboLine(combo.line2, spec.line2Max)

  let textLayers = ensureTemplateTextLayerCount(tpl, doc.textLayers)
  const line1Layer = textLayers[pair.line1Index]
  if (!line1Layer) return doc

  textLayers[pair.line1Index] = patchMainCopyLayerText(
    line1Layer,
    line1Text,
    MAIN_COPY_COMBO_LINE1_FILL,
  )

  if (pair.virtualLine2 || spec.line2Key === MAIN_COPY_LINE2_VIRTUAL_KEY) {
    return addMainCopySecondLineLayer(
      { ...doc, textLayers },
      pair.line1Index,
      line2Text,
      spec.line2Max,
    )
  }

  const line2Layer = textLayers[pair.line2Index]
  if (!line2Layer) return { ...doc, textLayers }

  textLayers[pair.line2Index] = patchMainCopyLayerText(
    line2Layer,
    line2Text,
    mainCopyLine2FillForText(line2Text),
  )

  return { ...doc, textLayers }
}

const SUB_COPY_SLOT_PRIORITY = ['sub', 'accent'] as const

/** AI 서브카피 — 괄호·라벨 슬롯 (sub · accent 우선) */
export function resolveSubCopySlotSpec(
  doc: ThumbnailStudioDocument,
): import('../../../shared/thumbnailSubCopy').ThumbnailSubCopySlotSpec | null {
  const frame = buildCopywriterFramesFromDocument(doc)
  if (!frame) return null

  for (const key of SUB_COPY_SLOT_PRIORITY) {
    const layer = frame.layers.find((l) => l.textKey === key)
    if (layer) {
      return {
        subKey: layer.textKey,
        subLabel: layer.label,
        subMax: layer.maxCharacters,
      }
    }
  }

  const candidates = frame.layers.filter(
    (l) =>
      l.textKey !== 'main_title' &&
      l.textKey !== 'highlight' &&
      l.textKey !== 'hook' &&
      l.maxCharacters <= 20,
  )
  const smallest = candidates.sort((a, b) => a.maxCharacters - b.maxCharacters)[0]
  if (smallest) {
    return {
      subKey: smallest.textKey,
      subLabel: smallest.label,
      subMax: smallest.maxCharacters,
    }
  }

  return null
}

/** 서브카피를 새 텍스트 레이어로 캔버스에 추가 (슬롯 교체와 별개) */
export function addSubCopyAsTextLayerToDocument(
  doc: ThumbnailStudioDocument,
  rawText: string,
  maxChars?: number,
): { document: ThumbnailStudioDocument; layerId: string } {
  const spec = resolveSubCopySlotSpec(doc)
  const text = clampSubCopyText(rawText, maxChars ?? spec?.subMax ?? 24)
  const tpl = getProTemplate(doc.templateId)
  let ref: TextItem | undefined
  if (spec && tpl) {
    const idx = tpl.textSlots.findIndex((s) => s.slotKey === spec.subKey)
    if (idx >= 0) ref = doc.textLayers[idx]
  }
  const stack = doc.textLayers.filter((t) => t.text.trim().startsWith('(')).length
  const t: TextItem = {
    id: newId(),
    kind: 'text',
    text,
    x: ref?.x ?? STUDIO_CANVAS_W * 0.06,
    y: (ref?.y ?? STUDIO_CANVAS_H * 0.14) + Math.min(stack, 5) * 52,
    fontSize: ref ? Math.max(32, Math.round(ref.fontSize * 0.52)) : 48,
    fontFamily: ref?.fontFamily ?? DEFAULT_FONT,
    fill: DEFAULT_SUB_COPY_FILL,
    stroke: ref?.stroke ?? '#000000',
    strokeWidth: ref ? Math.max(8, Math.round((ref.strokeWidth ?? 14) * 0.6)) : 14,
    textAlign: ref?.textAlign ?? 'left',
    ...(ref?.rotation != null ? { rotation: ref.rotation } : {}),
    zIndex: Math.min(99, studioMaxZIndex(doc) + 1),
  }
  return {
    document: { ...doc, textLayers: [...doc.textLayers, t] },
    layerId: t.id,
  }
}

export function fillBackgroundImage(
  doc: ThumbnailStudioDocument,
  imageDataUrl: string,
  source: 'gradient' | 'ai' | 'upload',
  layout?: { x: number; y: number; width: number; height: number } | null,
): ThumbnailStudioDocument {
  const imageChanged = doc.background.imageDataUrl !== imageDataUrl
  const nextLayout =
    layout !== undefined ? layout : imageChanged ? null : doc.background.layout
  const lockOnAiGenerate = source === 'ai' && imageChanged

  return {
    ...doc,
    background: {
      ...doc.background,
      source,
      imageDataUrl,
      ...(imageChanged ? { imageUpdatedAt: new Date().toISOString() } : {}),
      layout: nextLayout ?? null,
      ...(imageChanged ? { layoutCustomized: false, flipX: false } : {}),
      scrim: normalizeBackgroundScrim(doc.background.scrim),
      ...(lockOnAiGenerate ? { locked: true } : {}),
    },
  }
}

export function updateBackgroundScrim(
  doc: ThumbnailStudioDocument,
  patch: Partial<StudioBackgroundScrim>,
): ThumbnailStudioDocument {
  const prev = normalizeBackgroundScrim(doc.background.scrim)
  const turningOn = patch.enabled === true && !prev.enabled
  const scrim = turningOn
    ? normalizeBackgroundScrim({ ...DEFAULT_BACKGROUND_SCRIM, enabled: true })
    : normalizeBackgroundScrim({ ...prev, ...patch })
  return {
    ...doc,
    background: {
      ...doc.background,
      scrim,
    },
  }
}

export function updateBackgroundGradientMask(
  doc: ThumbnailStudioDocument,
  patch: Partial<StudioImageGradientMask>,
): ThumbnailStudioDocument {
  const prev = normalizeImageGradientMask(doc.background.gradientMask)
  const turningOn = patch.enabled === true && !prev.enabled
  const gradientMask = turningOn
    ? normalizeImageGradientMask({ ...DEFAULT_IMAGE_GRADIENT_MASK, enabled: true })
    : normalizeImageGradientMask({ ...prev, ...patch })
  return {
    ...doc,
    background: {
      ...doc.background,
      gradientMask,
    },
  }
}

export function updateBackgroundLayout(
  doc: ThumbnailStudioDocument,
  layout: { x: number; y: number; width: number; height: number },
  userAdjusted = false,
): ThumbnailStudioDocument {
  return {
    ...doc,
    background: {
      ...doc.background,
      layout,
      layoutCustomized: userAdjusted ? true : (doc.background.layoutCustomized ?? false),
      scrim: normalizeBackgroundScrim(doc.background.scrim),
    },
  }
}

export { normalizeBackgroundScrim } from './backgroundScrim'

export { resolveTopicBackgroundPrompt as resolveBackgroundPrompt } from './templateLayout'
export { buildLayoutOnlyImageStyleHint as buildImageStyleFromTemplateSpec } from './templateLayout'

export function sortLayersByZ(doc: ThumbnailStudioDocument): {
  texts: TextItem[]
  images: ThumbnailStudioDocument['imageLayers']
} {
  return {
    texts: [...doc.textLayers].sort((a, b) => a.zIndex - b.zIndex),
    images: [...doc.imageLayers].filter((x) => x.visible).sort((a, b) => a.zIndex - b.zIndex),
  }
}
