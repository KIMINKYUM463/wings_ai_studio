"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Check,
  Copy,
  Scissors,
  Download,
  ImageIcon,
  Layers,
  Loader2,
  Maximize2,
  Palette,
  Search,
  Sparkles,
  Trash2,
  Type,
  Upload,
  Wand2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Paintbrush,
  Lock,
  LockOpen,
} from "lucide-react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import type { MvpThumbnailHookingText } from "@/lib/mvp-studio-types"
import {
  isMosaicOverlay,
  mosaicOverlayBlockSize,
  mosaicOverlayDimensions,
  STUDIO_OVERLAY_CATALOG,
  STUDIO_OVERLAY_CATEGORIES,
  overlayDefaultFilled,
  overlaySupportsFill,
  type PlacedStudioOverlay,
} from "@/lib/shotform-studio-overlay-catalog"
import { clampOverlayPct } from "@/lib/mvp-overlay-utils"
import {
  THUMBNAIL_EXPORT_H,
  THUMBNAIL_EXPORT_W,
  THUMBNAIL_STAGE_BASE_W,
  THUMBNAIL_TEMPLATES,
  THUMBNAIL_DEFAULT_STROKE_WIDTH,
  THUMBNAIL_TEXT_COLOR_PRESETS,
  normalizeThumbnailHexColor,
  applyAiGeneratedBackground,
  applyFullAiThumbnail,
  applyThumbnailTemplate,
  createThumbnailDesign,
  defaultThumbnailFilter,
  exitAiBakedEditMode,
  resetThumbnailBackgroundTransform,
  setThumbnailBackgroundLocked,
  resolveBackgroundTransform,
  THUMBNAIL_BACKGROUND_LAYER_ID,
  thumbnailBackgroundImageStyle,
  updateThumbnailBackgroundTransform,
  duplicateThumbnailElement,
  duplicateThumbnailText,
  exportThumbnailStageToDataUrl,
  hookingFromThumbnailDesign,
  thumbnailTextAnchorTransform,
  addThumbnailElement,
  removeThumbnailLayer,
  setThumbnailBackground,
  updateThumbnailElement,
  updateThumbnailText,
  type MvpThumbnailDesign,
  type ThumbnailFilterState,
  type ThumbnailTextLayer,
} from "@/lib/mvp-thumbnail-design"
import { compressReferenceImageDataUrl, persistImageUrlAsDataUrl } from "@/lib/mvp-thumbnail-capture"
import { StudioOverlayGraphic } from "../shoppingshotform/StudioOverlayGraphic"
import { useMvpOverlayInteraction } from "./useMvpOverlayInteraction"
import { useThumbnailDesignHistory } from "./useThumbnailDesignHistory"
import type { CapturedVideoFrame } from "@/lib/mvp-thumbnail-capture"
import { studio } from "../components/ShotFormStudioUI"
import { MvpThumbnailFramePicker } from "./MvpThumbnailFramePicker"
import { ThumbnailMosaicLayer } from "./ThumbnailMosaicLayer"
import {
  ThumbnailBrushEraseLayer,
  type ThumbnailBrushEraseLayerHandle,
} from "./ThumbnailBrushEraseLayer"
import {
  localInpaintMaskedRegion,
  renderBackgroundToCanvas,
} from "@/lib/mvp-thumbnail-inpaint"

type SideTab = "template" | "text" | "elements" | "background" | "ai" | "filter"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  backgroundUrl: string
  /** 짜집기 영상 프레임·업로드 참조 — AI 생성 시 제품 형태 기준 */
  referenceImageUrl?: string
  videoFrames?: CapturedVideoFrame[]
  selectedVideoFrameId?: string | null
  onSelectVideoFrame?: (frame: CapturedVideoFrame) => void
  hookingText: MvpThumbnailHookingText
  productName: string
  /** 스튜디오 재진입 시 복원 — 없으면 hookingText로 새 디자인 생성 */
  initialDesign?: MvpThumbnailDesign | null
  onApply: (thumbnailDataUrl: string, hooking: MvpThumbnailHookingText, design: MvpThumbnailDesign) => void
}

function isSampleSvgBackground(url: string): boolean {
  return url.includes("data:image/svg+xml")
}

/** AI 생성 참조 — 영상/업로드 프레임 우선, 샘플 SVG는 제외 */
function aiReferenceUrl(referenceImageUrl: string | undefined, canvasBackground: string): string {
  const fromVideo = referenceImageUrl?.trim()
  if (fromVideo) return fromVideo
  const bg = canvasBackground.trim()
  if (bg && !isSampleSvgBackground(bg)) return bg
  return ""
}

type TextMoveState = {
  kind: "move"
  id: string
  pointerId: number
  startPx: number
  startPy: number
  startX: number
  startY: number
}

type TextResizeState = {
  kind: "resize"
  id: string
  pointerId: number
  centerPx: number
  centerPy: number
  startDist: number
  startFontSize: number
  startWidthPct: number
}

type TextRotateState = {
  kind: "rotate"
  id: string
  pointerId: number
  centerPx: number
  centerPy: number
  startAngle: number
  startRotation: number
}

type TextInteractionState = TextMoveState | TextResizeState | TextRotateState

type BgMoveState = {
  kind: "bg-move"
  pointerId: number
  startPx: number
  startPy: number
  startX: number
  startY: number
}

type BgMovePendingState = {
  kind: "bg-move-pending"
  pointerId: number
  startPx: number
  startPy: number
  startX: number
  startY: number
}

type BgResizeState = {
  kind: "bg-resize"
  pointerId: number
  centerPx: number
  centerPy: number
  startDist: number
  startScale: number
}

type BgInteractionState = BgMoveState | BgMovePendingState | BgResizeState

const BG_DRAG_THRESHOLD_PX = 4

type ThumbnailClipboardItem =
  | { kind: "text"; layer: ThumbnailTextLayer }
  | { kind: "element"; layer: PlacedStudioOverlay }

function isEditingField(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return Boolean(el?.closest("input, textarea, select, [contenteditable='true']"))
}

const CORNER_HANDLES = ["nw", "ne", "sw", "se"] as const
type CornerHandle = (typeof CORNER_HANDLES)[number]

const CORNER_HANDLE_CLASS: Record<CornerHandle, string> = {
  nw: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
  ne: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
  sw: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
  se: "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
}

function CornerResizeHandles({
  onStartResize,
  accent = "violet",
}: {
  onStartResize: (e: React.PointerEvent, corner: CornerHandle) => void
  accent?: "violet" | "cyan"
}) {
  const border = accent === "cyan" ? "border-cyan-500" : "border-violet-500"
  return (
    <>
      {CORNER_HANDLES.map((corner) => (
        <span
          key={corner}
          role="presentation"
          className={cn(
            "absolute z-20 h-2.5 w-2.5 rounded-sm border-2 bg-white shadow-md pointer-events-auto touch-none",
            border,
            CORNER_HANDLE_CLASS[corner]
          )}
          onPointerDown={(e) => onStartResize(e, corner)}
        />
      ))}
    </>
  )
}

const MOSAIC_EDGE_HANDLE_CLASS = {
  left: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
  right: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
  top: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize",
  bottom: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize",
} as const

function MosaicResizeHandles({
  onStartEdgeResize,
  onStartCornerResize,
}: {
  onStartEdgeResize: (e: React.PointerEvent, side: "left" | "right" | "top" | "bottom") => void
  onStartCornerResize: (e: React.PointerEvent, corner: CornerHandle) => void
}) {
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
            "absolute z-20 h-2.5 w-2.5 rounded-sm border-2 border-violet-500 bg-white shadow-md pointer-events-auto touch-none",
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
            "absolute z-20 rounded-sm border-2 border-violet-500 bg-white shadow-md pointer-events-auto touch-none",
            side === "left" || side === "right" ? "h-7 w-2.5" : "h-2.5 w-7",
            MOSAIC_EDGE_HANDLE_CLASS[side]
          )}
          onPointerDown={(e) => onStartEdgeResize(e, side)}
        />
      ))}
    </>
  )
}

function textLayerLineStyle(t: ThumbnailTextLayer): React.CSSProperties {
  return {
    textAlign: t.align,
    fontSize: t.fontSize,
    fontWeight: t.fontWeight,
    color: t.color,
    letterSpacing: `${t.letterSpacing}px`,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
    WebkitTextStroke: t.strokeOn ? `${t.strokeWidth}px ${t.strokeColor}` : undefined,
    paintOrder: t.strokeOn ? "stroke fill" : undefined,
    textShadow: t.shadow ? "2px 3px 8px rgba(0,0,0,0.75)" : undefined,
    fontFamily: '"Pretendard","Noto Sans KR",system-ui,sans-serif',
    wordBreak: "keep-all",
  }
}

function splitTextLines(text: string): string[] {
  const lines = text.split("\n")
  return lines.length ? lines : [""]
}

function ThumbnailTextLayerContent({ layer }: { layer: ThumbnailTextLayer }) {
  const lines = splitTextLines(layer.text)
  const bgOpacity = (layer.bgOpacity ?? 70) / 100

  const inner = (
    <div className="flex w-full flex-col gap-0.5">
      {lines.map((line, i) => (
        <span key={`${layer.id}-line-${i}`} className="block w-full" style={textLayerLineStyle(layer)}>
          {line || "\u00A0"}
        </span>
      ))}
    </div>
  )

  if (layer.bgOn) {
    return (
      <div
        className="w-full"
        style={{
          backgroundColor: `rgba(0,0,0,${bgOpacity})`,
          borderRadius: 8,
          padding: "6px 12px",
          boxSizing: "border-box",
        }}
      >
        {inner}
      </div>
    )
  }

  return inner
}

function shotformOpenAIKey(): string {
  if (typeof window === "undefined") return ""
  return (localStorage.getItem("shotform_openai_api_key") || "").trim()
}

function shotformReplicateKey(): string {
  if (typeof window === "undefined") return ""
  return (localStorage.getItem("shotform_replicate_api_key") || "").trim()
}

async function referenceImageForApi(url: string): Promise<string> {
  let dataUrl = url.trim()
  if (!dataUrl) throw new Error("참조 이미지가 없습니다.")
  if (!dataUrl.startsWith("data:image/")) {
    const res = await fetch(dataUrl)
    if (!res.ok) throw new Error("참조 이미지를 불러올 수 없습니다.")
    const blob = await res.blob()
    dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result ?? ""))
      reader.onerror = () => reject(new Error("이미지 변환 실패"))
      reader.readAsDataURL(blob)
    })
  }
  return compressReferenceImageDataUrl(dataUrl)
}

function textRoleLabel(role?: ThumbnailTextLayer["role"]): string {
  if (role === "hook1") return "후킹 1줄"
  if (role === "hook2") return "후킹 2줄"
  if (role === "badge") return "뱃지"
  return "텍스트"
}

