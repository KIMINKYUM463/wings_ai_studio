"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Film, Pause, Play, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"

type PreviewItem = {
  sceneIndex: number
  title: string
  videoUrl: string
  durationMs: number
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  audioUrl: string
  items: PreviewItem[]
}

const formatTime = (seconds: number) => {
  const safe = Math.max(0, seconds || 0)
  return `${Math.floor(safe / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(safe % 60)
    .toString()
    .padStart(2, "0")}`
}

export function SceneVideoTtsPreviewDialog({ open, onOpenChange, audioUrl, items }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const frameRef = useRef(0)
  const activeIndexRef = useRef(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const totalDuration = items.reduce((total, item) => total + item.durationMs / 1000, 0)

  const syncVideo = useCallback(() => {
    const audio = audioRef.current
    const video = videoRef.current
    if (!audio || !video || items.length === 0) return

    const elapsedMs = audio.currentTime * 1000
    let cursorMs = 0
    let itemIndex = items.length - 1
    for (let index = 0; index < items.length; index += 1) {
      const endMs = cursorMs + items[index]!.durationMs
      if (elapsedMs < endMs) {
        itemIndex = index
        break
      }
      cursorMs = endMs
    }

    const item = items[itemIndex]!
    const localSeconds = Math.max(0, (elapsedMs - cursorMs) / 1000)
    const applyVideoTime = () => {
      if (!video.duration || !Number.isFinite(video.duration)) return
      const target = localSeconds % video.duration
      if (Math.abs(video.currentTime - target) > 0.06) video.currentTime = target
      if (!audio.paused && video.paused) void video.play().catch(() => undefined)
    }

    if (activeIndexRef.current !== itemIndex || video.dataset.previewUrl !== item.videoUrl) {
      activeIndexRef.current = itemIndex
      video.dataset.previewUrl = item.videoUrl
      video.src = item.videoUrl
      video.load()
      video.addEventListener("loadedmetadata", applyVideoTime, { once: true })
    } else {
      applyVideoTime()
    }
    setCurrentTime(audio.currentTime)
  }, [items])

  useEffect(() => {
    if (!open || !audioUrl || items.length === 0) return
    const audio = new Audio(audioUrl)
    audio.preload = "auto"
    audioRef.current = audio
    activeIndexRef.current = -1
    syncVideo()

    const loop = () => {
      syncVideo()
      if (!audio.paused && !audio.ended) frameRef.current = requestAnimationFrame(loop)
    }
    const handlePlay = () => {
      setIsPlaying(true)
      cancelAnimationFrame(frameRef.current)
      frameRef.current = requestAnimationFrame(loop)
    }
    const handlePause = () => {
      setIsPlaying(false)
      videoRef.current?.pause()
      cancelAnimationFrame(frameRef.current)
    }
    const handleEnded = () => {
      handlePause()
      setCurrentTime(audio.duration || totalDuration)
    }
    audio.addEventListener("play", handlePlay)
    audio.addEventListener("pause", handlePause)
    audio.addEventListener("ended", handleEnded)

    return () => {
      cancelAnimationFrame(frameRef.current)
      audio.pause()
      audio.removeEventListener("play", handlePlay)
      audio.removeEventListener("pause", handlePause)
      audio.removeEventListener("ended", handleEnded)
      audio.src = ""
      videoRef.current?.pause()
      audioRef.current = null
      setIsPlaying(false)
      setCurrentTime(0)
    }
  }, [audioUrl, items, open, syncVideo, totalDuration])

  const togglePlayback = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.ended) audio.currentTime = 0
    if (audio.paused) await audio.play()
    else audio.pause()
  }

  const seek = (seconds: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.min(seconds, audio.duration || totalDuration)
    syncVideo()
  }

  const activeItem = items[Math.max(0, activeIndexRef.current)] || items[0]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-white/10 bg-[#111318] text-zinc-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="h-4 w-4 text-amber-400" />
            영상 + TTS 미리보기
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative mx-auto aspect-[9/16] w-full max-w-[280px] overflow-hidden rounded-xl border border-amber-400/30 bg-black">
            <video ref={videoRef} muted playsInline loop className="h-full w-full object-cover" />
            <div className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-1 text-[10px] text-white">
              장면 {(activeItem?.sceneIndex ?? 0) + 1}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <p className="truncate text-xs font-semibold text-zinc-200">
              {activeItem?.title || "장면 미리보기"}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Button
                type="button"
                size="icon"
                onClick={() => void togglePlayback()}
                className="h-9 w-9 shrink-0 bg-amber-500 text-black hover:bg-amber-400"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Volume2 className="h-4 w-4 shrink-0 text-zinc-500" />
              <Slider
                min={0}
                max={Math.max(0.1, totalDuration)}
                step={0.01}
                value={[Math.min(currentTime, totalDuration)]}
                onValueChange={([value]) => seek(value ?? 0)}
              />
              <span className="shrink-0 font-mono text-[10px] text-zinc-400">
                {formatTime(currentTime)} / {formatTime(totalDuration)}
              </span>
            </div>
          </div>

          <p className="text-center text-[11px] text-zinc-500">
            자막 없이 장면 영상과 생성된 TTS의 연결만 확인합니다.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
