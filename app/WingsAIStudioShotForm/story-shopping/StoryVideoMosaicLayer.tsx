"use client"

import { useEffect, useRef } from "react"
import { renderVideoMosaicPatchToCanvas } from "@/lib/mvp-video-mosaic"
import type { StoryVideoMosaic } from "./story-types"

export function StoryVideoMosaicLayer({
  video,
  mosaic,
  stageWidth,
  stageHeight,
  fit = "cover",
  playing = false,
  videoTimeSec = 0,
}: {
  video: HTMLVideoElement | null
  mosaic: StoryVideoMosaic
  stageWidth: number
  stageHeight: number
  fit?: "cover" | "contain"
  playing?: boolean
  videoTimeSec?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const patchWidth = Math.max(8, (stageWidth * mosaic.width) / 100)
  const patchHeight = Math.max(8, (stageHeight * mosaic.height) / 100)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !video || stageWidth <= 0 || stageHeight <= 0) return

    const paint = () => {
      if (video.readyState < 2) return
      renderVideoMosaicPatchToCanvas(canvas, video, {
        stageW: stageWidth,
        stageH: stageHeight,
        centerXPct: mosaic.x,
        centerYPct: mosaic.y,
        patchW: patchWidth,
        patchH: patchHeight,
        blockPx: mosaic.blockSize,
        fit,
      })
    }

    let animationFrame = 0
    const loop = () => {
      paint()
      if (!video.paused) animationFrame = requestAnimationFrame(loop)
    }
    paint()
    if (playing && !video.paused) loop()

    const handlePlay = () => {
      cancelAnimationFrame(animationFrame)
      loop()
    }
    const handlePause = () => cancelAnimationFrame(animationFrame)
    video.addEventListener("play", handlePlay)
    video.addEventListener("pause", handlePause)
    video.addEventListener("seeked", paint)

    return () => {
      cancelAnimationFrame(animationFrame)
      video.removeEventListener("play", handlePlay)
      video.removeEventListener("pause", handlePause)
      video.removeEventListener("seeked", paint)
    }
  }, [
    fit,
    mosaic.blockSize,
    mosaic.x,
    mosaic.y,
    patchHeight,
    patchWidth,
    playing,
    stageHeight,
    stageWidth,
    Math.round(videoTimeSec * 20),
    video,
  ])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute z-10 max-w-none"
      style={{
        left: `${mosaic.x}%`,
        top: `${mosaic.y}%`,
        width: patchWidth,
        height: patchHeight,
        transform: "translate(-50%, -50%)",
      }}
    />
  )
}
