import {
  isMosaicOverlay,
  mosaicOverlayBlockSize,
  mosaicOverlayDimensions,
  studioOverlayById,
  type PlacedStudioOverlay,
} from "@/lib/shotform-studio-overlay-catalog"
import { videoContainRect } from "@/lib/mvp-video-mosaic"

/** CapCut 미리보기 스테이지 너비 — `MvpCapCutEditor` max-w-[280px] */
export const MVP_PREVIEW_STAGE_WIDTH_PX = 280

export const MVP_MOSAIC_DEFAULT_BLOCK = 6

export function mosaicStageHeightPx(stageWidth = MVP_PREVIEW_STAGE_WIDTH_PX): number {
  return Math.round(stageWidth * (16 / 9))
}

/** 모자이크 오버레이가 현재 영상 시각에 표시되는지 */
export function overlayVisibleAtVideoTime(
  ov: PlacedStudioOverlay,
  videoTimeSec: number,
  totalSec?: number
): boolean {
  const start = ov.startSec ?? 0
  const end = ov.endSec ?? totalSec ?? Number.POSITIVE_INFINITY
  const pad = 0.06
  return videoTimeSec >= start - pad && videoTimeSec <= end + pad
}

export function filterOverlaysAtVideoTime(
  overlays: PlacedStudioOverlay[],
  videoTimeSec: number,
  totalSec?: number
): PlacedStudioOverlay[] {
  return overlays.filter((ov) => overlayVisibleAtVideoTime(ov, videoTimeSec, totalSec))
}

export function defaultMosaicOverlayFields(catalogId: string): Partial<PlacedStudioOverlay> {
  const entry = studioOverlayById(catalogId)
  if (!entry || !isMosaicOverlay(catalogId)) return {}
  const circle = entry.kind === "mosaic-circle"
  return {
    mosaicW: circle ? 100 : 200,
    mosaicH: circle ? 100 : 56,
    mosaicBlock: MVP_MOSAIC_DEFAULT_BLOCK,
    x: 50,
    y: circle ? 50 : 82,
  }
}

export function videoFrameBoxToStageOverlay(args: {
  centerXPct: number
  centerYPct: number
  widthPct: number
  heightPct: number
  videoW: number
  videoH: number
  stageW?: number
}): { x: number; y: number; mosaicW: number; mosaicH: number } {
  const stageW = args.stageW ?? MVP_PREVIEW_STAGE_WIDTH_PX
  const stageH = mosaicStageHeightPx(stageW)
  const { drawX, drawY, drawW, drawH } = videoContainRect(
    stageW,
    stageH,
    args.videoW,
    args.videoH
  )
  const stageX = drawX + (args.centerXPct / 100) * drawW
  const stageY = drawY + (args.centerYPct / 100) * drawH
  return {
    x: Math.min(95, Math.max(5, (stageX / stageW) * 100)),
    y: Math.min(95, Math.max(5, (stageY / stageH) * 100)),
    mosaicW: Math.max(28, Math.round((args.widthPct / 100) * drawW)),
    mosaicH: Math.max(18, Math.round((args.heightPct / 100) * drawH)),
  }
}

export function pctBoxToMosaicOverlay(args: {
  centerXPct: number
  centerYPct: number
  widthPct: number
  heightPct: number
  startSec: number
  endSec: number
  detectedText?: string
  id: string
  videoW?: number
  videoH?: number
}): PlacedStudioOverlay {
  const stageW = MVP_PREVIEW_STAGE_WIDTH_PX
  const stageH = mosaicStageHeightPx(stageW)
  const mapped =
    args.videoW && args.videoH && args.videoW > 0 && args.videoH > 0
      ? videoFrameBoxToStageOverlay({
          centerXPct: args.centerXPct,
          centerYPct: args.centerYPct,
          widthPct: args.widthPct,
          heightPct: args.heightPct,
          videoW: args.videoW,
          videoH: args.videoH,
          stageW,
        })
      : {
          x: Math.min(95, Math.max(5, args.centerXPct)),
          y: Math.min(95, Math.max(5, args.centerYPct)),
          mosaicW: Math.max(28, Math.round((args.widthPct / 100) * stageW)),
          mosaicH: Math.max(18, Math.round((args.heightPct / 100) * stageH)),
        }
  return {
    id: args.id,
    catalogId: "partial-mosaic",
    x: mapped.x,
    y: mapped.y,
    size: 48,
    color: "#ffffff",
    rotation: 0,
    mosaicW: mapped.mosaicW,
    mosaicH: mapped.mosaicH,
    mosaicBlock: MVP_MOSAIC_DEFAULT_BLOCK,
    startSec: Math.max(0, args.startSec),
    endSec: Math.max(args.startSec + 0.1, args.endSec),
    source: "ai",
    label: args.detectedText?.slice(0, 40),
  }
}

export const MVP_MOSAIC_CLIP_MIN_SEC = 0.12

export function mosaicTimelineClips(overlays: PlacedStudioOverlay[], durationSec: number) {
  return overlays
    .filter((o) => isMosaicOverlay(o.catalogId))
    .map((ov) => ({
      id: ov.id,
      label: ov.label?.trim() || (ov.source === "ai" ? "AI 中文" : "모자이크"),
      startSec: ov.startSec ?? 0,
      endSec: ov.endSec ?? durationSec,
    }))
}

export function patchMosaicOverlayTime(
  overlays: PlacedStudioOverlay[],
  id: string,
  patch: { startSec?: number; endSec?: number },
  durationSec: number
): PlacedStudioOverlay[] {
  return overlays.map((o) => {
    if (o.id !== id) return o
    let startSec = patch.startSec ?? o.startSec ?? 0
    let endSec = patch.endSec ?? o.endSec ?? durationSec
    startSec = Math.max(0, Math.min(durationSec - MVP_MOSAIC_CLIP_MIN_SEC, startSec))
    endSec = Math.min(durationSec, Math.max(startSec + MVP_MOSAIC_CLIP_MIN_SEC, endSec))
    return { ...o, startSec, endSec }
  })
}

export function mosaicOverlaySummary(ov: PlacedStudioOverlay): string {
  const dims = mosaicOverlayDimensions(ov)
  const block = mosaicOverlayBlockSize(ov)
  const time =
    ov.startSec != null || ov.endSec != null
      ? ` · ${(ov.startSec ?? 0).toFixed(1)}–${(ov.endSec ?? 0).toFixed(1)}s`
      : ""
  return `${dims.w}×${dims.h}px · 블록 ${block}${time}`
}
