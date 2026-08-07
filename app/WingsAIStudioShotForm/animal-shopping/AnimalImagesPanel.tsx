"use client"

import { useState } from "react"
import { ArrowRight, ImagePlus, Loader2, RefreshCw, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  generateImage,
  generateImagePromptsFromScript,
  generateImageWithNanobanana,
} from "./actions"
import {
  ANIMAL_SCENE_LABELS,
  buildProductCloseupImagePrompt,
  joinSceneNarrations,
  pickAnimalProductCloseupIndex,
  type AnimalShoppingBrief,
} from "./animal-studio-types"
import { productDisplayUrl } from "./animal-studio-utils"

export function AnimalImagesPanel({
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
  const [selectedIndex, setSelectedIndex] = useState(0)

  const scenes = brief.scenes || []
  const sceneCount = scenes.length
  const prompts = brief.imagePrompts
  const images = brief.imageUrls
  const allReady = sceneCount >= 3 && images.length === sceneCount

  const generateAll = async () => {
    if (sceneCount < 3 || !brief.productName.trim()) {
      setError("씬 대본(3개 이상)과 제품명이 필요합니다.")
      return
    }
    setIsGenerating(true)
    setError("")
    try {
      const openaiKey = (localStorage.getItem("shotform_openai_api_key") || "").trim()
      const replicateKey = (localStorage.getItem("shotform_replicate_api_key") || "").trim()
      const fullScript = joinSceneNarrations(scenes)

      setProgress(`${sceneCount}씬 이미지 프롬프트 작성 중…`)
      let imagePrompts = await generateImagePromptsFromScript(
        fullScript,
        brief.productName,
        brief.productDescription || "",
        brief.productImage,
        openaiKey || undefined,
        brief.character,
        sceneCount
      )
      // 씬 타입만 보강. 한국어 나레이션은 프롬프트에 넣지 않음
      // (모델이 한글을 자막으로 그려넣는 문제 방지)
      imagePrompts = imagePrompts.map((prompt, index) => {
        const scene = scenes[index]
        const beat = scene?.type
        const locationHint =
          beat === "problem"
            ? "LOCATION: home or outdoor everyday spot. NOT supermarket aisle. NO product in hands."
            : beat === "travel"
              ? "LOCATION: outdoor path/street walking toward supermarket exterior, sunny daylight. NOT inside aisle. NO product in hands; empty basket OK."
              : beat === "detail"
                ? "LOCATION: product hero close-up filling the frame."
                : beat === "store" || beat === "compare" || beat === "buy"
                  ? "LOCATION: supermarket aisle discovering/buying the product."
                  : beat === "home"
                    ? "LOCATION: home interior with the purchased product."
                    : "LOCATION: using the product at home or outdoors."
        return {
          ...prompt,
          type: scene ? ANIMAL_SCENE_LABELS[scene.type] : prompt.type,
          description: scene?.title || prompt.description,
          scriptText: scene?.narration || prompt.scriptText,
          sceneBeat: beat,
          prompt: scene
            ? `${prompt.prompt}\n\nStory beat (MUST MATCH VISUALS): ${scene.type} / ${ANIMAL_SCENE_LABELS[scene.type]}.\n${locationHint}\nABSOLUTELY NO TEXT, NO SUBTITLES, NO CAPTIONS, NO HANGUL, NO LETTERS ON IMAGE.`
            : `${prompt.prompt}\n\nABSOLUTELY NO TEXT, NO SUBTITLES, NO CAPTIONS, NO HANGUL, NO LETTERS ON IMAGE.`,
        }
      })

      // 제품 확대샷 보장 — detail 전용 슬롯만 교체 (travel/problem 덮어쓰지 않음)
      const closeupIndex = pickAnimalProductCloseupIndex(scenes)
      const closeupScene = scenes[closeupIndex]
      if (
        closeupScene &&
        (closeupScene.type === "detail" ||
          closeupScene.type === "store" ||
          closeupScene.type === "compare" ||
          closeupScene.type === "buy")
      ) {
        const closeup = buildProductCloseupImagePrompt(
          brief.productName,
          brief.character,
          Boolean(brief.productImage?.trim())
        )
        imagePrompts[closeupIndex] = {
          ...closeup,
          sceneBeat: "detail",
          scriptText: closeupScene.narration || closeup.scriptText,
          prompt: `${closeup.prompt}\n\nStory beat: detail / 제품 확대.\nABSOLUTELY NO TEXT, NO SUBTITLES, NO CAPTIONS, NO HANGUL, NO LETTERS ON IMAGE.`,
        }
      }

      setProgress(`이미지 ${sceneCount}컷 생성 중… (제품 확대샷 포함)`)
      const imageUrls = await generateImage(
        fullScript,
        brief.productName,
        replicateKey || undefined,
        brief.productImage,
        brief.productDescription || "",
        openaiKey || undefined,
        imagePrompts,
        "9:16",
        brief.character
      )

      const nextScenes = scenes.map((scene, index) => ({
        ...scene,
        imagePrompt: imagePrompts[index]?.prompt,
        imageUrl: imageUrls[index],
        videoUrl: undefined,
      }))

      onChange({
        ...brief,
        scenes: nextScenes,
        imagePrompts,
        imageUrls,
        videoUrls: [],
        mergedVideoUrl: undefined,
      })
      setSelectedIndex(0)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "이미지 생성 실패")
    } finally {
      setIsGenerating(false)
      setProgress("")
    }
  }

  const regenerateOne = async (index: number) => {
    const prompt = prompts[index]
    if (!prompt) return
    setIsGenerating(true)
    setError("")
    setProgress(`씬 ${index + 1} 재생성 중…`)
    try {
      const replicateKey = (localStorage.getItem("shotform_replicate_api_key") || "").trim()
      const url = await generateImageWithNanobanana(
        prompt.prompt,
        brief.productName,
        brief.productImage,
        replicateKey || undefined,
        index,
        brief.productDescription || "",
        "9:16",
        brief.character,
        prompt.sceneBeat || scenes[index]?.type
      )
      const nextImages = [...images]
      nextImages[index] = url
      const nextScenes = scenes.map((scene, i) =>
        i === index ? { ...scene, imageUrl: url, videoUrl: undefined } : scene
      )
      onChange({
        ...brief,
        scenes: nextScenes,
        imageUrls: nextImages,
        videoUrls: [],
        mergedVideoUrl: undefined,
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "재생성 실패")
    } finally {
      setIsGenerating(false)
      setProgress("")
    }
  }

  const updatePrompt = (index: number, promptText: string) => {
    const next = prompts.map((item, i) =>
      i === index ? { ...item, prompt: promptText } : item
    )
    const nextScenes = scenes.map((scene, i) =>
      i === index ? { ...scene, imagePrompt: promptText } : scene
    )
    onChange({ ...brief, imagePrompts: next, scenes: nextScenes })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="animal-bubble-chip inline-flex px-2.5 py-1 text-[10px]">IMAGES</p>
          <h2 className="animal-display mt-2 text-xl font-bold text-[#fff6ee]">
            스토리 컷 {sceneCount || "N"}장
          </h2>
          <p className="mt-1 text-sm text-[#9aa89c]">
            씬마다 이미지를 만들고, 그중 1컷은 제품 확대샷입니다.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => void generateAll()}
          disabled={isGenerating || sceneCount < 3}
          className="animal-mint-btn rounded-full font-semibold"
        >
          {isGenerating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : allReady ? (
            <RefreshCw className="mr-2 h-4 w-4" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {allReady ? `${sceneCount}컷 다시 만들기` : `${sceneCount || ""}컷 생성`}
        </Button>
      </div>

      {progress ? (
        <p className="flex items-center gap-2 text-sm text-[#7dd3a8]">
          <Loader2 className="h-4 w-4 animate-spin" />
          {progress}
        </p>
      ) : null}

      {images.length === 0 && !isGenerating ? (
        <div className="rounded-3xl border border-dashed border-[rgba(255,246,238,0.2)] bg-black/20 px-6 py-16 text-center">
          <ImagePlus className="mx-auto h-10 w-10 text-[#6b7a6e]" />
          <p className="mt-3 text-[#9aa89c]">아직 씬 이미지가 없습니다.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div
            className={`grid gap-2 ${
              sceneCount <= 3
                ? "grid-cols-3"
                : sceneCount <= 4
                  ? "grid-cols-2 sm:grid-cols-4"
                  : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
            }`}
          >
            {Array.from({ length: Math.max(sceneCount, images.length) }, (_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setSelectedIndex(index)}
                className={`aspect-[9/16] overflow-hidden rounded-xl border ${
                  selectedIndex === index
                    ? "border-[#7dd3a8] ring-2 ring-[#7dd3a8]/40"
                    : "border-[rgba(255,246,238,0.12)]"
                }`}
              >
                {images[index] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={productDisplayUrl(images[index])}
                    alt={`씬 ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-black/40 text-xs text-[#6b7a6e]">
                    {scenes[index] ? ANIMAL_SCENE_LABELS[scenes[index].type] : index + 1}
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="space-y-3 rounded-2xl border border-[rgba(255,246,238,0.12)] bg-black/25 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-[#fff6ee]">
                씬 {selectedIndex + 1}
                {scenes[selectedIndex]
                  ? ` · ${ANIMAL_SCENE_LABELS[scenes[selectedIndex].type]}`
                  : ""}
              </p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={isGenerating || !prompts[selectedIndex]}
                onClick={() => void regenerateOne(selectedIndex)}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                이 컷만 재생성
              </Button>
            </div>
            {scenes[selectedIndex]?.narration ? (
              <p className="text-sm text-[#9aa89c]">{scenes[selectedIndex].narration}</p>
            ) : null}
            <Textarea
              value={prompts[selectedIndex]?.prompt || ""}
              onChange={(e) => updatePrompt(selectedIndex, e.target.value)}
              rows={6}
              placeholder="이미지 프롬프트"
              className="border-[rgba(243,235,224,0.12)] bg-black/35 text-sm text-[#f3ebe0]"
            />
            {images[selectedIndex] ? (
              <div className="mx-auto aspect-[9/16] max-h-[420px] overflow-hidden rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={productDisplayUrl(images[selectedIndex])}
                  alt="선택 씬"
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}
          </div>
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
          disabled={!allReady}
          onClick={onContinue}
          className="animal-cta-cute rounded-full px-6 font-bold"
        >
          영상 만들기로
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
