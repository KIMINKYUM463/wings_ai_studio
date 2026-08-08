"use client"

import { useState } from "react"
import { ArrowRight, Film, Loader2, Play, RefreshCw, Sparkles, ZoomIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import { renderImageZoomClip } from "@/lib/shotform-image-zoom-clip"
import { generateVideoPromptFromScript, generateVideoWithSeedance } from "./actions"
import {
  ANIMAL_SCENE_LABELS,
  type AnimalShoppingBrief,
} from "./animal-studio-types"
import { productDisplayUrl } from "./animal-studio-utils"

type VideoClipMode = "ai" | "zoom"

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === "string" && reader.result) {
        resolve(reader.result)
        return
      }
      reject(new Error("줌인 클립 data URL 변환에 실패했습니다."))
    }
    reader.onerror = () => reject(new Error("줌인 클립 data URL 변환에 실패했습니다."))
    reader.readAsDataURL(blob)
  })
}

function revokeStaleBlobUrls(urls: Array<{ videoUrl: string }>) {
  for (const item of urls) {
    const url = item.videoUrl
    if (typeof url === "string" && url.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(url)
      } catch {
        /* ignore */
      }
    }
  }
}

function clipDurationLabel(mode: VideoClipMode, ttsSec?: number) {
  if (!ttsSec || ttsSec <= 0) return null
  if (mode === "zoom") {
    const sec = Math.max(1.2, Math.min(30, ttsSec))
    return `TTS ${ttsSec.toFixed(1)}초 → 줌인 ${sec.toFixed(1)}초`
  }
  const sec = Math.min(12, Math.max(4, Math.ceil(ttsSec)))
  return `TTS ${ttsSec.toFixed(1)}초 → 영상 ${sec}초`
}

