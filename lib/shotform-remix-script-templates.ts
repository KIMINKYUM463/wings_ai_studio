import { PLAYBOOK } from "@/lib/wings-shopping-v2/ssul/playbook"
import { REMIX_MARKET_SCRIPTS } from "@/lib/shotform-remix-market-scripts"

export type RemixScriptStep = {
  role: string
  purpose: string
  guidance: string
  /** 화면에서 보여주는 예시 문장. 실제 대본은 고른 영상 내용으로 다시 씁니다. */
  example: string
}

export type RemixScriptTemplate = {
  id: string
  name: string
  oneLiner: string
  /** 고르기 화면 필터용 분류. 없으면 '기본'으로 묶습니다. */
  category?: string
  steps: RemixScriptStep[]
}

/** 지금 리믹스가 쓰던 기본 흐름. 템플릿을 고르지 않으면 이 순서로 씁니다. */
const DEFAULT_TEMPLATE: RemixScriptTemplate = {
  id: "hook-demo-buy",
  name: "후킹 · 사용 · 구매",
  oneLiner: "첫 문장으로 관심을 끌고, 쓰는 장면을 보여준 뒤 구매를 짧게 유도합니다.",
  steps: [
    {
      role: "hook",
      purpose: "첫 문장에서 필요한 상황이나 결과를 던진다",
      guidance: "제품명을 길게 설명하지 말고, 보는 사람이 멈추게 한 문장으로 시작한다.",
      example: "이거 하나면 매번 다시 설치할 필요 없어요.",
    },
    {
      role: "demo",
      purpose: "쓰는 장면과 특징을 하나씩 보여준다",
      guidance: "클립에 실제로 보이는 동작과 특징만 말한다. 한 문장에 특징 하나만 넣는다.",
      example: "펼치면 바로 서고, 옆은 이렇게 막혀 있어요.",
    },
    {
      role: "cta",
      purpose: "구매나 댓글을 짧게 유도한다",
      guidance: "마지막 한 문장만 행동 유도로 쓴다. 새로운 정보를 여기서 추가하지 않는다.",
      example: "필요하면 댓글에 정보 남겨 주세요.",
    },
  ],
}

/**
 * 고르기 화면에만 쓰는 샘플 대본.
 * 같은 제품(접이식 미니 텐트)으로 구조를 비교할 수 있게 손으로 썼습니다.
 * 실제 생성 프롬프트에는 넣지 않습니다.
 */
