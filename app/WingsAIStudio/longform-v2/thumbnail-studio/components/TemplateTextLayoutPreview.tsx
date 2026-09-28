import { resolveSlotCanvasPivot } from '@/lib/longform-v2/thumbnailTemplateStudio/textCanvasAnchor'
import { STUDIO_CANVAS_H, STUDIO_CANVAS_W, type ThumbnailProTemplate } from '@/lib/longform-v2/thumbnailTemplateStudio/types'

type Props = {
  template: ThumbnailProTemplate
  className?: string
  /** 라이트박스 등 큰 미리보기 */
  large?: boolean
}

/**
 * 미리보기 PNG가 없을 때 슬롯 샘플 문구로 글자 배치를 보여 줍니다.
 * 좌표는 1280×720 캔버스 피벗(xn/yn 또는 실측)을 %로 환산합니다.
 */
export function TemplateTextLayoutPreview({ template, className, large }: Props) {
  const slots = [...template.textSlots].sort((a, b) => a.zIndex - b.zIndex)

  return (
    <div
      className={
        'thumb-tpl-layout-preview' +
        (large ? ' thumb-tpl-layout-preview--large' : '') +
        (className ? ` ${className}` : '')
      }
      style={{ background: template.previewCss }}
      aria-hidden
    >
      {slots.map((slot) => {
        const text = slot.samplePreviewText?.trim()
        if (!text) return null

        const pivot = resolveSlotCanvasPivot(slot)
        const leftPct = (pivot.x / STUDIO_CANVAS_W) * 100
        const topPct = (pivot.y / STUDIO_CANVAS_H) * 100

        const align = slot.textAlign === 'center' ? 'center' : slot.textAlign === 'right' ? 'right' : 'left'
        const tx = align === 'center' ? '-50%' : align === 'right' ? '-100%' : '0'
        const rot = slot.rotationDeg ?? 0
        const fontCqw = (slot.fontSize / STUDIO_CANVAS_W) * 100
        const strokeCqw = Math.min(0.9, (Math.max(0, slot.strokeWidth) / STUDIO_CANVAS_W) * 100)
        const padX = slot.boxPaddingX ?? 10
        const padY = slot.boxPaddingY ?? 8

        return (
          <span
            key={slot.slotKey}
            className="thumb-tpl-layout-preview__slot"
            style={{
              left: `${leftPct}%`,
              top: `${topPct}%`,
              transform: `translate(${tx}, -50%) rotate(${rot}deg)`,
              color: slot.fill,
              fontSize: `${fontCqw}cqw`,
              fontFamily: slot.fontFamily || 'inherit',
              fontWeight: 800,
              textAlign: align,
              WebkitTextStroke:
                strokeCqw > 0.05 ? `${strokeCqw}cqw ${slot.stroke}` : undefined,
              paintOrder: 'stroke fill',
              background: slot.boxBackground
                ? slot.boxBackgroundColor ?? 'rgba(0,0,0,0.9)'
                : undefined,
              padding: slot.boxBackground
                ? `${(padY / STUDIO_CANVAS_H) * 100}cqh ${(padX / STUDIO_CANVAS_W) * 100}cqw`
                : undefined,
              borderRadius: slot.boxBackground
                ? `${((slot.boxRadius ?? 2) / STUDIO_CANVAS_W) * 100}cqw`
                : undefined,
              maxWidth: slot.boxWidthPx
                ? `${(slot.boxWidthPx / STUDIO_CANVAS_W) * 100}%`
                : '92%',
              zIndex: slot.zIndex,
            }}
          >
            {text}
          </span>
        )
      })}
    </div>
  )
}
