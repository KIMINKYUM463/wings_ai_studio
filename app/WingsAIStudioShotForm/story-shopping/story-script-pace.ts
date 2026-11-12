import type { StoryNarrationStyle } from "./story-types"

/**
 * 썰쇼핑 채널(선물가게·수상한상점·신사들) 실측 내레이션 밀도는 초당 약 8.0~8.7자(공백 제외).
 * 존댓말 구어체는 어미가 길어 같은 시간에 덜 읽힙니다.
 * 대본 생성 API와 생성 화면의 글자 수 안내가 같은 값을 쓰도록 한곳에 둡니다.
 */
const CHARS_PER_SEC: Record<StoryNarrationStyle, number> = {
  ssul: 7.8,
  polite: 5,
}
/** 한 장면 내레이션 목표 글자 수 — 자막 2~3줄(줄당 12자 안팎)에 맞춤 */
const STORY_CHARS_PER_SCENE = 30
const STORY_MIN_SCENES = 4
export const STORY_MAX_SCENES = 14
export const DEFAULT_STORY_NARRATION_STYLE: StoryNarrationStyle = "ssul"

export function storyTargetCharacters(
  targetSeconds: number,
  style: StoryNarrationStyle = DEFAULT_STORY_NARRATION_STYLE
) {
  return Math.round(targetSeconds * CHARS_PER_SEC[style])
}

export function storyTargetSceneCount(
  targetSeconds: number,
  style: StoryNarrationStyle = DEFAULT_STORY_NARRATION_STYLE
) {
  return Math.max(
    STORY_MIN_SCENES,
    Math.min(
      STORY_MAX_SCENES,
      Math.round(storyTargetCharacters(targetSeconds, style) / STORY_CHARS_PER_SCENE)
    )
  )
}
