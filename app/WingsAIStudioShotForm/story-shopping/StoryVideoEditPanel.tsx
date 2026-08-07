"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { Pause, Play, RotateCcw, Scissors, Type, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { trimSilenceFromAudioUrl } from "@/lib/shotform-factory-line-tts"
import {
  DEFAULT_STORY_FRAME_SETTINGS,
  splitNarrationIntoMeaningLines,
  StoryChannelFrame,
} from "./StoryChannelFrame"
import {
  getStoryCaptionLines,
  isSplitLineTtsTrack,
  resolveCaptionTimingCues,
  resolveStoryLineAsset,
} from "./story-line-assets"
import { shiftCaptionCuesForTrim } from "./story-caption-align"
import type {
  StoryEditSettings,
  StorySceneAsset,
  StoryShoppingBrief,
  StoryVoiceTrack,
} from "./story-types"

const DEFAULT_SETTINGS: StoryEditSettings = {
  subtitleColor: "#000000",
  subtitleSize: 36,
  subtitlePosition: "bottom",
  backgroundColor: "#000000",
}

type SplitLineAudio = { lineIndex: number; text: string; audioUrl: string }

/** 구형: 줄마다 따로 만든 TTS만 반환 */
function resolveSplitLineAudios(
  track: StoryVoiceTrack | undefined,
  narration: string
): SplitLineAudio[] {
  if (!isSplitLineTtsTrack(track) || !track?.lineTracks?.length) return []
  return track.lineTracks
    .filter((item): item is typeof item & { audioUrl: string } => Boolean(item.audioUrl))
    .map((item) => ({
      lineIndex: item.lineIndex,
      text: item.text || narration,
      audioUrl: item.audioUrl,
    }))
}

function countLinesForScene(
  scene: { id: string; narration: string },
  tracks: StoryVoiceTrack[] | undefined
): number {
  const track = tracks?.find((item) => item.sceneId === scene.id)
  return Math.max(1, getStoryCaptionLines(scene.narration, track).length)
}

/**
 * 벤치마크형 컷: TTS 줄 인덱스마다 다른 장면 소재로 전환.
 * 소재가 줄보다 적으면 순환하고, 같은 영상은 구간을 나눠 다른 컷처럼 보이게 합니다.
 */
function pickCutAsset(
  pool: StorySceneAsset[],
  globalLineIndex: number
): StorySceneAsset | undefined {
  if (!pool.length) return undefined
  const asset = pool[globalLineIndex % pool.length]!
  if (asset.mediaType !== "video") return asset

  const occurrence = Math.floor(globalLineIndex / pool.length)
  const baseStart = asset.trimStartSec ?? 0
  const baseEnd = asset.trimEndSec
  const sliceSec = 2.6

  if (baseEnd != null && baseEnd > baseStart + 0.4) {
    const span = baseEnd - baseStart
    const maxSlices = Math.max(1, Math.min(6, Math.floor(span / 1.1)))
    const sliceIndex = occurrence % maxSlices
    const slice = span / maxSlices
    return {
      ...asset,
      trimStartSec: baseStart + sliceIndex * slice,
      trimEndSec: baseStart + (sliceIndex + 1) * slice,
    }
  }

  return {
    ...asset,
    trimStartSec: baseStart + occurrence * sliceSec,
    trimEndSec: baseStart + (occurrence + 1) * sliceSec,
  }
}

