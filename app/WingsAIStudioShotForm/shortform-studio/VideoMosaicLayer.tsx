"use client"

import { useEffect, useRef } from "react"
import {
  isMosaicCircleOverlay,
  mosaicOverlayBlockSize,
  mosaicOverlayDimensions,
  type PlacedStudioOverlay,
} from "@/lib/shotform-studio-overlay-catalog"
import { MVP_PREVIEW_STAGE_WIDTH_PX, mosaicStageHeightPx } from "@/lib/mvp-mosaic-overlay-utils"
import { renderVideoMosaicPatchToCanvas } from "@/lib/mvp-video-mosaic"

type Props = {
  video: HTMLVideoElement | null
  overlay: PlacedStudioOverlay
  stageWidth?: number
  stageHeight?: number
  /** 영상 시각이 바뀔 때 모자이크 패치 갱신 */
  refreshKey?: number
}

export function VideoMosaicLayer({
  video,
  overlay,
  stageWidth = MVP_PREVIEW_STAGE_WIDTH_PX,
  stageHeight,
  refreshKey = 0,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageH = stageHeight ?? mosaicStageHeightPx(stageWidth)
  const { w, h } = mosaicOverlayDimensions(overlay)
  const block = mosaicOverlayBlockSize(overlay)
  const circle = isMosaicCircleOverlay(overlay.catalogId)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !video || stageWidth <= 0 || stageH <= 0) return
    if (video.readyState < 2) return

    renderVideoMosaicPatchToCanvas(canvas, video, {
      stageW: stageWidth,
      stageH: stageH,
      centerXPct: overlay.x,
      centerYPct: overlay.y,
      patchW: w,
      patchH: h,
      blockPx: block,
      circle,
    })
  }, [
    video,
    overlay.x,
    overlay.y,
    w,
    h,
    block,
    circle,
    stageWidth,
    stageH,
    refreshKey,
    video?.currentTime,
    video?.videoWidth,
  ])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none block max-w-none"
      style={{ width: w, height: h }}
    />
  )
}
