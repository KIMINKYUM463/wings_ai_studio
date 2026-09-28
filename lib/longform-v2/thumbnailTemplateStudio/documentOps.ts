import type { TextItem } from '@/app/WingsAIStudio/longform-v2/thumbnail-studio/YoutubeThumbnailManualEditor'
import { applyTemplateToDocument, clearStudioBackgroundImage, syncTextLayersFromTemplateStyle } from './document'
import { drawableSelectedLayers } from './layerSelection'
import { canonicalTemplateStyleSpec } from './templateLayout'
import {
  applyShapeBoundsResize,
  applyShapeDragMove,
  studioMaxZIndex,
  type StudioShapeLayer,
} from './shapeLayers'
import { resolveExportFrame } from './exportFrame'
import type { StudioImageCrop } from './imageLayerCrop'
import type {
  StudioImageLayer,
  StudioLayerRef,
  StudioOverlayLayer,
  ThumbnailExportFrame,
  ThumbnailStudioDocument,
} from './types'

export type StudioLayerClipboard = {
  texts: Omit<TextItem, 'id' | 'kind'>[]
  images: Omit<StudioImageLayer, 'id'>[]
  shapes: StudioShapeLayer[]
  overlays: Omit<StudioOverlayLayer, 'id'>[]
}

const PASTE_OFFSET = 16

export function cloneStudioDocument(doc: ThumbnailStudioDocument): ThumbnailStudioDocument {
  return JSON.parse(JSON.stringify(doc)) as ThumbnailStudioDocument
}

function newStudioLayerId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** 탭 복제 — 레이어 ID를 새로 부여해 탭 간 충돌 방지 */
export function cloneStudioDocumentForTabDuplicate(
  doc: ThumbnailStudioDocument,
): ThumbnailStudioDocument {
  const next = cloneStudioDocument(doc)
  return {
    ...next,
    textLayers: next.textLayers.map((t) => ({ ...t, id: newStudioLayerId('txt') })),
    imageLayers: next.imageLayers.map((l) => ({ ...l, id: newStudioLayerId('img') })),
    shapeLayers: (next.shapeLayers ?? []).map((s) => ({ ...s, id: newStudioLayerId('shp') })),
    overlayLayers: (next.overlayLayers ?? []).map((o) => ({ ...o, id: newStudioLayerId('ovr') })),
  }
}

/** 드래그 중 React state 없이 캔버스만 즉시 갱신 */
export type DragLiveOverlay = {
  text?: Record<string, { x: number; y: number; fontSize?: number; rotation?: number }>
  image?: Record<
    string,
    { x: number; y: number; width: number; height: number; rotation?: number; crop?: StudioImageCrop }
  >
  background?: { x: number; y: number; width: number; height: number }
  shapes?: Record<string, StudioShapeLayer>
}

export function applyDragLiveOverlay(
  doc: ThumbnailStudioDocument,
  live: DragLiveOverlay | null,
): ThumbnailStudioDocument {
  if (!live) return doc
  let next = doc
  if (live.text && Object.keys(live.text).length > 0) {
    next = {
      ...next,
      textLayers: next.textLayers.map((t) => {
        const p = live.text![t.id]
        return p
          ? {
              ...t,
              x: p.x,
              y: p.y,
              ...(p.fontSize != null ? { fontSize: p.fontSize } : {}),
              ...(p.rotation != null ? { rotation: p.rotation } : {}),
            }
          : t
      }),
    }
  }
  if (live.image && Object.keys(live.image).length > 0) {
    next = {
      ...next,
      imageLayers: next.imageLayers.map((l) => {
        const p = live.image![l.id]
        return p
          ? {
              ...l,
              x: p.x,
              y: p.y,
              width: p.width,
              height: p.height,
              ...(p.rotation != null ? { rotation: p.rotation } : {}),
              ...(p.crop ? { crop: p.crop } : {}),
            }
          : l
      }),
    }
  }
  if (live.background) {
    next = {
      ...next,
      background: { ...next.background, layout: live.background },
    }
  }
  if (live.shapes && Object.keys(live.shapes).length > 0) {
    next = {
      ...next,
      shapeLayers: next.shapeLayers.map((s) => live.shapes![s.id] ?? s),
    }
  }
  return next
}