const SAMPLE_SCRIPTS: Record<string, string[]> = {
  "secret-reveal-ssul": [
    "쓰는 사람도 감탄한 역대급 미니 텐트?",
    "겉보기엔 그냥 평범한 이불 텐트 같지만",
    "근데 사람들은 한 번에 펼쳐지는 점이 미쳤다는 걸 알아채고",
    "이게 미친 포인트인 게 10초 만에 방이 생긴다는 거. 심지어 보온까지 돼서 이불 하나 깐 수준임.",
    "이런 장점들 때문에 자취하는 사람들 사이에서 난리 났다고 함.",
  ],
  "problem-solution-info": [
    "좁은 방에서 옷이 널브러져 스트레스 받으셨다면 무조건 이렇게 하세요.",
    "옷걸이로 아무리 정리해봐야 자리만 더 차지하니까",
    "이럴 때 자주 쓰는 사람이 알려준 미니 텐트 하나면 끝인데",
    "펼치고 딱 10초만 기다려 주세요. 그냥 안에 넣기만 하면 방이 하나 더 생겨요.",
    "같은 고민이라면 꼭 저장해 두고 따라해 보세요.",
  ],
  "community-ranking": [
    "자취 방에 10만 원 쓴 놈이 텐트 티어 정리해 준다.",
    "주관적인 본인 공간 기준임.",
    "1. 미니 텐트. 펼치면 바로 방이 생기는 게 예술임. 2. 원터치 텐트. 설치가 3초임.",
    "이제 절반 왔다. 다음 편에 나머지 풀어줌.",
  ],
  "unexpected-usage": [
    "제조사도 예상 못한 역대급 활용법?",
    "원래는 캠핑용으로 나온 평범한 미니 텐트임.",
    "근데 사람들은 이게 방 안 옷 수납에 미쳤다는 걸 알아채고",
    "더 충격적인 건 겨울 이불 대신까지 쓴다는 거. 심지어 접으면 서랍에 들어감.",
    "이런 장점 때문에 온 집안을 이걸로 도배 중이라고.",
  ],
  "brand-behind-story": [
    "이 브랜드가 절대 단종 못 시키는 미니 텐트.",
    "사실 예전 텐트는 설치가 귀찮아서 항상 아쉬운 평가를 받았음.",
    "그렇게 폴대는 빼고 원터치만 남긴 텐트가 탄생함.",
    "이게 진짜 광기인 게 다섯 면을 다 솜으로 채웠다는 거.",
    "결국 좁은 방에서도 규칙을 완전히 바꿔 버린 거임.",
  ],
  "extreme-cost-effectiveness": [
    "와, 이게 이 가격이라고 해서 진짜 깜짝 놀랐습니다.",
    "처음엔 너무 작아 보여서 안 믿었는데 진짜였습니다.",
    "펼치면 바로 서고, 옆은 막혀 있어서 정말 편하더라고요.",
    "이 하나 둔 게 정말 신의 한 수였던 거 있죠.",
    "이 텐트가 궁금하신 분은 댓글에 정보 남겨 주세요.",
  ],
  "family-gift-reaction": [
    "와이프가 이거 사 왔다고 해서 충격 먹었습니다.",
    "처음엔 캠핑 텐트인 줄 알았는데, 알고 보니 방 안 수납 텐트더라고요.",
    "펼치기만 하면 알아서 방이 하나 생기니까 진짜 편하더라고요.",
    "너무 좋아서 저희 부모님 댁에도 하나 놔드렸습니다.",
    "이 텐트, 댓글에 정보 남겨 주세요.",
  ],
  "expert-advice": [
    "여러분, 좁다고 절대 큰 옷장부터 사지 마세요.",
    "인테리어 하는 친구가 그렇게 하면 동선만 막힌다고 하더라고요.",
    "비싼 가구 쓰지 말고 그냥 미니 텐트 하나만 두라는 거예요.",
    "진짜 펼치기 딱 한 번 했더니 옷이 전부 들어가는 거 있죠.",
    "정보 궁금하신 분들은 댓글에 정보 남겨 주세요!",
  ],
}

const playbookTemplates: RemixScriptTemplate[] = PLAYBOOK.structures
  .filter((structure) => structure.beats.length >= 3)
  .map((structure) => ({
    id: structure.id,
    name: structure.name,
    oneLiner: structure.oneLiner,
    steps: structure.beats.map((beat, index) => ({
      role: beat.role,
      purpose: beat.purpose,
      guidance: beat.guidance,
      example: SAMPLE_SCRIPTS[structure.id]?.[index] ?? beat.guidance,
    })),
  }))

export const REMIX_SCRIPT_TEMPLATES: RemixScriptTemplate[] = [DEFAULT_TEMPLATE, ...playbookTemplates, ...REMIX_MARKET_SCRIPTS]

export const DEFAULT_REMIX_SCRIPT_TEMPLATE_ID = DEFAULT_TEMPLATE.id

export const REMIX_SCRIPT_TEMPLATE_STORAGE_KEY = "shotform_remix_script_template"

export function remixScriptTemplate(id?: string | null): RemixScriptTemplate {
  return REMIX_SCRIPT_TEMPLATES.find((template) => template.id === id) ?? DEFAULT_TEMPLATE
}

/** 대본 작성 프롬프트에 붙일 구조 설명. 순서대로 쓰라고 고정합니다. */
export function remixScriptTemplatePrompt(id?: string | null): string {
  const template = remixScriptTemplate(id)
  const steps = template.steps
    .map((step, index) => `${index + 1}. ${step.purpose}. ${step.guidance}`)
    .join("\n")
  return [
    `[대본 구조 템플릿] ${template.name}`,
    template.oneLiner,
    "반드시 아래 순서대로 써라. 순서를 바꾸거나 단계를 빼지 마라.",
    "각 단계는 비트 1개 이상이다. 길이가 모자라면 단계 안의 문장만 늘려라.",
    steps,
    "클립에 보이는 것과 제품 키워드만 써라. 가격, 가족 에피소드, 전문가 발언, 판매량, 순위는 입력에 없으면 지어내지 마라.",
  ].join("\n")
}
