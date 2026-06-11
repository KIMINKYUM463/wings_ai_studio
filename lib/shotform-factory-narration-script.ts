import { formatSubtitleDisplayText } from "@/lib/shotform-factory-line-tts"

export type NarrationSegment = {
  start: number
  end: number
  text: string
}

/** AI 쇼핑 숏폼 3단계(대본 생성) — 분석·생성 결과로 채워짐 */
export const FACTORY_NARRATION_SEGMENTS: readonly NarrationSegment[] = []

export const FACTORY_NARRATION_TOTAL_SEC = 0

export const EMPTY_FACTORY_NARRATION_SEGMENTS: readonly NarrationSegment[] = []

export function factoryNarrationTotalSec(segments: readonly NarrationSegment[]): number {
  if (!segments.length) return 0
  return segments[segments.length - 1]!.end
}

/** playhead(초)가 속한 나레이션 구간 번호 1-based */
export function narrationSceneIndexFromPlayheadIn(segments: readonly NarrationSegment[], t: number): number {
  if (!segments.length) return 0
  const total = factoryNarrationTotalSec(segments)
  const clamped = Math.min(total, Math.max(0, t))
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]!
    if (clamped < s.end) return i + 1
  }
  return segments.length
}

/** playhead(초)가 속한 나레이션 구간 번호 1-based (데모 스크립트) */
export function narrationSceneIndexFromPlayhead(t: number): number {
  return narrationSceneIndexFromPlayheadIn(FACTORY_NARRATION_SEGMENTS, t)
}

/** 0:00, 0:08.5, 0:26.6 형식 */
export function formatNarrationClock(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec - m * 60
  if (Math.abs(s - Math.round(s)) < 0.001) return `${m}:${String(Math.floor(s)).padStart(2, "0")}`
  return `${m}:${s.toFixed(1)}`
}

export function narrationSegmentDuration(seg: NarrationSegment): string {
  const d = seg.end - seg.start
  return Math.abs(d - Math.round(d)) < 0.01 ? `${Math.round(d)}` : d.toFixed(1).replace(/\.0$/, "")
}

export function splitNarrationOverlay(text: string): { top: string; bottom: string } {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return { top: "", bottom: "" }
  if (lines.length === 1) return { top: lines[0]!, bottom: "" }
  return { top: lines[0]!, bottom: lines.slice(1).join("\n") }
}

/** 구간 길이를 줄 수로 균등 분할해, playhead 시각에 해당하는 한 줄만 반환 (순차 자막). */
export function narrationSubLineAtPlayhead(seg: NarrationSegment, playheadSec: number): string {
  const lines = seg.text.split("\n").map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return ""
  if (lines.length === 1) return lines[0]!
  const dur = seg.end - seg.start
  if (dur <= 0) return lines[0]!
  const elapsed = Math.min(Math.max(0, playheadSec - seg.start), dur - 1e-6)
  const idx = Math.min(lines.length - 1, Math.floor((elapsed / dur) * lines.length))
  return formatSubtitleDisplayText(lines[idx] ?? "")
}

export function narrationScriptPlainTextFrom(segments: readonly NarrationSegment[]): string {
  return segments
    .map(
      (s) =>
        `${formatNarrationClock(s.start)}–${formatNarrationClock(s.end)} (${narrationSegmentDuration(s)}초)\n${s.text}`
    )
    .join("\n\n")
}

export function narrationScriptPlainText(): string {
  return narrationScriptPlainTextFrom(FACTORY_NARRATION_SEGMENTS)
}
