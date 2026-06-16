import {
  isMosaicOverlay,
  mosaicOverlayBlockSize,
  mosaicOverlayDimensions,
  studioOverlayById,
  type PlacedStudioOverlay,
} from "@/lib/shotform-studio-overlay-catalog"
import { MVP_MOSAIC_DEFAULT_BLOCK } from "@/lib/mvp-mosaic-overlay-utils"

export const MVP_OVERLAY_COLOR_PRESETS = ["#ffffff", "#ef4444", "#eab308", "#22c55e", "#3b82f6", "#000000"] as const

export function clampOverlayPct(n: number): number {
  return Math.min(95, Math.max(5, n))
}

function finiteOr(n: unknown, fallback: number): number {
  const v = Number(n)
  return Number.isFinite(v) ? v : fallback
}

export function normalizePlacedOverlays(list?: PlacedStudioOverlay[] | null): PlacedStudioOverlay[] {
  if (!list?.length) return []
  return list
    .filter((o) => o?.id && o?.catalogId && studioOverlayById(o.catalogId))
    .map((o) => ({
      id: String(o.id),
      catalogId: o.catalogId,
      x: clampOverlayPct(finiteOr(o.x, 50)),
      y: clampOverlayPct(finiteOr(o.y, 42)),
      size: Math.min(120, Math.max(20, finiteOr(o.size, 48))),
      color: o.color?.startsWith("#") ? o.color : "#ffffff",
      rotation: Math.min(180, Math.max(-180, Math.round(Number(o.rotation) || 0))),
      ...(typeof o.filled === "boolean" ? { filled: o.filled } : {}),
      ...(isMosaicOverlay(o.catalogId)
        ? {
            mosaicW: Math.min(320, Math.max(24, Number(o.mosaicW) || mosaicOverlayDimensions(o).w)),
            mosaicH: Math.min(560, Math.max(24, Number(o.mosaicH) || mosaicOverlayDimensions(o).h)),
            mosaicBlock: Math.min(24, Math.max(4, Number(o.mosaicBlock) || mosaicOverlayBlockSize(o))),
          }
        : {}),
      ...(Number.isFinite(Number(o.startSec)) ? { startSec: Math.max(0, Number(o.startSec)) } : {}),
      ...(Number.isFinite(Number(o.endSec)) ? { endSec: Math.max(0, Number(o.endSec)) } : {}),
      ...(o.source === "ai" || o.source === "manual" ? { source: o.source } : {}),
      ...(typeof o.label === "string" && o.label.trim() ? { label: o.label.trim().slice(0, 80) } : {}),
    }))
}

export function createOverlayFromCatalog(
  catalogId: string,
  overlays: PlacedStudioOverlay[],
  color: string,
  nextIdRef: { current: number }
): PlacedStudioOverlay {
  let max = nextIdRef.current
  for (const o of overlays) {
    const m = /^ov-(\d+)$/.exec(o.id)
    if (m) max = Math.max(max, Number(m[1]))
  }
  max += 1
  nextIdRef.current = max
  const mosaic = isMosaicOverlay(catalogId)
  const entry = studioOverlayById(catalogId)
  const circle = entry?.kind === "mosaic-circle"
  return {
    id: `ov-${max}`,
    catalogId,
    x: mosaic ? 50 : 50,
    y: mosaic ? (circle ? 50 : 82) : 42,
    size: mosaic ? 120 : 48,
    color,
    rotation: 0,
    ...(mosaic
      ? {
          mosaicW: circle ? 100 : 200,
          mosaicH: circle ? 100 : 56,
          mosaicBlock: MVP_MOSAIC_DEFAULT_BLOCK,
        }
      : {}),
  }
}
