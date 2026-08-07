"use client"

import { useState } from "react"
import { ArrowRight, Film, Loader2, Play, RefreshCw, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { generateVideoPromptFromScript, generateVideoWithSeedance } from "./actions"
import {
  ANIMAL_SCENE_LABELS,
  type AnimalShoppingBrief,
} from "./animal-studio-types"
import { productDisplayUrl } from "./animal-studio-utils"

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
          scenes: [...nextScenes],
          videoUrls: [...results],
          mergedVideoUrl: undefined,
        })
      }

      onChange({
        ...brief,
        scenes: nextScenes,
        videoUrls: results,
        mergedVideoUrl: undefined,
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "영상 변환 실패")
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
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {videosReady ? "클립 다시 만들기" : `${sceneCount || ""}클립 생성`}
        </Button>
      </div>

      {progress ? (
        <p className="flex items-center gap-2 text-sm text-[#7dd3a8]">
          <Loader2 className="h-4 w-4 animate-spin" />
          {progress}
        </p>
      ) : null}

      {videos.length === 0 && !isGenerating ? (
        <div className="rounded-3xl border border-dashed border-[rgba(255,246,238,0.2)] bg-black/20 px-6 py-16 text-center">
          <Film className="mx-auto h-10 w-10 text-[#6b7a6e]" />
          <p className="mt-3 text-[#9aa89c]">아직 영상 클립이 없습니다.</p>
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
                  </p>
                  {scene?.ttsDurationSec ? (
                    <p className="text-[11px] text-[#9aa89c]">
                      TTS {scene.ttsDurationSec.toFixed(1)}초 → 영상{" "}
                      {Math.min(12, Math.max(4, Math.ceil(scene.ttsDurationSec)))}초
                    </p>
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
