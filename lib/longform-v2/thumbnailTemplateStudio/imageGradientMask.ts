/**
 * 사진 레이어·배경용 그라데이션 마스크 — 가장자리를 투명하게 페이드.
 */

/** @deprecated 저장 호환 — rect·linear 는 direction 으로 통합 */
export type ImageGradientMaskType = 'rect' | 'radial' | 'linear'

export type ImageGradientMaskDirection = 'down' | 'up' | 'right' | 'left'

export type StudioImageGradientMask = {
  enabled: boolean
  /** radial: 원형 / 그 외·rect·linear: direction 기반 선형 */
  type: ImageGradientMaskType
  /** 선형 마스크 방향 — 위→아래·아래→위·좌→우·우→좌 */
  direction?: ImageGradientMaskDirection
  /** 0~100 — 불투명(유지) 영역 비율 */
  range: number
}

export const DEFAULT_IMAGE_GRADIENT_MASK: StudioImageGradientMask = {
  enabled: false,
  type: 'rect',
  direction: 'up',
  range: 63,
}

export const IMAGE_GRADIENT_MASK_DIRECTION_OPTIONS: {
  id: ImageGradientMaskDirection
  label: string
  hint: string
}[] = [
  { id: 'down', label: '위→아래', hint: '위쪽 유지·아래로 페이드' },
  { id: 'up', label: '아래→위', hint: '아래쪽 유지·위로 페이드' },
  { id: 'right', label: '좌→우', hint: '왼쪽 유지·오른쪽으로 페이드' },
  { id: 'left', label: '우→좌', hint: '오른쪽 유지·왼쪽으로 페이드' },
]

export function normalizeImageGradientMaskDirection(
  raw?: ImageGradientMaskDirection | string | null,
): ImageGradientMaskDirection {
  if (raw === 'down' || raw === 'up' || raw === 'right' || raw === 'left') return raw
  return 'up'
}

export function normalizeImageGradientMask(
  raw?: StudioImageGradientMask | null,
): StudioImageGradientMask {
  if (!raw) return { ...DEFAULT_IMAGE_GRADIENT_MASK }
  const type: ImageGradientMaskType =
    raw.type === 'radial' || raw.type === 'linear' || raw.type === 'rect' ? raw.type : 'rect'
  const range =
    typeof raw.range === 'number' && Number.isFinite(raw.range)
      ? Math.min(100, Math.max(5, Math.round(raw.range)))
      : DEFAULT_IMAGE_GRADIENT_MASK.range

  let direction = normalizeImageGradientMaskDirection(raw.direction)
  if (!raw.direction) {
    if (type === 'linear') direction = 'right'
    else direction = 'up'
  }

  return { enabled: raw.enabled === true, type, direction, range }
}

function isRadialMask(mask: StudioImageGradientMask): boolean {
  return mask.type === 'radial'
}

type MaskCtx = {
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): {
    addColorStop(offset: number, color: string): void
  }
  createRadialGradient(
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number,
  ): { addColorStop(offset: number, color: string): void }
  fillStyle: string | unknown
  fillRect(x: number, y: number, w: number, h: number): void
  globalCompositeOperation: string
}

function addDirectionalStops(
  g: ReturnType<MaskCtx['createLinearGradient']>,
  t: number,
  feather: number,
  solidAtStart: boolean,
): void {
  const solid = 'rgba(255,255,255,1)'
  const clear = 'rgba(255,255,255,0)'
  const mid = `rgba(255,255,255,${0.45 + t * 0.4})`

  if (solidAtStart) {
    g.addColorStop(0, solid)
    g.addColorStop(t, solid)
    g.addColorStop(Math.min(1, t + feather), mid)
    g.addColorStop(1, clear)
    return
  }

  g.addColorStop(0, clear)
  g.addColorStop(Math.max(0, 1 - t - feather), clear)
  g.addColorStop(1 - t, mid)
  g.addColorStop(1, solid)
}

