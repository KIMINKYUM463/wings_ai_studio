import type { TextItem } from '@/app/WingsAIStudio/longform-v2/thumbnail-studio/YoutubeThumbnailManualEditor'
import { getProTemplate } from './catalog'
import { resolveExportFrame } from './exportFrame'
import {
  getTextOrientedCorners,
  getTextOrientedHandlePositions,
  getTextRotateHandlePosition,
  measureTextMetrics,
  drawTextFillRangeHighlight,
} from './textGeometry'
import { drawResizeHandlesAtPositions, getResizeHandlePositions, resolveStudioBackgroundLayout, type LayerBounds, type ResizeHandleId } from './studioTransform'

export { measureTextOuterBox } from './textGeometry'
import { getLayerRotateHandlePosition, layerOrientedHandlePositions, layerPivot } from './layerRotation'
import { drawShapeLayer, getShapeRotateHandlePosition, shapeUnrotatedBounds, type StudioShapeLayer } from './shapeLayers'
import type {
  StudioImageLayer,
  StudioLayerRef,
  ThumbnailExportFrame,
  ThumbnailStudioDocument,
} from './types'
import { drawBackgroundScrim, normalizeBackgroundScrim } from './backgroundScrim'
import {
  drawImageWithGradientMask,
  normalizeImageGradientMask,
} from './imageGradientMask'
import { cropToCanvasBounds, fullImageCrop, resolveImageLayerCrop, type StudioImageCrop } from './imageLayerCrop'
import { drawOverlayLayer } from './overlayLayers'
import { studioLayerRefsEqual } from './layerSelection'
import { STUDIO_CANVAS_H, STUDIO_CANVAS_W, STUDIO_EDIT_BLEED, STUDIO_EDIT_CANVAS_H, STUDIO_EDIT_CANVAS_W } from './types'


function drawPlaceholderGradient(ctx: CanvasRenderingContext2D, templateId: string, w: number, h: number): void {
  const tpl = getProTemplate(templateId)
  const css = tpl?.previewCss ?? 'linear-gradient(135deg, #1c1917, #44403c)'
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, '#1c1917')
  g.addColorStop(1, '#44403c')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  void css
}

/** 단일 서브패스만 추가 (beginPath 호출 안 함 — evenodd 링 등 복합 경로용) */
function appendRoundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rad = Math.min(Math.max(0, r), w / 2, h / 2)
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
}

function appendRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.moveTo(x, y)
  ctx.lineTo(x + w, y)
  ctx.lineTo(x + w, y + h)
  ctx.lineTo(x, y + h)
  ctx.closePath()
}

/** 템플릿 외곽 테두리 — evenodd 링 (radius 0 = 직각) */
export function drawTemplateExportFrame(
  ctx: CanvasRenderingContext2D,
  frame: ThumbnailExportFrame,
  w = STUDIO_CANVAS_W,
  h = STUDIO_CANVAS_H,
): void {
  const { color, width, radius } = frame
  const inset = Math.max(4, width)
  const innerW = Math.max(0, w - inset * 2)
  const innerH = Math.max(0, h - inset * 2)
  const innerR = Math.max(0, radius - inset * 0.5)
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  if (radius > 0) {
    appendRoundRectPath(ctx, 0, 0, w, h, radius)
    appendRoundRectPath(ctx, inset, inset, innerW, innerH, innerR)
  } else {
    appendRectPath(ctx, 0, 0, w, h)
    appendRectPath(ctx, inset, inset, innerW, innerH)
  }
  ctx.fill('evenodd')
  ctx.restore()
}

import { drawStudioTextLines, measureStudioTextBlock } from './textTypography'

export function drawTextItem(ctx: CanvasRenderingContext2D, it: TextItem, _maxLineW?: number): void {
  const met = measureTextMetrics(ctx, it)
  const block = measureStudioTextBlock(ctx, it)
  if (!met || !block) return
  const deg = it.rotation ?? 0
  const rad = (deg * Math.PI) / 180
  const { centerX, centerY, pivotX, pivotY } = met

  ctx.save()
  ctx.translate(centerX, centerY)
  if (rad) ctx.rotate(rad)
  ctx.translate(pivotX - centerX, pivotY - centerY)
  drawStudioTextLines(ctx, it, block)
  ctx.restore()
}

