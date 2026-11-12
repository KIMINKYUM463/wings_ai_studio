/**
 * 자막 등장 애니메이션 — 미리보기(DOM)와 MP4 내보내기(캔버스)가 같은 계산을 공유.
 * 시간(초)만 넣으면 그 순간의 모양을 돌려주는 순수 함수라 두 화면이 어긋나지 않습니다.
 */

export type StoryCaptionAnimation =
  | "none"
  | "fade"
  | "pop"
  | "slide-up"
  | "typewriter"
  | "keyword"

export const DEFAULT_STORY_CAPTION_ANIMATION: StoryCaptionAnimation = "pop"

export const STORY_CAPTION_ANIMATIONS: Array<{
  id: StoryCaptionAnimation
  label: string
  description: string
}> = [
  { id: "pop", label: "팝", description: "톡 튀어나오기" },
  { id: "keyword", label: "키워드 강조", description: "핵심 단어 형광펜" },
  { id: "typewriter", label: "타자기", description: "한 글자씩 써지기" },
  { id: "slide-up", label: "올라오기", description: "아래에서 위로" },
  { id: "fade", label: "페이드", description: "서서히 나타나기" },
  { id: "none", label: "없음", description: "바로 표시" },
]

export const CAPTION_KEYWORD_BG = "#ffe14d"
export const CAPTION_KEYWORD_TEXT = "#111111"

export type CaptionMotionFrame = {
  opacity: number
  scale: number
  /** 글자 크기 대비 아래로 밀린 정도 (0.5 = 글자 크기의 절반) */
  offsetEm: number
  /** 보이는 글자 수 (타자기 외엔 전체) */
  visibleChars: number
  /** 키워드 형광펜이 칠해진 비율 0~1 */
  highlight: number
}

export type CaptionSegment = {
  text: string
  keyword: boolean
  hidden: boolean
}

const POP_SEC = 0.32
const KEYWORD_HIGHLIGHT_FROM_SEC = 0.18
const KEYWORD_HIGHLIGHT_SEC = 0.35

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3
/** 목표 크기를 살짝 넘었다가 돌아오는 탄성 곡선 */
const easeOutBack = (t: number) => {
  const c1 = 1.70158
  return 1 + (c1 + 1) * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

const charsOf = (text: string) => Array.from(text)

function typewriterSec(text: string) {
  return Math.max(0.35, Math.min(0.9, charsOf(text).length * 0.045))
}

/** 애니메이션이 끝나는 시간(초) — 미리보기는 이 시간까지만 프레임을 돌립니다 */
export function captionMotionDurationSec(
  animation: StoryCaptionAnimation,
  text: string
): number {
  switch (animation) {
    case "fade":
      return 0.25
    case "pop":
      return POP_SEC
    case "slide-up":
      return 0.3
    case "typewriter":
      return typewriterSec(text)
    case "keyword":
      return KEYWORD_HIGHLIGHT_FROM_SEC + KEYWORD_HIGHLIGHT_SEC
    default:
      return 0
  }
}

export function captionMotionAt(
  animation: StoryCaptionAnimation,
  text: string,
  localSec: number
): CaptionMotionFrame {
  const total = charsOf(text).length
  const frame: CaptionMotionFrame = {
    opacity: 1,
    scale: 1,
    offsetEm: 0,
    visibleChars: total,
    highlight: 0,
  }
  const t = Math.max(0, localSec)

  switch (animation) {
    case "fade":
      frame.opacity = easeOutCubic(clamp01(t / 0.25))
      break
    case "pop":
    case "keyword": {
      const p = clamp01(t / POP_SEC)
      frame.opacity = clamp01(t / 0.1)
      frame.scale = 0.7 + 0.3 * easeOutBack(p)
      if (animation === "keyword") {
        frame.highlight = easeOutCubic(
          clamp01((t - KEYWORD_HIGHLIGHT_FROM_SEC) / KEYWORD_HIGHLIGHT_SEC)
        )
      }
      break
    }
    case "slide-up": {
      const p = easeOutCubic(clamp01(t / 0.3))
      frame.opacity = p
      frame.offsetEm = 0.6 * (1 - p)
      break
    }
    case "typewriter":
      frame.visibleChars = Math.round(total * clamp01(t / typewriterSec(text)))
      break
  }
  return frame
}

/** 강조할 단어 1개 — 숫자(가격·할인율)가 있으면 우선, 없으면 가장 긴 단어 */
export function findCaptionKeyword(text: string): { start: number; end: number } | null {
  const chars = charsOf(text)
  let best: { start: number; end: number; score: number } | null = null
  let index = 0
  while (index < chars.length) {
    if (/\s/.test(chars[index]!)) {
      index += 1
      continue
    }
    const start = index
    while (index < chars.length && !/\s/.test(chars[index]!)) index += 1
    let end = index
    while (end > start && /[.,!?~…'"”’)\]]/.test(chars[end - 1]!)) end -= 1
    const length = end - start
    if (length < 2) continue
    const word = chars.slice(start, end).join("")
    const score = (/\d/.test(word) ? 100 : 0) + length
    if (!best || score > best.score) best = { start, end, score }
  }
  return best ? { start: best.start, end: best.end } : null
}

/** 화면에 그릴 조각들 — 키워드/숨김(타자기) 여부가 같은 글자끼리 묶음 */
export function captionSegments(
  animation: StoryCaptionAnimation,
  text: string,
  frame: CaptionMotionFrame
): CaptionSegment[] {
  const chars = charsOf(text)
  const keyword = animation === "keyword" ? findCaptionKeyword(text) : null
  const segments: CaptionSegment[] = []
  chars.forEach((char, index) => {
    const isKeyword = Boolean(keyword && index >= keyword.start && index < keyword.end)
    const hidden = index >= frame.visibleChars
    const last = segments[segments.length - 1]
    if (last && last.keyword === isKeyword && last.hidden === hidden) {
      last.text += char
    } else {
      segments.push({ text: char, keyword: isKeyword, hidden })
    }
  })
  return segments
}
