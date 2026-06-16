"use client"

import { cn } from "@/lib/utils"

type CornerHandle = "nw" | "ne" | "sw" | "se"

const CORNER_HANDLES: CornerHandle[] = ["nw", "ne", "sw", "se"]

const CORNER_HANDLE_CLASS: Record<CornerHandle, string> = {
  nw: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
  ne: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
  sw: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
  se: "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
}

const MOSAIC_EDGE_HANDLE_CLASS = {
  left: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
  right: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
  top: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize",
  bottom: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize",
} as const

type Props = {
  onStartEdgeResize: (e: React.PointerEvent, side: "left" | "right" | "top" | "bottom") => void
  onStartCornerResize: (e: React.PointerEvent, corner: CornerHandle) => void
}

export function MosaicResizeHandles({ onStartEdgeResize, onStartCornerResize }: Props) {
  const edgeTitle: Record<"left" | "right" | "top" | "bottom", string> = {
    left: "가로 줄이기·늘리기 (왼쪽)",
    right: "가로 줄이기·늘리기 (오른쪽)",
    top: "세로 줄이기·늘리기 (위)",
    bottom: "세로 줄이기·늘리기 (아래)",
  }

  return (
    <>
      {CORNER_HANDLES.map((corner) => (
        <span
          key={corner}
          role="presentation"
          title="가로·세로 함께 조절"
          className={cn(
            "pointer-events-auto absolute z-20 h-2.5 w-2.5 touch-none rounded-sm border-2 border-violet-500 bg-white shadow-md",
            CORNER_HANDLE_CLASS[corner]
          )}
          onPointerDown={(e) => onStartCornerResize(e, corner)}
        />
      ))}
      {(["left", "right", "top", "bottom"] as const).map((side) => (
        <span
          key={side}
          role="presentation"
          title={edgeTitle[side]}
          className={cn(
            "pointer-events-auto absolute z-20 touch-none rounded-sm border-2 border-violet-500 bg-white shadow-md",
            side === "left" || side === "right" ? "h-7 w-2.5" : "h-2.5 w-7",
            MOSAIC_EDGE_HANDLE_CLASS[side]
          )}
          onPointerDown={(e) => onStartEdgeResize(e, side)}
        />
      ))}
    </>
  )
}
