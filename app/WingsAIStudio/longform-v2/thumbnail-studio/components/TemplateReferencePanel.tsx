import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { getProTemplate } from '@/lib/longform-v2/thumbnailTemplateStudio/catalog'
import { resolveTemplatePreviewAssetUrl } from '@/lib/longform-v2/thumbnailTemplateStudio/templatePreviewUrl'
import { ThumbnailPreviewLightbox } from './ThumbnailPreviewLightbox'
import { TemplateTextLayoutPreview } from './TemplateTextLayoutPreview'

type Props = {
  templateId: string
  /** 드래그 범위 — 캔버스 wrap */
  containerRef?: RefObject<HTMLElement | null>
}

type DragState = {
  pointerId: number
  startX: number
  startY: number
  origX: number
  origY: number
}

const DEFAULT_POS = { x: 14, y: 52 }
const PANEL_W = 152
const PANEL_H = 210
const COLLAPSED_W = 40
const COLLAPSED_H = 88

function clampPos(
  x: number,
  y: number,
  panelW: number,
  panelH: number,
  container: HTMLElement | null,
): { x: number; y: number } {
  if (!container) return { x, y }
  const maxX = Math.max(8, container.clientWidth - panelW - 8)
  const maxY = Math.max(8, container.clientHeight - panelH - 8)
  return {
    x: Math.min(maxX, Math.max(8, x)),
    y: Math.min(maxY, Math.max(8, y)),
  }
}

/** 편집 캔버스 위 플로팅 — 선택 템플릿 샘플 미리보기(드래그 이동) */
export function TemplateReferencePanel({ templateId, containerRef }: Props) {
  const tpl = getProTemplate(templateId)
  const [collapsed, setCollapsed] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [pos, setPos] = useState(DEFAULT_POS)
  const panelRef = useRef<HTMLElement | null>(null)
  const dragRef = useRef<DragState | null>(null)

  const previewSrc = useMemo(() => {
    const url = tpl?.previewImageUrl?.trim()
    return url ? resolveTemplatePreviewAssetUrl(url) : ''
  }, [tpl?.previewImageUrl])

  const [imageFailed, setImageFailed] = useState(!previewSrc)

  useEffect(() => {
    setImageFailed(!previewSrc)
  }, [previewSrc, templateId])

  const showLayoutFallback = imageFailed || !previewSrc
  const canOpenLightbox = Boolean(previewSrc && !imageFailed) || Boolean(tpl)

  const clampToContainer = useCallback(
    (x: number, y: number, w: number, h: number) =>
      clampPos(x, y, w, h, containerRef?.current ?? null),
    [containerRef],
  )

  useEffect(() => {
    setPos((p) =>
      clampToContainer(p.x, p.y, collapsed ? COLLAPSED_W : PANEL_W, collapsed ? COLLAPSED_H : PANEL_H),
    )
  }, [collapsed, clampToContainer, templateId])

  useEffect(() => {
    const el = containerRef?.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      setPos((p) =>
        clampToContainer(p.x, p.y, collapsed ? COLLAPSED_W : PANEL_W, collapsed ? COLLAPSED_H : PANEL_H),
      )
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef, collapsed, clampToContainer])

  const onDragPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button:not(.thumb-studio__tpl-ref-drag)')) return
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    e.preventDefault()
    e.stopPropagation()
  }

  const onDragPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    const w = collapsed ? COLLAPSED_W : PANEL_W
    const h = collapsed ? COLLAPSED_H : PANEL_H
    setPos(
      clampToContainer(d.origX + (e.clientX - d.startX), d.origY + (e.clientY - d.startY), w, h),
    )
  }

  const onDragPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current?.pointerId !== e.pointerId) return
    dragRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  if (!tpl) return null

  if (collapsed) {
    return (
      <aside
        ref={panelRef}
        className="thumb-studio__tpl-ref thumb-studio__tpl-ref--floating thumb-studio__tpl-ref--collapsed"
        style={{ left: pos.x, top: pos.y }}
        aria-label="템플릿 참고"
      >
        <div
          className="thumb-studio__tpl-ref-head thumb-studio__tpl-ref-head--drag"
          onPointerDown={onDragPointerDown}
          onPointerMove={onDragPointerMove}
          onPointerUp={onDragPointerUp}
          onPointerCancel={onDragPointerUp}
        >
          <button
            type="button"
            className="thumb-studio__tpl-ref-drag"
            title="드래그하여 이동"
            aria-label="드래그하여 이동"
            tabIndex={-1}
          >
            ⠿
          </button>
          <button
            type="button"
            className="thumb-studio__tpl-ref-expand"
            title="템플릿 참고 미리보기 펼치기"
            onClick={(e) => {
              e.stopPropagation()
              setCollapsed(false)
            }}
          >
            참고
          </button>
        </div>
      </aside>
    )
  }

  return (
    <>
      <aside
        ref={panelRef}
        className="thumb-studio__tpl-ref thumb-studio__tpl-ref--floating"
        style={{ left: pos.x, top: pos.y }}
        aria-label="선택 템플릿 참고"
      >
        <div
          className="thumb-studio__tpl-ref-head thumb-studio__tpl-ref-head--drag"
          onPointerDown={onDragPointerDown}
          onPointerMove={onDragPointerMove}
          onPointerUp={onDragPointerUp}
          onPointerCancel={onDragPointerUp}
        >
          <span className="thumb-studio__tpl-ref-title">템플릿 참고 · 드래그</span>
          <div className="thumb-studio__tpl-ref-head-actions">
            <button
              type="button"
              className="thumb-studio__tpl-ref-drag"
              title="드래그하여 이동"
              aria-label="드래그하여 이동"
              tabIndex={-1}
            >
              ⠿
            </button>
            <button
              type="button"
              className="thumb-studio__tpl-ref-toggle"
              title="접기"
              aria-label="템플릿 참고 접기"
              onClick={(e) => {
                e.stopPropagation()
                setCollapsed(true)
              }}
            >
              −
            </button>
          </div>
        </div>
        <p className="thumb-studio__tpl-ref-label">{tpl.label}</p>
        <button
          type="button"
          className="thumb-studio__tpl-ref-thumb-btn"
          title="클릭하면 샘플 확대"
          onClick={() => {
            if (canOpenLightbox) setLightboxOpen(true)
          }}
        >
          <div className="thumb-studio__tpl-ref-thumb" style={{ background: tpl.previewCss }}>
            {previewSrc && !imageFailed ? (
              <img
                src={previewSrc}
                alt=""
                className="thumb-tpl-card__preview-img"
                draggable={false}
                onError={() => setImageFailed(true)}
              />
            ) : null}
            {showLayoutFallback ? <TemplateTextLayoutPreview template={tpl} /> : null}
          </div>
          {canOpenLightbox ? <span className="thumb-studio__tpl-ref-zoom-hint">⤢ 확대</span> : null}
        </button>
        <p className="thumb-studio__tpl-ref-hint">글 위치·스타일은 이 샘플을 참고하세요.</p>
      </aside>

      {lightboxOpen && canOpenLightbox ? (
        <ThumbnailPreviewLightbox
          src={previewSrc && !imageFailed ? previewSrc : undefined}
          template={showLayoutFallback ? tpl : undefined}
          caption={`${tpl.label} · 샘플 미리보기`}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}
    </>
  )
}
