import type {
  AutoEditJobResult,
  EditPlan,
  EditPlanSegment,
  SceneSubtitleBlock,
  VideoAnalysis,
} from "@/lib/shotform-auto-edit-types"
import type { NarrationSegment } from "@/lib/shotform-factory-narration-script"
import {
  formatNarrationForSceneDuration,
  narrationLooksIncomplete,
  wrapNarrationShortLines,
  narrationPlainCharCount,
} from "@/lib/shotform-narration-timing"
import {
  hasExcessiveScriptRepetition,
  narrationBlockSimilarity,
  narrationLineIsDuplicateOfPrior,
  narrationSharesRepeatedPhrase,
} from "@/lib/shotform-narration-similarity"
import { descriptionSuggestsPresenterOrFace } from "@/lib/shotform-auto-edit-product-filter"
import {
  analysisByVideoId,
  formatCutVisualCard,
  visualSceneForSourceRange,
} from "@/lib/shotform-visual-scene-match"
import type { CutNarrationSceneMeta } from "@/lib/shotform-narration-scene-groups"
import {
  buildCutNarrationSceneMetas,
  narrationForRepeatedScene,
} from "@/lib/shotform-narration-scene-groups"
import { sanitizeNarrationForOutput } from "@/lib/shotform-natural-shorts-script"

/** 벤치마크 UI용 — [샷] + 장면 묘사 */
export function formatSceneDescriptionHint(visualCard: string): string {
  const shot = visualCard.match(/\[([^\]]+)\]/)?.[1]
  const desc = sanitizeNarrationForOutput(extractVisualDescription(visualCard))
  if (!desc) return sanitizeNarrationForOutput(visualCard)
  return shot ? `[${shot}] ${desc}` : desc
}

const GENERIC_TEMPLATE_PATTERNS = [
  /영상만 봐도 포인트가 보이/,
  /실사용할 때 이런 느낌/,
  /실제로 써보면 이렇게 편해요/,
  /써보면 왜 좋은지 알아요/,
  /직접 써보면 감이 와요/,
  /제품 디테일/,
  /이렇게 쓰면 편해요/,
  /실사용 포인트/,
  /실사용 장면/,
  /쓱\s*닦여요/,
  /^그리고\s+\*?\d/,
  /^이어서\s+실사용/,
  /^여기서\s+실제로 써보면/,
  /^바로\s+실제로 써보면/,
  /^그래서\s+\*?\d/,
  /와,?\s*이\s*화면\s*보니까/,
  /이\s*장면\s*보면/,
  /바로\s*이해됐/,
  /왜\s*쓰는지\s*알\s*것\s*같/,
  /혼자서도\s*쉽게\s*훈련/,
  /편안한\s*공간에서\s*활동/,
  /즐거운\s*시간을\s*보내/,
  /신나는\s*운동을\s*시작/,
  /효과적인\s*훈련이\s*가능/,
  /걱정\s*없이\s*시작해보세요/,
  /디테일\s*보세요/,
  /써보면\s*왜\s*좋은지/,
  /실사용하면\s*차이가/,
  /이렇게\s*쓰면\s*바로\s*편해져요/,
  /쓰다\s*보면\s*왜\s*필요한지/,
  /이\s*정도면\s*충분히\s*만족/,
  /이\s*포인트,?\s*놓치면/,
  /이\s*부분이\s*핵심/,
  /이\s*제품으로\s*해결/,
  /포인트가\s*딱\s*보여/,
  /생각보다\s*편해요/,
  /이렇게\s*쉬워요/,
  /이렇게\s*활용하면/,
  /한번\s*써보면\s*계속\s*손이/,
  /설치하고\s*나면\s*바로\s*체감/,
  /실제로\s*쓰면\s*이렇게/,
  /이\s*장면에서\s*체감이\s*확\s*와요/,
  /생각보다\s*실용적/,
  /쓰는\s*모습,?\s*생각보다/,
  /^실용적이에요$/,
  /^편해요$/,
  /^좋아요$/,
] as const

const INVALID_NARRATION_PRODUCT_NAME =
  /^(unboxing|review|test|demo|product|item|goods|shopping|tiktok|shorts|video|제품|쇼핑\s*제품)$/i

/** 나레이션에 쓸 제품명 — unboxing·review 같은 검색어·영문 라벨 제외 */
export function sanitizeProductNameForNarration(
  productName?: string,
  hints?: {
    category?: string
    summary?: string
    visualHint?: string
    analysisTitles?: readonly string[]
    /** 1단계 사용자 입력 키워드 — 최우선 */
    userKeywords?: readonly string[]
  }
): string | undefined {
  const userKw = (hints?.userKeywords ?? [])
    .map((k) => k.trim())
    .filter(Boolean)

  /** 1단계 키워드가 있으면 영상 분석·화면 추론보다 최우선 */
  if (userKw.length) {
    const primary = userKw[0]!
    if (!INVALID_NARRATION_PRODUCT_NAME.test(primary)) {
      const korean = (primary.match(/[\uac00-\ud7a3]/g) || []).length
      if (korean >= 1 || primary.length >= 2) {
        return primary.length > 56 ? `${primary.slice(0, 53)}…` : primary
      }
    }
  }

  const blob = [
    hints?.category,
    hints?.summary,
    hints?.visualHint,
    ...(hints?.analysisTitles || []),
  ]
    .filter(Boolean)
    .join(" ")

  // 키워드 없을 때만 화면·분석 힌트로 제품 추론
  if (/마우스\s*패드|mouse\s*pad|게이밍\s*패드|데스크\s*매트|keyboard|키보드|gaming|RGB|LED/i.test(blob)) {
    return "게이밍 마우스 패드"
  }
  if (/선풍기|风扇|fan|쿨링/i.test(blob)) return "미니 선풍기"
  if (/차량|차\s*안|자동차|车载|vacuum|吸尘|車|핸디\s*청소|진공\s*청소|차량용/i.test(blob)) {
    return "차량용 핸디청소기"
  }

  const raw = productName?.trim() || ""
  const koreanInRaw = (raw.match(/[\uac00-\ud7a3]/g) || []).length
  if (
    raw &&
    !INVALID_NARRATION_PRODUCT_NAME.test(raw) &&
    (koreanInRaw >= 2 || (koreanInRaw >= 1 && !/^[a-z\s]+$/i.test(raw)))
  ) {
    if (/마우스\s*패드|mouse\s*pad|게이밍/i.test(blob) && /청소|vacuum|吸尘|차량/i.test(raw)) {
      return "게이밍 마우스 패드"
    }
    return raw
  }
  if (/칫솔|牙刷|전동칫솔/i.test(blob)) return "전동칫솔"
  if (/배드민턴|셔틀콕|라켓/i.test(blob)) return "배드민턴 훈련기"
  if (/프로젝터|스크린|티비|TV/i.test(blob)) return "홈시어터 스크린"

  if (koreanInRaw >= 1) return raw
  return undefined
}

/** 중복 시 순환할 고유 폴백 대본 */
const UNIQUE_NARRATION_FALLBACKS = [
  "이 장면, 직접 보면 체감이 달라요",
  "여기 포인트가 꽤 확실해요",
  "이렇게 쓰니까 손이 훨씬 덜 가요",
  "설치 후 바로 느껴지는 차이예요",
  "실제로 보면 왜 쓰는지 납득돼요",
  "이 부분이 제일 마음에 들었어요",
  "써보니 생각보다 훨씬 편하더라고요",
  "이런 디테일이 쓰는 맛을 살려요",
  "한번 써보면 계속 손이 가요",
  "이 정도면 충분히 만족할 거예요",
  "공간 분위기까지 확 바뀌어요",
  "이건 확실히 체감되는 타입이에요",
  "쓰는 순간 바로 편해지는 느낌이에요",
  "이 포인트, 놓치면 아쉬워요",
  "보는 것보다 직접 쓰면 더 와닿아요",
  "이렇게 활용하면 훨씬 깔끔해요",
  "매일 쓰기 좋은 포인트가 있어요",
  "이 장면에서 장점이 딱 보여요",
  "쓰다 보면 왜 추천하는지 알 거예요",
  "이건 영상으로 봐도 매력이 확실해요",
] as const

