import type { TextItem } from '@/app/WingsAIStudio/longform-v2/thumbnail-studio/YoutubeThumbnailManualEditor'
import { canvasFontString } from '@/lib/longform-v2/thumbnail-bridge/bundledFonts'
import { buildTextFillSegments, type TextFillSpan } from './textFillSpans'

export const DEFAULT_TEXT_LETTER_SPACING = 0
export const DEFAULT_TEXT_LINE_HEIGHT = 1.21
export const DEFAULT_TEXT_SCALE_X = 100

export type StudioTextTypography = {
  letterSpacing: number
  lineHeight: number
  scaleX: number
}

export function normalizeTextContent(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

export function textHasVisibleContent(text: string): boolean {
  return normalizeTextContent(text).trim().length > 0
}

export function splitTextLines(text: string): string[] {
  const normalized = normalizeTextContent(text)
  if (!normalized) return []
  return normalized.split('\n')
}

export function resolveTextTypography(
  it: Pick<TextItem, 'letterSpacing' | 'lineHeight' | 'scaleX'>,
): StudioTextTypography {
  const letterSpacing =
    typeof it.letterSpacing === 'number' && Number.isFinite(it.letterSpacing)
      ? Math.max(-40, Math.min(80, it.letterSpacing))
      : DEFAULT_TEXT_LETTER_SPACING
  const lineHeight =
    typeof it.lineHeight === 'number' && Number.isFinite(it.lineHeight) && it.lineHeight > 0
      ? Math.max(0.6, Math.min(3, it.lineHeight))
      : DEFAULT_TEXT_LINE_HEIGHT
  const scaleX =
    typeof it.scaleX === 'number' && Number.isFinite(it.scaleX) && it.scaleX > 0
      ? Math.max(50, Math.min(200, it.scaleX))
      : DEFAULT_TEXT_SCALE_X
  return { letterSpacing, lineHeight, scaleX }
}

export function normalizeTextTypographyFields(t: TextItem): TextItem {
  const typo = resolveTextTypography(t)
  return {
    ...t,
    text: normalizeTextContent(t.text),
    letterSpacing: typo.letterSpacing,
    lineHeight: typo.lineHeight,
    scaleX: typo.scaleX,
  }
}

export type TextLineLayout = {
  text: string
  globalStart: number
  width: number
  x: number
  y: number
}

export type StudioTextBlockLayout = {
  display: string
  lines: TextLineLayout[]
  blockWidth: number
  blockHeight: number
  lineHeightPx: number
  typography: StudioTextTypography
}

function spansForLineSlice(
  spans: TextFillSpan[] | undefined,
  globalStart: number,
  lineLen: number,
): TextFillSpan[] | undefined {
  if (!spans?.length || lineLen <= 0) return undefined
  const local: TextFillSpan[] = []
  const end = globalStart + lineLen
  for (const sp of spans) {
    const a = Math.max(sp.start, globalStart)
    const b = Math.min(sp.end, end)
    if (b > a) local.push({ start: a - globalStart, end: b - globalStart, fill: sp.fill })
  }
  return local.length ? local : undefined
}

export function measureStudioTextBlock(
  ctx: CanvasRenderingContext2D,
  it: TextItem,
): StudioTextBlockLayout | null {
  const display = normalizeTextContent(it.text)
  if (!textHasVisibleContent(display)) return null

  const typography = resolveTextTypography(it)
  const rawLines = splitTextLines(display)
  const lineHeightPx = it.fontSize * typography.lineHeight
  const scale = typography.scaleX / 100

  ctx.save()
  ctx.font = canvasFontString(it.fontSize, it.fontFamily)
  ctx.letterSpacing = `${typography.letterSpacing}px`

  const measured = rawLines.map((line) => ({
    text: line,
    width: ctx.measureText(line).width * scale,
  }))
  const blockWidth = Math.max(1, ...measured.map((m) => m.width), 1)
  const blockHeight = Math.max(it.fontSize, rawLines.length * lineHeightPx)

  let globalStart = 0
  const lines: TextLineLayout[] = measured.map((m, index) => {
    let x = 0
    if (it.textAlign === 'center') x = -m.width / 2
    else if (it.textAlign === 'right') x = -m.width
    const y = -(rawLines.length - 1) * (lineHeightPx / 2) + index * lineHeightPx
    const layout: TextLineLayout = { text: m.text, globalStart, width: m.width, x, y }
    globalStart += m.text.length + 1
    return layout
  })

  ctx.restore()
  return { display, lines, blockWidth, blockHeight, lineHeightPx, typography }
}

export function drawStudioTextLines(
  ctx: CanvasRenderingContext2D,
  it: TextItem,
  layout: StudioTextBlockLayout,
): void {
  const { typography } = layout
  const scale = typography.scaleX / 100

  ctx.save()
  ctx.font = canvasFontString(it.fontSize, it.fontFamily)
  ctx.letterSpacing = `${typography.letterSpacing}px`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.scale(scale, 1)

  if (it.boxBackground) {
    const padX = it.boxPaddingX ?? 16
    const padY = it.boxPaddingY ?? 10
    const fixedW = it.boxWidthPx && it.boxWidthPx > 0 ? it.boxWidthPx : 0
    const contentW = layout.blockWidth / scale
    const bw = fixedW > 0 ? fixedW / scale : contentW + padX * 2
    const bh = layout.blockHeight + padY * 2
    let boxX = -padX
    if (it.textAlign === 'center') boxX = fixedW > 0 ? -(bw - contentW) / 2 : -bw / 2
    else if (it.textAlign === 'right') boxX = fixedW > 0 ? -(bw - contentW) : -bw
    else if (fixedW > 0) boxX = -(bw - contentW) / 2
    ctx.fillStyle = it.boxBackgroundColor ?? 'rgba(0,0,0,0.55)'
    const radius = it.boxRadius ?? 12
    const x = boxX
    const y = -bh / 2
    const r = Math.min(radius, bw / 2, bh / 2)
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + bw, y, x + bw, y + bh, r)
    ctx.arcTo(x + bw, y + bh, x, y + bh, r)
    ctx.arcTo(x, y + bh, x, y, r)
    ctx.arcTo(x, y, x + bw, y, r)
    ctx.closePath()
    ctx.fill()
  }

  if (it.strokeWidth > 0) {
    ctx.lineWidth = it.strokeWidth
    ctx.strokeStyle = it.stroke
    ctx.lineJoin = 'round'
  }

  for (const line of layout.lines) {
    const lineSpans = spansForLineSlice(it.fillSpans, line.globalStart, line.text.length)
    const segments = buildTextFillSegments(line.text, it.fill, lineSpans)
    let cursorX = line.x / scale
    for (const seg of segments) {
      if (it.strokeWidth > 0) ctx.strokeText(seg.slice, cursorX, line.y)
      ctx.fillStyle = seg.fill
      ctx.fillText(seg.slice, cursorX, line.y)
      cursorX += ctx.measureText(seg.slice).width
    }
  }

  ctx.restore()
}
