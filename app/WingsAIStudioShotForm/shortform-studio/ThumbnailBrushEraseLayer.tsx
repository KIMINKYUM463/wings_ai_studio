"use client"

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react"
import { cn } from "@/lib/utils"

export type ThumbnailBrushEraseLayerHandle = {
  clear: () => void
  hasStrokes: () => boolean
  getPreviewCanvas: () => HTMLCanvasElement | null
}

type Props = {
  active: boolean
  brushSize: number
  width: number
  height: number
  className?: string
}

export const ThumbnailBrushEraseLayer = forwardRef<ThumbnailBrushEraseLayerHandle, Props>(
  function ThumbnailBrushEraseLayer({ active, brushSize, width, height, className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const paintingRef = useRef(false)
    const pointerIdRef = useRef<number | null>(null)

    const clear = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }, [])

    const paintDot = useCallback((x: number, y: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.fillStyle = "rgba(239, 68, 68, 0.55)"
      ctx.beginPath()
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2)
      ctx.fill()
    }, [brushSize])

    const paintLine = useCallback(
      (x0: number, y0: number, x1: number, y1: number) => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        ctx.strokeStyle = "rgba(239, 68, 68, 0.55)"
        ctx.lineWidth = brushSize
        ctx.lineCap = "round"
        ctx.lineJoin = "round"
        ctx.beginPath()
        ctx.moveTo(x0, y0)
        ctx.lineTo(x1, y1)
        ctx.stroke()
      },
      [brushSize]
    )

    const lastPointRef = useRef<{ x: number; y: number } | null>(null)

    useImperativeHandle(
      ref,
      () => ({
        clear,
        hasStrokes: () => {
          const canvas = canvasRef.current
          if (!canvas) return false
          const ctx = canvas.getContext("2d")
          if (!ctx) return false
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
          for (let i = 3; i < data.length; i += 4) {
            if (data[i]! > 12) return true
          }
          return false
        },
        getPreviewCanvas: () => canvasRef.current,
      }),
      [clear]
    )

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas || width <= 0 || height <= 0) return
      canvas.width = Math.max(1, Math.round(width))
      canvas.height = Math.max(1, Math.round(height))
    }, [width, height])

    useEffect(() => {
      if (!active) return

      const onPointerMove = (e: PointerEvent) => {
        if (!paintingRef.current || pointerIdRef.current !== e.pointerId) return
        const canvas = canvasRef.current
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) return
        const x = ((e.clientX - rect.left) / rect.width) * canvas.width
        const y = ((e.clientY - rect.top) / rect.height) * canvas.height
        const last = lastPointRef.current
        if (last) paintLine(last.x, last.y, x, y)
        else paintDot(x, y)
        lastPointRef.current = { x, y }
      }

      const endPaint = (e: PointerEvent) => {
        if (pointerIdRef.current !== e.pointerId) return
        paintingRef.current = false
        pointerIdRef.current = null
        lastPointRef.current = null
      }

      window.addEventListener("pointermove", onPointerMove)
      window.addEventListener("pointerup", endPaint)
      window.addEventListener("pointercancel", endPaint)
      return () => {
        window.removeEventListener("pointermove", onPointerMove)
        window.removeEventListener("pointerup", endPaint)
        window.removeEventListener("pointercancel", endPaint)
      }
    }, [active, paintDot, paintLine])

    const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!active) return
      e.preventDefault()
      e.stopPropagation()
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * canvas.width
      const y = ((e.clientY - rect.top) / rect.height) * canvas.height
      paintingRef.current = true
      pointerIdRef.current = e.pointerId
      lastPointRef.current = { x, y }
      paintDot(x, y)
      canvas.setPointerCapture(e.pointerId)
    }

    return (
      <canvas
        ref={canvasRef}
        className={cn(
          "absolute inset-0 touch-none",
          active ? "z-[50] cursor-crosshair" : "pointer-events-none z-[3] opacity-0",
          className
        )}
        onPointerDown={onPointerDown}
      />
    )
  }
)