/** 장면 묘사를 그대로 읽는 나레이션 (인물·소품 나열) */
const SCENE_READOUT_PATTERNS = [
  /여성의\s*손에/,
  /남성이\s*배드민턴/,
  /배드민턴\s*라켓을\s*들고/,
  /배드민턴\s*라켓으로/,
  /셔틀콕이\s*(?:뒤로|공중에)/,
  /라켓이\s*들려\s*있/,
  /모습이\s*멋져요/,
  /(?:남성|여성)이\s*.+?(?:치는|휘두르|움직이)/,
] as const

/** 화면과 무관한 추상 쇼핑 클리셰 */
export function isAbstractShoppingNarration(text: string): boolean {
  const t = text.trim().replace(/\n/g, " ")
  if (!t) return true
  if (isGenericTemplateNarration(t)) return true
  if (narrationContainsEnglishLeak(t)) return true
  const hasConcreteVisual =
    /먼지|청소|흡입|시트|바닥|노즐|필터|차|구석|틈새|매트|진공|닦|빨아|제거|정리|선풍기|바람|포장|가방|손바닥|휴대/.test(
      t
    )
  if (/^(이|그)\s*(포인트|부분)/.test(t) && !hasConcreteVisual) return true
  if (/해결하세요|놓치면 아쉬워|핵심이에요|만족할 거예요|손이 가요|체감이\s*확\s*와요/.test(t) && !hasConcreteVisual) {
    return true
  }
  if (t.length <= 10 && /^(실용|편|좋|쉬|가벼|시원|깔끔)적?이에요$/.test(t)) return true
  return false
}

/** 한국어 나레이션에 영문 검색어·라벨이 섞였는지 */
export function narrationContainsEnglishLeak(text: string): boolean {
  return /[a-zA-Z]{3,}/.test(text.replace(/\n/g, " "))
}

/** 템플릿 폴백 대본 — AI 미생성·후처리 오염 */
export function isGenericTemplateNarration(text: string): boolean {
  const t = text.trim().replace(/\n/g, " ")
  if (!t) return true
  if (GENERIC_TEMPLATE_PATTERNS.some((re) => re.test(t))) return true
  if (SCENE_READOUT_PATTERNS.some((re) => re.test(t))) return true
  return false
}

/** 후킹·클리셰·장면 나열형 약한 대본 */
export function isWeakOpeningOrClicheNarration(text: string): boolean {
  const t = text.trim().replace(/\n/g, " ")
  if (!t) return true
  return isGenericTemplateNarration(t)
}

/** 벤치마크 장면 카드 접두 — `0:12.1-0:14.9 (2.8초) [와이드샷]` */
const BENCHMARK_SCENE_CARD_PREFIX =
  /^\d+:\d+(?:\.\d+)?\s*-\s*\d+:\d+(?:\.\d+)?\s*\(\d+(?:\.\d+)?초\)\s*(?:\[[^\]]+\]\s*)?/i

/** 타임스탬프·장면 메타가 대본에 섞였는지 (컷 분할 시 `0:12. 1-0:14. 9 (2.` 같은 깨짐) */
export function looksLikeSceneCardMetadata(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (BENCHMARK_SCENE_CARD_PREFIX.test(t)) return true
  if (/^\d+:\d+(?:\.\s*\d+)?\s*-\s*\d*:?\d/.test(t)) return true
  if (/^\d+:\d+.*\(\d*(?:\.\d+)?$/.test(t)) return true
  const korean = (t.match(/[가-힣]/g) || []).length
  if (/^\d+:\d/.test(t) && korean < 5) return true
  return false
}

export function stripBenchmarkSceneCardPrefix(text: string): string {
  return text
    .replace(BENCHMARK_SCENE_CARD_PREFIX, "")
    .replace(/^소스\s+[\d.:–\s]+초\s*/i, "")
    .replace(/^\(\d+(?:\.\d+)?초\)\s*/i, "")
    .trim()
}

/** sceneSubtitles.text 정규화 — 타임스탬프 메타 제거 */
export function sanitizeSceneSubtitleText(text: string): string {
  let t = stripBenchmarkSceneCardPrefix(text)
    .replace(/\[[^\]]+\]\s*/g, "")
    .trim()
  t = t.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+/g, "").trim()
  if (!t || looksLikeSceneCardMetadata(t)) return ""
  return text.includes("\n")
    ? text
        .split("\n")
        .map((line) => stripBenchmarkSceneCardPrefix(line).replace(/\[[^\]]+\]\s*/g, "").trim())
        .filter((line) => line && !looksLikeSceneCardMetadata(line))
        .join("\n")
    : t
}

/** visual_card / reason에서 화면 묘사만 추출 */
export function extractVisualDescription(visualCard: string): string {
  return stripBenchmarkSceneCardPrefix(visualCard)
    .replace(/^소스\s+[\d.:–\s]+초\s*/i, "")
    .replace(/^\(\d+(?:\.\d+)?초\)\s*/i, "")
    .replace(/\[[^\]]+\]\s*/g, "")
    .replace(/^\[인물[^\]]*\]\s*/i, "")
    .trim()
}

function stripSceneMeta(description: string): string {
  return description
    .replace(/하단에\s*중국어\s*자막.*$/i, "")
    .replace(/카메라를?\s*(바라보며|응시).*$/i, "")
    .replace(/바라보며\s*[^.。]+/i, "")
    .replace(/\.?\s*사용자의\s*손이\s*보임\.?/gi, "")
    .replace(/\.?\s*입이\s*벌어져\s*있고[^.]*\.?/gi, "")
    .replace(/\.?\s*[^.]*(?:보임|보여\s*있음|강조됨)\.?/gi, "")
    .replace(/\.?\s*작동\s*중\.?/gi, "")
    .replace(/\.?\s*장면\.?$/i, "")
    .replace(/\.?\s*모습\.?$/i, "")
    .replace(/\.?\s*강조됨\.?$/i, "")
    .trim()
}

/** 장면 묘사를 그대로 읽는 나레이션 (모습해요, 보임 등) */
export function looksLikeDescriptiveSceneNarration(text: string): boolean {
  const t = text.trim().replace(/\n/g, " ")
  if (!t) return false
  if (/모습[,.·\s]*해요/.test(t)) return true
  if (/있는\s*모습[,.·\s]*해?요?$/.test(t)) return true
  if (/닦고\s*있는\s*모습/.test(t)) return true
  if (/(?:보임|벌어져|강조됨|클로즈업\s*샷)/.test(t) && !/편해요|쉬워요|깔끔|좋아요|추천/.test(t)) return true
  if (/^[^.!?]{6,28}[,.·\s]*해요$/.test(t) && /(?:모습|장면|보이|닦고)/.test(t)) return true
  return false
}

