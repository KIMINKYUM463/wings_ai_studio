import { getStoryCaptionLines } from "./story-line-assets"
import { normalizeCaptionTimingCues } from "./story-caption-align"
import type {
  StoryGeneratedScript,
  StoryMediaPoolItem,
  StorySceneAsset,
  StoryVoiceData,
} from "./story-types"

export type StoryMashupLineSlot = {
  sceneId: string
  sceneOrder: number
  lineIndex: number
  text: string
  visualPrompt: string
  durationSec: number
}

/** 장면×의미줄 슬롯 + TTS 길이(없으면 장면 길이를 줄 수로 나눔) */
export function buildStoryMashupLineSlots(
  story: StoryGeneratedScript,
  voiceData?: StoryVoiceData
): StoryMashupLineSlot[] {
  const slots: StoryMashupLineSlot[] = []
  for (const scene of story.scenes) {
    const track = voiceData?.tracks.find((item) => item.sceneId === scene.id)
    const lines = getStoryCaptionLines(scene.narration, track)
    if (!lines.length) {
      slots.push({
        sceneId: scene.id,
        sceneOrder: scene.order,
        lineIndex: 0,
        text: scene.narration,
        visualPrompt: scene.visualPrompt,
        durationSec: Math.max(1.2, scene.durationSec),
      })
      continue
    }

    const audioBudget = Math.max(
      0.8,
      track?.durationSec || scene.durationSec || lines.length * 1.2
    )

    const hasWhisperTiming = track?.lineTracks?.some(
      (item) =>
        Number.isFinite(item.startSec) &&
        Number.isFinite(item.endSec) &&
        Number(item.endSec) > Number(item.startSec)
    )

    if (hasWhisperTiming && track?.lineTracks?.length) {
      const normalized = normalizeCaptionTimingCues(
        lines.map((text, lineIndex) => {
          const saved =
            track.lineTracks!.find((item) => item.lineIndex === lineIndex) ||
            track.lineTracks![lineIndex]
          return {
            lineIndex,
            text,
            startSec: Number(saved?.startSec) || 0,
            endSec: Number(saved?.endSec) || audioBudget / lines.length,
            alignmentSource: (saved?.alignmentSource || "whisper") as
              | "whisper"
              | "estimated",
          }
        }),
        audioBudget
      )
      normalized.forEach((cue) => {
        slots.push({
          sceneId: scene.id,
          sceneOrder: scene.order,
          lineIndex: cue.lineIndex,
          text: cue.text || scene.narration,
          visualPrompt: scene.visualPrompt,
          durationSec: Number(
            Math.max(0.35, cue.endSec - cue.startSec).toFixed(2)
          ),
        })
      })
      continue
    }

    // Whisper 없으면 글자 수 비율
    const weights = lines.map((text) => Math.max(8, (text || scene.narration).length))
    const weightSum = weights.reduce((sum, value) => sum + value, 0) || 1
    lines.forEach((text, lineIndex) => {
      const estimatedDuration = audioBudget * (weights[lineIndex]! / weightSum)
      slots.push({
        sceneId: scene.id,
        sceneOrder: scene.order,
        lineIndex,
        text: text || scene.narration,
        visualPrompt: scene.visualPrompt,
        durationSec: Number(Math.max(0.35, estimatedDuration).toFixed(2)),
      })
    })
  }
  return slots
}

export function poolItemToSceneAsset(
  poolItem: StoryMediaPoolItem,
  sceneId: string,
  lineIndex: number,
  trim?: { startSec?: number; endSec?: number }
): StorySceneAsset {
  return {
    sceneId,
    lineIndex,
    mediaUrl: poolItem.mediaUrl,
    mediaType: poolItem.mediaType,
    source: poolItem.source,
    sourcePageUrl: poolItem.pageUrl,
    attribution: poolItem.attribution,
    license: poolItem.license,
    rightsConfirmed: true,
    trimStartSec: trim?.startSec,
    trimEndSec: trim?.endSec,
    editorNote: `스마트 짜깁기 · ${poolItem.title}`,
  }
}

/** OpenAI 없을 때: 풀을 순서대로 돌리며 줄 길이에 맞게 trim */
export function assignPoolRoundRobin(
  slots: StoryMashupLineSlot[],
  pool: StoryMediaPoolItem[]
): Array<{
  sceneId: string
  lineIndex: number
  poolItemId: string
  trimStartSec: number
  trimEndSec: number
  reason: string
}> {
  if (!pool.length) return []
  return slots.map((slot, index) => {
    const item = pool[index % pool.length]!
    const mediaDur = Math.max(slot.durationSec, item.durationSec || slot.durationSec)
    const start = item.mediaType === "video" ? (index * 1.1) % Math.max(0.1, mediaDur - slot.durationSec) : 0
    const end = item.mediaType === "video" ? start + slot.durationSec : undefined
    return {
      sceneId: slot.sceneId,
      lineIndex: slot.lineIndex,
      poolItemId: item.id,
      trimStartSec: Number(start.toFixed(2)),
      trimEndSec: end != null ? Number(end.toFixed(2)) : slot.durationSec,
      reason: "풀 순서 배치(폴백)",
    }
  })
}
