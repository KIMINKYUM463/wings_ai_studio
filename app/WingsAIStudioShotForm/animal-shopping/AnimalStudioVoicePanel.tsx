"use client"

import { useState } from "react"
import { ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TypecastApiErrorNotice } from "@/components/TypecastApiGuideCard"
import { AnimalVoicePanel } from "./AnimalVoicePanel"
import { concatAnimalTtsUrls, generateAnimalTts } from "./animal-tts"
import {
  ANIMAL_SCENE_LABELS,
  joinSceneNarrations,
  type AnimalShoppingBrief,
} from "./animal-studio-types"

export function AnimalStudioVoicePanel({
  brief,
  onChange,
  onContinue,
}: {
  brief: AnimalShoppingBrief
  onChange: (brief: AnimalShoppingBrief) => void
  onContinue: () => void
}) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 1 })
  const [error, setError] = useState("")

  const scenes = brief.scenes || []
  const sceneCount = scenes.length
  const hasSceneTts =
    sceneCount >= 3 && scenes.every((s) => Boolean(s.ttsAudioUrl))

  const generate = async () => {
    if (sceneCount < 3) {
      setError("먼저 스토리 대본(씬)을 만들어주세요.")
      return
    }
    if (scenes.some((s) => !s.narration.trim())) {
      setError("비어 있는 씬 대본이 있습니다.")
      return
    }
    setIsGenerating(true)
    setProgress({ current: 0, total: sceneCount })
    setError("")
    try {
      const nextScenes = [...scenes]
      const audioUrls: string[] = []
      for (let i = 0; i < sceneCount; i++) {
        setProgress({ current: i, total: sceneCount })
        const result = await generateAnimalTts({
          script: nextScenes[i].narration,
          voiceId: brief.selectedVoiceId,
          style: brief.selectedStyle,
          speed: brief.ttsSpeed,
        })
        nextScenes[i] = {
          ...nextScenes[i],
          ttsAudioUrl: result.audioUrl,
          ttsDurationSec: result.durationSec || undefined,
          videoUrl: undefined,
        }
        audioUrls.push(result.audioUrl)
        onChange({
          ...brief,
          scenes: [...nextScenes],
          script: joinSceneNarrations(nextScenes),
          videoUrls: [],
          mergedVideoUrl: undefined,
        })
      }

      const merged = await concatAnimalTtsUrls(audioUrls)
      setProgress({ current: sceneCount, total: sceneCount })
      onChange({
        ...brief,
        scenes: nextScenes,
        script: joinSceneNarrations(nextScenes),
        ttsAudioUrl: merged.audioUrl,
        ttsDurationSec: merged.durationSec || undefined,
        videoUrls: [],
        mergedVideoUrl: undefined,
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "TTS 생성 실패")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="animal-bubble-chip inline-flex px-2.5 py-1 text-[10px]">VOICE</p>
        <h2 className="animal-display mt-2 text-xl font-bold text-[#fff6ee]">
          {brief.character.name}의 목소리
        </h2>
        <p className="mt-1 text-sm text-[#9aa89c]">
          {sceneCount}개 씬마다 TTS를 만들고, 각 음성 길이가 그 씬 영상 길이가 됩니다.
        </p>
      </div>

      <AnimalVoicePanel
        script={brief.script || joinSceneNarrations(scenes)}
        characterName={brief.character.name}
        ttsAudioUrl={brief.ttsAudioUrl}
        selectedVoiceId={brief.selectedVoiceId}
        selectedStyle={brief.selectedStyle}
        ttsSpeed={brief.ttsSpeed}
        isGeneratingTTS={isGenerating}
        ttsProgress={progress}
        onVoiceChange={(voiceId) => onChange({ ...brief, selectedVoiceId: voiceId })}
        onStyleChange={(style) => onChange({ ...brief, selectedStyle: style })}
        onSpeedChange={(speed) => onChange({ ...brief, ttsSpeed: speed })}
        onGenerate={() => void generate()}
      />

      {sceneCount > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {scenes.map((scene, index) => (
            <div
              key={scene.id}
              className="rounded-xl border border-[rgba(255,246,238,0.12)] bg-black/25 p-3"
            >
              <p className="text-[10px] font-bold text-[#7dd3a8]">
                SCENE {index + 1} · {ANIMAL_SCENE_LABELS[scene.type] || scene.type}
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-[#d7e0d8]">{scene.narration}</p>
              {scene.ttsAudioUrl ? (
                <audio controls src={scene.ttsAudioUrl} className="mt-2 w-full" preload="metadata" />
              ) : (
                <p className="mt-2 text-[11px] text-[#6b7a6e]">TTS 대기</p>
              )}
              {scene.ttsDurationSec ? (
                <p className="mt-1 text-[11px] text-[#9aa89c]">
                  {scene.ttsDurationSec.toFixed(1)}초
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      <TypecastApiErrorNotice message={error} />

      <div className="flex justify-end">
        <Button
          type="button"
          disabled={!hasSceneTts}
          onClick={onContinue}
          className="animal-cta-cute rounded-full px-6 font-bold"
        >
          {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          이미지 만들기로
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
