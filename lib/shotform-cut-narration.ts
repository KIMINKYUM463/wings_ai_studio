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
} from "@/lib/shotform-narration-similarity"
import { descriptionSuggestsPresenterOrFace } from "@/lib/shotform-auto-edit-product-filter"
import {
  analysisByVideoId,
  formatCutVisualCard,
  visualSceneForSourceRange,
} from "@/lib/shotform-visual-scene-match"

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
] as const

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
  const hasConcreteVisual =
    /먼지|청소|흡입|시트|바닥|노즐|필터|차|구석|틈새|매트|진공|닦|빨아|제거|정리/.test(t)
  if (/^(이|그)\s*(포인트|부분)/.test(t) && !hasConcreteVisual) return true
  if (/해결하세요|놓치면 아쉬워|핵심이에요|만족할 거예요|손이 가요/.test(t) && !hasConcreteVisual) {
    return true
  }
  return false
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
  const product = productName?.trim() || "이 제품"

  const pools: string[][] = []

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
  if (/차량|차\s*안|자동차|시트|운전석|바닥|車|车载|car/i.test(d)) {
    pools.push([
      "차 시트 틈새 먼지도 이렇게 빨아들여요",
      "바닥 매트에 낀 먼지, 한 번에 흡입돼요",
      "차 안 구석 먼지 관리가 이렇게 쉬워요",
      "좁은 틈새도 노즐로 싹 정리돼요",
      "운전석 발밑 먼지, 손 안 대고 빼내요",
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
      product ? `${product}, 이 장면에서 체감이 확 와요` : "이 장면에서 체감이 확 와요",
      product ? `${product} 쓰는 모습, 생각보다 실용적이에요` : "쓰는 모습, 생각보다 실용적이에요",
    ])
  }

  const flat = pools.flat()
  return flat[ruleOffset % flat.length]!
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
  const fallbacks = productName
    ? [
        `${productName}, 이렇게 쓰면 편해요`,
        `${productName} 포인트가 확실해요`,
        `${productName} 실사용이 이렇게예요`,
        `${productName}, 써보니 생각보다 달라요`,
        `${productName}로 공간이 깔끔해져요`,
        `${productName}, 이 부분이 마음에 들어요`,
      ]
    : [
        "이렇게 쓰면 편해요",
        "실사용 장면이에요",
        "이 포인트가 꽤 확실해요",
        "써보니 생각보다 다르더라고요",
        "이렇게 활용하면 깔끔해요",
        "보는 것보다 직접 쓰면 와닿아요",
      ]
  return fallbacks[ruleOffset % fallbacks.length]!
}

/** 컷마다 절대 중복되지 않는 나레이션 선택 */
export function pickUniqueNarrationLine(args: {
  visualHint: string
  productName?: string
  duration: number
  cutIndex: number
  priorLines: readonly string[]
  preferred?: string
}): string {
  const { visualHint, productName, duration, cutIndex, priorLines, preferred } = args
  const isDup = (t: string) => narrationLineIsDuplicateOfPrior(t, priorLines)

  const prefer = preferred?.trim()
  if (prefer && !isDup(prefer) && !isAbstractShoppingNarration(prefer)) {
    const fitted = formatNarrationForSceneDuration(prefer, duration)
    if (fitted && !narrationLooksIncomplete(fitted.replace(/\n/g, " "))) {
      return fitted
    }
  }

  for (let attempt = 0; attempt < 36; attempt++) {
    const candidate = rephraseSceneToShoppingNarrationVariant(
      visualHint,
      productName,
      duration,
      cutIndex * 13 + attempt * 9 + 1
    )
    if (!isDup(candidate) && !isAbstractShoppingNarration(candidate)) {
      return candidate
    }
  }

  return formatNarrationForSceneDuration(
    rephraseSceneToShoppingNarrationVariant(visualHint, productName, duration, cutIndex * 41 + priorLines.length * 7),
    duration
  )
}

