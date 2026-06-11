"use client"

import { cn } from "@/lib/utils"
import type { PlacedStudioOverlay } from "@/lib/shotform-studio-overlay-catalog"
import { StudioOverlayGraphic } from "../shoppingshotform/StudioOverlayGraphic"
import { useMvpOverlayInteraction } from "./useMvpOverlayInteraction"

type Props = {
  overlays: PlacedStudioOverlay[]
  selectedId: string | null
  onSelectId: (id: string | null) => void
  onUpdateOverlay: (id: string, patch: Partial<PlacedStudioOverlay>) => void
  stageRef: React.RefObject<HTMLDivElement | null>
  onOverlayPointerDown?: () => void
}

export function MvpOverlayLayer({
  overlays,
  selectedId,
  onSelectId,
  onUpdateOverlay,
  stageRef,
  onOverlayPointerDown,
}: Props) {
  const { startMove, startRotate } = useMvpOverlayInteraction(stageRef, onUpdateOverlay)

  if (!overlays.length) return null

  return (
    <>
      {overlays.map((ov) => {
        const selected = selectedId === ov.id
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
                "relative cursor-grab active:cursor-grabbing",
                selected && "rounded-md ring-2 ring-violet-400 ring-offset-1 ring-offset-black/50"
              )}
              style={{ transform: `rotate(${ov.rotation}deg)` }}
            >
              <StudioOverlayGraphic
                catalogId={ov.catalogId}
                color={ov.color}
                size={ov.size}
                filled={ov.filled}
              />
            </div>
            {selected ? (
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
            ) : null}
          </div>
        )
      })}
    </>
  )
}
