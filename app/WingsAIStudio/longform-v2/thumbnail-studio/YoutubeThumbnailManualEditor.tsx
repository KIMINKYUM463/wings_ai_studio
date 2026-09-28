import { useCallback, useEffect, useRef, useState } from 'react'
import { saveProjectThumbnail } from '@/lib/longform-v2/thumbnail-bridge/mediaApi'
import { fetchUrlAsBase64, postThumbnailImage, postThumbnailText } from '@/lib/longform-v2/thumbnail-bridge/thumbnailAiApi'
import { loadThumbnailManualDraft, saveThumbnailManualDraft } from '@/lib/longform-v2/thumbnail-bridge/thumbnailManualDraft'
import { postOpenProjectDataFolder, postOpenProjectSavedPath } from '@/lib/longform-v2/thumbnail-bridge/projectDataFolderApi'
import {
  formatBlobDownloadSavedMessage,
  triggerBlobDownload,
  type TriggerBlobDownloadResult,
} from '@/lib/longform-v2/thumbnail-bridge/thumbnailDownload'
import { openDownloadsFolder } from '@/lib/longform-v2/thumbnail-bridge/openDownloadsFolder'
import { AI_TOPIC_MAX } from '@/lib/longform-v2/thumbnail-bridge/thumbnailAiTopic'
import {
  DEFAULT_THUMBNAIL_FONT_STACK,
  canvasFontString,
  ensureBundledFontsLoaded,
} from '@/lib/longform-v2/thumbnail-bridge/bundledFonts'
import { TextStrokeControls } from './components/TextStrokeControls'
import { ThumbnailFontFamilyPicker } from './components/ThumbnailFontFamilyPicker'
import { DEFAULT_THUMBNAIL_TEXT_STROKE_WIDTH } from '@/lib/longform-v2/thumbnailTemplateStudio/types'
import { ThumbnailJpegDownloadSavedPanel } from './ThumbnailJpegDownloadSavedPanel'

export const CANVAS_W = 1280
export const CANVAS_H = 720

export type CanvasTextAlign = 'left' | 'center' | 'right'

type LinDef = {
  t: 'lin'
  x0: number
  y0: number
  x1: number
  y1: number
  stops: readonly (readonly [number, string])[]
}
type RadDef = {
  t: 'rad'
  cx0: number
  cy0: number
  r0: number
  cx1: number
  cy1: number
  r1: number
  stops: readonly (readonly [number, string])[]
}

export type ThumbTemplateDef = LinDef | RadDef

/** 유튜브 썸네일용 그라데이션 배경 (사진이 없을 때만 보임) */
export const THUMB_TEMPLATES: readonly { id: string; label: string; def: ThumbTemplateDef }[] = [
  { id: 'ember', label: '앰버', def: { t: 'lin', x0: 0, y0: 0, x1: 1, y1: 1, stops: [[0, '#0c0a09'], [0.45, '#7c2d12'], [1, '#f97316']] } },
  { id: 'ocean', label: '오션', def: { t: 'lin', x0: 0, y0: 0, x1: 1, y1: 0, stops: [[0, '#0c4a6e'], [0.5, '#0369a1'], [1, '#7dd3fc']] } },
  { id: 'forest', label: '포레스트', def: { t: 'lin', x0: 0, y0: 1, x1: 1, y1: 0, stops: [[0, '#052e16'], [0.55, '#166534'], [1, '#4ade80']] } },
  { id: 'royal', label: '로열', def: { t: 'lin', x0: 1, y0: 0, x1: 0, y1: 1, stops: [[0, '#1e1b4b'], [0.5, '#5b21b6'], [1, '#c084fc']] } },
  { id: 'sunset', label: '선셋', def: { t: 'lin', x0: 0, y0: 0.2, x1: 1, y1: 1, stops: [[0, '#4c0519'], [0.4, '#be123c'], [1, '#fdba74']] } },
  {
    id: 'charcoal',
    label: '차콜',
    def: { t: 'rad', cx0: 0.35, cy0: 0.2, r0: 0, cx1: 0.5, cy1: 0.5, r1: 0.85, stops: [[0, '#292524'], [1, '#0c0a09']] },
  },
  { id: 'midnight', label: '미드나잇', def: { t: 'lin', x0: 0, y0: 1, x1: 1, y1: 0, stops: [[0, '#020617'], [0.5, '#1e3a8a'], [1, '#38bdf8']] } },
  { id: 'neon', label: '네온', def: { t: 'lin', x0: 0, y0: 0.5, x1: 1, y1: 0.5, stops: [[0, '#1a0a2e'], [0.35, '#7c3aed'], [0.7, '#db2777'], [1, '#f472b6']] } },
  { id: 'goldrush', label: '골드', def: { t: 'lin', x0: 0, y0: 0, x1: 1, y1: 0.85, stops: [[0, '#0a0a0a'], [0.55, '#854d0e'], [1, '#fde047']] } },
  { id: 'slate', label: '슬레이트', def: { t: 'lin', x0: 0, y0: 0, x1: 1, y1: 1, stops: [[0, '#0f172a'], [0.5, '#334155'], [1, '#94a3b8']] } },
  { id: 'deepsea', label: '심해', def: { t: 'lin', x0: 0, y0: 0, x1: 0, y1: 1, stops: [[0, '#020617'], [0.5, '#0c4a6e'], [1, '#38bdf8']] } },
  {
    id: 'spotlight',
    label: '스포트라이트',
    def: { t: 'rad', cx0: 0.5, cy0: 0.42, r0: 0.02, cx1: 0.5, cy1: 0.48, r1: 0.75, stops: [[0, '#fafaf9'], [0.15, '#e7e5e4'], [0.45, '#44403c'], [1, '#0c0a09']] },
  },
] as const

export type ThumbnailTemplateId = (typeof THUMB_TEMPLATES)[number]['id']

const TEMPLATE_BY_ID: Record<string, ThumbTemplateDef> = Object.fromEntries(
  THUMB_TEMPLATES.map((x) => [x.id, x.def]),
)

/** 레이아웃 템플릿: 문구 위치·색·테두리 조합 (배경 사진 위에 올리는 스타일) */
export type LayoutSlotDef = {
  xn: number
  yn: number
  fontSize: number
  fill: string
  stroke: string
  strokeWidth: number
  textAlign: CanvasTextAlign
  fontFamily?: string
  zIndex?: number
}

export type ThumbLayoutPreset = {
  id: string
  label: string
  hint: string
  slots: readonly [LayoutSlotDef, LayoutSlotDef]
}

