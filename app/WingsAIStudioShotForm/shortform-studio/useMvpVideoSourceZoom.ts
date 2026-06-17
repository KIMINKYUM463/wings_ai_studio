"use client"

import { useCallback, useRef } from "react"
import { clampMvpVideoSourceScale } from "@/lib/mvp-video-source-transform"

type Args = {
  enabled: boolean
  scale: number
  onScaleChange: (scale: number) => void
}

export function useMvpVideoSourceZoom({ enabled, scale, onScaleChange }: Args) {
  const scaleRef = useRef(scale)
  scaleRef.current = scale

  const dragRef = useRef<{ startY: number; startScale: number } | null>(null)

  const applyScaleDelta = useCallback(
    (delta: number) => {
      const next = clampMvpVideoSourceScale(scaleRef.current + delta)
      if (Math.abs(next - scaleRef.current) > 0.001) onScaleChange(next)
    },
    [onScaleChange]
  )

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!enabled) return
      e.preventDefault()
      e.stopPropagation()
      const factor = e.deltaY < 0 ? 0.04 : -0.04
      applyScaleDelta(factor * Math.max(1, scaleRef.current))
    },
    [enabled, applyScaleDelta]
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || e.button !== 0) return
      const target = e.target as HTMLElement
      if (target.closest("[data-overlay-id]") || target.closest("[data-video-zoom-skip]")) return
      dragRef.current = { startY: e.clientY, startScale: scaleRef.current }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      e.preventDefault()
    },
    [enabled]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current
      if (!drag || !enabled) return
      const dy = drag.startY - e.clientY
      const delta = dy * 0.004 * Math.max(1, drag.startScale)
      const next = clampMvpVideoSourceScale(drag.startScale + delta)
      if (Math.abs(next - scaleRef.current) > 0.001) onScaleChange(next)
    },
    [enabled, onScaleChange]
  )

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return
    dragRef.current = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }, [])

  return { onWheel, onPointerDown, onPointerMove, onPointerUp, zooming: Boolean(dragRef.current) }
}