function rephraseSceneCore(description: string, productName?: string, ruleOffset = 0): string {
  let d = stripSceneMeta(extractVisualDescription(description))
  if (
    descriptionSuggestsPresenterOrFace(description) ||
    descriptionSuggestsPresenterOrFace(d)
  ) {
    return productNarrationFallback(productName, ruleOffset)
  }
  if (!d || d === "장면" || d === "제품 장면") {
    return productNarrationFallback(productName, ruleOffset)
  }

  const rules: Array<{ re: RegExp; say: (m: RegExpMatchArray) => string }> = [
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
      re: /차량\s*바닥|바닥.*먼지|매트/,
      say: () => {
        const opts = [
          "바닥 매트 먼지, 이렇게 싹 빨아들여요",
          "발밑 먼지까지 한 번에 정리돼요",
          "차 바닥 청소, 생각보다 빨라요",
        ]
        return opts[ruleOffset % opts.length]!
      },
    },
    {
      re: /차량\s*내부|차\s*안|운전석|시트|車内/,
      say: () => {
        const opts = [
          "차 안 틈새 먼지도 이렇게 빼낼 수 있어요",
          "시트 사이 먼지, 손 안 대고 정리돼요",
          "차량 내부 청소가 이렇게 간단해요",
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
        ]
        return opts[ruleOffset % opts.length]!
      },
    },
    {
      re: /(.+?)을?\s*청소하는/,
      say: (m) => {
        const sub = m[1]!.trim()
        if (descriptionSuggestsPresenterOrFace(sub)) {
          return productName ? `${productName}로 먼지가 싹 빨려 들어가요` : "먼지가 싹 빨려 들어가요"
        }
        return `${sub} 청소, 먼지가 바로 빠져요`
      },
    },
    {
      re: /(.+?)을?\s*청소/,
      say: (m) => {
        const sub = m[1]!.trim()
        if (descriptionSuggestsPresenterOrFace(sub)) {
          return productName ? `${productName}로 구석 먼지까지 정리돼요` : "구석 먼지까지 정리돼요"
        }
        return `${sub} 먼지, 이렇게 빨아들여요`
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
          `${productName || ""} 차량 바닥 먼지 청소 흡입`,
          productName,
          ruleOffset
        ),
    },
    {
      re: /보여|확인/,
      say: () => "직접 보면 차이가 느껴져요",
    },
  ]

  const matched: string[] = []
  for (const { re, say } of rules) {
    const m = d.match(re)
    if (m) matched.push(say(m))
  }
  if (matched.length) return matched[ruleOffset % matched.length]!

  return buildFallbackNarration(d, productName, ruleOffset)
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
  if (GENERIC_NARRATION.test(t)) return true
  if (isGenericTemplateNarration(t)) return true
  if (visualHint && looksLikeRawSceneCopy(t, visualHint)) return true
  if (looksLikeDescriptiveSceneNarration(t)) return true
  if (narrationLooksIncomplete(t)) return true
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
  return script === visual || visual.includes(script)
}

function applyCutFlowHint(text: string, _cutIndex: number, _totalCuts: number): string {
  return text.trim()
}

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

  const byId = analysisByVideoId(analyses)
  const aligned = scriptLinesAligned(plan, scriptLines)
  const priorTexts: string[] = []

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
    const fromVisual = narrationTextForEditSegment(seg, analysis, productName)
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
      preferred = applyCutFlowHint(preferred, i, plan.length)
    }
    if (
      looksLikeSceneCardMetadata(preferred) ||
      isGenericTemplateNarration(preferred) ||
      narrationTextLooksWeak(preferred, visualHint)
    ) {
      preferred = ""
    }

    const text = pickUniqueNarrationLine({
      visualHint,
      productName,
      duration: dur,
      cutIndex: i,
      priorLines: priorTexts,
      preferred,
    })
    priorTexts.push(text)

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
