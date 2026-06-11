"use client"

import { cn } from "@/lib/utils"
import {
  overlayDefaultFilled,
  studioOverlayById,
  type StudioOverlayCatalogEntry,
} from "@/lib/shotform-studio-overlay-catalog"

type Props = {
  catalogId: string
  color: string
  size: number
  className?: string
  strokeWidth?: number
  /** 속 채우기 — 미설정 시 화살표 카테고리는 채움 */
  filled?: boolean
}

const FILLED_BIG_ARROW_PATHS: Record<string, string> = {
  "arrow-big-up": "M12 3 L5 13 L9 13 L9 20 L15 20 L15 13 L19 13 Z",
  "arrow-big-down": "M12 21 L5 11 L9 11 L9 4 L15 4 L15 11 L19 11 Z",
  "arrow-big-left": "M3 12 L13 5 L13 9 L20 9 L20 15 L13 15 L13 19 Z",
  "arrow-big-right": "M21 12 L11 5 L11 9 L4 9 L4 15 L11 15 L11 19 Z",
}

const FILLED_ARROW_PATHS: Record<string, string> = {
  "arrow-up": "M12 2 L6 12 H9 V20 H15 V12 H18 Z",
  "arrow-down": "M12 22 L6 12 H9 V4 H15 V12 H18 Z",
  "arrow-left": "M2 12 L12 4 V9 H20 V15 H12 V20 Z",
  "arrow-right": "M22 12 L12 4 V9 H4 V15 H12 V20 Z",
  pointer: "M5 3 9 21 12 14 20 12 Z",
}

function SvgShape({
  entry,
  color,
  size,
  strokeWidth = 2.5,
}: {
  entry: StudioOverlayCatalogEntry
  color: string
  size: number
  strokeWidth?: number
}) {
  const s = size
  if (entry.kind === "ring") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeWidth={strokeWidth} />
      </svg>
    )
  }
  if (entry.kind === "rounded-rect") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="4" fill={color} fillOpacity={0.85} stroke={color} strokeWidth={1} />
      </svg>
    )
  }
  return null
}

function FilledSvgPath({ d, color, size, className }: { d: string; color: string; size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={cn("shrink-0", className)}>
      <path d={d} fill={color} stroke={color} strokeWidth={0.5} strokeLinejoin="round" />
    </svg>
  )
}

function useFilled(catalogId: string, filled?: boolean): boolean {
  if (typeof filled === "boolean") return filled
  return overlayDefaultFilled(catalogId)
}

export function StudioOverlayGraphic({ catalogId, color, size, className, strokeWidth, filled }: Props) {
  const entry = studioOverlayById(catalogId)
  if (!entry) return null

  const isFilled = useFilled(catalogId, filled)

  if (isFilled && entry.category === "arrows") {
    const bigPath = FILLED_BIG_ARROW_PATHS[catalogId]
    if (bigPath) {
      return (
        <span className={cn("inline-flex shrink-0 items-center justify-center", className)}>
          <FilledSvgPath d={bigPath} color={color} size={size} />
        </span>
      )
    }

    const arrowPath = FILLED_ARROW_PATHS[catalogId]
    if (arrowPath) {
      return (
        <span className={cn("inline-flex shrink-0 items-center justify-center", className)}>
          <FilledSvgPath d={arrowPath} color={color} size={size} />
        </span>
      )
    }

    if (entry.kind === "lucide" && entry.Icon) {
      const Icon = entry.Icon
      return (
        <Icon
          className={cn("shrink-0", className)}
          style={{ width: size, height: size, color }}
          strokeWidth={strokeWidth ?? 1.25}
          fill={color}
          stroke={color}
        />
      )
    }
  }

  if (entry.kind === "lucide" && entry.Icon) {
    const Icon = entry.Icon
    return (
      <Icon
        className={cn("shrink-0", className)}
        style={{ width: size, height: size, color }}
        strokeWidth={strokeWidth ?? 2.25}
        fill="none"
        stroke="currentColor"
      />
    )
  }

  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center", className)}>
      <SvgShape entry={entry} color={color} size={size} strokeWidth={strokeWidth} />
    </span>
  )
}

export function StudioOverlayCatalogThumb({ entry, color }: { entry: StudioOverlayCatalogEntry; color: string }) {
  return (
    <StudioOverlayGraphic
      catalogId={entry.id}
      color={color}
      size={28}
      strokeWidth={2}
      filled={overlayDefaultFilled(entry.id)}
    />
  )
}
