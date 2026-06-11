"use client"

import { useCallback, useEffect, useRef } from "react"
import { isMosaicOverlay, mosaicOverlayDimensions, type PlacedStudioOverlay } from "@/lib/shotform-studio-overlay-catalog"
import { clampOverlayPct } from "@/lib/mvp-overlay-utils"

type MoveState = {
  kind: "move"
  id: string
  pointerId: number
  startPx: number
  startPy: number
  startX: number
  startY: number
}

type RotateState = {
  kind: "rotate"
  id: string
  pointerId: number
  centerPx: number
  centerPy: number
  startAngle: number
  startRotation: number
}

type ResizeState = {
  kind: "resize"
  id: string
  pointerId: number
  centerPx: number
  centerPy: number
  startDist: number
  startSize: number
  mosaic?: boolean
  startMosaicW?: number
  startMosaicH?: number
}

type ResizeMosaicWidthState = {
  kind: "resizeMosaicW"
  id: string
  pointerId: number
  startPx: number
  startMosaicW: number
  side: "left" | "right"
}

type ResizeMosaicHeightState = {
  kind: "resizeMosaicH"
  id: string
  pointerId: number
  startPy: number
  startMosaicH: number
  side: "top" | "bottom"
}

type MosaicCorner = "nw" | "ne" | "sw" | "se"

type ResizeMosaicCornerState = {
  kind: "resizeMosaicCorner"
  id: string
  pointerId: number
  startPx: number
  startPy: number
  startMosaicW: number
  startMosaicH: number
  corner: MosaicCorner
}

type InteractionState =
  | MoveState
  | RotateState
  | ResizeState
  | ResizeMosaicWidthState
  | ResizeMosaicHeightState
  | ResizeMosaicCornerState
  | null

const MOSAIC_DIM_MIN = 24
const MOSAIC_W_MAX = 320
const MOSAIC_H_MAX = 560

function clampMosaicW(value: number): number {
  return Math.round(Math.min(MOSAIC_W_MAX, Math.max(MOSAIC_DIM_MIN, value)))
}

function clampMosaicH(value: number): number {
  return Math.round(Math.min(MOSAIC_H_MAX, Math.max(MOSAIC_DIM_MIN, value)))
}

function overlayCenterPx(stage: HTMLDivElement, ov: PlacedStudioOverlay) {
  const rect = stage.getBoundingClientRect()
  return {
    centerPx: rect.left + (ov.x / 100) * rect.width,
    centerPy: rect.top + (ov.y / 100) * rect.height,
  }
}