export { getTextLocalBounds as textItemToBounds } from './textGeometry'

function drawTextHoverChrome(ctx: CanvasRenderingContext2D, it: TextItem): void {
  const corners = getTextOrientedCorners(ctx, it)
  if (!corners) return
  ctx.save()
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.92)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(corners.nw.x, corners.nw.y)
  ctx.lineTo(corners.ne.x, corners.ne.y)
  ctx.lineTo(corners.se.x, corners.se.y)
  ctx.lineTo(corners.sw.x, corners.sw.y)
  ctx.closePath()
  ctx.stroke()
  ctx.restore()
}

function drawTextSelectionChrome(ctx: CanvasRenderingContext2D, it: TextItem): void {
  const corners = getTextOrientedCorners(ctx, it)
  if (!corners) return
  const pts = [corners.nw, corners.ne, corners.se, corners.sw]
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.closePath()
  ctx.stroke()
  const handles = getTextOrientedHandlePositions(ctx, it)
  if (handles) drawResizeHandlesAtPositions(ctx, handles)
}

function drawLayerRotateHandle(
  ctx: CanvasRenderingContext2D,
  handle: { x: number; y: number; pivotX: number; pivotY: number },
): void {
  ctx.save()
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)'
  ctx.lineWidth = 2
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(handle.pivotX, handle.pivotY)
  ctx.lineTo(handle.x, handle.y)
  ctx.stroke()
  ctx.fillStyle = '#fde047'
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.95)'
  ctx.beginPath()
  ctx.arc(handle.x, handle.y, 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function drawOrientedSelectionBox(
  ctx: CanvasRenderingContext2D,
  handlePositions: Record<ResizeHandleId, { x: number; y: number }>,
): void {
  const pts = [
    handlePositions.nw,
    handlePositions.ne,
    handlePositions.se,
    handlePositions.sw,
  ]
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.closePath()
  ctx.stroke()
  drawResizeHandlesAtPositions(ctx, handlePositions)
}

function drawTextRotateHandle(ctx: CanvasRenderingContext2D, it: TextItem): void {
  const h = getTextRotateHandlePosition(ctx, it)
  if (!h) return
  ctx.save()
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)'
  ctx.lineWidth = 2
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(h.pivotX, h.pivotY)
  ctx.lineTo(h.x, h.y)
  ctx.stroke()
  ctx.fillStyle = '#fde047'
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.95)'
  ctx.beginPath()
  ctx.arc(h.x, h.y, 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function drawImageLayer(ctx: CanvasRenderingContext2D, layer: StudioImageLayer, img: HTMLImageElement): void {
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  const crop = resolveImageLayerCrop(layer, iw, ih)
  drawImageWithGradientMask(
    ctx,
    img,
    layer.x,
    layer.y,
    layer.width,
    layer.height,
    layer.rotation ?? 0,
    layer.gradientMask,
    layer.opacity,
    layer.flipX === true,
    crop,
  )
}

export type ImageCropEditState = {
  layerId: string
  crop: StudioImageCrop
  fullCanvas: LayerBounds
  imgW: number
  imgH: number
}

function drawImageCropPreview(
  ctx: CanvasRenderingContext2D,
  layer: StudioImageLayer,
  img: HTMLImageElement,
  edit: ImageCropEditState,
): void {
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  const fc = edit.fullCanvas
  drawImageWithGradientMask(
    ctx,
    img,
    fc.x,
    fc.y,
    fc.width,
    fc.height,
    layer.rotation ?? 0,
    layer.gradientMask,
    layer.opacity,
    layer.flipX === true,
    fullImageCrop(iw, ih),
  )
}

function drawImageCropEditChrome(
  ctx: CanvasRenderingContext2D,
  layer: StudioImageLayer,
  edit: ImageCropEditState,
): void {
  const bounds = { x: layer.x, y: layer.y, width: layer.width, height: layer.height }
  const pivot = layerPivot(bounds)
  const rot = layer.rotation ?? 0
  const fc = edit.fullCanvas
  const cropCanvas = cropToCanvasBounds(fc, edit.crop, edit.imgW, edit.imgH)

  ctx.save()
  if (rot) {
    const rad = (rot * Math.PI) / 180
    ctx.translate(pivot.x, pivot.y)
    ctx.rotate(rad)
    ctx.translate(-pivot.x, -pivot.y)
  }

  ctx.fillStyle = 'rgba(0, 0, 0, 0.58)'
  const topH = Math.max(0, cropCanvas.y - fc.y)
  const bottomY = cropCanvas.y + cropCanvas.height
  const bottomH = Math.max(0, fc.y + fc.height - bottomY)
  const leftW = Math.max(0, cropCanvas.x - fc.x)
  const rightX = cropCanvas.x + cropCanvas.width
  const rightW = Math.max(0, fc.x + fc.width - rightX)
  if (topH > 0) ctx.fillRect(fc.x, fc.y, fc.width, topH)
  if (bottomH > 0) ctx.fillRect(fc.x, bottomY, fc.width, bottomH)
  if (leftW > 0) ctx.fillRect(fc.x, cropCanvas.y, leftW, cropCanvas.height)
  if (rightW > 0) ctx.fillRect(rightX, cropCanvas.y, rightW, cropCanvas.height)

  ctx.strokeStyle = 'rgba(250, 250, 249, 0.98)'
  ctx.lineWidth = 2
  ctx.setLineDash([6, 4])
  ctx.strokeRect(cropCanvas.x, cropCanvas.y, cropCanvas.width, cropCanvas.height)
  ctx.setLineDash([])
  drawResizeHandlesAtPositions(ctx, getResizeHandlePositions(cropCanvas))
  ctx.restore()
}

function drawStudioEditBleedChrome(ctx: CanvasRenderingContext2D): void {
  const b = STUDIO_EDIT_BLEED
  ctx.fillStyle = '#12100e'
  ctx.fillRect(0, 0, STUDIO_EDIT_CANVAS_W, STUDIO_EDIT_CANVAS_H)
  ctx.fillStyle = '#1a1816'
  ctx.fillRect(b, b, STUDIO_CANVAS_W, STUDIO_CANVAS_H)
}

/** 1280×720보내기 영역 — 콘텐츠 위에 그려 편집 여백(bleed)과 구분 */
function drawStudioEditExportFrame(ctx: CanvasRenderingContext2D): void {
  const b = STUDIO_EDIT_BLEED
  ctx.save()
  ctx.strokeStyle = 'rgba(250,250,249,0.92)'
  ctx.lineWidth = 2
  ctx.setLineDash([])
  ctx.strokeRect(b + 1, b + 1, STUDIO_CANVAS_W - 2, STUDIO_CANVAS_H - 2)
  ctx.restore()
}

function paintStudioDocumentContent(
  ctx: CanvasRenderingContext2D,
  doc: ThumbnailStudioDocument,
  assets: StudioRenderAssets,
  w: number,
  h: number,
  imageCropEdit?: ImageCropEditState,
): void {
  const bg = assets.backgroundImage
  const bgMask = normalizeImageGradientMask(doc.background.gradientMask)
  if (bg?.complete && (bg.naturalWidth || bg.width)) {
    const layout = resolveStudioBackgroundLayout(doc.background.layout, bg, {
      layoutCustomized: doc.background.layoutCustomized,
    })
    if (layout) {
      drawImageWithGradientMask(
        ctx,
        bg,
        layout.x,
        layout.y,
        layout.width,
        layout.height,
        0,
        bgMask.enabled ? bgMask : undefined,
        1,
        doc.background.flipX === true,
      )
    }
  } else {
    drawPlaceholderGradient(ctx, doc.templateId, w, h)
  }

  drawBackgroundScrim(ctx, normalizeBackgroundScrim(doc.background.scrim), w, h)

  const overlays = [...(doc.overlayLayers ?? [])].filter((x) => x.visible)
  const images = [...doc.imageLayers].filter((x) => x.visible)
  const shapes = [...(doc.shapeLayers ?? [])].filter((s) => s.visible !== false)
  const texts = [...doc.textLayers].filter((t) => t.visible !== false)
  const drawQueue = [
    ...overlays.map((layer) => ({
      z: layer.zIndex,
      draw: () => drawOverlayLayer(ctx, layer, w, h),
    })),
    ...images.map((layer) => ({
      z: layer.zIndex,
      draw: () => {
        const img = assets.overlayImages.get(layer.id)
        if (!img?.complete) return
        if (imageCropEdit?.layerId === layer.id) {
          drawImageCropPreview(ctx, layer, img, imageCropEdit)
        } else {
          drawImageLayer(ctx, layer, img)
        }
      },
    })),
    ...shapes.map((s) => ({ z: s.zIndex, draw: () => drawShapeLayer(ctx, s) })),
    ...texts.map((t) => ({ z: t.zIndex, draw: () => drawTextItem(ctx, t) })),
  ].sort((a, b) => a.z - b.z)
  for (const item of drawQueue) item.draw()

  const exportFrame = resolveExportFrame(doc)
  if (exportFrame) drawTemplateExportFrame(ctx, exportFrame, w, h)
}

function paintStudioLayerSelections(
  ctx: CanvasRenderingContext2D,
  doc: ThumbnailStudioDocument,
  assets: StudioRenderAssets,
  selected: StudioLayerRef | null,
  guideOpts:
    | {
        showSafeArea?: boolean
        personZoneRight?: boolean
        textFillHighlight?: { textId: string; start: number; end: number }
        selectedLayers?: StudioLayerRef[]
        imageCropEdit?: ImageCropEditState
        /** 미선택 텍스트 마우스 오버 — 미리캔버스 스타일 실선 테두리 */
        hoveredLayer?: StudioLayerRef | null
      }
    | undefined,
  w: number,
  h: number,
): void {
  const texts = [...doc.textLayers].filter((t) => t.visible !== false)
  const images = [...doc.imageLayers].filter((x) => x.visible)
  const shapes = [...(doc.shapeLayers ?? [])].filter((s) => s.visible !== false)
  const selectionList =
    guideOpts?.selectedLayers?.length
      ? guideOpts.selectedLayers
      : selected
        ? [selected]
        : []
  const secondaryFirst = [...selectionList].sort((a, b) => {
    const aPrimary = selected && studioLayerRefsEqual(a, selected) ? 1 : 0
    const bPrimary = selected && studioLayerRefsEqual(b, selected) ? 1 : 0
    return aPrimary - bPrimary
  })
  for (const ref of secondaryFirst) {
    drawOneLayerSelection(ctx, doc, assets, ref, {
      primary: Boolean(selected && studioLayerRefsEqual(ref, selected)),
      texts,
      images,
      shapes,
      w,
      h,
      textFillHighlight: guideOpts?.textFillHighlight,
      imageCropEdit: guideOpts?.imageCropEdit,
    })
  }

  const hover = guideOpts?.hoveredLayer
  if (hover?.kind === 'text') {
    const alreadySelected = selectionList.some((r) => studioLayerRefsEqual(r, hover))
    if (!alreadySelected) {
      const t = texts.find((x) => x.id === hover.id)
      if (t?.text.trim()) drawTextHoverChrome(ctx, t)
    }
  }

  if (guideOpts?.showSafeArea || guideOpts?.personZoneRight) {
    drawStudioEditorGuides(ctx, {
      showSafeArea: !!guideOpts.showSafeArea,
      personZoneRight: guideOpts.personZoneRight,
    })
  }
}

export type StudioRenderAssets = {
  backgroundImage: HTMLImageElement | null
  overlayImages: Map<string, HTMLImageElement>
}

/** 유튜브 UI 안전 여백·인물 우측 가이드 (편집용,보내기에 포함 안 함 — 호출 전후 분리 권장) */
export function drawStudioEditorGuides(
  ctx: CanvasRenderingContext2D,
  opts: { showSafeArea: boolean; personZoneRight?: boolean },
): void {
  const w = STUDIO_CANVAS_W
  const h = STUDIO_CANVAS_H
  ctx.save()
  if (opts.showSafeArea) {
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)'
    ctx.lineWidth = 2
    ctx.setLineDash([10, 8])
    const m = 0.04
    ctx.strokeRect(w * m, h * m, w * (1 - m * 2), h * (1 - m * 2))
    ctx.setLineDash([])
  }
  if (opts.personZoneRight) {
    ctx.fillStyle = 'rgba(56, 189, 248, 0.12)'
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 6])
    const x0 = w * 0.52
    ctx.fillRect(x0, 0, w - x0, h)
    ctx.strokeRect(x0, 0, w - x0, h)
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(56, 189, 248, 0.85)'
    ctx.font = '600 18px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('인물·컷아웃 권장', x0 + (w - x0) / 2, h * 0.06)
  }
  ctx.restore()
}