function buildMaskGradient(
  ctx: MaskCtx,
  w: number,
  h: number,
  mask: StudioImageGradientMask,
): ReturnType<MaskCtx['createLinearGradient']> {
  const t = Math.min(1, Math.max(0.05, mask.range / 100))
  const feather = Math.min(0.35, (1 - t) * 0.85)

  if (isRadialMask(mask)) {
    const cx = w / 2
    const cy = h / 2
    const r = Math.hypot(w, h) * 0.5
    const solid = 'rgba(255,255,255,1)'
    const clear = 'rgba(255,255,255,0)'
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    g.addColorStop(0, solid)
    g.addColorStop(Math.max(0, t - feather * 0.25), solid)
    g.addColorStop(t, `rgba(255,255,255,${0.55 + t * 0.35})`)
    g.addColorStop(1, clear)
    return g
  }

  const dir = normalizeImageGradientMaskDirection(mask.direction)
  if (dir === 'down') {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    addDirectionalStops(g, t, feather, true)
    return g
  }
  if (dir === 'up') {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    addDirectionalStops(g, t, feather, false)
    return g
  }
  if (dir === 'right') {
    const g = ctx.createLinearGradient(0, 0, w, 0)
    addDirectionalStops(g, t, feather, true)
    return g
  }
  const g = ctx.createLinearGradient(w, 0, 0, 0)
  addDirectionalStops(g, t, feather, true)
  return g
}

/** 오프스크린에 그린 이미지에 알파 마스크 적용 */
export function applyImageGradientMaskToContext(
  ctx: MaskCtx,
  w: number,
  h: number,
  mask: StudioImageGradientMask,
): void {
  const m = normalizeImageGradientMask(mask)
  if (!m.enabled || w <= 0 || h <= 0) return
  ctx.globalCompositeOperation = 'destination-in'
  ctx.fillStyle = buildMaskGradient(ctx, w, h, m)
  ctx.fillRect(0, 0, w, h)
  ctx.globalCompositeOperation = 'source-over'
}

function previewCssAngle(dir: ImageGradientMaskDirection): string {
  if (dir === 'down') return '180deg'
  if (dir === 'up') return '0deg'
  if (dir === 'right') return '90deg'
  return '270deg'
}

function previewCssSolidEdge(dir: ImageGradientMaskDirection): 'start' | 'end' {
  if (dir === 'up') return 'end'
  return 'start'
}

/** 미리보기 패널용 CSS */
export function buildImageGradientMaskPreviewCss(mask: StudioImageGradientMask): string {
  const m = normalizeImageGradientMask(mask)
  if (!m.enabled) return 'linear-gradient(180deg, #57534e 0%, #292524 100%)'
  const t = m.range
  if (isRadialMask(m)) {
    return `radial-gradient(circle at 50% 50%, #78716c 0%, #78716c ${t}%, transparent 100%)`
  }
  const dir = normalizeImageGradientMaskDirection(m.direction)
  const angle = previewCssAngle(dir)
  if (previewCssSolidEdge(dir) === 'start') {
    return `linear-gradient(${angle}, #78716c 0%, #78716c ${t}%, transparent 100%)`
  }
  return `linear-gradient(${angle}, transparent 0%, transparent ${100 - t}%, #78716c 100%)`
}

export function drawImageWithGradientMask(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  rotationDeg: number,
  mask: StudioImageGradientMask | undefined,
  opacity = 1,
  flipX = false,
  sourceCrop?: { x: number; y: number; width: number; height: number },
): void {
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  if (!iw || !ih || dw <= 0 || dh <= 0) return

  const sx = sourceCrop?.x ?? 0
  const sy = sourceCrop?.y ?? 0
  const sw = sourceCrop?.width ?? iw
  const sh = sourceCrop?.height ?? ih

  const m = normalizeImageGradientMask(mask)
  const w = Math.max(1, Math.round(dw))
  const h = Math.max(1, Math.round(dh))

  let source: CanvasImageSource = img
  if (m.enabled && typeof document !== 'undefined') {
    const off = document.createElement('canvas')
    off.width = w
    off.height = h
    const octx = off.getContext('2d')
    if (octx) {
      octx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h)
      applyImageGradientMaskToContext(octx, w, h, m)
      source = off
    }
  } else if (sourceCrop) {
    const off = document.createElement('canvas')
    off.width = w
    off.height = h
    const octx = off.getContext('2d')
    if (octx) {
      octx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h)
      source = off
    }
  }

  ctx.save()
  ctx.globalAlpha = opacity
  const rot = rotationDeg ?? 0
  const cx = dx + dw / 2
  const cy = dy + dh / 2
  if (!rot && !flipX && !sourceCrop && !m.enabled) {
    ctx.drawImage(img, dx, dy, dw, dh)
  } else if (!rot && !flipX) {
    ctx.drawImage(source, dx, dy, dw, dh)
  } else {
    ctx.translate(cx, cy)
    if (rot) ctx.rotate((rot * Math.PI) / 180)
    if (flipX) ctx.scale(-1, 1)
    ctx.drawImage(source, -dw / 2, -dh / 2, dw, dh)
  }
  ctx.restore()
}
