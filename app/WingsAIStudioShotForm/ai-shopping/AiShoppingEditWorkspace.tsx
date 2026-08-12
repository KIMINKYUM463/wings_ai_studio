"use client"

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Play,
  Pause,
  Volume2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Scissors,
  Undo2,
  Redo2,
  Film,
  Loader2,
  Download,
} from "lucide-react"

export type ShoppingSubtitleStyle = {
  fontSize: number
  fontFamily: string
  color: string
  backgroundColor: string
  position: "top" | "center" | "bottom"
  positionOffset: number
  textAlign: "left" | "center" | "right"
  fontWeight: "normal" | "bold"
  textShadow: boolean
  outlineEnabled?: boolean
  outlineWidth?: number
  outlineColor?: string
  shadowEnabled?: boolean
  shadowColor?: string
  shadowDistance?: number
  shadowAngle?: number
  horizontalPercent?: number
  verticalPercent?: number
  showAd?: boolean
}

/** AI 영상 편집 자막 스타일 기본값 */
export const DEFAULT_SHOPPING_SUBTITLE_STYLE: ShoppingSubtitleStyle = {
  fontSize: 54,
  fontFamily: "Pretendard",
  color: "#FFFFFF",
  backgroundColor: "transparent",
  position: "bottom",
  positionOffset: 0,
  textAlign: "center",
  fontWeight: "bold",
  textShadow: true,
  outlineEnabled: true,
  outlineWidth: 8,
  outlineColor: "#000000",
  shadowEnabled: true,
  shadowColor: "#000000",
  shadowDistance: 3,
  shadowAngle: -46,
  horizontalPercent: 50,
  verticalPercent: 88,
  showAd: false,
}

/** 저장된 스타일을 기본값과 합치고, 예전 디폴트(거리 12 / 각도 -45)는 새 디폴트로 치환한다. */
export function normalizeShoppingSubtitleStyle(
  style?: Partial<ShoppingSubtitleStyle> | null
): ShoppingSubtitleStyle {
  const merged: ShoppingSubtitleStyle = {
    ...DEFAULT_SHOPPING_SUBTITLE_STYLE,
    ...(style || {}),
    positionOffset: style?.positionOffset ?? DEFAULT_SHOPPING_SUBTITLE_STYLE.positionOffset,
  }
  // 예전 제품 기본값이면 새 기본값으로 교체 (프로젝트에 12/-45로 저장된 경우 포함)
  if (merged.shadowDistance === 12) {
    merged.shadowDistance = DEFAULT_SHOPPING_SUBTITLE_STYLE.shadowDistance
  }
  if (merged.shadowAngle === -45) {
    merged.shadowAngle = DEFAULT_SHOPPING_SUBTITLE_STYLE.shadowAngle
  }
  return merged
}

const COLOR_PRESETS = [
  "#FFFFFF",
  "#FFFF00",
  "#FFD700",
  "#FF6B00",
  "#FF0000",
  "#FF69B4",
  "#9B59B6",
  "#3498DB",
  "#2ECC71",
  "#1ABC9C",
  "#000000",
  "#95A5A6",
  "#E74C3C",
  "#F1C40F",
]

const CLIP_COLORS = [
  { track: "bg-sky-600/80 border-sky-300/50", text: "text-sky-50", accent: "bg-sky-200" },
  { track: "bg-violet-600/80 border-violet-300/50", text: "text-violet-50", accent: "bg-violet-200" },
  { track: "bg-amber-600/80 border-amber-300/50", text: "text-amber-50", accent: "bg-amber-200" },
  { track: "bg-rose-600/80 border-rose-300/50", text: "text-rose-50", accent: "bg-rose-200" },
  { track: "bg-emerald-600/80 border-emerald-300/50", text: "text-emerald-50", accent: "bg-emerald-200" },
  { track: "bg-fuchsia-600/80 border-fuchsia-300/50", text: "text-fuchsia-50", accent: "bg-fuchsia-200" },
  { track: "bg-cyan-600/80 border-cyan-300/50", text: "text-cyan-50", accent: "bg-cyan-200" },
  { track: "bg-orange-600/80 border-orange-300/50", text: "text-orange-50", accent: "bg-orange-200" },
] as const

