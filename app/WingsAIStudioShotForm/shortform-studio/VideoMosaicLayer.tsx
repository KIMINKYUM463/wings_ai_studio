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
import type { MvpVideoSourceTransform } from "@/lib/mvp-video-source-transform"

type Props = {
  video: HTMLVideoElement | null
  overlay: PlacedStudioOverlay
  /** 실제 미리보기 스테이지 픽셀 (측정값). 없으면 280 기준 */
  stageWidth?: number
  stageHeight?: number
  videoTimeSec?: number
  playing?: boolean
  /** 미리보기 영상과 동일한 컷 확대·반전 */
  sourceTransform?: MvpVideoSourceTransform
}

export function VideoMosaicLayer({
  video,
  overlay,
  stageWidth = MVP_PREVIEW_STAGE_WIDTH_PX,
  stageHeight,
  videoTimeSec = 0,
  playing = false,
  sourceTransform,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageW = Math.max(1, stageWidth)
  const stageH = Math.max(1, stageHeight ?? mosaicStageHeightPx(stageW))
  const designScale = stageW / MVP_PREVIEW_STAGE_WIDTH_PX
  const dims = mosaicOverlayDimensions(overlay)
  const w = Math.max(8, Math.round(dims.w * designScale))
  const h = Math.max(8, Math.round(dims.h * designScale))
  const block = Math.max(4, Math.round(mosaicOverlayBlockSize(overlay) * designScale))
  const circle = isMosaicCircleOverlay(overlay.catalogId)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !video || stageW <= 0 || stageH <= 0) return

    const paint = () => {
      if (video.readyState < 2) return
      renderVideoMosaicPatchToCanvas(canvas, video, {
        stageW,
        stageH,
        centerXPct: overlay.x,
        centerYPct: overlay.y,
        patchW: w,
        patchH: h,
        blockPx: block,
        circle,
        sourceTransform,
      })
    }

    let raf = 0
    const loop = () => {
      paint()
      if (!video.paused) raf = requestAnimationFrame(loop)
    }

    paint()
    if (playing && !video.paused) loop()

    const onPlay = () => {
      cancelAnimationFrame(raf)
      loop()
    }
    const onPause = () => cancelAnimationFrame(raf)
    const onSeeked = () => paint()

    video.addEventListener("play", onPlay)
    video.addEventListener("pause", onPause)
    video.addEventListener("seeked", onSeeked)

    return () => {
      cancelAnimationFrame(raf)
      video.removeEventListener("play", onPlay)
      video.removeEventListener("pause", onPause)
      video.removeEventListener("seeked", onSeeked)
    }
  }, [
    video,
    overlay.x,
    overlay.y,
    w,
    h,
    block,
    circle,
    stageW,
    stageH,
    playing,
    Math.round(videoTimeSec * 20),
    video?.videoWidth,
    sourceTransform?.scale,
    sourceTransform?.flipH,
  ])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none block max-w-none"
      style={{ width: w, height: h }}
    />
  )
}
