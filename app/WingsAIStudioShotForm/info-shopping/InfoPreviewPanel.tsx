"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createRoot, type Root } from "react-dom/client"
import {
  Download,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { SeparateAssetDownloads } from "../components/SeparateAssetDownloads"
import {
  assetFilename,
  buildSrtFromTimedCues,
  downloadTextFile,
  downloadTtsUrl,
  downloadUrlAsFile,
  downloadUrlsAsZip,
  guessExtFromUrlOrType,
} from "@/lib/shotform-separate-assets"
import { downloadBlob } from "@/lib/shotform-factory-capcut-export"
import { getInfoSlideDisplayLines, InfoCardFrame } from "./InfoCardFrame"
import { playInfoLinePop, playInfoLinePopInto } from "./info-line-sfx"
import { INFO_TTS_CHAIN_TAIL_SKIP_SEC, playInfoTtsBuffer } from "./info-tts-audio"
import type { InfoShoppingBrief, InfoSlide, InfoThemeId, InfoVoiceTrack } from "./info-types"

const EXPORT_W = 1080
const EXPORT_H = 1920

type PreviewCue = {
  id: string
  slideIndex: number
  revealCount: number
  startSec: number
  durationSec: number
  audioUrl?: string
  text: string
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function formatClock(sec: number) {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, "0")}`
}

function estimateLineSec(text: string, slideDuration: number, lineCount: number) {
  const byText = Math.max(0.4, Math.min(2.8, (text.length || 8) * 0.1))
  const bySlide = ((slideDuration || 4) * 0.9) / Math.max(1, lineCount)
  return Math.max(0.38, Math.min(byText, bySlide + 0.25))
}

/**
 * 줄별 큐 생성.
 * 묶음 TTS(첫 줄만 audioUrl)는 오디오 전체 길이를 글자 수 비율로 각 줄에 나눠
 * 재생·스크럽 시 한 줄씩 딱딱 공개되게 합니다.
 */
function buildPreviewCues(
  slides: InfoSlide[],
  tracks: InfoVoiceTrack[],
  durationOverrides?: Record<string, number>
): PreviewCue[] {
  const cues: PreviewCue[] = []
  let cursor = 0
  slides.forEach((slide, slideIndex) => {
    const lines = getInfoSlideDisplayLines(slide)
    const track = tracks.find((item) => item.slideId === slide.id)
    const steps = Math.max(lines.length, 1)
    type StepInfo = {
      step: number
      text: string
      audioUrl?: string
      id: string
    }
    const infos: StepInfo[] = []
    for (let step = 0; step < steps; step += 1) {
      const text = lines[step] || slide.narration || ""
      const audioUrl =
        track?.lineTracks?.[step]?.audioUrl ||
        (step === 0 && !track?.lineTracks?.length ? track?.audioUrl : undefined)
      infos.push({
        step,
        text,
        audioUrl: audioUrl || undefined,
        id: `${slide.id}:${step}`,
      })
    }

    let index = 0
    while (index < infos.length) {
      const start = index
      index += 1
      // 오디오가 있는 줄 뒤로, 오디오 없는 줄까지가 한 묶음
      if (infos[start]!.audioUrl) {
        while (index < infos.length && !infos[index]!.audioUrl) index += 1
      }
      const group = infos.slice(start, index)
      const weights = group.map((g) => Math.max(1, (g.text || "").replace(/\s/g, "").length))
      const weightSum = weights.reduce((a, b) => a + b, 0) || group.length
      const head = group[0]!
      let totalDur = 0
      if (head.audioUrl && durationOverrides?.[head.id]) {
        totalDur = durationOverrides[head.id]!
      } else if (head.audioUrl) {
        totalDur = group.reduce(
          (acc, g) => acc + estimateLineSec(g.text, slide.durationSec || 4, steps),
          0
        )
      } else {
        totalDur = group.reduce(
          (acc, g) => acc + estimateLineSec(g.text, slide.durationSec || 4, steps),
          0
        )
      }
      totalDur = Math.max(0.2 * group.length, totalDur)

      for (let gi = 0; gi < group.length; gi += 1) {
        const g = group[gi]!
        const durationSec = Math.max(0.12, totalDur * (weights[gi]! / weightSum))
        cues.push({
          id: g.id,
          slideIndex,
          revealCount: Math.min(lines.length, g.step + 1),
          startSec: cursor,
          durationSec,
          // 실제 재생 오디오는 묶음 첫 줄에만
          audioUrl: gi === 0 ? g.audioUrl : undefined,
          text: g.text,
        })
        cursor += durationSec
      }
    }
  })
  return cues
}

function cueIndexAtTime(cues: PreviewCue[], timeSec: number) {
  if (!cues.length) return 0
  for (let i = cues.length - 1; i >= 0; i -= 1) {
    if (timeSec >= cues[i]!.startSec - 0.001) return i
  }
  return 0
}

export function InfoPreviewPanel({ brief }: { brief: InfoShoppingBrief }) {
  const slides = brief.generatedCards?.slides || []
  const tracks = brief.voiceData?.tracks || []

  const [slideIndex, setSlideIndex] = useState(0)
  const [revealLines, setRevealLines] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportUrl, setExportUrl] = useState("")
  const [error, setError] = useState("")
  const [playheadSec, setPlayheadSec] = useState(0)
  const [durationMap, setDurationMap] = useState<Record<string, number>>({})
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [separateAssetBusy, setSeparateAssetBusy] = useState<string | null>(null)

  const cancelRef = useRef({ cancelled: false })
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playheadRef = useRef(0)
  const cuesRef = useRef<PreviewCue[]>([])
  const wasPlayingRef = useRef(false)

  const cues = useMemo(
    () => buildPreviewCues(slides, tracks, durationMap),
    [slides, tracks, durationMap]
  )
  cuesRef.current = cues
  const totalSec = cues.length
    ? cues[cues.length - 1]!.startSec + cues[cues.length - 1]!.durationSec
    : 0

  useEffect(() => {
    setSlideIndex(0)
    setRevealLines(null)
    setPlayheadSec(0)
    playheadRef.current = 0
    setDurationMap({})
  }, [slides])

  useEffect(() => {
    let cancelled = false
    const items = buildPreviewCues(slides, tracks)
      .filter((c) => c.audioUrl)
      .map((c) => ({ id: c.id, url: c.audioUrl! }))
    if (!items.length) return

    void (async () => {
      const next: Record<string, number> = {}
      await Promise.all(
        items.map(
          (item) =>
            new Promise<void>((resolve) => {
              const audio = new Audio()
              audio.preload = "metadata"
              audio.src = item.url
              const done = () => {
                const dur = Number.isFinite(audio.duration) ? audio.duration : 0
                // 타임라인에서도 끝 패딩을 빼 장면 사이 공백이 생기지 않게
                if (dur > 0.05) {
                  next[item.id] = Math.max(
                    0.25,
                    dur - INFO_TTS_CHAIN_TAIL_SKIP_SEC
                  )
                }
                resolve()
              }
              audio.onloadedmetadata = done
              audio.onerror = () => resolve()
              window.setTimeout(done, 2500)
            })
        )
      )
      if (!cancelled && Object.keys(next).length) {
        setDurationMap((prev) => ({ ...prev, ...next }))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [slides, tracks])

  const stopPlayback = () => {
    cancelRef.current.cancelled = true
    try {
      audioRef.current?.pause()
    } catch {
      // ignore
    }
    audioRef.current = null
    setIsPlaying(false)
  }

  const applyCueVisual = (cue: PreviewCue) => {
    setSlideIndex(cue.slideIndex)
    setRevealLines(cue.revealCount)
    setPlayheadSec(cue.startSec)
    playheadRef.current = cue.startSec
  }

  const seekToTime = (timeSec: number, autoPlay: boolean) => {
    const list = cuesRef.current
    if (!list.length) return
    const t = Math.max(0, Math.min(totalSec || timeSec, timeSec))
    const idx = cueIndexAtTime(list, t)
    const cue = list[idx]!
    stopPlayback()
    applyCueVisual(cue)
    setPlayheadSec(t)
    playheadRef.current = t
    if (autoPlay) void playFromCue(idx)
  }

  /** Web Audio 재생 — 다음 큐가 있으면 끝 무음 패딩 스킵 */
  const playAudioTight = (
    url: string,
    onTick?: (localSec: number) => void,
    chainNext = true
  ) => {
    if (cancelRef.current.cancelled) return Promise.resolve()
    const handle = playInfoTtsBuffer(url, {
      isCancelled: () => cancelRef.current.cancelled,
      skipTailSec: chainNext ? INFO_TTS_CHAIN_TAIL_SKIP_SEC : 0,
      onTick: (local) => onTick?.(local),
    })
    audioRef.current = {
      pause: () => handle.stop(),
    } as HTMLAudioElement
    return handle.done.finally(() => {
      if (audioRef.current) audioRef.current = null
    })
  }

  const sleepCancellable = (ms: number, onTick?: (elapsedMs: number) => void) =>
    new Promise<void>((resolve) => {
      const start = performance.now()
      const tick = () => {
        if (cancelRef.current.cancelled) {
          resolve()
          return
        }
        const elapsed = performance.now() - start
        onTick?.(elapsed)
        if (elapsed >= ms) {
          resolve()
          return
        }
        window.setTimeout(tick, 32)
      }
      tick()
    })

  const playFromCue = async (startCueIndex: number) => {
    const list = cuesRef.current
    if (!list.length) return
    cancelRef.current = { cancelled: false }
    setIsPlaying(true)
    setError("")
    try {
      for (let i = Math.max(0, startCueIndex); i < list.length; ) {
        if (cancelRef.current.cancelled) break
        // 묶음 중간(오디오 없는 줄)에서 시작하면 오디오 있는 첫 줄로 맞춤
        if (!list[i]!.audioUrl) {
          let head = i
          while (
            head > 0 &&
            list[head]!.slideIndex === list[i]!.slideIndex &&
            !list[head]!.audioUrl
          ) {
            head -= 1
          }
          if (list[head]?.audioUrl) i = head
        }
        const cue = list[i]!

        // 묶음 TTS: 이 줄 + 뒤에 오디오 없는 같은 슬라이드 줄
        let end = i
        if (cue.audioUrl) {
          while (
            end + 1 < list.length &&
            list[end + 1]!.slideIndex === cue.slideIndex &&
            !list[end + 1]!.audioUrl
          ) {
            end += 1
          }
        }
        const group = list.slice(i, end + 1)
        const groupDur = group.reduce((sum, item) => sum + item.durationSec, 0)
        applyCueVisual(cue)
        playInfoLinePop(0.16)

        const advanceRevealByLocal = (local: number) => {
          let acc = 0
          let active = group[0]!
          for (const item of group) {
            acc += item.durationSec
            active = item
            if (local < acc - 0.01) break
          }
          setSlideIndex(active.slideIndex)
          setRevealLines(active.revealCount)
          const next = cue.startSec + Math.min(groupDur, Math.max(0, local))
          playheadRef.current = next
          setPlayheadSec(next)
        }

        const hasNextCue = end + 1 < list.length
        if (cue.audioUrl) {
          try {
            await playAudioTight(
              cue.audioUrl,
              (local) => {
                advanceRevealByLocal(local)
              },
              hasNextCue
            )
          } catch {
            await sleepCancellable(groupDur * 1000, (elapsed) => {
              advanceRevealByLocal(elapsed / 1000)
            })
          }
        } else {
          await sleepCancellable(cue.durationSec * 1000, (elapsed) => {
            advanceRevealByLocal(elapsed / 1000)
          })
        }

        if (!cancelRef.current.cancelled) {
          const last = group[group.length - 1]!
          const endSec = last.startSec + last.durationSec
          playheadRef.current = endSec
          setPlayheadSec(endSec)
          setRevealLines(last.revealCount)
        }
        i = end + 1
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "재생 실패")
    } finally {
      setIsPlaying(false)
    }
  }

  const togglePlay = () => {
    if (isPlaying) {
      stopPlayback()
      return
    }
    const list = cuesRef.current
    if (!list.length) return
    if (playheadRef.current >= totalSec - 0.05) {
      void playFromCue(0)
      return
    }
    void playFromCue(cueIndexAtTime(list, playheadRef.current))
  }

  useEffect(() => {
    if (!isFullscreen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFullscreen(false)
    }
    window.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [isFullscreen])

  const exportVideo = async () => {
    if (!slides.length) return
    stopPlayback()
    setIsExporting(true)
    setError("")
    setExportUrl("")

    let captureSession: InfoCardCaptureSession | null = null
    try {
      // 외부 이미지를 data URL로 고정 → CORS/프록시 실패로 제품컷이 비는 문제 방지
      const exportSlides = await Promise.all(
        slides.map(async (slide) => ({
          ...slide,
          imageUrl: slide.imageUrl
            ? await materializeImageDataUrl(slide.imageUrl).catch(() => slide.imageUrl)
            : slide.imageUrl,
        }))
      )

      const canvas = document.createElement("canvas")
      canvas.width = EXPORT_W
      canvas.height = EXPORT_H
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("캔버스를 사용할 수 없습니다.")

      captureSession = createInfoCardCaptureSession()
      let frameKey = ""
      let frameBitmap: HTMLCanvasElement | null = null

      const paintFrame = async (
        slide: InfoSlide,
        index: number,
        reveal: number,
        force = false
      ) => {
        const key = `${slide.id}:${reveal}`
        if (!force && key === frameKey && frameBitmap) {
          ctx.clearRect(0, 0, EXPORT_W, EXPORT_H)
          ctx.drawImage(frameBitmap, 0, 0, EXPORT_W, EXPORT_H)
          return
        }
        frameBitmap = await captureSession!.capture(
          slide,
          brief.themeId,
          index,
          exportSlides.length,
          reveal
        )
        frameKey = key
        ctx.clearRect(0, 0, EXPORT_W, EXPORT_H)
        ctx.drawImage(frameBitmap, 0, 0, EXPORT_W, EXPORT_H)
      }

      const stream = canvas.captureStream(30)
      const audioCtx = new AudioContext()
      const dest = audioCtx.createMediaStreamDestination()
      for (const track of dest.stream.getAudioTracks()) {
        stream.addTrack(track)
      }

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm"
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 5_000_000,
        audioBitsPerSecond: 192_000,
      })
      const chunks: BlobPart[] = []
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data)
      }
      const stopped = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }))
      })
      recorder.start(250)

      for (let index = 0; index < exportSlides.length; index += 1) {
        const slide = exportSlides[index]!
        const displayLines = getInfoSlideDisplayLines(slide)
        const track = tracks.find((item) => item.slideId === slide.id)
        setSlideIndex(index)

        const lineAudios =
          track?.lineTracks?.length
            ? track.lineTracks
            : track?.audioUrl
              ? [{ lineIndex: 0, text: displayLines[0] || "", audioUrl: track.audioUrl }]
              : []
        const steps = Math.max(displayLines.length, lineAudios.length, 1)

        for (let step = 0; step < steps; ) {
          const entry = lineAudios[step]
          let end = step
          if (entry?.audioUrl) {
            while (end + 1 < steps && !lineAudios[end + 1]?.audioUrl) end += 1
          }
          const groupSteps = Array.from({ length: end - step + 1 }, (_, k) => step + k)
          const weights = groupSteps.map((s) =>
            Math.max(1, (displayLines[s] || "").replace(/\s/g, "").length)
          )
          const weightSum = weights.reduce((a, b) => a + b, 0) || groupSteps.length

          if (entry?.audioUrl) {
            void playInfoLinePopInto(audioCtx, dest, 0.16)
            let lastReveal = step
            const firstReveal = Math.min(displayLines.length, step + 1)
            setRevealLines(firstReveal)
            await paintFrame(slide, index, firstReveal, true)

            const ab = await (await fetch(entry.audioUrl)).arrayBuffer()
            const decoded = await audioCtx.decodeAudioData(ab.slice(0))
            const totalDur = Math.max(0.2, decoded.duration)
            const hasMoreAfter = end + 1 < steps || index < exportSlides.length - 1
            const playUntil = Math.max(
              0.12,
              totalDur - (hasMoreAfter ? INFO_TTS_CHAIN_TAIL_SKIP_SEC : 0)
            )
            const source = audioCtx.createBufferSource()
            source.buffer = decoded
            source.connect(dest)
            source.connect(audioCtx.destination)
            const startedAt = audioCtx.currentTime
            source.start(0)

            while (audioCtx.currentTime - startedAt < playUntil - 0.02) {
              const local = audioCtx.currentTime - startedAt
              const ratio = Math.min(0.999, Math.max(0, local / playUntil))
              let acc = 0
              let target = step
              for (let gi = 0; gi < groupSteps.length; gi += 1) {
                acc += weights[gi]! / weightSum
                target = groupSteps[gi]!
                if (ratio < acc) break
              }
              if (target !== lastReveal) {
                lastReveal = target
                const nextReveal = Math.min(displayLines.length, target + 1)
                setRevealLines(nextReveal)
                await paintFrame(slide, index, nextReveal, true)
                void playInfoLinePopInto(audioCtx, dest, 0.12)
              } else {
                // captureStream이 프레임을 유지하도록 동일 비트맵 재전송
                await paintFrame(
                  slide,
                  index,
                  Math.min(displayLines.length, lastReveal + 1)
                )
              }
              await sleep(40)
            }
            try {
              source.stop()
            } catch {
              /* ended */
            }
            const finalReveal = Math.min(displayLines.length, end + 1)
            setRevealLines(finalReveal)
            await paintFrame(slide, index, finalReveal, true)
          } else {
            const reveal = Math.min(displayLines.length, step + 1)
            setRevealLines(reveal)
            await paintFrame(slide, index, reveal, true)
            void playInfoLinePopInto(audioCtx, dest, 0.16)
            const holdMs = Math.max(380, ((slide.durationSec || 4) * 850) / steps)
            const holdUntil = performance.now() + holdMs
            while (performance.now() < holdUntil) {
              await paintFrame(slide, index, reveal)
              await sleep(40)
            }
          }
          step = end + 1
        }
      }

      recorder.stop()
      const blob = await stopped
      setExportUrl(URL.createObjectURL(blob))
      await audioCtx.close().catch(() => undefined)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "내보내기 실패")
    } finally {
      captureSession?.dispose()
      setIsExporting(false)
    }
  }

  /** TTS 없는 카드 영상만 렌더해 바로 저장 */
  const exportSilentVideoDownload = async () => {
    if (!slides.length) return
    stopPlayback()
    setIsExporting(true)
    setError("")
    let captureSession: InfoCardCaptureSession | null = null
    try {
      const exportSlides = await Promise.all(
        slides.map(async (slide) => ({
          ...slide,
          imageUrl: slide.imageUrl
            ? await materializeImageDataUrl(slide.imageUrl).catch(() => slide.imageUrl)
            : slide.imageUrl,
        }))
      )
      const canvas = document.createElement("canvas")
      canvas.width = EXPORT_W
      canvas.height = EXPORT_H
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("캔버스를 사용할 수 없습니다.")
      captureSession = createInfoCardCaptureSession()
      const stream = canvas.captureStream(30)
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm"
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 5_000_000,
      })
      const chunks: BlobPart[] = []
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data)
      }
      const stopped = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }))
      })
      recorder.start(250)

      const timeline = cues.length
        ? cues
        : exportSlides.map((slide, slideIndex) => ({
            id: slide.id,
            slideIndex,
            revealCount: Math.max(1, getInfoSlideDisplayLines(slide).length),
            startSec: slideIndex * (slide.durationSec || 4),
            durationSec: slide.durationSec || 4,
            text: getInfoSlideDisplayLines(slide).join(" "),
          }))

      for (const cue of timeline) {
        const slide = exportSlides[cue.slideIndex]!
        setSlideIndex(cue.slideIndex)
        setRevealLines(cue.revealCount)
        const frame = await captureSession.capture(
          slide,
          brief.themeId,
          cue.slideIndex,
          exportSlides.length,
          cue.revealCount
        )
        const until = performance.now() + Math.max(280, cue.durationSec * 1000)
        while (performance.now() < until) {
          ctx.clearRect(0, 0, EXPORT_W, EXPORT_H)
          ctx.drawImage(frame, 0, 0, EXPORT_W, EXPORT_H)
          await sleep(40)
        }
      }

      recorder.stop()
      const blob = await stopped
      downloadBlob(
        blob,
        assetFilename(brief.productName || "info-shopping", "video", "webm")
      )
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "영상만 저장 실패")
    } finally {
      captureSession?.dispose()
      setIsExporting(false)
    }
  }

  const handleSeparateAssetDownload = async (id: string) => {
    const base = brief.productName || "info-shopping"
    setSeparateAssetBusy(id)
    setError("")
    try {
      if (id === "srt") {
        const srt = buildSrtFromTimedCues(
          cues.map((cue) => ({
            text: cue.text,
            start: cue.startSec,
            end: cue.startSec + cue.durationSec,
          }))
        )
        if (!srt.trim()) throw new Error("자막 큐가 없습니다.")
        downloadTextFile(srt, assetFilename(base, "subtitles", "srt"))
        return
      }
      if (id === "thumbnail") {
        const slide = slides[0]
        if (!slide) throw new Error("카드가 없습니다.")
        const session = createInfoCardCaptureSession()
        try {
          const frame = await session.capture(
            slide,
            brief.themeId,
            0,
            slides.length,
            Math.max(1, getInfoSlideDisplayLines(slide).length)
          )
          await downloadUrlAsFile(
            frame.toDataURL("image/png"),
            assetFilename(base, "thumbnail", "png")
          )
        } finally {
          session.dispose()
        }
        return
      }
      if (id === "tts") {
        const urls = new Set<string>()
        for (const track of tracks) {
          if (track.audioUrl) urls.add(track.audioUrl)
          for (const line of track.lineTracks || []) {
            if (line.audioUrl) urls.add(line.audioUrl)
          }
        }
        const list = Array.from(urls)
        if (!list.length) throw new Error("TTS가 없습니다. 음성 단계에서 먼저 생성해 주세요.")
        if (list.length === 1) {
          await downloadTtsUrl(list[0]!, base)
          return
        }
        await downloadUrlsAsZip(
          list.map((url, i) => ({
            url,
            name: `tts_${String(i + 1).padStart(2, "0")}.${guessExtFromUrlOrType(url, undefined, "mp3")}`,
          })),
          assetFilename(base, "tts", "zip")
        )
        return
      }
      if (id === "video") {
        await exportSilentVideoDownload()
        return
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "개별 파일 저장 실패")
    } finally {
      setSeparateAssetBusy(null)
    }
  }

  if (!slides.length) {
    return (
      <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
        카드가 없습니다. 이전 단계에서 생성해주세요.
      </p>
    )
  }

  const current = slides[slideIndex]
  const progressPct = totalSec > 0 ? Math.min(100, (playheadSec / totalSec) * 100) : 0

  const transportBar = (
    <div className="flex w-full items-center gap-2">
      <Button
        type="button"
        size="icon"
        variant="secondary"
        className="h-9 w-9 shrink-0"
        disabled={isExporting}
        onClick={() => {
          const list = cuesRef.current
          const idx = cueIndexAtTime(list, playheadRef.current)
          const prevSlide = Math.max(0, (list[idx]?.slideIndex ?? slideIndex) - 1)
          const target = list.findIndex((c) => c.slideIndex === prevSlide)
          seekToTime(list[Math.max(0, target)]?.startSec ?? 0, isPlaying)
        }}
        aria-label="이전 카드"
      >
        <SkipBack className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        className="h-10 w-10 shrink-0 bg-sky-500 text-white hover:bg-sky-400"
        disabled={isExporting || !cues.length}
        onClick={togglePlay}
        aria-label={isPlaying ? "일시정지" : "재생"}
      >
        {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
      </Button>
      <Button
        type="button"
        size="icon"
        variant="secondary"
        className="h-9 w-9 shrink-0"
        disabled={isExporting}
        onClick={() => {
          const list = cuesRef.current
          const idx = cueIndexAtTime(list, playheadRef.current)
          const nextSlide = Math.min(
            slides.length - 1,
            (list[idx]?.slideIndex ?? slideIndex) + 1
          )
          const target = list.findIndex((c) => c.slideIndex === nextSlide)
          if (target >= 0) seekToTime(list[target]!.startSec, isPlaying)
        }}
        aria-label="다음 카드"
      >
        <SkipForward className="h-4 w-4" />
      </Button>

      <div className="min-w-0 flex-1 px-1">
        <input
          type="range"
          min={0}
          max={Math.max(0.1, totalSec)}
          step={0.05}
          value={Math.min(playheadSec, totalSec || 0)}
          disabled={!cues.length || isExporting}
          onPointerDown={() => {
            wasPlayingRef.current = isPlaying
          }}
          onChange={(e) => seekToTime(Number(e.target.value), false)}
          onPointerUp={(e) => {
            const t = Number((e.target as HTMLInputElement).value)
            seekToTime(t, wasPlayingRef.current)
          }}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-700 accent-sky-400"
          aria-label="재생 위치"
        />
        <div className="mt-1 flex justify-between text-[11px] tabular-nums text-zinc-400">
          <span>{formatClock(playheadSec)}</span>
          <span>
            {slideIndex + 1}/{slides.length} · {formatClock(totalSec)}
          </span>
        </div>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-sky-400/80"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  )

  return (
    <section className="space-y-6">
      <div className="rounded-[28px] border border-white/[0.08] bg-[#11100e]/95 p-6 md:p-8">
        <p className="text-[10px] font-black tracking-[0.2em] text-sky-400">STEP 05 · PREVIEW</p>
        <h2 className="mt-2 text-3xl font-black text-white">미리보기 · 내보내기</h2>
        <p className="mt-2 text-sm text-zinc-400">
          재생바로 중간에 멈추거나, 원하는 위치부터 다시 재생할 수 있습니다.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            type="button"
            disabled={isExporting}
            onClick={() => {
              stopPlayback()
              void playFromCue(0)
            }}
            className="bg-sky-500 font-bold text-white hover:bg-sky-400"
          >
            <Play className="mr-2 h-4 w-4" />
            처음부터
          </Button>
          <Button
            type="button"
            disabled={isExporting || isPlaying}
            onClick={() => void exportVideo()}
            className="font-semibold"
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                렌더 중…
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                WebM 내보내기
              </>
            )}
          </Button>
          {exportUrl ? (
            <a
              href={exportUrl}
              download={`info-shopping-${Date.now()}.webm`}
              className="inline-flex h-10 items-center rounded-md bg-emerald-500 px-4 text-sm font-bold text-white hover:bg-emerald-400"
            >
              다운로드
            </a>
          ) : null}
        </div>

        <SeparateAssetDownloads
          className="mt-4"
          busyId={separateAssetBusy}
          onDownload={(id) => void handleSeparateAssetDownload(id)}
          items={[
            {
              id: "srt",
              label: "자막만 (SRT)",
              hint: "카드 나레이션 타이밍",
              disabled: cues.length === 0,
              missingReason: "자막 큐 없음",
            },
            {
              id: "thumbnail",
              label: "썸네일만",
              hint: "첫 카드 PNG",
              disabled: slides.length === 0,
              missingReason: "카드 없음",
            },
            {
              id: "video",
              label: "영상만",
              hint: "TTS 없는 카드 WebM",
              disabled: slides.length === 0 || isExporting,
              missingReason: "카드 없음",
            },
            {
              id: "tts",
              label: "TTS만",
              hint: "나레이션 오디오",
              disabled: !tracks.some(
                (t) =>
                  Boolean(t.audioUrl) ||
                  (t.lineTracks || []).some((l) => Boolean(l.audioUrl))
              ),
              missingReason: "TTS 없음",
            },
          ]}
        />

        {error ? (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        {!tracks.length ? (
          <p className="mt-4 text-xs text-amber-200/90">
            TTS가 없으면 시간 기반으로 한 줄씩 공개됩니다. 음성 단계에서 TTS를 만들면 더 자연스럽습니다.
          </p>
        ) : null}
      </div>

      <div className="relative mx-auto flex w-full max-w-[420px] flex-col items-center gap-3">
        <div className="flex w-full justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="font-semibold"
            onClick={() => setIsFullscreen(true)}
          >
            <Maximize2 className="mr-1.5 h-4 w-4" />
            확대
          </Button>
        </div>
        <InfoCardFrame
          slide={current}
          themeId={brief.themeId}
          slideIndex={slideIndex}
          slideCount={slides.length}
          revealLineCount={revealLines}
          className="max-w-[420px]"
        />
      </div>

      <div className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
        {transportBar}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {slides.map((slide, index) => {
          const cue = cues.find((c) => c.slideIndex === index)
          return (
            <button
              key={slide.id}
              type="button"
              disabled={isExporting}
              onClick={() => seekToTime(cue?.startSec ?? 0, false)}
              className={`h-2 rounded-full transition-all ${
                index === slideIndex ? "w-8 bg-sky-400" : "w-2 bg-zinc-600 hover:bg-zinc-400"
              }`}
              aria-label={`${index + 1}번 슬라이드`}
            />
          )
        })}
      </div>

      {isFullscreen ? (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <p className="text-sm font-semibold text-white">미리보기 확대</p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsFullscreen(false)}
              >
                <Minimize2 className="mr-1.5 h-4 w-4" />
                축소
              </Button>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="h-9 w-9"
                onClick={() => setIsFullscreen(false)}
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-2">
            <InfoCardFrame
              slide={current}
              themeId={brief.themeId}
              slideIndex={slideIndex}
              slideCount={slides.length}
              revealLineCount={revealLines}
              className="max-h-[min(78vh,820px)] w-auto max-w-[min(92vw,520px)]"
            />
          </div>

          <div className="mx-auto w-full max-w-xl px-4 pb-6">
            <div className="rounded-2xl border border-white/10 bg-black/60 px-4 py-3">
              {transportBar}
            </div>
            <p className="mt-2 text-center text-[11px] text-zinc-500">Esc로 닫기</p>
          </div>
        </div>
      ) : null}
    </section>
  )
}

/** 외부/상대 이미지를 data URL로 바꿔 html2canvas·캔버스에 안전하게 넣음 */
async function materializeImageDataUrl(rawUrl: string): Promise<string> {
  const trimmed = rawUrl.trim()
  if (!trimmed) return trimmed
  if (trimmed.startsWith("data:image/")) return trimmed
  const src = /^https?:\/\//i.test(trimmed)
    ? `/api/shotform/image-proxy?url=${encodeURIComponent(trimmed)}`
    : trimmed
  const res = await fetch(src)
  if (!res.ok) throw new Error(`이미지 로드 실패 (${res.status})`)
  const blob = await res.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(new Error("이미지 변환 실패"))
    reader.readAsDataURL(blob)
  })
}

function waitForHostImages(host: HTMLElement): Promise<void> {
  const imgs = Array.from(host.querySelectorAll("img"))
  if (!imgs.length) return Promise.resolve()
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve()
            return
          }
          const done = () => resolve()
          img.addEventListener("load", done, { once: true })
          img.addEventListener("error", done, { once: true })
          window.setTimeout(done, 12_000)
        })
    )
  ).then(() => undefined)
}

type InfoCardCaptureSession = {
  capture: (
    slide: InfoSlide,
    themeId: InfoThemeId,
    slideIndex: number,
    slideCount: number,
    revealLines: number
  ) => Promise<HTMLCanvasElement>
  dispose: () => void
}

/**
 * 미리보기와 같은 InfoCardFrame DOM을 오프스크린에 그려 html2canvas로 캡처.
 * (구 캔버스 수동 드로잉은 글자 겹침·하이라이트·제품컷 누락이 났음)
 */
function createInfoCardCaptureSession(): InfoCardCaptureSession {
  const host = document.createElement("div")
  host.setAttribute("aria-hidden", "true")
  // 화면 안쪽에 투명 배치 — 멀리 치우면 cqw/이미지 레이아웃이 깨질 수 있음
  host.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    `width:${EXPORT_W}px`,
    "opacity:0",
    "pointer-events:none",
    "z-index:-1",
    "overflow:hidden",
  ].join(";")
  document.body.appendChild(host)
  const root: Root = createRoot(host)
  type Html2Canvas = (
    el: HTMLElement,
    opts: Record<string, unknown>
  ) => Promise<HTMLCanvasElement>
  let html2canvasFn: Html2Canvas | null = null

  const capture: InfoCardCaptureSession["capture"] = async (
    slide,
    themeId,
    slideIndex,
    slideCount,
    revealLines
  ) => {
    if (!html2canvasFn) {
      const mod = await import("html2canvas-pro")
      html2canvasFn = (mod.default || mod) as Html2Canvas
    }

    await new Promise<void>((resolve) => {
      root.render(
        <InfoCardFrame
          slide={slide}
          themeId={themeId}
          slideIndex={slideIndex}
          slideCount={slideCount}
          revealLineCount={revealLines}
          captureMode
          className="!max-w-none w-[1080px] rounded-none shadow-none"
        />
      )
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
    if (document.fonts?.ready) {
      await document.fonts.ready.catch(() => undefined)
    }
    await waitForHostImages(host)
    // 레이아웃·이미지 decode 한 프레임 더 대기
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

    const card = host.querySelector("[data-info-card-capture='1']") as HTMLElement | null
    if (!card) throw new Error("내보내기용 카드 프레임을 찾지 못했습니다.")

    return html2canvasFn(card, {
      width: EXPORT_W,
      height: EXPORT_H,
      windowWidth: EXPORT_W,
      windowHeight: EXPORT_H,
      scale: 1,
      useCORS: true,
      allowTaint: false,
      backgroundColor: null,
      logging: false,
      imageTimeout: 15_000,
      onclone: (_doc: Document, cloned: HTMLElement) => {
        cloned.style.width = `${EXPORT_W}px`
        cloned.style.height = `${EXPORT_H}px`
        cloned.style.maxWidth = "none"
        cloned.querySelectorAll("img").forEach((img) => {
          img.classList.remove("info-card-kenburns")
          ;(img as HTMLImageElement).style.transform = "none"
        })
      },
    })
  }

  return {
    capture,
    dispose: () => {
      try {
        root.unmount()
      } catch {
        /* ignore */
      }
      host.remove()
    },
  }
}
