"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Redo2,
  Scissors,
  Trash2,
  Undo2,
  Upload,
  Wand2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { voiceSubtitleAtLineCues, type VoiceLineCue } from "@/lib/shotform-factory-line-tts"
import {
  STUDIO_OVERLAY_CATALOG,
  STUDIO_OVERLAY_CATEGORIES,
  type PlacedStudioOverlay,
  type StudioOverlayCategory,
} from "@/lib/shotform-studio-overlay-catalog"
import { studio } from "../components/ShotFormStudioUI"
import { StudioOverlayCatalogThumb, StudioOverlayGraphic } from "./StudioOverlayGraphic"

const FONT_OPTIONS = [
  { value: "pretendard-bold", label: "Pretendard Bold" },
  { value: "pretendard", label: "Pretendard" },
  { value: "noto-kr", label: "Noto Sans KR" },
] as const

const SUB_COLOR_PRESETS = ["#ffffff", "#ef4444", "#eab308", "#22c55e", "#000000"] as const

function formatMmSs(totalSec: number) {
  const m = Math.floor(totalSec / 60)
  const s = Math.floor(totalSec % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

function subFontCssFromKey(subFont: string) {
  return subFont === "pretendard-bold" || subFont === "pretendard"
    ? '"Pretendard","Noto Sans KR",system-ui,sans-serif'
    : '"Noto Sans KR",sans-serif'
}

type SceneRow = { id: number }

export type VoicePreviewStudioDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onToast?: (msg: string) => void
  /** 닫을 때 메인 프리뷰 재생 위치 동기 */
  onCloseSync?: (audioPlayheadSec: number) => void
  videoSrc: string
  videoPoster?: string
  audioSrc: string | null
  audioKey: number
  videoDurationSec: number
  audioDurationSec: number
  initialAudioPlayheadSec: number
  voiceLineCues: VoiceLineCue[] | null
  /** 큐 없을 때 메인에서 계산된 한 줄 */
  fallbackSubtitleLine: string
  scenes: readonly SceneRow[]
  voiceEditSceneId: number
  onVoiceEditSceneId: (id: number) => void
  getVoiceSceneText: (id: number) => string
  onVoiceSceneText: (id: number, text: string) => void
  subFont: string
  onSubFont: (v: string) => void
  subSizePx: number
  onSubSizePx: (n: number) => void
  subColor: string
  onSubColor: (v: string) => void
  subWeight: "normal" | "bold" | "extrabold"
  onSubWeight: (v: "normal" | "bold" | "extrabold") => void
  subY: number
  onSubY: (n: number) => void
  subX: number
  onSubX: (n: number) => void
  subOutlineOn: boolean
  onSubOutlineOn: (v: boolean) => void
  subOutlineColor: string
  onSubOutlineColor: (v: string) => void
  subOutlineW: number
  onSubOutlineW: (n: number) => void
  subBgOn: boolean
  onSubBgOn: (v: boolean) => void
  subBgColor: string
  onSubBgColor: (v: string) => void
  subBgOpacity: number
  onSubBgOpacity: (n: number) => void
}

export function VoicePreviewStudioDialog(props: VoicePreviewStudioDialogProps) {
  const {
    open,
    onOpenChange,
    onToast,
    onCloseSync,
    videoSrc,
    videoPoster,
    audioSrc,
    audioKey,
    videoDurationSec,
    audioDurationSec,
    initialAudioPlayheadSec,
    voiceLineCues,
    fallbackSubtitleLine,
    scenes,
    voiceEditSceneId,
    onVoiceEditSceneId,
    getVoiceSceneText,
    onVoiceSceneText,
    subFont,
    onSubFont,
    subSizePx,
    onSubSizePx,
    subColor,
    onSubColor,
    subWeight,
    onSubWeight,
    subY,
    onSubY,
    subX,
    onSubX,
    subOutlineOn,
    onSubOutlineOn,
    subOutlineColor,
    onSubOutlineColor,
    subOutlineW,
    onSubOutlineW,
    subBgOn,
    onSubBgOn,
    subBgColor,
    onSubBgColor,
    subBgOpacity,
    onSubBgOpacity,
  } = props

  const [tab, setTab] = useState<"shorts" | "subs" | "elements">("shorts")
  const [speed, setSpeed] = useState(1)
  const [timelineZoom, setTimelineZoom] = useState(1)
  const [playing, setPlaying] = useState(false)
  const [audioPlayhead, setAudioPlayhead] = useState(0)
  const [overlayCategory, setOverlayCategory] = useState<StudioOverlayCategory>("shapes")
  const [overlayPickColor, setOverlayPickColor] = useState("#ffffff")
  const [placedOverlays, setPlacedOverlays] = useState<PlacedStudioOverlay[]>([])
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null)
  const overlayIdRef = useRef(0)
  const previewStageRef = useRef<HTMLDivElement | null>(null)
  const overlayInteractionRef = useRef<
    | {
        kind: "move"
        id: string
        pointerId: number
        startPx: number
        startPy: number
        startX: number
        startY: number
      }
    | {
        kind: "rotate"
        id: string
        pointerId: number
        centerPx: number
        centerPy: number
        startAngle: number
        startRotation: number
      }
    | null
  >(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const clampOverlayPct = (n: number) => Math.min(95, Math.max(5, n))

  const aDur = audioDurationSec > 0.05 ? audioDurationSec : 1
  const vDur = videoDurationSec > 0.05 ? videoDurationSec : 1

  const subFontCss = useMemo(() => subFontCssFromKey(subFont), [subFont])
  const subFontWeight = subWeight === "extrabold" ? 800 : subWeight === "bold" ? 700 : 400

  const filteredOverlayCatalog = useMemo(
    () => STUDIO_OVERLAY_CATALOG.filter((e) => e.category === overlayCategory),
    [overlayCategory]
  )

  const selectedOverlay = useMemo(
    () => placedOverlays.find((o) => o.id === selectedOverlayId) ?? null,
    [placedOverlays, selectedOverlayId]
  )

  const addOverlayFromCatalog = useCallback(
    (catalogId: string) => {
      overlayIdRef.current += 1
      const id = `ov-${overlayIdRef.current}`
      const next: PlacedStudioOverlay = {
        id,
        catalogId,
        x: 50,
        y: 42,
        size: 48,
        color: overlayPickColor,
        rotation: 0,
      }
      setPlacedOverlays((prev) => [...prev, next])
      setSelectedOverlayId(id)
      onToast?.("프리뷰 중앙에 요소를 추가했습니다. 위치·크기를 조절하세요.")
    },
    [overlayPickColor, onToast]
  )

  const updateOverlayById = useCallback((id: string, patch: Partial<PlacedStudioOverlay>) => {
    setPlacedOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)))
  }, [])

  const updateSelectedOverlay = useCallback(
    (patch: Partial<PlacedStudioOverlay>) => {
      if (!selectedOverlayId) return
      updateOverlayById(selectedOverlayId, patch)
    },
    [selectedOverlayId, updateOverlayById]
  )

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const st = overlayInteractionRef.current
      if (!st || st.pointerId !== e.pointerId) return
      const stage = previewStageRef.current
      if (!stage) return
      const rect = stage.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return

      if (st.kind === "move") {
        const dx = ((e.clientX - st.startPx) / rect.width) * 100
        const dy = ((e.clientY - st.startPy) / rect.height) * 100
        updateOverlayById(st.id, {
          x: clampOverlayPct(st.startX + dx),
          y: clampOverlayPct(st.startY + dy),
        })
        return
      }

      const angle = (Math.atan2(e.clientY - st.centerPy, e.clientX - st.centerPx) * 180) / Math.PI
      let rot = st.startRotation + (angle - st.startAngle)
      while (rot > 180) rot -= 360
      while (rot < -180) rot += 360
      updateOverlayById(st.id, { rotation: Math.round(rot) })
    }

    const endDrag = (e: PointerEvent) => {
      const st = overlayInteractionRef.current
      if (st && st.pointerId === e.pointerId) overlayInteractionRef.current = null
    }

    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", endDrag)
    window.addEventListener("pointercancel", endDrag)
    return () => {
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", endDrag)
      window.removeEventListener("pointercancel", endDrag)
    }
  }, [updateOverlayById])

  const startOverlayMove = useCallback((e: React.PointerEvent, ov: PlacedStudioOverlay) => {
    e.stopPropagation()
    e.preventDefault()
    setSelectedOverlayId(ov.id)
    setTab("elements")
    overlayInteractionRef.current = {
      kind: "move",
      id: ov.id,
      pointerId: e.pointerId,
      startPx: e.clientX,
      startPy: e.clientY,
      startX: ov.x,
      startY: ov.y,
    }
  }, [])

  const startOverlayRotate = useCallback((e: React.PointerEvent, ov: PlacedStudioOverlay) => {
    e.stopPropagation()
    e.preventDefault()
    setSelectedOverlayId(ov.id)
    const stage = previewStageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    const centerPx = rect.left + (ov.x / 100) * rect.width
    const centerPy = rect.top + (ov.y / 100) * rect.height
    const startAngle = (Math.atan2(e.clientY - centerPy, e.clientX - centerPx) * 180) / Math.PI
    overlayInteractionRef.current = {
      kind: "rotate",
      id: ov.id,
      pointerId: e.pointerId,
      centerPx,
      centerPy,
      startAngle,
      startRotation: ov.rotation,
    }
  }, [])

  const removeSelectedOverlay = useCallback(() => {
    if (!selectedOverlayId) return
    setPlacedOverlays((prev) => prev.filter((o) => o.id !== selectedOverlayId))
    setSelectedOverlayId(null)
  }, [selectedOverlayId])

  const subtitleLine = useMemo(() => {
    if (voiceLineCues && voiceLineCues.length > 0 && audioSrc) {
      return voiceSubtitleAtLineCues(voiceLineCues, audioPlayhead)
    }
    return fallbackSubtitleLine
  }, [voiceLineCues, audioSrc, audioPlayhead, fallbackSubtitleLine])

  const applyAvSync = useCallback(() => {
    const vid = videoRef.current
    const aud = audioRef.current
    if (!vid || !aud || !audioSrc) return
    const ad = Number.isFinite(aud.duration) && aud.duration > 0.05 ? aud.duration : aDur
    const vd = Number.isFinite(vid.duration) && vid.duration > 0.05 ? vid.duration : vDur
    if (ad <= 0 || vd <= 0) return
    vid.currentTime = Math.min(vd - 0.02, Math.max(0, (aud.currentTime / ad) * vd))
    vid.playbackRate = Math.min(4, Math.max(0.25, vd / ad))
  }, [audioSrc, aDur, vDur])

  useEffect(() => {
    if (!open) return
    setAudioPlayhead(initialAudioPlayheadSec)
    setPlaying(false)
    const t = requestAnimationFrame(() => {
      const aud = audioRef.current
      const vid = videoRef.current
      if (aud && audioSrc) {
        aud.currentTime = Math.min(aDur - 0.01, Math.max(0, initialAudioPlayheadSec))
      }
      if (vid) {
        const vd = Number.isFinite(vid.duration) && vid.duration > 0.05 ? vid.duration : vDur
        if (aDur > 0) {
          vid.currentTime = Math.min(vd - 0.02, Math.max(0, (initialAudioPlayheadSec / aDur) * vd))
        }
        if (aud && audioSrc) applyAvSync()
        else vid.playbackRate = 1
      }
    })
    return () => cancelAnimationFrame(t)
  }, [open, initialAudioPlayheadSec, audioKey, audioSrc, aDur, vDur, applyAvSync])

  const togglePlay = useCallback(() => {
    const vid = videoRef.current
    const aud = audioRef.current
    if (!vid) return
    if (playing) {
      vid.pause()
      aud?.pause()
      vid.playbackRate = 1
      setPlaying(false)
      return
    }
    if (aud && audioSrc) {
      const ad = Number.isFinite(aud.duration) && aud.duration > 0.05 ? aud.duration : aDur
      const vd = Number.isFinite(vid.duration) && vid.duration > 0.05 ? vid.duration : vDur
      if (ad > 0 && vd > 0) {
        aud.currentTime = Math.min(ad - 0.01, Math.max(0, (vid.currentTime / vd) * ad))
        setAudioPlayhead(aud.currentTime)
        applyAvSync()
      }
      void aud.play().catch(() => onToast?.("음성 재생을 시작할 수 없습니다."))
    } else {
      vid.playbackRate = 1
    }
    void vid.play().catch(() => onToast?.("영상 재생을 시작할 수 없습니다."))
    setPlaying(true)
  }, [playing, audioSrc, aDur, vDur, applyAvSync, onToast])

  const seekAudioRatio = useCallback(
    (ratio: number) => {
      const aud = audioRef.current
      const vid = videoRef.current
      if (!aud || !audioSrc) return
      const ad = Number.isFinite(aud.duration) && aud.duration > 0.05 ? aud.duration : aDur
      const t = Math.min(ad - 0.01, Math.max(0, ratio * ad))
      aud.currentTime = t
      setAudioPlayhead(t)
      if (vid) {
        const vd = Number.isFinite(vid.duration) && vid.duration > 0.05 ? vid.duration : vDur
        if (ad > 0 && vd > 0) {
          vid.currentTime = Math.min(vd - 0.02, (t / ad) * vd)
          if (audioSrc) applyAvSync()
        }
      }
    },
    [audioSrc, aDur, vDur, applyAvSync]
  )

  const handleClose = useCallback(
    (next: boolean) => {
      if (!next) {
        const aud = audioRef.current
        const t = aud && Number.isFinite(aud.currentTime) ? aud.currentTime : audioPlayhead
        onCloseSync?.(t)
      }
      setPlaying(false)
      videoRef.current?.pause()
      audioRef.current?.pause()
      if (videoRef.current) videoRef.current.playbackRate = 1
      onOpenChange(next)
    },
    [onOpenChange, onCloseSync, audioPlayhead]
  )

  const cueBlocks = voiceLineCues && voiceLineCues.length > 0 && aDur > 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "fixed inset-0 left-0 top-0 z-50 flex h-[100dvh] max-h-none w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-[#0b0f18] p-0 text-slate-100 shadow-none sm:max-w-none"
        )}
      >
        {/* 상단 바 */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-800/90 bg-[#0e1420] px-3 sm:px-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
            onClick={() => handleClose(false)}
          >
            <ArrowLeft className="h-4 w-4" />
            뒤로가기
          </Button>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              type="button"
              size="sm"
              className="bg-emerald-600 text-xs text-white hover:bg-emerald-500"
              onClick={() => onToast?.("보내기는 워커·인코딩 API 연동 후 제공됩니다.")}
            >
              <Upload className="mr-1 h-3.5 w-3.5" />
              보내기
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* 중앙 프리뷰 */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col border-b border-slate-800/80 lg:border-b-0 lg:border-r">
            <div className="flex flex-1 items-center justify-center overflow-auto bg-[#06080d] p-3 sm:p-6">
              <div
                ref={previewStageRef}
                className="relative aspect-[9/16] w-[min(100%,280px)] overflow-hidden rounded-lg border border-slate-700 bg-black shadow-2xl"
                onPointerDown={(e) => {
                  const t = e.target as HTMLElement
                  if (!t.closest("[data-overlay-id]")) setSelectedOverlayId(null)
                }}
              >
                <video
                  ref={videoRef}
                  className="pointer-events-none h-full w-full object-cover"
                  src={videoSrc}
                  poster={videoPoster}
                  playsInline
                  muted
                  preload="metadata"
                  onLoadedMetadata={() => {
                    const aud = audioRef.current
                    if (aud && audioSrc) applyAvSync()
                  }}
                  onPlay={() => {
                    const aud = audioRef.current
                    if (aud && audioSrc) applyAvSync()
                  }}
                />
                {audioSrc ? (
                  <audio
                    ref={audioRef}
                    key={audioKey}
                    src={audioSrc}
                    className="hidden"
                    preload="auto"
                    onTimeUpdate={(e) => {
                      setAudioPlayhead(e.currentTarget.currentTime)
                    }}
                    onEnded={() => {
                      setPlaying(false)
                      videoRef.current?.pause()
                      const v = videoRef.current
                      if (v) v.playbackRate = 1
                    }}
                  />
                ) : null}
                {placedOverlays.map((ov) => {
                  const selected = selectedOverlayId === ov.id
                  return (
                    <div
                      key={ov.id}
                      data-overlay-id={ov.id}
                      className="absolute z-[2] touch-none select-none"
                      style={{
                        left: `${ov.x}%`,
                        top: `${ov.y}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                      onPointerDown={(e) => startOverlayMove(e, ov)}
                    >
                      <div
                        className={cn(
                          "relative cursor-grab active:cursor-grabbing",
                          selected && "rounded-md ring-2 ring-sky-400 ring-offset-1 ring-offset-black/50"
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
                          <div className="h-3 w-px bg-sky-400/70" aria-hidden />
                          <button
                            type="button"
                            title="드래그하여 회전"
                            className="mt-0.5 flex h-5 w-5 cursor-grab items-center justify-center rounded-full border-2 border-sky-400 bg-slate-900 text-[9px] text-sky-300 active:cursor-grabbing"
                            onPointerDown={(e) => startOverlayRotate(e, ov)}
                          >
                            ↻
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
                {subtitleLine ? (
                  <div
                    className="pointer-events-none absolute z-[3] max-w-[min(96%,20rem)] min-w-0 overflow-hidden text-ellipsis whitespace-nowrap px-2 text-center leading-snug"
                    style={{
                      left: `${50 + (subX - 540) / 35}%`,
                      top: `${50 + (150 - subY) / 25}%`,
                      transform: "translate(-50%, -50%)",
                      fontFamily: subFontCss,
                      fontWeight: subFontWeight,
                      fontSize: `${subSizePx}px`,
                      color: subColor,
                      textShadow: subOutlineOn
                        ? Array.from({ length: 8 }, () => `0 0 ${subOutlineW}px ${subOutlineColor}`).join(", ")
                        : undefined,
                      backgroundColor: subBgOn ? `${subBgColor}${Math.round((subBgOpacity / 100) * 255)
                        .toString(16)
                        .padStart(2, "0")}` : undefined,
                      borderRadius: subBgOn ? 8 : undefined,
                      padding: subBgOn ? "6px 10px" : undefined,
                    }}
                  >
                    {subtitleLine}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* 우측 패널 */}
          <aside className="flex w-full shrink-0 flex-col border-t border-slate-800/80 bg-[#0e1420] lg:w-[min(100%,380px)] lg:border-l lg:border-t-0">
            <div className="flex shrink-0 gap-0 overflow-x-auto border-b border-slate-800/90 px-1 text-[11px]">
              {(
                [
                  ["shorts", "쇼츠 제작"],
                  ["subs", "자막"],
                  ["elements", "요소·배경"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={cn(
                    "shrink-0 border-b-2 px-2.5 py-2.5 font-medium transition-colors sm:px-3",
                    tab === id ? "border-sky-500 text-white" : "border-transparent text-slate-500 hover:text-slate-300"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="min-h-[200px] flex-1 overflow-y-auto p-4">
              {tab === "shorts" && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-slate-400">글꼴</Label>
                    <Select value={subFont} onValueChange={onSubFont}>
                      <SelectTrigger className="mt-1.5 border-slate-700 bg-slate-900 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FONT_OPTIONS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-slate-400">크기</Label>
                      <Input
                        type="number"
                        min={12}
                        max={48}
                        value={subSizePx}
                        onChange={(e) => onSubSizePx(Number(e.target.value) || 21)}
                        className="mt-1.5 border-slate-700 bg-slate-900 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-400">굵기</Label>
                      <Select value={subWeight} onValueChange={(v) => onSubWeight(v as typeof subWeight)}>
                        <SelectTrigger className="mt-1.5 border-slate-700 bg-slate-900 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">일반</SelectItem>
                          <SelectItem value="bold">굵게</SelectItem>
                          <SelectItem value="extrabold">아주 굵게</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">색상</Label>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {SUB_COLOR_PRESETS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          title={c}
                          className={cn(
                            "h-8 w-8 rounded-full border-2 transition-transform",
                            subColor.toLowerCase() === c.toLowerCase() ? "scale-110 border-white" : "border-slate-600"
                          )}
                          style={{ backgroundColor: c }}
                          onClick={() => onSubColor(c)}
                        />
                      ))}
                      <input
                        type="color"
                        value={subColor}
                        onChange={(e) => onSubColor(e.target.value)}
                        className="h-8 w-10 cursor-pointer rounded border border-slate-600 bg-slate-900"
                        title="색 직접 선택"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-slate-400">배경</Label>
                      <div className="mt-1.5 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={subBgOn}
                          onChange={(e) => onSubBgOn(e.target.checked)}
                          className="rounded border-slate-600"
                        />
                        <input
                          type="color"
                          value={subBgColor}
                          onChange={(e) => onSubBgColor(e.target.value)}
                          className="h-8 flex-1 cursor-pointer rounded border border-slate-600"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-400">외곽선</Label>
                      <div className="mt-1.5 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={subOutlineOn}
                          onChange={(e) => onSubOutlineOn(e.target.checked)}
                          className="rounded border-slate-600"
                        />
                        <input
                          type="color"
                          value={subOutlineColor}
                          onChange={(e) => onSubOutlineColor(e.target.value)}
                          className="h-8 flex-1 cursor-pointer rounded border border-slate-600"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">배경 투명도 {subBgOpacity}%</Label>
                    <Slider
                      className="mt-2"
                      min={0}
                      max={100}
                      step={1}
                      value={[subBgOpacity]}
                      onValueChange={(v) => onSubBgOpacity(v[0] ?? 60)}
                      disabled={!subBgOn}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">외곽선 두께 {subOutlineW}px</Label>
                    <Slider
                      className="mt-2"
                      min={0}
                      max={4}
                      step={1}
                      value={[subOutlineW]}
                      onValueChange={(v) => onSubOutlineW(v[0] ?? 1)}
                      disabled={!subOutlineOn}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">위치 X / Y</Label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Slider min={0} max={1080} step={5} value={[subX]} onValueChange={(v) => onSubX(v[0] ?? 540)} />
                      <Slider min={0} max={300} step={5} value={[subY]} onValueChange={(v) => onSubY(v[0] ?? 150)} />
                    </div>
                  </div>
                </div>
              )}
              {tab === "subs" && (
                <div className="space-y-3">
                  <p className="text-[11px] text-slate-500">장면을 고른 뒤 대본을 수정합니다. 저장 후 메인에서 「음성 다시 생성」으로 TTS를 갱신하세요.</p>
                  <div className="flex flex-wrap gap-1">
                    {scenes.map((sc) => (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={() => onVoiceEditSceneId(sc.id)}
                        className={cn(
                          "rounded-md border px-2 py-1 text-xs font-medium",
                          voiceEditSceneId === sc.id
                            ? studio.btnSegmentActive
                            : "border-slate-700 text-slate-400 hover:border-slate-600"
                        )}
                      >
                        {sc.id}
                      </button>
                    ))}
                  </div>
                  <Textarea
                    value={getVoiceSceneText(voiceEditSceneId)}
                    onChange={(e) => onVoiceSceneText(voiceEditSceneId, e.target.value)}
                    className="min-h-[140px] border-slate-700 bg-slate-900 text-sm text-slate-100"
                    spellCheck={false}
                  />
                </div>
              )}
              {tab === "elements" && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-slate-400">추가할 요소 색상</Label>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {SUB_COLOR_PRESETS.map((c) => (
                        <button
                          key={`ov-${c}`}
                          type="button"
                          title={c}
                          className={cn(
                            "h-7 w-7 rounded-full border-2 transition-transform",
                            overlayPickColor.toLowerCase() === c.toLowerCase() ? "scale-110 border-white" : "border-slate-600"
                          )}
                          style={{ backgroundColor: c }}
                          onClick={() => setOverlayPickColor(c)}
                        />
                      ))}
                      <input
                        type="color"
                        value={overlayPickColor}
                        onChange={(e) => setOverlayPickColor(e.target.value)}
                        className="h-7 w-9 cursor-pointer rounded border border-slate-600 bg-slate-900"
                        title="색 직접 선택"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-slate-400">아이콘 모음집</Label>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {STUDIO_OVERLAY_CATEGORIES.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setOverlayCategory(cat.id)}
                          className={cn(
                            "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
                            overlayCategory === cat.id
                              ? "border-sky-500 bg-sky-600/20 text-white"
                              : "border-slate-700 text-slate-400 hover:border-slate-600"
                          )}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
                      {filteredOverlayCatalog.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          title={entry.label}
                          onClick={() => addOverlayFromCatalog(entry.id)}
                          className="flex flex-col items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/70 px-1 py-2 transition-colors hover:border-sky-500/60 hover:bg-sky-950/25"
                        >
                          <StudioOverlayCatalogThumb entry={entry} color={overlayPickColor} />
                          <span className="max-w-full truncate px-0.5 text-[9px] text-slate-500">{entry.label}</span>
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                      아이콘을 누르면 프리뷰 중앙에 추가됩니다. 프리뷰에서 드래그로 이동, 아래 ↻ 핸들로 회전, 빈 화면
                      클릭 시 선택 해제됩니다.
                    </p>
                  </div>

                  {selectedOverlay ? (
                    <div className="space-y-3 rounded-lg border border-sky-500/40 bg-sky-950/15 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-sky-100">선택한 요소</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                          onClick={removeSelectedOverlay}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          삭제
                        </Button>
                      </div>
                      <div className="flex justify-center py-1">
                        <StudioOverlayGraphic
                          catalogId={selectedOverlay.catalogId}
                          color={selectedOverlay.color}
                          size={Math.min(56, selectedOverlay.size)}
                          filled={selectedOverlay.filled}
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] text-slate-400">색상</Label>
                        <input
                          type="color"
                          value={selectedOverlay.color}
                          onChange={(e) => updateSelectedOverlay({ color: e.target.value })}
                          className="mt-1.5 h-8 w-full cursor-pointer rounded border border-slate-600 bg-slate-900"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] text-slate-400">크기 {selectedOverlay.size}px</Label>
                        <Slider
                          className="mt-2"
                          min={20}
                          max={120}
                          step={2}
                          value={[selectedOverlay.size]}
                          onValueChange={(v) => updateSelectedOverlay({ size: v[0] ?? 48 })}
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] text-slate-400">회전 {selectedOverlay.rotation}°</Label>
                        <Slider
                          className="mt-2"
                          min={-180}
                          max={180}
                          step={5}
                          value={[selectedOverlay.rotation]}
                          onValueChange={(v) => updateSelectedOverlay({ rotation: v[0] ?? 0 })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[11px] text-slate-400">가로 {Math.round(selectedOverlay.x)}%</Label>
                          <Slider
                            className="mt-2"
                            min={5}
                            max={95}
                            step={1}
                            value={[selectedOverlay.x]}
                            onValueChange={(v) => updateSelectedOverlay({ x: v[0] ?? 50 })}
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] text-slate-400">세로 {Math.round(selectedOverlay.y)}%</Label>
                          <Slider
                            className="mt-2"
                            min={5}
                            max={95}
                            step={1}
                            value={[selectedOverlay.y]}
                            onValueChange={(v) => updateSelectedOverlay({ y: v[0] ?? 50 })}
                          />
                        </div>
                      </div>
                    </div>
                  ) : placedOverlays.length > 0 ? (
                    <p className="text-[11px] text-slate-500">프리뷰의 요소를 눌러 편집하거나, 위 모음집에서 추가하세요.</p>
                  ) : null}
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* 하단 타임라인 */}
        <footer className="flex shrink-0 flex-col border-t border-slate-800/90 bg-[#0e1420]">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-800/80 px-2 py-2 sm:px-3">
            <div className="ml-auto flex items-center gap-2">
              <Label className="text-[10px] text-slate-500">속도</Label>
              <Select value={String(speed)} onValueChange={(v) => setSpeed(Number(v))}>
                <SelectTrigger className="h-8 w-[72px] border-slate-700 bg-slate-900 text-xs text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0.75, 1, 1.25, 1.5].map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      {s}x
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 text-violet-300"
              onClick={() => onToast?.("고급 오디오(노이즈 제거 등)는 추후 연결됩니다.")}
            >
              <Wand2 className="mr-1 h-3.5 w-3.5" />
              오디오
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-1 border-b border-slate-800/80 px-2 py-1.5 sm:px-3">
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-slate-400" onClick={() => onToast?.("실행 취소는 추후 지원")}>
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-slate-400" onClick={() => onToast?.("다시 실행은 추후 지원")}>
              <Redo2 className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-slate-400" onClick={() => onToast?.("앞 트림은 추후 지원")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-slate-400" onClick={() => onToast?.("분할은 추후 지원")}>
              <Scissors className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-slate-400" onClick={() => onToast?.("뒤 트림은 추후 지원")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-slate-400" onClick={() => onToast?.("삭제는 추후 지원")}>
              <Trash2 className="h-4 w-4" />
            </Button>
            <div className="mx-2 h-5 w-px bg-slate-700" />
            <Button
              type="button"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full bg-emerald-600 text-white hover:bg-emerald-500"
              title={playing ? "일시정지" : "재생"}
              onClick={togglePlay}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
            </Button>
            <Button type="button" size="sm" variant="ghost" className="text-[11px] text-slate-400" onClick={() => seekAudioRatio(0)}>
              처음
            </Button>
            <span className="font-mono text-[11px] tabular-nums text-slate-400">
              {formatMmSs(audioPlayhead)} / {formatMmSs(aDur)}
            </span>
            <div className="flex min-w-[120px] flex-1 items-center gap-2 px-2">
              <span className="text-[10px] text-slate-500">줌</span>
              <Slider min={0.5} max={2} step={0.1} value={[timelineZoom]} onValueChange={(v) => setTimelineZoom(v[0] ?? 1)} className="flex-1" />
            </div>
          </div>
          <div className="max-h-[min(40vh,220px)] min-h-[140px] overflow-x-auto overflow-y-hidden p-2 sm:p-3">
            <div className="relative" style={{ width: `${100 * timelineZoom}%`, minWidth: "100%" }}>
              {/* 시간 눈금 */}
              <div className="mb-1 flex h-5 border-b border-slate-700/80 pl-14 text-[10px] text-slate-500">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="flex-1 border-l border-slate-700/50 pl-1">
                    {formatMmSs((aDur * i) / 8)}
                  </div>
                ))}
              </div>
              {/* 자막 트랙 */}
              <div className="mb-1 flex items-stretch gap-2">
                <div className="flex w-12 shrink-0 items-center justify-end pr-1 text-[10px] text-slate-500">자막</div>
                <div
                  className="relative h-11 flex-1 cursor-pointer rounded-md bg-slate-900/90 ring-1 ring-slate-700/80"
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect()
                    const x = e.clientX - r.left
                    seekAudioRatio(x / r.width)
                  }}
                >
                  {cueBlocks &&
                    voiceLineCues!.map((c, i) => {
                      const left = (c.startSec / aDur) * 100
                      const w = Math.max(0.5, ((c.endSec - c.startSec) / aDur) * 100)
                      return (
                        <div
                          key={i}
                          title={c.text}
                          className={cn("absolute top-1 bottom-1 overflow-hidden rounded px-1 text-[9px] leading-tight", studio.badgeAccent)}
                          style={{ left: `${left}%`, width: `${w}%` }}
                        >
                          <span className="line-clamp-2">{c.text}</span>
                        </div>
                      )
                    })}
                  <div
                    className="absolute bottom-0 top-0 z-10 w-0.5 bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]"
                    style={{ left: `${Math.min(100, (audioPlayhead / aDur) * 100)}%` }}
                  />
                </div>
              </div>
              {/* 오디오 파형(데모) */}
              <div className="flex items-stretch gap-2">
                <div className="flex w-12 shrink-0 items-center justify-end pr-1 text-[10px] text-slate-500">음성</div>
                <div
                  className="relative h-14 flex-1 cursor-pointer rounded-md bg-slate-900/90 ring-1 ring-slate-700/80"
                  style={{
                    backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(56,189,248,0.12) 2px, rgba(56,189,248,0.12) 4px)`,
                  }}
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect()
                    seekAudioRatio((e.clientX - r.left) / r.width)
                  }}
                >
                  <div
                    className="absolute inset-y-1 left-0 rounded-sm bg-sky-500/25"
                    style={{ width: `${Math.min(100, (audioPlayhead / aDur) * 100)}%` }}
                  />
                  <div
                    className="absolute bottom-0 top-0 z-10 w-0.5 bg-red-500"
                    style={{ left: `${Math.min(100, (audioPlayhead / aDur) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  )
}