function formatTime(sec: number) {
  const s = Math.max(0, sec || 0)
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`
}

function randomColor() {
  return COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)] || "#FFFFFF"
}

function shadowCss(style: ShoppingSubtitleStyle) {
  if (style.shadowEnabled === false && !style.textShadow) return "none"
  if (style.shadowEnabled === false) return "none"
  const dist = style.shadowDistance ?? 3
  const angle = ((style.shadowAngle ?? -46) * Math.PI) / 180
  const x = Math.cos(angle) * dist
  const y = Math.sin(angle) * dist
  const color = style.shadowColor || "#000000"
  return `${x.toFixed(1)}px ${y.toFixed(1)}px 4px ${color}`
}

type Props = {
  previewVideoHostRef: RefObject<HTMLDivElement | null>
  previewGenerated: boolean
  hasVideos: boolean
  currentSubtitle: string
  subtitleStyle: ShoppingSubtitleStyle
  onSubtitleStyleChange: (next: ShoppingSubtitleStyle) => void
  isPlaying: boolean
  onTogglePlay: () => void
  currentTime: number
  duration: number
  onSeekRatio: (ratio: number) => void
  videoZoom: number
  videoOffsetX: number
  videoOffsetY: number
  onVideoZoomChange: (v: number) => void
  onVideoOffsetXChange: (v: number) => void
  onVideoOffsetYChange: (v: number) => void
  onResetTransform: () => void
  originalClipSound: boolean
  onOriginalClipSoundChange: (v: boolean) => void
  previewThumbnailSrc?: string | null
  videoTransitionOpacity: number
  scriptLineCount: number
  sceneCount: number
  sceneDurations?: number[]
  workspaceTab: "subtitle" | "autoedit"
  onWorkspaceTabChange: (t: "subtitle" | "autoedit") => void
  settingsTab: "settings" | "templates"
  onSettingsTabChange: (t: "settings" | "templates") => void
  isGeneratingPreview: boolean
  onGeneratePreview: () => void
  exportActions: ReactNode
  extras?: ReactNode
}

export function AiShoppingEditWorkspace({
  previewVideoHostRef,
  previewGenerated,
  hasVideos,
  currentSubtitle,
  subtitleStyle,
  onSubtitleStyleChange,
  isPlaying,
  onTogglePlay,
  currentTime,
  duration,
  onSeekRatio,
  videoZoom,
  videoOffsetX,
  videoOffsetY,
  onVideoZoomChange,
  onVideoOffsetXChange,
  onVideoOffsetYChange,
  onResetTransform,
  originalClipSound,
  onOriginalClipSoundChange,
  previewThumbnailSrc,
  videoTransitionOpacity,
  scriptLineCount,
  sceneCount,
  sceneDurations = [],
  isGeneratingPreview,
  onGeneratePreview,
  exportActions,
}: Props) {
  const patch = (p: Partial<ShoppingSubtitleStyle>) =>
    onSubtitleStyleChange({ ...subtitleStyle, ...p })

  const verticalPercent =
    subtitleStyle.verticalPercent ??
    (subtitleStyle.position === "top" ? 15 : subtitleStyle.position === "center" ? 50 : 88)
  const horizontalPercent = subtitleStyle.horizontalPercent ?? 50
  const playheadPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0
  const previewFrameRef = useRef<HTMLDivElement | null>(null)
  const [isDraggingSubtitle, setIsDraggingSubtitle] = useState(false)

  const applyPositionFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const frame = previewFrameRef.current
      if (!frame) return
      const rect = frame.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const x = ((clientX - rect.left) / rect.width) * 100
      const y = ((clientY - rect.top) / rect.height) * 100
      const nextX = Math.max(8, Math.min(92, x))
      const nextY = Math.max(8, Math.min(92, y))
      const position: ShoppingSubtitleStyle["position"] =
        nextY < 33 ? "top" : nextY < 66 ? "center" : "bottom"
      patch({
        horizontalPercent: Math.round(nextX),
        verticalPercent: Math.round(nextY),
        position,
        positionOffset: 0,
      })
    },
    // patch는 subtitleStyle 클로저에 의존 — 최신 스타일 반영
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subtitleStyle, onSubtitleStyleChange]
  )

  const onSubtitlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsDraggingSubtitle(true)
    applyPositionFromClient(event.clientX, event.clientY)
  }

  const onSubtitlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDraggingSubtitle) return
    applyPositionFromClient(event.clientX, event.clientY)
  }

  const onSubtitlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDraggingSubtitle) return
    setIsDraggingSubtitle(false)
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* already released */
    }
  }

  // 실제 자막만 표시. 안내 문구는 미리보기/다운로드 중에도 노출하지 않는다.
  const displaySubtitle = currentSubtitle.trim()

  const ticks = Array.from({ length: Math.max(1, Math.ceil(duration / 3) + 1) }, (_, i) => i * 3).filter(
    (t) => t <= Math.max(duration, 15)
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-start">
        {/* 왼쪽: 영상 프리뷰 */}
        <div className="rounded-2xl border border-white/10 bg-[#121316] p-3 space-y-3 sm:p-4 lg:sticky lg:top-2 lg:col-span-4 lg:row-span-2 lg:self-start">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-500">
            <span>Preview</span>
            <span className="font-mono text-zinc-400">
              {formatTime(currentTime)} / {formatTime(duration || 15)}
            </span>
          </div>

          <div
            ref={previewFrameRef}
            className="relative mx-auto w-full max-w-[min(100%,320px)] aspect-[9/16] rounded-xl overflow-hidden border border-sky-500/30 bg-black shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
          >
            {previewGenerated && hasVideos ? (
              <>
                <div
                  ref={previewVideoHostRef as RefObject<HTMLDivElement>}
                  className="absolute inset-0 [&>video]:h-full [&>video]:w-full [&>video]:object-cover"
                  style={{
                    opacity: videoTransitionOpacity,
                    transform: `translate(${videoOffsetX}%, ${videoOffsetY}%) scale(${videoZoom / 100})`,
                    transformOrigin: "center center",
                  }}
                />
                {previewThumbnailSrc && currentTime < 0.01 ? (
                  <img
                    src={previewThumbnailSrc}
                    alt="썸네일"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : null}
                {displaySubtitle ? (
                  <div className="absolute inset-0 z-10">
                    <div
                      className={`absolute max-w-[88%] cursor-grab whitespace-nowrap rounded px-2 py-1 select-none touch-none ${
                        isDraggingSubtitle
                          ? "cursor-grabbing ring-2 ring-sky-400/80"
                          : "hover:ring-1 hover:ring-sky-400/50"
                      } ${!currentSubtitle.trim() ? "opacity-70" : ""}`}
                      style={{
                        left: `${horizontalPercent}%`,
                        top: `${verticalPercent}%`,
                        transform: "translate(-50%, -50%)",
                        fontFamily: `'${subtitleStyle.fontFamily}', sans-serif`,
                        fontSize: `${Math.max(
                          12,
                          Math.min(
                            subtitleStyle.fontSize * 0.45,
                            220 / Math.max(1, displaySubtitle.replace(/\s/g, "").length)
                          )
                        )}px`,
                        fontWeight: subtitleStyle.fontWeight,
                        textAlign: subtitleStyle.textAlign,
                        color: subtitleStyle.color,
                        backgroundColor:
                          subtitleStyle.backgroundColor === "transparent"
                            ? "transparent"
                            : subtitleStyle.backgroundColor,
                        lineHeight: 1.25,
                        textShadow: shadowCss(subtitleStyle),
                        WebkitTextStroke:
                          subtitleStyle.outlineEnabled !== false
                            ? `${(subtitleStyle.outlineWidth ?? 4) * 0.35}px ${subtitleStyle.outlineColor || "#000"}`
                            : undefined,
                        paintOrder: "stroke fill",
                      }}
                      onPointerDown={onSubtitlePointerDown}
                      onPointerMove={onSubtitlePointerMove}
                      onPointerUp={onSubtitlePointerUp}
                      onPointerCancel={onSubtitlePointerUp}
                      title="드래그하여 자막 위치 이동"
                    >
                      {displaySubtitle}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-500 p-4 text-center">
                <Film className="w-10 h-10 opacity-40" />
                <p className="text-xs">미리보기를 생성해주세요</p>
              </div>
            )}
          </div>

          <div className="hidden">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-zinc-200">화면 조정</p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-zinc-400 hover:text-sky-300"
                onClick={onResetTransform}
                title="초기화"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span className="inline-flex items-center gap-1">
                  <ZoomIn className="w-3 h-3" /> 확대
                </span>
                <Input
                  type="number"
                  value={videoZoom}
                  onChange={(e) => onVideoZoomChange(Number(e.target.value) || 100)}
                  className="h-7 w-16 bg-black/50 border-white/10 text-xs text-right"
                />
              </div>
              <Slider
                value={[videoZoom]}
                min={50}
                max={200}
                step={1}
                onValueChange={([v]) => onVideoZoomChange(v ?? 100)}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>가로</span>
                <Input
                  type="number"
                  value={videoOffsetX}
                  onChange={(e) => onVideoOffsetXChange(Number(e.target.value) || 0)}
                  className="h-7 w-16 bg-black/50 border-white/10 text-xs text-right"
                />
              </div>
              <Slider
                value={[videoOffsetX]}
                min={-50}
                max={50}
                step={1}
                onValueChange={([v]) => onVideoOffsetXChange(v ?? 0)}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>세로</span>
                <Input
                  type="number"
                  value={videoOffsetY}
                  onChange={(e) => onVideoOffsetYChange(Number(e.target.value) || 0)}
                  className="h-7 w-16 bg-black/50 border-white/10 text-xs text-right"
                />
              </div>
              <Slider
                value={[videoOffsetY]}
                min={-50}
                max={50}
                step={1}
                onValueChange={([v]) => onVideoOffsetYChange(v ?? 0)}
              />
            </div>
          </div>

          <div className="hidden">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-500">
              <span>Timeline</span>
              <span className="font-mono text-zinc-400">
                {formatTime(currentTime)} / {formatTime(duration || 15)}
              </span>
            </div>
            <Button
              type="button"
              onClick={onTogglePlay}
              disabled={!previewGenerated}
              className="w-full h-11 bg-sky-600 hover:bg-sky-500 text-white font-semibold"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  일시정지
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  재생
                </>
              )}
            </Button>
            <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
              <Checkbox
                checked={originalClipSound}
                onCheckedChange={(c) => onOriginalClipSoundChange(c === true)}
              />
              <Volume2 className="w-3.5 h-3.5 text-zinc-400" />
              원본 클립 소리
            </label>
          </div>
        </div>

        {/* 오른쪽 설정 + 하단 전체 타임라인 */}
        <div className="min-w-0 space-y-3 xl:contents">
          {/* 타임라인 툴바 + 트랙 */}
          <div className="order-2 rounded-2xl border border-white/10 bg-[#121316] p-3 space-y-3 lg:col-span-12 overflow-x-auto">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <div className="hidden">
                <Button type="button" size="sm" variant="outline" className="h-8 text-xs border-white/15 text-zinc-300" disabled>
                  <Scissors className="w-3.5 h-3.5 mr-1" />
                  선택 클립 자르기
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-8 text-xs border-white/15 text-zinc-300" disabled>
                  전환 지점 분할
                </Button>
                <Button type="button" size="icon" variant="outline" className="h-8 w-8 border-white/15 text-zinc-400" disabled>
                  <Undo2 className="w-3.5 h-3.5" />
                </Button>
                <Button type="button" size="icon" variant="outline" className="h-8 w-8 border-white/15 text-zinc-400" disabled>
                  <Redo2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-400">
                <Button
                  type="button"
                  size="sm"
                  onClick={onTogglePlay}
                  disabled={!previewGenerated}
                  className="h-8 bg-sky-600 px-4 text-white hover:bg-sky-500"
                >
                  {isPlaying ? <Pause className="mr-1.5 h-3.5 w-3.5" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
                  {isPlaying ? "일시정지" : "재생"}
                </Button>
                <span className="font-mono text-sky-300">{formatTime(currentTime)}</span>
              </div>
            </div>

            {/* 눈금 */}
            <div className="relative h-5 border-b border-white/10">
              {ticks.map((t) => (
                <span
                  key={t}
                  className="absolute top-0 text-[9px] text-zinc-600 -translate-x-1/2"
                  style={{ left: `${duration > 0 ? (t / Math.max(duration, 1)) * 100 : (t / 15) * 100}%` }}
                >
                  {formatTime(t)}
                </span>
              ))}
            </div>

            {/* 클립 트랙 */}
            <div className="space-y-2">
              <div className="flex gap-2 items-stretch">
                <div className="w-14 shrink-0 text-[10px] text-zinc-500 flex items-center">클립</div>
                <div className="relative flex h-12 min-w-0 flex-1 gap-1 overflow-hidden rounded-lg">
                  {Array.from({ length: Math.max(1, sceneCount) }, (_, index) => {
                    const color = CLIP_COLORS[index % CLIP_COLORS.length]!
                    const hasExactDurations = sceneDurations.length === sceneCount
                    const clipDuration = hasExactDurations
                      ? Math.max(0.001, sceneDurations[index] || 0)
                      : (duration || 15) / Math.max(1, sceneCount)
                    const clipStart = hasExactDurations
                      ? sceneDurations.slice(0, index).reduce((sum, value) => sum + value, 0)
                      : clipDuration * index
                    const clipEnd = clipStart + clipDuration
                    return (
                      <button
                        key={index}
                        type="button"
                        className={`group relative min-w-0 overflow-hidden rounded-md border px-2 text-left transition hover:brightness-125 ${color.track}`}
                        style={{ flexGrow: clipDuration, flexBasis: 0 }}
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect()
                          const localRatio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
                          onSeekRatio(
                            (clipStart + localRatio * clipDuration) /
                              Math.max(0.001, duration || clipEnd)
                          )
                        }}
                        title={`영상 ${index + 1} · ${formatTime(clipStart)} – ${formatTime(clipEnd)}`}
                      >
                        <span className={`absolute inset-x-0 top-0 h-0.5 opacity-80 ${color.accent}`} />
                        <div className={`truncate text-[11px] font-semibold ${color.text}`}>영상 {index + 1}</div>
                        <div className={`truncate text-[9px] opacity-75 ${color.text}`}>
                          {formatTime(clipStart)}–{formatTime(clipEnd)}
                        </div>
                        <span className="pointer-events-none absolute inset-0 bg-white/0 transition group-hover:bg-white/[0.08]" />
                      </button>
                    )
                  })}
                  <div
                    className="pointer-events-none absolute top-0 bottom-0 z-20 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]"
                    style={{ left: `${playheadPct}%` }}
                  />
                </div>
              </div>
              <div className="flex gap-2 items-stretch">
                <div className="w-14 shrink-0 text-[10px] text-zinc-500 flex items-center">자막</div>
                <div
                  className="relative flex-1 h-9 rounded-lg bg-emerald-700/40 border border-emerald-500/30 cursor-pointer"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
                    onSeekRatio(ratio)
                  }}
                >
                  <div
                    className="absolute inset-y-1 left-1 right-1 rounded bg-emerald-500/50"
                    style={{ opacity: scriptLineCount > 0 ? 1 : 0.3 }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white"
                    style={{ left: `${playheadPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 오른쪽: 자막 및 화면 설정 */}
          <div className="order-1 grid grid-cols-1 gap-3 lg:col-span-8 lg:col-start-5 lg:row-start-1">
            <div className="rounded-2xl border border-white/10 bg-[#121316] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-zinc-100">자막 스타일</p>
                  <p className="mt-0.5 text-[10px] text-zinc-500">
                    미리보기에서 자막을 드래그하거나 아래에서 위치를 조절하세요.
                  </p>
                </div>
              </div>
              <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <Select value="default" disabled>
                          <SelectTrigger className="h-8 w-[200px] bg-black/40 border-white/10 text-xs">
                            <SelectValue placeholder="기본 자막" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">기본 자막 - 타임라인 자막</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-[10px] text-amber-300/90 ml-auto">
                          {subtitleStyle.position === "top"
                            ? "상단"
                            : subtitleStyle.position === "center"
                              ? "중단"
                              : "하단"}{" "}
                          · X {horizontalPercent}% · Y {verticalPercent}%
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-zinc-400">
                          텍스트 크기 {subtitleStyle.fontSize}px
                        </Label>
                        <Slider
                          min={32}
                          max={82}
                          step={1}
                          value={[subtitleStyle.fontSize]}
                          onValueChange={([v]) => patch({ fontSize: v ?? 54 })}
                        />
                      </div>

                      <div className="space-y-2 rounded-lg border border-sky-400/25 bg-sky-500/10 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <Label className="text-[11px] font-semibold text-sky-100">자막 위치</Label>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 border-white/15 bg-black/30 px-2 text-[10px] text-zinc-200"
                            onClick={() =>
                              patch({
                                position: "bottom",
                                horizontalPercent: 50,
                                verticalPercent: 88,
                                positionOffset: 0,
                              })
                            }
                          >
                            기본(하단 중앙)
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(
                            [
                              ["top", "상단", 15],
                              ["center", "중단", 50],
                              ["bottom", "하단", 88],
                            ] as const
                          ).map(([pos, label, y]) => (
                            <button
                              key={pos}
                              type="button"
                              className={`h-8 rounded-md border text-xs ${
                                subtitleStyle.position === pos
                                  ? "border-sky-400 bg-sky-500/20 text-sky-100"
                                  : "border-white/10 text-zinc-400 hover:bg-white/5"
                              }`}
                              onClick={() =>
                                patch({
                                  position: pos,
                                  verticalPercent: y,
                                  horizontalPercent: 50,
                                  positionOffset: 0,
                                })
                              }
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <Label className="text-[11px] text-zinc-400">
                          가로 위치 {horizontalPercent}%
                        </Label>
                        <Slider
                          min={8}
                          max={92}
                          step={1}
                          value={[horizontalPercent]}
                          onValueChange={([v]) => patch({ horizontalPercent: v ?? 50 })}
                        />
                        <Label className="text-[11px] text-zinc-400">
                          세로 위치 {verticalPercent}%
                        </Label>
                        <Slider
                          min={8}
                          max={92}
                          step={1}
                          value={[verticalPercent]}
                          onValueChange={([v]) => {
                            const y = v ?? 88
                            const position: ShoppingSubtitleStyle["position"] =
                              y < 33 ? "top" : y < 66 ? "center" : "bottom"
                            patch({ verticalPercent: y, position, positionOffset: 0 })
                          }}
                        />
                        <p className="text-[10px] leading-snug text-zinc-500">
                          미리보기 자막을 드래그해도 같은 위치가 적용됩니다.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[11px] text-zinc-400">폰트 색상</Label>
                        <div className="flex gap-2 items-center">
                          <Input
                            value={subtitleStyle.color}
                            onChange={(e) => patch({ color: e.target.value })}
                            className="h-8 border-white/10 bg-black/40 font-mono text-xs !text-zinc-100 caret-white"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs border-white/15"
                            onClick={() => patch({ color: randomColor() })}
                          >
                            랜덤
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {COLOR_PRESETS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              className={`h-6 w-6 rounded-md border ${
                                subtitleStyle.color.toLowerCase() === c.toLowerCase()
                                  ? "border-sky-400 ring-1 ring-sky-400"
                                  : "border-white/20"
                              }`}
                              style={{ backgroundColor: c }}
                              onClick={() => patch({ color: c })}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2 rounded-lg border border-white/10 p-2.5">
                        <label className="flex items-center gap-2 text-xs text-zinc-200">
                          <Checkbox
                            checked={subtitleStyle.outlineEnabled !== false}
                            onCheckedChange={(c) => patch({ outlineEnabled: c === true })}
                          />
                          외곽선
                        </label>
                        {subtitleStyle.outlineEnabled !== false ? (
                          <>
                            <Label className="text-[11px] text-zinc-400">
                              획 두께 {subtitleStyle.outlineWidth ?? 8}px
                            </Label>
                            <Slider
                              min={0}
                              max={16}
                              step={1}
                              value={[subtitleStyle.outlineWidth ?? 8]}
                              onValueChange={([v]) => patch({ outlineWidth: v ?? 8 })}
                            />
                            <div className="flex gap-2">
                              <Input
                                value={subtitleStyle.outlineColor || "#000000"}
                                onChange={(e) => patch({ outlineColor: e.target.value })}
                                className="h-8 border-white/10 bg-black/40 font-mono text-xs !text-zinc-100 caret-white"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs"
                                onClick={() => patch({ outlineColor: randomColor() })}
                              >
                                랜덤
                              </Button>
                            </div>
                          </>
                        ) : null}
                      </div>

                      <div className="space-y-2 rounded-lg border border-white/10 p-2.5">
                        <label className="flex items-center gap-2 text-xs text-zinc-200">
                          <Checkbox
                            checked={subtitleStyle.shadowEnabled !== false && subtitleStyle.textShadow}
                            onCheckedChange={(c) =>
                              patch({ shadowEnabled: c === true, textShadow: c === true })
                            }
                          />
                          그림자
                        </label>
                        {subtitleStyle.shadowEnabled !== false && subtitleStyle.textShadow ? (
                          <>
                            <Input
                              value={subtitleStyle.shadowColor || "#000000"}
                              onChange={(e) => patch({ shadowColor: e.target.value })}
                              className="h-8 border-white/10 bg-black/40 font-mono text-xs !text-zinc-100 caret-white"
                            />
                            <Label className="text-[11px] text-zinc-400">
                              그림자 거리 {subtitleStyle.shadowDistance ?? 3}
                            </Label>
                            <Slider
                              min={0}
                              max={24}
                              step={1}
                              value={[subtitleStyle.shadowDistance ?? 3]}
                              onValueChange={([v]) => patch({ shadowDistance: v ?? 3 })}
                            />
                            <Label className="text-[11px] text-zinc-400">
                              그림자 각도 {subtitleStyle.shadowAngle ?? -46}°
                            </Label>
                            <Slider
                              min={-180}
                              max={180}
                              step={1}
                              value={[subtitleStyle.shadowAngle ?? -46]}
                              onValueChange={([v]) => patch({ shadowAngle: v ?? -46 })}
                            />
                          </>
                        ) : null}
                      </div>
              </div>
            </div>
          </div>

          {/* 미리보기 생성 + 내보내기 */}
          <div className="order-1 rounded-2xl border border-white/10 bg-[#121316] p-3 space-y-3 lg:col-span-8 lg:col-start-5">
            <Button
              type="button"
              onClick={onGeneratePreview}
              disabled={isGeneratingPreview || !hasVideos}
              className="w-full h-11 bg-sky-600 hover:bg-sky-500 text-white font-semibold"
            >
              {isGeneratingPreview ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  미리보기 생성 중…
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  미리보기 생성
                </>
              )}
            </Button>
            {exportActions}
            {!previewGenerated ? (
              <p className="text-center text-xs text-zinc-500">먼저 미리보기를 생성해주세요</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ExportActionGrid(props: {
  children: ReactNode
}) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{props.children}</div>
}

export function ExportPrimaryButton(props: {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  label: string
}) {
  return (
    <Button
      onClick={props.onClick}
      disabled={props.disabled}
      className="bg-orange-500 hover:bg-orange-400 text-white"
      size="lg"
    >
      {props.loading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Download className="w-4 h-4 mr-2" />
      )}
      {props.label}
    </Button>
  )
}