export function useMvpOverlayInteraction(
  stageRef: React.RefObject<HTMLDivElement | null>,
  onUpdateOverlay: (id: string, patch: Partial<PlacedStudioOverlay>) => void
) {
  const interactionRef = useRef<InteractionState>(null)

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const st = interactionRef.current
      if (!st || st.pointerId !== e.pointerId) return
      const stage = stageRef.current
      if (!stage) return
      const rect = stage.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return

      if (st.kind === "move") {
        const dx = ((e.clientX - st.startPx) / rect.width) * 100
        const dy = ((e.clientY - st.startPy) / rect.height) * 100
        onUpdateOverlay(st.id, {
          x: clampOverlayPct(st.startX + dx),
          y: clampOverlayPct(st.startY + dy),
        })
        return
      }

      if (st.kind === "resizeMosaicW") {
        const deltaPx = e.clientX - st.startPx
        const signedDelta = st.side === "right" ? deltaPx : -deltaPx
        onUpdateOverlay(st.id, {
          mosaicW: clampMosaicW(st.startMosaicW + signedDelta * 2),
        })
        return
      }

      if (st.kind === "resizeMosaicH") {
        const deltaPy = e.clientY - st.startPy
        const signedDelta = st.side === "bottom" ? deltaPy : -deltaPy
        onUpdateOverlay(st.id, {
          mosaicH: clampMosaicH(st.startMosaicH + signedDelta * 2),
        })
        return
      }

      if (st.kind === "resizeMosaicCorner") {
        const dx = e.clientX - st.startPx
        const dy = e.clientY - st.startPy
        let widthDelta = 0
        let heightDelta = 0
        switch (st.corner) {
          case "se":
            widthDelta = dx * 2
            heightDelta = dy * 2
            break
          case "nw":
            widthDelta = -dx * 2
            heightDelta = -dy * 2
            break
          case "ne":
            widthDelta = dx * 2
            heightDelta = -dy * 2
            break
          case "sw":
            widthDelta = -dx * 2
            heightDelta = dy * 2
            break
        }
        onUpdateOverlay(st.id, {
          mosaicW: clampMosaicW(st.startMosaicW + widthDelta),
          mosaicH: clampMosaicH(st.startMosaicH + heightDelta),
        })
        return
      }

      if (st.kind === "resize") {
        const dist = Math.hypot(e.clientX - st.centerPx, e.clientY - st.centerPy) || 1
        const scale = dist / Math.max(st.startDist, 1)
        const nextSize = Math.round(Math.min(220, Math.max(16, st.startSize * scale)))
        if (st.mosaic && st.startMosaicW != null && st.startMosaicH != null) {
          onUpdateOverlay(st.id, {
            size: nextSize,
            mosaicW: clampMosaicW(st.startMosaicW * scale),
            mosaicH: clampMosaicH(st.startMosaicH * scale),
          })
        } else {
          onUpdateOverlay(st.id, { size: nextSize })
        }
        return
      }

      const angle = (Math.atan2(e.clientY - st.centerPy, e.clientX - st.centerPx) * 180) / Math.PI
      let rot = st.startRotation + (angle - st.startAngle)
      while (rot > 180) rot -= 360
      while (rot < -180) rot += 360
      onUpdateOverlay(st.id, { rotation: Math.round(rot) })
    }

    const endDrag = (e: PointerEvent) => {
      const st = interactionRef.current
      if (st && st.pointerId === e.pointerId) interactionRef.current = null
    }

    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", endDrag)
    window.addEventListener("pointercancel", endDrag)
    return () => {
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", endDrag)
      window.removeEventListener("pointercancel", endDrag)
    }
  }, [onUpdateOverlay, stageRef])

  const startMove = useCallback((e: React.PointerEvent, ov: PlacedStudioOverlay, onSelect: () => void) => {
    e.stopPropagation()
    e.preventDefault()
    onSelect()
    interactionRef.current = {
      kind: "move",
      id: ov.id,
      pointerId: e.pointerId,
      startPx: e.clientX,
      startPy: e.clientY,
      startX: ov.x,
      startY: ov.y,
    }
  }, [])

  const startRotate = useCallback((e: React.PointerEvent, ov: PlacedStudioOverlay) => {
    e.stopPropagation()
    e.preventDefault()
    const stage = stageRef.current
    if (!stage) return
    const { centerPx, centerPy } = overlayCenterPx(stage, ov)
    const startAngle = (Math.atan2(e.clientY - centerPy, e.clientX - centerPx) * 180) / Math.PI
    interactionRef.current = {
      kind: "rotate",
      id: ov.id,
      pointerId: e.pointerId,
      centerPx,
      centerPy,
      startAngle,
      startRotation: ov.rotation,
    }
  }, [stageRef])

  const startResize = useCallback((e: React.PointerEvent, ov: PlacedStudioOverlay) => {
    e.stopPropagation()
    e.preventDefault()
    const stage = stageRef.current
    if (!stage) return
    const { centerPx, centerPy } = overlayCenterPx(stage, ov)
    const startDist = Math.hypot(e.clientX - centerPx, e.clientY - centerPy) || 1
    const mosaic = isMosaicOverlay(ov.catalogId)
    const dims = mosaicOverlayDimensions(ov)
    interactionRef.current = {
      kind: "resize",
      id: ov.id,
      pointerId: e.pointerId,
      centerPx,
      centerPy,
      startDist,
      startSize: ov.size,
      mosaic,
      startMosaicW: mosaic ? dims.w : undefined,
      startMosaicH: mosaic ? dims.h : undefined,
    }
  }, [stageRef])

  const startResizeMosaicW = useCallback(
    (e: React.PointerEvent, ov: PlacedStudioOverlay, side: "left" | "right") => {
      e.stopPropagation()
      e.preventDefault()
      const dims = mosaicOverlayDimensions(ov)
      interactionRef.current = {
        kind: "resizeMosaicW",
        id: ov.id,
        pointerId: e.pointerId,
        startPx: e.clientX,
        startMosaicW: dims.w,
        side,
      }
    },
    []
  )

  const startResizeMosaicH = useCallback(
    (e: React.PointerEvent, ov: PlacedStudioOverlay, side: "top" | "bottom") => {
      e.stopPropagation()
      e.preventDefault()
      const dims = mosaicOverlayDimensions(ov)
      interactionRef.current = {
        kind: "resizeMosaicH",
        id: ov.id,
        pointerId: e.pointerId,
        startPy: e.clientY,
        startMosaicH: dims.h,
        side,
      }
    },
    []
  )

  const startResizeMosaicCorner = useCallback(
    (e: React.PointerEvent, ov: PlacedStudioOverlay, corner: MosaicCorner) => {
      e.stopPropagation()
      e.preventDefault()
      const dims = mosaicOverlayDimensions(ov)
      interactionRef.current = {
        kind: "resizeMosaicCorner",
        id: ov.id,
        pointerId: e.pointerId,
        startPx: e.clientX,
        startPy: e.clientY,
        startMosaicW: dims.w,
        startMosaicH: dims.h,
        corner,
      }
    },
    []
  )

  return {
    startMove,
    startRotate,
    startResize,
    startResizeMosaicW,
    startResizeMosaicH,
    startResizeMosaicCorner,
  }
}