function buildFallbackNarration(d: string, productName: string | undefined, ruleOffset: number): string {
  const product =
    sanitizeProductNameForNarration(productName, { visualHint: d }) || "이 제품"

  const pools: string[][] = []

  if (/선풍기|风扇|fan|휴대용\s*선풍|미니\s*선풍|쿨링|手持风扇/i.test(d)) {
    pools.push([
      "손바닥만 한 사이즈, 가방에 쏙 들어가요",
      "이렇게 작은데 바람이 꽤 시원해요",
      "바람 세기 조절해보니 실내용으로 딱이에요",
      "들고 다니기 좋은 미니 선풍기예요",
      "책상 위에 두니 소음도 생각보다 적어요",
      "여름에 밖에 들고 나가기 좋은 사이즈예요",
      "한 손에 쥐어도 가벼워서 휴대하기 좋아요",
      "작은데 바람 세기가 꽤 알차요",
    ])
  }
  if (/포장|포장지|비닐|싸인|언박싱|unboxing|开箱|包装/i.test(d)) {
    pools.push([
      "포장 뜯자마자 사이즈에 놀랐어요",
      "개봉만 해도 휴대용 느낌이 확 와요",
      "포장 상태 깔끔하고 바로 쓸 수 있어요",
      "언박싱하니 손바닥만 한 사이즈예요",
      "비닐 벗기자 색감이 꽤 예뻐요",
      "박스 열자마자 들고 다니고 싶어져요",
    ])
  }

  if (/TV|티비|투사|스크린|프로젝터|projector|숨겨진|설치/.test(d)) {
    pools.push([
      "설치도 간단하고 공간도 깔끔해요",
      "버튼만 누르면 스크린이 쑥 올라와요",
      "집에서도 영화관 같은 몰입감이에요",
      "이렇게 설치하면 바로 쓸 수 있어요",
    ])
  }

  if (/칫솔|치아|칫솔질|전동칫솔|电动牙刷|牙刷/.test(d)) {
    pools.push([
      `${product}로 치아 사이까지 쓱 닦여요`,
      "이렇게 닦으면 입안이 개운해요",
      "전동칫솔, 구석구석 닦이는 게 포인트예요",
      "매일 이 습관이면 확실히 달라져요",
      "플라크 걱정, 이렇게 줄여보세요",
    ])
  }
  const isMousePadScene =
    /마우스\s*패드|mouse\s*pad|게이밍\s*패드|데스크\s*매트|keyboard|키보드|gaming|RGB|LED/i.test(d)
  if (
    !isMousePadScene &&
    /차량|차\s*안|자동차|시트|운전석|車|车载|운전|트렁크|대시보드|핸들\s*주변|차\s*바닥|바닥\s*매트/i.test(d)
  ) {
    pools.push([
      "차 시트 틈새 먼지도 이렇게 빨아들여요",
      "바닥 매트에 낀 먼지, 한 번에 흡입돼요",
      "차 안 구석 먼지 관리가 이렇게 쉬워요",
      "좁은 틈새도 노즐로 싹 정리돼요",
      "운전석 발밑 먼지, 손 안 대고 빼내요",
      "트렁크 구석 먼지까지 한 번에 정리돼요",
      "문턱 틈새 먼지도 노즐이 쏙 들어가요",
      "핸들 주변 먼지, 흡입 한 번이면 끝이에요",
      "시트 레일 사이 먼지가 바로 빠져요",
      "발밑 매트 먼지, 손끝 안 대고 싹 빼내요",
    ])
  }
  if (/마우스\s*패드|mouse\s*pad|게이밍\s*패드|데스크\s*매트|키보드|keyboard|gaming|RGB|LED/i.test(d)) {
    pools.push([
      "손목 각도가 편해서 장시간 게임해도 괜찮아요",
      "미끄럼 방지라 마우스 움직임이 훨씬 안정적이에요",
      "패드 사이즈가 커서 키보드랑 같이 쓰기 좋아요",
      "게이밍할 때 이 정도 면적이면 충분해요",
      "책상 위가 깔끔해지니까 집중이 잘 돼요",
      "RGB 분위기까지 책상 분위기가 확 살아요",
      "큰 사이즈라 팔 움직임이 훨씬 자유로워요",
      "마감이 깔끔해서 고급스럽게 보여요",
    ])
  }
  if (/청소|먼지|흡입|吸尘|진공|vacuum|닦(?:아|여|으|이|는|고)/.test(d)) {
    pools.push([
      `${product}로 먼지가 싹 빨려 들어가요`,
      "이렇게 흡입하면 구석 먼지가 바로 빠져요",
      "손이 안 가도 바닥 먼지가 정리돼요",
      "좁은 곳 먼지도 힘 안 들고 빼내요",
    ])
  }
  if (/버튼|작동|켜|开关/.test(d)) {
    pools.push(["버튼 한 번이면 바로 작동해요", "이렇게 켜면 바로 쓸 수 있어요"])
  }

  if (/LED|디스플레이|화면|스크린|screen|월드컵|경기|곡면|彩屏|显示屏/i.test(d)) {
    pools.push([
      "곡면이라 몰입감이 확 다르죠",
      "이렇게 크게 보니 현장감이 살아요",
      "야외에 설치해도 화면이 선명해요",
      "영상 볼 때 이게 진짜 체감되는 포인트예요",
    ])
  }

  if (/배드민턴|셔틀콕|라켓|훈련기|badminton|shuttle/i.test(d)) {
    pools.push([
      "파트너 없어도 이렇게 연습할 수 있어요",
      "혼자서도 셔틀콕 리턴 연습이 돼요",
      "거실에서 라켓 휘둘러도 부담 없어요",
      "공이 알아서 떨어지니 집중만 하면 돼요",
      "연습 시간 늘리고 싶으면 이게 답이에요",
      "실내에서도 스윙 감각 유지하기 좋아요",
    ])
  }

  if (/운동|스포츠|훈련|연습|fitness/i.test(d)) {
    pools.push([
      "혼자서도 루틴 채우기 좋아요",
      "집에서 이렇게 움직이니까 손이 안 놀아요",
      "연습할 때마다 체감이 달라져요",
    ])
  }

  if (!pools.length) {
    pools.push([
      "손에 들었을 때 사이즈 감이 바로 와요",
      "이렇게 쓰니 생각보다 편하더라고요",
      "직접 보면 디테일이 꽤 살아 있어요",
      "여기 포인트가 딱 보이는 장면이에요",
      "영상으로 봐도 체감이 되는 부분이에요",
      "작은데 기능이 꽤 알차 보여요",
      "이 장면이 제일 설득력 있어요",
      product ? `${product}, 손에 들었을 때 감이 와요` : "손에 들었을 때 감이 와요",
    ])
  }

  const flat = pools.flat()
  return flat[ruleOffset % flat.length]!
}

/** 청소기·차량 대본이 마우스패드 등 다른 제품 화면에 붙은 경우 */
export function narrationMismatchesVisualProduct(text: string, visualCard: string): boolean {
  const script = text.trim().replace(/\n/g, " ")
  const visual = extractVisualDescription(visualCard)
  if (!script || !visual) return false

  const vacuumScript =
    /흡입|먼지가\s*바로\s*빠져|노즐|핸들\s*주변\s*먼지|차\s*안|시트.*먼지|진공|청소기/.test(script)
  const mouseVisual = /마우스\s*패드|mouse\s*pad|게이밍|keyboard|키보드|RGB|LED|책상|데스크\s*매트/i.test(visual)
  if (vacuumScript && mouseVisual) return true

  const fanScript = /선풍기|바람\s*세기|휴대용\s*느낌|언박싱하니/.test(script)
  const carVisual = /차량|차\s*안|운전석|시트|바닥\s*매트|트렁크/i.test(visual)
  if (fanScript && carVisual) return true

  return false
}

/** 장면 분석 → 짧은 줄 나레이션 (줄바꿈 = 자막 한 줄) */
export function rephraseSceneToShoppingNarration(
  description: string,
  productName?: string,
  sceneDurationSec = 5
): string {
  const single = rephraseSceneCore(description, productName)
  return wrapNarrationShortLines(single, sceneDurationSec)
}

/** 동일 장면이라도 ruleOffset으로 다른 구어체 후보 생성 */
export function rephraseSceneToShoppingNarrationVariant(
  description: string,
  productName: string | undefined,
  sceneDurationSec: number,
  variantIndex: number
): string {
  const single = rephraseSceneCore(description, productName, Math.max(0, variantIndex))
  return wrapNarrationShortLines(single, sceneDurationSec)
}

