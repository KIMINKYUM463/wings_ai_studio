import { studioOverlayById, type PlacedStudioOverlay } from "@/lib/shotform-studio-overlay-catalog"

export const MVP_OVERLAY_COLOR_PRESETS = ["#ffffff", "#ef4444", "#eab308", "#22c55e", "#3b82f6", "#000000"] as const

export function clampOverlayPct(n: number): number {
  return Math.min(95, Math.max(5, n))
}

export function normalizePlacedOverlays(list?: PlacedStudioOverlay[] | null): PlacedStudioOverlay[] {
  if (!list?.length) return []
  return list
    .filter((o) => o?.id && o?.catalogId && studioOverlayById(o.catalogId))
    .map((o) => ({
      id: String(o.id),
      catalogId: o.catalogId,
      x: clampOverlayPct(Number(o.x) || 50),
      y: clampOverlayPct(Number(o.y) || 42),
      size: Math.min(120, Math.max(20, Number(o.size) || 48)),
      color: o.color?.startsWith("#") ? o.color : "#ffffff",
      rotation: Math.min(180, Math.max(-180, Math.round(Number(o.rotation) || 0))),
      ...(typeof o.filled === "boolean" ? { filled: o.filled } : {}),
    }))
}