function AiBackgroundHistoryGrid({
  urls,
  activeUrl,
  onSelect,
}: {
  urls: string[]
  activeUrl: string
  onSelect: (url: string) => void
}) {
  if (!urls.length) return null
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
      <p className="text-[10px] font-semibold text-amber-200/90">AI 생성 배경 기록</p>
      <p className="mt-1 text-[9px] leading-relaxed text-slate-500">
        짜집기 프레임 등 다른 배경을 골라도 AI로 만든 이미지는 여기에 보관됩니다. 썸네일을 다시 적용하면
        기록도 함께 저장됩니다.
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {urls.map((url, i) => (
          <button
            key={`${url.slice(0, 48)}-${i}`}
            type="button"
            title={`AI 배경 ${urls.length - i}`}
            onClick={() => onSelect(url)}
            className={cn(
              "overflow-hidden rounded-lg border-2 transition hover:border-amber-400/60",
              activeUrl === url ? "border-amber-500" : "border-transparent"
            )}
          >
            <img src={url} alt="" className="aspect-[9/16] w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  )
}

function ThumbnailTemplatePreview({
  preview,
  hook1,
  hook2,
  hook1Color = "#ffffff",
  hook2Color = "#5eead4",
  selected,
  label,
  description,
  onClick,
}: {
  preview: string
  hook1?: string
  hook2?: string
  hook1Color?: string
  hook2Color?: string
  selected: boolean
  label: string
  description?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "overflow-hidden rounded-xl border text-left transition",
        selected
          ? "border-violet-400 ring-2 ring-violet-400/30"
          : "border-black/10 hover:border-violet-300 dark:border-white/10"
      )}
    >
      <div className="relative aspect-[9/16] w-full" style={{ background: preview }}>
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/25" />
        <div className="absolute inset-x-1 top-[12%] px-1 text-center">
          {hook1 ? (
            <p
              className="truncate text-[7px] font-extrabold leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
              style={{ color: hook1Color, WebkitTextStroke: "0.4px #000" }}
            >
              {hook1}
            </p>
          ) : null}
          {hook2 ? (
            <p
              className="mt-0.5 truncate text-[7px] font-extrabold leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
              style={{ color: hook2Color, WebkitTextStroke: "0.4px #000" }}
            >
              {hook2}
            </p>
          ) : null}
        </div>
      </div>
      <div className="px-2 py-1.5">
        <p className="truncate text-[10px] font-semibold text-slate-800 dark:text-white">{label}</p>
        {description ? (
          <p className="mt-0.5 line-clamp-2 text-[8px] leading-snug text-slate-500">{description}</p>
        ) : null}
      </div>
    </button>
  )
}

const SIDE_TABS: Array<{ id: SideTab; label: string; icon: React.ReactNode }> = [
  { id: "template", label: "템플릿", icon: <Layers className="h-5 w-5" /> },
  { id: "text", label: "텍스트", icon: <Type className="h-5 w-5" /> },
  { id: "elements", label: "요소", icon: <Sparkles className="h-5 w-5" /> },
  { id: "background", label: "배경", icon: <ImageIcon className="h-5 w-5" /> },
  { id: "ai", label: "AI", icon: <Wand2 className="h-5 w-5" /> },
  { id: "filter", label: "필터", icon: <Palette className="h-5 w-5" /> },
]

export function MvpThumbnailAdvancedEditor({
  open,
  onOpenChange,
  backgroundUrl,
  referenceImageUrl,
  videoFrames = [],
  selectedVideoFrameId = null,
  onSelectVideoFrame,
  hookingText,
  productName,
  initialDesign = null,
  onApply,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasAreaRef = useRef<HTMLDivElement>(null)
  const clipboardRef = useRef<ThumbnailClipboardItem | null>(null)
  const sliderSessionRef = useRef<string | null>(null)
  const editSessionRef = useRef<string | null>(null)
  const { design, canUndo, resetDesign, pushHistory, patchDesign, commitDesign, undo } =
    useThumbnailDesignHistory(createThumbnailDesign(backgroundUrl, hookingText))
  const [sideTab, setSideTab] = useState<SideTab>("template")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [fitScale, setFitScale] = useState(1)
  const [zoomMul, setZoomMul] = useState(1)
  const [elementQuery, setElementQuery] = useState("")
  const [bgUrlDraft, setBgUrlDraft] = useState("")
  const [exporting, setExporting] = useState(false)
  const [aiTextLoadingId, setAiTextLoadingId] = useState<string | null>(null)
  const [bgGenerating, setBgGenerating] = useState(false)
  const [fullThumbGenerating, setFullThumbGenerating] = useState(false)
  const [brushEraseActive, setBrushEraseActive] = useState(false)
  const [brushSize, setBrushSize] = useState(28)
  const [inpaintLoading, setInpaintLoading] = useState(false)
  const brushEraseRef = useRef<ThumbnailBrushEraseLayerHandle>(null)
  const [err, setErr] = useState<string | null>(null)
  const textInteractionRef = useRef<TextInteractionState | null>(null)
  const bgInteractionRef = useRef<BgInteractionState | null>(null)
  const openSessionReadyRef = useRef(false)

  useEffect(() => {
    if (!open) {
      openSessionReadyRef.current = false
      return
    }
    if (!backgroundUrl || openSessionReadyRef.current) return
    openSessionReadyRef.current = true

    const nextDesign = initialDesign
      ? { ...initialDesign, backgroundUrl }
      : createThumbnailDesign(backgroundUrl, hookingText)

    resetDesign(nextDesign)
    clipboardRef.current = null
    sliderSessionRef.current = null
    editSessionRef.current = null
    setSelectedId(null)
    setErr(null)
    setBgUrlDraft(backgroundUrl)
    setZoomMul(1)
  }, [open, backgroundUrl, initialDesign, hookingText, resetDesign])

  useEffect(() => {
    const area = canvasAreaRef.current
    if (!area || !open) return
    const updateFit = () => {
      const pad = 56
      const availW = Math.max(200, area.clientWidth - pad)
      const availH = Math.max(200, area.clientHeight - pad)
      const aspect = 9 / 16
      let w = availW
      let h = w / aspect
      if (h > availH) {
        h = availH
        w = h * aspect
      }
      setFitScale(w / THUMBNAIL_STAGE_BASE_W)
    }
    updateFit()
    const ro = new ResizeObserver(updateFit)
    ro.observe(area)
    return () => ro.disconnect()
  }, [open])

  const stagePxW = THUMBNAIL_STAGE_BASE_W * fitScale * zoomMul
  const stagePxH = stagePxW * (16 / 9)
  const displayZoomPct = Math.round(fitScale * zoomMul * 100)

  const selectedText = design.texts.find((t) => t.id === selectedId) ?? null
  const selectedElement = design.elements.find((el) => el.id === selectedId) ?? null
  const selectedBackground = selectedId === THUMBNAIL_BACKGROUND_LAYER_ID
  const backgroundLocked = design.backgroundLocked ?? false
  const backgroundTransform = useMemo(() => resolveBackgroundTransform(design), [design])

  const onUpdateElement = useCallback((id: string, patch: Parameters<typeof updateThumbnailElement>[2]) => {
    patchDesign((d) => updateThumbnailElement(d, id, patch))
  }, [patchDesign])

  const {
    startMove,
    startRotate,
    startResize,
    startResizeMosaicW,
    startResizeMosaicH,
    startResizeMosaicCorner,
  } = useMvpOverlayInteraction(stageRef, onUpdateElement)

  const beginGesture = useCallback(() => {
    pushHistory()
  }, [pushHistory])

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      let bgSt = bgInteractionRef.current
      if (bgSt && bgSt.pointerId === e.pointerId) {
        const stage = stageRef.current
        if (!stage) return
        const rect = stage.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) return

        if (bgSt.kind === "bg-move-pending") {
          const moved = Math.hypot(e.clientX - bgSt.startPx, e.clientY - bgSt.startPy)
          if (moved < BG_DRAG_THRESHOLD_PX) return
          pushHistory()
          bgInteractionRef.current = {
            kind: "bg-move",
            pointerId: bgSt.pointerId,
            startPx: bgSt.startPx,
            startPy: bgSt.startPy,
            startX: bgSt.startX,
            startY: bgSt.startY,
          }
          bgSt = bgInteractionRef.current
        }

        if (bgSt.kind === "bg-move") {
          const dx = ((e.clientX - bgSt.startPx) / rect.width) * 100
          const dy = ((e.clientY - bgSt.startPy) / rect.height) * 100
          patchDesign((d) =>
            updateThumbnailBackgroundTransform(d, {
              x: bgSt.startX + dx,
              y: bgSt.startY + dy,
            })
          )
          return
        }

        if (bgSt.kind === "bg-resize") {
          const dist = Math.hypot(e.clientX - bgSt.centerPx, e.clientY - bgSt.centerPy) || 1
          const scale = Math.round(
            Math.min(400, Math.max(50, bgSt.startScale * (dist / Math.max(bgSt.startDist, 1))))
          )
          patchDesign((d) => updateThumbnailBackgroundTransform(d, { scale }))
        }
        return
      }

      const st = textInteractionRef.current
      if (!st || st.pointerId !== e.pointerId) return
      const stage = stageRef.current
      if (!stage) return
      const rect = stage.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return

      if (st.kind === "move") {
        const dx = ((e.clientX - st.startPx) / rect.width) * 100
        const dy = ((e.clientY - st.startPy) / rect.height) * 100
        patchDesign((d) =>
          updateThumbnailText(d, st.id, {
            x: clampOverlayPct(st.startX + dx),
            y: clampOverlayPct(st.startY + dy),
          })
        )
        return
      }

      if (st.kind === "rotate") {
        const angle = (Math.atan2(e.clientY - st.centerPy, e.clientX - st.centerPx) * 180) / Math.PI
        let rot = st.startRotation + (angle - st.startAngle)
        while (rot > 180) rot -= 360
        while (rot < -180) rot += 360
        patchDesign((d) => updateThumbnailText(d, st.id, { rotation: Math.round(rot) }))
        return
      }

      const dist = Math.hypot(e.clientX - st.centerPx, e.clientY - st.centerPy) || 1
      const scale = dist / Math.max(st.startDist, 1)
      const fontSize = Math.round(Math.min(96, Math.max(18, st.startFontSize * scale)))
      const widthPct = Math.round(Math.min(96, Math.max(24, st.startWidthPct * scale)))
      patchDesign((d) => updateThumbnailText(d, st.id, { fontSize, widthPct }))
    }
    const endDrag = (e: PointerEvent) => {
      const bgSt = bgInteractionRef.current
      if (bgSt && bgSt.pointerId === e.pointerId) bgInteractionRef.current = null
      const st = textInteractionRef.current
      if (st && st.pointerId === e.pointerId) textInteractionRef.current = null
    }
    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", endDrag)
    window.addEventListener("pointercancel", endDrag)
    return () => {
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", endDrag)
      window.removeEventListener("pointercancel", endDrag)
    }
  }, [patchDesign, pushHistory])

  const textCenterPx = useCallback((t: ThumbnailTextLayer) => {
    const stage = stageRef.current
    if (!stage) return null
    const rect = stage.getBoundingClientRect()
    return {
      centerPx: rect.left + (t.x / 100) * rect.width,
      centerPy: rect.top + (t.y / 100) * rect.height,
    }
  }, [])

  const toggleBackgroundLock = useCallback(() => {
    commitDesign((d) => setThumbnailBackgroundLocked(d, !(d.backgroundLocked ?? false)))
  }, [commitDesign])

  const startBackgroundPointer = (e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setSelectedId(THUMBNAIL_BACKGROUND_LAYER_ID)
    if (backgroundLocked || design.aiBaked || brushEraseActive) return
    const bg = resolveBackgroundTransform(design)
    bgInteractionRef.current = {
      kind: "bg-move-pending",
      pointerId: e.pointerId,
      startPx: e.clientX,
      startPy: e.clientY,
      startX: bg.x,
      startY: bg.y,
    }
  }

  const startBackgroundResize = (e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (backgroundLocked) return
    beginGesture()
    setSelectedId(THUMBNAIL_BACKGROUND_LAYER_ID)
    const stage = stageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    const bg = resolveBackgroundTransform(design)
    const centerPx = rect.left + (bg.x / 100) * rect.width
    const centerPy = rect.top + (bg.y / 100) * rect.height
    bgInteractionRef.current = {
      kind: "bg-resize",
      pointerId: e.pointerId,
      centerPx,
      centerPy,
      startDist: Math.hypot(e.clientX - centerPx, e.clientY - centerPy) || 1,
      startScale: bg.scale,
    }
  }

  const startTextMove = (e: React.PointerEvent, t: ThumbnailTextLayer) => {
    e.stopPropagation()
    e.preventDefault()
    beginGesture()
    setSelectedId(t.id)
    textInteractionRef.current = {
      kind: "move",
      id: t.id,
      pointerId: e.pointerId,
      startPx: e.clientX,
      startPy: e.clientY,
      startX: t.x,
      startY: t.y,
    }
  }

  const startTextResize = (e: React.PointerEvent, t: ThumbnailTextLayer) => {
    e.stopPropagation()
    e.preventDefault()
    beginGesture()
    setSelectedId(t.id)
    const center = textCenterPx(t)
    if (!center) return
    const startDist = Math.hypot(e.clientX - center.centerPx, e.clientY - center.centerPy) || 1
    textInteractionRef.current = {
      kind: "resize",
      id: t.id,
      pointerId: e.pointerId,
      centerPx: center.centerPx,
      centerPy: center.centerPy,
      startDist,
      startFontSize: t.fontSize,
      startWidthPct: t.widthPct,
    }
  }

  const startTextRotate = (e: React.PointerEvent, t: ThumbnailTextLayer) => {
    e.stopPropagation()
    e.preventDefault()
    beginGesture()
    setSelectedId(t.id)
    const center = textCenterPx(t)
    if (!center) return
    const startAngle = (Math.atan2(e.clientY - center.centerPy, e.clientX - center.centerPx) * 180) / Math.PI
    textInteractionRef.current = {
      kind: "rotate",
      id: t.id,
      pointerId: e.pointerId,
      centerPx: center.centerPx,
      centerPy: center.centerPy,
      startAngle,
      startRotation: t.rotation,
    }
  }

  const applyTemplate = (templateId: string) => {
    const tpl = THUMBNAIL_TEMPLATES.find((t) => t.id === templateId)
    commitDesign((d) => {
      const hooking = hookingFromThumbnailDesign(d)
      const hasHooking = Boolean(hooking.line1.trim() && hooking.line2.trim())
      const hookingForTpl = hasHooking
        ? hooking
        : {
            line1: tpl?.sampleHook1 ?? hooking.line1,
            line2: tpl?.sampleHook2 ?? hooking.line2,
          }
      const base = d.aiBaked ? exitAiBakedEditMode(d, hookingForTpl) : d
      return applyThumbnailTemplate(base, templateId, hookingForTpl, { textStyleOnly: true })
    })
    setSelectedId(null)
  }

  const currentHookingForAi = useMemo((): MvpThumbnailHookingText => {
    const fromDesign = hookingFromThumbnailDesign(design)
    return {
      line1: fromDesign.line1.trim() || hookingText.line1.trim(),
      line2: fromDesign.line2.trim() || hookingText.line2.trim(),
    }
  }, [design, hookingText.line1, hookingText.line2])

  const generateFullThumbnailWithAi = useCallback(async () => {
    const replicateKey = shotformReplicateKey()
    if (!replicateKey) {
      setErr("Replicate API 키(shotform_replicate_api_key)를 ShotForm 설정에 저장해 주세요.")
      return
    }
    const refUrl = aiReferenceUrl(referenceImageUrl, design.backgroundUrl)
    if (!refUrl) {
      setErr("제품 참조 이미지가 필요합니다. 배경 탭에서 짜집기 프레임을 고르거나 이미지를 업로드하세요.")
      return
    }

    setFullThumbGenerating(true)
    setErr(null)
    try {
      let text: MvpThumbnailHookingText = { ...currentHookingForAi }
      if (!text.line1 || !text.line2) {
        const hookRes = await fetch("/api/shotform/mvp-thumbnail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            openaiApiKey: shotformOpenAIKey() || undefined,
            productName,
            generateHookingOnly: true,
          }),
        })
        const hookData = (await hookRes.json()) as { hookingText?: MvpThumbnailHookingText; error?: string }
        if (!hookRes.ok) throw new Error(hookData.error || "후킹 문구 생성 실패")
        if (hookData.hookingText) text = hookData.hookingText
      }

      const productImageBase64 = await referenceImageForApi(refUrl)
      const res = await fetch("/api/shotform/mvp-thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openaiApiKey: shotformOpenAIKey() || undefined,
          replicateApiKey: replicateKey,
          productName,
          productImageBase64,
          hookingText: text,
        }),
      })
      const data = (await res.json()) as {
        thumbnailUrl?: string
        hookingText?: MvpThumbnailHookingText
        error?: string
      }
      if (!res.ok) throw new Error(data.error || "AI 썸네일 생성 실패")
      if (!data.thumbnailUrl?.trim()) throw new Error("AI 썸네일 URL을 받지 못했습니다.")

      const finalHooking = data.hookingText ?? text
      const nextUrl = data.thumbnailUrl.trim()
      commitDesign((d) => applyFullAiThumbnail(d, nextUrl, finalHooking))
      setBgUrlDraft(nextUrl)
      setSelectedId(null)
      setSideTab("ai")
    } catch (e) {
      setErr(e instanceof Error ? e.message : "AI 썸네일 생성 실패")
    } finally {
      setFullThumbGenerating(false)
    }
  }, [currentHookingForAi, design.backgroundUrl, productName, referenceImageUrl])

  const applyBrushInpaint = useCallback(async () => {
    if (!design.backgroundUrl || design.aiBaked) {
      setErr("배경 이미지가 필요합니다.")
      return
    }
    const previewCanvas = brushEraseRef.current?.getPreviewCanvas()
    if (!previewCanvas || !brushEraseRef.current?.hasStrokes()) {
      setErr("지울 영역을 붓으로 칠해 주세요.")
      return
    }

    setInpaintLoading(true)
    setErr(null)
    try {
      const bgCanvas = await renderBackgroundToCanvas(
        design.backgroundUrl,
        backgroundTransform,
        design.filter,
        THUMBNAIL_EXPORT_W,
        THUMBNAIL_EXPORT_H
      )
      const filledUrl = localInpaintMaskedRegion(
        bgCanvas,
        previewCanvas,
        THUMBNAIL_EXPORT_W,
        THUMBNAIL_EXPORT_H
      )
      commitDesign((d) => setThumbnailBackground(d, filledUrl))
      setBgUrlDraft(filledUrl)
      brushEraseRef.current?.clear()
      setBrushEraseActive(false)
      setSelectedId(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "선택 영역 지우기 실패")
    } finally {
      setInpaintLoading(false)
    }
  }, [backgroundTransform, commitDesign, design.aiBaked, design.backgroundUrl, design.filter])

  const generateBackgroundWithAi = useCallback(async () => {
    const replicateKey = shotformReplicateKey()
    if (!replicateKey) {
      setErr("Replicate API 키(shotform_replicate_api_key)를 ShotForm 설정에 저장해 주세요.")
      return
    }
    const refUrl = aiReferenceUrl(referenceImageUrl, design.backgroundUrl)
    if (!refUrl) {
      setErr("제품 참조 이미지가 필요합니다. 배경 탭에서 짜집기 프레임을 고르거나 이미지를 업로드하세요.")
      return
    }

    setBgGenerating(true)
    setErr(null)
    try {
      const productImageBase64 = await referenceImageForApi(refUrl)
      const res = await fetch("/api/shotform/mvp-thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replicateApiKey: replicateKey,
          productName,
          productImageBase64,
          generateBackgroundOnly: true,
        }),
      })
      const data = (await res.json()) as { backgroundUrl?: string; error?: string }
      if (!res.ok) throw new Error(data.error || "AI 배경 생성 실패")
      if (!data.backgroundUrl?.trim()) throw new Error("AI 배경 URL을 받지 못했습니다.")
      const persistedUrl = await persistImageUrlAsDataUrl(data.backgroundUrl.trim())
      commitDesign((d) => {
        let next = applyAiGeneratedBackground(d, persistedUrl)
        if (d.aiBaked) {
          next = applyThumbnailTemplate(next, next.templateId, hookingFromThumbnailDesign(d), {
            withElements: false,
          })
        }
        return next
      })
      setBgUrlDraft(persistedUrl)
      setSelectedId(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "AI 배경 생성 실패")
    } finally {
      setBgGenerating(false)
    }
  }, [design.backgroundUrl, productName, referenceImageUrl])

  const rewriteTextWithAi = useCallback(
    async (textLayer: ThumbnailTextLayer) => {
      setAiTextLoadingId(textLayer.id)
      setErr(null)
      try {
        const otherLines = design.texts.filter((t) => t.id !== textLayer.id).map((t) => t.text)
        const res = await fetch("/api/shotform/mvp-thumbnail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            openaiApiKey: shotformOpenAIKey() || undefined,
            productName,
            rewriteTextOnly: true,
            currentText: textLayer.text,
            textRole: textLayer.role,
            otherLines,
          }),
        })
        const data = (await res.json()) as { text?: string; error?: string }
        if (!res.ok) throw new Error(data.error || "AI 문구 변환 실패")
        if (!data.text?.trim()) throw new Error("AI가 문구를 생성하지 못했습니다.")
        commitDesign((d) => updateThumbnailText(d, textLayer.id, { text: data.text!.trim() }))
      } catch (e) {
        setErr(e instanceof Error ? e.message : "AI 문구 변환 실패")
      } finally {
        setAiTextLoadingId(null)
      }
    },
    [design.texts, productName]
  )

  const duplicateSelected = useCallback(() => {
    if (!selectedId) return
    commitDesign((d) => {
      if (d.texts.some((t) => t.id === selectedId)) {
        const next = duplicateThumbnailText(d, selectedId)
        const copy = next.texts[next.texts.length - 1]
        if (copy) setSelectedId(copy.id)
        return next
      }
      if (d.elements.some((el) => el.id === selectedId)) {
        const next = duplicateThumbnailElement(d, selectedId)
        const copy = next.elements[next.elements.length - 1]
        if (copy) setSelectedId(copy.id)
        return next
      }
      return d
    })
  }, [selectedId, commitDesign])

  const deleteSelected = useCallback(() => {
    if (!selectedId || selectedId === THUMBNAIL_BACKGROUND_LAYER_ID) return
    commitDesign((d) => removeThumbnailLayer(d, selectedId))
    setSelectedId(null)
  }, [selectedId, commitDesign])

  const cutSelected = useCallback(() => {
    if (!selectedId) return
    const text = design.texts.find((t) => t.id === selectedId)
    const el = design.elements.find((e) => e.id === selectedId)
    if (text) clipboardRef.current = { kind: "text", layer: { ...text } }
    else if (el) clipboardRef.current = { kind: "element", layer: { ...el } }
    else return
    commitDesign((d) => removeThumbnailLayer(d, selectedId))
    setSelectedId(null)
  }, [selectedId, design.texts, design.elements, commitDesign])

  const pasteFromClipboard = useCallback(() => {
    const item = clipboardRef.current
    if (!item) return
    const newId = item.kind === "text" ? `txt_${Date.now()}` : `el_${Date.now()}`
    commitDesign((d) => {
      if (item.kind === "text") {
        const copy: ThumbnailTextLayer = {
          ...item.layer,
          id: newId,
          role: "custom",
          x: clampOverlayPct(item.layer.x + 3),
          y: clampOverlayPct(item.layer.y + 2),
        }
        return { ...d, texts: [...d.texts, copy] }
      }
      const copy: PlacedStudioOverlay = {
        ...item.layer,
        id: newId,
        x: clampOverlayPct(item.layer.x + 3),
        y: clampOverlayPct(item.layer.y + 2),
      }
      return { ...d, elements: [...d.elements, copy] }
    })
    setSelectedId(newId)
  }, [commitDesign])

  const handleUndo = useCallback(() => {
    const prevSelected = selectedId
    const restored = undo()
    if (!restored) return
    if (
      prevSelected &&
      !restored.texts.some((t) => t.id === prevSelected) &&
      !restored.elements.some((el) => el.id === prevSelected)
    ) {
      setSelectedId(null)
    }
  }, [selectedId, undo])

  const beginSliderSession = useCallback(
    (key: string) => {
      if (sliderSessionRef.current !== key) {
        pushHistory()
        sliderSessionRef.current = key
      }
    },
    [pushHistory]
  )

  const endSliderSession = useCallback(() => {
    sliderSessionRef.current = null
  }, [])

  const beginEditSession = useCallback(
    (key: string) => {
      if (editSessionRef.current !== key) {
        pushHistory()
        editSessionRef.current = key
      }
    },
    [pushHistory]
  )

  const endEditSession = useCallback(() => {
    editSessionRef.current = null
  }, [])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditingField(e.target)) return

      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()

      if (mod && key === "z" && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
        return
      }

      if (mod && key === "x") {
        e.preventDefault()
        cutSelected()
        return
      }

      if (mod && key === "v") {
        e.preventDefault()
        pasteFromClipboard()
        return
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault()
        deleteSelected()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, selectedId, handleUndo, cutSelected, pasteFromClipboard, deleteSelected])

  const handleApply = async () => {
    const stage = stageRef.current
    if (!stage) return
    setExporting(true)
    setErr(null)
    try {
      const dataUrl = await exportThumbnailStageToDataUrl(stage)
      onApply(dataUrl, hookingFromThumbnailDesign(design), design)
      onOpenChange(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "썸네일 저장 실패")
    } finally {
      setExporting(false)
    }
  }

  const filterCss = useMemo(() => {
    const f = design.filter
    return {
      filter: `blur(${f.blur}px) brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturate}%)`,
    }
  }, [design.filter])

  const isFilterDefault = useMemo(() => {
    const def = defaultThumbnailFilter()
    return (Object.keys(def) as Array<keyof ThumbnailFilterState>).every((key) => design.filter[key] === def[key])
  }, [design.filter])

  const resetFilter = useCallback(() => {
    commitDesign((d) => ({ ...d, filter: defaultThumbnailFilter() }))
  }, [commitDesign])

  const filteredElements = useMemo(() => {
    const q = elementQuery.trim().toLowerCase()
    if (!q) return STUDIO_OVERLAY_CATALOG
    return STUDIO_OVERLAY_CATALOG.filter(
      (e) => e.label.toLowerCase().includes(q) || e.category.includes(q)
    )
  }, [elementQuery])

  const addCustomText = () => {
    const t: ThumbnailTextLayer = {
      id: `txt_${Date.now()}`,
      role: "custom",
      text: "새 텍스트",
      x: 50,
      y: 30,
      fontSize: 36,
      fontWeight: 800,
      color: "#ffffff",
      strokeOn: true,
      strokeColor: "#000000",
      strokeWidth: THUMBNAIL_DEFAULT_STROKE_WIDTH,
      strokePadH: 0,
      shadow: true,
      letterSpacing: -0.5,
      rotation: 0,
      align: "center",
      bgOn: false,
      bgColor: "#000000",
      bgOpacity: 70,
      widthPct: 80,
    }
    commitDesign((d) => ({ ...d, texts: [...d.texts, t] }))
    setSelectedId(t.id)
    setSideTab("text")
  }

  const toggleFlag = (key: "strokeOn" | "shadow" | "bgOn", val: boolean) => {
    if (!selectedText) return
    commitDesign((d) => updateThumbnailText(d, selectedText.id, { [key]: val }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 z-[200] bg-black/85" />
        <DialogPrimitive.Content
          className="dark fixed inset-0 z-[201] flex h-screen max-h-screen w-screen max-w-none flex-col bg-[#0a0c10] outline-none"
          onInteractOutside={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogTitle className="sr-only">썸네일 스튜디오</DialogTitle>

          {/* 상단 — 캔바/미리캔버스 스타일 툴바 */}
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-black/[0.08] bg-white px-4 dark:border-white/[0.08] dark:bg-[#0c0f16]">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-9 text-slate-600 dark:text-slate-400"
                onClick={() => onOpenChange(false)}
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                나가기
              </Button>
              <div className="hidden h-5 w-px bg-black/10 dark:bg-white/10 sm:block" />
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">썸네일 스튜디오</p>
                <p className="text-[10px] text-slate-500">9:16 · {productName}</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9"
                disabled={!canUndo}
                onClick={handleUndo}
                title="실행 취소 (Ctrl+Z)"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9"
                disabled={!selectedId}
                onClick={cutSelected}
                title="잘라내기 (Ctrl+X)"
              >
                <Scissors className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9"
                disabled={!selectedId}
                onClick={duplicateSelected}
                title="복제"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9 text-rose-500"
                disabled={!selectedId}
                onClick={deleteSelected}
                title="삭제 (Delete)"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <div className="mx-2 hidden h-6 w-px bg-black/10 dark:bg-white/10 sm:block" />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9"
                onClick={() => setZoomMul(1)}
                title="화면에 맞추기"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9"
                onClick={() => setZoomMul((z) => Math.max(0.5, z - 0.1))}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="min-w-[3rem] text-center text-xs text-slate-500">{displayZoomPct}%</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9"
                onClick={() => setZoomMul((z) => Math.min(1.8, z + 0.1))}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                className={cn("ml-3 h-9 px-4", studio.btnPrimary)}
                disabled={exporting || !design.backgroundUrl}
                onClick={() => void handleApply()}
              >
                {exporting ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-1.5 h-4 w-4" />
                )}
                적용하기
              </Button>
            </div>
          </header>

          {err ? (
            <p className="shrink-0 bg-rose-100 px-4 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {err}
            </p>
          ) : null}

          <div className="flex min-h-0 flex-1">
            {/* 왼쪽 아이콘 레일 — 미리캔버스 스타일 */}
            <nav className="flex w-[72px] shrink-0 flex-col items-center gap-1 border-r border-black/[0.06] bg-white py-3 dark:border-white/[0.06] dark:bg-[#0c0f16]">
              {SIDE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  title={tab.label}
                  onClick={() => setSideTab(tab.id)}
                  className={cn(
                    "flex w-[60px] flex-col items-center gap-1 rounded-xl py-2.5 text-[10px] font-medium transition",
                    sideTab === tab.id
                      ? "bg-violet-500/15 text-violet-600 dark:bg-violet-500/20 dark:text-violet-200"
                      : "text-slate-500 hover:bg-black/[0.04] hover:text-slate-800 dark:hover:bg-white/[0.06] dark:hover:text-slate-200"
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>

            {/* 왼쪽 패널 */}
            <aside className="flex w-[280px] shrink-0 flex-col border-r border-black/[0.06] bg-white dark:border-white/[0.06] dark:bg-[#0c0f16]">
              <div className="flex-1 overflow-y-auto p-4">
                {sideTab === "template" ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-white">디자인 템플릿</p>
                      <p className="mt-0.5 text-[9px] leading-relaxed text-slate-500">
                        실제 쇼츠 레퍼런스 4종 · 후킹 2줄 위치·색상만 적용합니다 (배경·요소 유지).
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {THUMBNAIL_TEMPLATES.map((tpl) => (
                          <ThumbnailTemplatePreview
                            key={tpl.id}
                            preview={tpl.preview}
                            hook1={tpl.sampleHook1}
                            hook2={tpl.sampleHook2}
                            hook1Color={tpl.sampleHook1Color}
                            hook2Color={tpl.sampleHook2Color}
                            label={tpl.label}
                            description={tpl.description}
                            selected={design.templateId === tpl.id}
                            onClick={() => applyTemplate(tpl.id)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                {sideTab === "text" ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-800 dark:text-white">텍스트</p>
                      <Button type="button" size="sm" className="h-7 text-xs" onClick={addCustomText}>
                        + 추가
                      </Button>
                    </div>
                    {design.texts.map((t) => (
                      <div
                        key={t.id}
                        className={cn(
                          "flex items-center gap-1 rounded-lg border px-2 py-2 transition",
                          selectedId === t.id
                            ? "border-violet-400 bg-violet-500/10"
                            : "border-black/10 hover:bg-black/[0.03] dark:border-white/10"
                        )}
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => setSelectedId(t.id)}
                        >
                          <span className="text-[9px] text-slate-500">{textRoleLabel(t.role)}</span>
                          <p className="mt-0.5 truncate text-sm font-medium text-slate-900 dark:text-white">
                            {t.text || "(비어 있음)"}
                          </p>
                        </button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          title="AI 문구 변환"
                          className="h-8 shrink-0 px-2 text-[10px] text-violet-500 hover:bg-violet-500/10 hover:text-violet-400"
                          disabled={aiTextLoadingId === t.id}
                          onClick={() => void rewriteTextWithAi(t)}
                        >
                          {aiTextLoadingId === t.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {sideTab === "elements" ? (
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      <Input
                        className="h-9 border-black/10 bg-slate-50 pl-8 text-xs dark:border-white/10 dark:bg-black/30"
                        placeholder="요소 검색"
                        value={elementQuery}
                        onChange={(e) => setElementQuery(e.target.value)}
                      />
                    </div>
                    {STUDIO_OVERLAY_CATEGORIES.map((cat) => {
                      const items = filteredElements.filter((e) => e.category === cat.id)
                      if (!items.length) return null
                      return (
                        <div key={cat.id}>
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                            {cat.label}
                          </p>
                          <div className="grid grid-cols-4 gap-2">
                            {items.map((entry) => (
                              <button
                                key={entry.id}
                                type="button"
                                title={entry.label}
                                onClick={() => {
                                  commitDesign((d) => {
                                    const next = addThumbnailElement(d, entry.id)
                                    const added = next.elements[next.elements.length - 1]
                                    if (added) setSelectedId(added.id)
                                    return next
                                  })
                                }}
                                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-black/10 bg-slate-50 text-slate-600 transition hover:border-violet-300 hover:bg-violet-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                              >
                                {entry.Icon ? (
                                  <entry.Icon className="h-6 w-6" strokeWidth={entry.kind === "mosaic" ? 1.75 : 2} />
                                ) : entry.kind === "rounded-rect" ? (
                                  <span className="h-5 w-7 rounded-md border-2 border-current" />
                                ) : (
                                  <span className="text-xs">●</span>
                                )}
                                <span className="max-w-full truncate px-0.5 text-[8px]">{entry.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : null}

                {sideTab === "background" ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-white">배경</p>
                      <p className="mt-0.5 text-[9px] leading-relaxed text-slate-500">
                        짜집기 영상 프레임·업로드 이미지로 캔버스 배경과 AI 참조를 설정합니다. 적용 후 캔버스에서
                        배경을 클릭해 확대·축소·이동할 수 있습니다.
                      </p>
                      {design.backgroundUrl && !design.aiBaked ? (
                        <div className="mt-2 flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className={cn(
                              "h-8 flex-1 text-[10px]",
                              selectedBackground &&
                                !backgroundLocked &&
                                "border-cyan-500/50 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200"
                            )}
                            onClick={() => setSelectedId(THUMBNAIL_BACKGROUND_LAYER_ID)}
                          >
                            <Maximize2 className="mr-1.5 h-3.5 w-3.5" />
                            배경 편집
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            title={backgroundLocked ? "배경 고정 해제" : "배경 위치·크기 고정"}
                            className={cn(
                              "h-8 shrink-0 px-3 text-[10px] font-semibold shadow-sm",
                              backgroundLocked
                                ? "border-amber-400 bg-amber-500/25 text-amber-900 dark:border-amber-400 dark:bg-amber-500/30 dark:text-amber-50"
                                : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-white/35 dark:bg-white/12 dark:text-white dark:hover:bg-white/18"
                            )}
                            onClick={toggleBackgroundLock}
                          >
                            {backgroundLocked ? (
                              <Lock className="h-4 w-4" />
                            ) : (
                              <LockOpen className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      ) : null}
                      {backgroundLocked && design.backgroundUrl && !design.aiBaked ? (
                        <p className="mt-1.5 text-[9px] text-amber-600/90 dark:text-amber-300/80">
                          배경이 고정되어 있습니다. 자물쇠 버튼을 눌러 이동·확대를 다시 켜세요.
                        </p>
                      ) : null}
                    </div>

                    {design.backgroundUrl && !design.aiBaked ? (
                      <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3">
                        <p className="text-[10px] font-semibold text-rose-200/90">붓으로 선택 지우기</p>
                        <p className="mt-1 text-[9px] leading-relaxed text-slate-500">
                          중국어 자막·워터마크 등 글자 부분만 붓으로 칠한 뒤 「선택 영역 지우기」를 누르세요. 칠한
                          영역만 주변 배경 색으로 채워지고 나머지는 그대로 유지됩니다.
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className={cn(
                            "mt-2 h-9 w-full text-[11px] font-semibold shadow-sm",
                            brushEraseActive
                              ? "border-rose-500 bg-rose-600 text-white hover:bg-rose-500 dark:border-rose-400 dark:bg-rose-500 dark:hover:bg-rose-400"
                              : "border-rose-300 bg-white text-rose-800 hover:bg-rose-50 dark:border-rose-400/70 dark:bg-rose-500/20 dark:text-rose-50 dark:hover:bg-rose-500/30"
                          )}
                          disabled={inpaintLoading}
                          onClick={() => {
                            setBrushEraseActive((v) => !v)
                            setSelectedId(null)
                          }}
                        >
                          <Paintbrush className="mr-1.5 h-4 w-4 shrink-0" />
                          {brushEraseActive ? "붓 모드 끄기" : "붓 모드 켜기"}
                        </Button>
                        {brushEraseActive ? (
                          <>
                            <div className="mt-3 space-y-1.5">
                              <Label className="text-[10px] text-slate-500">붓 크기 · {brushSize}px</Label>
                              <Slider
                                min={8}
                                max={72}
                                step={2}
                                value={[brushSize]}
                                onValueChange={([v]) => setBrushSize(v ?? brushSize)}
                              />
                            </div>
                            <div className="mt-3 flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 flex-1 border-slate-300 text-[10px] font-medium text-slate-700 dark:border-white/30 dark:bg-white/8 dark:text-white"
                                disabled={inpaintLoading}
                                onClick={() => brushEraseRef.current?.clear()}
                              >
                                칠한 영역 초기화
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                className="h-8 flex-1 bg-rose-600 text-[10px] text-white hover:bg-rose-500"
                                disabled={inpaintLoading}
                                onClick={() => void applyBrushInpaint()}
                              >
                                {inpaintLoading ? (
                                  <>
                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    지우는 중…
                                  </>
                                ) : (
                                  "선택 영역 지우기"
                                )}
                              </Button>
                            </div>
                          </>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3">
                      <p className="text-[10px] font-semibold text-cyan-200/90">짜집기 영상 프레임</p>
                      <p className="mt-1 text-[9px] leading-relaxed text-slate-500">
                        제품이 잘 나온 장면을 고르면 배경·AI 참조에 함께 적용됩니다.
                      </p>
                      <div className="mt-2">
                        <MvpThumbnailFramePicker
                          frames={videoFrames}
                          selectedId={selectedVideoFrameId}
                          compact
                          onSelect={(frame) => {
                            onSelectVideoFrame?.(frame)
                            commitDesign((d) => setThumbnailBackground(d, frame.dataUrl))
                            setBgUrlDraft(frame.dataUrl)
                          }}
                        />
                      </div>
                    </div>

                    <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-violet-300/50 bg-violet-50/50 px-4 py-8 text-center transition hover:bg-violet-50 dark:border-violet-500/30 dark:bg-violet-500/5">
                      <Upload className="h-8 w-8 text-violet-500" />
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">이미지 업로드</span>
                      <span className="text-[10px] text-slate-500">PNG, JPG · 9:16 권장</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          const reader = new FileReader()
                          reader.onload = () => {
                            const url = String(reader.result ?? "")
                            commitDesign((d) => setThumbnailBackground(d, url))
                            setBgUrlDraft(url)
                          }
                          reader.readAsDataURL(file)
                        }}
                      />
                    </label>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-slate-500">이미지 URL</Label>
                      <div className="flex gap-2">
                        <Input
                          className="h-9 text-xs"
                          placeholder="https://..."
                          value={bgUrlDraft}
                          onChange={(e) => setBgUrlDraft(e.target.value)}
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="h-9 shrink-0"
                          onClick={() => commitDesign((d) => setThumbnailBackground(d, bgUrlDraft))}
                        >
                          적용
                        </Button>
                      </div>
                    </div>
                    {design.backgroundUrl ? (
                      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-xl border bg-black">
                        <img
                          src={design.backgroundUrl}
                          alt="배경 미리보기"
                          className="absolute max-w-none"
                          style={thumbnailBackgroundImageStyle(backgroundTransform, filterCss)}
                        />
                      </div>
                    ) : null}

                    <AiBackgroundHistoryGrid
                      urls={design.aiBackgroundHistory ?? []}
                      activeUrl={design.backgroundUrl}
                      onSelect={(url) => {
                        commitDesign((d) => setThumbnailBackground(d, url))
                        setBgUrlDraft(url)
                        setSelectedId(null)
                      }}
                    />
                  </div>
                ) : null}

                {sideTab === "ai" ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-white">AI 생성</p>
                      <p className="mt-0.5 text-[9px] leading-relaxed text-slate-500">
                        배경 탭에서 고른 참조 이미지로 Replicate AI 썸네일을 생성합니다.
                      </p>
                    </div>

                    <div className="rounded-xl border border-violet-500/35 bg-gradient-to-br from-violet-500/15 via-transparent to-fuchsia-500/5 p-3">
                      <p className="text-[10px] font-semibold text-violet-200">쇼핑숏폼 AI 썸네일 (전체)</p>
                      <p className="mt-1 text-[9px] leading-relaxed text-slate-500">
                        쇼핑숏폼과 동일한 Replicate 프롬프트로 후킹 2줄·제품 장면·빨간 화살표까지 한 번에 합성합니다.
                      </p>
                      {(currentHookingForAi.line1 || currentHookingForAi.line2) ? (
                        <div className="mt-2 space-y-0.5 rounded-lg border border-white/10 bg-black/30 px-2.5 py-2">
                          <p className="text-[10px] font-bold text-white">{currentHookingForAi.line1 || "—"}</p>
                          <p className="text-[10px] font-bold text-teal-300">{currentHookingForAi.line2 || "—"}</p>
                          <p className="text-[8px] text-slate-500">비어 있으면 AI가 후킹 문구를 먼저 생성합니다.</p>
                        </div>
                      ) : (
                        <p className="mt-2 text-[9px] text-slate-500">후킹 문구가 없으면 GPT로 자동 생성 후 합성합니다.</p>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        className="mt-2.5 h-8 w-full bg-violet-600 text-[11px] text-white hover:bg-violet-500"
                        disabled={fullThumbGenerating || bgGenerating || !design.backgroundUrl}
                        onClick={() => void generateFullThumbnailWithAi()}
                      >
                        {fullThumbGenerating ? (
                          <>
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            썸네일 생성 중… (1~2분)
                          </>
                        ) : (
                          <>
                            <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
                            AI 썸네일 전체 생성
                          </>
                        )}
                      </Button>
                    </div>

                    {design.aiBaked ? (
                      <div className="rounded-lg border border-violet-400/40 bg-violet-500/10 px-3 py-2.5">
                        <p className="text-[10px] font-semibold text-violet-200">AI 합성 썸네일 적용됨</p>
                        <p className="mt-1 text-[9px] leading-relaxed text-slate-500">
                          텍스트·화살표가 이미지에 포함되어 있습니다. 레이어 편집은 「편집 모드」로 전환하세요.
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="mt-2 h-7 w-full border-violet-400/40 text-[10px]"
                          onClick={() => {
                            commitDesign((d) => exitAiBakedEditMode(d))
                            setSelectedId(null)
                          }}
                        >
                          편집 모드로 전환
                        </Button>
                      </div>
                    ) : null}

                    <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-transparent to-violet-500/5 p-3">
                      <p className="text-[10px] font-semibold text-amber-200/90">AI 이미지만 생성</p>
                      <p className="mt-1 text-[9px] leading-relaxed text-slate-500">
                        배경 탭에서 고른 참조 이미지를 기준으로, 같은 제품 형태를 유지한 채 사용 장면 사진만 새로
                        만듭니다. 텍스트·화살표는 넣지 않습니다.
                      </p>
                      {referenceImageUrl ? (
                        <p className="mt-1.5 text-[9px] text-emerald-400/90">✓ 배경·참조 이미지 연결됨</p>
                      ) : (
                        <p className="mt-1.5 text-[9px] text-amber-400/90">
                          참조 없음 — 배경 탭에서 짜집기 프레임을 고르거나 이미지를 업로드하세요.
                        </p>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        className="mt-2.5 h-8 w-full bg-amber-600 text-[11px] text-white hover:bg-amber-500"
                        disabled={bgGenerating || fullThumbGenerating || !design.backgroundUrl}
                        onClick={() => void generateBackgroundWithAi()}
                      >
                        {bgGenerating ? (
                          <>
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            배경 생성 중… (1~2분)
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                            AI 이미지만 생성
                          </>
                        )}
                      </Button>
                    </div>

                    <AiBackgroundHistoryGrid
                      urls={design.aiBackgroundHistory ?? []}
                      activeUrl={design.backgroundUrl}
                      onSelect={(url) => {
                        commitDesign((d) => setThumbnailBackground(d, url))
                        setBgUrlDraft(url)
                        setSelectedId(null)
                      }}
                    />
                  </div>
                ) : null}

                {sideTab === "filter" ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-slate-800 dark:text-white">사진 필터</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 shrink-0 px-2 text-[10px] text-slate-400 hover:text-slate-200 disabled:opacity-40"
                        disabled={isFilterDefault}
                        onClick={resetFilter}
                      >
                        <RotateCcw className="mr-1 h-3 w-3" />
                        초기화
                      </Button>
                    </div>
                    {(
                      [
                        ["blur", "블러", 0, 12],
                        ["brightness", "밝기", 70, 130],
                        ["contrast", "대비", 80, 130],
                        ["saturate", "채도", 80, 140],
                        ["vignette", "비네팅", 0, 60],
                        ["gradientOpacity", "상단 그라데이션", 0, 80],
                      ] as const
                    ).map(([key, label, min, max]) => {
                      const val = design.filter[key]
                      return (
                        <div key={key} className="space-y-1.5">
                          <div className="flex justify-between text-[10px] text-slate-500">
                            <span>{label}</span>
                            <span>{val}</span>
                          </div>
                          <Slider
                            min={min}
                            max={max}
                            step={1}
                            value={[val]}
                            onValueChange={([v]) => {
                              beginSliderSession(`filter-${key}`)
                              patchDesign((d) => ({
                                ...d,
                                filter: {
                                  ...d.filter,
                                  [key]: v ?? val,
                                  ...(key === "gradientOpacity" && (v ?? 0) > 0 ? { gradientTop: true } : {}),
                                },
                              }))
                            }}
                            onValueCommit={endSliderSession}
                          />
                        </div>
                      )
                    })}
                  </div>
                ) : null}

              </div>
            </aside>

            {/* 중앙 캔버스 — 크게 */}
            <div
              ref={canvasAreaRef}
              className="relative flex min-w-0 flex-1 items-center justify-center overflow-auto bg-[#080a0f]"
              style={{
                backgroundImage:
                  "linear-gradient(45deg,#141820 25%,transparent 25%),linear-gradient(-45deg,#141820 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#141820 75%),linear-gradient(-45deg,transparent 75%,#141820 75%)",
                backgroundSize: "20px 20px",
                backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0",
              }}
              onPointerDown={() => setSelectedId(null)}
            >
              <div
                ref={stageRef}
                data-thumbnail-stage
                className="relative shrink-0 overflow-hidden rounded-sm bg-black shadow-[0_12px_48px_rgba(0,0,0,0.55)] ring-1 ring-white/10"
                style={{
                  width: `${stagePxW}px`,
                  aspectRatio: "9/16",
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {design.backgroundUrl ? (
                  <div
                    className={cn(
                      "absolute inset-0 z-0 touch-none select-none",
                      !design.aiBaked &&
                        !backgroundLocked &&
                        !brushEraseActive &&
                        "cursor-grab active:cursor-grabbing"
                    )}
                    onPointerDown={startBackgroundPointer}
                  >
                    <img
                      src={design.backgroundUrl}
                      alt=""
                      className="pointer-events-none max-w-none"
                      style={thumbnailBackgroundImageStyle(backgroundTransform, filterCss)}
                      crossOrigin="anonymous"
                      draggable={false}
                    />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-800 text-sm text-slate-500">
                    <ImageIcon className="mr-2 h-5 w-5" />
                    배경 탭에서 이미지를 설정하세요
                  </div>
                )}

                {design.backgroundUrl && !design.aiBaked ? (
                  <ThumbnailBrushEraseLayer
                    ref={brushEraseRef}
                    active={brushEraseActive}
                    brushSize={brushSize}
                    width={stagePxW}
                    height={stagePxH}
                  />
                ) : null}

                {brushEraseActive ? (
                  <div className="pointer-events-none absolute inset-x-0 top-2 z-[6] flex justify-center">
                    <span className="rounded-full bg-rose-600/90 px-3 py-1 text-[10px] font-medium text-white shadow">
                      지울 영역을 붓으로 칠하세요
                    </span>
                  </div>
                ) : null}

                {design.filter.gradientTop && design.filter.gradientOpacity > 0 ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 z-[1]"
                    style={{
                      height: "45%",
                      background: `linear-gradient(180deg, rgba(0,0,0,${
                        design.filter.gradientOpacity / 100
                      }) 0%, transparent 100%)`,
                    }}
                  />
                ) : null}

                {design.filter.vignette > 0 ? (
                  <div
                    className="pointer-events-none absolute inset-0 z-[2]"
                    style={{
                      background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${
                        design.filter.vignette / 100
                      }) 100%)`,
                    }}
                  />
                ) : null}

                {selectedBackground && design.backgroundUrl && !design.aiBaked && !brushEraseActive ? (
                  <div
                    className={cn(
                      "pointer-events-none absolute inset-0 z-[3] ring-2 ring-offset-0",
                      backgroundLocked ? "ring-amber-400/80" : "ring-cyan-400"
                    )}
                  >
                    {!backgroundLocked ? (
                      <CornerResizeHandles accent="cyan" onStartResize={(e) => startBackgroundResize(e)} />
                    ) : (
                      <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 rounded-full bg-amber-600/90 px-2 py-0.5 text-[9px] font-medium text-white shadow">
                        <Lock className="h-3 w-3" />
                        고정됨
                      </div>
                    )}
                  </div>
                ) : null}

                {!design.aiBaked
                  ? design.texts.map((t) => {
                  const selected = selectedId === t.id
                  return (
                    <div
                      key={t.id}
                      className="absolute z-[4] touch-none select-none"
                      style={{
                        left: `${t.x}%`,
                        top: `${t.y}%`,
                        transform: thumbnailTextAnchorTransform(t.align, t.rotation),
                        width: `${t.widthPct}%`,
                      }}
                    >
                      <div
                        className={cn(
                          "relative min-h-[1em] cursor-grab active:cursor-grabbing",
                          selected && "ring-2 ring-violet-500 ring-offset-2 ring-offset-transparent"
                        )}
                        onPointerDown={(e) => startTextMove(e, t)}
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          void rewriteTextWithAi(t)
                        }}
                      >
                        <ThumbnailTextLayerContent layer={t} />
                        {selected ? (
                          <>
                            <button
                              type="button"
                              title="AI 문구 변환"
                              className="absolute -top-9 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border border-violet-400/60 bg-[#0c0f16]/95 px-2.5 py-1 text-[10px] font-medium text-violet-200 shadow-lg backdrop-blur-sm pointer-events-auto"
                              disabled={aiTextLoadingId === t.id}
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation()
                                void rewriteTextWithAi(t)
                              }}
                            >
                              {aiTextLoadingId === t.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Sparkles className="h-3 w-3" />
                              )}
                              AI 변환
                            </button>
                            <CornerResizeHandles onStartResize={(e) => startTextResize(e, t)} />
                            <div className="absolute left-1/2 top-full z-30 mt-2 flex -translate-x-1/2 flex-col items-center pointer-events-auto">
                              <button
                                type="button"
                                title="회전"
                                className="flex h-6 w-6 cursor-grab items-center justify-center rounded-full border-2 border-violet-500 bg-white text-[10px] text-violet-600 shadow active:cursor-grabbing"
                                onPointerDown={(e) => startTextRotate(e, t)}
                              >
                                ↻
                              </button>
                            </div>
                          </>
                        ) : null}
                      </div>
                    </div>
                  )
                })
                  : null}

                {!design.aiBaked
                  ? design.elements.map((ov) => {
                  const selected = selectedId === ov.id
                  const mosaic = isMosaicOverlay(ov.catalogId)
                  const mosaicDims = mosaic ? mosaicOverlayDimensions(ov) : null
                  const boxW = mosaicDims?.w ?? ov.size
                  const boxH = mosaicDims?.h ?? ov.size
                  return (
                    <div
                      key={ov.id}
                      className="absolute z-[5] touch-none select-none"
                      style={{
                        left: `${ov.x}%`,
                        top: `${ov.y}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation()
                        setSelectedId(ov.id)
                      }}
                    >
                      <div
                        className={cn(
                          "relative flex cursor-grab items-center justify-center active:cursor-grabbing",
                          selected && "rounded-md ring-2 ring-violet-500 ring-offset-2 ring-offset-black/30"
                        )}
                        style={{
                          width: boxW,
                          height: boxH,
                          transform: `rotate(${ov.rotation}deg)`,
                        }}
                        onPointerDown={(e) => {
                          e.stopPropagation()
                          beginGesture()
                          startMove(e, ov, () => setSelectedId(ov.id))
                        }}
                      >
                        {mosaic && design.backgroundUrl ? (
                          <ThumbnailMosaicLayer
                            backgroundUrl={design.backgroundUrl}
                            backgroundTransform={backgroundTransform}
                            filter={design.filter}
                            overlay={ov}
                            stageWidth={stagePxW}
                            stageHeight={stagePxH}
                          />
                        ) : mosaic ? (
                          <div className="flex h-full w-full items-center justify-center rounded-md border-2 border-dashed border-violet-400/40 bg-violet-500/10 text-[9px] text-violet-200/80">
                            배경 필요
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
                              beginGesture()
                              if (side === "left" || side === "right") {
                                startResizeMosaicW(e, ov, side)
                              } else {
                                startResizeMosaicH(e, ov, side)
                              }
                            }}
                            onStartCornerResize={(e, corner) => {
                              beginGesture()
                              startResizeMosaicCorner(e, ov, corner)
                            }}
                          />
                        ) : selected ? (
                          <CornerResizeHandles
                            onStartResize={(e) => {
                              beginGesture()
                              startResize(e, ov)
                            }}
                          />
                        ) : null}
                      </div>
                      {selected && !mosaic ? (
                        <div
                          className="absolute left-1/2 flex flex-col items-center"
                          style={{ top: `calc(50% + ${boxH / 2 + 8}px)`, transform: "translateX(-50%)" }}
                        >
                          <button
                            type="button"
                            title="회전"
                            className="flex h-6 w-6 cursor-grab items-center justify-center rounded-full border-2 border-violet-500 bg-white text-[10px] text-violet-600 shadow"
                            onPointerDown={(e) => {
                              beginGesture()
                              startRotate(e, ov)
                            }}
                          >
                            ↻
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )
                })
                  : null}
              </div>
            </div>

            {/* 오른쪽 속성 패널 */}
            <aside className="flex w-[300px] shrink-0 flex-col border-l border-black/[0.06] bg-white dark:border-white/[0.06] dark:bg-[#0c0f16]">
              <div className="border-b border-black/[0.06] px-4 py-3 dark:border-white/[0.06]">
                <p className="text-sm font-bold text-slate-900 dark:text-white">속성</p>
                <p className="text-[10px] text-slate-500">
                  {selectedText
                    ? "텍스트 편집"
                    : selectedElement
                      ? isMosaicOverlay(selectedElement.catalogId)
                        ? "모자이크 편집"
                        : "요소 편집"
                      : selectedBackground
                        ? "배경 사진 편집"
                        : "레이어를 선택하세요"}
                </p>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {selectedBackground && design.backgroundUrl && !design.aiBaked ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={cn(
                        "h-9 w-full text-[11px] font-semibold shadow-sm",
                        backgroundLocked
                          ? "border-amber-400 bg-amber-500/25 text-amber-900 dark:border-amber-400 dark:bg-amber-500/30 dark:text-amber-50"
                          : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-white/35 dark:bg-white/12 dark:text-white dark:hover:bg-white/18"
                      )}
                      onClick={toggleBackgroundLock}
                    >
                      {backgroundLocked ? (
                        <>
                          <Lock className="mr-1.5 h-4 w-4 shrink-0" />
                          배경 고정 해제
                        </>
                      ) : (
                        <>
                          <LockOpen className="mr-1.5 h-4 w-4 shrink-0" />
                          배경 위치·크기 고정
                        </>
                      )}
                    </Button>
                    <div className={cn("space-y-4", backgroundLocked && "pointer-events-none opacity-50")}>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-slate-500">
                          확대 · {backgroundTransform.scale}%
                        </Label>
                        <Slider
                          min={50}
                          max={300}
                          step={1}
                          disabled={backgroundLocked}
                          value={[backgroundTransform.scale]}
                          onValueChange={([v]) => {
                            beginSliderSession("bg-scale")
                            patchDesign((d) =>
                              updateThumbnailBackgroundTransform(d, { scale: v ?? backgroundTransform.scale })
                            )
                          }}
                          onValueCommit={endSliderSession}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-slate-500">
                          가로 위치 · {Math.round(backgroundTransform.x)}%
                        </Label>
                        <Slider
                          min={0}
                          max={100}
                          step={1}
                          disabled={backgroundLocked}
                          value={[backgroundTransform.x]}
                          onValueChange={([v]) => {
                            beginSliderSession("bg-x")
                            patchDesign((d) =>
                              updateThumbnailBackgroundTransform(d, { x: v ?? backgroundTransform.x })
                            )
                          }}
                          onValueCommit={endSliderSession}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-slate-500">
                          세로 위치 · {Math.round(backgroundTransform.y)}%
                        </Label>
                        <Slider
                          min={0}
                          max={100}
                          step={1}
                          disabled={backgroundLocked}
                          value={[backgroundTransform.y]}
                          onValueChange={([v]) => {
                            beginSliderSession("bg-y")
                            patchDesign((d) =>
                              updateThumbnailBackgroundTransform(d, { y: v ?? backgroundTransform.y })
                            )
                          }}
                          onValueCommit={endSliderSession}
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 w-full text-[10px]"
                        disabled={backgroundLocked}
                        onClick={() => commitDesign((d) => resetThumbnailBackgroundTransform(d))}
                      >
                        <RotateCcw className="mr-1 h-3 w-3" />
                        배경 위치·크기 초기화
                      </Button>
                    </div>
                    <p className="text-[9px] leading-relaxed text-slate-500">
                      {backgroundLocked
                        ? "배경이 고정되어 있습니다. 텍스트·요소 편집 시 배경이 움직이지 않습니다."
                        : "배경을 클릭해 선택하고, 드래그로 이동·모서리로 확대하세요. 고정 버튼으로 위치를 잠글 수 있습니다."}
                    </p>
                  </>
                ) : null}
                {design.aiBaked && !selectedText && !selectedElement && !selectedBackground ? (
                  <div className="space-y-2 rounded-lg border border-violet-400/30 bg-violet-500/10 p-3">
                    <p className="text-xs font-semibold text-violet-200">AI 합성 썸네일</p>
                    <p className="text-[10px] leading-relaxed text-slate-500">
                      후킹·화살표가 이미지에 포함되어 있습니다. 필터 조정 후 바로 적용하거나, 업로드 탭에서 편집 모드로
                      전환하세요.
                    </p>
                    <p className="text-[10px] font-bold text-white">{currentHookingForAi.line1}</p>
                    <p className="text-[10px] font-bold text-teal-300">{currentHookingForAi.line2}</p>
                  </div>
                ) : null}
                {selectedText ? (
                  <>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-[10px] text-slate-500">내용</Label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 border-violet-400/40 px-2 text-[10px] text-violet-500"
                          disabled={aiTextLoadingId === selectedText.id}
                          onClick={() => void rewriteTextWithAi(selectedText)}
                        >
                          {aiTextLoadingId === selectedText.id ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <Sparkles className="mr-1 h-3 w-3" />
                          )}
                          AI 변환
                        </Button>
                      </div>
                      <Textarea
                        className="min-h-[72px] resize-y border-black/10 bg-slate-50 text-xs text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-black/30 dark:text-white dark:placeholder:text-slate-500"
                        value={selectedText.text}
                        onFocus={() => beginEditSession(`text-${selectedText.id}`)}
                        onBlur={endEditSession}
                        onChange={(e) =>
                          patchDesign((d) => updateThumbnailText(d, selectedText.id, { text: e.target.value }))
                        }
                      />
                      <p className="text-[9px] text-slate-500">
                        Enter로 줄바꿈 · 한 줄씩 쌓입니다. ✨ AI 변환 또는 텍스트 더블클릭.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-slate-500">글자 크기 · {selectedText.fontSize}px</Label>
                      <Slider
                        min={18}
                        max={80}
                        value={[selectedText.fontSize]}
                        onValueChange={([v]) => {
                          beginSliderSession(`text-fontSize-${selectedText.id}`)
                          patchDesign((d) =>
                            updateThumbnailText(d, selectedText.id, { fontSize: v ?? selectedText.fontSize })
                          )
                        }}
                        onValueCommit={endSliderSession}
                      />
                    </div>
                    <div className="flex gap-1">
                      {(
                        [
                          ["left", AlignLeft],
                          ["center", AlignCenter],
                          ["right", AlignRight],
                        ] as const
                      ).map(([align, Icon]) => (
                        <button
                          key={align}
                          type="button"
                          onClick={() =>
                            commitDesign((d) =>
                              updateThumbnailText(d, selectedText.id, { align: align as ThumbnailTextLayer["align"] })
                            )
                          }
                          className={cn(
                            "flex flex-1 items-center justify-center rounded-lg border py-2",
                            selectedText.align === align
                              ? "border-violet-400 bg-violet-500/10 text-violet-700 dark:text-violet-200"
                              : "border-black/10 text-slate-600 dark:border-white/10 dark:text-slate-300"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </button>
                      ))}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-slate-500">글자 색상</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {THUMBNAIL_TEXT_COLOR_PRESETS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => commitDesign((d) => updateThumbnailText(d, selectedText.id, { color: c }))}
                            className={cn(
                              "h-8 w-8 rounded-full border-2",
                              selectedText.color.toLowerCase() === c
                                ? "border-violet-500"
                                : "border-black/10 dark:border-white/15"
                            )}
                            style={{ backgroundColor: c }}
                            title={c}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={normalizeThumbnailHexColor(selectedText.color)}
                          onFocus={() => beginEditSession(`text-color-${selectedText.id}`)}
                          onBlur={endEditSession}
                          onChange={(e) =>
                            patchDesign((d) =>
                              updateThumbnailText(d, selectedText.id, {
                                color: normalizeThumbnailHexColor(e.target.value, selectedText.color),
                              })
                            )
                          }
                          className="h-9 w-12 shrink-0 cursor-pointer rounded border border-black/10 dark:border-white/15"
                          title="RGB 색상 선택"
                        />
                        <Input
                          className="h-9 flex-1 border-black/10 bg-slate-50 font-mono text-xs text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                          value={selectedText.color}
                          placeholder="#FFFFFF"
                          onFocus={() => beginEditSession(`text-color-hex-${selectedText.id}`)}
                          onBlur={(e) => {
                            endEditSession()
                            const next = normalizeThumbnailHexColor(e.target.value, selectedText.color)
                            if (next !== selectedText.color) {
                              patchDesign((d) => updateThumbnailText(d, selectedText.id, { color: next }))
                            }
                          }}
                          onChange={(e) =>
                            patchDesign((d) =>
                              updateThumbnailText(d, selectedText.id, { color: e.target.value })
                            )
                          }
                        />
                      </div>
                      <p className="text-[9px] text-slate-500">팔레트 또는 RGB 피커·HEX(#RRGGBB)로 자유롭게 지정하세요.</p>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {([400, 700, 900] as const).map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => commitDesign((d) => updateThumbnailText(d, selectedText.id, { fontWeight: w }))}
                          className={cn(
                            "rounded-lg border py-1.5 text-[10px] font-medium",
                            selectedText.fontWeight === w
                              ? "border-violet-400 bg-violet-500/10 text-violet-700 dark:text-violet-200"
                              : "border-black/10 text-slate-600 dark:border-white/10 dark:text-slate-300"
                          )}
                        >
                          {w === 400 ? "보통" : w === 700 ? "굵게" : "초굵게"}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          ["strokeOn", "글자 테두리"],
                          ["shadow", "그림자"],
                          ["bgOn", "배경"],
                        ] as const
                      ).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleFlag(key, !selectedText[key])}
                          className={cn(
                            "rounded-full border px-3 py-1 text-[10px]",
                            selectedText[key]
                              ? "border-violet-400 bg-violet-500/15 text-violet-700 dark:text-violet-200"
                              : "border-black/10 text-slate-600 dark:border-white/10 dark:text-slate-400"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {selectedText.strokeOn ? (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] text-slate-500">
                            글자 테두리 두께 · {selectedText.strokeWidth}px
                          </Label>
                          <Slider
                            min={1}
                            max={12}
                            step={1}
                            value={[selectedText.strokeWidth]}
                            onValueChange={([v]) => {
                              beginSliderSession(`text-strokeW-${selectedText.id}`)
                              patchDesign((d) =>
                                updateThumbnailText(d, selectedText.id, { strokeWidth: v ?? selectedText.strokeWidth })
                              )
                            }}
                            onValueCommit={endSliderSession}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] text-slate-500">글자 테두리 색</Label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={normalizeThumbnailHexColor(selectedText.strokeColor, "#000000")}
                              onChange={(e) =>
                                patchDesign((d) =>
                                  updateThumbnailText(d, selectedText.id, {
                                    strokeColor: normalizeThumbnailHexColor(e.target.value, selectedText.strokeColor),
                                  })
                                )
                              }
                              className="h-9 w-12 shrink-0 cursor-pointer rounded border border-black/10 dark:border-white/15"
                            />
                            <Input
                              className="h-9 flex-1 border-black/10 bg-slate-50 font-mono text-xs text-slate-900 dark:border-white/10 dark:bg-black/30 dark:text-white"
                              value={selectedText.strokeColor}
                              placeholder="#000000"
                              onBlur={(e) => {
                                const next = normalizeThumbnailHexColor(e.target.value, selectedText.strokeColor)
                                if (next !== selectedText.strokeColor) {
                                  patchDesign((d) =>
                                    updateThumbnailText(d, selectedText.id, { strokeColor: next })
                                  )
                                }
                              }}
                              onChange={(e) =>
                                patchDesign((d) =>
                                  updateThumbnailText(d, selectedText.id, { strokeColor: e.target.value })
                                )
                              }
                            />
                          </div>
                        </div>
                      </>
                    ) : null}
                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-slate-500">
                        박스 너비 · {Math.round(selectedText.widthPct)}%
                      </Label>
                      <Slider
                        min={24}
                        max={96}
                        value={[selectedText.widthPct]}
                        onValueChange={([v]) => {
                          beginSliderSession(`text-widthPct-${selectedText.id}`)
                          patchDesign((d) =>
                            updateThumbnailText(d, selectedText.id, { widthPct: v ?? selectedText.widthPct })
                          )
                        }}
                        onValueCommit={endSliderSession}
                      />
                      <p className="text-[9px] text-slate-500">텍스트 줄바꿈·배경 박스 너비에 영향을 줍니다.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-slate-500">회전 · {selectedText.rotation}°</Label>
                      <Slider
                        min={-180}
                        max={180}
                        step={1}
                        value={[selectedText.rotation]}
                        onValueChange={([v]) => {
                          beginSliderSession(`text-rotation-${selectedText.id}`)
                          patchDesign((d) => updateThumbnailText(d, selectedText.id, { rotation: v ?? 0 }))
                        }}
                        onValueCommit={endSliderSession}
                      />
                      <p className="text-[9px] text-slate-500">캔버스 하단 ↻ 핸들을 드래그해도 회전할 수 있습니다.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[9px] text-slate-500">X · {Math.round(selectedText.x)}%</Label>
                        <Slider
                          min={5}
                          max={95}
                          value={[selectedText.x]}
                          onValueChange={([v]) => {
                            beginSliderSession(`text-x-${selectedText.id}`)
                            patchDesign((d) => updateThumbnailText(d, selectedText.id, { x: v ?? selectedText.x }))
                          }}
                          onValueCommit={endSliderSession}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] text-slate-500">Y · {Math.round(selectedText.y)}%</Label>
                        <Slider
                          min={5}
                          max={95}
                          value={[selectedText.y]}
                          onValueChange={([v]) => {
                            beginSliderSession(`text-y-${selectedText.id}`)
                            patchDesign((d) => updateThumbnailText(d, selectedText.id, { y: v ?? selectedText.y }))
                          }}
                          onValueCommit={endSliderSession}
                        />
                      </div>
                    </div>
                  </>
                ) : null}

                {selectedElement ? (
                  <>
                    {isMosaicOverlay(selectedElement.catalogId) ? (
                      <>
                        <p className="text-[10px] leading-relaxed text-slate-500">
                          배경의 해당 영역을 모자이크 처리합니다. 드래그로 위치를 옮기고, 변 핸들로 가로·세로,
                          꼭지점으로 가로·세로를 함께 조절하세요.
                        </p>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] text-slate-500">
                            가로 · {mosaicOverlayDimensions(selectedElement).w}px
                          </Label>
                          <Slider
                            min={40}
                            max={280}
                            value={[mosaicOverlayDimensions(selectedElement).w]}
                            onValueChange={([v]) => {
                              beginSliderSession(`mosaic-w-${selectedElement.id}`)
                              patchDesign((d) =>
                                updateThumbnailElement(d, selectedElement.id, {
                                  mosaicW: v ?? mosaicOverlayDimensions(selectedElement).w,
                                })
                              )
                            }}
                            onValueCommit={endSliderSession}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] text-slate-500">
                            세로 · {mosaicOverlayDimensions(selectedElement).h}px
                          </Label>
                          <Slider
                            min={40}
                            max={480}
                            value={[mosaicOverlayDimensions(selectedElement).h]}
                            onValueChange={([v]) => {
                              beginSliderSession(`mosaic-h-${selectedElement.id}`)
                              patchDesign((d) =>
                                updateThumbnailElement(d, selectedElement.id, {
                                  mosaicH: v ?? mosaicOverlayDimensions(selectedElement).h,
                                })
                              )
                            }}
                            onValueCommit={endSliderSession}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] text-slate-500">
                            모자이크 강도 · {mosaicOverlayBlockSize(selectedElement)} (작을수록 거침)
                          </Label>
                          <Slider
                            min={4}
                            max={24}
                            step={1}
                            value={[mosaicOverlayBlockSize(selectedElement)]}
                            onValueChange={([v]) => {
                              beginSliderSession(`mosaic-block-${selectedElement.id}`)
                              patchDesign((d) =>
                                updateThumbnailElement(d, selectedElement.id, {
                                  mosaicBlock: v ?? mosaicOverlayBlockSize(selectedElement),
                                })
                              )
                            }}
                            onValueCommit={endSliderSession}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        {overlaySupportsFill(selectedElement.catalogId) ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                commitDesign((d) =>
                                  updateThumbnailElement(d, selectedElement.id, {
                                    filled: !(
                                      selectedElement.filled ??
                                      overlayDefaultFilled(selectedElement.catalogId)
                                    ),
                                  })
                                )
                              }
                              className={cn(
                                "rounded-full border px-3 py-1 text-[10px]",
                                (selectedElement.filled ?? overlayDefaultFilled(selectedElement.catalogId))
                                  ? "border-violet-400 bg-violet-500/15 text-violet-700 dark:text-violet-200"
                                  : "border-black/10 text-slate-500"
                              )}
                            >
                              속 채우기
                            </button>
                          </div>
                        ) : null}
                        <div className="space-y-1.5">
                          <Label className="text-[10px] text-slate-500">크기 · {selectedElement.size}px</Label>
                          <Slider
                            min={20}
                            max={180}
                            value={[selectedElement.size]}
                            onValueChange={([v]) => {
                              beginSliderSession(`element-size-${selectedElement.id}`)
                              patchDesign((d) =>
                                updateThumbnailElement(d, selectedElement.id, { size: v ?? selectedElement.size })
                              )
                            }}
                            onValueCommit={endSliderSession}
                          />
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {THUMBNAIL_TEXT_COLOR_PRESETS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() =>
                                commitDesign((d) => updateThumbnailElement(d, selectedElement.id, { color: c }))
                              }
                              className={cn(
                                "h-8 w-8 rounded-full border-2",
                                selectedElement.color === c ? "border-violet-500" : "border-transparent"
                              )}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] text-slate-500">회전 · {selectedElement.rotation}°</Label>
                          <Slider
                            min={-180}
                            max={180}
                            value={[selectedElement.rotation]}
                            onValueChange={([v]) => {
                              beginSliderSession(`element-rotation-${selectedElement.id}`)
                              patchDesign((d) =>
                                updateThumbnailElement(d, selectedElement.id, { rotation: v ?? 0 })
                              )
                            }}
                            onValueCommit={endSliderSession}
                          />
                        </div>
                      </>
                    )}
                  </>
                ) : null}

                {!selectedText && !selectedElement ? (
                  <div className="flex flex-col items-center gap-3 py-16 text-center text-slate-500">
                    <Palette className="h-10 w-10 opacity-30" />
                    <p className="text-xs leading-relaxed">
                      캔버스에서 텍스트·요소를 클릭하거나
                      <br />
                      왼쪽 패널에서 추가하세요
                    </p>
                  </div>
                ) : null}
              </div>
            </aside>
          </div>

          <footer className="flex h-10 shrink-0 items-center justify-between border-t border-black/[0.06] bg-white px-4 text-[10px] text-slate-500 dark:border-white/[0.06] dark:bg-[#0c0f16]">
            <span>
              {design.aiBaked ? "쇼핑숏폼 AI 합성" : THUMBNAIL_TEMPLATES.find((t) => t.id === design.templateId)?.label ?? "커스텀"} ·
              1080×1920
            </span>
            <span className="flex items-center gap-1">
              <Download className="h-3 w-3" />
              적용 시 PNG 저장
            </span>
          </footer>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