function productNarrationFallback(productName: string | undefined, ruleOffset: number): string {
  const product = sanitizeProductNameForNarration(productName) || "이 제품"
  const fallbacks = [
    `${product}, 이렇게 쓰면 편해요`,
    `${product} 포인트가 확실해요`,
    `${product} 실사용이 이렇게예요`,
    `${product}, 써보니 생각보다 달라요`,
    `${product}로 공간이 깔끔해져요`,
    `${product}, 이 부분이 마음에 들어요`,
    "이렇게 쓰면 편해요",
    "실사용 장면이에요",
    "이 포인트가 꽤 확실해요",
    "써보니 생각보다 다르더라고요",
    "이렇게 활용하면 깔끔해요",
    "보는 것보다 직접 쓰면 와닿아요",
  ]
  return fallbacks[ruleOffset % fallbacks.length]!
}

/** 중복·유사 문장이면 화면·컷 인덱스로 강제 분기 */
function forceUniqueNarrationLine(args: {
  visualHint: string
  productName?: string
  duration: number
  cutIndex: number
  priorLines: readonly string[]
}): string {
  const { visualHint, productName, duration, cutIndex, priorLines } = args
  const isDup = (t: string) =>
    narrationLineIsDuplicateOfPrior(t, priorLines) ||
    priorLines.some((p) => narrationSharesRepeatedPhrase(p, t)) ||
    isAbstractShoppingNarration(t)

  const desc = extractVisualDescription(visualHint)
  const augmented = [
    desc,
    `손잡이 ${desc}`,
    `부속품 ${desc}`,
    `바닥 ${desc}`,
    `시트 ${desc}`,
    `노즐 ${desc}`,
    `케이스 ${desc}`,
    `사용 중 ${desc}`,
    `차량 바닥 ${desc}`,
    `차량 시트 ${desc}`,
  ]

  for (let attempt = 0; attempt < 96; attempt++) {
    const hint = augmented[attempt % augmented.length]!
    const salt = cutIndex * 53 + attempt * 19 + priorLines.length * 41
    const core = rephraseSceneCore(hint, productName, salt)
    const candidate = formatNarrationForSceneDuration(
      wrapNarrationShortLines(core, duration),
      duration
    )
    if (candidate && !isDup(candidate)) return candidate

    const fb = buildFallbackNarration(hint, productName, salt)
    const candidate2 = formatNarrationForSceneDuration(fb, duration)
    if (candidate2 && !isDup(candidate2)) return candidate2
  }

  const words = (desc.match(/[\uac00-\ud7a3]{2,}/g) ?? []).filter(
    (w) => !/장면|모습|사용자|카메라|자막|보임|강조|부분|담긴|보입니다|함께/.test(w)
  )
  const kw = words[(cutIndex + priorLines.length) % Math.max(words.length, 1)]
  const emergency = kw
    ? `${kw} 포인트, 여기도 한 번에 정리돼요`
    : `이 장면 ${cutIndex + 1}, 직접 보면 차이가 나요`
  return formatNarrationForSceneDuration(emergency, duration)
}

/** 컷마다 절대 중복되지 않는 나레이션 선택 */
export function pickUniqueNarrationLine(args: {
  visualHint: string
  productName?: string
  duration: number
  cutIndex: number
  priorLines: readonly string[]
  preferred?: string
  sceneMeta?: CutNarrationSceneMeta
  priorInGroup?: string
}): string {
  const { visualHint, productName, duration, cutIndex, priorLines, preferred, sceneMeta, priorInGroup } =
    args
  const isDup = (t: string) =>
    narrationLineIsDuplicateOfPrior(t, priorLines) ||
    priorLines.some((p) => narrationSharesRepeatedPhrase(p, t)) ||
    looksLikeRawSceneCopy(t, visualHint) ||
    narrationMismatchesVisualProduct(t, visualHint)

  if (sceneMeta?.isRepeat && sceneMeta.occurrence > 1 && priorInGroup?.trim()) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const continued = narrationForRepeatedScene({
        occurrence: sceneMeta.occurrence,
        groupSize: sceneMeta.groupSize,
        productBenefitHint: sceneMeta.productBenefitHint,
        priorInGroup,
        visualHint,
        cutIndex: cutIndex + attempt,
      })
      const fitted = formatNarrationForSceneDuration(continued, duration)
      if (fitted && !isDup(fitted) && !isAbstractShoppingNarration(fitted)) {
        return fitted
      }
    }
  }

  const prefer = preferred?.trim()
  if (prefer && !isDup(prefer) && !isAbstractShoppingNarration(prefer)) {
    const fitted = formatNarrationForSceneDuration(prefer, duration)
    if (fitted && !narrationLooksIncomplete(fitted.replace(/\n/g, " "))) {
      return fitted
    }
  }

  for (let attempt = 0; attempt < 48; attempt++) {
    const candidate = rephraseSceneToShoppingNarrationVariant(
      visualHint,
      productName,
      duration,
      cutIndex * 13 + attempt * 9 + priorLines.length * 31 + 1
    )
    if (!isDup(candidate) && !isAbstractShoppingNarration(candidate)) {
      return candidate
    }
  }

  for (let attempt = 0; attempt < 24; attempt++) {
    const salt = cutIndex * 41 + priorLines.length * 11 + attempt * 17
    const candidate = formatNarrationForSceneDuration(
      rephraseSceneToShoppingNarrationVariant(visualHint, productName, duration, salt),
      duration
    )
    if (!isDup(candidate) && !isAbstractShoppingNarration(candidate)) {
      return candidate
    }
  }

  return forceUniqueNarrationLine({
    visualHint,
    productName,
    duration,
    cutIndex,
    priorLines,
  })
}

