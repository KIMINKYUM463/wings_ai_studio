/**
 * 자막은 빨리, 그림은 천천히 — 썰쇼핑 채널 8편 실측(그림 1장 유지 중앙값 1.4~2.6초)과
 * Clipy 규칙(0.7초보다 짧은 컷 금지)을 따라 연속 자막 줄을 그림 1장짜리 컷으로 묶습니다.
 * 자동 배치(어떤 줄이 같은 그림을 쓸지)와 미리보기·내보내기(같은 그림이면 이어서 재생)가 함께 씁니다.
 */
export const STORY_CUT_TARGET_SEC = 1.8
export const STORY_CUT_MIN_SEC = 1.1

type CutSlot = { sceneId: string; durationSec: number }

export function groupStoryVisualCuts<T extends CutSlot>(slots: T[]): T[][] {
  const groups: T[][] = []
  let current: T[] = []
  let currentSec = 0
  slots.forEach((slot, index) => {
    current.push(slot)
    currentSec += slot.durationSec
    const next = slots[index + 1]
    const sceneEnds = !next || next.sceneId !== slot.sceneId
    // 문장(장면) 경계에서 끊는 것을 우선하되, 너무 짧은 문장은 다음 문장과 같은 그림을 씀
    if (currentSec >= STORY_CUT_TARGET_SEC || (sceneEnds && currentSec >= STORY_CUT_MIN_SEC)) {
      groups.push(current)
      current = []
      currentSec = 0
    }
  })
  if (current.length) {
    const last = groups[groups.length - 1]
    if (last && currentSec < STORY_CUT_MIN_SEC) last.push(...current)
    else groups.push(current)
  }
  return groups
}

/** index 칸과 같은 그림이 앞뒤로 이어지는 구간 [start, end] */
export function sameMediaRunRange<T>(
  items: T[],
  index: number,
  mediaUrlOf: (item: T) => string | undefined
): { start: number; end: number } {
  const url = items[index] ? mediaUrlOf(items[index]!) : undefined
  let start = index
  let end = index
  if (!url) return { start, end }
  while (start > 0 && mediaUrlOf(items[start - 1]!) === url) start -= 1
  while (end < items.length - 1 && mediaUrlOf(items[end + 1]!) === url) end += 1
  return { start, end }
}
