import { measureTextLineWidth, resolveSlotCanvasPivot } from './textCanvasAnchor'
import { applyCatalogVisualStyleToTextItem } from './catalogTextStyle'
import { measureTextOuterBox } from './textGeometry'
import { getProTemplate } from './catalog'
import { resolveTemplateTextSlots } from './templateTextSlots'
import { STUDIO_CANVAS_H, STUDIO_CANVAS_W } from './types'
import type { ThumbnailStudioDocument } from './types'
import type { TextItem } from '@/app/WingsAIStudio/longform-v2/thumbnail-studio/YoutubeThumbnailManualEditor'

const GAP_PX_DEFAULT = 20
const GAP_PX_TIGHT = 10

function stackGapPx(templateId: string): number {
  if (templateId === 'historical_hook_right') return GAP_PX_TIGHT
  return GAP_PX_DEFAULT
}
const MAX_PASSES = 20
const BOTTOM_MARGIN = 20
const TOP_MARGIN = 10

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (typeof OffscreenCanvas !== 'undefined') {
    const c = new OffscreenCanvas(STUDIO_CANVAS_W, STUDIO_CANVAS_H)
    return c.getContext('2d') as CanvasRenderingContext2D | null
  }
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas')
    c.width = STUDIO_CANVAS_W
    c.height = STUDIO_CANVAS_H
    return c.getContext('2d')
  }
  return null
}

function boxesOverlap(
  a: { top: number; bottom: number },
  b: { top: number; bottom: number },
  gap: number,
): boolean {
  return b.top < a.bottom + gap
}

function catalogFontFloor(doc: ThumbnailStudioDocument, index: number): number {
  const tpl = getProTemplate(doc.templateId)
  const catalog = tpl?.textSlots[index]?.fontSize
  return Math.max(22, Math.round((catalog ?? 48) * 0.72))
}

function applySlotGeometryToLayers(
  doc: ThumbnailStudioDocument,
  items: TextItem[],
  measureCtx: CanvasRenderingContext2D | null,
): TextItem[] {
  const slots = resolveTemplateTextSlots(doc.templateId, doc.templateStyle)
  const next = [...items]
  for (let i = 0; i < next.length; i++) {
    const slot = slots[i]
    if (!slot) continue
    const text = next[i].text
    const fontSize = next[i].fontSize > 0 ? next[i].fontSize : slot.fontSize
    const textWidthPx =
      measureCtx && text.trim()
        ? measureTextLineWidth(
            measureCtx,
            text,
            fontSize,
            slot.fontFamily ?? next[i].fontFamily,
          )
        : undefined
    const { x, y } = resolveSlotCanvasPivot({ ...slot, fontSize }, { textWidthPx })
    next[i] = applyCatalogVisualStyleToTextItem(
      {
        ...next[i],
        x,
        y,
        textAlign: slot.textAlign,
        fontSize,
        rotation: slot.rotationDeg ?? next[i].rotation ?? 0,
      },
      slot,
      fontSize,
    )
  }
  return next
}

function activeTextIndices(items: TextItem[]): number[] {
  return items.map((t, i) => (t.text.trim() ? i : -1)).filter((i) => i >= 0)
}

function sortByTop(ctx: CanvasRenderingContext2D, items: TextItem[], indices: number[]): number[] {
  return [...indices].sort(
    (a, b) => measureTextOuterBox(ctx, items[a]).top - measureTextOuterBox(ctx, items[b]).top,
  )
}

function stackVerticalBounds(
  ctx: CanvasRenderingContext2D,
  items: TextItem[],
  indices: number[],
): { minTop: number; maxBottom: number } {
  let minTop = STUDIO_CANVAS_H
  let maxBottom = 0
  for (const i of indices) {
    const box = measureTextOuterBox(ctx, items[i])
    minTop = Math.min(minTop, box.top)
    maxBottom = Math.max(maxBottom, box.bottom)
  }
  return { minTop, maxBottom }
}

function shiftActiveLayers(items: TextItem[], indices: number[], dy: number): TextItem[] {
  if (Math.abs(dy) < 0.5) return items
  const next = [...items]
  for (const i of indices) {
    next[i] = { ...next[i], y: next[i].y + dy }
  }
  return next
}

/** 겹침 해소: 아래로 밀기만 (크기는 유지) */
function pushApartOverlapping(
  ctx: CanvasRenderingContext2D,
  items: TextItem[],
  indices: number[],
  gapPx: number,
): TextItem[] {
  let next = [...items]
  let order = sortByTop(ctx, next, indices)

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let changed = false
    order = sortByTop(ctx, next, indices)

    for (let j = 1; j < order.length; j++) {
      const prevI = order[j - 1]
      const curI = order[j]
      const prevBox = measureTextOuterBox(ctx, next[prevI])
      const curBox = measureTextOuterBox(ctx, next[curI])

      if (boxesOverlap(prevBox, curBox, gapPx)) {
        const dy = prevBox.bottom + gapPx - curBox.top
        next[curI] = { ...next[curI], y: next[curI].y + dy }
        changed = true
      }
    }

    if (!changed) break
  }

  return next
}