function rephraseSceneCore(description: string, productName?: string, ruleOffset = 0): string {
  let d = stripSceneMeta(extractVisualDescription(description))
  const product = sanitizeProductNameForNarration(productName, { visualHint: d })
  if (
    descriptionSuggestsPresenterOrFace(description) ||
    descriptionSuggestsPresenterOrFace(d)
  ) {
    return productNarrationFallback(product, ruleOffset)
  }
  if (!d || d === "장면" || d === "제품 장면") {
    return productNarrationFallback(product, ruleOffset)
  }

  const rules: Array<{ re: RegExp; say: (m: RegExpMatchArray) => string }> = [
    {
      re: /포장|포장지|비닐|싸인|언박싱|unboxing|开箱|包装|wrap/i,
      say: () => {
        const opts = [
          "포장 뜯자마자 사이즈에 놀랐어요",
          "개봉만 해도 휴대용 느낌이 확 와요",
          "포장 상태 깔끔하고 바로 쓸 수 있어요",
          "언박싱하니 손바닥만 한 사이즈예요",
          "비닐 벗기자 색감이 꽤 예뻐요",
          "박스 열자마자 들고 다니고 싶어져요",
        ]
        return opts[ruleOffset % opts.length]!
      },
    },
    {
      re: /선풍기|风扇|fan|휴대용\s*선풍|미니\s*선풍|쿨링|手持风扇/i,
      say: () => {
        const opts = [
          product ? `${product}, 손바닥만 해서 가방에 쏙 들어가요` : "손바닥만 한 사이즈, 가방에 쏙 들어가요",
          "이렇게 작은데 바람이 꽤 시원해요",
          "바람 세기 조절해보니 실내용으로 딱이에요",
          "들고 다니기 좋은 미니 선풍기예요",
          "책상 위에 두니 소음도 생각보다 적어요",
          "여름에 밖에 들고 나가기 좋은 사이즈예요",
        ]
        return opts[ruleOffset % opts.length]!
      },
    },
    {
      re: /손에\s*들|手持|held\s*in\s*hand/i,
      say: () => {
        const opts = [
          "한 손에 쥐어도 가벼워서 들고 다니기 좋아요",
          "그립감도 괜찮고 휴대하기 딱이에요",
          "이렇게 들어보면 사이즈 감이 바로 와요",
          "손에 들었을 때 무게가 생각보다 가벼워요",
        ]
        return opts[ruleOffset % opts.length]!
      },
    },
    {
      re: /블루|연보라|보라|색상|컬러|purple|blue/i,
      say: () => {
        const opts = [
          "색감이 깔끔해서 선물용으로도 괜찮아요",
          "연보라 톤이 은은해서 예뻐요",
          "블루 컬러, 사진으로 봐도 색이 살아요",
          "색 선택이 다양해서 취향대로 고르기 좋아요",
        ]
        return opts[ruleOffset % opts.length]!
      },
    },
    {
      re: /(.+?)로\s*(.+?)의?\s*먼지를?\s*흡입/,
      say: (m) => `${m[2]!.trim()} 먼지도 이렇게 싹 빨아들여요`,
    },
    {
      re: /(.+?)로\s*(.+?)을?\s*흡입/,
      say: (m) => `${m[2]!.trim()}도 이렇게 싹 빨아들이는데요`,
    },
    {
      re: /필터|세척|수도꼭지/,
      say: () => "필터 세척도 간편하게 쓱",
    },
    {
      re: /운전석|차\s*안|자동차.*앉/,
      say: () => "차 안 필수템 깔끔하게 관리하세요",
    },
    {
      re: /휴대|가방|보관/,
      say: () => "휴대도 보관도 너무 편리하죠",
    },
    {
      re: /시트\s*아래/,
      say: () => "시트 아래까지 손이 잘 닿아요",
    },
    {
      re: /挡风|windshield|유리|낙叶|落叶|티새|틈새|缝隙/,
      say: () => "유리 틈새까지 이렇게 깔끔하게",
    },
    {
      re: /구석구석/,
      say: () => "구석구석까지 이렇게 깔끔하게 닦여요",
    },
    {
      re: /투사|스크린|프로젝터|projector|숨겨진|전동.*올라|screen/i,
      say: () => {
        const opts = [
          "버튼만 누르면 스크린이 쑥 올라와요",
          "설치도 간단하고 공간도 깔끔해요",
          "집에서도 영화관 같은 몰입감이에요",
        ]
        return opts[ruleOffset % opts.length]!
      },
    },
    {
      re: /TV|티비|설치/,
      say: () => {
        const opts = [
          "설치 번거로우셨죠? 이건 훨씬 간편해요",
          "이렇게 설치하면 바로 쓸 수 있어요",
          "두 사람이어도 금방 끝나요",
        ]
        return opts[ruleOffset % opts.length]!
      },
    },
    {
      re: /전동\s*칫솔|电动牙刷|칫솔|치아|칫솔질/,
      say: () => {
        const opts = [
          productName ? `${productName}로 치아 사이까지 깔끔해요` : "전동칫솔로 구석구석 닦아요",
          "이렇게 닦으면 입안이 개운해요",
          "매일 쓰기 좋은 전동칫솔이에요",
          "플라크 걱정, 이렇게 줄여보세요",
        ]
        return opts[ruleOffset % opts.length]!
      },
    },
    {
      re: /마우스\s*패드|mouse\s*pad|게이밍\s*패드|데스크\s*매트|키보드|keyboard|gaming|RGB|LED|책상\s*위/i,
      say: () => {
        const opts = [
          "손목 각도가 편해서 장시간 게임해도 괜찮아요",
          "미끄럼 방지라 마우스 움직임이 훨씬 안정적이에요",
          "패드 사이즈가 커서 키보드랑 같이 쓰기 좋아요",
          "게이밍할 때 이 정도 면적이면 충분해요",
          "큰 사이즈라 팔 움직임이 훨씬 자유로워요",
          "마감이 깔끔해서 고급스럽게 보여요",
        ]
        return opts[ruleOffset % opts.length]!
      },
    },
    {
      re: /차량의?\s*바닥|차량\s*바닥|바닥.*먼지|바닥.*청소|차량.*매트|발밑.*매트|운전석.*매트/,
      say: () => {
        const opts = [
          "발밑 매트 먼지, 한 번에 흡입돼요",
          "바닥 틈새까지 빨아들이는 속도가 빨라요",
          "차 바닥에 남은 먼지, 손 안 대고 정리돼요",
          "운전석 발밑도 노즐 한 번이면 끝이에요",
          "바닥 구석 먼지가 흡입구로 쏙 들어가요",
          "매트 위 잔먼지, 흡입 한 번에 싹 빠져요",
        ]
        return opts[ruleOffset % opts.length]!
      },
    },
    {
      re: /차량\s*시트|시트\s*위|시트.*먼지|등받이|쿠션/,
      say: () => {
        const opts = [
          "시트 쿠션 사이 먼지가 쏙 빠져요",
          "등받이 틈새 먼지도 노즐로 닦아내요",
          "시트에 붙은 먼지, 흡입 한 번이면 끝이에요",
          "시트 표면 먼지가 바로 빨려 들어가요",
          "쿠션 틈새까지 손끝 안 대고 정리돼요",
          "시트 구석 먼지, 흡입력이 확실해요",
        ]
        return opts[ruleOffset % opts.length]!
      },
    },
    {
      re: /부속품|액세서리|노즐.*모음|브러시|툴킷|툴\s*세트|여러\s*개의?\s*부속/i,
      say: () => {
        const opts = [
          "노즐·브러시까지 이렇게 풀세트예요",
          "틈새용 노즐이 여러 개라 활용도가 높아요",
          "부속품만 봐도 차량 청소 커버가 넓어요",
          "좁은 노즐부터 브러시까지 다 들어있어요",
          "케이스에 부속 정리돼 있어서 바로 쓰기 좋아요",
          "노즐 바꿔 끼우면 구석·평면 다 닦여요",
          "부속품 구성이 알차서 차량 안팎 다 커버돼요",
          "여러 노즐 덕분에 시트·바닥·틈새 한 번에 돼요",
          "브러시 노즐로 시트 표면 먼지도 싹 빼내요",
          "부속 구성만 봐도 가성비가 괜찮아 보여요",
        ]
        return opts[ruleOffset % opts.length]!
      },
    },
    {
      re: /손잡이|핸들|그립|握把|handle/i,
      say: () => {
        const opts = [
          "손잡이 그립감이 좋아서 오래 써도 편해요",
          "핸들 잡고 들면 가볍게 움직이기 좋아요",
          "손잡이 각도가 딱 맞아서 구석 청소가 수월해요",
          "한 손으로 핸들 잡고 틈새까지 쏙 들어가요",
          "손잡이 마감이 단단해서 쓸 때 안 흔들려요",
          "핸들 길이 덕분에 시트 아래까지 닿기 좋아요",
          "그립이 편해서 차 안 오래 돌려도 손이 안 아파요",
          "손잡이로 들어 올려보니 사이즈가 딱 차량용이에요",
          "핸들 주변까지 노즐이 잘 들어가요",
          "손잡이 잡는 각도가 청소하기 편하게 설계됐어요",
        ]
        return opts[ruleOffset % opts.length]!
      },
    },
    {
      re: /박스|케이스|보관함|수납|담긴\s*박스|담긴\s*케이스/i,
      say: () => {
        const opts = [
          "케이스에 담아 보관하니 차 트렁크에도 쏙 들어가요",
          "부속품 박스 정리가 깔끔해서 꺼내 쓰기 편해요",
          "휴대 케이스에 들어 있어서 들고 다니기 좋아요",
          "박스만 봐도 구성이 알차다는 게 느껴져요",
          "케이스에 쏙 넣어두면 차 안에서도 안 흩어져요",
          "보관함에 정리돼 있어서 쓰고 바로 넣기 좋아요",
          "부속품이 케이스에 담겨 있어 분실 걱정이 없어요",
          "작은 케이스에 다 들어가서 공간 차지도 적어요",
          "박스 구성 보면 바로 쓸 부속이 다 있어요",
          "케이스 덮으면 차량용 청소 준비 끝이에요",
        ]
        return opts[ruleOffset % opts.length]!
      },
    },
    {
      re: /사용\s*중|쓰는\s*모습|작동\s*하는|청소하는|흡입하는/i,
      say: () => {
        const opts = [
          "실제로 써보니 흡입 소리부터 힘이 느껴져요",
          "사용할 때 먼지가 눈앞에서 바로 빨려 들어가요",
          "돌려보니 좁은 구석도 한 번에 정리돼요",
          "직접 돌려보니 생각보다 흡입력이 확실해요",
          "차 안에서 쓰니 손이 덜 가고 깔끔해져요",
          "쓰는 순간 먼지가 흡입구로 쏙 들어가는 게 보여요",
          "실사용해보니 바닥 매트 먼지가 한 번에 빠져요",
          "이렇게 쓰면 시트 틈새까지 손 안 대고 정리돼요",
          "돌려보니 문틈 먼지도 금방 빠져요",
          "사용 장면 보니까 흡입 속도가 꽤 빨라요",
        ]
        return opts[ruleOffset % opts.length]!
      },
    },
    {
      re: /차량\s*내부|차\s*안|운전석|틈새|구석|콘솔|대시보드|車内/,
      say: () => {
        const opts = [
          "문틈·콘솔 주변 먼지까지 싹 잡혀요",
          "좁은 노즐로 구석 먼지가 바로 빨려요",
          "손 닿기 힘든 틈새도 이렇게 정리돼요",
          "대시보드 틈새 먼지도 한 번에 빼내요",
          "차 안 구석까지 노즐이 쏙 들어가요",
          "운전석 주변 먼지 관리가 이렇게 간단해요",
        ]
        return opts[ruleOffset % opts.length]!
      },
    },
    {
      re: /진공\s*청소|핸디\s*청소|吸尘|vacuum/i,
      say: () => {
        const opts = [
          productName ? `${productName} 흡입력, 먼지가 바로 빨려 들어가요` : "흡입력이 생각보다 확실해요",
          "좁은 노즐로 구석 먼지까지 싹",
          "핸디 사이즈인데 흡입은 꽤 세요",
          "차량용이라 틈새까지 노즐이 잘 들어가요",
          "작은데 흡입 소리만 들어도 힘이 느껴져요",
          "먼지통 열어보니 쌓인 양이 꽤 나와요",
          "핸디형이라 한 손으로 들고 돌리기 편해요",
          "진공 청소 한 번이면 바닥이 훨씬 깔끔해요",
          "흡입구로 먼지가 쏙 빨려 들어가는 속도가 빨라요",
          "차 안 먼지 관리용으로 사이즈 딱이에요",
          "노즐만 바꿔도 평면·구석 다 닦여요",
          "흡입력 테스트해보니 생각보다 알차요",
        ]
        return opts[ruleOffset % opts.length]!
      },
    },
    {
      re: /청소하는|청소\s*하는|清洁/,
      say: () => {
        const opts = [
          productName ? `${productName}로 구석 먼지가 싹 정리돼요` : "구석 먼지가 한 번에 정리돼요",
          "이렇게 닦으면 손이 덜 가요",
          "좁은 곳까지 청소가 빨라져요",
          "흡입 한 번이면 바닥이 훨씬 깔끔해요",
          "먼지가 쌓이기 전에 이렇게 관리해요",
        ]
        return opts[ruleOffset % opts.length]!
      },
    },
    {
      re: /펼치|전개/,
      say: () => "이렇게 펼치면 바로 쓸 수 있어요",
    },
    {
      re: /누르|버튼|작동/,
      say: () => "버튼 한 번이면 바로 작동해요",
    },
    {
      re: /클로즈업|특写|제품/,
      say: () => {
        const opts = productName
          ? [
              `${productName}, 이 부분이 핵심이에요`,
              `${productName} 마감이 꽤 깔끔해요`,
              `${productName} 포인트가 딱 보여요`,
              `${productName}, 이 디테일이 좋아요`,
            ]
          : [
              "이 부분이 핵심 포인트예요",
              "마감이 생각보다 깔끔해요",
              "여기 디테일이 꽤 살아 있어요",
              "이 포인트, 직접 보면 와닿아요",
            ]
        return opts[ruleOffset % opts.length]!
      },
    },
    {
      re: /LED|디스플레이|화면|스크린|彩屏|显示屏|screen/i,
      say: () => {
        const opts = [
          productName ? `${productName}, 화면이 이렇게 선명해요` : "화면이 이렇게 선명해요",
          "곡면이라 시야가 훨씬 넓어 보여요",
          "야외에서도 밝기가 확실히 살아요",
          "경기 볼 때 이게 진짜 포인트예요",
        ]
        return opts[ruleOffset % opts.length]!
      },
    },
    {
      re: /월드컵|경기|중계|스포츠/,
      say: () => "경기장 분위기 그대로 집에서 즐겨요",
    },
    {
      re: /배드민턴|셔틀콕|라켓|훈련기|badminton|shuttle/i,
      say: () => {
        const opts = [
          productName ? `${productName}로 혼자서도 리턴 연습돼요` : "혼자서도 리턴 연습이 돼요",
          "파트너 없어도 스윙 감각 유지하기 좋아요",
          "거실에서 이렇게 치니까 연습 시간이 늘어요",
          "공이 떨어지니까 집중해서 연습할 수 있어요",
          "실내에서도 이렇게 훈련 루틴 채우기 좋아요",
        ]
        return opts[ruleOffset % opts.length]!
      },
    },
    {
      re: /제품 사용 장면|사용 장면|제품 장면/,
      say: () =>
        buildFallbackNarration(
          `${productName || ""} ${d}`.trim(),
          product,
          ruleOffset
        ),
    },
    {
      re: /보여|확인/,
      say: () => "직접 보면 차이가 느껴져요",
    },
  ]

  for (const { re, say } of rules) {
    const m = d.match(re)
    if (m) return say(m)
  }

  return buildFallbackNarration(d, product, ruleOffset)
}

