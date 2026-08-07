"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { Pause, Play, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { StoryVideoMosaicLayer } from "./StoryVideoMosaicLayer"
import type { StoryVideoMosaic } from "./story-types"

type ResizeDirection = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w"

const RESIZE_HANDLES: Array<[ResizeDirection, string]> = [
  ["nw", "-left-1.5 -top-1.5 cursor-nwse-resize"],
  ["n", "left-1/2 -top-1.5 -translate-x-1/2 cursor-ns-resize"],
  ["ne", "-right-1.5 -top-1.5 cursor-nesw-resize"],
  ["e", "-right-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize"],
  ["se", "-bottom-1.5 -right-1.5 cursor-nwse-resize"],
  ["s", "-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize"],
  ["sw", "-bottom-1.5 -left-1.5 cursor-nesw-resize"],
  ["w", "-left-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize"],
]
const EMPTY_MOSAICS: StoryVideoMosaic[] = []

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

const formatTime = (value: number) => {
  const safe = Math.max(0, value)
  const minutes = Math.floor(safe / 60)
  const seconds = (safe % 60).toFixed(1).padStart(4, "0")
  return `${minutes}:${seconds}`
}

export type StoryVideoEditResult = {
  trimStartSec: number
  trimEndSec: number
  videoMosaics: StoryVideoMosaic[]
  mediaScale: number
  mediaOffsetX: number
  mediaOffsetY: number
}

