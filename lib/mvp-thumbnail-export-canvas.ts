import { renderBackgroundToCanvas } from "@/lib/mvp-thumbnail-inpaint"
import {
  THUMBNAIL_EXPORT_H,
  THUMBNAIL_EXPORT_W,
  THUMBNAIL_STAGE_BASE_W,
  defaultThumbnailTexts,
  hookingFromThumbnailDesign,
  resolveBackgroundTransform,
  type MvpThumbnailDesign,
  type ThumbnailFilterState,
  type ThumbnailTextLayer,
} from "@/lib/mvp-thumbnail-design"

const THUMB_FONT = '"Noto Sans KR","Pretendard",system-ui,sans-serif'

function splitLines(text: string): string[] {
  const lines = text.split("\n")
  return lines.length ? lines : [""]
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const raw = hex.trim().replace(/^#/, "")
  if (raw.length === 3) {
    return {
      r: parseInt(raw[0]! + raw[0]!, 16),
      g: parseInt(raw[1]! + raw[1]!, 16),
      b: parseInt(raw[2]! + raw[2]!, 16),
    }
  }
  return {
    r: parseInt(raw.slice(0, 2), 16) || 0,
    g: parseInt(raw.slice(2, 4), 16) || 0,
    b: parseInt(raw.slice(4, 6), 16) || 0,
  }
}

function resolveExportTexts(design: MvpThumbnailDesign): ThumbnailTextLayer[] {
  if (design.aiBaked) return []
  const populated = design.texts.filter((t) => t.text.trim())
  if (populated.length > 0) return design.texts
  const hooking = hookingFromThumbnailDesign(design)
  if (!hooking.line1.trim() && !hooking.line2.trim()) return []
  return defaultThumbnailTexts(hooking)
}

async function ensureThumbnailFonts(texts: readonly ThumbnailTextLayer[]): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return

  const exportScale = THUMBNAIL_EXPORT_W / THUMBNAIL_STAGE_BASE_W
  const sizes = new Set<number>()
  const weights = new Set<number>()
  for (const layer of texts) {
    sizes.add(Math.max(12, Math.round(layer.fontSize * exportScale)))
    weights.add(layer.fontWeight)
  }
  if (!sizes.size) sizes.add(Math.round(48 * exportScale))
  if (!weights.size) weights.add(900)

  const loads: Promise<unknown>[] = []
  for (const size of sizes) {
    for (const weight of weights) {
      loads.push(document.fonts.load(`${weight} ${size}px "Noto Sans KR"`))
      loads.push(document.fonts.load(`${weight} ${size}px Pretendard`))
    }
  }
  await Promise.allSettled(loads)
  await document.fonts.ready
}

function drawPostFilters(
  ctx: CanvasRenderingContext2D,
  filter: ThumbnailFilterState,
  cw: number,
  ch: number
): void {
  if (filter.gradientTop && filter.gradientOpacity > 0) {
    const grd = ctx.createLinearGradient(0, 0, 0, ch * 0.45)
    grd.addColorStop(0, `rgba(0,0,0,${filter.gradientOpacity / 100})`)
    grd.addColorStop(1, "rgba(0,0,0,0)")
    ctx.fillStyle = grd
    ctx.fillRect(0, 0, cw, ch * 0.45)
  }

  if (filter.vignette > 0) {
    const radius = Math.max(cw, ch) * 0.72
    const grd = ctx.createRadialGradient(cw / 2, ch / 2, radius * 0.4, cw / 2, ch / 2, radius)
    grd.addColorStop(0, "rgba(0,0,0,0)")
    grd.addColorStop(1, `rgba(0,0,0,${filter.vignette / 100})`)
    ctx.fillStyle = grd
    ctx.fillRect(0, 0, cw, ch)
  }
}

function resetShadow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowColor = "transparent"
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
}

function drawThumbnailTextLayer(
  ctx: CanvasRenderingContext2D,
  layer: ThumbnailTextLayer,
  cw: number,
  ch: number,
  stageBaseW = THUMBNAIL_STAGE_BASE_W
): void {
  const lines = splitLines(layer.text)
  const scale = cw / stageBaseW
  const fontSize = layer.fontSize * scale
  const maxWidth = (layer.widthPct / 100) * cw
  const lineHeight = fontSize * 1.2
  const lineGap = 2 * scale
  const blockHeight = lines.length * lineHeight + Math.max(0, lines.length - 1) * lineGap

  ctx.save()
  ctx.filter = "none"
  ctx.translate((layer.x / 100) * cw, (layer.y / 100) * ch)
  ctx.rotate((layer.rotation * Math.PI) / 180)

  const textX = 0
  let y = -blockHeight / 2 + lineHeight / 2

  for (const line of lines) {
    const content = line.trim() ? line : "\u00a0"
    ctx.font = `${layer.fontWeight} ${fontSize}px ${THUMB_FONT}`
    ctx.textAlign = layer.align
    ctx.textBaseline = "middle"

    if (layer.bgOn) {
      const metrics = ctx.measureText(content)
      const padX = 12 * scale
      const padY = 6 * scale
      const bgW = Math.min(maxWidth, metrics.width) + padX * 2
      const bgH = lineHeight + padY * 2
      let bgLeft = textX
      if (layer.align === "center") bgLeft = textX - bgW / 2
      else if (layer.align === "right") bgLeft = textX - bgW

      const { r, g, b } = hexToRgb(layer.bgColor)
      ctx.fillStyle = `rgba(${r},${g},${b},${(layer.bgOpacity ?? 70) / 100})`
      const radius = 8 * scale
      ctx.beginPath()
      ctx.roundRect(bgLeft, y - bgH / 2, bgW, bgH, radius)
      ctx.fill()
    }

    if (layer.shadow) {
      ctx.shadowColor = "rgba(0,0,0,0.75)"
      ctx.shadowBlur = 8 * scale
      ctx.shadowOffsetX = 2 * scale
      ctx.shadowOffsetY = 3 * scale
    } else {
      resetShadow(ctx)
    }

    if (layer.strokeOn && layer.strokeWidth > 0) {
      ctx.strokeStyle = layer.strokeColor
      ctx.lineWidth = layer.strokeWidth * scale
      ctx.lineJoin = "round"
      ctx.miterLimit = 2
      ctx.strokeText(content, textX, y, maxWidth)
    }

    ctx.fillStyle = layer.color
    ctx.fillText(content, textX, y, maxWidth)
    resetShadow(ctx)

    y += lineHeight + lineGap
  }

  ctx.restore()
}