export const THUMB_LAYOUT_PRESETS: readonly ThumbLayoutPreset[] = [
  {
    id: 'top_hook',
    label: '상단 훅',
    hint: '위쪽 · 흰색 + 빨강',
    slots: [
      { xn: 0.5, yn: 0.12, fontSize: 64, fill: '#ffffff', stroke: '#0c0a09', strokeWidth: 8, textAlign: 'center' },
      { xn: 0.5, yn: 0.26, fontSize: 76, fill: '#ef4444', stroke: '#0c0a09', strokeWidth: 8, textAlign: 'center' },
    ],
  },
  {
    id: 'bottom_bar',
    label: '하단 바',
    hint: '하단 · 노랑 + 흰색',
    slots: [
      { xn: 0.5, yn: 0.72, fontSize: 70, fill: '#facc15', stroke: '#0c0a09', strokeWidth: 7, textAlign: 'center' },
      { xn: 0.5, yn: 0.86, fontSize: 56, fill: '#ffffff', stroke: '#0c0a09', strokeWidth: 6, textAlign: 'center' },
    ],
  },
  {
    id: 'bottom_gradient_bar',
    label: '하단 와이드',
    hint: '아래측 강조 (멀티컬러 느낌)',
    slots: [
      { xn: 0.5, yn: 0.68, fontSize: 62, fill: '#fecaca', stroke: '#000000', strokeWidth: 8, textAlign: 'center' },
      { xn: 0.5, yn: 0.82, fontSize: 78, fill: '#fde047', stroke: '#000000', strokeWidth: 9, textAlign: 'center' },
    ],
  },
  {
    id: 'left_bottom',
    label: '좌하단',
    hint: '좌측 정렬',
    slots: [
      { xn: 0.06, yn: 0.62, fontSize: 54, fill: '#fef08a', stroke: '#18181b', strokeWidth: 6, textAlign: 'left' },
      { xn: 0.06, yn: 0.78, fontSize: 50, fill: '#ffffff', stroke: '#18181b', strokeWidth: 6, textAlign: 'left' },
    ],
  },
  {
    id: 'center_split',
    label: '중앙 분할',
    hint: '큰 자막 · 흰 + 빨강',
    slots: [
      { xn: 0.5, yn: 0.38, fontSize: 76, fill: '#ffffff', stroke: '#000000', strokeWidth: 10, textAlign: 'center' },
      { xn: 0.5, yn: 0.56, fontSize: 92, fill: '#dc2626', stroke: '#000000', strokeWidth: 10, textAlign: 'center' },
    ],
  },
  {
    id: 'top_right_hook',
    label: '우상단+메인',
    hint: '작은 코멘트 + 중앙',
    slots: [
      { xn: 0.92, yn: 0.1, fontSize: 34, fill: '#fde047', stroke: '#0c0a09', strokeWidth: 4, textAlign: 'right' },
      { xn: 0.5, yn: 0.48, fontSize: 72, fill: '#ffffff', stroke: '#0c0a09', strokeWidth: 8, textAlign: 'center' },
    ],
  },
  {
    id: 'title_only_big',
    label: '한줄 집중',
    hint: '첫 줄만 크게 (둘째는 작게)',
    slots: [
      { xn: 0.5, yn: 0.45, fontSize: 96, fill: '#ffffff', stroke: '#000000', strokeWidth: 12, textAlign: 'center' },
      { xn: 0.5, yn: 0.62, fontSize: 44, fill: '#93c5fd', stroke: '#0f172a', strokeWidth: 5, textAlign: 'center' },
    ],
  },
] as const

export type TextItem = {
  id: string
  kind: 'text'
  text: string
  x: number
  y: number
  fontSize: number
  fontFamily: string
  fill: string
  stroke: string
  strokeWidth: number
  /** 구간별 글자색 (드래그 선택 후 컬러 변경) */
  fillSpans?: { start: number; end: number; fill: string }[]
  textAlign: CanvasTextAlign
  zIndex: number
  /** 글자 뒤 반투명 박스 */
  boxBackground?: boolean
  boxBackgroundColor?: string
  boxPaddingX?: number
  boxPaddingY?: number
  boxRadius?: number
  /** 박스 배경 고정 너비(px) — 썸네일 스튜디오 전체 너비 바 */
  boxWidthPx?: number
  /** 도(degree), 시계 방향. 기본 0 */
  rotation?: number
  letterSpacing?: number
  lineHeight?: number
  scaleX?: number
  /** false면 캔버스·내보내기에서 숨김 */
  visible?: boolean
}

export type ArrowItem = {
  id: string
  kind: 'arrow'
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  lineWidth: number
  zIndex: number
}

export type CanvasElement = TextItem | ArrowItem

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function drawGradientTemplate(ctx: CanvasRenderingContext2D, id: ThumbnailTemplateId, w: number, h: number): void {
  const def = TEMPLATE_BY_ID[id]
  if (!def) {
    drawGradientTemplate(ctx, 'ember', w, h)
    return
  }
  const m = Math.max(w, h)
  let g: CanvasGradient
  if (def.t === 'lin') {
    g = ctx.createLinearGradient(def.x0 * w, def.y0 * h, def.x1 * w, def.y1 * h)
    for (const [o, c] of def.stops) g.addColorStop(o, c)
  } else {
    g = ctx.createRadialGradient(
      def.cx0 * w,
      def.cy0 * h,
      def.r0 * m,
      def.cx1 * w,
      def.cy1 * h,
      def.r1 * m,
    )
    for (const [o, c] of def.stops) g.addColorStop(o, c)
  }
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

function drawImageCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number): void {
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  if (!iw || !ih) return
  const scale = Math.max(w / iw, h / ih)
  const dw = iw * scale
  const dh = ih * scale
  const dx = (w - dw) / 2
  const dy = (h - dh) / 2
  ctx.drawImage(img, dx, dy, dw, dh)
}