export function StoryVideoTrimMosaicDialog({
  open,
  src,
  minimumDurationSec,
  initialTrimStartSec = 0,
  initialTrimEndSec,
  initialMosaics = EMPTY_MOSAICS,
  initialMediaScale = 1,
  initialMediaOffsetX = 0,
  initialMediaOffsetY = 0,
  fit = "cover",
  onOpenChange,
  onApply,
}: {
  open: boolean
  src: string
  minimumDurationSec: number
  initialTrimStartSec?: number
  initialTrimEndSec?: number
  initialMosaics?: StoryVideoMosaic[]
  initialMediaScale?: number
  initialMediaOffsetX?: number
  initialMediaOffsetY?: number
  fit?: "cover" | "contain"
  onOpenChange: (open: boolean) => void
  onApply: (result: StoryVideoEditResult) => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const trimTrackRef = useRef<HTMLDivElement | null>(null)
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null)
  const [durationSec, setDurationSec] = useState(0)
  const [trimRange, setTrimRange] = useState<[number, number]>([0, 0])
  const [currentSec, setCurrentSec] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [mosaics, setMosaics] = useState<StoryVideoMosaic[]>([])
  const [selectedMosaicId, setSelectedMosaicId] = useState<string | null>(null)
  const [isVideoSelected, setIsVideoSelected] = useState(true)
  const [mediaTransform, setMediaTransform] = useState({
    scale: initialMediaScale,
    offsetX: initialMediaOffsetX,
    offsetY: initialMediaOffsetY,
  })
  const [stageSize, setStageSize] = useState({ width: 270, height: 480 })
  const [loadError, setLoadError] = useState("")
  const [timelineFrames, setTimelineFrames] = useState<string[]>([])

  const minimumDuration = Math.max(0.1, minimumDurationSec)
  const trimmedDuration = Math.max(0, trimRange[1] - trimRange[0])
  const localTimeSec = clamp(currentSec - trimRange[0], 0, trimmedDuration)
  const selectedMosaic = mosaics.find((mosaic) => mosaic.id === selectedMosaicId)
  const isTooShort = durationSec > 0 && durationSec + 0.01 < minimumDuration
  const canApply =
    durationSec > 0 &&
    !isTooShort &&
    trimmedDuration + 0.01 >= minimumDuration &&
    trimRange[1] <= durationSec + 0.01

  useEffect(() => {
    if (!open) return
    setDurationSec(0)
    setTrimRange([0, 0])
    setCurrentSec(0)
    setIsPlaying(false)
    setLoadError("")
    setTimelineFrames([])
    setMosaics(initialMosaics.map((mosaic) => ({ ...mosaic })))
    setSelectedMosaicId(initialMosaics[0]?.id || null)
    setIsVideoSelected(initialMosaics.length === 0)
    setMediaTransform({
      scale: initialMediaScale,
      offsetX: initialMediaOffsetX,
      offsetY: initialMediaOffsetY,
    })
  }, [
    initialMediaOffsetX,
    initialMediaOffsetY,
    initialMediaScale,
    initialMosaics,
    open,
    src,
  ])

  useEffect(() => {
    if (!open || durationSec <= 0) return
    let cancelled = false
    const sourceVideo = document.createElement("video")
    sourceVideo.muted = true
    sourceVideo.playsInline = true
    sourceVideo.preload = "auto"
    if (/^https?:\/\//i.test(src)) sourceVideo.crossOrigin = "anonymous"

    const waitForSeek = () =>
      new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(
          () => reject(new Error("thumbnail seek timeout")),
          2500
        )
        sourceVideo.addEventListener(
          "seeked",
          () => {
            window.clearTimeout(timeout)
            resolve()
          },
          { once: true }
        )
      })

    const generate = async () => {
      try {
        await new Promise<void>((resolve, reject) => {
          sourceVideo.addEventListener("loadedmetadata", () => resolve(), {
            once: true,
          })
          sourceVideo.addEventListener("error", () => reject(), { once: true })
          sourceVideo.src = src
          sourceVideo.load()
        })
        const frames: string[] = []
        const frameCount = 12
        const canvas = document.createElement("canvas")
        canvas.width = 120
        canvas.height = 68
        const context = canvas.getContext("2d")
        if (!context) return
        for (let index = 0; index < frameCount; index += 1) {
          if (cancelled) return
          sourceVideo.currentTime = Math.min(
            Math.max(0, durationSec - 0.05),
            (durationSec * (index + 0.5)) / frameCount
          )
          await waitForSeek()
          context.drawImage(sourceVideo, 0, 0, canvas.width, canvas.height)
          frames.push(canvas.toDataURL("image/jpeg", 0.68))
        }
        if (!cancelled) setTimelineFrames(frames)
      } catch {
        if (!cancelled) setTimelineFrames([])
      }
    }
    void generate()
    return () => {
      cancelled = true
      sourceVideo.removeAttribute("src")
      sourceVideo.load()
    }
  }, [durationSec, open, src])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const update = () => {
      const rect = stage.getBoundingClientRect()
      setStageSize({ width: rect.width, height: rect.height })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [open])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (isPlaying) void video.play().catch(() => setIsPlaying(false))
    else video.pause()
  }, [isPlaying])

  const updateTrimRange = (nextStart: number, nextEnd: number, seekToStart = false) => {
    if (!durationSec) return
    const start = clamp(nextStart, 0, Math.max(0, durationSec - minimumDuration))
    const end = clamp(
      nextEnd,
      Math.min(durationSec, start + minimumDuration),
      durationSec
    )
    const nextDuration = end - start
    setTrimRange([start, end])
    setMosaics((current) =>
      current.map((mosaic) => {
        const startSec = clamp(
          mosaic.startSec,
          0,
          Math.max(0, nextDuration - 0.1)
        )
        return {
          ...mosaic,
          startSec,
          endSec: clamp(mosaic.endSec, startSec + 0.05, nextDuration),
        }
      })
    )
    if (seekToStart && videoRef.current) {
      videoRef.current.currentTime = start
      setCurrentSec(start)
    }
  }

  const seekFromTrackPointer = (clientX: number) => {
    const rect = trimTrackRef.current?.getBoundingClientRect()
    if (!rect || !durationSec) return
    const time = clamp(
      ((clientX - rect.left) / Math.max(1, rect.width)) * durationSec,
      trimRange[0],
      trimRange[1]
    )
    if (videoRef.current) videoRef.current.currentTime = time
    setCurrentSec(time)
  }

  const beginTrimHandleDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    edge: "start" | "end"
  ) => {
    event.preventDefault()
    event.stopPropagation()
    const rect = trimTrackRef.current?.getBoundingClientRect()
    if (!rect || !durationSec) return
    const originalRange = trimRange
    const move = (moveEvent: PointerEvent) => {
      const time = clamp(
        ((moveEvent.clientX - rect.left) / Math.max(1, rect.width)) *
          durationSec,
        0,
        durationSec
      )
      if (edge === "start") {
        const start = Math.min(
          time,
          Math.max(0, originalRange[1] - minimumDuration)
        )
        updateTrimRange(start, originalRange[1], true)
      } else {
        const end = Math.max(
          time,
          Math.min(durationSec, originalRange[0] + minimumDuration)
        )
        updateTrimRange(originalRange[0], end)
        const previewTime = Math.max(originalRange[0], end - 0.04)
        if (videoRef.current) videoRef.current.currentTime = previewTime
        setCurrentSec(previewTime)
      }
    }
    const stop = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", stop)
      window.removeEventListener("pointercancel", stop)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", stop)
    window.addEventListener("pointercancel", stop)
  }

  const beginVideoMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsVideoSelected(true)
    setSelectedMosaicId(null)
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return
    const startX = event.clientX
    const startY = event.clientY
    const initial = mediaTransform
    const move = (moveEvent: PointerEvent) => {
      setMediaTransform({
        ...initial,
        offsetX: clamp(
          initial.offsetX +
            ((moveEvent.clientX - startX) / rect.width) * 100,
          -100,
          100
        ),
        offsetY: clamp(
          initial.offsetY +
            ((moveEvent.clientY - startY) / rect.height) * 100,
          -100,
          100
        ),
      })
    }
    const stop = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", stop)
      window.removeEventListener("pointercancel", stop)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", stop)
    window.addEventListener("pointercancel", stop)
  }

  const beginVideoResize = (
    event: ReactPointerEvent<HTMLSpanElement>
  ) => {
    event.preventDefault()
    event.stopPropagation()
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return
    setIsVideoSelected(true)
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const startDistance = Math.max(
      1,
      Math.hypot(event.clientX - centerX, event.clientY - centerY)
    )
    const initial = mediaTransform
    const move = (moveEvent: PointerEvent) => {
      const distance = Math.max(
        1,
        Math.hypot(moveEvent.clientX - centerX, moveEvent.clientY - centerY)
      )
      setMediaTransform({
        ...initial,
        scale: clamp(
          initial.scale * (distance / startDistance),
          0.5,
          3
        ),
      })
    }
    const stop = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", stop)
      window.removeEventListener("pointercancel", stop)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", stop)
    window.addEventListener("pointercancel", stop)
  }

  const addMosaic = () => {
    const next: StoryVideoMosaic = {
      id: `mosaic-${Date.now()}`,
      x: 50,
      y: 50,
      width: 36,
      height: 18,
      startSec: 0,
      endSec: Math.max(0.1, trimmedDuration),
      blockSize: 12,
    }
    setMosaics((current) => [...current, next])
    setSelectedMosaicId(next.id)
    setIsVideoSelected(false)
  }

  const patchMosaic = (id: string, patch: Partial<StoryVideoMosaic>) => {
    setMosaics((current) =>
      current.map((mosaic) => (mosaic.id === id ? { ...mosaic, ...patch } : mosaic))
    )
  }

  const beginMosaicMove = (
    event: ReactPointerEvent<HTMLDivElement>,
    mosaic: StoryVideoMosaic
  ) => {
    event.preventDefault()
    event.stopPropagation()
    setSelectedMosaicId(mosaic.id)
    setIsVideoSelected(false)
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return
    const startX = event.clientX
    const startY = event.clientY
    const original = { ...mosaic }

    const move = (moveEvent: PointerEvent) => {
      const x = original.x + ((moveEvent.clientX - startX) / rect.width) * 100
      const y = original.y + ((moveEvent.clientY - startY) / rect.height) * 100
      patchMosaic(mosaic.id, {
        x: clamp(x, original.width / 2, 100 - original.width / 2),
        y: clamp(y, original.height / 2, 100 - original.height / 2),
      })
    }
    const stop = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", stop)
      window.removeEventListener("pointercancel", stop)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", stop)
    window.addEventListener("pointercancel", stop)
  }

  const beginMosaicResize = (
    event: ReactPointerEvent<HTMLSpanElement>,
    mosaic: StoryVideoMosaic,
    direction: ResizeDirection
  ) => {
    event.preventDefault()
    event.stopPropagation()
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return
    const startX = event.clientX
    const startY = event.clientY
    const original = { ...mosaic }

    const move = (moveEvent: PointerEvent) => {
      const dx = ((moveEvent.clientX - startX) / rect.width) * 100
      const dy = ((moveEvent.clientY - startY) / rect.height) * 100
      const affectsLeft = direction.includes("w")
      const affectsRight = direction.includes("e")
      const affectsTop = direction.includes("n")
      const affectsBottom = direction.includes("s")
      let left = original.x - original.width / 2
      let right = original.x + original.width / 2
      let top = original.y - original.height / 2
      let bottom = original.y + original.height / 2
      if (affectsLeft) left = clamp(left + dx, 0, right - 5)
      if (affectsRight) right = clamp(right + dx, left + 5, 100)
      if (affectsTop) top = clamp(top + dy, 0, bottom - 5)
      if (affectsBottom) bottom = clamp(bottom + dy, top + 5, 100)
      patchMosaic(mosaic.id, {
        x: (left + right) / 2,
        y: (top + bottom) / 2,
        width: right - left,
        height: bottom - top,
      })
    }
    const stop = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", stop)
      window.removeEventListener("pointercancel", stop)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", stop)
    window.addEventListener("pointercancel", stop)
  }

  const visibleMosaics = useMemo(
    () =>
      mosaics.filter(
        (mosaic) =>
          localTimeSec >= mosaic.startSec && localTimeSec <= mosaic.endSec
      ),
    [localTimeSec, mosaics]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[200]"
        className="z-[210] flex h-[94vh] w-[96vw] max-w-none flex-col gap-0 overflow-hidden border-slate-700 bg-slate-950 p-0 text-white sm:max-w-[1500px]"
      >
        <DialogHeader className="shrink-0 border-b border-white/10 px-5 py-4">
          <DialogTitle>비디오 자르기 · 모자이크</DialogTitle>
          <DialogDescription className="text-slate-400">
            선택 클립의 TTS 길이인 {minimumDuration.toFixed(1)}초 이상으로
            자르고 필요한 시간에 모자이크를 배치하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(520px,1fr)_400px]">
          <div className="flex min-h-0 flex-col items-center justify-center gap-3 overflow-auto bg-black/40 p-5">
            <div
              ref={stageRef}
              className="relative aspect-[9/16] h-[min(58vh,620px)] shrink-0 overflow-hidden rounded-lg bg-black shadow-2xl"
              onPointerDown={() => setSelectedMosaicId(null)}
            >
              <video
                ref={videoRef}
                src={src}
                muted
                playsInline
                className="h-full w-full"
                style={{
                  objectFit: fit,
                  transform: `translate(${mediaTransform.offsetX}%, ${mediaTransform.offsetY}%) scale(${mediaTransform.scale})`,
                  transformOrigin: "center",
                }}
                onError={() => {
                  setLoadError(
                    "영상을 재생하지 못했습니다. 원본 주소가 만료됐거나 재생이 차단되었습니다."
                  )
                  setIsPlaying(false)
                }}
                onLoadedMetadata={(event) => {
                  setLoadError("")
                  setVideoElement(event.currentTarget)
                  const duration = Number.isFinite(event.currentTarget.duration)
                    ? event.currentTarget.duration
                    : 0
                  const start = clamp(
                    initialTrimStartSec,
                    0,
                    Math.max(0, duration - minimumDuration)
                  )
                  const requestedEnd = initialTrimEndSec ?? duration
                  const end = clamp(
                    Math.max(start + Math.min(minimumDuration, duration), requestedEnd),
                    0,
                    duration
                  )
                  setDurationSec(duration)
                  setTrimRange([start, end])
                  setCurrentSec(start)
                  event.currentTarget.currentTime = start
                }}
                onTimeUpdate={(event) => {
                  const time = event.currentTarget.currentTime
                  if (time >= trimRange[1] - 0.01) {
                    event.currentTarget.currentTime = trimRange[0]
                    setCurrentSec(trimRange[0])
                    if (!isPlaying) event.currentTarget.pause()
                    return
                  }
                  setCurrentSec(time)
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />

              <div
                className={`absolute inset-0 z-10 touch-none cursor-move border-2 ${
                  isVideoSelected
                    ? "border-cyan-400"
                    : "border-transparent"
                }`}
                onPointerDown={beginVideoMove}
              >
                {isVideoSelected
                  ? [
                      "-left-1.5 -top-1.5 cursor-nwse-resize",
                      "-right-1.5 -top-1.5 cursor-nesw-resize",
                      "-bottom-1.5 -left-1.5 cursor-nesw-resize",
                      "-bottom-1.5 -right-1.5 cursor-nwse-resize",
                    ].map((position) => (
                      <span
                        key={position}
                        className={`absolute z-20 h-4 w-4 rounded-sm border-2 border-cyan-500 bg-white shadow ${position}`}
                        onPointerDown={beginVideoResize}
                      />
                    ))
                  : null}
                {isVideoSelected ? (
                  <span className="absolute left-2 top-2 rounded bg-cyan-500 px-2 py-1 text-[9px] font-black text-slate-950">
                    영상 선택됨 · 드래그 이동 · 모서리 크기 조절
                  </span>
                ) : null}
              </div>

              {loadError ? (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/85 p-6 text-center">
                  <div>
                    <p className="text-sm font-black text-red-300">
                      영상 불러오기 실패
                    </p>
                    <p className="mt-2 text-[11px] leading-5 text-slate-300">
                      {loadError}
                    </p>
                  </div>
                </div>
              ) : null}

              {visibleMosaics.map((mosaic) => (
                <StoryVideoMosaicLayer
                  key={mosaic.id}
                  video={videoElement}
                  mosaic={mosaic}
                  stageWidth={stageSize.width}
                  stageHeight={stageSize.height}
                  fit={fit}
                  playing={isPlaying}
                  videoTimeSec={currentSec}
                />
              ))}

              {visibleMosaics.map((mosaic) => (
                <div
                  key={`controls-${mosaic.id}`}
                  className={`absolute z-20 touch-none border-2 ${
                    selectedMosaicId === mosaic.id
                      ? "cursor-move border-blue-400"
                      : "cursor-pointer border-white/70"
                  }`}
                  style={{
                    left: `${mosaic.x}%`,
                    top: `${mosaic.y}%`,
                    width: `${mosaic.width}%`,
                    height: `${mosaic.height}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                  onPointerDown={(event) => beginMosaicMove(event, mosaic)}
                >
                  {selectedMosaicId === mosaic.id
                    ? RESIZE_HANDLES.map(([direction, position]) => (
                        <span
                          key={direction}
                          className={`absolute h-3 w-3 rounded-sm border border-blue-500 bg-white ${position}`}
                          onPointerDown={(event) =>
                            beginMosaicResize(event, mosaic, direction)
                          }
                        />
                      ))
                    : null}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-300">
              <Button
                type="button"
                size="icon"
                onClick={() => setIsPlaying((playing) => !playing)}
                className="h-9 w-9 rounded-full bg-white text-black hover:bg-slate-200"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <span className="min-w-24 tabular-nums">
                {formatTime(currentSec)} / {formatTime(durationSec)}
              </span>
            </div>

            <div className="w-full max-w-[980px] rounded-xl border border-white/10 bg-slate-900 p-3 shadow-xl">
              <div className="mb-2 flex items-center justify-between text-[10px] font-bold text-slate-400">
                <span>영상 타임라인 · 좌우 손잡이를 드래그해 사용할 구간 선택</span>
                <span className="tabular-nums text-blue-300">
                  {formatTime(trimRange[0])} — {formatTime(trimRange[1])}
                </span>
              </div>
              <div
                ref={trimTrackRef}
                className="relative h-20 cursor-pointer select-none overflow-hidden rounded-md bg-slate-800"
                onPointerDown={(event) => seekFromTrackPointer(event.clientX)}
              >
                <div className="absolute inset-0 flex">
                  {timelineFrames.length
                    ? timelineFrames.map((frame, index) => (
                        <img
                          key={`${index}-${frame.slice(-12)}`}
                          src={frame}
                          alt=""
                          draggable={false}
                          className="h-full min-w-0 flex-1 object-cover"
                        />
                      ))
                    : Array.from({ length: 12 }, (_, index) => (
                        <div
                          key={index}
                          className="h-full flex-1 border-r border-white/5 bg-gradient-to-br from-slate-700 to-slate-900"
                        />
                      ))}
                </div>

                <div
                  className="pointer-events-none absolute inset-y-0 left-0 bg-black/65"
                  style={{
                    width: `${(trimRange[0] / Math.max(0.1, durationSec)) * 100}%`,
                  }}
                />
                <div
                  className="pointer-events-none absolute inset-y-0 right-0 bg-black/65"
                  style={{
                    width: `${
                      ((durationSec - trimRange[1]) /
                        Math.max(0.1, durationSec)) *
                      100
                    }%`,
                  }}
                />
                <div
                  className="pointer-events-none absolute inset-y-0 rounded-sm border-y-2 border-blue-400"
                  style={{
                    left: `${(trimRange[0] / Math.max(0.1, durationSec)) * 100}%`,
                    width: `${
                      ((trimRange[1] - trimRange[0]) /
                        Math.max(0.1, durationSec)) *
                      100
                    }%`,
                  }}
                />

                <button
                  type="button"
                  aria-label="영상 시작점 조절"
                  className="absolute inset-y-0 z-20 w-5 -translate-x-1/2 cursor-ew-resize rounded-l-md border-2 border-blue-300 bg-blue-500 shadow-lg"
                  style={{
                    left: `${(trimRange[0] / Math.max(0.1, durationSec)) * 100}%`,
                  }}
                  onPointerDown={(event) =>
                    beginTrimHandleDrag(event, "start")
                  }
                >
                  <span className="mx-auto block h-8 w-0.5 rounded-full bg-white/90" />
                </button>
                <button
                  type="button"
                  aria-label="영상 끝점 조절"
                  className="absolute inset-y-0 z-20 w-5 -translate-x-1/2 cursor-ew-resize rounded-r-md border-2 border-blue-300 bg-blue-500 shadow-lg"
                  style={{
                    left: `${(trimRange[1] / Math.max(0.1, durationSec)) * 100}%`,
                  }}
                  onPointerDown={(event) =>
                    beginTrimHandleDrag(event, "end")
                  }
                >
                  <span className="mx-auto block h-8 w-0.5 rounded-full bg-white/90" />
                </button>

                <div
                  className="pointer-events-none absolute inset-y-0 z-30 w-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]"
                  style={{
                    left: `${(currentSec / Math.max(0.1, durationSec)) * 100}%`,
                  }}
                >
                  <span className="absolute -left-1.5 -top-0.5 h-2.5 w-3.5 rounded-b bg-red-500" />
                </div>
              </div>
              <div className="mt-1 flex justify-between text-[9px] tabular-nums text-slate-500">
                <span>0:00.0</span>
                <span>{formatTime(durationSec)}</span>
              </div>
            </div>
          </div>

          <div className="min-h-0 space-y-5 overflow-y-auto border-l border-white/10 p-5">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black">영상 크기·위치</h3>
                  <p className="mt-1 text-[10px] text-slate-400">
                    화면의 영상을 선택해 이동하거나 모서리를 드래그하세요.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setMediaTransform({ scale: 1, offsetX: 0, offsetY: 0 })
                    setIsVideoSelected(true)
                    setSelectedMosaicId(null)
                  }}
                  className="h-8 border-white/15 bg-white/5 text-[10px] text-white hover:bg-white/10 hover:text-white"
                >
                  초기화
                </Button>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="mb-2 flex justify-between text-[10px] font-bold text-slate-300">
                  <span>영상 크기</span>
                  <span className="text-cyan-300">
                    {Math.round(mediaTransform.scale * 100)}%
                  </span>
                </div>
                <Slider
                  value={[mediaTransform.scale]}
                  min={0.5}
                  max={3}
                  step={0.01}
                  onValueChange={([scale]) =>
                    setMediaTransform((current) => ({ ...current, scale }))
                  }
                />
                <div className="mt-3 grid grid-cols-2 gap-2 text-[9px] text-slate-400">
                  <span>X {mediaTransform.offsetX.toFixed(1)}%</span>
                  <span>Y {mediaTransform.offsetY.toFixed(1)}%</span>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black">자르기</h3>
                <span className="text-xs font-bold text-blue-300">
                  선택 {trimmedDuration.toFixed(1)}초
                </span>
              </div>
              <Slider
                value={trimRange}
                min={0}
                max={Math.max(0.1, durationSec)}
                step={0.05}
                minStepsBetweenThumbs={Math.max(1, Math.ceil(minimumDuration / 0.05))}
                disabled={!durationSec || isTooShort}
                onValueChange={([start, end]) => updateTrimRange(start, end)}
                onValueCommit={([start, end]) => updateTrimRange(start, end, true)}
              />
              <div className="grid grid-cols-2 gap-2">
                <Label className="space-y-1 text-[10px] text-slate-400">
                  <span>시작점</span>
                  <Input
                    type="number"
                    min={0}
                    max={Math.max(0, trimRange[1] - minimumDuration)}
                    step={0.1}
                    value={trimRange[0].toFixed(1)}
                    onChange={(event) =>
                      updateTrimRange(Number(event.target.value), trimRange[1], true)
                    }
                    className="border-white/10 bg-white/5 text-white"
                  />
                </Label>
                <Label className="space-y-1 text-[10px] text-slate-400">
                  <span>끝점</span>
                  <Input
                    type="number"
                    min={trimRange[0] + minimumDuration}
                    max={durationSec}
                    step={0.1}
                    value={trimRange[1].toFixed(1)}
                    onChange={(event) =>
                      updateTrimRange(trimRange[0], Number(event.target.value))
                    }
                    className="border-white/10 bg-white/5 text-white"
                  />
                </Label>
              </div>
              {isTooShort ? (
                <p className="rounded-md bg-red-500/15 p-2 text-[11px] text-red-300">
                  원본 영상이 {(minimumDuration - durationSec).toFixed(1)}초 부족합니다.
                  선택 클립보다 긴 영상을 업로드해주세요.
                </p>
              ) : null}
            </section>

            <section className="space-y-3 border-t border-white/10 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black">시간형 모자이크</h3>
                  <p className="mt-1 text-[10px] text-slate-400">
                    모자이크마다 표시 시간을 따로 지정할 수 있습니다.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={addMosaic}
                  disabled={!trimmedDuration}
                  className="h-8 bg-blue-600 text-white hover:bg-blue-500"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  추가
                </Button>
              </div>

              <div className="space-y-2">
                {mosaics.map((mosaic, index) => (
                  <button
                    key={mosaic.id}
                    type="button"
                    onClick={() => {
                      setSelectedMosaicId(mosaic.id)
                      setIsVideoSelected(false)
                      const nextTime = trimRange[0] + mosaic.startSec
                      if (videoRef.current) videoRef.current.currentTime = nextTime
                      setCurrentSec(nextTime)
                    }}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs ${
                      selectedMosaicId === mosaic.id
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <span>모자이크 {index + 1}</span>
                    <span className="tabular-nums text-slate-400">
                      {mosaic.startSec.toFixed(1)}~{mosaic.endSec.toFixed(1)}초
                    </span>
                  </button>
                ))}
              </div>

              {selectedMosaic ? (
                <div className="space-y-4 rounded-xl border border-blue-500/30 bg-blue-500/5 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">선택 모자이크 설정</span>
                    <button
                      type="button"
                      className="text-red-300 hover:text-red-200"
                      onClick={() => {
                        setMosaics((current) =>
                          current.filter((mosaic) => mosaic.id !== selectedMosaic.id)
                        )
                        setSelectedMosaicId(null)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>표시 시간</span>
                      <span>
                        {selectedMosaic.startSec.toFixed(1)}~
                        {selectedMosaic.endSec.toFixed(1)}초
                      </span>
                    </div>
                    <Slider
                      value={[selectedMosaic.startSec, selectedMosaic.endSec]}
                      min={0}
                      max={Math.max(0.1, trimmedDuration)}
                      step={0.05}
                      minStepsBetweenThumbs={1}
                      onValueChange={([startSec, endSec]) =>
                        patchMosaic(selectedMosaic.id, { startSec, endSec })
                      }
                      onValueCommit={([startSec]) => {
                        const nextTime = trimRange[0] + startSec
                        if (videoRef.current) videoRef.current.currentTime = nextTime
                        setCurrentSec(nextTime)
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>모자이크 강도</span>
                      <span>{selectedMosaic.blockSize}</span>
                    </div>
                    <Slider
                      value={[selectedMosaic.blockSize]}
                      min={4}
                      max={24}
                      step={1}
                      onValueChange={([blockSize]) =>
                        patchMosaic(selectedMosaic.id, { blockSize })
                      }
                    />
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-white/10 px-5 py-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button
            type="button"
            disabled={!canApply}
            onClick={() =>
              onApply({
                trimStartSec: trimRange[0],
                trimEndSec: trimRange[1],
                videoMosaics: mosaics,
                mediaScale: mediaTransform.scale,
                mediaOffsetX: mediaTransform.offsetX,
                mediaOffsetY: mediaTransform.offsetY,
              })
            }
            className="bg-blue-600 text-white hover:bg-blue-500"
          >
            편집 적용
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