export function deleteStudioLayer(
  doc: ThumbnailStudioDocument,
  ref: StudioLayerRef,
): ThumbnailStudioDocument {
  if (ref.kind === 'background') return clearStudioBackgroundImage(doc)
  if (ref.kind === 'text') {
    return { ...doc, textLayers: doc.textLayers.filter((t) => t.id !== ref.id) }
  }
  if (ref.kind === 'image') {
    return { ...doc, imageLayers: doc.imageLayers.filter((l) => l.id !== ref.id) }
  }
  if (ref.kind === 'overlay') {
    return { ...doc, overlayLayers: (doc.overlayLayers ?? []).filter((o) => o.id !== ref.id) }
  }
  return { ...doc, shapeLayers: doc.shapeLayers.filter((s) => s.id !== ref.id) }
}

export function deleteStudioLayers(
  doc: ThumbnailStudioDocument,
  refs: StudioLayerRef[],
): ThumbnailStudioDocument {
  let next = doc
  for (const ref of refs) {
    next = deleteStudioLayer(next, ref)
  }
  return next
}

export function extractLayersForClipboard(
  doc: ThumbnailStudioDocument,
  refs: StudioLayerRef[],
): StudioLayerClipboard | null {
  const drawable = drawableSelectedLayers(refs)
  if (!drawable.length) return null

  const texts: Omit<TextItem, 'id' | 'kind'>[] = []
  const images: Omit<StudioImageLayer, 'id'>[] = []
  const shapes: StudioShapeLayer[] = []
  const overlays: Omit<StudioOverlayLayer, 'id'>[] = []

  for (const ref of drawable) {
    if (ref.kind === 'text') {
      const t = doc.textLayers.find((x) => x.id === ref.id)
      if (t) {
        const { id: _id, kind: _kind, ...rest } = t
        texts.push(rest)
      }
    } else if (ref.kind === 'image') {
      const l = doc.imageLayers.find((x) => x.id === ref.id)
      if (l) {
        const { id: _id, ...rest } = l
        images.push(rest)
      }
    } else if (ref.kind === 'shape') {
      const s = doc.shapeLayers.find((x) => x.id === ref.id)
      if (s) shapes.push(JSON.parse(JSON.stringify(s)) as StudioShapeLayer)
    } else if (ref.kind === 'overlay') {
      const o = (doc.overlayLayers ?? []).find((x) => x.id === ref.id)
      if (o) {
        const { id: _id, ...rest } = o
        overlays.push(rest)
      }
    }
  }

  if (!texts.length && !images.length && !shapes.length && !overlays.length) return null
  return { texts, images, shapes, overlays }
}

