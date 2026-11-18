export type StoryMarketFormat =
  | "problem-proof"
  | "before-after"
  | "mistake-warning"
  | "unexpected-use"
  | "comparison"
  | "review-reversal"
  | "unboxing"
  | "routine"
  | "story"

export type StoryMarketVideoInput = {
  title: string
  description?: string
  viewCount: number
  likeCount: number
  durationSec: number
  publishedAt?: string
}

export type StoryMarketSignal = {
  format: StoryMarketFormat
  hookPattern: string
  performanceScore: number
  engagementRate: number
  viewsPerDay: number
}

const FORMAT_RULES: Array<{
  format: StoryMarketFormat
  pattern: RegExp
  hookPattern: string
}> = [
  { format: "before-after", pattern: /before|after|전후|비포|애프터|변화/i, hookPattern: "결과 선공개" },
  { format: "mistake-warning", pattern: /mistake|never|don't|warning|실수|절대|주의|손해/i, hookPattern: "실수·손해 경고" },
  { format: "comparison", pattern: /vs\.?|compare|which|비교|차이|대결/i, hookPattern: "두 선택지 대결" },
  { format: "unexpected-use", pattern: /hack|secret|didn't know|몰랐|의외|꿀팁|비밀/i, hookPattern: "의외의 사용법" },
  { format: "review-reversal", pattern: /review|honest|worth|후기|솔직|반신반의/i, hookPattern: "의심에서 반전" },
  { format: "unboxing", pattern: /unbox|first look|what's inside|언박싱|구성품/i, hookPattern: "실물·구성 선공개" },
  { format: "routine", pattern: /routine|day in|every day|루틴|일상/i, hookPattern: "익숙한 루틴의 불편" },
  { format: "problem-proof", pattern: /fix|solve|test|demo|how to|해결|테스트|사용법/i, hookPattern: "문제와 증거 선공개" },
]

export function analyzeStoryMarketVideo(input: StoryMarketVideoInput): StoryMarketSignal {
  const text = `${input.title} ${input.description || ""}`
  const matched = FORMAT_RULES.find((rule) => rule.pattern.test(text))
  const format = matched?.format || "story"
  const hookPattern = matched?.hookPattern || "궁금증·반전"
  const engagementRate =
    input.viewCount > 0 ? input.likeCount / input.viewCount : 0
  const publishedMs = input.publishedAt ? Date.parse(input.publishedAt) : Number.NaN
  const ageDays = Number.isFinite(publishedMs)
    ? Math.max(1, (Date.now() - publishedMs) / 86_400_000)
    : 365
  const viewsPerDay = input.viewCount / ageDays
  const durationFit =
    input.durationSec >= 12 && input.durationSec <= 45
      ? 1
      : input.durationSec <= 60
        ? 0.85
        : 0.55
  const performanceScore = Math.round(
    Math.min(
      100,
      Math.log10(Math.max(10, input.viewCount)) * 12 +
        Math.min(22, engagementRate * 500) +
        Math.min(18, Math.log10(Math.max(1, viewsPerDay)) * 4) +
        durationFit * 10
    )
  )
  return {
    format,
    hookPattern,
    performanceScore,
    engagementRate,
    viewsPerDay,
  }
}

/**
 * YouTube 공식 가이드와 고조회수 쇼핑·썰 숏폼의 공통점을 생성 프롬프트용으로 고정합니다.
 * 특정 채널 문장을 복제하지 않고 구조만 적용합니다.
 */
export const STORY_MARKET_CREATIVE_RULES = `
고조회수 쇼핑 썰 숏폼 공통 제작 규칙:
- 0~1초: 로고·인사 없이 문제, 결과, 손해 경고, 반전 단서 중 하나를 첫 문장과 첫 화면에 즉시 제시한다.
- 1~3초: 제목의 약속을 바로 증명할 실제 행동이나 결과 화면을 보여준다.
- 한 영상은 발견·평가·비교·구매 중 한 가지 시청자 질문만 해결한다.
- 2~3초마다 정보가 전진해야 한다. 같은 말을 바꿔 반복하거나 관련 없는 분위기 컷으로 시간을 채우지 않는다.
- 제품은 광고 소품이 아니라 갈등을 해결하는 행동 속에 등장시킨다.
- 기능 나열보다 한 번의 완전한 사용 행동, 가까운 디테일, 전후 결과를 우선한다.
- 장점만 말하지 말고 적용 대상, 한계, 구성품 또는 선택 기준 하나를 포함해 신뢰를 만든다.
- 마지막에는 제품을 화면에 유지한 채 짧은 다음 행동을 안내한다. 과장 구매 압박은 금지한다.
- 참고 영상의 문장·고유 연출을 복제하지 말고 훅 종류, 정보 순서, 증명 방식만 학습한다.
`.trim()

