/**
 * AI썰쇼핑숏폼 도구 — 한 통 TTS 길이에 맞춰 자막 줄을 글자 비중으로 배분한 SRT 큐
 */

import {
  expandSubtitleScheduleLines,
  narrationTtsTextFromScene,
  SUBTITLE_MAX_PLAIN_CHARS,
} from "@/lib/shotform-factory-line-tts"
import { narrationPlainCharCount } from "@/lib/shotform-narration-timing"

export type SsulTimedCue = {
  text: string
  start: number
  end: number
}

/** 대본 → TTS에 넣을 한 줄 텍스트 */
export function ssulTtsTextFromScript(script: string): string {
  return narrationTtsTextFromScene(script)
}

/** 대본 → SRT용 짧은 자막 줄 */
export function ssulSubtitleLinesFromScript(script: string): string[] {
  const lines = expandSubtitleScheduleLines(script, SUBTITLE_MAX_PLAIN_CHARS)
  if (lines.length) return lines
  const fallback = ssulTtsTextFromScript(script)
  return fallback ? [fallback] : []
}

/**
 * 전체 음성 길이에 자막 줄을 글자 수 비율로 배분합니다.
 * (한 번에 TTS 생성했을 때 CapCut용 SRT를 만들기 위함)
 */
export function buildSsulTimedCuesFromDuration(
  script: string,
  durationSec: number
): SsulTimedCue[] {
  const lines = ssulSubtitleLinesFromScript(script)
  if (!lines.length) return []

  const totalDur = Math.max(0.2, durationSec)
  const weights = lines.map((line) => Math.max(1, narrationPlainCharCount(line)))
  const weightSum = weights.reduce((a, b) => a + b, 0)

  let t = 0
  return lines.map((text, i) => {
    const share = weights[i]! / weightSum
    const start = t
    // 마지막 줄은 끝 시각을 정확히 duration에 맞춤
    const end =
      i === lines.length - 1
        ? totalDur
        : Math.min(totalDur, start + Math.max(0.12, share * totalDur))
    t = end
    return { text, start, end }
  })
}
