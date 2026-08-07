"use client"

import { useCallback, useRef } from "react"
import { clampMvpVideoSourceScale } from "@/lib/mvp-video-source-transform"
import { cn } from "@/lib/utils"

type Corner = "nw" | "ne" | "sw" | "se"

type Props = {
  /** 현재 컷이 선택됐을 때만 표시 */
  active: boolean
  scale: number
  onScaleChange: (scale: number) => void
  /** 미리보기에서 컷을 클릭해 선택할 때 */
  onSelect?: () => void
  className?: string
}

const CORNERS: Array<{ id: Corner; className: string; cursor: string }> = [
  { id: "nw", className: "left-0 top-0 -translate-x-1/2 -translate-y-1/2", cursor: "nwse-resize" },
  { id: "ne", className: "right-0 top-0 translate-x-1/2 -translate-y-1/2", cursor: "nesw-resize" },
  { id: "sw", className: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2", cursor: "nesw-resize" },
  { id: "se", className: "bottom-0 right-0 translate-x-1/2 translate-y-1/2", cursor: "nwse-resize" },
]

/**
 * 선택된 리믹스 컷의 미리보기 프레임.
 * 모서리를 드래그하면 영상 확대·축소(scale)가 바뀝니다.
 */
export function MvpVideoClipTransformFrame({
  active,
  scale,
  onScaleChange,
  onSelect,
  className,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    startDist: number
    startScale: number
    pointerId: number
  } | null>(null)

  const distFromCenter = useCallback((clientX: number, clientY: number) => {
    const el = frameRef.current
    if (!el) return 1
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    return Math.max(8, Math.hypot(clientX - cx, clientY - cy))
  }, [])

  const onCornerDown = useCallback(
    (e: React.PointerEvent, _corner: Corner) => {
      if (!active || e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      onSelect?.()
      const startDist = distFromCenter(e.clientX, e.clientY)
      dragRef.current = {
        startDist,
        startScale: scale,
        pointerId: e.pointerId,
      }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [active, distFromCenter, onSelect, scale]
  )

  const onCornerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current
      if (!drag || e.pointerId !== drag.pointerId) return
      e.preventDefault()
      e.stopPropagation()
      const dist = distFromCenter(e.clientX, e.clientY)
      const next = clampMvpVideoSourceScale(drag.startScale * (dist / drag.startDist))
      onScaleChange(next)
    },
    [distFromCenter, onScaleChange]
  )

  const onCornerUp = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag || e.pointerId !== drag.pointerId) return
    dragRef.current = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }, [])

  if (!active) return null

  // 스케일이 커져도 핸들은 스테이지 테두리에 고정 — 사용자가 항상 잡을 수 있게
  const inset = 10

  return (
    <div
      ref={frameRef}
      data-video-clip-frame="true"
      data-video-zoom-skip="true"
      className={cn("pointer-events-none absolute z-[6]", className)}
      style={{ inset }}
      aria-hidden={!active}
    >
      <div className="pointer-events-none absolute inset-0 rounded-sm border-2 border-emerald-400 shadow-[0_0_0_1px_rgba(16,185,129,0.35)]" />
      <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded bg-emerald-500/95 px-1.5 py-0.5 text-[9px] font-semibold text-white shadow">
        {Math.round(scale * 100)}%
      </div>
      {CORNERS.map((c) => (
        <button
          key={c.id}
          type="button"
          title="드래그하여 크기 조절"
          aria-label="영상 크기 조절"
          data-video-zoom-skip="true"
          className={cn(
            "pointer-events-auto absolute h-3.5 w-3.5 rounded-sm border-2 border-emerald-300 bg-white shadow-md",
            c.className
          )}
          style={{ cursor: c.cursor }}
          onPointerDown={(e) => onCornerDown(e, c.id)}
          onPointerMove={onCornerMove}
          onPointerUp={onCornerUp}
          onPointerCancel={onCornerUp}
        />
      ))}
    </div>
  )
}
