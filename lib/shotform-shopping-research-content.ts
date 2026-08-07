import {
  getScriptTemplateById,
  sceneCountForSeconds,
  targetCharCountForSeconds,
  type ShotformScriptTemplate,
} from "@/lib/shotform-script-templates"

/** 공통 쇼핑쇼츠 품질/금지 기준 (템플릿을 대체하지 않는 바닥) */
export const SHOPPING_SHORTS_COMMON_GUIDE = `# 쇼핑쇼츠 대본 제작 공통 기준

당신은 쇼핑쇼츠 전환형 대본 기획자다.
목표는 제품 기능 설명이 아니라, 타겟이 겪는 문제를 찾아 첫 3초에 "이거 내 얘긴데?"를 느끼게 만드는 것이다.

기본 스토리 흐름:
문제 제기 → 공감 확장 → 기존 방식의 한계 → 제품 등장 → 구매 명분 → 감정 변화 → 행동 유도

절대 원칙:
1. 제품명/기능으로 시작 금지
2. 첫 3초 = 구체적 불편
3. 제목·훅·CTA·본문에 제품명 직접 반복 금지 (필요 시 "이런 도구", "이 방식")
4. 제품 설명 ≤ 30%, 문제/공감/명분 ≥ 70%
5. "완벽 해결" 대신 부담 감소·체감 표현
6. 참고 예시는 문장 복제 금지, 구조·감정만 참고
7. 구어체·쉬운 말투, 광고 카피체 금지
8. 자료에 없는 수치·인증·효과를 지어내지 말 것
`

export type BuildResearchContentInput = {
  template: ShotformScriptTemplate
  productName: string
  targetSeconds: number
  detailInsightsText?: string
  reviewInsightsText?: string
  reviewSamples?: string[]
  productPrice?: string
  productDelivery?: string
  extraNotes?: string
}

export function buildShoppingResearchContent(input: BuildResearchContentInput): string {
  const template = input.template
  const seconds = Math.max(10, Math.min(60, Math.round(input.targetSeconds || 30)))
  const chars = targetCharCountForSeconds(seconds)
  const scenes = sceneCountForSeconds(seconds)
  const charMin = Math.round(chars * 0.9)
  const charMax = Math.round(chars * 1.15)

  const examples =
    template.referenceExamples.length > 0
      ? template.referenceExamples.map((e, i) => `  ${i + 1}. ${e}`).join("\n")
      : "  (없음)"

  const reviews =
    (input.reviewSamples || [])
      .map((r) => r.trim())
      .filter(Boolean)
      .slice(0, 10)
      .map((r, i) => `  ${i + 1}. ${r.slice(0, 220)}`)
      .join("\n") || "  (없음)"

  return `[쇼핑쇼츠 대본 생성 자료]

생성 설정
이번 선택 템플릿 계약(최우선)
  - 선택 템플릿: ${template.name}
  - 템플릿 지침: ${template.instruction}
  - 우선순위: 선택 템플릿 지침은 아래 공통 쇼핑쇼츠 규칙보다 우선한다.
  - 첫 3초 훅, 전개 구조, CTA, 문장 리듬에 반드시 반영한다.
  - 참고 예시는 그대로 복사하지 말고 구조·말투·감정 흐름만 참고해 새로 쓴다.
  - 요청 대본 개수: 1개
  - 목표 길이: ${seconds}초
  - 공백 제외 목표 글자 수: 약 ${chars}자 (허용 ${charMin}~${charMax}자)
  - 장면(컷) 수: ${scenes}개
  - 참고 예시:
${examples}

---
공통 쇼핑쇼츠 기준(선택 템플릿을 대체하지 않는 품질/금지 기준)
${SHOPPING_SHORTS_COMMON_GUIDE}

---
입력 데이터
  제품 참고명(분석용, 대본 직접 노출 금지): ${input.productName || "(미상)"}
  가격: ${input.productPrice || "(없음)"}
  배송: ${input.productDelivery || "(없음)"}
  상세페이지 인사이트:
${input.detailInsightsText?.trim() || "  (없음)"}
  리뷰 인사이트:
${input.reviewInsightsText?.trim() || "  (없음)"}
  쿠팡 리뷰 참고:
${reviews}
  추가 지시:
${input.extraNotes?.trim() || "  (없음)"}
`
}

export function resolveTemplate(templateId?: string | null): ShotformScriptTemplate {
  return getScriptTemplateById(templateId)
}