export function pasteStudioLayerClipboard(
  doc: ThumbnailStudioDocument,
  clip: StudioLayerClipboard,
  offset = PASTE_OFFSET,
): { document: ThumbnailStudioDocument; newRefs: StudioLayerRef[] } {
  let next = doc
  let z = studioMaxZIndex(doc)
  const newRefs: StudioLayerRef[] = []

  for (const item of clip.texts) {
    z += 1
    const t: TextItem = {
      ...item,
      id: newStudioLayerId('txt'),
      kind: 'text',
      x: item.x + offset,
      y: item.y + offset,
      zIndex: z,
    }
    next = { ...next, textLayers: [...next.textLayers, t] }
    newRefs.push({ kind: 'text', id: t.id })
  }

  for (const item of clip.images) {
    z += 1
    const l: StudioImageLayer = {
      ...item,
      id: newStudioLayerId('img'),
      x: item.x + offset,
      y: item.y + offset,
      zIndex: z,
    }
    next = { ...next, imageLayers: [...next.imageLayers, l] }
    newRefs.push({ kind: 'image', id: l.id })
  }

  for (const item of clip.shapes) {
    z += 1
    const s: StudioShapeLayer = {
      ...item,
      id: newStudioLayerId('shp'),
      zIndex: z,
    }
    if (s.kind === 'arrow' || s.kind === 'line') {
      s.x1 += offset
      s.y1 += offset
      s.x2 += offset
      s.y2 += offset
    } else if (s.kind === 'rect' || s.kind === 'path') {
      s.x += offset
      s.y += offset
    } else if (s.kind === 'ellipse') {
      s.cx += offset
      s.cy += offset
    }
    next = { ...next, shapeLayers: [...next.shapeLayers, s] }
    newRefs.push({ kind: 'shape', id: s.id })
  }

  for (const item of clip.overlays) {
    z += 1
    const o: StudioOverlayLayer = {
      ...item,
      id: newStudioLayerId('ovr'),
      zIndex: z,
    }
    next = { ...next, overlayLayers: [...(next.overlayLayers ?? []), o] }
    newRefs.push({ kind: 'overlay', id: o.id })
  }

  return { document: next, newRefs }
}

export function offsetShapeLayer(shape: StudioShapeLayer, dx: number, dy: number): StudioShapeLayer {
  if (shape.kind === 'arrow' || shape.kind === 'line') {
    return {
      ...shape,
      x1: shape.x1 + dx,
      y1: shape.y1 + dy,
      x2: shape.x2 + dx,
      y2: shape.y2 + dy,
    }
  }
  if (shape.kind === 'rect' || shape.kind === 'path') {
    return { ...shape, x: shape.x + dx, y: shape.y + dy }
  }
  return { ...shape, cx: shape.cx + dx, cy: shape.cy + dy }
}

export function buildMultiMoveSnapshot(
  doc: ThumbnailStudioDocument,
  refs: StudioLayerRef[],
): {
  text: Record<string, { ox: number; oy: number }>
  image: Record<string, { ox: number; oy: number }>
  shape: Record<string, StudioShapeLayer>
} {
  const text: Record<string, { ox: number; oy: number }> = {}
  const image: Record<string, { ox: number; oy: number }> = {}
  const shape: Record<string, StudioShapeLayer> = {}

  for (const ref of drawableSelectedLayers(refs)) {
    if (ref.kind === 'text') {
      const t = doc.textLayers.find((x) => x.id === ref.id)
      if (t) text[ref.id] = { ox: t.x, oy: t.y }
    } else if (ref.kind === 'image') {
      const l = doc.imageLayers.find((x) => x.id === ref.id)
      if (l && !l.locked) image[ref.id] = { ox: l.x, oy: l.y }
    } else if (ref.kind === 'shape') {
      const s = doc.shapeLayers.find((x) => x.id === ref.id)
      if (s) shape[ref.id] = JSON.parse(JSON.stringify(s)) as StudioShapeLayer
    }
  }

  return { text, image, shape }
}

export function nudgeStudioLayers(
  doc: ThumbnailStudioDocument,
  refs: StudioLayerRef[],
  dx: number,
  dy: number,
): ThumbnailStudioDocument {
  let next = doc
  for (const ref of drawableSelectedLayers(refs)) {
    if (ref.kind === 'text') {
      next = {
        ...next,
        textLayers: next.textLayers.map((t) =>
          t.id === ref.id ? { ...t, x: t.x + dx, y: t.y + dy } : t,
        ),
      }
    } else if (ref.kind === 'image') {
      next = updateImageLayer(next, ref.id, {
        x: (next.imageLayers.find((l) => l.id === ref.id)?.x ?? 0) + dx,
        y: (next.imageLayers.find((l) => l.id === ref.id)?.y ?? 0) + dy,
      })
    } else if (ref.kind === 'shape') {
      const s = next.shapeLayers.find((x) => x.id === ref.id)
      if (!s) continue
      if (s.kind === 'arrow' || s.kind === 'line') {
        next = updateShapeLayer(next, s.id, {
          x1: s.x1 + dx,
          y1: s.y1 + dy,
          x2: s.x2 + dx,
          y2: s.y2 + dy,
        })
      } else if (s.kind === 'rect' || s.kind === 'path') {
        next = updateShapeLayer(next, s.id, { x: s.x + dx, y: s.y + dy })
      } else {
        next = updateShapeLayer(next, s.id, { cx: s.cx + dx, cy: s.cy + dy })
      }
    }
  }
  return next
}

