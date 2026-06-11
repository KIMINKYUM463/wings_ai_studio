"use client"

import { useEffect, useRef } from "react"
import type { ThumbnailBackgroundTransform, ThumbnailFilterState } from "@/lib/mvp-thumbnail-design"
import { renderMosaicPatchToCanvas, thumbnailFilterToCss } from "@/lib/mvp-thumbnail-mosaic"
import {
  isMosaicCircleOverlay,
  mosaicOverlayBlockSize,
  mosaicOverlayDimensions,
  type PlacedStudioOverlay,
} from "@/lib/shotform-studio-overlay-catalog"

type Props = {
  backgroundUrl: string
  backgroundTransform: ThumbnailBackgroundTransform
  filter: ThumbnailFilterState
  overlay: PlacedStudioOverlay
  stageWidth: number
  stageHeight: number
}

export function ThumbnailMosaicLayer({
  backgroundUrl,
  backgroundTransform,
  filter,
  overlay,
  stageWidth,
  stageHeight,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { w, h } = mosaicOverlayDimensions(overlay)
  const block = mosaicOverlayBlockSize(overlay)
  const circle = isMosaicCircleOverlay(overlay.catalogId)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !backgroundUrl || stageWidth <= 0 || stageHeight <= 0) return

    let cancelled = false
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      if (cancelled) return
      renderMosaicPatchToCanvas(canvas, img, {
        stageW: stageWidth,
        stageH: stageHeight,
        patchCx: (overlay.x / 100) * stageWidth,
        patchCy: (overlay.y / 100) * stageHeight,
        patchW: w,
        patchH: h,
        blockPx: block,
        transform: backgroundTransform,
        circle,
      })
    }
    img.src = backgroundUrl

    return () => {
      cancelled = true
    }
  }, [backgroundUrl, backgroundTransform, filter, overlay.x, overlay.y, w, h, block, circle, stageWidth, stageHeight])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none block max-w-none"
      style={{
        width: w,
        height: h,
        filter: thumbnailFilterToCss(filter),
      }}
    />
  )
}
