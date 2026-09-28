import type { StudioLayerRef, ThumbnailStudioDocument } from './types'
import { studioMaxZIndex } from './shapeLayers'

export type StudioLayerReorderOp = 'front' | 'back' | 'forward' | 'backward'

const Z_MIN = 1
const Z_MAX = 99

type DrawableLayer = {
  kind: 'text' | 'image' | 'shape' | 'overlay'
  id: string
  zIndex: number
}

function listDrawableLayers(doc: ThumbnailStudioDocument): DrawableLayer[] {
  return [
    ...doc.textLayers.map((t) => ({ kind: 'text' as const, id: t.id, zIndex: t.zIndex })),
    ...doc.imageLayers.map((l) => ({ kind: 'image' as const, id: l.id, zIndex: l.zIndex })),
    ...(doc.shapeLayers ?? []).map((s) => ({ kind: 'shape' as const, id: s.id, zIndex: s.zIndex })),
    ...(doc.overlayLayers ?? []).map((o) => ({ kind: 'overlay' as const, id: o.id, zIndex: o.zIndex })),
  ]
}

function clampZ(z: number): number {
  return Math.max(Z_MIN, Math.min(Z_MAX, Math.round(z)))
}

function patchLayerZ(
  doc: ThumbnailStudioDocument,
  ref: Exclude<StudioLayerRef, { kind: 'background' }>,
  zIndex: number,
): ThumbnailStudioDocument {
  const z = clampZ(zIndex)
  if (ref.kind === 'text') {
    return {
      ...doc,
      textLayers: doc.textLayers.map((t) => (t.id === ref.id ? { ...t, zIndex: z } : t)),
    }
  }
  if (ref.kind === 'image') {
    return {
      ...doc,
      imageLayers: doc.imageLayers.map((l) => (l.id === ref.id ? { ...l, zIndex: z } : l)),
    }
  }
  if (ref.kind === 'overlay') {
    return {
      ...doc,
      overlayLayers: (doc.overlayLayers ?? []).map((o) => (o.id === ref.id ? { ...o, zIndex: z } : o)),
    }
  }
  return {
    ...doc,
    shapeLayers: (doc.shapeLayers ?? []).map((s) => (s.id === ref.id ? { ...s, zIndex: z } : s)),
  }
}

/** 텍스트·이미지·도형 공통 z-order (배경·그라데이션 제외) */
export function reorderStudioLayer(
  doc: ThumbnailStudioDocument,
  ref: Exclude<StudioLayerRef, { kind: 'background' }>,
  op: StudioLayerReorderOp,
): ThumbnailStudioDocument {
  const sorted = [...listDrawableLayers(doc)].sort((a, b) => a.zIndex - b.zIndex)
  const idx = sorted.findIndex((l) => l.kind === ref.kind && l.id === ref.id)
  if (idx < 0) return doc

  const cur = sorted[idx]!

  if (op === 'front') {
    const maxZ = studioMaxZIndex(doc)
    if (cur.zIndex >= maxZ) return doc
    return patchLayerZ(doc, ref, maxZ + 1)
  }

  if (op === 'back') {
    const minZ = sorted[0]!.zIndex
    if (cur.zIndex <= minZ && minZ <= Z_MIN) return doc
    if (cur.zIndex > minZ) return patchLayerZ(doc, ref, minZ - 1)
    return patchLayerZ(doc, ref, Z_MIN)
  }

  if (op === 'forward') {
    if (idx >= sorted.length - 1) {
      return cur.zIndex >= Z_MAX ? doc : patchLayerZ(doc, ref, cur.zIndex + 1)
    }
    const above = sorted[idx + 1]!
    if (above.zIndex <= cur.zIndex) {
      return patchLayerZ(doc, ref, Math.min(Z_MAX, cur.zIndex + 1))
    }
    let next = patchLayerZ(doc, ref, above.zIndex)
    next = patchLayerZ(next, { kind: above.kind, id: above.id }, cur.zIndex)
    return next
  }

  if (idx <= 0) {
    return cur.zIndex <= Z_MIN ? doc : patchLayerZ(doc, ref, cur.zIndex - 1)
  }
  const below = sorted[idx - 1]!
  if (below.zIndex >= cur.zIndex) {
    return patchLayerZ(doc, ref, Math.max(Z_MIN, cur.zIndex - 1))
  }
  let next = patchLayerZ(doc, ref, below.zIndex)
  next = patchLayerZ(next, { kind: below.kind, id: below.id }, cur.zIndex)
  return next
}
