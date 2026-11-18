import type { CSSProperties } from "react"
import type { MvpScriptStyleState, MvpVideoTextLayers } from "@/lib/mvp-studio-types"
import { resolveSubtitleFontFamily } from "@/lib/mvp-subtitle-style"
import type { CapCutOverlayText } from "@/lib/capcut-draft-builder"
import { MVP_PREVIEW_STAGE_WIDTH_PX as PREVIEW_STAGE_WIDTH } from "@/lib/mvp-mosaic-overlay-utils"

/**
 * 헤드카피·워터마크·[광고] 레이아웃. 크기는 280px 미리보기 기준이고
 * 미리보기(CSS)와 MP4 렌더(canvas)가 같은 값을 씁니다.
 */
const HEADCOPY_LINE_HEIGHT = 1.18
const HEADCOPY_OUTLINE_RATIO = 0.16
const WATERMARK = { sizePx: 9, xPct: 50, yPct: 94, alpha: 0.55 }
const AD_LABEL = { sizePx: 9, xPct: 4, yPct: 3.2 }
const AD_LABEL_TEXT = "[광고]"
const FONT_FAMILY = resolveSubtitleFontFamily("pretendard-bold")

export function defaultVideoTextLayers(): MvpVideoTextLayers {
  return {
    headcopyOn: true,
    headcopyIndex: 0,
    headcopyColor: "#ffffff",
    headcopyAccentColor: "#ffe14d",
    headcopySizePx: 22,
    headcopyY: 13,
    watermarkText: "",
    adLabelOn: false,
  }
}

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

export function normalizeVideoTextLayers(
  value?: Partial<MvpVideoTextLayers> | null
): MvpVideoTextLayers {
  const base = defaultVideoTextLayers()
  if (!value) return base
  return {
    headcopyOn: value.headcopyOn !== false,
    headcopyIndex: Math.max(0, Math.floor(Number(value.headcopyIndex) || 0)),
    headcopyColor: value.headcopyColor?.startsWith("#") ? value.headcopyColor : base.headcopyColor,
    headcopyAccentColor: value.headcopyAccentColor?.startsWith("#")
      ? value.headcopyAccentColor
      : base.headcopyAccentColor,
    headcopySizePx: clamp(value.headcopySizePx, 14, 36, base.headcopySizePx),
    headcopyY: clamp(value.headcopyY, 4, 40, base.headcopyY),
    watermarkText: String(value.watermarkText ?? "").slice(0, 30),
    adLabelOn: value.adLabelOn === true,
  }
}

/** 영상에 올릴 헤드카피 줄(빈 줄 제외). 꺼져 있으면 [] */
export function resolveHeadcopyLines(scriptStyle: MvpScriptStyleState): string[] {
  const layers = normalizeVideoTextLayers(scriptStyle.videoText)
  if (!layers.headcopyOn) return []
  const row =
    scriptStyle.headcopies[layers.headcopyIndex] ?? scriptStyle.headcopies[0] ?? []
  return row.map((line) => line.trim()).filter(Boolean).slice(0, 2)
}

export function headcopyLineColor(layers: MvpVideoTextLayers, lineIndex: number): string {
  return lineIndex === 0 ? layers.headcopyColor : layers.headcopyAccentColor
}

// ── 미리보기(CSS) ─────────────────────────────────────────

const outlinedText = (sizePx: number, stroke: number): CSSProperties => ({
  fontFamily: FONT_FAMILY,
  fontWeight: 800,
  fontSize: sizePx,
  lineHeight: HEADCOPY_LINE_HEIGHT,
  whiteSpace: "nowrap",
  WebkitTextStroke: `${stroke}px #000000`,
  paintOrder: "stroke fill",
})

export function headcopyBlockStyle(layers: MvpVideoTextLayers, scale: number): CSSProperties {
  const size = layers.headcopySizePx * scale
  return {
    position: "absolute",
    left: "50%",
    top: `${layers.headcopyY}%`,
    transform: "translateX(-50%)",
    maxWidth: "94%",
    textAlign: "center",
    pointerEvents: "none",
    zIndex: 11,
    ...outlinedText(size, size * HEADCOPY_OUTLINE_RATIO),
  }
}

export function watermarkStyle(scale: number): CSSProperties {
  return {
    position: "absolute",
    left: `${WATERMARK.xPct}%`,
    top: `${WATERMARK.yPct}%`,
    transform: "translate(-50%, -50%)",
    color: `rgba(255,255,255,${WATERMARK.alpha})`,
    pointerEvents: "none",
    zIndex: 11,
    ...outlinedText(WATERMARK.sizePx * scale, 0),
    fontWeight: 600,
  }
}

export function adLabelStyle(scale: number): CSSProperties {
  return {
    position: "absolute",
    left: `${AD_LABEL.xPct}%`,
    top: `${AD_LABEL.yPct}%`,
    color: "#ffffff",
    background: "rgba(0,0,0,0.55)",
    borderRadius: 3 * scale,
    padding: `${1.5 * scale}px ${4 * scale}px`,
    pointerEvents: "none",
    zIndex: 11,
    ...outlinedText(AD_LABEL.sizePx * scale, 0),
    fontWeight: 700,
  }
}

export const MVP_AD_LABEL_TEXT = AD_LABEL_TEXT

