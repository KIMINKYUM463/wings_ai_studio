/** TFstudio 쇼핑쇼츠 내보내기 — 비주얼 스택 · Codex 스타일 카드 (프론트 상수) */

export type ThumbnailTemplateStack = {
  id: string
  label: string
  direction: string
  thumbnailFocus: string
  description: string
}

export type ThumbnailStyleVariant = {
  id: string
  label: string
  instructions: string
  preview: {
    line1: string
    line2: string
    theme: "clean" | "warm" | "graphic" | "premium" | "problem" | "pop" | "macro" | "dark" | "info" | "texture"
  }
}

/** deal / review / compare 3스택 */
export const THUMBNAIL_TEMPLATE_STACKS: ThumbnailTemplateStack[] = [
  {
    id: "deal-proof-stack",
    label: "Deal proof",
    direction: "Fast hook → proof cut → offer",
    thumbnailFocus: "오퍼·가격·가치 반론을 즉시 읽히게, 상품은 지배적으로",
    description: "가격/혜택을 한눈에 · 빠른 훅",
  },
  {
    id: "review-trust-stack",
    label: "Review trust",
    direction: "Question → review evidence → benefit",
    thumbnailFocus: "실사용 장면 + 신뢰형 헤드라인",
    description: "후기·신뢰감 · 실사용 느낌",
  },
  {
    id: "clean-compare-stack",
    label: "Clean compare",
    direction: "Problem → benefit → detail",
    thumbnailFocus: "전/후·선택을 읽기 쉽게, 난잡 금지",
    description: "문제→해결 · 깔끔한 비교",
  },
]

/** Codex 스타일 카드 */
export const THUMBNAIL_STYLE_VARIANTS: ThumbnailStyleVariant[] = [
  {
    id: "product-poster-clean",
    label: "상품 포스터형",
    instructions:
      "밝고 깨끗한 라이프스타일 포스터. 제품을 화면 중앙 하단에 크게 배치하고 상단에 굵은 2줄 한글 헤드라인. 화이트·코랄 계열, 작은 원형 포인트만 사용.",
    preview: { line1: "한 번에", line2: "깔끔하게", theme: "clean" },
  },
  {
    id: "real-use-context",
    label: "사용 장면형",
    instructions:
      "카테고리에 맞는 자연스러운 실사용 장면을 화면 전체로 보여주고 제품 형태·색상을 고정. 상단 중앙에 크고 단정한 흰색 2줄 헤드라인.",
    preview: { line1: "사용하니", line2: "바로 깔끔", theme: "warm" },
  },
  {
    id: "graphic-ad-split",
    label: "그래픽 광고형",
    instructions:
      "검정·빨강의 강한 대각선 그래픽 포스터. 제품 클로즈업과 굵은 흰색·노란색 2줄 헤드라인. 속도감은 주되 fake UI·허위 배지는 금지.",
    preview: { line1: "기준을", line2: "한번에 맞춤", theme: "graphic" },
  },
  {
    id: "premium-minimal-studio",
    label: "프리미엄 미니멀형",
    instructions:
      "부드러운 베이지 스튜디오, 넉넉한 여백과 소재감. 제품을 정돈된 모습으로 하단에 배치하고 상단에는 차분한 짙은 회색 2줄 헤드라인. 과한 그래픽 금지.",
    preview: { line1: "보관도", line2: "정돈되게", theme: "premium" },
  },
  {
    id: "problem-solution-focus",
    label: "문제 해결 포커스형",
    instructions:
      "생활 속 문제를 제품 하나로 해결한 결과가 즉시 보이는 밝은 장면. 제품과 해결 결과를 함께 크게 보여주고 상단에 굵은 갈색 2줄 헤드라인.",
    preview: { line1: "정리 고민", line2: "이걸로 끝", theme: "problem" },
  },
  {
    id: "two-tone-headline-pop",
    label: "투톤 헤드라인형",
    instructions:
      "타이포가 중심인 밝고 경쾌한 광고 포스터. 노랑·빨강·흰색 중 2~3색의 두꺼운 한글 헤드라인과 제품을 균형 있게 배치. 제품 색상은 유지.",
    preview: { line1: "한눈에", line2: "색으로 구분", theme: "pop" },
  },
  {
    id: "macro-detail-closeup",
    label: "디테일 클로즈업형",
    instructions:
      "손이 제품의 실제 기능을 사용하는 매크로 클로즈업. 물방울과 재질 등 사실적인 디테일을 강조하고 상단에 흰색의 굵은 2줄 헤드라인.",
    preview: { line1: "구석까지", line2: "한 번에", theme: "macro" },
  },
  {
    id: "dark-cinematic",
    label: "다크 시네마틱형",
    instructions:
      "검정 배경과 따뜻한 림라이트의 고급 시네마틱 제품 사진. 제품을 중앙 하단에 배치하고 상단에 크림색 2줄 헤드라인. 불필요한 소품 최소화.",
    preview: { line1: "분위기까지", line2: "달라지게", theme: "dark" },
  },
  {
    id: "feature-info-card",
    label: "정보 카드형",
    instructions:
      "밝은 실사용 사진 위에 제품을 크게 배치하고 실제 기능 2~3개를 작은 아이콘형 콜아웃으로 정리. 상단에는 초록·검정 2줄 헤드라인. 허위 수치 금지.",
    preview: { line1: "기능을", line2: "한눈에", theme: "info" },
  },
  {
    id: "soft-texture-mood",
    label: "텍스처 무드형",
    instructions:
      "부드러운 파스텔 배경과 따뜻한 자연광, 제품 사용 결과가 돋보이는 감성 사진. 상단에 코랄·화이트의 둥글고 굵은 2줄 헤드라인.",
    preview: { line1: "보관까지", line2: "예쁘게", theme: "texture" },
  },
]
