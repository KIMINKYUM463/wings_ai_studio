import { splitNarrationIntoMeaningLines } from "./StoryChannelFrame"
import type {
  StorySceneAsset,
  StoryScriptScene,
  StoryVoiceTrack,
} from "./story-types"
import { normalizeCaptionTimingCues } from "./story-caption-align"

/** 장면 대본 → 의미 단위 줄 (자막·TTS·소재 슬롯 공통) */
export function getStorySceneMeaningLines(narration: string): string[] {
  return splitNarrationIntoMeaningLines(narration)
    .map((line) => line.replace(/\.{2,}|…+/g, "").trim())
    .filter(Boolean)
}

/** 자막/컷용 줄 — 음성 큐 텍스트 우선, 없으면 의미 단위 분할 */
export function getStoryCaptionLines(
  narration: string,
  voiceTrack?: StoryVoiceTrack | null
): string[] {
  if (voiceTrack?.lineTracks?.length) {
    return voiceTrack.lineTracks
      .map((item) => item.text.replace(/\.{2,}|…+/g, "").trim() || item.text.trim())
      .filter(Boolean)
  }
  return getStorySceneMeaningLines(narration)
}

/**
 * 줄마다 별도 TTS 파일인지 (구형).
 * true면 순차 재생, false면 장면 통 TTS + 시간 싱크.
 */
export function isSplitLineTtsTrack(track?: StoryVoiceTrack | null): boolean {
  if (!track?.lineTracks?.length) return false
  const distinct = track.lineTracks
    .map((item) => item.audioUrl)
    .filter((url): url is string => Boolean(url && url !== track.audioUrl))
  return distinct.length > 0 && track.lineTracks.length > 1
}

/** 장면 통 TTS 길이를 글자 수 비율로 나눠 자막/컷 타이밍 생성 (폴백) */
export function buildCaptionTimingCues(
  lines: string[],
  durationSec: number
): Array<{ lineIndex: number; text: string; startSec: number; endSec: number }> {
  const safeLines = lines.length ? lines : [""]
  const total = Math.max(0.8, durationSec || safeLines.length * 1.5)
  const weights = safeLines.map((text) => Math.max(8, text.length))
  const weightSum = weights.reduce((sum, value) => sum + value, 0) || 1
  let cursor = 0
  return safeLines.map((text, lineIndex) => {
    const share = total * (weights[lineIndex]! / weightSum)
    const startSec = cursor
    const endSec =
      lineIndex === safeLines.length - 1 ? total : cursor + Math.max(0.45, share)
    cursor = endSec
    return {
      lineIndex,
      text,
      startSec: Number(startSec.toFixed(3)),
      endSec: Number(endSec.toFixed(3)),
    }
  })
}

/**
 * 저장된 Whisper 싱크(lineTracks)가 있으면 그걸 쓰고,
 * 없으면 글자 수 비율 추정으로 폴백합니다.
 */
export function resolveCaptionTimingCues(
  lines: string[],
  durationSec: number,
  voiceTrack?: StoryVoiceTrack | null
): Array<{ lineIndex: number; text: string; startSec: number; endSec: number }> {
  const safeLines = lines.length ? lines : [""]
  const saved = voiceTrack?.lineTracks
  if (saved?.length) {
    const raw = safeLines.map((text, lineIndex) => {
      const hit =
        saved.find((item) => item.lineIndex === lineIndex) ||
        saved[lineIndex]
      const hasTiming =
        hit &&
        Number.isFinite(hit.startSec) &&
        Number.isFinite(hit.endSec) &&
        Number(hit.endSec) > Number(hit.startSec)
      if (!hasTiming || !hit) return null
      return {
        lineIndex,
        text: hit.text || text,
        startSec: Number(hit.startSec),
        endSec: Number(hit.endSec),
        alignmentSource: (hit.alignmentSource || "whisper") as
          | "whisper"
          | "estimated",
      }
    })
    if (raw.every(Boolean)) {
      return normalizeCaptionTimingCues(
        raw as Array<{
          lineIndex: number
          text: string
          startSec: number
          endSec: number
          alignmentSource: "whisper" | "estimated"
        }>,
        durationSec
      ).map(({ lineIndex, text, startSec, endSec }) => ({
        lineIndex,
        text,
        startSec,
        endSec,
      }))
    }
  }
  return buildCaptionTimingCues(safeLines, durationSec)
}

export function storyAssetLineIndex(asset: StorySceneAsset): number {
  return asset.lineIndex ?? 0
}

export function isSameStoryAssetSlot(a: StorySceneAsset, b: StorySceneAsset): boolean {
  return a.sceneId === b.sceneId && storyAssetLineIndex(a) === storyAssetLineIndex(b)
}

/** 줄별 소재 우선, 없으면 장면 레거시(lineIndex 없음) 소재 */
export function resolveStoryLineAsset(
  assets: StorySceneAsset[] | undefined,
  sceneId: string,
  lineIndex: number
): StorySceneAsset | undefined {
  if (!assets?.length) return undefined
  const exact = assets.find(
    (item) => item.sceneId === sceneId && item.lineIndex === lineIndex
  )
  if (exact) return exact
  // 예전 데이터: lineIndex 없이 장면당 1개 → 모든 줄의 폴백
  return assets.find((item) => item.sceneId === sceneId && item.lineIndex == null)
}

export function countStorySceneLineSlots(
  scene: StoryScriptScene,
  voiceTrack?: StoryVoiceTrack
): number {
  return Math.max(1, getStoryCaptionLines(scene.narration, voiceTrack).length)
}

export function countFilledStoryLineAssets(
  assets: StorySceneAsset[] | undefined,
  scene: StoryScriptScene,
  slotCount: number
): number {
  if (!assets?.length) return 0
  let filled = 0
  for (let lineIndex = 0; lineIndex < slotCount; lineIndex += 1) {
    if (resolveStoryLineAsset(assets, scene.id, lineIndex)?.mediaUrl) filled += 1
  }
  return filled
}
