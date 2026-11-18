import type {
  StoryScriptScene,
  StoryVoiceCheckpoint,
  StoryVoiceData,
  StoryVoiceTrack,
} from "./story-types"
import {
  buildEstimatedCaptionCues,
  normalizeCaptionTimingCues,
  type CaptionTimingCue,
} from "./story-caption-align"
import { stableStoryIdentity } from "./story-grounding"

export type ElevenLabsAlignment = {
  characters?: string[]
  character_start_times_seconds?: number[]
  character_end_times_seconds?: number[]
}

export function narrationHash(narration: string): string {
  return stableStoryIdentity(narration.normalize("NFC").replace(/\s+/g, " ").trim())
}

export function voiceSettingsHash(input: {
  provider: StoryVoiceData["provider"]
  voiceId: string
  style: string
  speed: number
}): string {
  return stableStoryIdentity({
    provider: input.provider,
    voiceId: input.voiceId,
    style: input.style,
    speed: Math.round(input.speed * 100) / 100,
  })
}

export function isCurrentStoryVoiceTrack(
  scene: Pick<StoryScriptScene, "id" | "narration">,
  track: StoryVoiceTrack | undefined,
  settingsHash?: string
): track is StoryVoiceTrack {
  return Boolean(
    track &&
      track.sceneId === scene.id &&
      track.narrationHash === narrationHash(scene.narration) &&
      (!settingsHash || !track.voiceSettingsHash || track.voiceSettingsHash === settingsHash)
  )
}

/** 대본이 바뀐 장면의 TTS만 제거합니다. 편집기 저장 직전에 호출할 수 있습니다. */
export function invalidateChangedStoryVoiceTracks(
  scenes: Array<Pick<StoryScriptScene, "id" | "narration">>,
  voiceData?: StoryVoiceData
): StoryVoiceData | undefined {
  if (!voiceData) return undefined
  const tracks = voiceData.tracks.filter((track) => {
    const scene = scenes.find((item) => item.id === track.sceneId)
    return scene ? isCurrentStoryVoiceTrack(scene, track) : false
  })
  const validIds = new Set(tracks.map((track) => track.sceneId))
  const checkpoints = voiceData.checkpoints?.filter(
    (checkpoint) =>
      validIds.has(checkpoint.sceneId) ||
      checkpoint.status === "failed" ||
      checkpoint.status === "pending"
  )
  return { ...voiceData, tracks, checkpoints }
}

export function upsertVoiceCheckpoint(
  checkpoints: StoryVoiceCheckpoint[] | undefined,
  checkpoint: StoryVoiceCheckpoint
): StoryVoiceCheckpoint[] {
  const current = checkpoints || []
  return current.some((item) => item.sceneId === checkpoint.sceneId)
    ? current.map((item) => (item.sceneId === checkpoint.sceneId ? checkpoint : item))
    : [...current, checkpoint]
}

/** ElevenLabs 문자 타임스탬프를 자막 줄 큐로 변환합니다. */
export function buildProviderCaptionCues(
  lines: string[],
  alignment: ElevenLabsAlignment | null | undefined,
  durationSec?: number
): CaptionTimingCue[] | null {
  const characters = alignment?.characters || []
  const starts = alignment?.character_start_times_seconds || []
  const ends = alignment?.character_end_times_seconds || []
  if (
    !characters.length ||
    starts.length !== characters.length ||
    ends.length !== characters.length
  ) {
    return null
  }

  const alignedText = characters.join("")
  let cursor = 0
  const cues: CaptionTimingCue[] = []
  lines.forEach((text, lineIndex) => {
    let startIndex = alignedText.indexOf(text, cursor)
    if (startIndex < 0) {
      const compact = text.replace(/\s+/g, "")
      const remaining = alignedText.slice(cursor)
      const compactIndex = remaining.replace(/\s+/g, "").indexOf(compact)
      startIndex = compactIndex >= 0 ? cursor + compactIndex : cursor
    }
    const endIndex = Math.min(characters.length - 1, startIndex + Math.max(1, text.length) - 1)
    const startSec = Number(starts[startIndex])
    const endSec = Number(ends[endIndex])
    if (Number.isFinite(startSec) && Number.isFinite(endSec) && endSec > startSec) {
      cues.push({
        lineIndex,
        text,
        startSec,
        endSec,
        alignmentSource: "provider",
      })
    }
    cursor = endIndex + 1
  })
  if (cues.length !== lines.length) return null
  return normalizeCaptionTimingCues(cues, durationSec)
}

export function buildEstimatedStoryCaptionCues(lines: string[], durationSec?: number) {
  return buildEstimatedCaptionCues(lines, durationSec || Math.max(0.8, lines.length * 1.5))
}
