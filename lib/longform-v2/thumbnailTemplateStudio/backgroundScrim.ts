import type { StudioBackgroundScrim, StudioBackgroundScrimDirection } from './types'
import { STUDIO_CANVAS_H, STUDIO_CANVAS_W } from './types'

export const DEFAULT_BACKGROUND_SCRIM: StudioBackgroundScrim = {
  enabled: false,
  direction: 'bottom-up',
  opacity: 0.8,
  extent: 0.8,
  feather: 0.28,
  midpoint: 0.35,
  color: '#000000',
}

export const SCRIM_DIRECTION_OPTIONS: ReadonlyArray<{
  value: StudioBackgroundScrimDirection
  label: string
  hint: string
}> = [
  { value: 'bottom-up', label: '하단 → 위', hint: '하단 어둡게 (자막용)' },
  { value: 'top-down', label: '상단 → 아래', hint: '상단 어둡게' },
  { value: 'left-dark', label: '좌 → 우', hint: '왼쪽 어둡게' },
  { value: 'right-dark', label: '우 → 좌', hint: '오른쪽 어둡게' },
  { value: 'diagonal-bl', label: '좌하 ↗', hint: '대각선 (좌하 어둡게)' },
  { value: 'diagonal-tr', label: '우상 ↙', hint: '대각선 (우상 어둡게)' },
  { value: 'vignette', label: '비네팅', hint: '가장자리 어둡게' },
  { value: 'center-dark', label: '중앙 집중', hint: '가운데 어둡게' },
]

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace(/^#/, '').trim()
  if (h.length === 3) {
    return {
      r: parseInt(h[0]! + h[0], 16),
      g: parseInt(h[1]! + h[1], 16),
      b: parseInt(h[2]! + h[2], 16),
    }
  }
  if (h.length >= 6) {
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    }
  }
  return { r: 0, g: 0, b: 0 }
}

