import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { ThumbnailCopyResearchItem } from '@/lib/longform-v2/youtube/thumbnailCopyResearch'
import type { ThumbnailSubCopy } from '@/lib/longform-v2/youtube/thumbnailSubCopy'

type Props = {
  items: ThumbnailCopyResearchItem[]
  subCopies?: ThumbnailSubCopy[]
  subCopiesLoading?: boolean
  onGenerateSubCopies?: () => void
  onSelectSubCopy?: (sub: ThumbnailSubCopy) => void
  onAddSubCopy?: (sub: ThumbnailSubCopy) => void
  selectedSubCopyId?: string | null
  subCopyApplyEnabled?: boolean
  containerRef?: RefObject<HTMLElement | null>
  onReopenModal?: () => void
  onClose?: () => void
  notes?: string
  onNotesChange?: (notes: string) => void
  panelHeight?: number
  onPanelHeightChange?: (height: number) => void
}

type DragState = {
  pointerId: number
  startX: number
  startY: number
  origX: number
  origY: number
}

type ResizeState = {
  pointerId: number
  startY: number
  origH: number
}

const DEFAULT_POS = { x: 14, y: 268 }
const PANEL_W = 268
const DEFAULT_PANEL_H = 520
const MIN_PANEL_H = 240
const MAX_PANEL_H = 760
const COLLAPSED_W = 44
const COLLAPSED_H = 92

function clampPanelHeight(height: number, container: HTMLElement | null, panelTop: number): number {
  const maxByContainer = container
    ? Math.max(MIN_PANEL_H, container.clientHeight - panelTop - 8)
    : MAX_PANEL_H
  return Math.min(MAX_PANEL_H, maxByContainer, Math.max(MIN_PANEL_H, height))
}

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

function formatViews(n: number): string {
  return n.toLocaleString('ko-KR')
}

