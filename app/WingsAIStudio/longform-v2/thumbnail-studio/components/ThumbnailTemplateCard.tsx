import { useEffect, useState, type MouseEvent } from 'react'
import type { ThumbnailProTemplate } from '@/lib/longform-v2/thumbnailTemplateStudio/types'
import { resolveTemplatePreviewAssetUrl } from '@/lib/longform-v2/thumbnailTemplateStudio/templatePreviewUrl'
import { TemplateTextLayoutPreview } from './TemplateTextLayoutPreview'

export type ThumbnailTemplateCardVariant = 'grid' | 'modal'

export type ThumbnailPreviewZoomPayload = {
  caption: string
  /** 미리보기 PNG URL (로드 성공 시) */
  src?: string
  /** PNG 없거나 실패 시 글자 배치 샘플 */
  template?: ThumbnailProTemplate
}

type Props = {
  template: ThumbnailProTemplate
  selected: boolean
  variant: ThumbnailTemplateCardVariant
  isCustom?: boolean
  onSelect: () => void
  onPreviewZoom?: (payload: ThumbnailPreviewZoomPayload) => void
  onEdit?: (e: MouseEvent) => void
  onDelete?: (e: MouseEvent) => void
  onDuplicate?: (e: MouseEvent) => void
}

const CLASS = {
  grid: {
    card: 'thumb-studio__template-card',
    cardOn: 'thumb-studio__template-card--on',
    cardHasZoom: 'thumb-studio__template-card--has-zoom',
    previewWrap: 'thumb-studio__template-preview-wrap',
    preview: 'thumb-studio__template-preview',
    zoom: 'thumb-studio__template-preview-zoom',
    zoomIcon: 'thumb-studio__template-preview-zoom-icon',
  },
  modal: {
    card: 'thumb-tpl-modal__card',
    cardOn: 'thumb-tpl-modal__card--on',
    cardHasZoom: 'thumb-tpl-modal__card--has-zoom',
    previewWrap: 'thumb-tpl-modal__preview-wrap',
    preview: 'thumb-tpl-modal__preview',
    zoom: 'thumb-tpl-modal__preview-zoom',
    zoomIcon: 'thumb-tpl-modal__preview-zoom-icon',
  },
} as const

function hasSampleSlots(t: ThumbnailProTemplate): boolean {
  return t.textSlots.some((s) => Boolean(s.samplePreviewText?.trim()))
}

export function ThumbnailTemplateCard({
  template: t,
  selected,
  variant,
  isCustom,
  onSelect,
  onPreviewZoom,
  onEdit,
  onDelete,
  onDuplicate,
}: Props) {
  const c = CLASS[variant]
  const previewSrc = t.previewImageUrl ? resolveTemplatePreviewAssetUrl(t.previewImageUrl) : ''
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageFailed, setImageFailed] = useState(!previewSrc)

  useEffect(() => {
    setImageLoaded(false)
    setImageFailed(!previewSrc)
  }, [previewSrc])

  const showLayoutFallback = !imageLoaded
  const canZoom = Boolean(onPreviewZoom) && (Boolean(previewSrc) || hasSampleSlots(t))

  const openPreviewZoom = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!canZoom || !onPreviewZoom) return
    if (imageLoaded && previewSrc) {
      onPreviewZoom({
        src: previewSrc,
        caption: `${t.label} · 샘플 미리보기`,
      })
      return
    }
    onPreviewZoom({
      template: t,
      caption: `${t.label} · 글자 배치 샘플`,
    })
  }

  return (
    <div
      role="option"
      aria-selected={selected}
      tabIndex={0}
      className={
        c.card +
        (selected ? ` ${c.cardOn}` : '') +
        (canZoom ? ` ${c.cardHasZoom}` : '') +
        (isCustom ? ` ${c.card}--custom` : '')
      }
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
    >
      <div
        className={
          c.previewWrap + (canZoom && onPreviewZoom ? ` ${c.previewWrap}--zoomable` : '')
        }
        onClick={canZoom && onPreviewZoom ? openPreviewZoom : undefined}
      >
        <div className={c.preview} style={{ background: t.previewCss }}>
          {previewSrc && !imageFailed ? (
            <img
              src={previewSrc}
              alt=""
              className={
                'thumb-tpl-card__preview-img' +
                (imageLoaded ? ' thumb-tpl-card__preview-img--ready' : '')
              }
              draggable={false}
              onLoad={() => {
                setImageLoaded(true)
                setImageFailed(false)
              }}
              onError={() => {
                setImageLoaded(false)
                setImageFailed(true)
              }}
            />
          ) : null}
          {showLayoutFallback ? <TemplateTextLayoutPreview template={t} /> : null}
        </div>
        {canZoom && onPreviewZoom ? (
          <button
            type="button"
            className={c.zoom}
            title="샘플 미리보기 확대"
            aria-label={`${t.label} 샘플 미리보기 확대`}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={openPreviewZoom}
          >
            <span className={c.zoomIcon} aria-hidden>
              ⤢
            </span>
            확대
          </button>
        ) : null}
        {isCustom && (onEdit || onDelete) ? (
          <div className="thumb-tpl-card__custom-actions">
            {onEdit ? (
              <button type="button" className="thumb-tpl-card__action" onClick={onEdit} title="편집">
                ✎
              </button>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                className="thumb-tpl-card__action thumb-tpl-card__action--danger"
                onClick={onDelete}
                title="삭제"
              >
                🗑
              </button>
            ) : null}
          </div>
        ) : null}
        {!isCustom && onDuplicate ? (
          <button
            type="button"
            className="thumb-tpl-card__duplicate"
            title="커스텀으로 복제"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onDuplicate}
          >
            복제
          </button>
        ) : null}
      </div>
      {variant === 'modal' ? (
        <>
          <span className="thumb-tpl-modal__label">{t.label}</span>
          <span className="thumb-tpl-modal__desc">{t.description}</span>
        </>
      ) : (
        <div className="thumb-studio__template-meta">
          <span className="thumb-studio__template-label">{t.label}</span>
          <span className="thumb-studio__template-desc">{t.description}</span>
          <span style={{ marginTop: 4 }}>
            {t.tags.map((tag) => (
              <span key={tag} className="thumb-studio__tag">
                {tag}
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  )
}
