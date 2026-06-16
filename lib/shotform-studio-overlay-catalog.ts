import type { LucideIcon } from "lucide-react"
import {
  ArrowBigDown,
  ArrowBigLeft,
  ArrowBigRight,
  ArrowBigUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Circle,
  Heart,
  Hexagon,
  MoveDown,
  MoveRight,
  Pointer,
  ShoppingBag,
  Sparkles,
  Square,
  Star,
  Triangle,
  Zap,
  Grid3x3,
  CircleDot,
} from "lucide-react"

export type StudioOverlayCategory = "shapes" | "arrows" | "icons" | "effects"

export type StudioOverlayCatalogEntry = {
  id: string
  label: string
  category: StudioOverlayCategory
  kind: "lucide" | "ring" | "rounded-rect" | "mosaic" | "mosaic-circle"
  Icon?: LucideIcon
}

export const STUDIO_OVERLAY_CATEGORIES: { id: StudioOverlayCategory; label: string }[] = [
  { id: "shapes", label: "도형" },
  { id: "arrows", label: "화살표" },
  { id: "icons", label: "아이콘" },
  { id: "effects", label: "효과" },
]

export const STUDIO_OVERLAY_CATALOG: StudioOverlayCatalogEntry[] = [
  { id: "circle", label: "원", category: "shapes", kind: "lucide", Icon: Circle },
  { id: "ring", label: "원형 테두리", category: "shapes", kind: "ring" },
  { id: "square", label: "사각형", category: "shapes", kind: "lucide", Icon: Square },
  { id: "rounded-rect", label: "둥근 사각", category: "shapes", kind: "rounded-rect" },
  { id: "triangle", label: "삼각형", category: "shapes", kind: "lucide", Icon: Triangle },
  { id: "hexagon", label: "육각형", category: "shapes", kind: "lucide", Icon: Hexagon },

  { id: "arrow-up", label: "위", category: "arrows", kind: "lucide", Icon: ArrowUp },
  { id: "arrow-down", label: "아래", category: "arrows", kind: "lucide", Icon: ArrowDown },
  { id: "arrow-left", label: "왼쪽", category: "arrows", kind: "lucide", Icon: ArrowLeft },
  { id: "arrow-right", label: "오른쪽", category: "arrows", kind: "lucide", Icon: ArrowRight },
  { id: "arrow-up-right", label: "대각", category: "arrows", kind: "lucide", Icon: ArrowUpRight },
  { id: "arrow-big-up", label: "큰 ↑", category: "arrows", kind: "lucide", Icon: ArrowBigUp },
  { id: "arrow-big-down", label: "큰 ↓", category: "arrows", kind: "lucide", Icon: ArrowBigDown },
  { id: "arrow-big-left", label: "큰 ←", category: "arrows", kind: "lucide", Icon: ArrowBigLeft },
  { id: "arrow-big-right", label: "큰 →", category: "arrows", kind: "lucide", Icon: ArrowBigRight },
  { id: "move-right", label: "이동 →", category: "arrows", kind: "lucide", Icon: MoveRight },
  { id: "move-down", label: "이동 ↓", category: "arrows", kind: "lucide", Icon: MoveDown },
  { id: "pointer", label: "포인터", category: "arrows", kind: "lucide", Icon: Pointer },

  { id: "star", label: "별", category: "icons", kind: "lucide", Icon: Star },
  { id: "heart", label: "하트", category: "icons", kind: "lucide", Icon: Heart },
  { id: "sparkles", label: "반짝", category: "icons", kind: "lucide", Icon: Sparkles },
  { id: "zap", label: "번개", category: "icons", kind: "lucide", Icon: Zap },
  { id: "shopping-bag", label: "쇼핑", category: "icons", kind: "lucide", Icon: ShoppingBag },

  { id: "partial-mosaic", label: "부분 모자이크", category: "effects", kind: "mosaic", Icon: Grid3x3 },
  {
    id: "partial-mosaic-circle",
    label: "원형 모자이크",
    category: "effects",
    kind: "mosaic-circle",
    Icon: CircleDot,
  },
]

export function studioOverlayById(id: string): StudioOverlayCatalogEntry | undefined {
  return STUDIO_OVERLAY_CATALOG.find((e) => e.id === id)
}

/** 속 채우기 기본값 — 화살표는 채움, 도형·아이콘은 테두리/선 */
export function overlayDefaultFilled(catalogId: string): boolean {
  return studioOverlayById(catalogId)?.category === "arrows"
}

export function overlaySupportsFill(catalogId: string): boolean {
  const entry = studioOverlayById(catalogId)
  if (!entry) return false
  return entry.category === "arrows" || entry.kind === "lucide"
}

export type PlacedStudioOverlay = {
  id: string
  catalogId: string
  /** 프리뷰 기준 % (0–100) */
  x: number
  y: number
  size: number
  color: string
  rotation: number
  /** 속 채우기 — 미설정 시 화살표는 채움 */
  filled?: boolean
  /** 부분 모자이크 — 가로(px). 미설정 시 size */
  mosaicW?: number
  /** 부분 모자이크 — 세로(px). 미설정 시 mosaicW ?? size */
  mosaicH?: number
  /** 모자이크 블록 크기 (작을수록 거침, 4~24) */
  mosaicBlock?: number
  /** 표시 시작(영상 초). 미설정 시 항상 표시 */
  startSec?: number
  /** 표시 끝(영상 초). 미설정 시 영상 끝까지 */
  endSec?: number
  /** manual | ai — AI 자동 감지 여부 */
  source?: "manual" | "ai"
  /** AI 감지 텍스트 등 메모 */
  label?: string
}

export function isMosaicOverlay(catalogId: string): boolean {
  const entry = studioOverlayById(catalogId)
  return entry?.kind === "mosaic" || entry?.kind === "mosaic-circle"
}

export function isMosaicCircleOverlay(catalogId: string): boolean {
  return studioOverlayById(catalogId)?.kind === "mosaic-circle"
}

export function mosaicOverlayDimensions(ov: PlacedStudioOverlay): { w: number; h: number } {
  const w = ov.mosaicW ?? ov.size
  const h = ov.mosaicH ?? ov.mosaicW ?? ov.size
  return { w, h }
}

export function mosaicOverlayBlockSize(ov: PlacedStudioOverlay): number {
  return ov.mosaicBlock ?? 10
}
