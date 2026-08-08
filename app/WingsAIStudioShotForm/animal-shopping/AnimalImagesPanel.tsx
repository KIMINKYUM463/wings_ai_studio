"use client"

import { useRef, useState } from "react"
import {
  ArrowRight,
  Check,
  Copy,
  ImagePlus,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  generateAnimalImagePromptsSafe,
  generateAnimalSceneImageSafe,
} from "./actions"
import {
  ANIMAL_SCENE_LABELS,
  buildProductCloseupImagePrompt,
  joinSceneNarrations,
  pickAnimalProductCloseupIndex,
  type AnimalImagePrompt,
  type AnimalShoppingBrief,
} from "./animal-studio-types"
import { productDisplayUrl } from "./animal-studio-utils"

function friendlyClientError(reason: unknown, fallback: string) {
  const msg = reason instanceof Error ? reason.message : String(reason || "")
  if (/Server Components render|digest property/i.test(msg)) {
    return fallback
  }
  return msg.trim() || fallback
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || "")
      if (!result.startsWith("data:image/")) {
        reject(new Error("이미지 파일만 업로드할 수 있습니다."))
        return
      }
      resolve(result)
    }
    reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."))
    reader.readAsDataURL(file)
  })
}

function emptyImageSlots(count: number, keep?: string[]): string[] {
  return Array.from({ length: count }, (_, i) => keep?.[i] || "")
}

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
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null)
  const [progress, setProgress] = useState("")
  const [error, setError] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [copied, setCopied] = useState(false)
  const uploadRef = useRef<HTMLInputElement | null>(null)

  const scenes = brief.scenes || []
  const sceneCount = scenes.length
  const prompts = brief.imagePrompts || []
  const images = emptyImageSlots(
    Math.max(sceneCount, brief.imageUrls?.length || 0),
    brief.imageUrls
  )
  const filledCount = images.filter(Boolean).length
  const allReady =
    sceneCount >= 3 && images.length >= sceneCount && images.every(Boolean)

  const applyImages = (
    nextImages: string[],
    nextPrompts: AnimalImagePrompt[] = prompts
  ) => {
    const nextScenes = scenes.map((scene, index) => ({
      ...scene,
      imagePrompt: nextPrompts[index]?.prompt ?? scene.imagePrompt,
      imageUrl: nextImages[index] || undefined,
      videoUrl: nextImages[index] ? undefined : scene.videoUrl,
    }))
    onChange({
      ...brief,
      scenes: nextScenes,
      imagePrompts: nextPrompts,
      imageUrls: nextImages,
      videoUrls: [],
      mergedVideoUrl: undefined,
    })
  }

  const generateAll = async () => {
    if (sceneCount < 3 || !brief.productName.trim()) {
      setError("씬 대본(3개 이상)과 제품명이 필요합니다.")
      return
    }
    const openaiKey = (localStorage.getItem("shotform_openai_api_key") || "").trim()
    const replicateKey = (localStorage.getItem("shotform_replicate_api_key") || "").trim()
    if (!replicateKey) {
      setError("설정에서 Replicate API 키를 저장한 뒤 다시 시도해주세요.")
      return
    }

    setIsGenerating(true)
    setGeneratingIndex(null)
    setError("")
    setSelectedIndex(0)
    // 빈 슬롯 UI를 먼저 고정 (이전 이미지는 비우고 처음부터 순차 채움)
    applyImages(emptyImageSlots(sceneCount), prompts)

    try {
      const fullScript = joinSceneNarrations(scenes)

      setProgress(`${sceneCount}씬 이미지 프롬프트 작성 중…`)
      const promptResult = await generateAnimalImagePromptsSafe(
        fullScript,
        brief.productName,
        brief.productDescription || "",
        Boolean(brief.productImage?.trim()),
        openaiKey || undefined,
        brief.character,
        sceneCount
      )
      if (!promptResult.ok) {
        setError(promptResult.error)
        return
      }

      let imagePrompts = promptResult.data.map((prompt, index) => {
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
          sceneBeat: beat || prompt.sceneBeat,
          // 한글 라벨은 Replicate E006/자막 오염 원인이므로 영문 beat id만 붙임
          prompt: scene
            ? `${prompt.prompt}\n\nStory beat (MUST MATCH VISUALS): ${scene.type}.\n${locationHint}\nABSOLUTELY NO TEXT, NO SUBTITLES, NO CAPTIONS, NO HANGUL, NO LETTERS ON IMAGE.`
            : `${prompt.prompt}\n\nABSOLUTELY NO TEXT, NO SUBTITLES, NO CAPTIONS, NO HANGUL, NO LETTERS ON IMAGE.`,
        }
      })

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
          prompt: `${closeup.prompt}\n\nStory beat: detail.\nABSOLUTELY NO TEXT, NO SUBTITLES, NO CAPTIONS, NO HANGUL, NO LETTERS ON IMAGE.`,
        }
      }

      // 프롬프트를 먼저 화면에 채운 뒤, 이미지를 1컷씩 생성
      applyImages(emptyImageSlots(sceneCount), imagePrompts)

      const imageUrls = emptyImageSlots(sceneCount)
      const failed: string[] = []

      for (let i = 0; i < imagePrompts.length; i++) {
        const prompt = imagePrompts[i]!
        setGeneratingIndex(i)
        setSelectedIndex(i)
        setProgress(`이미지 ${i + 1}/${imagePrompts.length} 생성 중…`)
        const result = await generateAnimalSceneImageSafe(
          prompt.prompt,
          brief.productName,
          brief.productImage,
          replicateKey,
          i,
          brief.productDescription || "",
          brief.character,
          prompt.sceneBeat || scenes[i]?.type
        )
        if (!result.ok) {
          failed.push(`${i + 1}번`)
          applyImages([...imageUrls], imagePrompts)
          continue
        }
        imageUrls[i] = result.data
        applyImages([...imageUrls], imagePrompts)
      }

      if (failed.length) {
        setError(
          `${failed.join(", ")} 컷 생성에 실패했습니다. 해당 씬을 선택해 이미지를 업로드하거나 「이 컷만 재생성」을 눌러주세요.`
        )
      }
    } catch (reason) {
      setError(
        friendlyClientError(
          reason,
          "이미지 생성 중 서버 오류가 났습니다. OpenAI·Replicate API 키를 확인한 뒤 다시 시도해주세요."
        )
      )
    } finally {
      setIsGenerating(false)
      setGeneratingIndex(null)
      setProgress("")
    }
  }

  const regenerateOne = async (index: number) => {
    const prompt = prompts[index]
    if (!prompt?.prompt?.trim()) {
      setError("이 씬의 이미지 프롬프트가 없습니다. 먼저 「컷 생성」으로 프롬프트를 만들어주세요.")
      return
    }
    setIsGenerating(true)
    setGeneratingIndex(index)
    setSelectedIndex(index)
    setError("")
    setProgress(`씬 ${index + 1} 재생성 중…`)
    try {
      const replicateKey = (localStorage.getItem("shotform_replicate_api_key") || "").trim()
      if (!replicateKey) {
        setError("설정에서 Replicate API 키를 저장한 뒤 다시 시도해주세요.")
        return
      }
      const result = await generateAnimalSceneImageSafe(
        prompt.prompt,
        brief.productName,
        brief.productImage,
        replicateKey,
        index,
        brief.productDescription || "",
        brief.character,
        prompt.sceneBeat || scenes[index]?.type
      )
      if (!result.ok) {
        setError(result.error)
        return
      }
      const nextImages = emptyImageSlots(sceneCount, images)
      nextImages[index] = result.data
      applyImages(nextImages)
    } catch (reason) {
      setError(
        friendlyClientError(
          reason,
          "재생성에 실패했습니다. 이미지를 직접 업로드해도 됩니다."
        )
      )
    } finally {
      setIsGenerating(false)
      setGeneratingIndex(null)
      setProgress("")
    }
  }

  const updatePrompt = (index: number, promptText: string) => {
    const next = Array.from({ length: Math.max(sceneCount, prompts.length) }, (_, i) => {
      const base = prompts[i] || {
        type: scenes[i] ? ANIMAL_SCENE_LABELS[scenes[i].type] : `씬${i + 1}`,
        prompt: "",
        description: scenes[i]?.title || "",
        scriptText: scenes[i]?.narration || "",
        sceneBeat: scenes[i]?.type,
      }
      return i === index ? { ...base, prompt: promptText } : base
    })
    applyImages(emptyImageSlots(sceneCount, images), next)
  }

  const copyPrompt = async () => {
    const text = prompts[selectedIndex]?.prompt?.trim()
    if (!text) {
      setError("복사할 프롬프트가 없습니다.")
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setError("클립보드 복사에 실패했습니다. 브라우저 권한을 확인해주세요.")
    }
  }

  const uploadSelected = async (file: File | null) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 업로드할 수 있습니다.")
      return
    }
    if (file.size > 12 * 1024 * 1024) {
      setError("이미지는 12MB 이하만 업로드할 수 있습니다.")
      return
    }
    try {
      const dataUrl = await readFileAsDataUrl(file)
      const nextImages = emptyImageSlots(sceneCount, images)
      nextImages[selectedIndex] = dataUrl
      applyImages(nextImages)
      setError("")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "업로드 실패")
    }
  }

  if (sceneCount < 3) {
    return (
      <div className="rounded-3xl border border-dashed border-[rgba(255,246,238,0.2)] bg-black/20 px-6 py-16 text-center">
        <ImagePlus className="mx-auto h-10 w-10 text-[#6b7a6e]" />
        <p className="mt-3 text-[#9aa89c]">대본 단계에서 씬을 먼저 만들어주세요.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="animal-bubble-chip inline-flex px-2.5 py-1 text-[10px]">IMAGES</p>
          <h2 className="animal-display mt-2 text-xl font-bold text-[#fff6ee]">
            스토리 컷 {sceneCount}장
          </h2>
          <p className="mt-1 text-sm text-[#9aa89c]">
            씬 칸이 먼저 보이고, 생성 시 프롬프트 → 이미지를 1컷씩 채웁니다. 실패하면 업로드로 대체하세요.
          </p>
          <p className="mt-1 text-xs text-[#6b7a6e]">
            채움 {filledCount}/{sceneCount}
            {isGenerating && generatingIndex != null
              ? ` · 지금 ${generatingIndex + 1}번 생성 중`
              : ""}
          </p>
        </div>
        <Button
          type="button"
          onClick={() => void generateAll()}
          disabled={isGenerating}
          className="animal-mint-btn rounded-full font-semibold"
        >
          {isGenerating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : allReady ? (
            <RefreshCw className="mr-2 h-4 w-4" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {allReady ? `${sceneCount}컷 다시 만들기` : `${sceneCount}컷 생성`}
        </Button>
      </div>

      {progress ? (
        <p className="flex items-center gap-2 text-sm text-[#7dd3a8]">
          <Loader2 className="h-4 w-4 animate-spin" />
          {progress}
        </p>
      ) : null}

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
          {scenes.map((scene, index) => (
            <button
              key={scene.id || index}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className={`relative aspect-[9/16] overflow-hidden rounded-xl border ${
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
                <div className="flex h-full flex-col items-center justify-center gap-2 bg-black/40 px-2 text-center text-xs text-[#6b7a6e]">
                  {generatingIndex === index ? (
                    <Loader2 className="h-5 w-5 animate-spin text-[#7dd3a8]" />
                  ) : null}
                  <span>{ANIMAL_SCENE_LABELS[scene.type]}</span>
                </div>
              )}
              <span className="absolute left-1.5 top-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {index + 1}
              </span>
            </button>
          ))}
        </div>

        <div className="space-y-3 rounded-2xl border border-[rgba(255,246,238,0.12)] bg-black/25 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-[#fff6ee]">
              씬 {selectedIndex + 1}
              {scenes[selectedIndex]
                ? ` · ${ANIMAL_SCENE_LABELS[scenes[selectedIndex].type]}`
                : ""}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={isGenerating}
                onClick={() => uploadRef.current?.click()}
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                이미지 업로드
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={isGenerating || !prompts[selectedIndex]?.prompt?.trim()}
                onClick={() => void regenerateOne(selectedIndex)}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                이 컷만 재생성
              </Button>
            </div>
          </div>

          {scenes[selectedIndex]?.narration ? (
            <p className="text-sm text-[#9aa89c]">{scenes[selectedIndex].narration}</p>
          ) : null}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[#9aa89c]">이미지 프롬프트</p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={!prompts[selectedIndex]?.prompt?.trim()}
                onClick={() => void copyPrompt()}
                className="h-7 px-2 text-xs text-[#7dd3a8] hover:bg-[#7dd3a8]/10 hover:text-[#a7f3c8]"
              >
                {copied ? (
                  <>
                    <Check className="mr-1 h-3.5 w-3.5" />
                    복사됨
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    프롬프트 복사
                  </>
                )}
              </Button>
            </div>
            <Textarea
              value={prompts[selectedIndex]?.prompt || ""}
              onChange={(e) => updatePrompt(selectedIndex, e.target.value)}
              rows={6}
              placeholder={
                isGenerating && !prompts[selectedIndex]?.prompt
                  ? "프롬프트 작성 중…"
                  : "이미지 프롬프트 (생성 후 수정·복사 가능)"
              }
              className="border-[rgba(243,235,224,0.12)] bg-black/35 text-sm text-[#f3ebe0]"
            />
          </div>

          <div className="relative mx-auto aspect-[9/16] max-h-[420px] w-full max-w-[260px] overflow-hidden rounded-xl border border-[rgba(255,246,238,0.12)] bg-black/40">
            {images[selectedIndex] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={productDisplayUrl(images[selectedIndex])}
                alt="선택 씬"
                className="h-full w-full object-cover"
              />
            ) : (
              <button
                type="button"
                disabled={isGenerating && generatingIndex === selectedIndex}
                onClick={() => uploadRef.current?.click()}
                className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center text-sm text-[#6b7a6e] hover:bg-white/[0.03]"
              >
                {generatingIndex === selectedIndex ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin text-[#7dd3a8]" />
                    <span className="text-[#7dd3a8]">생성 중…</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-6 w-6 opacity-60" />
                    <span>이미지 없음 · 클릭해서 업로드</span>
                  </>
                )}
              </button>
            )}
          </div>

          <input
            ref={uploadRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              void uploadSelected(event.target.files?.[0] || null)
              event.target.value = ""
            }}
          />
        </div>
      </div>

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