// ── CapCut 내보내기 ───────────────────────────────────────

/** 미리보기 자막 26px ≈ CapCut 기본 자막 크기 10 */
const CAPCUT_SIZE_PER_PX = 10 / 26
const STAGE_HEIGHT_PER_WIDTH = 16 / 9

/** 헤드카피·워터마크·[광고]를 CapCut 텍스트 트랙 정보로 변환 (위치는 글자 묶음 중심 기준) */
export function mvpVideoTextLayersToCapCut(scriptStyle: MvpScriptStyleState | null | undefined): CapCutOverlayText[] {
  if (!scriptStyle) return []
  const layers = normalizeVideoTextLayers(scriptStyle.videoText)
  const stageH = PREVIEW_STAGE_WIDTH * STAGE_HEIGHT_PER_WIDTH
  const out: CapCutOverlayText[] = []

  const lines = resolveHeadcopyLines(scriptStyle)
  if (lines.length) {
    const blockH = lines.length * layers.headcopySizePx * HEADCOPY_LINE_HEIGHT
    out.push({
      lines: lines.map((text, i) => ({ text, color: headcopyLineColor(layers, i) })),
      yPercent: layers.headcopyY + (blockH / 2 / stageH) * 100,
      size: layers.headcopySizePx * CAPCUT_SIZE_PER_PX,
      outline: true,
    })
  }
  if (layers.watermarkText.trim()) {
    out.push({
      lines: [{ text: layers.watermarkText.trim(), color: "#ffffff" }],
      yPercent: WATERMARK.yPct,
      size: WATERMARK.sizePx * CAPCUT_SIZE_PER_PX,
      alpha: WATERMARK.alpha,
    })
  }
  if (layers.adLabelOn) {
    const labelW = AD_LABEL.sizePx * AD_LABEL_TEXT.length * 0.9 + 8
    out.push({
      lines: [{ text: AD_LABEL_TEXT, color: "#ffffff" }],
      xPercent: AD_LABEL.xPct + (labelW / 2 / PREVIEW_STAGE_WIDTH) * 100,
      yPercent: AD_LABEL.yPct + ((AD_LABEL.sizePx * HEADCOPY_LINE_HEIGHT) / 2 / stageH) * 100,
      size: AD_LABEL.sizePx * CAPCUT_SIZE_PER_PX,
      background: true,
    })
  }
  return out
}

// ── MP4 렌더(canvas) ──────────────────────────────────────

function fitFontSize(ctx: CanvasRenderingContext2D, text: string, size: number, maxW: number) {
  ctx.font = `800 ${size}px ${FONT_FAMILY}`
  const width = ctx.measureText(text).width
  return width > maxW ? Math.max(size * 0.6, (size * maxW) / width) : size
}

export function drawMvpVideoTextLayers(
  ctx: CanvasRenderingContext2D,
  scriptStyle: MvpScriptStyleState,
  cw: number,
  ch: number,
  previewW: number
) {
  const layers = normalizeVideoTextLayers(scriptStyle.videoText)
  const scale = cw / previewW
  ctx.save()
  ctx.textAlign = "center"
  ctx.textBaseline = "top"
  ctx.lineJoin = "round"

  const lines = resolveHeadcopyLines(scriptStyle)
  const baseSize = layers.headcopySizePx * scale
  let y = (layers.headcopyY / 100) * ch
  lines.forEach((line, index) => {
    const size = fitFontSize(ctx, line, baseSize, cw * 0.94)
    ctx.font = `800 ${size}px ${FONT_FAMILY}`
    ctx.strokeStyle = "#000000"
    ctx.lineWidth = size * HEADCOPY_OUTLINE_RATIO * 2
    ctx.strokeText(line, cw / 2, y)
    ctx.fillStyle = headcopyLineColor(layers, index)
    ctx.fillText(line, cw / 2, y)
    y += size * HEADCOPY_LINE_HEIGHT
  })

  if (layers.watermarkText.trim()) {
    ctx.textBaseline = "middle"
    ctx.font = `600 ${WATERMARK.sizePx * scale}px ${FONT_FAMILY}`
    ctx.fillStyle = `rgba(255,255,255,${WATERMARK.alpha})`
    ctx.fillText(layers.watermarkText.trim(), (WATERMARK.xPct / 100) * cw, (WATERMARK.yPct / 100) * ch)
  }

  if (layers.adLabelOn) {
    const size = AD_LABEL.sizePx * scale
    ctx.font = `700 ${size}px ${FONT_FAMILY}`
    ctx.textAlign = "left"
    ctx.textBaseline = "top"
    const padX = 4 * scale
    const padY = 1.5 * scale
    const x = (AD_LABEL.xPct / 100) * cw
    const top = (AD_LABEL.yPct / 100) * ch
    const w = ctx.measureText(AD_LABEL_TEXT).width + padX * 2
    const h = size * HEADCOPY_LINE_HEIGHT + padY * 2
    ctx.fillStyle = "rgba(0,0,0,0.55)"
    ctx.beginPath()
    ctx.roundRect(x, top, w, h, 3 * scale)
    ctx.fill()
    ctx.fillStyle = "#ffffff"
    ctx.fillText(AD_LABEL_TEXT, x + padX, top + padY)
  }
  ctx.restore()
}
