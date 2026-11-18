"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Download,
  Loader2,
  Maximize2,
  Minimize2,
  Music,
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
import {
  bgmGainFromVolumePct,
  VOICE_PREVIEW_BGM_OPTIONS,
  voicePreviewBgmSrc,
} from "@/lib/shotform-factory-voice-preview-bgm"
import { getInfoSlideDisplayLines, InfoCardFrame } from "./InfoCardFrame"
import { playInfoLinePop } from "./info-line-sfx"
import { INFO_TTS_CHAIN_TAIL_SKIP_SEC, playInfoTtsBuffer } from "./info-tts-audio"
import {
  INFO_DEFAULT_BGM_ID,
  INFO_DEFAULT_BGM_VOLUME,
  type InfoShoppingBrief,
  type InfoSlide,
  type InfoVoiceTrack,
} from "./info-types"
import {
  createInfoCardCaptureSession,
  renderInfoVideo,
  type InfoVideoBgm,
} from "./info-video-export"

type PreviewCue = {
  id: string
  slideIndex: number
  revealCount: number
  startSec: number
  durationSec: number
  audioUrl?: string
  text: string
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

export function InfoPreviewPanel({
  brief,
  onChange,
}: {
  brief: InfoShoppingBrief
  onChange: (brief: InfoShoppingBrief) => void
}) {
  const slides = brief.generatedCards?.slides || []
  const tracks = brief.voiceData?.tracks || []
  const productBaseName = brief.selectedProduct?.productName || "info-shopping"
  const bgmId = brief.bgmId ?? INFO_DEFAULT_BGM_ID
  const bgmVolume = brief.bgmVolume ?? INFO_DEFAULT_BGM_VOLUME

  const [slideIndex, setSlideIndex] = useState(0)
  const [revealLines, setRevealLines] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportStage, setExportStage] = useState("")
  const [exportUrl, setExportUrl] = useState("")
  const [exportFilename, setExportFilename] = useState("")
  const [error, setError] = useState("")
  const [playheadSec, setPlayheadSec] = useState(0)
  const [durationMap, setDurationMap] = useState<Record<string, number>>({})
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [separateAssetBusy, setSeparateAssetBusy] = useState<string | null>(null)

  const cancelRef = useRef({ cancelled: false })
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null)
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

  const bgmSrc = voicePreviewBgmSrc(bgmId)
  useEffect(() => {
    if (!isPlaying || !bgmSrc) return
    const audio = new Audio(bgmSrc)
    audio.loop = true
    audio.volume = bgmGainFromVolumePct(bgmVolume)
    bgmAudioRef.current = audio
    void audio.play().catch(() => undefined)
    return () => {
      audio.pause()
      bgmAudioRef.current = null
    }
    // 볼륨 변경은 아래 effect에서 재생을 끊지 않고 반영
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, bgmSrc])

  useEffect(() => {
    if (bgmAudioRef.current) bgmAudioRef.current.volume = bgmGainFromVolumePct(bgmVolume)
  }, [bgmVolume])

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

  const bgmSelection = (): InfoVideoBgm | null => {
    const src = voicePreviewBgmSrc(bgmId)
    return src ? { src, volumePct: bgmVolume } : null
  }

  const exportVideo = async () => {
    if (!slides.length) return
    stopPlayback()
    setIsExporting(true)
    setError("")
    setExportUrl("")
    try {
      const { blob, extension } = await renderInfoVideo({
        slides,
        tracks,
        themeId: brief.themeId,
        withVoice: true,
        bgm: bgmSelection(),
        onStage: setExportStage,
      })
      const filename = assetFilename(productBaseName, "video", extension)
      setExportUrl(URL.createObjectURL(blob))
      setExportFilename(filename)
      downloadBlob(blob, filename)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "내보내기 실패")
    } finally {
      setExportStage("")
      setIsExporting(false)
    }
  }

  /** TTS·효과음·배경음 없이 같은 움직임의 카드 영상만 저장 */
  const exportSilentVideoDownload = async () => {
    if (!slides.length) return
    stopPlayback()
    setIsExporting(true)
    setError("")
    try {
      const { blob, extension } = await renderInfoVideo({
        slides,
        tracks,
        themeId: brief.themeId,
        withVoice: false,
        bgm: null,
        onStage: setExportStage,
      })
      downloadBlob(blob, assetFilename(productBaseName, "video", extension))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "영상만 저장 실패")
    } finally {
      setExportStage("")
      setIsExporting(false)
    }
  }

  const handleSeparateAssetDownload = async (id: string) => {
    const base = productBaseName
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
          const { canvas } = await session.capture(
            slide,
            brief.themeId,
            0,
            slides.length,
            Math.max(1, getInfoSlideDisplayLines(slide).length)
          )
          await downloadUrlAsFile(
            canvas.toDataURL("image/png"),
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
      <div className="rounded-[24px] border border-[#e3e6ec] bg-[#ffffff] p-6 shadow-[0_1px_2px_rgba(14,16,22,0.04),0_16px_40px_-24px_rgba(14,16,22,0.18)] md:p-8">
        <p className="text-[12px] font-black tracking-[0.18em] text-[#1f6fe0]">STEP 05 · PREVIEW</p>
        <h2 className="mt-2 text-xl font-black tracking-[-0.035em] text-[#0e1016] sm:text-3xl">미리보기 · 내보내기</h2>
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
            className="rounded-full bg-[#0e1016] font-bold text-[#ffffff] hover:bg-[#262a33] disabled:bg-[#9aa0ad]"
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
                {exportStage || "렌더 준비 중…"}
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                영상 내보내기
              </>
            )}
          </Button>
          {exportUrl ? (
            <a
              href={exportUrl}
              download={exportFilename}
              className="inline-flex h-10 items-center rounded-md bg-emerald-500 px-4 text-sm font-bold text-white hover:bg-emerald-400"
            >
              다시 다운로드
            </a>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
          <Music className="h-4 w-4 shrink-0 text-sky-300" />
          <label className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            배경음악
            <select
              value={bgmId}
              disabled={isExporting}
              onChange={(e) => onChange({ ...brief, bgmId: e.target.value })}
              className="h-9 rounded-lg border border-white/15 bg-zinc-900 px-2 text-sm text-white"
            >
              <option value="">없음</option>
              {VOICE_PREVIEW_BGM_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[180px] flex-1 items-center gap-2 text-xs text-zinc-400">
            볼륨
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={bgmVolume}
              disabled={isExporting || !bgmId}
              onChange={(e) => onChange({ ...brief, bgmVolume: Number(e.target.value) })}
              className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-sky-400 disabled:opacity-40"
              aria-label="배경음악 볼륨"
            />
            <span className="w-9 text-right tabular-nums">{bgmVolume}%</span>
          </label>
          <p className="w-full text-[11px] text-zinc-500">
            재생과 영상 내보내기에 함께 들어갑니다. 카드 전환·줄 등장·제품 이미지 줌 모션도 영상에 그대로 담깁니다.
          </p>
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
              hint: "TTS 없는 카드 영상",
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

      <div className="relative mx-auto flex w-full max-w-[min(100%,420px)] flex-col items-center gap-3 overflow-x-clip">
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
        {/* 폰 프레임 — 앱 UI 장식일 뿐, 내보내기 캡처(captureMode)와 무관 */}
        <div className="w-full max-w-[420px] rounded-[44px] bg-[#0e1016] p-[10px] shadow-[0_30px_60px_-30px_rgba(14,16,22,0.55)]">
          <div className="relative overflow-hidden rounded-[34px]">
            <span className="pointer-events-none absolute left-1/2 top-2 z-10 h-[18px] w-[30%] -translate-x-1/2 rounded-full bg-[#0e1016]" aria-hidden />
            <div key={slideIndex} className="info-card-swipe-in w-full motion-reduce:animate-none">
              <InfoCardFrame
                slide={current}
                themeId={brief.themeId}
                slideIndex={slideIndex}
                slideCount={slides.length}
                revealLineCount={revealLines}
                className="max-w-[420px] !rounded-none !border-0"
              />
            </div>
          </div>
        </div>
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
            <div key={slideIndex} className="info-card-swipe-in">
              <InfoCardFrame
                slide={current}
                themeId={brief.themeId}
                slideIndex={slideIndex}
                slideCount={slides.length}
                revealLineCount={revealLines}
                className="max-h-[min(78vh,820px)] w-auto max-w-[min(92vw,520px)]"
              />
            </div>
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
