/**
 * YouTube Shorts · Instagram Reels · TikTok 쇼핑 영상에서 공통으로 검증된
 * 구조를 리믹스 편집/대본 생성 규칙으로 정규화한다.
 *
 * 특정 영상의 문장이나 연출을 복제하지 않고 정보 순서와 증명 방식만 사용한다.
 */
export type RemixMarketPlatform = "youtube" | "instagram" | "tiktok"

export type RemixFlowBeat =
  | "hook"
  | "reveal"
  | "problem"
  | "demo"
  | "proof"
  | "trust"
  | "cta"

export type RemixPlatformPlaybook = {
  platform: RemixMarketPlatform
  label: string
  /** 플랫폼 공식 원칙에서 파생한 운영 기본값이며 A/B 테스트로 조정해야 한다. */
  timingBasis: "operational-heuristic"
  hookWindowSec: number
  productRevealBySec: number
  preferredDurationSec: readonly [number, number]
  priorities: readonly string[]
}

export const REMIX_PLATFORM_PLAYBOOKS: Record<RemixMarketPlatform, RemixPlatformPlaybook> = {
  youtube: {
    platform: "youtube",
    label: "YouTube Shorts",
    timingBasis: "operational-heuristic",
    hookWindowSec: 1,
    productRevealBySec: 5,
    preferredDurationSec: [15, 45],
    priorities: [
      "첫 5초 안에 제품을 선명하게 보여준다",
      "클로즈업·전후·착용·실사용으로 효용을 증명한다",
      "제품 태그와 실제 등장 순서를 일치시킨다",
      "구매 행동을 구체적으로 안내한다",
    ],
  },
  instagram: {
    platform: "instagram",
    label: "Instagram Reels",
    timingBasis: "operational-heuristic",
    hookWindowSec: 2,
    productRevealBySec: 3,
    preferredDurationSec: [6, 30],
    priorities: [
      "첫 프레임의 움직임과 가치 약속을 함께 사용한다",
      "제품을 한 번이 아니라 서로 다른 맥락에서 반복 노출한다",
      "음소거 상태에서도 이해되는 큰 자막과 안전 영역을 사용한다",
      "말과 음악을 함께 쓰되 브랜드 화면은 전체의 25% 이하로 둔다",
    ],
  },
  tiktok: {
    platform: "tiktok",
    label: "TikTok",
    timingBasis: "operational-heuristic",
    hookWindowSec: 1.5,
    productRevealBySec: 3,
    preferredDurationSec: [9, 30],
    priorities: [
      "광고 인트로 없이 결과·문제·놀라운 행동으로 시작한다",
      "사용자가 직접 찍은 듯한 세로형 실사용 데모를 우선한다",
      "기능 나열 대신 문제-해결-증거의 한 가지 메시지에 집중한다",
      "자막·보이스·행동이 같은 순간에 같은 효용을 말하게 한다",
    ],
  },
}

const BEAT_LABELS: Record<RemixFlowBeat, string> = {
  hook: "스크롤 정지",
  reveal: "제품 공개",
  problem: "불편 구체화",
  demo: "사용 행동",
  proof: "결과 증명",
  trust: "한계·선택 기준",
  cta: "다음 행동",
}

export function remixFlowBeatLabel(beat: RemixFlowBeat): string {
  return BEAT_LABELS[beat]
}

/** 컷 수에 맞춰 정보가 앞으로만 전진하는 쇼핑 흐름을 만든다. */
export function buildRemixMarketFlow(cutCount: number): RemixFlowBeat[] {
  if (cutCount <= 0) return []
  if (cutCount === 1) return ["hook"]
  if (cutCount === 2) return ["hook", "cta"]
  if (cutCount === 3) return ["hook", "demo", "cta"]
  if (cutCount === 4) return ["hook", "reveal", "proof", "cta"]
  if (cutCount === 5) return ["hook", "reveal", "demo", "proof", "cta"]

  const core: RemixFlowBeat[] = ["hook", "reveal", "problem"]
  const middleSlots = cutCount - 5
  for (let i = 0; i < middleSlots; i++) core.push(i % 2 === 0 ? "demo" : "proof")
  core.push("trust", "cta")
  return core.slice(0, cutCount)
}

export function buildRemixFlowPrompt(cutCount: number): string {
  const flow = buildRemixMarketFlow(cutCount)
  const flowText = flow.map((beat, index) => `${index + 1}.${remixFlowBeatLabel(beat)}`).join(" → ")
  return [
    "YouTube Shorts·Instagram Reels·TikTok 쇼핑숏폼 교차 분석 규칙:",
    `- 권장 장면 흐름: ${flowText}`,
    "- 운영 기본값(A/B 검증 대상): 0~2초에 인사·로고 없이 결과, 손해, 문제 행동, 강한 시각 변화 중 하나로 시작한다.",
    "- 운영 기본값(A/B 검증 대상): 3~5초 안에 홍보 제품의 형태와 쓰임을 식별 가능하게 보여준다.",
    "- 제품은 최소 두 번 노출하되 같은 화면을 반복하지 말고 전체→손동작→디테일→결과처럼 증거를 전진시킨다.",
    "- 한 컷에는 한 주장만 둔다. 자막·나레이션·화면 행동은 같은 효용을 동시에 설명한다.",
    "- 추상 칭찬 대신 완전한 사용 행동과 확인 가능한 전후·결과를 우선한다.",
    "- 장점 뒤에 적용 대상, 한계, 구성 또는 선택 기준 중 하나를 넣어 광고성 과장을 낮춘다.",
    "- 마지막 CTA는 화면 속 제품을 유지하며 저장·댓글·제품 확인 등 하나의 행동만 짧게 요청한다.",
    "- 원본의 문장·고유 연출을 복제하지 말고 구조·속도·증명 방식만 재구성한다.",
  ].join("\n")
}

export const REMIX_MARKET_ANALYSIS_SCHEMA_PROMPT = `
videoStructure는 단순 요약이 아니라 실제 시간순 구조를 분석한다.
- format: problem-solution | before-after | demo-proof | comparison | honest-review | unboxing | routine | story 중 하나
- hook: 첫 0~2초의 시각 행동 + 말/화면자막이 약속하는 것
- openingVisual: 첫 프레임에서 보이는 제품·손동작·결과
- body: 문제→제품→사용 행동→증거가 어떻게 전개되는지
- proof: 화면에서 검증 가능한 전후·테스트·디테일
- trust: 한계·대상·선택 기준·구성품 등 신뢰 장치
- cta: 마지막 요청 행동
- pacing: 평균 컷 길이, 정보 전환 주기, 반복 구간
- shotFlow: 시간순 3~8개 한국어 흐름 라벨
- platformSignals: YouTube Shorts·Instagram Reels·TikTok 중 확인되는 네이티브 연출 신호
화면에 없는 효과·스펙·성과는 추정하지 말고 빈 값으로 둔다.
`.trim()

export const REMIX_MARKET_SCRIPT_RULES = buildRemixFlowPrompt(8)
