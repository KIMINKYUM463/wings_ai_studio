import type { AutoEditJobResult } from "@/lib/shotform-auto-edit-types"
import type { NarrationSegment } from "@/lib/shotform-factory-narration-script"
import {
  expandSubtitleScheduleLines,
  formatSubtitleDisplayText,
} from "@/lib/shotform-factory-line-tts"
import { narrationSubLineAtPlayhead } from "@/lib/shotform-factory-narration-script"
import { buildNarrationSegmentsFromEditPlan, isGenericTemplateNarration } from "@/lib/shotform-cut-narration"
import { sanitizeNarrationForOutput } from "@/lib/shotform-natural-shorts-script"
import {
  cleanNarrationLineBreaks,
  formatNarrationForSceneDuration,
  maxCharsForSceneDuration,
  narrationLooksIncomplete,
  trimToCompleteNarration,
} from "@/lib/shotform-narration-timing"

export type LineSubtitleCue = { start: number; end: number; text: string }

export function sceneDurationSec(seg: NarrationSegment): number {
  return Math.max(0.5, seg.end - seg.start)
}

/** 컷별 대본 — override·기본값·길이 맞춤, 빈 칸 방지 */
export function resolveSceneNarrationText(
  sceneIndex0: number,
  baseSegments: readonly NarrationSegment[],
  scriptOverrides: Record<string, string>
): string {
  const seg = baseSegments[sceneIndex0]
  if (!seg) return ""
  const key = String(sceneIndex0 + 1)
  const dur = sceneDurationSec(seg)
  const base = seg.text.trim()
  const hasOverride = Boolean(scriptOverrides[key]?.trim())
  const raw = sanitizeNarrationForOutput((scriptOverrides[key] ?? base).trim() || base)
  if (!raw) return "한번 보세요"
  if (hasOverride) {
    const normalized = cleanNarrationLineBreaks(raw.replace(/\r/g, "").trim())
    if (!narrationLooksIncomplete(normalized.replace(/\n/g, " "))) return normalized
    const formatted = formatNarrationForSceneDuration(normalized, dur)
    if (formatted && !narrationLooksIncomplete(formatted.replace(/\n/g, " "))) return formatted
    return normalized
  }
  const formatted = formatNarrationForSceneDuration(raw, dur)
  if (
    formatted &&
    !isGenericTemplateNarration(formatted) &&
    !narrationLooksIncomplete(formatted.replace(/\n/g, " "))
  ) {
    return formatted
  }
  return formatted || trimToCompleteNarration(raw, maxCharsForSceneDuration(dur)) || "한번 보세요"
}

/** AI 대본 등 — 모든 편집 컷(1-based key)에 빈 칸 없이 채움 */
export function fillScriptOverridesForAllCuts(
  baseSegments: readonly NarrationSegment[],
  overrides: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {}
  for (let i = 0; i < baseSegments.length; i++) {
    const key = String(i + 1)
    const explicit = overrides[key]?.trim()
    if (explicit) {
      out[key] = sanitizeNarrationForOutput(explicit.replace(/\r/g, "").trim())
    } else {
      out[key] = resolveSceneNarrationText(i, baseSegments, out)
    }
  }
  return out
}

/** 자막 큐 저장용 — 줄바꿈·공백 정리 (표시 시 formatSubtitleDisplayText 적용) */
export function flattenSubtitleDisplayLine(text: string): string {
  return text.replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim()
}

/** 영상 타임라인 — 구간별 대본을 한 줄씩 균등 배치 */
export function buildLineSubtitleSchedule(
  segments: readonly NarrationSegment[],
  sceneText: (sceneIndex: number) => string,
): LineSubtitleCue[] {
  const out: LineSubtitleCue[] = []
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!
    const raw = sceneText(i).replace(/\r/g, "").trim() || seg.text.trim()
    let lines = expandSubtitleScheduleLines(raw).map(flattenSubtitleDisplayLine).filter(Boolean)
    if (!lines.length) {
      const fallback = flattenSubtitleDisplayLine(raw)
      if (fallback) lines = expandSubtitleScheduleLines(fallback).map(flattenSubtitleDisplayLine).filter(Boolean)
    }
    if (!lines.length) {
      const emergency =
        flattenSubtitleDisplayLine(seg.text) ||
        flattenSubtitleDisplayLine(sceneText(i)) ||
        "한번 보세요"
      lines = [emergency]
    }
    const dur = Math.max(0.01, seg.end - seg.start)
    const slice = dur / lines.length
    lines.forEach((text, j) => {
      out.push({
        start: seg.start + j * slice,
        end: j === lines.length - 1 ? seg.end : seg.start + (j + 1) * slice,
        text,
      })
    })
  }
  return out
}

export function subtitleFromSchedule(schedule: readonly LineSubtitleCue[], t: number): string {
  if (!schedule.length) return ""
  const time = Math.max(0, t)
  for (const row of schedule) {
    if (time >= row.start && time < row.end - 1e-5) return formatSubtitleDisplayText(row.text)
  }
  const last = schedule[schedule.length - 1]!
  if (time >= last.start) return formatSubtitleDisplayText(last.text)
  return formatSubtitleDisplayText(schedule[0]!.text)
}

/** 짜집기 결과 → 나레이션 구간 — 편집 컷(edit_plan) 1:1 우선 */
export function narrationSegmentsFromAutoEdit(result: AutoEditJobResult): NarrationSegment[] {
  const plan = result.editPlan?.edit_plan
  const analyses = result.analyses?.length
    ? result.analyses
    : result.analysis
      ? [result.analysis]
      : []
  const bundleScenes = result.script?.bundle?.sceneSubtitles?.conversion

  if (plan?.length) {
    return buildNarrationSegmentsFromEditPlan(
      result.editPlan!,
      analyses,
      result.script?.script,
      result.productAnalysis?.productName,
      bundleScenes
    )
  }

  if (bundleScenes?.length) {
    return bundleScenes.map((b) => ({
      start: b.start,
      end: b.end,
      text: b.text.trim(),
    }))
  }

  const scriptScenes = result.script?.script
  if (scriptScenes?.length) {
    return scriptScenes.map((line) => ({
      start: line.start,
      end: line.end,
      text: line.text.trim(),
    }))
  }

  return []
}

export function narrationTotalSec(segments: readonly NarrationSegment[]): number {
  if (!segments.length) return 0
  return segments[segments.length - 1]!.end
}

export function subtitleLineAtVideoTime(
  segments: readonly NarrationSegment[],
  videoTimeSec: number,
  sceneText?: (sceneIndex: number) => string,
): string {
  if (sceneText) {
    return subtitleFromSchedule(buildLineSubtitleSchedule(segments, sceneText), videoTimeSec)
  }
  if (!segments.length) return ""
  const t = Math.max(0, videoTimeSec)
  for (const seg of segments) {
    if (t >= seg.start && t < seg.end - 1e-5) {
      return narrationSubLineAtPlayhead(seg, t)
    }
  }
  const last = segments[segments.length - 1]!
  if (t >= last.start) return narrationSubLineAtPlayhead(last, t)
  return narrationSubLineAtPlayhead(segments[0]!, t)
}

export function sceneIndexAtTime(segments: readonly NarrationSegment[], t: number): number {
  if (!segments.length) return 0
  for (let i = 0; i < segments.length; i++) {
    if (t < segments[i]!.end) return i
  }
  return segments.length - 1
}
