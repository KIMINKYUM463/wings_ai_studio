/**
 * 자막 등장 효과 — 자막 줄이 바뀐 순간부터 짧게 재생.
 * 미리보기(DOM, Web Animations)와 MP4 렌더(canvas)가 같은 프레임 함수를 씁니다.
 */

export type MvpSubtitleEntrance = "none" | "soft" | "rise" | "bounce"

export const MVP_SUBTITLE_ENTRANCE_OPTIONS: { id: MvpSubtitleEntrance; label: string }[] = [
  { id: "none", label: "바로" },
  { id: "soft", label: "스르륵" },
  { id: "rise", label: "떠오름" },
  { id: "bounce", label: "톡" },
]

export const MVP_SUBTITLE_ENTRANCE_SEC = 0.22

export type MvpSubtitleEntranceFrame = {
  opacity: number
  /** 글자 크기 대비 세로 이동 (양수 = 아래) */
  offsetEm: number
  scale: number
}

const IDLE: MvpSubtitleEntranceFrame = { opacity: 1, offsetEm: 0, scale: 1 }

const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3)

/** 0→1에서 살짝 넘쳤다가 1로 돌아오는 곡선 */
const easeOutBack = (p: number) => {
  const c = 1.9
  return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2)
}

export function subtitleEntranceFrame(
  kind: MvpSubtitleEntrance | undefined,
  elapsedSec: number
): MvpSubtitleEntranceFrame {
  if (!kind || kind === "none") return IDLE
  const p = Math.min(1, Math.max(0, elapsedSec / MVP_SUBTITLE_ENTRANCE_SEC))
  if (p >= 1) return IDLE
  const e = easeOutCubic(p)
  switch (kind) {
    case "soft":
      return { opacity: e, offsetEm: 0, scale: 1 }
    case "rise":
      return { opacity: e, offsetEm: (1 - e) * 0.45, scale: 1 }
    case "bounce":
      return { opacity: Math.min(1, p * 2.5), offsetEm: 0, scale: 0.7 + 0.3 * easeOutBack(p) }
  }
}

/**
 * Web Animations API용 키프레임 — 같은 곡선을 샘플링.
 * `baseTransform`은 요소가 원래 갖는 transform(위치·맞춤 축소)이라 앞에 붙입니다.
 */
export function subtitleEntranceKeyframes(
  kind: MvpSubtitleEntrance | undefined,
  baseTransform = ""
): Keyframe[] | null {
  if (!kind || kind === "none") return null
  const steps = 8
  return Array.from({ length: steps + 1 }, (_, i) => {
    const f =
      i === steps ? IDLE : subtitleEntranceFrame(kind, (i / steps) * MVP_SUBTITLE_ENTRANCE_SEC)
    return {
      offset: i / steps,
      opacity: f.opacity,
      transform: `${baseTransform} translateY(${f.offsetEm}em) scale(${f.scale})`.trim(),
    }
  })
}

/** 렌더 루프용 — 자막 문구가 바뀐 시각을 기억해 경과 시간을 돌려줌 */
export function createSubtitleEntranceClock() {
  let lastText = ""
  let shownAt = 0
  return (text: string, nowSec: number): number => {
    if (text !== lastText) {
      lastText = text
      shownAt = nowSec
    }
    return Math.max(0, nowSec - shownAt)
  }
}
