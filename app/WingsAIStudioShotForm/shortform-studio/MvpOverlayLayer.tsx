"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import {
  isMosaicOverlay,
  mosaicOverlayDimensions,
  type PlacedStudioOverlay,
} from "@/lib/shotform-studio-overlay-catalog"
import {
  filterOverlaysAtVideoTime,
  MVP_PREVIEW_STAGE_WIDTH_PX,
} from "@/lib/mvp-mosaic-overlay-utils"
import type { MvpVideoSourceTransform } from "@/lib/mvp-video-source-transform"
import { StudioOverlayGraphic } from "../shoppingshotform/StudioOverlayGraphic"
import { MosaicResizeHandles } from "./MosaicResizeHandles"
import { useMvpOverlayInteraction } from "./useMvpOverlayInteraction"
import { VideoMosaicLayer } from "./VideoMosaicLayer"

type Props = {
  overlays: PlacedStudioOverlay[]
  selectedId: string | null
  onSelectId: (id: string | null) => void
  onUpdateOverlay: (id: string, patch: Partial<PlacedStudioOverlay>) => void
  stageRef: React.RefObject<HTMLDivElement | null>
  videoRef?: React.RefObject<HTMLVideoElement | null>
  videoTimeSec?: number
  videoDurationSec?: number
  playing?: boolean
  onOverlayPointerDown?: () => void
  /** 미리보기 영상 CSS transform과 맞춤 */
  sourceTransform?: MvpVideoSourceTransform
}

export function MvpOverlayLayer({
  overlays,
  selectedId,
  onSelectId,
  onUpdateOverlay,
  stageRef,
  videoRef,
  videoTimeSec = 0,
  videoDurationSec,
  playing = false,
  onOverlayPointerDown,
  sourceTransform,
}: Props) {
  const {
    startMove,
    startRotate,
    startResize,
    startResizeMosaicW,
    startResizeMosaicH,
    startResizeMosaicCorner,
  } = useMvpOverlayInteraction(stageRef, onUpdateOverlay)

  const [stageSize, setStageSize] = useState({
    w: MVP_PREVIEW_STAGE_WIDTH_PX,
    h: Math.round(MVP_PREVIEW_STAGE_WIDTH_PX * (16 / 9)),
  })

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth || MVP_PREVIEW_STAGE_WIDTH_PX
      const h = el.clientHeight || Math.round(w * (16 / 9))
      setStageSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
    }
    measure()
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [stageRef])

  const video = videoRef?.current ?? null
  const visible = filterOverlaysAtVideoTime(overlays, videoTimeSec, videoDurationSec)
  if (!visible.length) return null

  const designScale = stageSize.w / MVP_PREVIEW_STAGE_WIDTH_PX

  return (
    <>
      {visible.map((ov) => {
        const selected = selectedId === ov.id
        const mosaic = isMosaicOverlay(ov.catalogId)
        const dims = mosaic ? mosaicOverlayDimensions(ov) : null
        const boxW = dims ? Math.max(8, Math.round(dims.w * designScale)) : ov.size
        const boxH = dims ? Math.max(8, Math.round(dims.h * designScale)) : ov.size

        return (
          <div
            key={ov.id}
            data-overlay-id={ov.id}
            className="absolute z-[5] touch-none select-none"
            style={{
              left: `${ov.x}%`,
              top: `${ov.y}%`,
              transform: "translate(-50%, -50%)",
            }}
            onPointerDown={(e) => {
              onOverlayPointerDown?.()
              startMove(e, ov, () => onSelectId(ov.id))
            }}
          >
            <div
              className={cn(
                "relative flex cursor-grab items-center justify-center active:cursor-grabbing",
                selected && "rounded-md ring-2 ring-violet-400 ring-offset-1 ring-offset-black/50"
              )}
              style={{
                width: mosaic ? boxW : undefined,
                height: mosaic ? boxH : undefined,
                transform: `rotate(${ov.rotation}deg)`,
              }}
              onPointerDown={(e) => {
                onOverlayPointerDown?.()
                startMove(e, ov, () => onSelectId(ov.id))
              }}
            >
              {mosaic && video ? (
                <VideoMosaicLayer
                  video={video}
                  overlay={ov}
                  stageWidth={stageSize.w}
                  stageHeight={stageSize.h}
                  videoTimeSec={videoTimeSec}
                  playing={playing}
                  sourceTransform={sourceTransform}
                />
              ) : mosaic ? (
                <div className="flex h-full w-full items-center justify-center rounded-md border-2 border-dashed border-violet-400/40 bg-violet-500/10 text-[9px] text-violet-200/80">
                  영상 로드 중
                </div>
              ) : (
                <StudioOverlayGraphic
                  catalogId={ov.catalogId}
                  color={ov.color}
                  size={ov.size}
                  filled={ov.filled}
                />
              )}
              {selected && mosaic ? (
                <MosaicResizeHandles
                  onStartEdgeResize={(e, side) => {
                    if (side === "left" || side === "right") {
                      startResizeMosaicW(e, ov, side)
                    } else {
                      startResizeMosaicH(e, ov, side)
                    }
                  }}
                  onStartCornerResize={(e, corner) => startResizeMosaicCorner(e, ov, corner)}
                />
              ) : null}
            </div>
            {selected && !mosaic ? (
              <>
                <div
                  className="absolute left-1/2 flex flex-col items-center"
                  style={{ top: `calc(50% + ${ov.size / 2 + 6}px)`, transform: "translateX(-50%)" }}
                >
                  <div className="h-3 w-px bg-violet-400/70" aria-hidden />
                  <button
                    type="button"
                    title="드래그하여 회전"
                    className="mt-0.5 flex h-5 w-5 cursor-grab items-center justify-center rounded-full border-2 border-violet-400 bg-slate-900 text-[9px] text-violet-300 active:cursor-grabbing"
                    onPointerDown={(e) => startRotate(e, ov)}
                  >
                    ↻
                  </button>
                </div>
                <button
                  type="button"
                  title="크기 조절"
                  className="absolute bottom-0 right-0 flex h-4 w-4 translate-x-1/2 translate-y-1/2 cursor-nwse-resize items-center justify-center rounded-sm border border-violet-400 bg-slate-900 text-[8px] text-violet-300"
                  onPointerDown={(e) => startResize(e, ov)}
                >
                  ⤡
                </button>
              </>
            ) : null}
            {selected && mosaic ? (
              <div
                className="absolute left-1/2 flex flex-col items-center"
                style={{ top: `calc(50% + ${boxH / 2 + 8}px)`, transform: "translateX(-50%)" }}
              >
                <div className="h-3 w-px bg-violet-400/70" aria-hidden />
                <button
                  type="button"
                  title="드래그하여 회전"
                  className="mt-0.5 flex h-5 w-5 cursor-grab items-center justify-center rounded-full border-2 border-violet-400 bg-slate-900 text-[9px] text-violet-300 active:cursor-grabbing"
                  onPointerDown={(e) => startRotate(e, ov)}
                >
                  ↻
                </button>
              </div>
            ) : null}
          </div>
        )
      })}
    </>
  )
}