/** 캔버스 좌측 플로팅 — 유튜브 참고 · 서브카피 · 사용자 메모 */
export function CopyResearchReferencePanel({
  items,
  subCopies = [],
  subCopiesLoading = false,
  onGenerateSubCopies,
  onSelectSubCopy,
  onAddSubCopy,
  selectedSubCopyId,
  subCopyApplyEnabled = true,
  containerRef,
  onReopenModal,
  onClose,
  notes = '',
  onNotesChange,
  panelHeight: panelHeightProp,
  onPanelHeightChange,
}: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [pos, setPos] = useState(DEFAULT_POS)
  const [panelHeight, setPanelHeight] = useState(() =>
    clampPanelHeight(panelHeightProp ?? DEFAULT_PANEL_H, null, DEFAULT_POS.y),
  )
  const panelRef = useRef<HTMLElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const resizeRef = useRef<ResizeState | null>(null)

  const hasContent = items.length > 0 || subCopies.length > 0 || subCopiesLoading

  const getExpandedSize = useCallback(
    () => ({
      w: PANEL_W,
      h: clampPanelHeight(panelHeight, containerRef?.current ?? null, pos.y),
    }),
    [panelHeight, containerRef, pos.y],
  )

  const clampToContainer = useCallback(
    (x: number, y: number, w: number, h: number) =>
      clampPos(x, y, w, h, containerRef?.current ?? null),
    [containerRef],
  )

  useEffect(() => {
    if (typeof panelHeightProp !== 'number') return
    setPanelHeight(clampPanelHeight(panelHeightProp, containerRef?.current ?? null, pos.y))
  }, [panelHeightProp, containerRef, pos.y])

  useEffect(() => {
    const { w, h } = collapsed ? { w: COLLAPSED_W, h: COLLAPSED_H } : getExpandedSize()
    setPos((p) => clampToContainer(p.x, p.y, w, h))
  }, [collapsed, clampToContainer, items.length, subCopies.length, panelHeight, getExpandedSize])

  useEffect(() => {
    const el = containerRef?.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      setPanelHeight((h) => {
        const next = clampPanelHeight(h, el, pos.y)
        if (next !== h) onPanelHeightChange?.(next)
        return next
      })
      const { w, h } = collapsed ? { w: COLLAPSED_W, h: COLLAPSED_H } : getExpandedSize()
      setPos((p) => clampToContainer(p.x, p.y, w, h))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef, collapsed, clampToContainer, getExpandedSize, onPanelHeightChange, pos.y])

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
    const { w, h } = collapsed ? { w: COLLAPSED_W, h: COLLAPSED_H } : getExpandedSize()
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

  const onResizePointerDown = (e: React.PointerEvent) => {
    resizeRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      origH: panelHeight,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    e.preventDefault()
    e.stopPropagation()
  }

  const onResizePointerMove = (e: React.PointerEvent) => {
    const r = resizeRef.current
    if (!r || r.pointerId !== e.pointerId) return
    const next = clampPanelHeight(
      r.origH + (e.clientY - r.startY),
      containerRef?.current ?? null,
      pos.y,
    )
    setPanelHeight(next)
    onPanelHeightChange?.(next)
    setPos((p) => clampToContainer(p.x, p.y, PANEL_W, next))
  }

  const onResizePointerUp = (e: React.PointerEvent) => {
    if (resizeRef.current?.pointerId !== e.pointerId) return
    resizeRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  if (!hasContent) return null

  if (collapsed) {
    return (
      <aside
        ref={panelRef}
        className="thumb-studio__tpl-ref thumb-studio__copy-ref thumb-studio__tpl-ref--floating thumb-studio__tpl-ref--collapsed"
        style={{ left: pos.x, top: pos.y }}
        aria-label="카피 참고"
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
            title="카피 참고 펼치기"
            onClick={(e) => {
              e.stopPropagation()
              setCollapsed(false)
            }}
          >
            {subCopies.length ? `서브${subCopies.length}` : '카피'}
          </button>
        </div>
      </aside>
    )
  }

  const expandedH = getExpandedSize().h

  return (
    <aside
      ref={panelRef}
      className="thumb-studio__tpl-ref thumb-studio__copy-ref thumb-studio__copy-ref--resizable thumb-studio__tpl-ref--floating"
      style={{ left: pos.x, top: pos.y, width: PANEL_W, height: expandedH }}
      aria-label="유튜브 카피 참고"
    >
      <div
        className="thumb-studio__tpl-ref-head thumb-studio__tpl-ref-head--drag"
        onPointerDown={onDragPointerDown}
        onPointerMove={onDragPointerMove}
        onPointerUp={onDragPointerUp}
        onPointerCancel={onDragPointerUp}
      >
        <span className="thumb-studio__tpl-ref-title">카피 참고 · 드래그</span>
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
          {onReopenModal ? (
            <button
              type="button"
              className="thumb-studio__copy-ref-reopen"
              title="카피라이팅 창 다시 열기"
              aria-label="카피라이팅 창 다시 열기"
              onClick={(e) => {
                e.stopPropagation()
                onReopenModal()
              }}
            >
              ↗
            </button>
          ) : null}
          <button
            type="button"
            className="thumb-studio__tpl-ref-toggle"
            title="접기"
            aria-label="카피 참고 접기"
            onClick={(e) => {
              e.stopPropagation()
              setCollapsed(true)
            }}
          >
            −
          </button>
        </div>
      </div>

      <div className="thumb-studio__copy-ref-body">
        <section className="thumb-studio__copy-ref-subcopies" aria-label="AI 서브카피">
          <div className="thumb-studio__copy-ref-subcopies-head">
            <h3 className="thumb-studio__copy-ref-subcopies-title">✦ 서브카피 (괄호·라벨)</h3>
            {onGenerateSubCopies ? (
              <button
                type="button"
                className="thumb-studio__copy-ref-subcopies-gen"
                disabled={subCopiesLoading}
                onClick={onGenerateSubCopies}
              >
                {subCopiesLoading ? '생성 중…' : '생성'}
              </button>
            ) : null}
          </div>
          <p className="thumb-studio__copy-ref-hint thumb-studio__copy-ref-hint--sub">
            {subCopiesLoading
              ? 'AI가 괄호형 서브카피를 만드는 중…'
              : subCopies.length
                ? `${subCopies.length}개 — ('효' 강조)처럼 이미지·키워드를 짚는 짧은 라벨`
                : `('효' 강조), (삼강행실도)처럼 괄호 라벨을 AI로 생성합니다.`}
          </p>
          {subCopiesLoading && !subCopies.length ? (
            <p className="thumb-studio__copy-ref-subcopies-loading">생성 중…</p>
          ) : subCopies.length ? (
            <ul className="thumb-studio__copy-ref-subcopy-list">
              {subCopies.map((sub) => {
                const selected = selectedSubCopyId === sub.id
                return (
                  <li
                    key={sub.id}
                    className={
                      'thumb-studio__copy-ref-subcopy-item' +
                      (selected ? ' thumb-studio__copy-ref-subcopy-item--on' : '')
                    }
                  >
                    {sub.angle ? (
                      <span className="thumb-studio__copy-ref-subcopy-angle">{sub.angle}</span>
                    ) : null}
                    <p className="thumb-studio__copy-ref-subcopy-text">{sub.text}</p>
                    {sub.placementHint ? (
                      <p className="thumb-studio__copy-ref-subcopy-hint">{sub.placementHint}</p>
                    ) : null}
                    {onAddSubCopy || onSelectSubCopy ? (
                      <div className="thumb-studio__copy-ref-subcopy-actions">
                        {onAddSubCopy ? (
                          <button
                            type="button"
                            className="thumb-studio__copy-ref-subcopy-add"
                            onClick={() => onAddSubCopy(sub)}
                          >
                            추가
                          </button>
                        ) : null}
                        {onSelectSubCopy ? (
                          <button
                            type="button"
                            className="thumb-studio__copy-ref-subcopy-apply"
                            onClick={() => onSelectSubCopy(sub)}
                          >
                            {subCopyApplyEnabled ? '슬롯 적용' : '복사'}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : null}
        </section>

        {items.length > 0 ? (
          <>
            <p className="thumb-studio__tpl-ref-hint thumb-studio__copy-ref-hint">
              롱폼 참고 {items.length}건
            </p>
            <ul className="thumb-studio__copy-ref-list">
              {items.map((item) => (
                <li key={item.videoId} className="thumb-studio__copy-ref-item">
                  <p className="thumb-studio__copy-ref-item-title">{item.title}</p>
                  {item.thumbnailLines.length ? (
                    <ul className="thumb-studio__copy-ref-lines">
                      {item.thumbnailLines.map((line, idx) => (
                        <li key={idx}>{line}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="thumb-studio__copy-ref-lines-empty">썸네일 문구 없음</p>
                  )}
                  <p className="thumb-studio__copy-ref-meta">
                    {item.channelTitle} · 조회 {formatViews(item.viewCount)}
                  </p>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      <section className="thumb-studio__copy-ref-memo" aria-label="카피 참고 메모">
        <label className="thumb-studio__copy-ref-memo-label" htmlFor="thumb-copy-ref-memo">
          메모
        </label>
        <textarea
          id="thumb-copy-ref-memo"
          className="thumb-studio__copy-ref-memo-input"
          value={notes}
          onChange={(e) => onNotesChange?.(e.target.value)}
          placeholder="카피 아이디어, 참고 문구, 메모를 자유롭게 적어두세요."
          spellCheck={false}
        />
      </section>

      <div
        className="thumb-studio__copy-ref-resize"
        role="separator"
        aria-orientation="horizontal"
        aria-label="패널 높이 조절"
        title="드래그하여 위아래 크기 조절"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        onPointerCancel={onResizePointerUp}
      >
        <span className="thumb-studio__copy-ref-resize-grip" aria-hidden />
      </div>

      {onClose ? (
        <button type="button" className="thumb-studio__copy-ref-close" onClick={onClose}>
          참고 패널 닫기
        </button>
      ) : null}
    </aside>
  )
}