function hideStageLayers(clonedStage: HTMLElement, selectors: string[]): void {
  for (const selector of selectors) {
    clonedStage.querySelectorAll(selector).forEach((node) => {
      if (node instanceof HTMLElement) node.style.display = "none"
    })
  }
}

function prepareOverlayCaptureClone(clonedStage: HTMLElement): void {
  clonedStage.style.boxShadow = "none"
  clonedStage.style.outline = "none"
  clonedStage.style.background = "transparent"

  clonedStage.querySelectorAll("[data-thumb-export-skip]").forEach((node) => {
    node.remove()
  })

  hideStageLayers(clonedStage, [
    "[data-thumb-bg]",
    "[data-thumb-filter]",
    "[data-thumb-text-layer]",
    "[data-thumb-brush]",
  ])

  clonedStage.querySelectorAll("[class*='ring-violet'], [class*='ring-cyan'], [class*='ring-amber']").forEach((node) => {
    if (!(node instanceof HTMLElement)) return
    node.classList.remove(
      "ring-2",
      "ring-violet-500",
      "ring-offset-2",
      "ring-offset-transparent",
      "ring-offset-black/30",
      "ring-cyan-400",
      "ring-amber-400/80"
    )
  })
}

async function captureOverlayLayer(stageEl: HTMLElement, scale: number): Promise<HTMLCanvasElement | null> {
  const { default: html2canvas } = await import("html2canvas-pro")
  return html2canvas(stageEl, {
    scale,
    useCORS: true,
    allowTaint: true,
    backgroundColor: null,
    logging: false,
    onclone: (_doc, clonedStage) => {
      if (clonedStage instanceof HTMLElement) {
        prepareOverlayCaptureClone(clonedStage)
      }
    },
  })
}

/** 스튜디오 design 기준 PNG — 텍스트는 Canvas 2D로 그려 편집기와 동일한 테두리·그림자 */
export async function exportThumbnailDesignToDataUrl(
  design: MvpThumbnailDesign,
  stageEl: HTMLElement
): Promise<string> {
  const texts = resolveExportTexts(design)
  if (!design.aiBaked && texts.length === 0) {
    throw new Error("썸네일 텍스트가 없습니다. 후킹 문구를 입력한 뒤 다시 적용해 주세요.")
  }
  await ensureThumbnailFonts(texts)

  if (design.aiBaked && design.backgroundUrl.trim()) {
    const canvas = await renderBackgroundToCanvas(
      design.backgroundUrl.trim(),
      resolveBackgroundTransform(design),
      design.filter,
      THUMBNAIL_EXPORT_W,
      THUMBNAIL_EXPORT_H
    )
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("썸네일 캔버스를 사용할 수 없습니다.")
    drawPostFilters(ctx, design.filter, THUMBNAIL_EXPORT_W, THUMBNAIL_EXPORT_H)
    return canvas.toDataURL("image/png")
  }

  if (!design.backgroundUrl.trim()) {
    throw new Error("배경 이미지가 없습니다.")
  }

  const canvas = await renderBackgroundToCanvas(
    design.backgroundUrl.trim(),
    resolveBackgroundTransform(design),
    design.filter,
    THUMBNAIL_EXPORT_W,
    THUMBNAIL_EXPORT_H
  )
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("썸네일 캔버스를 사용할 수 없습니다.")

  drawPostFilters(ctx, design.filter, THUMBNAIL_EXPORT_W, THUMBNAIL_EXPORT_H)

  const rect = stageEl.getBoundingClientRect()
  const scale = rect.width > 0 ? THUMBNAIL_EXPORT_W / rect.width : THUMBNAIL_EXPORT_W / THUMBNAIL_STAGE_BASE_W

  if (design.elements.length > 0) {
    const overlayCanvas = await captureOverlayLayer(stageEl, scale)
    if (overlayCanvas) {
      ctx.drawImage(overlayCanvas, 0, 0, canvas.width, canvas.height)
    }
  }

  ctx.filter = "none"
  for (const layer of texts) {
    drawThumbnailTextLayer(ctx, layer, canvas.width, canvas.height)
  }

  return canvas.toDataURL("image/png")
}
