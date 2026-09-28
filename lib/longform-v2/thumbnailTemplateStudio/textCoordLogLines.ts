import type { TextItem } from '@/app/WingsAIStudio/longform-v2/thumbnail-studio/YoutubeThumbnailManualEditor'
import { getProTemplate } from './catalog'
import { measureTextOuterBox } from './textGeometry'
import { resolveTemplateTextSlots } from './templateTextSlots'
import { STUDIO_CANVAS_H, STUDIO_CANVAS_W } from './types'
import type { ThumbnailStudioDocument } from './types'

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (typeof OffscreenCanvas !== 'undefined') {
    const c = new OffscreenCanvas(STUDIO_CANVAS_W, STUDIO_CANVAS_H)
    return c.getContext('2d') as CanvasRenderingContext2D | null
  }
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas')
    c.width = STUDIO_CANVAS_W
    c.height = STUDIO_CANVAS_H
    return c.getContext('2d')
  }
  return null
}

const SLOT_LINE_LABEL: Record<string, string> = {
  hook: '1번째',
  highlight: '2번째',
  main_title: '3번째',
  sub: '3번째',
}

/** 썸네일 스튜디오 하단 좌표 로그 — 문구 레이어별 피벗·정규화·외접 박스 */
export function buildThumbnailTextCoordLogLines(doc: ThumbnailStudioDocument): string[] {
  const tpl = getProTemplate(doc.templateId)
  const slots = resolveTemplateTextSlots(doc.templateId, doc.templateStyle)
  const ctx = getMeasureContext()
  const lines: string[] = []

  doc.textLayers.forEach((layer: TextItem, i: number) => {
    const slot = slots[i]
    const key = slot?.slotKey ?? `layer${i}`
    const lineLabel = SLOT_LINE_LABEL[key] ?? `${i + 1}번째`
    const preview = layer.text.trim() || slot?.samplePreviewText?.trim() || '(비어 있음)'
    const shortText =
      preview.length > 18 ? `${preview.slice(0, 16)}…` : preview

    const x = Math.round(layer.x)
    const y = Math.round(layer.y)
    const xn = slot != null ? slot.xn.toFixed(3) : '—'
    const yn = slot != null ? slot.yn.toFixed(3) : '—'
    const pinned =
      slot?.pivotXPx != null && slot?.pivotYPx != null
        ? ` · 고정피벗(${Math.round(slot.pivotXPx)},${Math.round(slot.pivotYPx)})`
        : ''

    let boxPart = ''
    if (ctx && layer.text.trim()) {
      const b = measureTextOuterBox(ctx, layer)
      boxPart = ` · 박스 L${Math.round(b.left)} T${Math.round(b.top)} R${Math.round(
        b.right,
      )} B${Math.round(b.bottom)}`
    }

    lines.push(
      `[${lineLabel}/${key}] 「${shortText}」 피벗 x=${x} y=${y} · xn=${xn} yn=${yn}${pinned}${boxPart}`,
    )
  })

  if (!lines.length && tpl) {
    return ['(문구 레이어 없음)']
  }

  return lines
}