function normalizeHexColor(raw: unknown): string {
  if (typeof raw !== 'string') return '#000000'
  const t = raw.trim()
  if (/^#[0-9a-fA-F]{3}$/.test(t) || /^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase()
  return '#000000'
}

const VALID_DIRECTIONS = new Set<StudioBackgroundScrimDirection>(
  SCRIM_DIRECTION_OPTIONS.map((o) => o.value),
)

export function normalizeBackgroundScrim(raw?: Partial<StudioBackgroundScrim> | null): StudioBackgroundScrim {
  if (!raw) return { ...DEFAULT_BACKGROUND_SCRIM }
  const direction = VALID_DIRECTIONS.has(raw.direction as StudioBackgroundScrimDirection)
    ? (raw.direction as StudioBackgroundScrimDirection)
    : 'bottom-up'
  return {
    enabled: Boolean(raw.enabled),
    direction,
    opacity: clamp(
      typeof raw.opacity === 'number' ? raw.opacity : Number(raw.opacity) || DEFAULT_BACKGROUND_SCRIM.opacity,
      0.05,
      0.95,
    ),
    extent: clamp(
      typeof raw.extent === 'number' ? raw.extent : Number(raw.extent) || DEFAULT_BACKGROUND_SCRIM.extent,
      0.15,
      1,
    ),
    feather: clamp(
      typeof raw.feather === 'number' ? raw.feather : Number(raw.feather) || DEFAULT_BACKGROUND_SCRIM.feather,
      0.05,
      1,
    ),
    midpoint: clamp(
      typeof raw.midpoint === 'number' ? raw.midpoint : Number(raw.midpoint) || DEFAULT_BACKGROUND_SCRIM.midpoint,
      0.05,
      0.95,
    ),
    color: normalizeHexColor(raw.color),
  }
}

function scrimRgba(color: string, alpha: number): string {
  const { r, g, b } = parseHexColor(color)
  return `rgba(${r},${g},${b},${alpha})`
}

function applyLinearScrimStops(
  g: CanvasGradient,
  dark: string,
  clear: string,
  feather: number,
  midpoint: number,
): void {
  const hold = clamp(midpoint * (1 - feather * 0.25), 0, 0.88)
  const fadeEnd = clamp(hold + feather * (0.2 + (1 - midpoint) * 0.8), hold + 0.06, 1)
  g.addColorStop(0, dark)
  if (hold > 0.02) g.addColorStop(hold, dark)
  g.addColorStop(fadeEnd, clear)
  g.addColorStop(1, clear)
}

function createScrimLinearGradient(
  ctx: CanvasRenderingContext2D,
  scrim: StudioBackgroundScrim,
  w: number,
  h: number,
): CanvasGradient {
  const extent = scrim.extent ?? 1
  switch (scrim.direction) {
    case 'top-down':
      return ctx.createLinearGradient(0, 0, 0, extent * h)
    case 'left-dark':
      return ctx.createLinearGradient(0, 0, extent * w, 0)
    case 'right-dark':
      return ctx.createLinearGradient(w, 0, w - extent * w, 0)
    case 'diagonal-bl':
      return ctx.createLinearGradient(0, h, extent * w, h - extent * h)
    case 'diagonal-tr':
      return ctx.createLinearGradient(w, 0, w - extent * w, extent * h)
    case 'bottom-up':
    default:
      return ctx.createLinearGradient(0, h, 0, h - extent * h)
  }
}

/** 사이드바 미리보기용 CSS background 값 */
export function buildScrimPreviewCss(
  scrim: StudioBackgroundScrim,
  sampleBg = '#64748b',
): string {
  const n = normalizeBackgroundScrim(scrim)
  if (!n.enabled) return sampleBg
  const { r, g, b } = parseHexColor(n.color ?? '#000000')
  const a = n.opacity
  const rgba = (alpha: number) => `rgba(${r},${g},${b},${alpha.toFixed(3)})`
  const extentPct = Math.round((n.extent ?? 1) * 100)
  const fadeSpan = Math.round(clamp((n.feather ?? 1) * 55, 8, 90))
  const midPct = Math.round((n.midpoint ?? 0.45) * 100)
  const fadeEnd = Math.min(100, midPct + fadeSpan)
  const clearEnd = Math.min(100, Math.max(fadeEnd, extentPct))

  const linear = (dir: string) =>
    `${sampleBg} linear-gradient(${dir}, ${rgba(a)} 0%, ${rgba(a)} ${midPct}%, ${rgba(0)} ${fadeEnd}%, ${rgba(0)} ${clearEnd}%)`

  switch (n.direction) {
    case 'top-down':
      return linear('to bottom')
    case 'left-dark':
      return linear('to right')
    case 'right-dark':
      return linear('to left')
    case 'diagonal-bl':
      return linear('to top right')
    case 'diagonal-tr':
      return linear('to bottom left')
    case 'center-dark':
      return `${sampleBg} radial-gradient(circle at 50% 48%, ${rgba(a)} 0%, ${rgba(a * 0.55)} ${midPct}%, ${rgba(0)} ${extentPct}%)`
    case 'vignette':
      return `${sampleBg} radial-gradient(circle at 50% 45%, ${rgba(0)} ${Math.max(5, 100 - extentPct - fadeSpan)}%, ${rgba(a)} ${Math.min(100, extentPct + 12)}%)`
    case 'bottom-up':
    default:
      return linear('to top')
  }
}

/** 배경(사진·플레이스홀더) 직후, 이미지·도형·문구보다 아래 */
export function drawBackgroundScrim(
  ctx: CanvasRenderingContext2D,
  scrim: StudioBackgroundScrim,
  w = STUDIO_CANVAS_W,
  h = STUDIO_CANVAS_H,
): void {
  if (!scrim.enabled) return
  const normalized = normalizeBackgroundScrim(scrim)
  const alpha = normalized.opacity
  const feather = normalized.feather ?? 1
  const midpoint = normalized.midpoint ?? 0.45
  const extent = normalized.extent ?? 1
  const dark = scrimRgba(normalized.color ?? '#000000', alpha)
  const clear = scrimRgba(normalized.color ?? '#000000', 0)

  ctx.save()

  if (normalized.direction === 'vignette') {
    const innerR = h * 0.06 * (1.4 - extent * 0.4)
    const outerR = h * (0.5 + extent * 0.48)
    const g = ctx.createRadialGradient(w / 2, h * 0.46, innerR, w / 2, h * 0.46, outerR)
    const edge = clamp(1 - feather * 0.55, 0.25, 0.98)
    g.addColorStop(0, clear)
    g.addColorStop(clamp(edge * midpoint, 0.15, 0.92), clear)
    g.addColorStop(1, dark)
    ctx.fillStyle = g
  } else if (normalized.direction === 'center-dark') {
    const innerR = h * 0.04
    const outerR = h * (0.22 + extent * 0.38)
    const g = ctx.createRadialGradient(w / 2, h * 0.48, innerR, w / 2, h * 0.48, outerR)
    g.addColorStop(0, dark)
    g.addColorStop(clamp(midpoint * feather, 0.12, 0.95), scrimRgba(normalized.color ?? '#000000', alpha * 0.35))
    g.addColorStop(1, clear)
    ctx.fillStyle = g
  } else {
    const g = createScrimLinearGradient(ctx, normalized, w, h)
    applyLinearScrimStops(g, dark, clear, feather, midpoint)
    ctx.fillStyle = g
  }

  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}