/** @deprecated rephraseSceneToShoppingNarration 사용 */
export function visualDescriptionToNarrationLine(description: string, productName?: string): string {
  return rephraseSceneToShoppingNarration(description, productName)
}

export function narrationTextForEditSegment(
  seg: EditPlanSegment,
  analysis: VideoAnalysis | undefined,
  productName?: string
): string {
  const dur = Math.max(0.5, seg.output_end - seg.output_start)
  const direct = seg.visual_caption || seg.reason
  if (!analysis) {
    return rephraseSceneToShoppingNarration(direct, productName, dur)
  }
  const card = formatCutVisualCard(
    analysis,
    seg.source_start,
    seg.source_end,
    seg.reason,
    seg.visual_caption
  )
  return rephraseSceneToShoppingNarration(card, productName, dur)
}

const GENERIC_NARRATION =
  /^(이 제품 한번 보세요|제품 디테일 한번 보세요|제품 디테일 보세요|직접 써봤어요|장면|제품 장면|실제로 써보면)/

/** 대본이 비었거나, 중국어·장면설명 그대로·너무 뻔한 문구인지 */
export function narrationTextLooksWeak(text: string, visualHint?: string): boolean {
  const t = text.trim()
  if (!t) return true
  if (looksLikeSceneCardMetadata(t)) return true
  if (descriptionSuggestsPresenterOrFace(t)) return true
  if (/[\u4e00-\u9fff]/.test(t)) return true
  if (narrationContainsEnglishLeak(t)) return true
  if (GENERIC_NARRATION.test(t)) return true
  if (isGenericTemplateNarration(t)) return true
  if (isAbstractShoppingNarration(t)) return true
  if (visualHint && narrationMismatchesVisualProduct(t, visualHint)) return true
  if (visualHint && looksLikeRawSceneCopy(t, visualHint)) return true
  if (looksLikeDescriptiveSceneNarration(t)) return true
  if (narrationLooksIncomplete(t)) return true
  if (narrationPlainCharCount(t) < 8 && !/선풍기|바람|먼지|시트|바닥|포장/.test(t)) return true
  return false
}

