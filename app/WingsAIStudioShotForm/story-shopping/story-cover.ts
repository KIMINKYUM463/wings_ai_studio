import { findStoryTwoCutBreak } from "./story-text-break"
import type { StoryFrameSettings } from "./story-types"

/**
 * 썰쇼핑 채널 표지: 영상 첫 문장(제목)을 읽는 동안 상단을 어두운 띠 + 큰 2줄 제목으로 덮습니다.
 * 미리보기와 MP4 내보내기가 같은 종료 시점을 쓰도록 여기서만 계산합니다.
 */
const STORY_COVER_MIN_SEC = 1.2
const STORY_COVER_MAX_SEC = 3
/** 강조 줄은 "귀마개"처럼 짧은 핵심 명사인 경우가 많음 */
const STORY_COVER_MIN_LINE_CHARS = 2

export const DEFAULT_STORY_COVER_ACCENT = "#ffe14d"

export type StoryCoverLines = { top: string; accent: string }

/** 첫 클립(제목 문장) 끝까지 보이되 너무 짧거나 길지 않게 */
export function storyCoverEndSec(firstClipEndSec: number | undefined) {
  const end = Number.isFinite(firstClipEndSec) ? Number(firstClipEndSec) : STORY_COVER_MIN_SEC
  return Math.min(STORY_COVER_MAX_SEC, Math.max(STORY_COVER_MIN_SEC, end))
}

export function resolveStoryCoverLines(settings: StoryFrameSettings): StoryCoverLines | null {
  if (settings.coverEnabled === false) return null
  const top = settings.coverTitleTop?.trim() || ""
  const accent = settings.coverTitleAccent?.trim() || ""
  if (top || accent) return { top, accent }

  const title = settings.videoTitle.trim()
  if (!title) return null
  const split = findStoryTwoCutBreak(title, STORY_COVER_MIN_LINE_CHARS)
  return split ? { top: split[0], accent: split[1] } : { top: "", accent: title }
}