/** 캔버스 안으로 전체 스택 이동 (크기 유지) */
function fitStackInsideCanvas(
  ctx: CanvasRenderingContext2D,
  items: TextItem[],
  indices: number[],
): TextItem[] {
  let next = [...items]
  const { maxBottom } = stackVerticalBounds(ctx, next, indices)

  if (maxBottom > STUDIO_CANVAS_H - BOTTOM_MARGIN) {
    const dy = maxBottom - (STUDIO_CANVAS_H - BOTTOM_MARGIN)
    next = shiftActiveLayers(next, indices, -dy)
  }

  const afterBottom = stackVerticalBounds(ctx, next, indices)
  if (afterBottom.minTop < TOP_MARGIN) {
    next = shiftActiveLayers(next, indices, TOP_MARGIN - afterBottom.minTop)
  }

  return next
}

/**
 * 세로 공간이 부족할 때만 모든 줄에 동일 비율로 축소 (상대 크기 유지).
 * 카탈로그 하한 아래로는 줄이지 않음.
 */
function uniformScaleToFitHeight(
  ctx: CanvasRenderingContext2D,
  doc: ThumbnailStudioDocument,
  items: TextItem[],
  indices: number[],
): TextItem[] {
  let next = [...items]
  const available = STUDIO_CANVAS_H - TOP_MARGIN - BOTTOM_MARGIN
  let { minTop, maxBottom } = stackVerticalBounds(ctx, next, indices)
  let stackH = maxBottom - minTop

  if (stackH <= available + 2) return next

  const scale = available / stackH
  if (scale >= 0.98) return next

  next = next.map((item, i) => {
    if (!indices.includes(i) || !item.text.trim()) return item
    const floor = catalogFontFloor(doc, i)
    const nextSize = Math.max(floor, Math.round(item.fontSize * scale))
    if (nextSize >= item.fontSize) return item
    const ratio = nextSize / Math.max(item.fontSize, 1)
    return {
      ...item,
      fontSize: nextSize,
      strokeWidth: Math.max(1, Math.round(item.strokeWidth * ratio)),
    }
  })

  const gapPx = stackGapPx(doc.templateId)
  next = pushApartOverlapping(ctx, next, indices, gapPx)
  next = fitStackInsideCanvas(ctx, next, indices)

  ;({ minTop, maxBottom } = stackVerticalBounds(ctx, next, indices))
  stackH = maxBottom - minTop
  if (stackH > available + 4) {
    const scale2 = available / stackH
    next = next.map((item, i) => {
      if (!indices.includes(i) || !item.text.trim()) return item
      const floor = catalogFontFloor(doc, i)
      const nextSize = Math.max(floor, Math.round(item.fontSize * scale2))
      if (nextSize >= item.fontSize) return item
      const ratio = nextSize / Math.max(item.fontSize, 1)
      return {
        ...item,
        fontSize: nextSize,
        strokeWidth: Math.max(1, Math.round(item.strokeWidth * ratio)),
      }
    })
  }

  return next
}

/**
 * 글자 크기는 최대한 유지하고, 겹치면 아래로 밀고 캔버스 밖이면 전체 이동.
 * 정말 공간이 부족할 때만 균일 축소.
 */
export function resolveTextLayersNoOverlap(doc: ThumbnailStudioDocument): ThumbnailStudioDocument {
  const ctx = getMeasureContext()
  let items = applySlotGeometryToLayers(doc, [...doc.textLayers], ctx)

  const gapPx = stackGapPx(doc.templateId)

  if (!ctx) {
    return { ...doc, textLayers: items }
  }

  const activeIdx = activeTextIndices(items)

  if (activeIdx.length >= 2) {
    items = pushApartOverlapping(ctx, items, activeIdx, gapPx)
    items = fitStackInsideCanvas(ctx, items, activeIdx)

    let order = sortByTop(ctx, items, activeIdx)
    let stillOverlap = false
    for (let j = 1; j < order.length; j++) {
      const prevBox = measureTextOuterBox(ctx, items[order[j - 1]])
      const curBox = measureTextOuterBox(ctx, items[order[j]])
      if (boxesOverlap(prevBox, curBox, gapPx - 2)) stillOverlap = true
    }

    const { maxBottom } = stackVerticalBounds(ctx, items, activeIdx)
    const overflowsCanvas = maxBottom > STUDIO_CANVAS_H - BOTTOM_MARGIN + 2

    if (stillOverlap || overflowsCanvas) {
      items = uniformScaleToFitHeight(ctx, doc, items, activeIdx)
    }
  } else if (activeIdx.length === 1) {
    items = fitStackInsideCanvas(ctx, items, activeIdx)
  }

  return { ...doc, textLayers: items }
}