export function AnimalVideosPanel({
  brief,
  onChange,
  onContinue,
}: {
  brief: AnimalShoppingBrief
  onChange: (brief: AnimalShoppingBrief) => void
  onContinue: () => void
}) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState("")
  const [error, setError] = useState("")

  const scenes = brief.scenes || []
  const sceneCount = scenes.length
  const videos = [...brief.videoUrls].sort((a, b) => a.index - b.index)
  const imagesReady = brief.imageUrls.length === sceneCount && sceneCount >= 3
  const videosReady = videos.length === sceneCount && sceneCount >= 3
  const mode: VideoClipMode = brief.videoClipMode === "zoom" ? "zoom" : "ai"

  const setMode = (next: VideoClipMode) => {
    if (next === mode) return
    onChange({
      ...brief,
      videoClipMode: next,
      // 모드를 바꾸면 이전 방식 클립과 혼동되지 않도록 합본만 비움
      mergedVideoUrl: undefined,
    })
    setError("")
  }

  const generateAiClips = async () => {
    const replicateKey = (localStorage.getItem("shotform_replicate_api_key") || "").trim()
    const results: Array<{ index: number; videoUrl: string }> = []
    const nextScenes = [...scenes]

    for (let i = 0; i < sceneCount; i++) {
      const scene = scenes[i]
      // Seedance 1.5 Pro: 클립당 4~12초 — 이 씬 TTS 길이 기준
      const durationPerVideo = Math.min(
        12,
        Math.max(4, Math.ceil(scene.ttsDurationSec || 4))
      )
      setProgress(
        `씬 ${i + 1}/${sceneCount} (${ANIMAL_SCENE_LABELS[scene.type]}) · TTS ${scene.ttsDurationSec?.toFixed(1)}초 → 영상 ${durationPerVideo}초`
      )

      const prompt = await generateVideoPromptFromScript(
        scene.narration,
        brief.productName,
        durationPerVideo,
        brief.productDescription || "",
        brief.character,
        scene.type
      )

      const videoUrl = await generateVideoWithSeedance(
        brief.imageUrls[i],
        prompt,
        durationPerVideo,
        replicateKey || undefined,
        "seedance-1.5-pro"
      )
      results.push({ index: i, videoUrl })
      nextScenes[i] = { ...nextScenes[i], videoUrl }
      onChange({
        ...brief,
        videoClipMode: "ai",
        scenes: [...nextScenes],
        videoUrls: [...results],
        mergedVideoUrl: undefined,
      })
    }

    onChange({
      ...brief,
      videoClipMode: "ai",
      scenes: nextScenes,
      videoUrls: results,
      mergedVideoUrl: undefined,
    })
  }

  const generateZoomClips = async () => {
    revokeStaleBlobUrls(brief.videoUrls)
    const results: Array<{ index: number; videoUrl: string }> = []
    const nextScenes = [...scenes]

    for (let i = 0; i < sceneCount; i++) {
      const scene = scenes[i]
      const durationSec = Math.max(1.2, Math.min(30, scene.ttsDurationSec || 4))
      setProgress(
        `씬 ${i + 1}/${sceneCount} (${ANIMAL_SCENE_LABELS[scene.type]}) · 줌인 클립 ${durationSec.toFixed(1)}초`
      )

      const blob = await renderImageZoomClip({
        imageUrl: brief.imageUrls[i],
        durationSec,
        maxScale: 1.14,
      })
      // blob: 은 새로고침 후 깨지므로 data URL로 저장 (미리보기·다운로드·저장 호환)
      const videoUrl = await blobToDataUrl(blob)
      results.push({ index: i, videoUrl })
      nextScenes[i] = { ...nextScenes[i], videoUrl }
      onChange({
        ...brief,
        videoClipMode: "zoom",
        scenes: [...nextScenes],
        videoUrls: [...results],
        mergedVideoUrl: undefined,
      })
    }

    onChange({
      ...brief,
      videoClipMode: "zoom",
      scenes: nextScenes,
      videoUrls: results,
      mergedVideoUrl: undefined,
    })
  }

  const generateAll = async () => {
    if (!imagesReady) {
      setError(`이미지 ${sceneCount}장과 씬 대본이 필요합니다.`)
      return
    }
    if (scenes.some((s) => !s.ttsDurationSec || s.ttsDurationSec <= 0)) {
      setError("씬별 TTS를 먼저 만들어주세요. 영상 길이는 각 씬 음성 길이에 맞춥니다.")
      return
    }
    setIsGenerating(true)
    setError("")
    try {
      if (mode === "zoom") {
        await generateZoomClips()
      } else {
        await generateAiClips()
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : mode === "zoom"
            ? "줌인 클립 생성 실패"
            : "영상 변환 실패"
      )
    } finally {
      setIsGenerating(false)
      setProgress("")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="animal-bubble-chip inline-flex px-2.5 py-1 text-[10px]">VIDEOS</p>
          <h2 className="animal-display mt-2 text-xl font-bold text-[#fff6ee]">
            영상 제작
          </h2>
          <p className="mt-1 max-w-xl text-sm text-[#9aa89c]">
            AI로 움직임을 만들거나, API 없이 이미지 줌인 효과로 클립을 만들 수 있습니다.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => void generateAll()}
          disabled={isGenerating || !imagesReady}
          className="animal-mint-btn rounded-full font-semibold"
        >
          {isGenerating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : videosReady ? (
            <RefreshCw className="mr-2 h-4 w-4" />
          ) : mode === "zoom" ? (
            <ZoomIn className="mr-2 h-4 w-4" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {videosReady
            ? mode === "zoom"
              ? "줌인 클립 다시 만들기"
              : "클립 다시 만들기"
            : mode === "zoom"
              ? `줌인 ${sceneCount || ""}클립 만들기`
              : `${sceneCount || ""}클립 생성`}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isGenerating}
          onClick={() => setMode("ai")}
          className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
            mode === "ai"
              ? "border-[#7dd3a8]/50 bg-[#7dd3a8]/15 text-[#c8f5dc]"
              : "border-[rgba(255,246,238,0.12)] bg-black/20 text-[#9aa89c] hover:border-[rgba(255,246,238,0.25)]"
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            AI 영상 (Seedance)
          </span>
        </button>
        <button
          type="button"
          disabled={isGenerating}
          onClick={() => setMode("zoom")}
          className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
            mode === "zoom"
              ? "border-[#7dd3a8]/50 bg-[#7dd3a8]/15 text-[#c8f5dc]"
              : "border-[rgba(255,246,238,0.12)] bg-black/20 text-[#9aa89c] hover:border-[rgba(255,246,238,0.25)]"
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            <ZoomIn className="h-3.5 w-3.5" />
            줌인 효과
          </span>
        </button>
      </div>

      {mode === "zoom" ? (
        <p className="rounded-xl border border-[rgba(125,211,168,0.25)] bg-[rgba(125,211,168,0.08)] px-4 py-3 text-sm text-[#c8f5dc]">
          정지 이미지에 부드러운 줌인을 입혀 WebM 클립을 만듭니다. Replicate API 키·비용이 없고,
          TTS 길이에 맞춰 씬별로 생성됩니다. 미리보기에서 TTS와 합쳐집니다.
        </p>
      ) : (
        <p className="rounded-xl border border-[rgba(255,246,238,0.1)] bg-black/20 px-4 py-3 text-sm text-[#9aa89c]">
          장면 이미지를 Seedance로 짧은 모션 영상으로 변환합니다. Replicate API 키가 필요합니다.
        </p>
      )}

      {progress ? (
        <p className="flex items-center gap-2 text-sm text-[#7dd3a8]">
          <Loader2 className="h-4 w-4 animate-spin" />
          {progress}
        </p>
      ) : null}

      {videos.length === 0 && !isGenerating ? (
        <div className="rounded-3xl border border-dashed border-[rgba(255,246,238,0.2)] bg-black/20 px-6 py-16 text-center">
          <Film className="mx-auto h-10 w-10 text-[#6b7a6e]" />
          <p className="mt-3 text-[#9aa89c]">
            {mode === "zoom"
              ? "아직 줌인 클립이 없습니다. 위 버튼으로 만들어 주세요."
              : "아직 영상 클립이 없습니다."}
          </p>
        </div>
      ) : (
        <div
          className={`grid gap-4 ${
            sceneCount <= 3
              ? "sm:grid-cols-3"
              : sceneCount <= 4
                ? "sm:grid-cols-2 lg:grid-cols-4"
                : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          }`}
        >
          {Array.from({ length: Math.max(sceneCount, 1) }, (_, index) => {
            const clip = videos.find((v) => v.index === index)
            const scene = scenes[index]
            const durationText = clipDurationLabel(mode, scene?.ttsDurationSec)
            return (
              <div
                key={index}
                className="overflow-hidden rounded-2xl border border-[rgba(255,246,238,0.12)] bg-black/30"
              >
                <div className="aspect-[9/16] bg-black">
                  {clip?.videoUrl ? (
                    <video
                      src={clip.videoUrl}
                      controls
                      playsInline
                      className="h-full w-full object-cover"
                      poster={
                        brief.imageUrls[index]
                          ? productDisplayUrl(brief.imageUrls[index])
                          : undefined
                      }
                    />
                  ) : brief.imageUrls[index] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={productDisplayUrl(brief.imageUrls[index])}
                      alt={`대기 ${index + 1}`}
                      className="h-full w-full object-cover opacity-50"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[#6b7a6e]">
                      <Play className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <div className="space-y-1 px-3 py-2">
                  <p className="text-sm font-semibold text-[#fff6ee]">
                    씬 {index + 1}
                    {scene ? ` · ${ANIMAL_SCENE_LABELS[scene.type]}` : ""}
                    {clip?.videoUrl && mode === "zoom" ? (
                      <span className="ml-1 text-[10px] font-normal text-[#7dd3a8]">
                        줌인
                      </span>
                    ) : null}
                  </p>
                  {durationText ? (
                    <p className="text-[11px] text-[#9aa89c]">{durationText}</p>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="button"
          disabled={!videosReady}
          onClick={onContinue}
          className="animal-cta-cute rounded-full px-6 font-bold"
        >
          미리보기로
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
