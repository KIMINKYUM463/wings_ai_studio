import {
  getStoryCaptionLines,
  isSplitLineTtsTrack,
  resolveCaptionTimingCues,
} from "./story-line-assets"
import type {
  StoryGeneratedScript,
  StorySceneAsset,
  StorySfxClip,
  StoryVoiceData,
  StoryVoiceLineTrack,
  StoryVoiceTrack,
} from "./story-types"
import { findStoryTwoCutBreak, plainLength } from "./story-text-break"

export { findStoryTwoCutBreak }

/** 이 길이(초) 이상인 줄만 두 컷으로 나눔 → 나뉜 컷은 각각 1.3초 안팎 */
export const STORY_TWO_CUT_MIN_LINE_SEC = 2.6
const MIN_PART_SEC = 0.9

type SceneSplitPlan = {
  lineTracks: StoryVoiceLineTrack[]
  /** 기존 lineIndex → 새 lineIndex (나뉜 줄은 앞 컷 번호) */
  indexMap: Map<number, number>
  splitCount: number
}

function planSceneTwoCuts(
  narration: string,
  sceneDurationSec: number,
  track: StoryVoiceTrack
): SceneSplitPlan | null {
  if (!track.audioUrl || isSplitLineTtsTrack(track)) return null

  const lines = getStoryCaptionLines(narration, track)
  if (!lines.length) return null
  // 클립 슬롯(buildStoryMashupLineSlots)과 같은 길이 기준을 써야 화면과 어긋나지 않음
  const audioBudget = Math.max(
    0.8,
    track.durationSec || sceneDurationSec || lines.length * 1.2
  )
  const cues = resolveCaptionTimingCues(lines, audioBudget, track)

  const lineTracks: StoryVoiceLineTrack[] = []
  const indexMap = new Map<number, number>()
  let splitCount = 0

  cues.forEach((cue, oldIndex) => {
    const saved =
      track.lineTracks?.find((item) => item.lineIndex === oldIndex) ||
      track.lineTracks?.[oldIndex]
    const base: Omit<StoryVoiceLineTrack, "lineIndex" | "text" | "startSec" | "endSec"> = {
      audioUrl: saved?.audioUrl,
      alignmentSource: saved?.alignmentSource || "estimated",
    }
    indexMap.set(oldIndex, lineTracks.length)

    const length = cue.endSec - cue.startSec
    const parts = length >= STORY_TWO_CUT_MIN_LINE_SEC ? findStoryTwoCutBreak(cue.text) : null
    if (parts) {
      // 줄 안의 실제 단어 시각은 모르므로 글자 수 비율로 나눔
      const ratio = plainLength(parts[0]) / Math.max(1, plainLength(cue.text))
      const splitSec = Math.min(
        cue.endSec - MIN_PART_SEC,
        Math.max(cue.startSec + MIN_PART_SEC, cue.startSec + length * ratio)
      )
      const at = Number(splitSec.toFixed(3))
      lineTracks.push(
        { ...base, lineIndex: lineTracks.length, text: parts[0], startSec: cue.startSec, endSec: at },
        { ...base, lineIndex: lineTracks.length + 1, text: parts[1], startSec: at, endSec: cue.endSec }
      )
      splitCount += 1
      return
    }

    lineTracks.push({
      ...base,
      lineIndex: lineTracks.length,
      text: cue.text,
      startSec: cue.startSec,
      endSec: cue.endSec,
    })
  })

  return splitCount ? { lineTracks, indexMap, splitCount } : null
}

function remapClipKey(key: string | undefined, plans: Map<string, SceneSplitPlan>) {
  if (!key) return key
  const at = key.lastIndexOf(":")
  if (at < 0) return key
  const plan = plans.get(key.slice(0, at))
  const next = plan?.indexMap.get(Number(key.slice(at + 1)))
  return next == null ? key : `${key.slice(0, at)}:${next}`
}

export type StoryTwoCutResult = {
  voiceData: StoryVoiceData
  sceneAssets: StorySceneAsset[]
  sfxClips: StorySfxClip[]
  splitCount: number
}

/**
 * 긴 자막 줄을 두 컷으로 나눔.
 * 줄 번호에 묶인 데이터(줄 타이밍·소재·효과음 clipKey)를 함께 밀어서
 * 기존 소재는 앞 컷에 그대로 남고, 뒤 컷은 빈 슬롯이 됩니다.
 */
export function splitLongStoryLinesIntoTwoCuts(input: {
  story: StoryGeneratedScript
  voiceData: StoryVoiceData
  sceneAssets?: StorySceneAsset[]
  sfxClips?: StorySfxClip[]
}): StoryTwoCutResult {
  const plans = new Map<string, SceneSplitPlan>()
  for (const scene of input.story.scenes) {
    const track = input.voiceData.tracks.find((item) => item.sceneId === scene.id)
    const plan = track ? planSceneTwoCuts(scene.narration, scene.durationSec, track) : null
    if (plan) plans.set(scene.id, plan)
  }

  const sceneAssets = (input.sceneAssets || []).map((asset) => {
    const next =
      asset.lineIndex == null ? undefined : plans.get(asset.sceneId)?.indexMap.get(asset.lineIndex)
    return next == null || next === asset.lineIndex ? asset : { ...asset, lineIndex: next }
  })

  const sfxClips = (input.sfxClips || []).map((clip) => {
    const nextKey = remapClipKey(clip.clipKey, plans)
    return nextKey === clip.clipKey ? clip : { ...clip, clipKey: nextKey }
  })

  let splitCount = 0
  const tracks = input.voiceData.tracks.map((track) => {
    const plan = plans.get(track.sceneId)
    if (!plan) return track
    splitCount += plan.splitCount
    return { ...track, lineTracks: plan.lineTracks }
  })

  return {
    voiceData: { ...input.voiceData, tracks },
    sceneAssets,
    sfxClips,
    splitCount,
  }
}

/** 버튼 옆에 보여줄 "나눌 수 있는 줄" 개수 (데이터는 바꾸지 않음) */
export function countStoryTwoCutCandidates(
  story: StoryGeneratedScript | undefined,
  voiceData: StoryVoiceData | undefined
): number {
  if (!story || !voiceData) return 0
  return splitLongStoryLinesIntoTwoCuts({ story, voiceData }).splitCount
}