export function StoryVideoEditPanel({
  brief,
  onChange,
}: {
  brief: StoryShoppingBrief
  onChange: (brief: StoryShoppingBrief) => void
}) {
  const scenes = brief.generatedStory?.scenes || []
  const settings = brief.editSettings || DEFAULT_SETTINGS
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [activeLineIndex, setActiveLineIndex] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playGenRef = useRef(0)
  const trimmedCacheRef = useRef(
    new Map<
      string,
      { blobUrl: string; trimStartSec: number; durationSec: number }
    >()
  )
  const currentIndexRef = useRef(currentIndex)
  currentIndexRef.current = currentIndex

  const scene = scenes[currentIndex]
  const sceneAsset = brief.sceneAssets?.find((item) => item.sceneId === scene?.id)
  const track = brief.voiceData?.tracks.find((item) => item.sceneId === scene?.id)
  const splitLineAudios = useMemo(
    () => (scene ? resolveSplitLineAudios(track, scene.narration) : []),
    [scene, track]
  )
  /** 화면 자막 = 의미 단위 (통 TTS와 분리) */
  const displayLines = useMemo(() => {
    if (!scene) return []
    return getStoryCaptionLines(scene.narration, track)
  }, [scene, track])

  /** 장면 순서대로 모은 소재 풀 — 줄마다 이 풀을 순회하며 컷 전환 */
  const mediaPool = useMemo(() => {
    return scenes
      .map((item) => brief.sceneAssets?.find((assetItem) => assetItem.sceneId === item.id))
      .filter((item): item is StorySceneAsset => Boolean(item?.mediaUrl))
  }, [brief.sceneAssets, scenes])

  const globalLineIndex = useMemo(() => {
    let offset = 0
    for (let index = 0; index < currentIndex; index += 1) {
      const item = scenes[index]
      if (!item) continue
      offset += countLinesForScene(item, brief.voiceData?.tracks)
    }
    return offset + activeLineIndex
  }, [activeLineIndex, brief.voiceData?.tracks, currentIndex, scenes])

  // 재생/정지 모두: 해당 대본 줄 소재 우선 → 없으면 풀 순환(구형 데이터 폴백)
  const displayAsset = useMemo(() => {
    if (!scene) return sceneAsset
    const lineAsset = resolveStoryLineAsset(brief.sceneAssets, scene.id, activeLineIndex)
    if (lineAsset) return lineAsset
    if (isPlaying) return pickCutAsset(mediaPool, globalLineIndex) || sceneAsset
    return sceneAsset
  }, [activeLineIndex, brief.sceneAssets, globalLineIndex, isPlaying, mediaPool, scene, sceneAsset])

  const prefetchMedia = useMemo(() => {
    const items: Array<{
      url: string
      mediaType?: "image" | "video"
      trimStartSec?: number
    }> = []
    // 같은 장면 다음 줄
    if (scene) {
      for (let offset = 1; offset <= 2; offset += 1) {
        const next = resolveStoryLineAsset(
          brief.sceneAssets,
          scene.id,
          activeLineIndex + offset
        )
        if (next?.mediaUrl) {
          items.push({
            url: next.mediaUrl,
            mediaType: next.mediaType,
            trimStartSec: next.trimStartSec,
          })
        }
      }
    }
    // 다음 장면 첫 줄
    const nextScene = scenes[currentIndex + 1]
    if (nextScene) {
      const next = resolveStoryLineAsset(brief.sceneAssets, nextScene.id, 0)
      if (next?.mediaUrl) {
        items.push({
          url: next.mediaUrl,
          mediaType: next.mediaType,
          trimStartSec: next.trimStartSec,
        })
      }
    }
    return items
  }, [activeLineIndex, brief.sceneAssets, currentIndex, scene, scenes])

  const frameSettings = {
    ...DEFAULT_STORY_FRAME_SETTINGS,
    videoTitle: brief.generatedStory?.title || DEFAULT_STORY_FRAME_SETTINGS.videoTitle,
    ...brief.frameSettings,
  }
  const readyCount = useMemo(() => {
    let filled = 0
    let total = 0
    for (const item of scenes) {
      const trackItem = brief.voiceData?.tracks.find((t) => t.sceneId === item.id)
      const lines = Math.max(1, getStoryCaptionLines(item.narration, trackItem).length)
      total += lines
      for (let lineIndex = 0; lineIndex < lines; lineIndex += 1) {
        if (resolveStoryLineAsset(brief.sceneAssets, item.id, lineIndex)?.mediaUrl) filled += 1
      }
    }
    return { filled, total }
  }, [brief.sceneAssets, brief.voiceData?.tracks, scenes])

  useEffect(() => {
    return () => {
      playGenRef.current += 1
      audioRef.current?.pause()
      if (timerRef.current) clearTimeout(timerRef.current)
      for (const entry of trimmedCacheRef.current.values()) {
        if (entry.blobUrl.startsWith("blob:")) URL.revokeObjectURL(entry.blobUrl)
      }
      trimmedCacheRef.current.clear()
    }
  }, [])

  useEffect(() => {
    if (!isPlaying || !scene) return

    const gen = ++playGenRef.current
    audioRef.current?.pause()
    if (timerRef.current) clearTimeout(timerRef.current)

    const getTrimmed = async (url: string) => {
      const cached = trimmedCacheRef.current.get(url)
      if (cached) return cached
      try {
        const result = await trimSilenceFromAudioUrl(url, 0.018)
        const entry = {
          blobUrl: result.blobUrl,
          trimStartSec: result.trimStartSec,
          durationSec: result.durationSec,
        }
        trimmedCacheRef.current.set(url, entry)
        return entry
      } catch {
        return { blobUrl: url, trimStartSec: 0, durationSec: 0 }
      }
    }

    const nextSceneAudioUrl = () => {
      const nextScene = scenes[currentIndexRef.current + 1]
      if (!nextScene) return undefined
      const nextTrack = brief.voiceData?.tracks.find((item) => item.sceneId === nextScene.id)
      if (!nextTrack?.audioUrl) return undefined
      if (isSplitLineTtsTrack(nextTrack)) {
        return nextTrack.lineTracks?.[0]?.audioUrl || nextTrack.audioUrl
      }
      return nextTrack.audioUrl
    }

    const advanceScene = () => {
      setActiveLineIndex(0)
      setCurrentIndex((index) => {
        if (index >= scenes.length - 1) {
          setIsPlaying(false)
          return 0
        }
        return index + 1
      })
    }

    const prepareAudio = async (audioUrl: string) => {
      const trimmed = await getTrimmed(audioUrl)
      if (gen !== playGenRef.current) return null
      const audio = new Audio()
      audio.preload = "auto"
      audio.src = trimmed.blobUrl
      await new Promise<void>((resolve) => {
        let settled = false
        const done = () => {
          if (settled) return
          settled = true
          resolve()
        }
        audio.oncanplaythrough = () => done()
        audio.onloadeddata = () => {
          if (audio.readyState >= 2) done()
        }
        window.setTimeout(done, 1500)
        void audio.load()
      })
      if (gen !== playGenRef.current) return null
      return {
        audio,
        trimStartSec: trimmed.trimStartSec,
        durationSec:
          Number.isFinite(audio.duration) && audio.duration > 0
            ? audio.duration
            : trimmed.durationSec,
      }
    }

    const playPrepared = (audio: HTMLAudioElement) =>
      new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve()
        audio.onerror = () => reject(new Error("audio error"))
        const start = audio.play()
        if (start) void start.then(undefined, reject)
      })

    const lineIndexAtTime = (
      cues: Array<{ lineIndex: number; startSec: number; endSec: number }>,
      timeSec: number
    ) => {
      for (let index = cues.length - 1; index >= 0; index -= 1) {
        if (timeSec >= cues[index]!.startSec) return cues[index]!.lineIndex
      }
      return 0
    }

    /** 신형: 장면 통 TTS 1개 + 자막/컷만 시간 싱크 */
    const playContinuousScene = async (audioUrl: string, captions: string[]) => {
      const prepared = await prepareAudio(audioUrl)
      if (!prepared) return
      const { audio, trimStartSec, durationSec } = prepared
      audioRef.current = audio
      const duration =
        durationSec > 0
          ? durationSec
          : Math.max(1.2, track?.durationSec || scene.durationSec)
      const baseCues = resolveCaptionTimingCues(
        captions.length ? captions : [scene.narration],
        Math.max(duration + trimStartSec, track?.durationSec || duration),
        track
      )
      const cues = shiftCaptionCuesForTrim(baseCues, trimStartSec, duration)
      flushSync(() => setActiveLineIndex(0))

      const nextFirst = nextSceneAudioUrl()
      if (nextFirst) void getTrimmed(nextFirst)

      await new Promise<void>((resolve, reject) => {
        const onTime = () => {
          if (gen !== playGenRef.current) return
          const nextLine = lineIndexAtTime(cues, audio.currentTime)
          setActiveLineIndex((prev) => (prev === nextLine ? prev : nextLine))
        }
        const cleanup = () => {
          audio.removeEventListener("timeupdate", onTime)
          audio.onended = null
          audio.onerror = null
        }
        audio.addEventListener("timeupdate", onTime)
        audio.onended = () => {
          cleanup()
          resolve()
        }
        audio.onerror = () => {
          cleanup()
          reject(new Error("audio error"))
        }
        const start = audio.play()
        if (start) void start.then(undefined, (err) => {
          cleanup()
          reject(err)
        })
      })
    }

    const playScene = async () => {
      // 구형 호환: 줄마다 따로 TTS가 있으면 순차 재생
      if (splitLineAudios.length > 0) {
        const prepared: HTMLAudioElement[] = []
        for (const item of splitLineAudios) {
          if (gen !== playGenRef.current) return
          const ready = await prepareAudio(item.audioUrl)
          if (!ready) return
          prepared.push(ready.audio)
        }
        const nextFirst = nextSceneAudioUrl()
        if (nextFirst) void getTrimmed(nextFirst)
        if (gen !== playGenRef.current) return

        for (let lineIndex = 0; lineIndex < prepared.length; lineIndex += 1) {
          if (gen !== playGenRef.current) return
          const audio = prepared[lineIndex]!
          audioRef.current = audio
          flushSync(() => {
            setActiveLineIndex(lineIndex)
          })
          try {
            await playPrepared(audio)
          } catch {
            await new Promise<void>((resolve) => {
              timerRef.current = setTimeout(
                resolve,
                Math.max(400, (scene.durationSec * 1000) / prepared.length)
              )
            })
          }
        }
        if (gen === playGenRef.current) advanceScene()
        return
      }

      // 신형: 장면 통 TTS
      if (track?.audioUrl) {
        try {
          await playContinuousScene(track.audioUrl, displayLines)
        } catch {
          const visuals = displayLines.length ? displayLines : [scene.narration]
          const perLineMs = Math.max(500, (scene.durationSec * 1000) / visuals.length)
          for (let step = 0; step < visuals.length; step += 1) {
            if (gen !== playGenRef.current) return
            setActiveLineIndex(step)
            await new Promise<void>((resolve) => {
              timerRef.current = setTimeout(resolve, perLineMs)
            })
          }
        }
        if (gen === playGenRef.current) advanceScene()
        return
      }

      // TTS 없음: 의미 단위만 시간으로 넘김
      const visuals = displayLines.length
        ? displayLines
        : splitNarrationIntoMeaningLines(scene.narration).filter(Boolean)
      const visualCount = Math.max(1, visuals.length)
      const perLineMs = Math.max(500, (scene.durationSec * 1000) / visualCount)
      for (let step = 0; step < visualCount; step += 1) {
        if (gen !== playGenRef.current) return
        setActiveLineIndex(step)
        await new Promise<void>((resolve) => {
          timerRef.current = setTimeout(resolve, perLineMs)
        })
      }
      if (gen === playGenRef.current) advanceScene()
    }

    void playScene()

    return () => {
      playGenRef.current += 1
      audioRef.current?.pause()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isPlaying, scene, scenes, splitLineAudios, track, brief.voiceData?.tracks, displayLines])

  const patchSettings = (patch: Partial<StoryEditSettings>) =>
    onChange({ ...brief, editSettings: { ...settings, ...patch } })

  if (!scene) {
    return (
      <div className="rounded-[28px] border border-dashed border-white/15 py-24 text-center text-zinc-400">
        스토리 대본을 먼저 생성해주세요.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="rounded-[28px] border border-white/10 bg-[#080808] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-[9px] font-black tracking-[0.18em] text-orange-300">
                <Scissors className="h-4 w-4" />
                STORY VIDEO EDITOR
              </div>
              <h2 className="mt-1 text-xl font-black text-white">영상 편집 미리보기</h2>
            </div>
            <span className="text-[10px] text-zinc-400">
              소재 {readyCount.filled}/{readyCount.total}줄
            </span>
          </div>

          <div
            className="relative mx-auto aspect-[9/16] max-h-[650px] overflow-hidden rounded-[24px] border border-white/10 shadow-2xl"
          >
            <StoryChannelFrame
              settings={frameSettings}
              scene={scene}
              asset={displayAsset}
              fallbackMediaUrl={brief.productImage}
              isPlaying={isPlaying}
              activeNarrationLine={activeLineIndex}
              narrationDisplayLines={displayLines}
              textColor={settings.subtitleColor}
              textScale={Math.max(0.75, Math.min(1.35, settings.subtitleSize / 36))}
              mediaBackgroundColor={settings.backgroundColor}
              prefetchMedia={prefetchMedia}
              className="h-full w-full"
            />
          </div>

          <div className="mt-5 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsPlaying(false)
                setCurrentIndex(0)
                setActiveLineIndex(0)
              }}
              className="border-white/15 bg-white/[0.04] text-white"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => setIsPlaying((value) => !value)}
              className="h-11 min-w-[140px] bg-orange-500 font-black text-black hover:bg-orange-300"
            >
              {isPlaying ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
              {isPlaying ? "일시 정지" : "전체 미리보기"}
            </Button>
          </div>
        </section>

        <aside className="rounded-[28px] border border-white/10 bg-[#0d0d0c] p-5">
          <div className="flex items-center gap-2 text-sm font-black text-white">
            <Type className="h-4 w-4 text-orange-300" />
            자막 스타일
          </div>
          <div className="mt-6 space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-zinc-300">자막 크기</Label>
                <span className="text-xs font-black text-orange-300">{settings.subtitleSize}px</span>
              </div>
              <Slider
                value={[settings.subtitleSize]}
                min={20}
                max={56}
                step={1}
                onValueChange={([value]) => patchSettings({ subtitleSize: value })}
                className="mt-4"
              />
            </div>
            <div className="rounded-xl border border-amber-400/15 bg-amber-500/[0.06] p-3 text-[10px] leading-5 text-amber-100/80">
              대본 위치는 선택한 썰 채널 템플릿의 중앙 영역으로 고정됩니다.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] text-zinc-400">글자 색상</Label>
                <Input
                  value={settings.subtitleColor}
                  onChange={(event) => patchSettings({ subtitleColor: event.target.value })}
                  className="mt-2 border-white/10 bg-black/25 !text-zinc-100"
                />
              </div>
              <div>
                <Label className="text-[10px] text-zinc-400">배경 색상</Label>
                <Input
                  value={settings.backgroundColor}
                  onChange={(event) => patchSettings({ backgroundColor: event.target.value })}
                  className="mt-2 border-white/10 bg-black/25 !text-zinc-100"
                />
              </div>
            </div>
          </div>
          <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-200">
              <Volume2 className="h-4 w-4 text-cyan-300" />
              장면별 TTS 동기화
            </div>
            <p className="mt-2 text-[10px] leading-5 text-zinc-500">
              목소리는 장면 대본을 통째로 한 번 읽고, 자막·영상 컷만 의미 단위 타이밍에 맞춰
              바뀝니다. 예전에 줄마다 만든 음성은 그대로 순차 재생됩니다. 가장 자연스럽게
              들으려면 음성 단계에서 「통 TTS」를 다시 생성하세요.
            </p>
          </div>
        </aside>
      </div>

      <section className="rounded-[24px] border border-white/10 bg-[#0a0a09] p-4">
        <div className="mb-3 text-[9px] font-black tracking-[0.16em] text-zinc-500">TIMELINE</div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {scenes.map((item, index) => {
            const itemAsset = brief.sceneAssets?.find((assetItem) => assetItem.sceneId === item.id)
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setIsPlaying(false)
                  setCurrentIndex(index)
                  setActiveLineIndex(0)
                }}
                className={`min-w-[150px] overflow-hidden rounded-xl border text-left transition ${
                  index === currentIndex
                    ? "border-orange-300 bg-orange-500/10"
                    : "border-white/10 bg-white/[0.025]"
                }`}
              >
                <div className="aspect-video bg-black">
                  {itemAsset?.mediaType === "image" ? (
                    <img src={itemAsset.mediaUrl} alt="" className="h-full w-full object-cover" />
                  ) : itemAsset?.mediaType === "video" ? (
                    <video src={itemAsset.mediaUrl} muted className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="p-2">
                  <p className="text-[9px] font-black text-orange-200">SCENE {index + 1}</p>
                  <p className="mt-1 truncate text-[9px] text-zinc-500">{item.caption}</p>
                </div>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
