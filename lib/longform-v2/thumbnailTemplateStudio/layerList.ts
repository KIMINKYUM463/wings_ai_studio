import type { TextItem } from '@/app/WingsAIStudio/longform-v2/thumbnail-studio/YoutubeThumbnailManualEditor'
import { overlayPresetLabel } from './overlayLayers'
import { shapeLayerLabel } from './shapeLayers'
import type { StudioLayerRef, ThumbnailStudioDocument } from './types'
import { studioLayerLabel } from './types'

export type StudioLayerListEntry = {
  ref: StudioLayerRef
  label: string
  zIndex: number
  visible: boolean
  canToggleVisible: boolean
}

function textVisible(t: TextItem): boolean {
  return t.visible !== false
}

export function buildStudioLayerList(doc: ThumbnailStudioDocument): StudioLayerListEntry[] {
  const entries: StudioLayerListEntry[] = []

  if (doc.background.imageDataUrl) {
    entries.push({
      ref: { kind: 'background' },
      label: studioLayerLabel(doc, { kind: 'background' }),
      zIndex: 0,
      visible: true,
      canToggleVisible: false,
    })
  }

  for (const o of doc.overlayLayers ?? []) {
    entries.push({
      ref: { kind: 'overlay', id: o.id },
      label: `오버레이: ${o.name || overlayPresetLabel(o.preset)}`,
      zIndex: o.zIndex,
      visible: o.visible,
      canToggleVisible: true,
    })
  }

  for (const img of doc.imageLayers) {
    entries.push({
      ref: { kind: 'image', id: img.id },
      label: img.name?.trim() || '이미지',
      zIndex: img.zIndex,
      visible: img.visible,
      canToggleVisible: true,
    })
  }

  for (const s of doc.shapeLayers ?? []) {
    entries.push({
      ref: { kind: 'shape', id: s.id },
      label: shapeLayerLabel(s),
      zIndex: s.zIndex,
      visible: s.visible !== false,
      canToggleVisible: true,
    })
  }

  for (const t of doc.textLayers) {
    const head = t.text.trim().slice(0, 18)
    entries.push({
      ref: { kind: 'text', id: t.id },
      label: head ? `문구: ${head}` : '문구',
      zIndex: t.zIndex,
      visible: textVisible(t),
      canToggleVisible: true,
    })
  }

  return entries.sort((a, b) => b.zIndex - a.zIndex)
}
