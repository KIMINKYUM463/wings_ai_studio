"use client"

import { useState } from "react"
import { ArrowRight, Loader2, RefreshCw, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { generateShoppingScenes } from "./actions"
import {
  ANIMAL_SCENE_LABELS,
  joinSceneNarrations,
  suggestAnimalSceneCount,
  type AnimalScene,
  type AnimalSceneType,
  type AnimalShoppingBrief,
} from "./animal-studio-types"

export function AnimalScriptPanel({
  brief,
  onChange,
  onContinue,
}: {
  brief: AnimalShoppingBrief
  onChange: (brief: AnimalShoppingBrief) => void
  onContinue: () => void
}) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)

  const scenes = brief.scenes || []
  const selected = scenes[selectedIndex]
  const expectedCount = suggestAnimalSceneCount(brief.videoDuration)

  const generate = async () => {
    if (!brief.productName.trim()) {
      setError("제품명이 필요합니다. 이전 단계에서 제품을 선택해주세요.")
      return
    }
    setIsGenerating(true)
    setError("")
    try {
      const apiKey = (localStorage.getItem("shotform_openai_api_key") || "").trim()
      const sceneCount = suggestAnimalSceneCount(brief.videoDuration)
      const result = await generateShoppingScenes(
        brief.productName,
        brief.productDescription || "",
        apiKey || undefined,
        brief.videoDuration,
        brief.character,
        sceneCount
      )
      const nextScenes: AnimalScene[] = result.scenes.map((scene, index) => ({
        id: `scene_${scene.type}_${Date.now()}_${index}`,
        order: index,
        type: scene.type as AnimalSceneType,
        title: scene.title,
        narration: scene.narration,
      }))
      onChange({
        ...brief,
        scenes: nextScenes,
        script: joinSceneNarrations(nextScenes),
        ttsAudioUrl: "",
        ttsDurationSec: undefined,
        imagePrompts: [],
        imageUrls: [],
        videoUrls: [],
        mergedVideoUrl: undefined,
      })
      setSelectedIndex(0)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "대본 생성 실패")
    } finally {
      setIsGenerating(false)
    }
  }

  const updateScene = (index: number, patch: Partial<AnimalScene>) => {
    const next = scenes.map((scene, i) => (i === index ? { ...scene, ...patch } : scene))
    onChange({
      ...brief,
      scenes: next,
      script: joinSceneNarrations(next),
      ttsAudioUrl: "",
      ttsDurationSec: undefined,
      videoUrls: [],
      mergedVideoUrl: undefined,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="animal-bubble-chip inline-flex px-2.5 py-1 text-[10px]">SCRIPT</p>
        <h2 className="animal-display mt-2 text-xl font-bold text-[#fff6ee]">
          {brief.character.name}의 쇼핑 스토리
        </h2>
        <p className="mt-1 text-sm text-[#9aa89c]">
          {brief.videoDuration}초 · 약 {expectedCount}씬 (길수록 컷↑) · 문제 → 마트 → 활용 ·{" "}
          {brief.productName || "제품 미선택"}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => void generate()}
          disabled={isGenerating}
          className="animal-mint-btn rounded-full font-semibold"
        >
          {isGenerating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : scenes.length ? (
            <RefreshCw className="mr-2 h-4 w-4" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {scenes.length ? "스토리 다시 만들기" : `AI 스토리 대본 생성 (${expectedCount}씬)`}
        </Button>
      </div>

      {scenes.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[rgba(255,246,238,0.2)] bg-black/20 px-6 py-14 text-center text-sm text-[#9aa89c]">
          영상 길이에 맞춰 3~8씬이 생성됩니다. 컷이 많을수록 후킹이 강해져요.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {scenes.map((scene, index) => (
              <button
                key={scene.id}
                type="button"
                onClick={() => setSelectedIndex(index)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                  selectedIndex === index
                    ? "border-[#7dd3a8]/60 bg-[#7dd3a8]/15"
                    : "border-[rgba(255,246,238,0.1)] bg-black/20 hover:border-[#7dd3a8]/30"
                }`}
              >
                <span className="block text-[10px] font-bold tracking-wide text-[#7dd3a8]">
                  SCENE {index + 1} · {ANIMAL_SCENE_LABELS[scene.type] || scene.type}
                </span>
                <span className="mt-1 block truncate text-sm font-semibold text-[#fff6ee]">
                  {scene.title}
                </span>
              </button>
            ))}
          </div>

          {selected ? (
            <div className="space-y-3 rounded-2xl border border-[rgba(255,246,238,0.12)] bg-black/25 p-4">
              <p className="text-xs font-bold text-[#7dd3a8]">
                {ANIMAL_SCENE_LABELS[selected.type] || selected.type} · {scenes.length}씬 중{" "}
                {selectedIndex + 1}
              </p>
              <Input
                value={selected.title}
                onChange={(e) => updateScene(selectedIndex, { title: e.target.value })}
                className="border-[rgba(243,235,224,0.12)] bg-black/35 text-[#f3ebe0]"
                placeholder="씬 제목"
              />
              <Textarea
                value={selected.narration}
                onChange={(e) => updateScene(selectedIndex, { narration: e.target.value })}
                rows={7}
                placeholder="이 씬의 나레이션"
                className="border-[rgba(243,235,224,0.12)] bg-black/35 text-base leading-7 text-[#f3ebe0]"
              />
              <p className="text-xs text-[#6b7a6e]">
                이 씬 {selected.narration.length}자 · 전체 {brief.script.length}자 · 목표 약{" "}
                {Math.round(brief.videoDuration * 6.7)}자 · {scenes.length}컷
              </p>
            </div>
          ) : null}
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
          disabled={scenes.length < 3 || scenes.some((s) => !s.narration.trim())}
          onClick={onContinue}
          className="animal-cta-cute rounded-full px-6 font-bold"
        >
          음성 만들기로
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
