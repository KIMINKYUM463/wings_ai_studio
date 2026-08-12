"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Download,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Scissors,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { downloadBlob } from "@/lib/shotform-factory-capcut-export"
import { SeparateAssetDownloads } from "../components/SeparateAssetDownloads"
import {
  assetFilename,
  downloadTtsUrl,
  downloadUrlAsFile,
} from "@/lib/shotform-separate-assets"
import {
  fixWebmBlobDuration,
  remuxWebmWithDuration,
} from "@/lib/mvp-webm-to-mp4"
import {
  isLikelyPlayableMediaUrl,
  isReachableMediaUrl,
  mergeAnimalVideosClient,
  type AnimalMergeResult,
} from "./animal-merge-client"
import { concatAnimalTtsUrls } from "./animal-tts"
import type { AnimalShoppingBrief } from "./animal-studio-types"

/** MediaRecorder webm 등은 duration이 Infinity/NaN인 경우가 많음 */
function isValidDuration(value: number | undefined | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

function pickDuration(...candidates: Array<number | undefined | null>): number {
  for (const value of candidates) {
    if (isValidDuration(value)) return value
  }
  return 0
}

function isStaleBlobUrl(url?: string | null): boolean {
  // 합본 blob: 은 새로고침 후 깨짐. data/https는 유지됨.
  return Boolean(url?.startsWith("blob:"))
}

/** Chrome: 큰 값으로 seek 후 duration을 복구하는 트릭 */
async function discoverMediaDuration(media: HTMLMediaElement): Promise<number> {
  if (isValidDuration(media.duration)) return media.duration
  if (media.seekable?.length > 0) {
    const end = media.seekable.end(media.seekable.length - 1)
    if (isValidDuration(end)) return end
  }

  return new Promise((resolve) => {
    const prev = media.currentTime || 0
    let settled = false
    const finish = (value: number) => {
      if (settled) return
      settled = true
      try {
        media.currentTime = prev
      } catch {
        /* ignore */
      }
      resolve(isValidDuration(value) ? value : 0)
    }

    const onSeeked = () => {
      media.removeEventListener("seeked", onSeeked)
      if (isValidDuration(media.duration)) {
        finish(media.duration)
        return
      }
      if (media.seekable?.length > 0) {
        finish(media.seekable.end(media.seekable.length - 1))
        return
      }
      finish(0)
    }

    media.addEventListener("seeked", onSeeked)
    try {
      media.currentTime = Number.MAX_SAFE_INTEGER
    } catch {
      finish(0)
    }
    window.setTimeout(() => finish(media.duration), 800)
  })
}

export function AnimalPreviewStudioPanel({
  brief,
  onChange,
}: {
  brief: AnimalShoppingBrief
  onChange: (brief: AnimalShoppingBrief) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const fsVideoRef = useRef<HTMLVideoElement>(null)
  const [isMerging, setIsMerging] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [error, setError] = useState("")
  const [currentTime, setCurrentTime] = useState(0)
  const [mediaDuration, setMediaDuration] = useState(0)
  /** 합본에 TTS가 들어갔는지 (별도 audio 태그 불필요) */
  const [muxedWithTts, setMuxedWithTts] = useState(false)
  const [statusHint, setStatusHint] = useState("")
  const [separateAssetBusy, setSeparateAssetBusy] = useState<string | null>(null)

  const sortedVideos = [...brief.videoUrls]
    .sort((a, b) => a.index - b.index)
    .map((v) => v.videoUrl)
    .filter(Boolean)

  /** UI 표시용 — data/https는 확실, blob은 세션 중일 수 있음 */
  const playableTtsUrl = useMemo(() => {
    const url = brief.ttsAudioUrl?.trim()
    if (!url) return ""
    if (url.startsWith("data:") || /^https?:\/\//i.test(url) || url.startsWith("blob:")) {
      return url
    }
    return ""
  }, [brief.ttsAudioUrl])

  /** TTS/씬 합산 — webm duration 버그 시 폴백 */
  const fallbackDuration = useMemo(() => {
    const sceneSum = (brief.scenes || []).reduce((sum, scene) => {
      const sec = scene.ttsDurationSec
      if (!isValidDuration(sec)) return sum
      return sum + Math.min(12, Math.max(4, Math.ceil(sec)))
    }, 0)
    return pickDuration(brief.ttsDurationSec, sceneSum)
  }, [brief.scenes, brief.ttsDurationSec])

  const duration = pickDuration(mediaDuration, fallbackDuration)

  const activeVideoRef = () => (isFullscreen ? fsVideoRef.current : videoRef.current)

  const resolveTtsForMerge = async (): Promise<string | undefined> => {
    if (brief.ttsAudioUrl?.trim() && (await isReachableMediaUrl(brief.ttsAudioUrl))) {
      return brief.ttsAudioUrl.trim()
    }

    const sceneUrls: string[] = []
    for (const scene of [...(brief.scenes || [])].sort((a, b) => a.order - b.order)) {
      const url = scene.ttsAudioUrl?.trim()
      if (!url) continue
      if (await isReachableMediaUrl(url)) sceneUrls.push(url)
    }
    if (sceneUrls.length === 0) return undefined
    if (sceneUrls.length === 1) return sceneUrls[0]
    const { audioUrl } = await concatAnimalTtsUrls(sceneUrls)
    return audioUrl
  }

  const mergeClips = async (opts?: {
    forceTts?: boolean
  }): Promise<AnimalMergeResult | null> => {
    if (sortedVideos.length === 0) {
      setError("이어 붙일 영상 클립이 없습니다.")
      return null
    }
    setIsMerging(true)
    setError("")
    setStatusHint("클립과 TTS를 이어 붙이는 중…")
    try {
      const tts = await resolveTtsForMerge()
      if (!tts) {
        if (brief.ttsAudioUrl || (brief.scenes || []).some((s) => s.ttsAudioUrl)) {
          setError(
            "TTS 주소를 읽지 못했습니다. 음성 단계에서 나레이션을 다시 생성한 뒤 「다시 이어 붙이기」를 눌러주세요."
          )
        } else if (opts?.forceTts) {
          setError("TTS가 없어 무음으로 합칩니다. 음성 단계에서 나레이션을 만들어 주세요.")
        }
      }
      const merged = await mergeAnimalVideosClient(sortedVideos, tts)
      setMediaDuration(merged.durationSec)
      setCurrentTime(0)
      setMuxedWithTts(merged.hasAudio)
      onChange({ ...brief, mergedVideoUrl: merged.url })
      if (merged.hasAudio) {
        setStatusHint("합본에 TTS가 포함되었습니다.")
      } else {
        setStatusHint("합본 완료 (무음)")
      }
      return merged
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : "영상 이어 붙이기 실패"
      setError(
        /no supported sources/i.test(message)
          ? "재생할 수 있는 영상/음성이 없습니다. 클립·TTS를 다시 만든 뒤 「다시 이어 붙이기」를 눌러주세요."
          : message
      )
      setStatusHint("")
      return null
    } finally {
      setIsMerging(false)
    }
  }

  const expectedClips = Math.max(brief.scenes?.length || 0, sortedVideos.length)

  useEffect(() => {
    // 저장된 blob: 합본은 새로고침 후 깨짐 → 자동으로 다시 합침
    const mergedBroken =
      !brief.mergedVideoUrl ||
      isStaleBlobUrl(brief.mergedVideoUrl) ||
      !isLikelyPlayableMediaUrl(brief.mergedVideoUrl)

    if (
      expectedClips >= 3 &&
      sortedVideos.length === expectedClips &&
      (mergedBroken || !brief.mergedVideoUrl)
    ) {
      void mergeClips()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isFullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isFullscreen])

  useEffect(() => {
    if (!brief.mergedVideoUrl) return
    const from = isFullscreen ? videoRef.current : fsVideoRef.current
    const to = isFullscreen ? fsVideoRef.current : videoRef.current
    if (!to) return
    const t = from?.currentTime ?? currentTime
    to.currentTime = t
    if (isPlaying) {
      void to.play().catch(() => undefined)
    } else {
      to.pause()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen])

  const applyDiscoveredDuration = async (el: HTMLMediaElement) => {
    const raw = el.duration
    if (isValidDuration(raw)) {
      setMediaDuration(raw)
      return
    }
    const discovered = await discoverMediaDuration(el)
    if (isValidDuration(discovered)) {
      setMediaDuration(discovered)
    }
  }

  const seekTo = (t: number) => {
    const max = duration || 0
    const clamped = max > 0 ? Math.min(Math.max(0, t), max) : Math.max(0, t)
    const v = activeVideoRef()
    if (v) v.currentTime = clamped
    if (videoRef.current && videoRef.current !== v) videoRef.current.currentTime = clamped
    if (fsVideoRef.current && fsVideoRef.current !== v) fsVideoRef.current.currentTime = clamped
    setCurrentTime(clamped)
  }

  const togglePlay = async () => {
    let video = activeVideoRef()
    if (!video || !brief.mergedVideoUrl) {
      const remade = await mergeClips()
      if (!remade) return
      await new Promise((r) => window.setTimeout(r, 80))
      video = activeVideoRef()
    }
    if (!video) return

    if (isPlaying) {
      video.pause()
      setIsPlaying(false)
      return
    }

    try {
      if (duration > 0 && video.currentTime >= duration - 0.15) {
        seekTo(0)
      }
      // TTS는 합본에 이미 들어감. 별도 audio 재생으로 "no supported sources" 나지 않게 함
      await video.play()
      setIsPlaying(true)
      setError("")
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason)
      if (/no supported sources|NotSupportedError|Empty src/i.test(message)) {
        setError("영상 소스가 깨졌습니다. 「다시 이어 붙이기」로 재생성합니다…")
        const remade = await mergeClips()
        if (remade) {
          await new Promise((r) => window.setTimeout(r, 100))
          const v2 = activeVideoRef()
          try {
            await v2?.play()
            setIsPlaying(true)
            setError("")
          } catch (e2) {
            setError(
              e2 instanceof Error
                ? e2.message
                : "재생 실패. 영상 클립이 만료됐을 수 있으니 영상 단계에서 다시 생성해주세요."
            )
          }
        }
        return
      }
      setError(message || "재생 실패")
    }
  }

  const openFullscreen = () => {
    if (!brief.mergedVideoUrl) return
    setIsFullscreen(true)
  }

  const closeFullscreen = () => {
    setIsFullscreen(false)
  }

  const download = async () => {
    setIsDownloading(true)
    setError("")
    try {
      // 다운로드는 항상 TTS 포함해 다시 합친 뒤, Windows용 duration 메타를 보정
      setStatusHint("다운로드용으로 TTS 포함 합치는 중…")
      const remade = await mergeClips({ forceTts: true })
      if (!remade) {
        throw new Error(
          "다운로드용 영상을 만들지 못했습니다. TTS·클립을 확인한 뒤 다시 시도해주세요."
        )
      }

      let blob = remade.blob
      setStatusHint("Windows 속성·재생용으로 길이 정보 정리 중… (잠시만요)")
      try {
        blob = await remuxWebmWithDuration(blob, remade.durationSec)
      } catch (remuxError) {
        console.warn("[AnimalPreview] remux 실패, duration 보정만 사용:", remuxError)
      }
      try {
        blob = await fixWebmBlobDuration(blob, remade.durationSec)
      } catch {
        /* ignore */
      }

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `animal-shopping-${brief.character.name}-${Date.now()}.webm`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)

      if (!remade.hasAudio) {
        setError(
          "다운로드는 됐지만 TTS가 없어 무음입니다. 음성 단계에서 나레이션을 다시 만든 뒤 다운로드하세요."
        )
        setStatusHint("")
      } else {
        setStatusHint(
          `다운로드 완료 · TTS 포함 · 약 ${Math.round(remade.durationSec)}초`
        )
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "다운로드 실패")
      setStatusHint("")
    } finally {
      setIsDownloading(false)
    }
  }

  const handleSeparateAssetDownload = async (id: string) => {
    const base = brief.productName || brief.character.name || "animal-shopping"
    setSeparateAssetBusy(id)
    setError("")
    try {
      if (id === "thumbnail") {
        const url = brief.imageUrls.find(Boolean) || brief.imageUrls[0]
        if (!url) throw new Error("썸네일로 쓸 이미지가 없습니다.")
        await downloadUrlAsFile(url, assetFilename(base, "thumbnail", "png"))
        return
      }
      if (id === "tts") {
        const url = await resolveTtsForMerge()
        if (!url) throw new Error("TTS가 없습니다. 음성 단계에서 먼저 생성해 주세요.")
        await downloadTtsUrl(url, base)
        return
      }
      if (id === "video") {
        if (sortedVideos.length === 0) {
          throw new Error("장면 영상이 없습니다.")
        }
        setStatusHint("TTS 없는 영상만 합치는 중…")
        const merged = await mergeAnimalVideosClient(sortedVideos, undefined)
        downloadBlob(merged.blob, assetFilename(base, "video", "webm"))
        setStatusHint("영상만(무음/믹스) 저장 완료")
        return
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "개별 파일 저장 실패")
      setStatusHint("")
    } finally {
      setSeparateAssetBusy(null)
    }
  }

  const onVideoTimeUpdate = (el: HTMLVideoElement | null) => {
    if (!el) return
    if (!isValidDuration(mediaDuration) && isValidDuration(el.duration)) {
      setMediaDuration(el.duration)
    }
    const t = el.currentTime
    const max = pickDuration(mediaDuration, el.duration, fallbackDuration)
    if (max > 0 && t >= max - 0.05) {
      setCurrentTime(max)
    } else {
      setCurrentTime(Number.isFinite(t) ? t : 0)
    }
  }

  const onVideoEnded = (el: HTMLVideoElement | null) => {
    setIsPlaying(false)
    const end = pickDuration(
      mediaDuration,
      el && isValidDuration(el.duration) ? el.duration : 0,
      el?.currentTime,
      fallbackDuration
    )
    if (end > 0) setCurrentTime(end)
  }

  const videoHandlers = {
    onTimeUpdate: (e: React.SyntheticEvent<HTMLVideoElement>) =>
      onVideoTimeUpdate(e.currentTarget),
    onLoadedMetadata: (e: React.SyntheticEvent<HTMLVideoElement>) => {
      void applyDiscoveredDuration(e.currentTarget)
    },
    onDurationChange: (e: React.SyntheticEvent<HTMLVideoElement>) => {
      void applyDiscoveredDuration(e.currentTarget)
    },
    onEnded: (e: React.SyntheticEvent<HTMLVideoElement>) => onVideoEnded(e.currentTarget),
    onPause: () => setIsPlaying(false),
    onPlay: () => setIsPlaying(true),
    onError: () => {
      setError(
        "영상 로드 실패. 「다시 이어 붙이기」를 누르거나 영상 클립을 다시 생성해주세요."
      )
      setIsPlaying(false)
    },
  }

  const sliderMax = duration > 0 ? duration : 1
  const sliderValue = Math.min(currentTime, sliderMax)
  const hasMerged = Boolean(brief.mergedVideoUrl)

  return (
    <div className="space-y-6">
      <div>
        <p className="animal-bubble-chip inline-flex px-2.5 py-1 text-[10px]">PREVIEW</p>
        <h2 className="animal-display mt-2 text-xl font-bold text-[#fff6ee]">
          숏폼 미리보기 · 내보내기
        </h2>
        <p className="mt-1 text-sm text-[#9aa89c]">
          {expectedClips || "N"}클립을 이어 붙일 때 TTS 나레이션을 파일에 넣습니다. 다운로드 시
          Windows에서 길이가 보이도록 메타데이터도 보정합니다.
        </p>
        {statusHint ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-[#7dd3a8]">
            {(isMerging || isDownloading) && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {statusHint}
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
        <div className="mx-auto w-full max-w-[320px]">
          <div className="overflow-hidden rounded-[1.75rem] border border-[rgba(255,246,238,0.14)] bg-black shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
            <div className="relative aspect-[9/16] bg-black">
              {hasMerged ? (
                <>
                  <video
                    ref={videoRef}
                    src={brief.mergedVideoUrl}
                    playsInline
                    className="h-full w-full object-cover"
                    {...videoHandlers}
                  />
                  <button
                    type="button"
                    onClick={openFullscreen}
                    className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/55 text-[#fff6ee] backdrop-blur-sm transition hover:bg-black/75"
                    title="전체화면으로 확대"
                    aria-label="전체화면으로 확대"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-[#6b7a6e]">
                  {isMerging ? (
                    <>
                      <Loader2 className="h-8 w-8 animate-spin text-[#7dd3a8]" />
                      <p className="text-sm">클립+TTS 이어 붙이는 중…</p>
                    </>
                  ) : (
                    <p className="text-sm">미리보기 영상이 없습니다.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <input
              type="range"
              min={0}
              max={sliderMax}
              step={0.05}
              value={sliderValue}
              onChange={(e) => seekTo(Number(e.target.value))}
              className="w-full accent-[#7dd3a8]"
            />
            <div className="flex items-center justify-between text-xs text-[#9aa89c]">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => void togglePlay()}
                disabled={!hasMerged && sortedVideos.length === 0}
                className="animal-mint-btn flex-1 rounded-full font-semibold"
              >
                {isPlaying ? (
                  <>
                    <Pause className="mr-2 h-4 w-4" />
                    일시정지
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    재생
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={openFullscreen}
                disabled={!hasMerged}
                className="rounded-full"
                title="전체화면"
              >
                <Maximize2 className="mr-2 h-4 w-4" />
                확대
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void mergeClips({ forceTts: true })}
                disabled={isMerging || sortedVideos.length === 0}
                className="rounded-full"
              >
                {isMerging ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Scissors className="mr-2 h-4 w-4" />
                )}
                다시 이어 붙이기
              </Button>
              <Button
                type="button"
                onClick={() => void download()}
                disabled={isDownloading || (!hasMerged && sortedVideos.length === 0)}
                className="animal-cta-cute rounded-full font-semibold"
              >
                {isDownloading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                다운로드
              </Button>
            </div>
            <SeparateAssetDownloads
              className="mt-3"
              busyId={separateAssetBusy}
              onDownload={(id) => void handleSeparateAssetDownload(id)}
              description="동물 숏폼은 자막을 쓰지 않습니다. 썸네일·영상·TTS만 따로 저장합니다."
              items={[
                {
                  id: "thumbnail",
                  label: "썸네일만",
                  hint: "첫 장면 이미지",
                  disabled: !brief.imageUrls.some(Boolean),
                  missingReason: "이미지 없음",
                },
                {
                  id: "video",
                  label: "영상만",
                  hint: "TTS 없는 합본 WebM",
                  disabled: sortedVideos.length === 0,
                  missingReason: "클립 없음",
                },
                {
                  id: "tts",
                  label: "TTS만",
                  hint: "나레이션 오디오",
                  disabled: !playableTtsUrl && !(brief.scenes || []).some((s) => s.ttsAudioUrl),
                  missingReason: "TTS 없음",
                },
              ]}
            />
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-[rgba(255,246,238,0.12)] bg-black/25 p-5">
          <h3 className="animal-display text-lg font-bold text-[#fff6ee]">프로젝트 요약</h3>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-[#6b7a6e]">캐릭터</dt>
              <dd className="font-semibold text-[#fff6ee]">
                {brief.character.name} · {brief.character.breedOrLook || brief.character.species}
              </dd>
            </div>
            <div>
              <dt className="text-[#6b7a6e]">제품</dt>
              <dd className="font-semibold text-[#fff6ee]">{brief.productName || "-"}</dd>
            </div>
            <div>
              <dt className="text-[#6b7a6e]">대본</dt>
              <dd className="leading-6 text-[#d7e0d8]">{brief.script || "-"}</dd>
            </div>
            <div>
              <dt className="text-[#6b7a6e]">생성</dt>
              <dd className="text-[#d7e0d8]">
                씬 {brief.scenes?.length || 0} · 이미지 {brief.imageUrls.length}/
                {brief.scenes?.length || 0} · 클립 {sortedVideos.length}/
                {brief.scenes?.length || 0} · TTS{" "}
                {playableTtsUrl
                  ? playableTtsUrl.startsWith("blob:")
                    ? "있음(세션)"
                    : "있음"
                  : brief.ttsAudioUrl
                    ? "만료됨(재생성 필요)"
                    : "없음"}
                {muxedWithTts ? " · 합본에 음성 포함" : ""}
              </dd>
            </div>
          </dl>
          {!playableTtsUrl ? (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              {brief.ttsAudioUrl
                ? "TTS 링크가 만료됐습니다. 음성 단계에서 나레이션을 다시 만든 뒤 「다시 이어 붙이기」를 누르세요."
                : "TTS가 없으면 무음 영상만 나갑니다. 음성 단계에서 나레이션을 만들어 주세요."}
            </p>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {isFullscreen && brief.mergedVideoUrl ? (
        <div className="fixed inset-0 z-[80] flex flex-col bg-black/95 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <p className="text-sm font-semibold text-[#fff6ee]">전체화면 미리보기</p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void togglePlay()}
                className="rounded-full"
              >
                {isPlaying ? (
                  <>
                    <Pause className="mr-1.5 h-4 w-4" />
                    일시정지
                  </>
                ) : (
                  <>
                    <Play className="mr-1.5 h-4 w-4" />
                    재생
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={closeFullscreen}
                className="rounded-full"
                title="축소 (Esc)"
              >
                <Minimize2 className="mr-1.5 h-4 w-4" />
                축소
              </Button>
              <button
                type="button"
                onClick={closeFullscreen}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[#fff6ee] hover:bg-white/20"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-4">
            <div className="relative aspect-[9/16] h-full max-h-[calc(100vh-7.5rem)] w-auto max-w-[min(100%,calc((100vh-7.5rem)*9/16))] overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
              <video
                ref={fsVideoRef}
                src={brief.mergedVideoUrl}
                playsInline
                className="h-full w-full object-contain"
                {...videoHandlers}
              />
            </div>
          </div>

          <div className="mx-auto w-full max-w-xl space-y-2 px-4 pb-6">
            <input
              type="range"
              min={0}
              max={sliderMax}
              step={0.05}
              value={sliderValue}
              onChange={(e) => seekTo(Number(e.target.value))}
              className="w-full accent-[#7dd3a8]"
            />
            <div className="flex items-center justify-between text-xs text-[#9aa89c]">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "00:00"
  const m = Math.floor(sec / 60)
  const r = Math.floor(sec % 60)
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`
}
