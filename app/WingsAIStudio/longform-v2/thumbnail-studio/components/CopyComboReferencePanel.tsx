import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { ThumbnailCopyCombo } from '@/lib/longform-v2/youtube/thumbnailCopyCombos'
import { CopyComboLineRow } from './CopyComboLineRow'

type Props = {
  combos: ThumbnailCopyCombo[]
  combosLoading?: boolean
  onSelectCombo?: (combo: ThumbnailCopyCombo) => void
  selectedComboId?: string | null
  containerRef?: RefObject<HTMLElement | null>
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

const DEFAULT_Y = 52
const PANEL_W = 280
const DEFAULT_PANEL_H = 520
const MIN_PANEL_H = 240
const MAX_PANEL_H = 760
const COLLAPSED_W = 48
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

function defaultRightPos(
  container: HTMLElement | null,
  panelW: number,
  panelH: number,
  y: number,
): { x: number; y: number } {
  if (!container) return { x: 420, y }
  const x = Math.max(8, container.clientWidth - panelW - 14)
  return clampPos(x, y, panelW, panelH, container)
}

/** 캔버스 우측 플로팅 — AI 추천 2줄 조합 */
export function CopyComboReferencePanel({
  combos,
  combosLoading = false,
  onSelectCombo,
  selectedComboId,
  containerRef,
}: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [panelHeight, setPanelHeight] = useState(DEFAULT_PANEL_H)
  const [pos, setPos] = useState({ x: 420, y: DEFAULT_Y })
  const posInitialized = useRef(false)
  const panelRef = useRef<HTMLElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const resizeRef = useRef<ResizeState | null>(null)

  const hasContent = combos.length > 0 || combosLoading

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
    const el = containerRef?.current
    if (!el || posInitialized.current) return
    posInitialized.current = true
    const { w, h } = getExpandedSize()
    setPos(defaultRightPos(el, w, h, DEFAULT_Y))
  }, [containerRef, getExpandedSize])

  useEffect(() => {
    const { w, h } = collapsed ? { w: COLLAPSED_W, h: COLLAPSED_H } : getExpandedSize()
    setPos((p) => clampToContainer(p.x, p.y, w, h))
  }, [collapsed, clampToContainer, combos.length, panelHeight, getExpandedSize])

  useEffect(() => {
    const el = containerRef?.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      setPanelHeight((h) => clampPanelHeight(h, el, pos.y))
      const { w, h: panelH } = collapsed ? { w: COLLAPSED_W, h: COLLAPSED_H } : getExpandedSize()
      setPos((p) => clampToContainer(p.x, p.y, w, panelH))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef, collapsed, clampToContainer, getExpandedSize, pos.y])

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
        className="thumb-studio__tpl-ref thumb-studio__combo-ref thumb-studio__tpl-ref--floating thumb-studio__tpl-ref--collapsed"
        style={{ left: pos.x, top: pos.y }}
        aria-label="추천 조합"
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
            title="추천 조합 펼치기"
            onClick={(e) => {
              e.stopPropagation()
              setCollapsed(false)
            }}
          >
            {combos.length ? `조합${combos.length}` : '조합'}
          </button>
        </div>
      </aside>
    )
  }

  const expandedH = getExpandedSize().h

  return (
    <aside
      ref={panelRef}
      className="thumb-studio__tpl-ref thumb-studio__combo-ref thumb-studio__combo-ref--resizable thumb-studio__tpl-ref--floating"
      style={{ left: pos.x, top: pos.y, width: PANEL_W, height: expandedH }}
      aria-label="AI 추천 2줄 조합"
    >
      <div
        className="thumb-studio__tpl-ref-head thumb-studio__tpl-ref-head--drag"
        onPointerDown={onDragPointerDown}
        onPointerMove={onDragPointerMove}
        onPointerUp={onDragPointerUp}
        onPointerCancel={onDragPointerUp}
      >
        <span className="thumb-studio__tpl-ref-title">추천 조합 · 드래그</span>
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
            aria-label="추천 조합 접기"
            onClick={(e) => {
              e.stopPropagation()
              setCollapsed(true)
            }}
          >
            −
          </button>
        </div>
      </div>

      <div className="thumb-studio__combo-ref-body">
        <section className="thumb-studio__copy-ref-combos" aria-label="AI 추천 조합">
          <h3 className="thumb-studio__copy-ref-combos-title">✦ 추천 조합 (2줄)</h3>
          <p className="thumb-studio__copy-ref-hint thumb-studio__copy-ref-hint--combo">
            {combosLoading
              ? 'AI가 템플릿에 맞는 2줄 조합을 만드는 중…'
              : `${combos.length}개 — 적용하거나 각 줄 「복사」로 클립보드에 넣을 수 있습니다.`}
          </p>
          {combosLoading && !combos.length ? (
            <p className="thumb-studio__copy-ref-combos-loading">생성 중…</p>
          ) : (
            <ul className="thumb-studio__copy-ref-combo-list">
              {combos.map((combo) => {
                const selected = selectedComboId === combo.id
                return (
                  <li key={combo.id} className="thumb-studio__copy-ref-combo-item">
                    {combo.angle ? (
                      <span className="thumb-studio__copy-ref-combo-angle">{combo.angle}</span>
                    ) : null}
                    <CopyComboLineRow text={combo.line1} lineClassName="thumb-studio__copy-ref-combo-line1" />
                    <CopyComboLineRow text={combo.line2} lineClassName="thumb-studio__copy-ref-combo-line2" />
                    {onSelectCombo ? (
                      <button
                        type="button"
                        className={
                          selected
                            ? 'thumb-studio__copy-ref-combo-apply thumb-studio__copy-ref-combo-apply--on'
                            : 'thumb-studio__copy-ref-combo-apply'
                        }
                        onClick={() => onSelectCombo(combo)}
                      >
                        {selected ? '적용됨' : '썸네일에 적용'}
                      </button>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

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
    </aside>
  )
}