function findSceneBlockForMid(
  mid: number,
  blocks: readonly SceneSubtitleBlock[]
): SceneSubtitleBlock | null {
  for (const b of blocks) {
    if (mid >= b.start - 0.06 && mid < b.end + 0.06) return b
  }
  let best: SceneSubtitleBlock | null = null
  let bestOverlap = 0
  for (const b of blocks) {
    const overlap = Math.max(0, Math.min(mid + 0.01, b.end) - Math.max(mid - 0.01, b.start))
    if (overlap > bestOverlap) {
      bestOverlap = overlap
      best = b
    }
  }
  return best
}

/** 병합 sceneSubtitles 블록 → 편집 컷 output 구간에 맞는 텍스트 */
export function bundleTextForOutputRange(
  outputStart: number,
  outputEnd: number,
  blocks: readonly SceneSubtitleBlock[] | undefined
): string {
  if (!blocks?.length) return ""
  const mid = (outputStart + outputEnd) / 2
  const block = findSceneBlockForMid(mid, blocks)
  return block?.text.trim() ?? ""
}

/** 문장/줄 단위로 쪼개 컷 분배용 단위 배열 생성 */
function expandNarrationUnits(text: string): string[] {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length > 1) return lines

  const single = lines[0] || text.trim()
  if (!single) return []

  const sentences = single
    .split(/(?<=[.!?…])\s+|(?<=[요죠네음다][.!?]?)\s+|\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (sentences.length > 1) return sentences

  const clauses = single
    .split(/(?<=,\s*|，\s*|·\s*|;\s*)/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (clauses.length > 1) return clauses

  return [single]
}

/** 가중치 비율로 단위 배열을 N개 컷에 분배 */
function distributeUnitsByWeight(units: readonly string[], partCount: number, weights: number[]): string[] {
  if (partCount <= 1) return [units.join("\n")]
  if (!units.length) return Array(partCount).fill("") as string[]

  const totalWeight = weights.reduce((a, b) => a + b, 0) || partCount
  const counts = weights.map((w) => Math.max(1, Math.round((units.length * w) / totalWeight)))
  let assigned = counts.reduce((a, b) => a + b, 0)
  while (assigned > units.length && counts.some((c) => c > 1)) {
    const maxIdx = counts.indexOf(Math.max(...counts))
    counts[maxIdx]!--
    assigned--
  }
  while (assigned < units.length) {
    const minIdx = counts.indexOf(Math.min(...counts))
    counts[minIdx]!++
    assigned++
  }

  const chunks: string[] = []
  let cursor = 0
  for (let i = 0; i < partCount; i++) {
    if (i === partCount - 1) {
      chunks.push(units.slice(cursor).join("\n"))
    } else {
      const take = counts[i]!
      chunks.push(units.slice(cursor, cursor + take).join("\n"))
      cursor += take
    }
  }
  return chunks
}

/** 완결 문장 단위만 컷에 배분 — 글자 수로 문장 중간 자르기 금지 */
function assignCompleteUnitsToCuts(units: readonly string[], partCount: number): string[] {
  const out = Array.from({ length: partCount }, () => "")
  for (let i = 0; i < Math.min(units.length, partCount); i++) {
    const unit = units[i]!.trim()
    if (unit && !narrationLooksIncomplete(unit)) {
      out[i] = unit
    }
  }
  return out
}

/** 한 scene 블록에 여러 편집 컷이 있을 때 줄·문장 단위로 나눠 앞뒤 흐름 유지 */
export function bundleTextForEditCut(
  cutIndex: number,
  plan: readonly EditPlanSegment[],
  blocks: readonly SceneSubtitleBlock[] | undefined
): string {
  if (!blocks?.length || cutIndex < 0 || cutIndex >= plan.length) return ""
  const seg = plan[cutIndex]!
  const mid = (seg.output_start + seg.output_end) / 2
  const block = findSceneBlockForMid(mid, blocks)
  if (!block) return bundleTextForOutputRange(seg.output_start, seg.output_end, blocks)

  const cutsInBlock: number[] = []
  for (let i = 0; i < plan.length; i++) {
    const s = plan[i]!
    const m = (s.output_start + s.output_end) / 2
    if (m >= block.start - 0.06 && m < block.end + 0.06) cutsInBlock.push(i)
  }
  let full = sanitizeSceneSubtitleText(block.text.trim())
  if (!full || looksLikeSceneCardMetadata(full)) return ""

  if (cutsInBlock.length <= 1) return full

  const pos = cutsInBlock.indexOf(cutIndex)
  if (pos < 0) return full

  const weights = cutsInBlock.map((i) => Math.max(0.5, plan[i]!.output_end - plan[i]!.output_start))
  const units = expandNarrationUnits(full)
  const completeUnits = units.filter((u) => u.trim() && !narrationLooksIncomplete(u.trim()))
  const chunks =
    completeUnits.length >= cutsInBlock.length
      ? distributeUnitsByWeight(completeUnits, cutsInBlock.length, weights)
      : assignCompleteUnitsToCuts(completeUnits.length ? completeUnits : units, cutsInBlock.length)

  const chunk = chunks[pos]?.trim() || ""
  if (!chunk || narrationLooksIncomplete(chunk) || looksLikeSceneCardMetadata(chunk)) return ""
  return chunk
}

function scriptLinesAligned(
  plan: EditPlanSegment[],
  scriptLines?: Array<{ start: number; end: number; text: string }> | null
): scriptLines is Array<{ start: number; end: number; text: string }> {
  return Boolean(scriptLines?.length === plan.length)
}

/** 대본이 장면 설명 그대로 복사된 것인지 (AI 미적용·구버전) */
export function looksLikeRawSceneCopy(scriptText: string, visualHint: string): boolean {
  const script = scriptText.trim()
  const visual = extractVisualDescription(visualHint)
  if (!script || !visual) return false
  if (/^\(\d+(?:\.\d+)?초\)/.test(script)) return true
  const norm = (s: string) => s.replace(/\s+/g, "").replace(/[.,…]/g, "")
  const ns = norm(script)
  const nv = norm(visual)
  if (nv.includes(ns) || ns.includes(nv.slice(0, Math.min(nv.length, ns.length + 4)))) return true
  // 화면 설명 앞부분만 잘린 복사 (차량 시트에 흩어진 음 ← 음식물…)
  if (ns.length >= 6 && nv.startsWith(ns) && ns.length < nv.length * 0.72) return true
  if (script === visual || visual.includes(script)) return true

  const visualCore = visual
    .replace(/하는\s*모습\.?$/i, "")
    .replace(/하는\s*장면\.?$/i, "")
    .replace(/입니다\.?$/i, "")
    .trim()
  const nvCore = norm(visualCore)
  if (nvCore.length >= 8) {
    const prefixLen = Math.min(ns.length, nvCore.length)
    if (prefixLen >= 8 && nvCore.startsWith(ns.slice(0, prefixLen))) return true
    const scriptPrefix = norm(script.split(/[,，]/)[0] ?? script)
    if (scriptPrefix.length >= 8 && nvCore.includes(scriptPrefix.slice(0, Math.min(scriptPrefix.length, 12)))) {
      return true
    }
  }

  if (/먼지가\s*바로\s*빠져요|이렇게\s*빨아들여요|이렇게\s*빼낼\s*수\s*있어요/.test(script)) {
    const scriptLead = norm(script.split(/[,，]/)[0] ?? "")
    if (scriptLead.length >= 6 && nv.includes(scriptLead.slice(0, Math.min(scriptLead.length, 14)))) {
      return true
    }
  }

  const visualTokens = (visualCore.match(/[\uac00-\ud7a3]{2,}/g) ?? []).filter(
    (w) => !/모습|장면|청소|합니다|있습니다/.test(w)
  )
  if (visualTokens.length >= 2) {
    const scriptFlat = script.replace(/\n/g, " ")
    const overlap = visualTokens.filter((w) => scriptFlat.includes(w)).length
    if (overlap >= 2 && overlap / visualTokens.length >= 0.55) return true
  }
  return false
}

function applyCutFlowHint(
  text: string,
  cutIndex: number,
  _totalCuts: number,
  sceneMeta?: CutNarrationSceneMeta,
  priorInGroup?: string
): string {
  const t = text.trim()
  if (!sceneMeta?.isRepeat || sceneMeta.occurrence <= 1 || !priorInGroup?.trim()) return t
  if (!narrationLineIsDuplicateOfPrior(t, [priorInGroup]) && narrationBlockSimilarity(t, priorInGroup) < 0.5) {
    return t
  }
  return narrationForRepeatedScene({
    occurrence: sceneMeta.occurrence,
    groupSize: sceneMeta.groupSize,
    productBenefitHint: sceneMeta.productBenefitHint,
    priorInGroup,
    visualHint: sceneMeta.enrichedVisual,
    cutIndex,
  })
}

export { buildCutNarrationSceneMetas }

/** 짜집기 편집 컷 = 나레이션 구간 1:1 */
export function buildNarrationSegmentsFromEditPlan(
  editPlan: EditPlan,
  analyses: VideoAnalysis[],
  scriptLines?: Array<{ start: number; end: number; text: string }> | null,
  productName?: string,
  bundleScenes?: readonly SceneSubtitleBlock[] | null
): NarrationSegment[] {
  const plan = editPlan.edit_plan
  if (!plan.length) return []

  const safeProductName = sanitizeProductNameForNarration(productName, {
    analysisTitles: analyses.map((a) => a.title),
  })

  const byId = analysisByVideoId(analyses)
  const aligned = scriptLinesAligned(plan, scriptLines)
  const priorTexts: string[] = []
  const cutContexts = plan.map((seg, i) => {
    const analysis = byId.get(seg.video_id)
    const visual_card = analysis
      ? formatCutVisualCard(
          analysis,
          seg.source_start,
          seg.source_end,
          visualSceneForSourceRange(analysis, seg.source_start, seg.source_end)?.description || seg.reason
        )
      : seg.reason
    return {
      index: i + 1,
      output_start: seg.output_start,
      output_end: seg.output_end,
      duration: Math.round((seg.output_end - seg.output_start) * 10) / 10,
      video_id: seg.video_id,
      source_start: seg.source_start,
      source_end: seg.source_end,
      visual_card,
      reason: seg.reason,
    }
  })
  const sceneMetas = buildCutNarrationSceneMetas(cutContexts, {
    keywords: productName ? [productName] : undefined,
  })
  const groupLast = new Map<number, string>()

  return plan.map((seg, i) => {
    const dur = Math.max(0.5, seg.output_end - seg.output_start)
    const analysis = byId.get(seg.video_id)
    const visualHint = analysis
      ? formatCutVisualCard(
          analysis,
          seg.source_start,
          seg.source_end,
          visualSceneForSourceRange(analysis, seg.source_start, seg.source_end)?.description || seg.reason
        )
      : seg.reason
    const fromVisual = narrationTextForEditSegment(seg, analysis, safeProductName)
    const fromBundle = bundleTextForEditCut(i, plan, bundleScenes ?? undefined)
    const rawScript = aligned ? scriptLines![i]!.text.trim() : ""
    const scriptUsable =
      Boolean(rawScript) &&
      !looksLikeRawSceneCopy(rawScript, visualHint) &&
      !isGenericTemplateNarration(rawScript) &&
      !narrationTextLooksWeak(rawScript, visualHint) &&
      !narrationLooksIncomplete(rawScript.replace(/\n/g, " "))
    const bundleUsable =
      Boolean(fromBundle) &&
      !isGenericTemplateNarration(fromBundle) &&
      !narrationTextLooksWeak(fromBundle, visualHint) &&
      !narrationLooksIncomplete(fromBundle.replace(/\n/g, " "))

    const fromScript = scriptUsable
      ? formatNarrationForSceneDuration(rawScript, dur)
      : bundleUsable
        ? formatNarrationForSceneDuration(fromBundle, dur)
        : ""

    let preferred = fromScript || fromVisual
    if (!fromScript && !isGenericTemplateNarration(preferred)) {
      preferred = applyCutFlowHint(
        preferred,
        i,
        plan.length,
        sceneMetas[i],
        groupLast.get(sceneMetas[i]!.groupId)
      )
    }
    if (
      looksLikeSceneCardMetadata(preferred) ||
      isGenericTemplateNarration(preferred) ||
      narrationTextLooksWeak(preferred, visualHint)
    ) {
      preferred = ""
    }

    const text = pickUniqueNarrationLine({
      visualHint: sceneMetas[i]!.enrichedVisual || visualHint,
      productName: safeProductName,
      duration: dur,
      cutIndex: i,
      priorLines: priorTexts,
      preferred,
      sceneMeta: sceneMetas[i],
      priorInGroup: groupLast.get(sceneMetas[i]!.groupId),
    })
    priorTexts.push(text)
    groupLast.set(sceneMetas[i]!.groupId, text)

    return {
      start: seg.output_start,
      end: seg.output_end,
      text,
    }
  })
}

export function cutVisualHintForSegment(
  seg: EditPlanSegment,
  analysis: VideoAnalysis | undefined
): string {
  if (!analysis) return seg.reason
  const sc = visualSceneForSourceRange(analysis, seg.source_start, seg.source_end)
  return formatCutVisualCard(analysis, seg.source_start, seg.source_end, sc?.description || seg.reason)
}

export function needsAiNarrationFromScenes(
  result: Pick<
    AutoEditJobResult,
    "editPlan" | "script" | "analyses" | "analysis" | "productAnalysis"
  >,
  scriptOverrides: Record<string, string>
): boolean {
  if (Object.keys(scriptOverrides).length > 0) return false

  const plan = result.editPlan?.edit_plan
  if (!plan?.length) return false

  const analyses = result.analyses?.length ? result.analyses : result.analysis ? [result.analysis] : []
  const byId = analysisByVideoId(analyses)
  const bundleScenes = result.script?.bundle?.sceneSubtitles?.conversion
  const scriptLines = result.script?.script

  const segments = buildNarrationSegmentsFromEditPlan(
    result.editPlan!,
    analyses,
    scriptLines,
    result.productAnalysis?.productName,
    bundleScenes
  )

  if (!scriptLines?.length || scriptLines.length !== plan.length) return true

  const texts = segments.map((s) => s.text.trim())
  if (plan.length >= 2 && new Set(texts).size === 1) return true

  if (hasExcessiveScriptRepetition(texts)) return true

  return segments.some((seg, i) => {
    const hint = cutVisualHintForSegment(plan[i]!, byId.get(plan[i]!.video_id))
    if (isGenericTemplateNarration(seg.text)) return true
    if (narrationTextLooksWeak(seg.text, hint)) return true
    const dur = Math.max(0.5, seg.end - seg.start)
    if (dur > 3 && !seg.text.includes("\n") && narrationPlainCharCount(seg.text) > 12) return true
    return false
  })
}