function drawOneLayerSelection(
  ctx: CanvasRenderingContext2D,
  doc: ThumbnailStudioDocument,
  assets: StudioRenderAssets,
  ref: StudioLayerRef,
  opts: {
    primary: boolean
    texts: TextItem[]
    images: StudioImageLayer[]
    shapes: StudioShapeLayer[]
    w: number
    h: number
    textFillHighlight?: { textId: string; start: number; end: number }
    imageCropEdit?: ImageCropEditState
  },
): void {
  const { primary, texts, images, shapes, w, h, textFillHighlight, imageCropEdit } = opts
  ctx.save()
  ctx.strokeStyle = primary ? 'rgba(56, 189, 248, 0.95)' : 'rgba(56, 189, 248, 0.55)'
  ctx.lineWidth = primary ? 3 : 2
  ctx.setLineDash(primary ? [8, 6] : [6, 8])

  if (ref.kind === 'text') {
    const t = texts.find((x) => x.id === ref.id)
    if (t) {
      const hl = textFillHighlight
      if (primary && hl && hl.textId === t.id && hl.start !== hl.end) {
        drawTextFillRangeHighlight(ctx, t, hl.start, hl.end)
      }
      const corners = getTextOrientedCorners(ctx, t)
      if (corners) {
        if (primary) {
          drawTextSelectionChrome(ctx, t)
          drawTextRotateHandle(ctx, t)
        } else {
          ctx.beginPath()
          ctx.moveTo(corners.nw.x, corners.nw.y)
          ctx.lineTo(corners.ne.x, corners.ne.y)
          ctx.lineTo(corners.se.x, corners.se.y)
          ctx.lineTo(corners.sw.x, corners.sw.y)
          ctx.closePath()
          ctx.stroke()
        }
      }
    }
  } else if (ref.kind === 'image') {
    const layer = images.find((x) => x.id === ref.id)
    if (layer) {
      if (primary && imageCropEdit?.layerId === layer.id) {
        drawImageCropEditChrome(ctx, layer, imageCropEdit)
        ctx.restore()
        return
      }
      if (layer.locked) ctx.strokeStyle = 'rgba(251, 191, 36, 0.95)'
      const bounds = { x: layer.x, y: layer.y, width: layer.width, height: layer.height }
      const handles = layerOrientedHandlePositions(bounds, layer.rotation ?? 0)
      if (primary) {
        drawOrientedSelectionBox(ctx, handles)
        if (!layer.locked) {
          const rotH = getLayerRotateHandlePosition(bounds, layer.rotation ?? 0)
          drawLayerRotateHandle(ctx, rotH)
        }
      } else {
        const pts = [handles.nw, handles.ne, handles.se, handles.sw]
        ctx.beginPath()
        ctx.moveTo(pts[0].x, pts[0].y)
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
        ctx.closePath()
        ctx.stroke()
      }
    }
  } else if (ref.kind === 'shape') {
    const shape = shapes.find((x) => x.id === ref.id)
    if (shape) {
      const bounds = shapeUnrotatedBounds(shape)
      if (bounds) {
        const handles = layerOrientedHandlePositions(bounds, shape.rotation ?? 0)
        if (primary) {
          drawOrientedSelectionBox(ctx, handles)
          if (shape.kind === 'arrow' || shape.kind === 'line') {
            ctx.setLineDash([])
            ctx.fillStyle = '#fde047'
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.95)'
            const pivot = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
            const rot = shape.rotation ?? 0
            const rad = (rot * Math.PI) / 180
            const cos = Math.cos(rad)
            const sin = Math.sin(rad)
            const pad = 10
            for (const [lx, ly] of [
              [shape.x1, shape.y1],
              [shape.x2, shape.y2],
            ] as const) {
              const dx = lx - pivot.x
              const dy = ly - pivot.y
              const wx = pivot.x + dx * cos - dy * sin
              const wy = pivot.y + dx * sin + dy * cos
              ctx.beginPath()
              ctx.arc(wx, wy, pad, 0, Math.PI * 2)
              ctx.fill()
              ctx.stroke()
            }
            ctx.setLineDash([8, 6])
          }
          const rotH = getShapeRotateHandlePosition(shape)
          if (rotH) drawLayerRotateHandle(ctx, rotH)
        } else {
          const pts = [handles.nw, handles.ne, handles.se, handles.sw]
          ctx.beginPath()
          ctx.moveTo(pts[0].x, pts[0].y)
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
          ctx.closePath()
          ctx.stroke()
        }
      }
    }
  } else if (ref.kind === 'overlay') {
    const ovl = (doc.overlayLayers ?? []).find((x) => x.id === ref.id)
    if (ovl?.visible) {
      ctx.setLineDash([10, 8])
      ctx.strokeStyle = primary ? 'rgba(168, 85, 247, 0.85)' : 'rgba(168, 85, 247, 0.45)'
      ctx.lineWidth = primary ? 2 : 1.5
      ctx.strokeRect(4, 4, w - 8, h - 8)
    }
  } else if (ref.kind === 'background' && doc.background.imageDataUrl) {
    const layout = resolveStudioBackgroundLayout(doc.background.layout, assets.backgroundImage, {
      layoutCustomized: doc.background.layoutCustomized,
    })
    if (layout) {
      if (doc.background.locked) ctx.strokeStyle = 'rgba(251, 191, 36, 0.95)'
      const handles = getResizeHandlePositions(layout)
      if (primary && !doc.background.locked) {
        drawOrientedSelectionBox(ctx, handles)
      } else {
        const pts = [handles.nw, handles.ne, handles.se, handles.sw]
        ctx.beginPath()
        ctx.moveTo(pts[0].x, pts[0].y)
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
        ctx.closePath()
        ctx.stroke()
      }
    }
  }
  ctx.restore()
}

