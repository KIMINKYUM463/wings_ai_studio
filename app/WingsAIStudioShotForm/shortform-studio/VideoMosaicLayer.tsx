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
  /** 타임라인 playhead — 재생 중 프레임 동기 */
  videoTimeSec?: number
  playing?: boolean
}

export function VideoMosaicLayer({
  video,
  overlay,
  stageWidth = MVP_PREVIEW_STAGE_WIDTH_PX,
  stageHeight,
  videoTimeSec = 0,
  playing = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageH = stageHeight ?? mosaicStageHeightPx(stageWidth)
  const { w, h } = mosaicOverlayDimensions(overlay)
  const block = mosaicOverlayBlockSize(overlay)
  const circle = isMosaicCircleOverlay(overlay.catalogId)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !video || stageWidth <= 0 || stageH <= 0) return

    const paint = () => {
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
    stageWidth,
    stageH,
    playing,
    Math.round(videoTimeSec * 20),
    video?.videoWidth,
  ])

  return (
    <div className="relative overflow-hidden" style={{ width: w, height: h }}>
      {/* 픽셀 모자이크가 한 프레임 늦어도 글자가 비치지 않도록 불투명 백킹 */}
      <div
        className="absolute inset-0 bg-neutral-700/95"
        style={{ borderRadius: circle ? "9999px" : "2px" }}
        aria-hidden
      />
      <canvas
        ref={canvasRef}
        className="pointer-events-none relative z-[1] block max-w-none"
        style={{ width: w, height: h }}
      />
    </div>
  )
}
