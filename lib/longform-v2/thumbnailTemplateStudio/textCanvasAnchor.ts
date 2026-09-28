import type { CanvasTextAlign } from '@/app/WingsAIStudio/longform-v2/thumbnail-studio/YoutubeThumbnailManualEditor'
import { STUDIO_CANVAS_H, STUDIO_CANVAS_W } from './types'

/** xn·yn 정규화 좌표가 가리키는 기준점 */
export type XnAnchorKind = 'center' | 'top-left' | 'right-edge'
export type YnAnchorKind = 'center' | 'top-left'

export type TextSlotGeometryInput = {
  xn: number
  yn: number
  fontSize: number
  textAlign: CanvasTextAlign
  boxBackground?: boolean
  boxPaddingY?: number
  boxWidthPx?: number
  xnAnchor?: XnAnchorKind
  ynAnchor?: YnAnchorKind
  pivotXPx?: number
  pivotYPx?: number
}

import { DEFAULT_THUMBNAIL_FONT_STACK, canvasFontString } from '@/lib/longform-v2/thumbnail-bridge/bundledFonts'

const DEFAULT_FONT = DEFAULT_THUMBNAIL_FONT_STACK

export function defaultXnAnchorForAlign(textAlign: CanvasTextAlign): XnAnchorKind {
  if (textAlign === 'center') return 'center'
  if (textAlign === 'right') return 'right-edge'
  return 'top-left'
}

/**
 * 캔버스 textAlign·textBaseline:middle 기준 피벗 (it.x, it.y).
 * - ynAnchor center: yn = 글자 박스 세로 중앙 (템플릿3 등)
 * - ynAnchor top-left: yn = 박스 위쪽 → 피벗은 세로 중앙으로 변환 (AI 비전)
 */
/** 실측 피벗이 있으면 우선, 없으면 xn/yn → 피벗 변환 */
export function resolveSlotCanvasPivot(
  slot: TextSlotGeometryInput,
  opts?: Parameters<typeof resolveCanvasTextPivot>[1],
): { x: number; y: number } {
  if (slot.pivotXPx != null && slot.pivotYPx != null) {
    return { x: slot.pivotXPx, y: slot.pivotYPx }
  }
  return resolveCanvasTextPivot(slot, opts)
}

export function resolveCanvasTextPivot(
  slot: TextSlotGeometryInput,
  opts?: {
    canvasW?: number
    canvasH?: number
    /** 측정된 한 줄 텍스트 너비(px). top-left xn + center 정렬 변환에 필요 */
    textWidthPx?: number
  },
): { x: number; y: number } {
  const canvasW = opts?.canvasW ?? STUDIO_CANVAS_W
  const canvasH = opts?.canvasH ?? STUDIO_CANVAS_H
  const padY = slot.boxPaddingY ?? 10
  const lineH = slot.fontSize * 1.1
  const boxH = slot.boxBackground ? lineH + padY * 2 : lineH

  const ynAnchor = slot.ynAnchor ?? 'top-left'
  const y =
    ynAnchor === 'center'
      ? slot.yn * canvasH
      : slot.yn * canvasH + boxH / 2

  const xnAnchor =
    slot.boxWidthPx && slot.textAlign === 'center'
      ? 'center'
      : (slot.xnAnchor ?? defaultXnAnchorForAlign(slot.textAlign))
  const w = Math.max(0, opts?.textWidthPx ?? 0)
  let x = slot.xn * canvasW

  if (slot.textAlign === 'center') {
    if (xnAnchor === 'top-left') x = slot.xn * canvasW + w / 2
  } else if (slot.textAlign === 'right') {
    if (xnAnchor === 'top-left') x = slot.xn * canvasW + w
    /* right-edge: xn은 오른쪽 기준 */
  } else {
    /* left: top-left xn이 피벗 */
    if (xnAnchor === 'center') x = slot.xn * canvasW - w / 2
    if (xnAnchor === 'right-edge') x = slot.xn * canvasW - w
  }

  return { x, y }
}

export function measureTextLineWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontSize: number,
  fontFamily?: string,
  letterSpacing = 0,
  scaleX = 100,
): number {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (!lines.some((l) => l.trim())) return 0
  ctx.save()
  ctx.font = canvasFontString(fontSize, fontFamily ?? DEFAULT_FONT)
  ctx.letterSpacing = `${letterSpacing}px`
  let max = 0
  for (const line of lines) {
    max = Math.max(max, ctx.measureText(line).width)
  }
  ctx.restore()
  return max * (scaleX / 100)
}