export function renderStudioDocument(
  ctx: CanvasRenderingContext2D,
  doc: ThumbnailStudioDocument,
  assets: StudioRenderAssets,
  selected: StudioLayerRef | null,
  guideOpts?: {
    showSafeArea?: boolean
    personZoneRight?: boolean
    textFillHighlight?: { textId: string; start: number; end: number }
    selectedLayers?: StudioLayerRef[]
    imageCropEdit?: ImageCropEditState
    hoveredLayer?: StudioLayerRef | null
    /** edit: 프레임 밖 여백 포함 편집 뷰 / export: 1280×720 합성만 */
    viewport?: 'edit' | 'export'
  },
): void {
  const w = STUDIO_CANVAS_W
  const h = STUDIO_CANVAS_H
  const viewport = guideOpts?.viewport ?? 'export'
  const imageCropEdit = guideOpts?.imageCropEdit

  if (viewport === 'edit') {
    ctx.clearRect(0, 0, STUDIO_EDIT_CANVAS_W, STUDIO_EDIT_CANVAS_H)
    drawStudioEditBleedChrome(ctx)
    ctx.save()
    ctx.translate(STUDIO_EDIT_BLEED, STUDIO_EDIT_BLEED)
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, w, h)
    ctx.clip()
    paintStudioDocumentContent(ctx, doc, assets, w, h, imageCropEdit)
    ctx.restore()
    paintStudioLayerSelections(ctx, doc, assets, selected, guideOpts, w, h)
    ctx.restore()
    drawStudioEditExportFrame(ctx)
    return
  }

  ctx.clearRect(0, 0, w, h)
  paintStudioDocumentContent(ctx, doc, assets, w, h, imageCropEdit)
  paintStudioLayerSelections(ctx, doc, assets, selected, guideOpts, w, h)
}

/**보내기·저장용 — 가이드 없이 합성만 */
export function renderStudioDocumentForExport(
  ctx: CanvasRenderingContext2D,
  doc: ThumbnailStudioDocument,
  assets: StudioRenderAssets,
): void {
  renderStudioDocument(ctx, doc, assets, null, { viewport: 'export' })
}

export function exportStudioCanvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('썸네일 이미지보내기 실패'))),
      'image/jpeg',
      0.92,
    )
  })
}