function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number, alpha: number): void {
  const g = ctx.createRadialGradient(w * 0.5, h * 0.45, h * 0.15, w * 0.5, h * 0.5, Math.max(w, h) * 0.72)
  g.addColorStop(0, `rgba(0,0,0,0)`)
  g.addColorStop(1, `rgba(0,0,0,${alpha})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  if (w <= 0 || h <= 0) return
  const rad = Math.min(Math.max(0, r), w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.lineTo(x + w - rad, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad)
  ctx.lineTo(x + w, y + h - rad)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h)
  ctx.lineTo(x + rad, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad)
  ctx.lineTo(x, y + rad)
  ctx.quadraticCurveTo(x, y, x + rad, y)
  ctx.closePath()
  ctx.fill()
}

function parseLooseRgba(s: string | undefined): { r: number; g: number; b: number; a: number } {
  if (!s) return { r: 0, g: 0, b: 0, a: 0.55 }
  const m = s
    .trim()
    .match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i)
  if (m) {
    return {
      r: Math.min(255, Math.max(0, Number(m[1]))),
      g: Math.min(255, Math.max(0, Number(m[2]))),
      b: Math.min(255, Math.max(0, Number(m[3]))),
      a: m[4] !== undefined ? Math.max(0, Math.min(1, Number(m[4]))) : 1,
    }
  }
  if (s.startsWith('#') && s.length === 7) {
    return {
      r: parseInt(s.slice(1, 3), 16),
      g: parseInt(s.slice(3, 5), 16),
      b: parseInt(s.slice(5, 7), 16),
      a: 0.55,
    }
  }
  return { r: 0, g: 0, b: 0, a: 0.55 }
}

function rgbaString(r: number, g: number, b: number, a: number): string {
  const aa = Math.min(1, Math.max(0, a))
  return `rgba(${r},${g},${b},${aa})`
}

function ellipsisToWidth(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  const ell = '…'
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    const t = text.slice(0, mid) + ell
    if (ctx.measureText(t).width <= maxW) lo = mid
    else hi = mid - 1
  }
  const n = Math.max(1, lo)
  return text.slice(0, n) + ell
}

function drawTextItem(ctx: CanvasRenderingContext2D, it: TextItem, maxLineW: number): void {
  const raw = it.text.trim()
  if (!raw) return
  ctx.save()
  ctx.font = canvasFontString(it.fontSize, it.fontFamily)
  ctx.textAlign = it.textAlign
  ctx.textBaseline = 'middle'
  const display = ellipsisToWidth(ctx, raw, maxLineW)
  const x = it.x
  const y = it.y
  if (it.boxBackground) {
    const inner = measureTextBoxInner(ctx, it, maxLineW)
    const padX = it.boxPaddingX ?? 16
    const padY = it.boxPaddingY ?? 10
    const rad = it.boxRadius ?? 12
    const bx = inner.left - padX
    const by = inner.top - padY
    const bw = inner.w + padX * 2
    const bh = inner.bottom - inner.top + padY * 2
    ctx.fillStyle = it.boxBackgroundColor ?? 'rgba(0,0,0,0.55)'
    fillRoundRect(ctx, bx, by, bw, bh, rad)
  }
  if (it.strokeWidth > 0) {
    ctx.lineJoin = 'round'
    ctx.miterLimit = 2
    ctx.strokeStyle = it.stroke
    ctx.lineWidth = it.strokeWidth
    ctx.strokeText(display, x, y)
  }
  ctx.fillStyle = it.fill
  ctx.fillText(display, x, y)
  ctx.restore()
}

/** `ctx`에 이미 font·textAlign·textBaseline이 맞춰져 있을 때 글자 박스(패딩 제외) */
function measureTextBoxInner(ctx: CanvasRenderingContext2D, it: TextItem, maxLineW: number) {
  const raw = it.text.trim()
  if (!raw) return { left: it.x, top: it.y, right: it.x, bottom: it.y, w: 0, h: it.fontSize }
  const display = ellipsisToWidth(ctx, raw, maxLineW)
  const w = ctx.measureText(display).width
  const h = it.fontSize * 1.25
  let left = it.x
  if (it.textAlign === 'center') left = it.x - w / 2
  else if (it.textAlign === 'right') left = it.x - w
  const top = it.y - h / 2
  return { left, top, right: left + w, bottom: top + h, w, h }
}

/** 텍스트 주변 바운딩 박스 (선택 테두리·히트 테스트용) */
function measureTextBox(ctx: CanvasRenderingContext2D, it: TextItem, maxLineW: number) {
  ctx.save()
  ctx.font = canvasFontString(it.fontSize, it.fontFamily)
  ctx.textAlign = it.textAlign
  ctx.textBaseline = 'middle'
  const out = measureTextBoxInner(ctx, it, maxLineW)
  ctx.restore()
  return out
}

/** 히트·선택 테두리용 — 배경 박스 포함 */
function measureTextOuterBox(ctx: CanvasRenderingContext2D, it: TextItem, maxLineW: number) {
  const inner = measureTextBox(ctx, it, maxLineW)
  if (!it.boxBackground) {
    const pad = 8
    return {
      left: inner.left - pad,
      top: inner.top - pad,
      right: inner.right + pad,
      bottom: inner.bottom + pad,
    }
  }
  const padX = (it.boxPaddingX ?? 16) + 4
  const padY = (it.boxPaddingY ?? 10) + 4
  return {
    left: inner.left - padX,
    top: inner.top - padY,
    right: inner.right + padX,
    bottom: inner.bottom + padY,
  }
}

function drawArrowShape(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  lineW: number,
) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = lineW
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  const ang = Math.atan2(y2 - y1, x2 - x1)
  const headLen = 18 + lineW * 2
  const spread = 0.85
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 + Math.cos(ang + Math.PI - spread) * headLen, y2 + Math.sin(ang + Math.PI - spread) * headLen)
  ctx.lineTo(x2 + Math.cos(ang + Math.PI + spread) * headLen, y2 + Math.sin(ang + Math.PI + spread) * headLen)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function distSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx
  const dy = ay - by
  return dx * dx + dy * dy
}

function distPointToSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const lx = x2 - x1
  const ly = y2 - y1
  const lenSq = lx * lx + ly * ly
  if (lenSq < 1e-6) return Math.sqrt(distSq(px, py, x1, y1))
  let t = ((px - x1) * lx + (py - y1) * ly) / lenSq
  t = Math.max(0, Math.min(1, t))
  const nx = x1 + t * lx
  const ny = y1 + t * ly
  return Math.sqrt(distSq(px, py, nx, ny))
}

type HitResult =
  | { kind: 'text'; id: string }
  | { kind: 'arrow'; id: string; part: 'start' | 'end' | 'move' }

function hitTest(
  x: number,
  y: number,
  texts: TextItem[],
  arrows: ArrowItem[],
  ctx: CanvasRenderingContext2D,
): HitResult | null {
  const thresh = 14
  const endR = 22
  const sorted = [
    ...texts.map((t) => ({ el: t as CanvasElement, z: t.zIndex })),
    ...arrows.map((a) => ({ el: a as CanvasElement, z: a.zIndex })),
  ].sort((a, b) => b.z - a.z)

  for (const { el } of sorted) {
    if (el.kind === 'text') {
      const box = measureTextOuterBox(ctx, el, CANVAS_W * 0.92)
      if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) {
        return { kind: 'text', id: el.id }
      }
    } else {
      const d1 = Math.sqrt(distSq(x, y, el.x1, el.y1))
      const d2 = Math.sqrt(distSq(x, y, el.x2, el.y2))
      if (d2 <= endR) return { kind: 'arrow', id: el.id, part: 'end' }
      if (d1 <= endR) return { kind: 'arrow', id: el.id, part: 'start' }
      if (distPointToSeg(x, y, el.x1, el.y1, el.x2, el.y2) <= thresh + el.lineWidth * 0.5) {
        return { kind: 'arrow', id: el.id, part: 'move' }
      }
    }
  }
  return null
}

function applyLayoutPreset(preset: ThumbLayoutPreset, texts: TextItem[]): TextItem[] {
  const [a, b] = preset.slots
  const base: TextItem[] = [...texts]
  const ensure = (i: number, fallback: string): TextItem => {
    const ex = base[i]
    if (ex && ex.kind === 'text') return ex
    return {
      id: newId(),
      kind: 'text',
      text: fallback,
      x: CANVAS_W * 0.5,
      y: CANVAS_H * 0.5,
      fontSize: 64,
      fontFamily: DEFAULT_THUMBNAIL_FONT_STACK,
      fill: '#ffffff',
      stroke: '#0c0a09',
      strokeWidth: DEFAULT_THUMBNAIL_TEXT_STROKE_WIDTH,
      textAlign: 'center',
      zIndex: 10 + i,
      boxBackground: false,
    }
  }
  while (base.length < 2) {
    const i = base.length
    base.push(ensure(i, i === 0 ? '첫 줄' : '둘째 줄'))
  }
  const t0 = ensure(0, base[0].kind === 'text' ? base[0].text : '첫 줄')
  const t1 = ensure(1, base[1].kind === 'text' ? base[1].text : '둘째 줄')
  const z0 = a.zIndex ?? t0.zIndex
  const z1 = b.zIndex ?? t1.zIndex
  base[0] = {
    ...t0,
    x: a.xn * CANVAS_W,
    y: a.yn * CANVAS_H,
    fontSize: a.fontSize,
    fill: a.fill,
    stroke: a.stroke,
    strokeWidth: a.strokeWidth,
    textAlign: a.textAlign,
    fontFamily: a.fontFamily ?? t0.fontFamily,
    zIndex: z0,
  }
  base[1] = {
    ...t1,
    x: b.xn * CANVAS_W,
    y: b.yn * CANVAS_H,
    fontSize: b.fontSize,
    fill: b.fill,
    stroke: b.stroke,
    strokeWidth: b.strokeWidth,
    textAlign: b.textAlign,
    fontFamily: b.fontFamily ?? t1.fontFamily,
    zIndex: z1,
  }
  return base
}

const VALID_THUMB_TEMPLATE_IDS = new Set(THUMB_TEMPLATES.map((t) => t.id))

function normalizeTemplateId(id: string | undefined): ThumbnailTemplateId {
  if (id && VALID_THUMB_TEMPLATE_IDS.has(id as ThumbnailTemplateId)) return id as ThumbnailTemplateId
  return 'ember'
}

function isArrowItem(x: unknown): x is ArrowItem {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    o.kind === 'arrow' &&
    typeof o.id === 'string' &&
    typeof o.x1 === 'number' &&
    typeof o.y1 === 'number' &&
    typeof o.x2 === 'number' &&
    typeof o.y2 === 'number' &&
    typeof o.color === 'string' &&
    typeof o.lineWidth === 'number' &&
    typeof o.zIndex === 'number'
  )
}

function isTextItemLoose(x: unknown): x is TextItem {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  const ta = o.textAlign
  const alignOk =
    ta === 'left' ||
    ta === 'right' ||
    ta === 'center' ||
    ta === 'start' ||
    ta === 'end'
  return (
    o.kind === 'text' &&
    typeof o.id === 'string' &&
    typeof o.text === 'string' &&
    typeof o.x === 'number' &&
    typeof o.y === 'number' &&
    typeof o.fontSize === 'number' &&
    typeof o.fill === 'string' &&
    typeof o.stroke === 'string' &&
    typeof o.strokeWidth === 'number' &&
    typeof o.zIndex === 'number' &&
    typeof o.fontFamily === 'string' &&
    alignOk
  )
}

function parseDraftArrows(raw: unknown): ArrowItem[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(isArrowItem)
}

function normalizeLoadedTextItem(t: TextItem): TextItem {
  const letterSpacing =
    typeof t.letterSpacing === 'number' && Number.isFinite(t.letterSpacing) ? t.letterSpacing : 0
  const lineHeight =
    typeof t.lineHeight === 'number' && Number.isFinite(t.lineHeight) && t.lineHeight > 0
      ? t.lineHeight
      : 1.21
  const scaleX =
    typeof t.scaleX === 'number' && Number.isFinite(t.scaleX) && t.scaleX > 0 ? t.scaleX : 100
  return {
    ...t,
    text: t.text.replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
    letterSpacing,
    lineHeight,
    scaleX,
    boxBackground: t.boxBackground === true,
    boxBackgroundColor:
      typeof t.boxBackgroundColor === 'string' && t.boxBackgroundColor.trim()
        ? t.boxBackgroundColor.trim()
        : 'rgba(0,0,0,0.55)',
    boxPaddingX:
      typeof t.boxPaddingX === 'number' && Number.isFinite(t.boxPaddingX)
        ? Math.max(0, Math.min(64, t.boxPaddingX))
        : 16,
    boxPaddingY:
      typeof t.boxPaddingY === 'number' && Number.isFinite(t.boxPaddingY)
        ? Math.max(0, Math.min(64, t.boxPaddingY))
        : 10,
    boxRadius:
      typeof t.boxRadius === 'number' && Number.isFinite(t.boxRadius) ? Math.max(0, Math.min(40, t.boxRadius)) : 12,
  }
}

function parseDraftTextItems(raw: unknown): TextItem[] | null {
  if (!Array.isArray(raw)) return null
  const items = raw.filter(isTextItemLoose)
  return items.length > 0 ? items.map(normalizeLoadedTextItem) : null
}

function initialTexts(line1: string, line2: string): TextItem[] {
  return [
    {
      id: newId(),
      kind: 'text',
      text: line1,
      x: CANVAS_W * 0.5,
      y: CANVAS_H * 0.42,
      fontSize: 72,
      fontFamily: DEFAULT_THUMBNAIL_FONT_STACK,
      fill: '#ffffff',
      stroke: '#0c0a09',
      strokeWidth: 8,
      textAlign: 'center',
      zIndex: 10,
      boxBackground: false,
    },
    {
      id: newId(),
      kind: 'text',
      text: line2,
      x: CANVAS_W * 0.5,
      y: CANVAS_H * 0.58,
      fontSize: 64,
      fontFamily: DEFAULT_THUMBNAIL_FONT_STACK,
      fill: '#fecaca',
      stroke: '#0c0a09',
      strokeWidth: 7,
      textAlign: 'center',
      zIndex: 11,
      boxBackground: false,
    },
  ]
}

function bootstrapEditorState(projectId: string, line1: string, line2: string) {
  const d = loadThumbnailManualDraft(projectId)
  const texts = d?.v === 1 ? parseDraftTextItems(d.textItems) : null
  if (texts?.length) {
    return {
      textItems: texts,
      arrows: d?.v === 1 ? parseDraftArrows(d.arrows) : [],
      templateId: d?.v === 1 ? normalizeTemplateId(d.templateId) : 'ember',
      bgUrl:
        d?.v === 1 && typeof d.userBgDataUrl === 'string' && d.userBgDataUrl.startsWith('data:')
          ? d.userBgDataUrl
          : null,
      restoredDraft: true,
    }
  }
  return {
    textItems: initialTexts(line1, line2),
    arrows: [] as ArrowItem[],
    templateId: 'ember' as ThumbnailTemplateId,
    bgUrl: null as string | null,
    restoredDraft: false,
  }
}

export type YoutubeThumbnailManualEditorProps = {
  projectId: string
  defaultLine1: string
  defaultLine2: string
  /** AI 썸네일 문구용 대본 */
  scriptForAi?: string
  /** AI 썸네일 문구용 제목 힌트 */
  titleForAi?: string
  /** 다운로드 파일명 접두(프로젝트 제목 등) — 비우면 짧은 id 사용 */
  downloadFileBaseName?: string
  /** AI 배경(문구 없음) 생성용 주제 — 업로드 단계의 제목·설명·대본 기반 */
  aiBackgroundTopic?: string
  /** AI 문구 제안·배경 생성과 동기화 — `ko`(기본), `English`, `日本語` 등 */
  thumbnailOutputLanguage?: string
  onSaved?: (thumbnailUrl: string) => void
}

export function YoutubeThumbnailManualEditor({
  projectId,
  defaultLine1,
  defaultLine2,
  scriptForAi,
  titleForAi,
  downloadFileBaseName,
  aiBackgroundTopic,
  thumbnailOutputLanguage = 'ko',
  onSaved,
}: YoutubeThumbnailManualEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const bgImageRef = useRef<HTMLImageElement | null>(null)
  const dragRef = useRef<{
    kind: 'text' | 'arrow'
    id: string
    part?: 'start' | 'end' | 'move'
    startPx?: number
    startPy?: number
    ox1?: number
    oy1?: number
    ox2?: number
    oy2?: number
  } | null>(null)

  const [editorBoot] = useState(() => bootstrapEditorState(projectId, defaultLine1, defaultLine2))
  const [templateId, setTemplateId] = useState<ThumbnailTemplateId>(editorBoot.templateId)
  const [textItems, setTextItems] = useState<TextItem[]>(editorBoot.textItems)
  const [arrows, setArrows] = useState<ArrowItem[]>(editorBoot.arrows)
  const [selected, setSelected] = useState<{ kind: 'text' | 'arrow'; id: string } | null>(null)
  const selectedRef = useRef(selected)
  selectedRef.current = selected

  const [bgObjectUrl, setBgObjectUrl] = useState<string | null>(editorBoot.bgUrl)
  const [saveBusy, setSaveBusy] = useState(false)
  const [downloadBusy, setDownloadBusy] = useState(false)
  const [lastJpegDownload, setLastJpegDownload] = useState<TriggerBlobDownloadResult | null>(null)
  const [openJpegPathBusy, setOpenJpegPathBusy] = useState(false)
  const [downloadInfo, setDownloadInfo] = useState<string | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiBgImageBusy, setAiBgImageBusy] = useState(false)
  const [aiBgImageHint, setAiBgImageHint] = useState('')
  const [aiBgImageStyle, setAiBgImageStyle] = useState<'realism' | 'animation' | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  const texts = textItems
  const selectedText = selected?.kind === 'text' ? texts.find((t) => t.id === selected.id) : undefined
  const selectedArrow = selected?.kind === 'arrow' ? arrows.find((a) => a.id === selected.id) : undefined

  /** 패널을 나가도 같은 브라우저에서는 레이어·배경 초안이 유지되도록 로컬 저장 */
  useEffect(() => {
    const id = window.setTimeout(() => {
      saveThumbnailManualDraft(projectId, {
        v: 1,
        templateId,
        textItems,
        arrows,
        userBgDataUrl: bgObjectUrl && bgObjectUrl.startsWith('data:') ? bgObjectUrl : null,
      })
    }, 480)
    return () => window.clearTimeout(id)
  }, [projectId, templateId, textItems, arrows, bgObjectUrl])

  const redraw = useCallback(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

    const img = bgImageRef.current
    if (img?.complete && (img.naturalWidth || img.width)) {
      drawImageCover(ctx, img, CANVAS_W, CANVAS_H)
      drawVignette(ctx, CANVAS_W, CANVAS_H, 0.35)
    } else {
      drawGradientTemplate(ctx, templateId, CANVAS_W, CANVAS_H)
      drawVignette(ctx, CANVAS_W, CANVAS_H, 0.25)
    }

    const combined: CanvasElement[] = [...texts, ...arrows].sort((a, b) => a.zIndex - b.zIndex)
    for (const el of combined) {
      if (el.kind === 'text') drawTextItem(ctx, el, CANVAS_W * 0.92)
      else drawArrowShape(ctx, el.x1, el.y1, el.x2, el.y2, el.color, el.lineWidth)
    }

    if (selected) {
      ctx.save()
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.95)'
      ctx.lineWidth = 3
      ctx.setLineDash([8, 6])
      if (selected.kind === 'text') {
        const t = texts.find((x) => x.id === selected.id)
        if (t) {
          const box = measureTextOuterBox(ctx, t, CANVAS_W * 0.92)
          ctx.strokeRect(box.left - 2, box.top - 2, box.right - box.left + 4, box.bottom - box.top + 4)
        }
      } else {
        const a = arrows.find((x) => x.id === selected.id)
        if (a) {
          const pad = 14
          const minX = Math.min(a.x1, a.x2) - pad
          const minY = Math.min(a.y1, a.y2) - pad
          const maxX = Math.max(a.x1, a.x2) + pad
          const maxY = Math.max(a.y1, a.y2) + pad
          ctx.strokeRect(minX, minY, maxX - minX, maxY - minY)
          ctx.fillStyle = 'rgba(56, 189, 248, 0.35)'
          ctx.beginPath()
          ctx.arc(a.x1, a.y1, 10, 0, Math.PI * 2)
          ctx.arc(a.x2, a.y2, 10, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.restore()
    }
  }, [templateId, texts, arrows, selected, bgObjectUrl])

  useEffect(() => {
    redraw()
  }, [redraw])

  useEffect(() => {
    void ensureBundledFontsLoaded().then(() => redraw())
  }, [redraw])

  useEffect(() => {
    document.fonts?.ready?.then(() => redraw())
  }, [redraw])

  useEffect(() => {
    const fonts = document.fonts
    if (!fonts?.addEventListener) return
    const onDone = () => redraw()
    fonts.addEventListener('loadingdone', onDone)
    return () => fonts.removeEventListener('loadingdone', onDone)
  }, [redraw])

  useEffect(() => {
    if (!bgObjectUrl) {
      bgImageRef.current = null
      redraw()
      return
    }
    const url = bgObjectUrl
    const img = new Image()
    img.onload = () => {
      bgImageRef.current = img
      redraw()
    }
    img.onerror = () => {
      bgImageRef.current = null
      setLocalError('배경 이미지를 불러오지 못했습니다.')
    }
    img.src = url
    return () => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url)
    }
  }, [bgObjectUrl, redraw])

  const onPickBackground = (file: File | null) => {
    setLocalError(null)
    if (!file) {
      setBgObjectUrl((prev) => {
        if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
        return null
      })
      bgImageRef.current = null
      return
    }
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      setLocalError('JPEG, PNG, WEBP 이미지만 사용할 수 있습니다.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setBgObjectUrl(dataUrl)
    }
    reader.onerror = () => setLocalError('배경 파일을 읽지 못했습니다.')
    reader.readAsDataURL(file)
  }

  const clearBackground = () => {
    if (bgObjectUrl?.startsWith('blob:')) URL.revokeObjectURL(bgObjectUrl)
    setBgObjectUrl(null)
    bgImageRef.current = null
    redraw()
  }

  const onAiSuggestLines = async () => {
    setAiBusy(true)
    setLocalError(null)
    try {
      const script = (scriptForAi ?? '').trim()
      if (!script) {
        window.alert('프로젝트에 대본(script)이 없으면 AI가 문맥을 잡기 어렵습니다. 대본을 넣거나 첫·둘째 줄을 직접 적어 주세요.')
        return
      }
      const res = await postThumbnailText({
        script,
        title: (titleForAi ?? '').trim() || undefined,
        outputLanguage: thumbnailOutputLanguage,
      })
      setTextItems((prev) => {
        const next = [...prev]
        const patch = (i: number, line: string) => {
          const t = next[i]
          if (t && t.kind === 'text') next[i] = { ...t, text: line }
          else
            next.push({
              id: newId(),
              kind: 'text',
              text: line,
              x: CANVAS_W * (i === 0 ? 0.5 : 0.5),
              y: CANVAS_H * (i === 0 ? 0.4 : 0.58),
              fontSize: i === 0 ? 72 : 62,
              fontFamily: DEFAULT_THUMBNAIL_FONT_STACK,
              fill: i === 0 ? '#ffffff' : '#fecaca',
              stroke: '#0c0a09',
              strokeWidth: 8,
      textAlign: 'center',
      zIndex: 10 + i,
      boxBackground: false,
    })
  }
        patch(0, res.line1)
        patch(1, res.line2)
        return next
      })
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : String(e))
    } finally {
      setAiBusy(false)
    }
  }

  const onAiBackgroundImageOnly = async () => {
    setAiBgImageBusy(true)
    setLocalError(null)
    try {
      let base = (aiBackgroundTopic ?? '').trim()
      if (!base) {
        const title = (titleForAi ?? '').trim()
        const script = (scriptForAi ?? '').trim()
        base =
          title ||
          (script.length > 280 ? `${script.slice(0, 277)}…` : script) ||
          'YouTube thumbnail background, cinematic 16:9 composition, high quality, no text, no letters, no watermark'
      }
      const extra = aiBgImageHint.trim()
      const composed = extra ? `${base}\n\n시각 지시: ${extra}` : base
      const topic =
        composed.length > AI_TOPIC_MAX ? `${composed.slice(0, AI_TOPIC_MAX - 1)}…` : composed
      const { imageUrl } = await postThumbnailImage({
        topic,
        thumbnailStyle: aiBgImageStyle,
        withoutText: true,
      })
      const { base64, mimeType } = await fetchUrlAsBase64(imageUrl)
      const mime = mimeType.startsWith('image/') ? mimeType : 'image/png'
      setBgObjectUrl((prev) => {
        if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
        return `data:${mime};base64,${base64}`
      })
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : String(e))
    } finally {
      setAiBgImageBusy(false)
    }
  }

  const updateText = (id: string, patch: Partial<TextItem>) => {
    setTextItems((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }

  const addTextLayer = () => {
    const maxZ = Math.max(0, ...texts.map((t) => t.zIndex), ...arrows.map((a) => a.zIndex))
    setTextItems((prev) => [
      ...prev,
      {
        id: newId(),
        kind: 'text',
        text: '새 텍스트',
        x: CANVAS_W * 0.5,
        y: CANVAS_H * 0.5,
        fontSize: 56,
        fontFamily: DEFAULT_THUMBNAIL_FONT_STACK,
        fill: '#fde047',
        stroke: '#18181b',
        strokeWidth: DEFAULT_THUMBNAIL_TEXT_STROKE_WIDTH,
        textAlign: 'center',
        zIndex: maxZ + 1,
        boxBackground: false,
      },
    ])
    setSelected(null)
  }

  const addArrow = () => {
    const maxZ = Math.max(0, ...texts.map((t) => t.zIndex), ...arrows.map((a) => a.zIndex))
    const a: ArrowItem = {
      id: newId(),
      kind: 'arrow',
      x1: CANVAS_W * 0.72,
      y1: CANVAS_H * 0.28,
      x2: CANVAS_W * 0.42,
      y2: CANVAS_H * 0.48,
      color: '#ef4444',
      lineWidth: 10,
      zIndex: maxZ + 1,
    }
    setArrows((prev) => [...prev, a])
    setSelected({ kind: 'arrow', id: a.id })
  }

  const deleteSelected = () => {
    if (!selected) return
    if (selected.kind === 'text') {
      setTextItems((prev) => prev.filter((t) => t.id !== selected.id))
    } else {
      setArrows((prev) => prev.filter((a) => a.id !== selected.id))
    }
    setSelected(null)
  }

  const bumpZ = (delta: number) => {
    if (!selected) return
    if (selected.kind === 'text') {
      setTextItems((prev) =>
        prev.map((t) => (t.id === selected.id ? { ...t, zIndex: t.zIndex + delta } : t)),
      )
    } else {
      setArrows((prev) =>
        prev.map((a) => (a.id === selected.id ? { ...a, zIndex: a.zIndex + delta } : a)),
      )
    }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const r = canvas.getBoundingClientRect()
    const sx = CANVAS_W / r.width
    const sy = CANVAS_H / r.height
    const x = (e.clientX - r.left) * sx
    const y = (e.clientY - r.top) * sy
    const hit = hitTest(x, y, texts, arrows, ctx)
    if (!hit) {
      setSelected(null)
      return
    }
    if (hit.kind === 'text') {
      setSelected({ kind: 'text', id: hit.id })
      const t = texts.find((u) => u.id === hit.id)
      if (t) dragRef.current = { kind: 'text', id: t.id }
    } else {
      setSelected({ kind: 'arrow', id: hit.id })
      const a = arrows.find((u) => u.id === hit.id)
      if (a) {
        dragRef.current = {
          kind: 'arrow',
          id: a.id,
          part: hit.part,
          startPx: x,
          startPy: y,
          ox1: a.x1,
          oy1: a.y1,
          ox2: a.x2,
          oy2: a.y2,
        }
      }
    }
    ;(e.target as HTMLCanvasElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current
    if (!d) return
    const canvas = canvasRef.current
    if (!canvas) return
    const r = canvas.getBoundingClientRect()
    const sx = CANVAS_W / r.width
    const sy = CANVAS_H / r.height
    const x = (e.clientX - r.left) * sx
    const y = (e.clientY - r.top) * sy

    if (d.kind === 'text') {
      updateText(d.id, { x, y })
      return
    }
    setArrows((prev) =>
      prev.map((a) => {
        if (a.id !== d.id) return a
        if (d.part === 'start') return { ...a, x1: x, y1: y }
        if (d.part === 'end') return { ...a, x2: x, y2: y }
        if (d.part === 'move' && d.startPx !== undefined && d.ox1 !== undefined) {
          const dx = x - d.startPx
          const dy = y - d.startPy!
          return { ...a, x1: d.ox1 + dx, y1: d.oy1! + dy, x2: d.ox2! + dx, y2: d.oy2! + dy }
        }
        return a
      }),
    )
  }

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = null
    try {
      ;(e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const onSave = async () => {
    const c = canvasRef.current
    if (!c) return
    setSaveBusy(true)
    setLocalError(null)
    try {
      redraw()
      const dataUrl = c.toDataURL('image/jpeg', 0.92)
      const m = dataUrl.match(/^data:image\/jpeg;base64,(.+)$/)
      if (!m) throw new Error('썸네일 인코딩에 실패했습니다.')
      const res = await saveProjectThumbnail(projectId, { imageBase64: m[1] })
      saveThumbnailManualDraft(projectId, {
        v: 1,
        templateId,
        textItems,
        arrows,
        userBgDataUrl: bgObjectUrl && bgObjectUrl.startsWith('data:') ? bgObjectUrl : null,
      })
      onSaved?.(res.thumbnailUrl)
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaveBusy(false)
    }
  }

  const onDownload = async () => {
    const c = canvasRef.current
    if (!c) return
    setDownloadBusy(true)
    setLocalError(null)
    setDownloadInfo(null)
    try {
      redraw()
      const blob = await new Promise<Blob>((resolve, reject) => {
        c.toBlob((b) => (b ? resolve(b) : reject(new Error('JPEG 변환 실패'))), 'image/jpeg', 0.92)
      })
      const raw = (downloadFileBaseName ?? '').trim().replace(/[/\\?%*:|"<>]/g, '_').slice(0, 40)
      const safe = raw || `thumb_${projectId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 12) || 'project'}`
      const result = await triggerBlobDownload(blob, `${safe}_youtube_thumb_manual.jpg`)
      if (result.cancelled) {
        setDownloadInfo(formatBlobDownloadSavedMessage(result))
        return
      }
      setLastJpegDownload(result)
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : '다운로드 실패')
    } finally {
      setDownloadBusy(false)
    }
  }

  const onOpenLastJpegSavedLocation = useCallback(async () => {
    if (!lastJpegDownload) return
    setOpenJpegPathBusy(true)
    setLocalError(null)
    try {
      if (lastJpegDownload.savedPath) {
        await postOpenProjectSavedPath(projectId, lastJpegDownload.savedPath)
        return
      }
      const r = await openDownloadsFolder()
      setDownloadInfo(r.message)
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : '저장 위치를 열 수 없습니다.')
    } finally {
      setOpenJpegPathBusy(false)
    }
  }, [lastJpegDownload, projectId])

  const onOpenProjectThumbnailFolder = useCallback(async () => {
    setLocalError(null)
    try {
      await postOpenProjectDataFolder(projectId, 'thumbnail')
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : String(e))
    }
  }, [projectId])

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Delete' && ev.key !== 'Backspace') return
      const tag = (ev.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const s = selectedRef.current
      if (!s) return
      if (s.kind === 'text') {
        setTextItems((prev) => prev.filter((t) => t.id !== s.id))
      } else {
        setArrows((prev) => prev.filter((a) => a.id !== s.id))
      }
      setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="yt-thumb-manual">
      <p className="yt-upload__muted">
        <strong>1280×720</strong> 캔버스에서 사진·<strong>AI 배경(문구 없음)</strong>을 깔고, 문구·화살표를 <strong>드래그</strong>해
        배치합니다. 텍스트를 선택하면 <strong>글 배경 박스</strong>(색·투명도·여백)를 켤 수 있습니다. 레이아웃 템플릿은 글자{' '}
        <strong>위치·색·두께</strong> 프리셋이며, 배경 그라데이션은 사진이 없을 때만 쓰입니다. 초안은 <strong>이 브라우저</strong>에
        자동 저장됩니다. 완성 후 <strong>프로젝트 썸네일로 저장</strong>으로 서버에 올리세요.
      </p>

      {editorBoot.restoredDraft ? (
        <div className="yt-upload__banner yt-upload__banner--info" role="status">
          저장된 <strong>직접 만들기 초안</strong>을 불러왔습니다. 다른 PC나 브라우저에서는 초안이 없을 수 있습니다.
        </div>
      ) : null}

      {localError ? (
        <div className="yt-upload__banner yt-upload__banner--error" role="alert">
          {localError}
        </div>
      ) : null}

      <div className="yt-thumb-manual__layout">
        <div className="yt-thumb-manual__preview-wrap">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="yt-thumb-manual__canvas"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            style={{ cursor: 'default', touchAction: 'none' }}
          />
          <p className="yt-thumb-manual__canvas-hint">캔버스에서 요소를 클릭해 선택 · 드래그로 이동 · 화살표는 끝점을 잡아 조절</p>
        </div>

        <div className="yt-thumb-manual__controls">
          <div className="yt-thumb-manual__section">
            <span className="yt-thumb-manual__label">AI 문구 (대본 기반)</span>
            <p className="yt-thumb-manual__hint">
              프로젝트 대본으로 Gemini가 썸네일용 짧은 한국어 2줄을 만듭니다. 받은 뒤 배경 사진만 넣고 위치를 다듬으면 됩니다.
            </p>
            <button
              type="button"
              className="yt-upload__btn yt-upload__btn--ghost"
              disabled={aiBusy}
              onClick={() => void onAiSuggestLines()}
            >
              {aiBusy ? '생성 중…' : '✨ AI로 훅 문구 생성'}
            </button>
          </div>

          <div className="yt-thumb-manual__section">
            <span className="yt-thumb-manual__label">배경 사진</span>
            <label className="yt-thumb-manual__file">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => onPickBackground(e.target.files?.[0] ?? null)}
              />
              <span>이미지 선택 (영상 캡처 등)</span>
            </label>
            {bgObjectUrl ? (
              <button type="button" className="yt-upload__btn yt-upload__btn--ghost yt-thumb-manual__clear-bg" onClick={clearBackground}>
                배경 이미지 제거 (그라데이션으로)
              </button>
            ) : null}
          </div>

          <div className="yt-thumb-manual__section">
            <span className="yt-thumb-manual__label">AI 배경 (문구 없음)</span>
            <p className="yt-thumb-manual__hint">
              업로드 단계 제목·설명·대본을 주제로 <strong>배경 이미지만</strong> 생성해 캔버스에 바로 깝니다. (설정 → Replicate
              키, 나노바나나 이미지 API와 동일)
            </p>
            <textarea
              className="yt-thumb-manual__textarea"
              rows={2}
              placeholder="추가 분위기·색·장소 등 (선택)"
              value={aiBgImageHint}
              onChange={(e) => setAiBgImageHint(e.target.value)}
            />
            <div className="yt-thumb-manual__ai-style-btns" role="group" aria-label="이미지 스타일">
              <button
                type="button"
                className={'yt-thumb-manual__seg-btn' + (aiBgImageStyle === null ? ' yt-thumb-manual__seg-btn--on' : '')}
                onClick={() => setAiBgImageStyle(null)}
              >
                자동
              </button>
              <button
                type="button"
                className={
                  'yt-thumb-manual__seg-btn' + (aiBgImageStyle === 'realism' ? ' yt-thumb-manual__seg-btn--on' : '')
                }
                onClick={() => setAiBgImageStyle('realism')}
              >
                실사
              </button>
              <button
                type="button"
                className={
                  'yt-thumb-manual__seg-btn' + (aiBgImageStyle === 'animation' ? ' yt-thumb-manual__seg-btn--on' : '')
                }
                onClick={() => setAiBgImageStyle('animation')}
              >
                애니
              </button>
            </div>
            <button
              type="button"
              className="yt-upload__btn yt-upload__btn--ghost"
              disabled={aiBgImageBusy || aiBusy}
              onClick={() => void onAiBackgroundImageOnly()}
            >
              {aiBgImageBusy ? '생성 중…' : '🖼 AI로 배경 이미지만 생성·적용'}
            </button>
          </div>

          <div className="yt-thumb-manual__section">
            <span className="yt-thumb-manual__label">레이아웃 템플릿</span>
            <p className="yt-thumb-manual__hint">문구 위치·색·외곽선 조합. 적용 시 첫·둘째 텍스트 박스에 반영됩니다.</p>
            <div className="yt-thumb-manual__layout-grid">
              {THUMB_LAYOUT_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="yt-thumb-manual__layout-card"
                  onClick={() => setTextItems((prev) => applyLayoutPreset(p, prev))}
                >
                  <span className="yt-thumb-manual__layout-card-title">{p.label}</span>
                  <span className="yt-thumb-manual__layout-card-hint">{p.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <details className="yt-thumb-manual__details">
            <summary className="yt-thumb-manual__summary">그라데이션 배경만 쓸 때 (사진 없음)</summary>
            <p className="yt-thumb-manual__hint">사진을 넣지 않으면 아래 색 그라데이션이 깔립니다.</p>
            <div className="yt-thumb-manual__tpl-grid">
              {THUMB_TEMPLATES.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  className={
                    'yt-thumb-manual__tpl' + (templateId === id && !bgObjectUrl ? ' yt-thumb-manual__tpl--on' : '')
                  }
                  onClick={() => setTemplateId(id)}
                  disabled={Boolean(bgObjectUrl)}
                >
                  {label}
                </button>
              ))}
            </div>
          </details>

          <div className="yt-thumb-manual__section">
            <span className="yt-thumb-manual__label">요소 추가 · 순서</span>
            <div className="yt-thumb-manual__toolbar">
              <button type="button" className="yt-upload__btn yt-upload__btn--ghost" onClick={addTextLayer}>
                + 텍스트
              </button>
              <button type="button" className="yt-upload__btn yt-upload__btn--ghost" onClick={addArrow}>
                + 화살표
              </button>
              <button type="button" className="yt-upload__btn yt-upload__btn--ghost" disabled={!selected} onClick={deleteSelected}>
                삭제
              </button>
              <button type="button" className="yt-upload__btn yt-upload__btn--ghost" disabled={!selected} onClick={() => bumpZ(1)}>
                앞으로
              </button>
              <button type="button" className="yt-upload__btn yt-upload__btn--ghost" disabled={!selected} onClick={() => bumpZ(-1)}>
                뒤로
              </button>
            </div>
          </div>

          {selectedText ? (
            <div className="yt-thumb-manual__section yt-thumb-manual__props">
              <span className="yt-thumb-manual__label">선택한 텍스트</span>
              <textarea
                className="yt-thumb-manual__textarea"
                rows={3}
                value={selectedText.text}
                onChange={(e) => updateText(selectedText.id, { text: e.target.value })}
              />
              <ThumbnailFontFamilyPicker
                variant="manual"
                fontFamily={selectedText.fontFamily}
                onChange={(fontFamily) => updateText(selectedText.id, { fontFamily })}
              />
              <div className="yt-thumb-manual__section yt-thumb-manual__row">
                <label className="yt-thumb-manual__mini">
                  크기
                  <input
                    type="range"
                    min={28}
                    max={140}
                    value={selectedText.fontSize}
                    onChange={(e) => updateText(selectedText.id, { fontSize: Number(e.target.value) })}
                  />
                  <span>{selectedText.fontSize}px</span>
                </label>
                <label className="yt-thumb-manual__mini">
                  정렬
                  <select
                    className="yt-thumb-manual__select"
                    value={selectedText.textAlign}
                    onChange={(e) =>
                      updateText(selectedText.id, { textAlign: e.target.value as CanvasTextAlign })
                    }
                  >
                    <option value="left">왼쪽</option>
                    <option value="center">가운데</option>
                    <option value="right">오른쪽</option>
                  </select>
                </label>
              </div>
              <div className="yt-thumb-manual__section yt-thumb-manual__row">
                <label className="yt-thumb-manual__mini">
                  글자색
                  <input type="color" value={selectedText.fill} onChange={(e) => updateText(selectedText.id, { fill: e.target.value })} />
                </label>
              </div>
              <TextStrokeControls
                variant="manual"
                text={selectedText}
                onPatch={(patch) => updateText(selectedText.id, patch)}
              />
              <div className="yt-thumb-manual__section yt-thumb-manual__row yt-thumb-manual__row--wrap">
                <label className="yt-thumb-manual__mini yt-thumb-manual__check">
                  <input
                    type="checkbox"
                    checked={selectedText.boxBackground === true}
                    onChange={(e) => updateText(selectedText.id, { boxBackground: e.target.checked })}
                  />
                  글 배경 박스
                </label>
              </div>
              {selectedText.boxBackground ? (
                <div className="yt-thumb-manual__section yt-thumb-manual__row yt-thumb-manual__row--wrap">
                  <label className="yt-thumb-manual__mini">
                    배경 색
                    <input
                      type="color"
                      value={(() => {
                        const p = parseLooseRgba(selectedText.boxBackgroundColor)
                        const h = (n: number) => n.toString(16).padStart(2, '0')
                        return `#${h(p.r)}${h(p.g)}${h(p.b)}`
                      })()}
                      onChange={(e) => {
                        const p = parseLooseRgba(selectedText.boxBackgroundColor)
                        const hex = e.target.value
                        updateText(selectedText.id, {
                          boxBackgroundColor: rgbaString(
                            parseInt(hex.slice(1, 3), 16),
                            parseInt(hex.slice(3, 5), 16),
                            parseInt(hex.slice(5, 7), 16),
                            p.a,
                          ),
                        })
                      }}
                    />
                  </label>
                  <label className="yt-thumb-manual__mini">
                    배경 투명도
                    <input
                      type="range"
                      min={5}
                      max={100}
                      value={Math.round(parseLooseRgba(selectedText.boxBackgroundColor).a * 100)}
                      onChange={(ev) => {
                        const p = parseLooseRgba(selectedText.boxBackgroundColor)
                        updateText(selectedText.id, {
                          boxBackgroundColor: rgbaString(p.r, p.g, p.b, Number(ev.target.value) / 100),
                        })
                      }}
                    />
                    <span>{Math.round(parseLooseRgba(selectedText.boxBackgroundColor).a * 100)}%</span>
                  </label>
                  <label className="yt-thumb-manual__mini">
                    안쪽 여백 가로
                    <input
                      type="range"
                      min={4}
                      max={48}
                      value={selectedText.boxPaddingX ?? 16}
                      onChange={(e) => updateText(selectedText.id, { boxPaddingX: Number(e.target.value) })}
                    />
                    <span>{selectedText.boxPaddingX ?? 16}px</span>
                  </label>
                  <label className="yt-thumb-manual__mini">
                    안쪽 여백 세로
                    <input
                      type="range"
                      min={4}
                      max={40}
                      value={selectedText.boxPaddingY ?? 10}
                      onChange={(e) => updateText(selectedText.id, { boxPaddingY: Number(e.target.value) })}
                    />
                    <span>{selectedText.boxPaddingY ?? 10}px</span>
                  </label>
                  <label className="yt-thumb-manual__mini">
                    모서리 둥글기
                    <input
                      type="range"
                      min={0}
                      max={32}
                      value={selectedText.boxRadius ?? 12}
                      onChange={(e) => updateText(selectedText.id, { boxRadius: Number(e.target.value) })}
                    />
                    <span>{selectedText.boxRadius ?? 12}px</span>
                  </label>
                </div>
              ) : null}
            </div>
          ) : null}

          {selectedArrow ? (
            <div className="yt-thumb-manual__section yt-thumb-manual__props">
              <span className="yt-thumb-manual__label">선택한 화살표</span>
              <div className="yt-thumb-manual__section yt-thumb-manual__row">
                <label className="yt-thumb-manual__mini">
                  색
                  <input
                    type="color"
                    value={selectedArrow.color}
                    onChange={(e) =>
                      setArrows((prev) =>
                        prev.map((a) => (a.id === selectedArrow.id ? { ...a, color: e.target.value } : a)),
                      )
                    }
                  />
                </label>
                <label className="yt-thumb-manual__mini">
                  두께
                  <input
                    type="range"
                    min={4}
                    max={28}
                    value={selectedArrow.lineWidth}
                    onChange={(e) =>
                      setArrows((prev) =>
                        prev.map((a) =>
                          a.id === selectedArrow.id ? { ...a, lineWidth: Number(e.target.value) } : a,
                        ),
                      )
                    }
                  />
                  <span>{selectedArrow.lineWidth}px</span>
                </label>
              </div>
            </div>
          ) : null}

          <div className="yt-thumb-manual__save-row">
            <button
              type="button"
              className="pd-open-folder-btn"
              onClick={() => void onOpenProjectThumbnailFolder()}
            >
              📁 썸네일 저장 폴더
            </button>
            <button
              type="button"
              className="yt-upload__btn yt-upload__btn--ghost yt-thumb-manual__download"
              disabled={downloadBusy || saveBusy}
              onClick={() => void onDownload()}
            >
              {downloadBusy ? '준비 중…' : '썸네일 다운로드 (JPEG 1280×720)'}
            </button>
            <button
              type="button"
              className="yt-upload__btn yt-upload__btn--primary yt-thumb-manual__save"
              disabled={saveBusy || downloadBusy}
              onClick={() => void onSave()}
            >
              {saveBusy ? '저장 중…' : '캔버스를 프로젝트 썸네일로 저장'}
            </button>
          </div>
          {downloadInfo ? <p className="yt-thumb-manual__download-info">{downloadInfo}</p> : null}
          {lastJpegDownload && !lastJpegDownload.cancelled ? (
            <ThumbnailJpegDownloadSavedPanel
              className="yt-thumb-manual__download-saved"
              result={lastJpegDownload}
              openBusy={openJpegPathBusy}
              onOpenLocation={() => void onOpenLastJpegSavedLocation()}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
