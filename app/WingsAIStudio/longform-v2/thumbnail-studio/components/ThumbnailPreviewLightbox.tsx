import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ThumbnailProTemplate } from '@/lib/longform-v2/thumbnailTemplateStudio/types'
import { TemplateTextLayoutPreview } from './TemplateTextLayoutPreview'

type Props = {
  src?: string
  template?: ThumbnailProTemplate
  caption?: string
  onClose: () => void
}

/** 썸네일 템플릿 샘플 전용 — 스튜디오·템플릿 모달(z-index 15k~20k) 위에 표시 */
export function ThumbnailPreviewLightbox({ src, template, caption, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return createPortal(
    <div
      className="thumb-preview-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="템플릿 샘플 확대"
      onClick={onClose}
    >
      <div className="thumb-preview-lightbox__frame" onClick={(e) => e.stopPropagation()}>
        <div className="thumb-preview-lightbox__toolbar">
          {caption ? <span className="thumb-preview-lightbox__caption">{caption}</span> : <span />}
          <button type="button" className="thumb-preview-lightbox__close" onClick={onClose}>
            닫기 ✕
          </button>
        </div>
        <div className="thumb-preview-lightbox__stage">
          {src ? (
            <img src={src} alt="" className="thumb-preview-lightbox__img" />
          ) : template ? (
            <TemplateTextLayoutPreview
              template={template}
              large
              className="thumb-preview-lightbox__layout"
            />
          ) : null}
        </div>
        <p className="thumb-preview-lightbox__hint">바깥 클릭 또는 Esc로 닫기</p>
      </div>
    </div>,
    document.body,
  )
}