export function updateOverlayLayer(
  doc: ThumbnailStudioDocument,
  id: string,
  patch: Partial<StudioOverlayLayer>,
): ThumbnailStudioDocument {
  return {
    ...doc,
    overlayLayers: (doc.overlayLayers ?? []).map((o) => (o.id === id ? { ...o, ...patch } : o)),
  }
}

export function updateShapeLayer(
  doc: ThumbnailStudioDocument,
  id: string,
  patch: Partial<StudioShapeLayer>,
): ThumbnailStudioDocument {
  return {
    ...doc,
    shapeLayers: doc.shapeLayers.map((s) =>
      s.id === id ? ({ ...s, ...patch } as StudioShapeLayer) : s,
    ),
  }
}

export { applyShapeBoundsResize, applyShapeDragMove }

export function duplicateTextLayer(doc: ThumbnailStudioDocument, id: string): ThumbnailStudioDocument {
  const src = doc.textLayers.find((t) => t.id === id)
  if (!src) return doc
  const copy: TextItem = {
    ...src,
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `dup-${Date.now()}`,
    x: src.x + 24,
    y: src.y + 24,
    zIndex: src.zIndex + 1,
  }
  return { ...doc, textLayers: [...doc.textLayers, copy] }
}

export function adjustTextZIndex(
  doc: ThumbnailStudioDocument,
  id: string,
  delta: number,
): ThumbnailStudioDocument {
  return {
    ...doc,
    textLayers: doc.textLayers.map((t) =>
      t.id === id ? { ...t, zIndex: Math.max(0, Math.min(99, t.zIndex + delta)) } : t,
    ),
  }
}

export function updateExportFrame(
  doc: ThumbnailStudioDocument,
  patch: Partial<ThumbnailExportFrame>,
): ThumbnailStudioDocument {
  const base = resolveExportFrame(doc)
  if (!base) return doc
  return { ...doc, exportFrame: { ...base, ...patch } }
}

export function updateImageLayer(
  doc: ThumbnailStudioDocument,
  id: string,
  patch: Partial<StudioImageLayer>,
): ThumbnailStudioDocument {
  return {
    ...doc,
    imageLayers: doc.imageLayers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
  }
}

export function resetStudioToTemplate(
  doc: ThumbnailStudioDocument,
  templateId: string,
  keepTexts: boolean,
): ThumbnailStudioDocument {
  const texts = keepTexts ? doc.textLayers.map((t) => t.text) : []
  const style =
    doc.templateId === templateId && doc.templateStyle
      ? canonicalTemplateStyleSpec(templateId, doc.templateStyle) ?? doc.templateStyle
      : null
  const next = applyTemplateToDocument(doc, templateId, texts, style)
  const restored = {
    ...next,
    background: doc.background,
    imageLayers: doc.imageLayers,
    shapeLayers: doc.shapeLayers ?? [],
    overlayLayers: doc.overlayLayers ?? [],
  }
  return keepTexts ? syncTextLayersFromTemplateStyle(restored) : restored
}

export function hitTestImageLayer(
  layers: StudioImageLayer[],
  px: number,
  py: number,
): StudioImageLayer | null {
  const sorted = [...layers].filter((l) => l.visible).sort((a, b) => b.zIndex - a.zIndex)
  for (const l of sorted) {
    if (px >= l.x && px <= l.x + l.width && py >= l.y && py <= l.y + l.height) return l
  }
  return null
}
