import type { StoryScriptTemplateId } from "./story-types"

/** classic: 일반 스토리 공식 · ssul: 썰쇼핑 채널 인기 영상 대본에서 뽑은 공식 */
export type StoryScriptTemplateGroup = "classic" | "ssul"

export interface StoryScriptTemplateInfo {
  name: string
  english: string
  group: StoryScriptTemplateGroup
  description: string
  flow: string
  /** 대본 생성 프롬프트에 들어가는 흐름 규칙 */
  guide: string
  /** 템플릿 추천 프롬프트에 들어가는 "이런 제품에 맞음" 설명 */
  recommendWhen: string
}

/** 대본 템플릿 단일 목록 — 이름·생성 규칙·추천 기준·선택 화면이 모두 여기서 읽는다 */
export const STORY_SCRIPT_TEMPLATES: Record<StoryScriptTemplateId, StoryScriptTemplateInfo> = {
  origin: {
    name: "탄생비화형",
    english: "ORIGIN STORY",
    group: "classic",
    description: "제품보다 만든 사람과 탄생 이유에 집중",
    flow: "문제 → 집착 → 실패 → 발견 → 제품",
    guide:
      "탄생비화형: 평범한 문제 → 만든 사람의 집착 → 기존 제품 불만 → 반복 실패 → 해결 발견 → 제품 공개. 확인되지 않은 실제 역사는 만들지 말고 가상의 상황으로 명시한다.",
    recommendWhen: "만들어진 이유나 문제 해결 과정이 흥미로운 제품",
  },
  inventor: {
    name: "발명가형",
    english: "INVENTOR STORY",
    group: "classic",
    description: "기발한 생각과 세상의 반응으로 호기심 유발",
    flow: "아이디어 → 비웃음 → 발명 → 입소문",
    guide:
      "발명가형: 기발한 생각 → 주변의 의심 → 시도와 발명 → 무시 → 사용자의 반응 → 제품 공개. 실제 발명가 정보가 없으면 가상의 상황으로 구성한다.",
    recommendWhen: "기발한 구조·아이디어·발명성이 강한 제품",
  },
  competition: {
    name: "경쟁박살형",
    english: "MARKET DISRUPTION",
    group: "classic",
    description: "기존 시장의 빈틈을 뒤집는 경쟁 서사",
    flow: "업계 비상 → 문제 → 등장 → 시장 반전",
    guide:
      "경쟁박살형: 업계의 기존 방식 → 불편과 빈틈 → 새로운 방식의 등장 → 의심 → 소비자 선택 → 제품 공개. 특정 기업을 근거 없이 비방하지 않는다.",
    recommendWhen: "기존 제품의 불편을 새로운 방식으로 개선한 제품",
  },
  "unexpected-use": {
    name: "의외의 활용형",
    english: "UNEXPECTED USE",
    group: "classic",
    description: "예상 밖 사용법이 더 유명해지는 이야기",
    flow: "원래 용도 → 다른 사용법 → 확산 → 제품",
    guide:
      "의외의 활용형: 평범한 원래 용도 → 예상 밖 상황 → 다른 사용법 발견 → 확산 → 제품 공개. 수집된 사실과 리뷰에 있는 활용법을 우선한다.",
    recommendWhen: "의외의 사용법이나 다양한 활용이 강점인 제품",
  },
  "hidden-truth": {
    name: "숨겨진 진실형",
    english: "HIDDEN TRUTH",
    group: "classic",
    description: "익숙한 것을 새롭게 보이게 만드는 반전",
    flow: "익숙함 → 단서 → 비밀 → 반전 → 재조명",
    guide:
      "숨겨진 진실형: 익숙한 문제나 물건 → 거의 모르는 포인트 → 단서 공개 → 반전 → 제품 공개. 사실 확인이 안 된 비밀은 만들지 않는다.",
    recommendWhen: "익숙하지만 잘 알려지지 않은 특징이 있는 제품",
  },
  "heartwarming-true": {
    name: "감동 실화형",
    english: "HEARTWARMING STORY",
    group: "classic",
    description: "포기 직전의 감정선을 해결로 연결",
    flow: "실패 → 포기 → 계기 → 도전 → 성공",
    guide:
      "감동 실화형: 힘든 상황 → 반복 실패 → 포기 직전 → 관계와 계기 → 마지막 시도 → 해결 → 제품 공개. 실화 근거가 없으면 가상의 상황이라고 명확히 표현한다.",
    recommendWhen: "실제 사람·가족·관계의 검증된 사연이 충분한 제품",
  },
  "review-twist": {
    name: "리뷰 반전형",
    english: "REVIEW TWIST",
    group: "classic",
    description: "처음의 의심이 실제 사용 후기로 뒤집히는 이야기",
    flow: "의심 → 실제 후기 → 검증 → 반전 → 제품",
    guide:
      "리뷰 반전형: 처음에는 과장 광고라고 의심 → 실제 리뷰 속 구체적인 불편과 사용 맥락 → 반복해서 등장하는 공통 평가 → 예상 밖 결과와 인식 반전 → 제품 공개. 입력된 실제 리뷰와 분석만 근거로 사용하고, 없는 후기·효능·수치·사용 경험을 만들지 않는다.",
    recommendWhen: "처음의 의심을 뒤집을 만큼 구체적이고 일관된 실제 사용 후기가 충분한 제품",
  },
  "problem-solution": {
    name: "문제 해결형",
    english: "PROBLEM SOLVER",
    group: "classic",
    description: "반복되는 생활 불편을 해결하는 과정에 집중",
    flow: "불편 → 기존 방법 실패 → 발견 → 해결 → 제품",
    guide:
      "문제 해결형: 반복되는 구체적인 생활 불편 → 기존 방법의 한계 → 새로운 해결법 발견 → 사용 과정 → 달라진 결과 → 제품 공개. 근거 없는 효능 대신 확인된 기능과 사용 맥락으로 해결을 보여준다.",
    recommendWhen: "반복되는 생활 불편과 이를 해결하는 기능이 분명한 제품",
  },
  "before-after": {
    name: "비포애프터형",
    english: "BEFORE & AFTER",
    group: "classic",
    description: "사용 전후의 명확한 변화를 이야기로 증명",
    flow: "이전 상태 → 불편 → 사용 → 변화 → 결과",
    guide:
      "비포애프터형: 사용 전 상태와 불편 → 바꾸게 된 계기 → 사용 → 사용 후 변화 → 제품 공개. 전후 차이는 입력 자료에서 확인된 내용만 사용하며 과장된 수치나 효과를 만들지 않는다.",
    recommendWhen: "사용 전후의 변화가 입력 자료로 구체적으로 확인되는 제품",
  },
  "challenge-test": {
    name: "도전 실험형",
    english: "CHALLENGE TEST",
    group: "classic",
    description: "직접 조건을 정하고 시험하며 결과를 확인",
    flow: "의문 → 실험 조건 → 도전 → 결과 → 판정",
    guide:
      "도전 실험형: 제품에 대한 의문 → 공정한 실험 조건 → 직접 테스트 → 예상 밖 결과 → 판정 → 제품 공개. 실제로 제공된 정보로 검증할 수 없는 실험 결과는 단정하지 않는다.",
    recommendWhen: "같은 조건에서 성능이나 사용성을 직접 시험하기 좋은 제품",
  },
  "mistake-warning": {
    name: "실수 경고형",
    english: "MISTAKE WARNING",
    group: "classic",
    description: "흔히 하는 실수와 손해를 피하는 방법 제시",
    flow: "경고 → 흔한 실수 → 손해 → 해결법 → 제품",
    guide:
      "실수 경고형: 많은 사람이 하는 실수 → 반복되는 손해나 불편 → 원인 발견 → 피하는 방법 → 제품 공개. 공포를 과장하지 말고 확인된 위험과 사용상 주의만 다룬다.",
    recommendWhen: "잘못된 사용법이나 구매 실수를 예방할 정보가 충분한 제품",
  },
  "expert-tip": {
    name: "전문가 꿀팁형",
    english: "EXPERT TIP",
    group: "classic",
    description: "전문적인 선택 기준을 쉽게 풀어 신뢰 형성",
    flow: "오해 → 선택 기준 → 핵심 팁 → 적용 → 제품",
    guide:
      "전문가 꿀팁형: 흔한 오해 → 좋은 제품을 고르는 기준 → 놓치기 쉬운 핵심 포인트 → 실제 적용 → 제품 공개. 확인되지 않은 전문가·기관·인증을 인용하지 않는다.",
    recommendWhen: "선택 기준이나 올바른 사용 팁으로 설명할 가치가 큰 제품",
  },
  comparison: {
    name: "비교 검증형",
    english: "HEAD TO HEAD",
    group: "classic",
    description: "두 방식의 차이를 같은 조건에서 비교",
    flow: "두 선택지 → 동일 조건 → 비교 → 차이 → 제품",
    guide:
      "비교 검증형: 기존 방식과 새로운 방식 → 동일한 사용 상황 → 차이 관찰 → 장단점 판정 → 제품 공개. 경쟁사를 비방하거나 근거 없는 우월성을 주장하지 않는다.",
    recommendWhen: "기존 방식과 새 방식의 장단점을 공정하게 비교할 수 있는 제품",
  },
  "time-saving": {
    name: "시간 절약형",
    english: "TIME SAVER",
    group: "classic",
    description: "귀찮은 반복 작업이 짧아지는 체감에 집중",
    flow: "반복 작업 → 시간 낭비 → 전환 → 단축 → 여유",
    guide:
      "시간 절약형: 매번 반복되는 귀찮은 작업 → 쌓이는 시간과 피로 → 방법 전환 → 간결해진 과정 → 생긴 여유 → 제품 공개. 시간 수치는 근거가 있을 때만 사용한다.",
    recommendWhen: "반복 작업이나 사용 단계를 실질적으로 줄여주는 제품",
  },
  "gift-reaction": {
    name: "선물 반응형",
    english: "GIFT REACTION",
    group: "classic",
    description: "상대의 필요를 발견하고 선물한 뒤의 반응",
    flow: "관찰 → 고민 → 선물 → 첫 반응 → 만족",
    guide:
      "선물 반응형: 상대가 겪는 불편 관찰 → 무엇을 선물할지 고민 → 제품 선택 → 첫 사용 반응 → 달라진 일상 → 제품 공개. 실제 사연이 없으면 가상의 상황임을 자연스럽게 드러낸다.",
    recommendWhen: "특정 관계나 상황에서 선물하는 맥락이 자연스러운 제품",
  },
  "trend-discovery": {
    name: "트렌드 발견형",
    english: "TREND DISCOVERY",
    group: "classic",
    description: "왜 갑자기 주목받는지 사용 맥락으로 해설",
    flow: "유행 포착 → 의문 → 이유 → 직접 확인 → 제품",
    guide:
      "트렌드 발견형: 최근 자주 보이는 현상 → 왜 인기인지 의문 → 사람들이 선택하는 이유 → 직접 사용 맥락 확인 → 제품 공개. 판매량·국가·유행 수치는 수집 근거가 없으면 만들지 않는다.",
    recommendWhen: "최근 주목받는 이유와 새로운 사용 맥락을 설명할 수 있는 제품",
  },
  "underdog-comeback": {
    name: "무시당하다 역전형",
    english: "UNDERDOG COMEBACK",
    group: "ssul",
    description: "처음엔 무시당하던 제품이 판을 뒤집는 대반전",
    flow: "무시·의심 → 숨은 실력 → 첫 반응 → 판도 역전 → 직접 써봄",
    guide:
      "무시당하다 역전형: 출시 전후 사람들의 의심과 무시(따옴표 대사 1번) → 사람들이 몰랐던 진짜 실력(만든 방식·재료·구조) → 처음 써본 사람들의 반응 → 판도가 뒤집힌 근황 → 리뷰에 나온 사용 순간의 감각 묘사 → 한 줄 마무리. 의심과 반응은 실제 리뷰 표현을 우선하고, 판매량·순위·품절 같은 수치는 근거가 있을 때만 쓴다.",
    recommendWhen:
      "처음엔 의심받았지만 실제 리뷰에서 평가가 뒤집힌 제품 (리뷰에 '반신반의했는데', '기대 안 했는데' 류 표현이 반복될 때)",
  },
  "consumer-revolt": {
    name: "소비자 반란형",
    english: "CONSUMER POWER",
    group: "ssul",
    description: "소비자가 등 돌리거나 요구해서 판이 바뀐 이야기",
    flow: "사랑받던 제품 → 실망·손절 → 소비자 행동 → 바뀐 결과 → 지금 즐기는 법",
    guide:
      "소비자 반란형: 원래 사랑받던 이유 → 소비자를 실망시킨 변화(양·맛·단종·가격) → 사람들의 행동(손절·항의·대체 방법) → 기업이나 시장의 반응 → 지금 이 제품을 제대로 즐기는 방법. 단종·리뉴얼·항의 같은 사건은 근거 자료에 있을 때만 사실로 쓰고, 없으면 리뷰 속 '실망 → 다른 방법 → 이 제품으로 정착' 흐름으로 바꿔 쓴다.",
    recommendWhen:
      "리뉴얼·재출시·구성 변경 이력이 있거나, 리뷰에 '예전 그 맛', '갈아탔다', '다시 샀다' 같은 이탈·재구매 흐름이 뚜렷한 제품",
  },
  "maker-panic": {
    name: "제조사 당황형",
    english: "MAKER PANIC",
    group: "ssul",
    description: "만든 쪽 의도와 전혀 다르게 쓰여 제조사가 당황한 이야기",
    flow: "만든 의도 → 엉뚱한 사용 → 후기로 확산 → 제조사 반응 → 진짜 꿀팁",
    guide:
      "제조사 당황형: 만든 쪽이 의도한 원래 용도 → 사람들이 찾아낸 엉뚱한 사용법(리뷰 근거) → 후기와 댓글로 퍼지는 과정 → 제조사·판매처의 반응(공지·안내 문구가 근거에 있을 때만 사실로, 없으면 '만든 쪽도 예상 못 했을 것' 정도로) → 실제로 써먹는 꿀팁. 위험하거나 권장하지 않는 사용법은 꿀팁으로 소개하지 않는다.",
    recommendWhen:
      "리뷰에 원래 용도와 다른 활용법(다른 요리·다른 장소·다른 대상)이 여러 번 나오고, 그 활용이 안전한 제품",
  },
  "foreigner-reaction": {
    name: "외국인 반응형",
    english: "GLOBAL REACTION",
    group: "ssul",
    description: "처음 본 외국인이 오해했다가 써보고 놀라는 이야기",
    flow: "첫인상 오해 → 써보고 충격 → 정체 공개 → 한국에선 일상 → 마무리",
    guide:
      "외국인 반응형: 처음 본 외국인이 겉모습만 보고 다른 물건으로 착각(가상 상황임이 드러나게) → 직접 써보거나 먹어보고 놀라는 순간의 감각 묘사 → 제품 정체와 핵심 특징 → 한국에서는 이미 일상적으로 쓰는 방식 → 한 줄 마무리. 해외 판매·수출·유명인 반응은 근거가 있을 때만 사실로 쓴다.",
    recommendWhen:
      "한국 고유 식품·생활용품처럼 처음 보는 사람이 생김새만 보고 용도를 오해하기 쉬운 제품",
  },
  "country-gap": {
    name: "나라별 온도차형",
    english: "COUNTRY GAP",
    group: "ssul",
    description: "다른 곳에선 극단적인데 한국에선 평범한 반전",
    flow: "극단적인 평가 → 한국인의 무덤덤 반응 → 이유 해설 → 한국식 활용 → 드립",
    guide:
      "나라별 온도차형: 어떤 나라·집단에서는 대단하거나 위험하다고 여기는 특징 → 한국 사람들의 아무렇지 않은 반응(따옴표 대사 1번) → 차이가 생긴 이유(입맛·생활 습관·환경) → 한국식으로 더 잘 쓰는 법 → 한 줄 드립. 특정 국가를 비하하지 않고, 해외 평가는 근거가 있을 때만 사실로 쓴다. 근거가 없으면 '처음 쓰는 사람 기준 vs 익숙한 사람 기준'으로 바꿔 쓴다.",
    recommendWhen:
      "맵기·강도·크기처럼 사람마다 체감 차이가 큰 특징이 있는 제품, 또는 해외 제품을 한국식으로 쓰는 리뷰가 많은 제품",
  },
  "viral-to-product": {
    name: "SNS 역출시형",
    english: "VIRAL TO SHELF",
    group: "ssul",
    description: "사람들이 직접 해 먹던 유행 조합이 제품이 된 이야기",
    flow: "유행 조합 → 너도나도 따라함 → 제품으로 등장 → 반응 → 제대로 쓰는 법",
    guide:
      "SNS 역출시형: 사람들이 직접 만들어 쓰던 조합이나 꿀팁 → 유행처럼 번진 과정 → 그 조합을 한 번에 해결한 제품 등장 → 사람들의 반응 → 제대로 쓰는 법. 'SNS 레시피를 그대로 출시' 같은 사실은 근거가 있을 때만 쓰고, 없으면 '원래 따로 해 먹던 걸 하나로 합친 것' 수준으로 쓴다.",
    recommendWhen:
      "여러 제품을 섞어 쓰던 방법을 하나로 합친 제품, 또는 유행 레시피·조합과 직접 연결되는 제품",
  },
  "accident-hit": {
    name: "우연 대박형",
    english: "HAPPY ACCIDENT",
    group: "ssul",
    description: "실수·방치·우연이 대박으로 바뀐 반전",
    flow: "원래 의도 → 실수·실패 → 방치 → 우연한 재발견 → 대박 → 지금",
    guide:
      "우연 대박형: 원래 하려던 일 → 실수나 실패(등장인물 따옴표 대사 1번) → 버려지거나 잊힘 → 우연히 다시 발견한 순간 → 사람들이 빠져든 이유(감각 묘사) → 지금 쓰는 방법. 실제 탄생 일화가 근거에 없으면 이 제품의 사실로 단정하지 말고 가상의 상황으로 명시한다.",
    recommendWhen: "우연한 탄생 일화가 근거 자료에 실제로 있는 제품",
  },
  "rescue-story": {
    name: "구원투수형",
    english: "RESCUE STORY",
    group: "ssul",
    description: "벼랑 끝 제작자를 누군가 도와 살려낸 이야기",
    flow: "착한 제작자 → 위기 → 도움의 손길 → 해결 과정 → 성과 → 드립",
    guide:
      "구원투수형: 좋은 뜻으로 물건을 만들던 사람 → 돈·설비·판로 문제로 무너지기 직전 → 누군가의 도움 → 해결 과정의 구체적 변화(공정·품질) → 달라진 결과 → 가벼운 한 줄 드립. 도움을 준 기업·인물·수상·매출은 근거 자료에 있을 때만 쓰고, 없으면 가상의 상황임을 자연스럽게 드러낸다.",
    recommendWhen: "중소 제조사·장인·지원 사업처럼 누군가의 도움으로 살아난 실제 일화가 근거 자료에 있는 제품",
  },
  "habit-breaker": {
    name: "상식 파괴형",
    english: "HABIT BREAKER",
    group: "ssul",
    description: "다들 당연하게 하던 습관을 깨버리는 제품",
    flow: "모두의 습관 → 만든 쪽의 반대 의견 → 그렇게 만든 이유 → 바뀐 사용법 → 감각",
    guide:
      "상식 파괴형: 다들 당연하게 하는 습관(질문이나 대사 1번) → 만든 쪽은 오히려 그걸 하지 말라는 반전 → 그렇게 설계한 이유(구조·재료) → 바뀐 올바른 사용법 → 써보는 순간의 감각 → 한 줄 마무리. 설계 의도와 사용법은 상품 설명·상세 정보에 있는 내용만 쓴다.",
    recommendWhen:
      "상세페이지에 '이렇게 쓰세요/이건 하지 마세요' 같은 사용법 안내가 뚜렷하거나, 기존 습관과 다른 사용법이 핵심인 제품",
  },
  "quiet-change": {
    name: "몰래 바뀐 근황형",
    english: "QUIET CHANGE",
    group: "ssul",
    description: "모르는 사이 바뀐 제품의 근황과 진짜 이유",
    flow: "익숙한 그 제품 → 달라진 점 포착 → 사람들의 반응 → 바뀐 이유 → 지금 고르는 법",
    guide:
      "몰래 바뀐 근황형: 누구나 아는 익숙한 제품이나 방식 → 최근 달라진 점(용량·구성·디자인·맛) → 눈치챈 사람들의 반응(리뷰 근거) → 바뀐 이유 → 그래서 지금 고르는 기준이나 꿀팁. 변경 사실은 상품 정보나 리뷰에 근거가 있을 때만 쓰고, 없으면 '예전 방식 vs 지금 방식' 비교로 바꿔 쓴다.",
    recommendWhen: "리뉴얼·구성 변경·신형 출시처럼 이전 버전과 달라진 점이 근거 자료에 있는 제품",
  },
  "controversy-flip": {
    name: "논란 역전형",
    english: "CONTROVERSY FLIP",
    group: "ssul",
    description: "논란이 터지자 소비자 선택이 뒤집힌 이야기",
    flow: "잘나가던 제품 → 논란 발생 → 다른 쪽의 대응 → 판도 변화 → 결론",
    guide:
      "논란 역전형: 잘나가던 제품이나 유행 → 터진 논란(성분·품질·가격) → 다른 쪽의 대응 → 소비자 선택이 바뀐 결과 → 이 제품이 왜 대안인지 한 줄. 논란·성분·규제는 근거 자료에 있는 내용만 쓰고, 특정 기업·제품을 근거 없이 비방하지 않는다. 근거가 없으면 '기존 방식의 아쉬움 → 대안' 구조로 쓴다.",
    recommendWhen: "성분·안전·품질 이슈와 그 대안이라는 맥락이 근거 자료에 분명한 제품",
  },
}

export const STORY_SCRIPT_TEMPLATE_IDS = Object.keys(
  STORY_SCRIPT_TEMPLATES
) as StoryScriptTemplateId[]

export function isStoryScriptTemplateId(value: string): value is StoryScriptTemplateId {
  return Object.prototype.hasOwnProperty.call(STORY_SCRIPT_TEMPLATES, value)
}
