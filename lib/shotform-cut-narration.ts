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
import { applyFlowRhythmToLine } from "@/lib/shotform-narration-flow-rhythm"
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
import { buildCutNarrationSceneMetas } from "@/lib/shotform-narration-scene-groups"
import { sanitizeNarrationForOutput } from "@/lib/shotform-natural-shorts-script"
import { isRepeatMetaNarration, isToothbrushHolderProduct } from "@/lib/shotform-shopping-visual-cues"
import { actionScriptTextForSourceRange } from "@/lib/shotform-scene-understanding"
import { PRECISION_SCRIPT_TONE } from "@/lib/shotform-auto-edit-precision-script"
import {
  detectObviousProductCategoryLeak,
  isAquariumFishTankProduct,
  isCarMountOrHolderProduct,
  isFurnitureSofaProduct,
} from "@/lib/shotform-user-keyword-product"

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
  /몇\s*번\s*봐도/,
  /아까\s*말한/,
  /반복\s*봐도/,
  /이어서\s*보면/,
  /이\s*화면에서도\s*그대로/,
  /포인트,?\s*이\s*화면에서도/,
  /또\s*나와도/,
  /여러\s*번\s*확인해도/,
  /같은\s*제품인데/,
  /꾸준히\s*느껴져요/,
  /색감이\s*깔끔해서\s*선물용/,
  /방금\s*그\s*.+?,?\s*여기서도/,
  /앞\s*장면\s*이어서\s*보면/,
  /반복\s*장면/,
  /다른\s*컷/,
  /각도\s*조절\s*포인트/,
  /정리\s*포인트/,
  /디자인\s*포인트/,
  /포인트는\s*같/,
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

  const mountProduct =
    /거치대|홀더|마운트|브라켓|holder|mount|대시보드|스마트폰\s*거치|휴대폰\s*거치/i.test(
      `${userKw.join(" ")} ${blob}`
    )
  if (mountProduct) {
    const mountLabel =
      userKw.find((k) => /거치|홀더|마운트|holder|mount/i.test(k)) ||
      (/\uac00-\ud7a3/.test(blob) && /거치대|홀더/.test(blob) ? "차량용 거치대" : userKw[0])
    if (mountLabel?.trim()) {
      return mountLabel.trim().length > 56 ? `${mountLabel.trim().slice(0, 53)}…` : mountLabel.trim()
    }
  }

  // 키워드 없을 때만 화면·분석 힌트로 제품 추론
  if (/마우스\s*패드|mouse\s*pad|게이밍\s*패드|데스크\s*매트|keyboard|키보드|gaming|RGB|LED/i.test(blob)) {
    return "게이밍 마우스 패드"
  }
  if (/선풍기|风扇|fan|쿨링/i.test(blob)) return "미니 선풍기"
  if (
    /먼지|흡입|吸尘|vacuum|진공\s*청소|핸디\s*청소/i.test(blob) &&
    !/거치대|홀더|마운트|holder|mount|대시보드/i.test(blob)
  ) {
    if (/차량|차\s*안|자동차|车载|車/i.test(blob)) return "차량용 핸디청소기"
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
  if (/칫솔|牙刷|전동칫솔/i.test(blob)) {
    if (/거치대|꽂|스탠드|홀더|벽걸이|수납|정리/i.test(blob)) return "칫솔 거치대"
    return "전동칫솔"
  }
  if (/배드민턴|셔틀콕|라켓/i.test(blob)) return "배드민턴 훈련기"
  if (/프로젝터|스크린|티비|TV/i.test(blob)) return "홈시어터 스크린"
  if (/어항|수조|鱼缸|aquarium|fish\s*tank/i.test(blob)) {
    const fromKw = userKw.find((k) => /어항|수조/i.test(k))
    if (fromKw) return fromKw
    return "미니 어항"
  }

  if (koreanInRaw >= 1) return raw
  return undefined
}

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
    /먼지|청소|흡입|시트|바닥|노즐|필터|차|구석|틈새|매트|진공|닦|빨아|제거|정리|선풍기|바람|포장|가방|손바닥|휴대|욕실|세면대|거치대|수납|꽂|벽걸이|퍼즐|칫솔|책상|컵/.test(
      t
    )
  if (/포인트/.test(t)) return true
  if (/설치가 (이렇게 )?간편|사용이 이렇게 간|완벽하게 작동|클릭만 하면|모든 것이 해결/.test(t)) return true
  if (/^(이|그)\s*(부분)/.test(t) && !hasConcreteVisual) return true
  if (/해결하세요|놓치면 아쉬워|핵심이에요|만족할 거예요|손이 가요|체감이\s*확\s*와요/.test(t) && !hasConcreteVisual) {
    return true
  }
  if (t.length <= 10 && /^(실용|편|좋|쉬|가벼|시원|깔끔)적?이에요$/.test(t)) return true
  if (isRepeatMetaNarration(t)) return true
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

/** 청소기·차량 대본이 마우스패드 등 다른 제품 화면에 붙은 경우 */
export function narrationMismatchesVisualProduct(
  text: string,
  visualCard: string,
  userKeywords?: readonly string[]
): boolean {
  const script = text.trim().replace(/\n/g, " ")
  const visual = extractVisualDescription(visualCard)
  if (!script || !visual) return false

  if (userKeywords?.length && detectObviousProductCategoryLeak([script], userKeywords).length) {
    return true
  }
  const kwBlob = userKeywords?.join(" ") || ""
  if (isFurnitureSofaProduct(kwBlob) && /핸들|그립|손잡|손에\s*쥐|노즐|흡입|먼지|청소기|진공|차\s*안|운전/.test(script)) {
    return true
  }
  if (isAquariumFishTankProduct(kwBlob) && /차량|차\s*안|트렁크|운전|시트|노즐|흡입|먼지|청소기|진공|부속품|브러시|휴대\s*케이스|바닥\s*매트|대시보드|핸들/.test(script)) {
    return true
  }
  if (isCarMountOrHolderProduct(kwBlob) && /흡입|먼지|노즐|빨아|진공|청소기|몰입감|영화관|프로젝터/.test(script)) {
    return true
  }

  const vacuumScript =
    /흡입|먼지가\s*바로\s*빠져|노즐|핸들\s*주변\s*먼지|차\s*안|시트.*먼지|진공|청소기/.test(script)
  const mouseVisual = /마우스\s*패드|mouse\s*pad|게이밍|keyboard|키보드|RGB|LED|책상|데스크\s*매트/i.test(visual)
  if (vacuumScript && mouseVisual) return true

  const fanScript = /선풍기|바람\s*세기|휴대용\s*느낌|언박싱하니/.test(script)
  const carVisual = /차량|차\s*안|운전석|시트|바닥\s*매트|트렁크/i.test(visual)
  if (fanScript && carVisual) return true

  const brushingScript = /입안이\s*개운|치아\s*사이|플라크|칫솔질|닦으면/.test(script)
  const holderVisual = /거치대|꽂|벽에\s*걸|퍼즐|수납|정리/i.test(visual)
  const holderProduct = isToothbrushHolderProduct(script)
  if (brushingScript && (holderVisual || holderProduct)) return true

  const giftScript = /선물용|색감이\s*깔끔/.test(script)
  if (giftScript && holderProduct && /칫솔|거치대|욕실|세면대/i.test(visual)) return true

  return false
}

/** @deprecated 규칙 기반 생성 제거 — AI 대본만 사용 */
export function rephraseSceneToShoppingNarration(
  _description: string,
  _productName?: string,
  _sceneDurationSec = 5,
  _userKeywords?: readonly string[]
): string {
  return ""
}

/** @deprecated 규칙 기반 생성 제거 — AI 대본만 사용 */
export function rephraseSceneToShoppingNarrationVariant(
  _description: string,
  _productName?: string,
  _sceneDurationSec = 5,
  _variantIndex = 0,
  _userKeywords?: readonly string[]
): string {
  return ""
}

/** AI·스크립트에서 온 preferred만 통과 — 규칙 폴백 없음 */
export function pickUniqueNarrationLine(args: {
  visualHint: string
  productName?: string
  duration: number
  cutIndex: number
  priorLines: readonly string[]
  preferred?: string
  sceneMeta?: CutNarrationSceneMeta
  priorInGroup?: string
  userKeywords?: readonly string[]
}): string {
  const { visualHint, duration, priorLines, preferred, userKeywords } = args
  const isDup = (t: string) =>
    narrationLineIsDuplicateOfPrior(t, priorLines) ||
    priorLines.some((p) => narrationSharesRepeatedPhrase(p, t)) ||
    looksLikeRawSceneCopy(t, visualHint) ||
    narrationMismatchesVisualProduct(t, visualHint, userKeywords)

  const prefer = preferred?.trim()
  if (!prefer) return ""
  if (isDup(prefer) || isAbstractShoppingNarration(prefer)) return ""
  const fitted = formatNarrationForSceneDuration(wrapNarrationShortLines(prefer, duration), duration)
  if (!fitted || narrationLooksIncomplete(fitted.replace(/\n/g, " "))) return ""
  return fitted
}

function rephraseSceneCore(
  _description: string,
  _productName?: string,
  _ruleOffset = 0,
  _userKeywords?: readonly string[]
): string {
  return ""
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
  if (analysis) {
    const fromAction = actionScriptTextForSourceRange(analysis, seg.source_start, seg.source_end)
    if (fromAction && !isGenericTemplateNarration(fromAction) && !narrationTextLooksWeak(fromAction)) {
      return formatNarrationForSceneDuration(fromAction, dur)
    }
  }
  return ""
}

const GENERIC_NARRATION =
  /^(이 제품 한번 보세요|제품 디테일 한번 보세요|제품 디테일 보세요|직접 써봤어요|장면|제품 장면|실제로 써보면)/

/** 대본이 비었거나, 중국어·장면설명 그대로·너무 뻔한 문구인지 */
export function narrationTextLooksWeak(
  text: string,
  visualHint?: string,
  userKeywords?: readonly string[]
): boolean {
  const t = text.trim()
  if (!t) return true
  if (looksLikeSceneCardMetadata(t)) return true
  if (descriptionSuggestsPresenterOrFace(t)) return true
  if (/[\u4e00-\u9fff]/.test(t)) return true
  if (narrationContainsEnglishLeak(t)) return true
  if (GENERIC_NARRATION.test(t)) return true
  if (isGenericTemplateNarration(t)) return true
  if (isAbstractShoppingNarration(t)) return true
  if (userKeywords?.length && detectObviousProductCategoryLeak([t], userKeywords).length) return true
  if (visualHint && narrationMismatchesVisualProduct(t, visualHint, userKeywords)) return true
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
  _cutIndex: number,
  _totalCuts: number,
  _sceneMeta?: CutNarrationSceneMeta,
  _priorInGroup?: string
): string {
  return text.trim()
}

export { buildCutNarrationSceneMetas }

/** 짜집기 편집 컷 = 나레이션 구간 1:1 */
export function buildNarrationSegmentsFromEditPlan(
  editPlan: EditPlan,
  analyses: VideoAnalysis[],
  scriptLines?: Array<{ start: number; end: number; text: string }> | null,
  productName?: string,
  bundleScenes?: readonly SceneSubtitleBlock[] | null,
  userKeywords?: readonly string[]
): NarrationSegment[] {
  const plan = editPlan.edit_plan
  if (!plan.length) return []

  const safeProductName = sanitizeProductNameForNarration(productName, {
    analysisTitles: analyses.map((a) => a.title),
    userKeywords,
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
    keywords: userKeywords?.length ? [...userKeywords] : productName ? [productName] : undefined,
  }, analyses)
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
    const fromAction =
      analysis && !aligned
        ? actionScriptTextForSourceRange(analysis, seg.source_start, seg.source_end)
        : ""
    const actionUsable =
      Boolean(fromAction) &&
      !looksLikeRawSceneCopy(fromAction, visualHint) &&
      !isGenericTemplateNarration(fromAction) &&
      !narrationTextLooksWeak(fromAction, visualHint, userKeywords) &&
      !narrationLooksIncomplete(fromAction.replace(/\n/g, " "))
    const fromBundle = bundleTextForEditCut(i, plan, bundleScenes ?? undefined)
    const rawScript = aligned ? scriptLines![i]!.text.trim() : ""
    const scriptUsable =
      Boolean(rawScript) &&
      !looksLikeRawSceneCopy(rawScript, visualHint) &&
      !isGenericTemplateNarration(rawScript) &&
      !narrationTextLooksWeak(rawScript, visualHint, userKeywords) &&
      !narrationLooksIncomplete(rawScript.replace(/\n/g, " "))
    const bundleUsable =
      Boolean(fromBundle) &&
      !isGenericTemplateNarration(fromBundle) &&
      !narrationTextLooksWeak(fromBundle, visualHint, userKeywords) &&
      !narrationLooksIncomplete(fromBundle.replace(/\n/g, " "))

    const fromScript = scriptUsable
      ? formatNarrationForSceneDuration(rawScript, dur)
      : actionUsable
        ? formatNarrationForSceneDuration(fromAction, dur)
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
      narrationTextLooksWeak(preferred, visualHint, userKeywords)
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
      userKeywords,
    })
    priorTexts.push(text)
    groupLast.set(sceneMetas[i]!.groupId, text)

    return {
      start: seg.output_start,
      end: seg.output_end,
      text: applyFlowRhythmToLine(text, i, plan.length),
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
  if (result.script?.tone === PRECISION_SCRIPT_TONE && result.script.bundle?.sceneSubtitles?.conversion?.length) {
    return false
  }

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
    bundleScenes,
    result.productAnalysis?.targetKeywords
  )

  if (!scriptLines?.length || scriptLines.length !== plan.length) return true

  const texts = segments.map((s) => s.text.trim())
  if (plan.length >= 2 && new Set(texts).size === 1) return true

  if (hasExcessiveScriptRepetition(texts)) return true

  return segments.some((seg, i) => {
    const hint = cutVisualHintForSegment(plan[i]!, byId.get(plan[i]!.video_id))
    if (!seg.text.trim()) return true
    if (isGenericTemplateNarration(seg.text)) return true
    if (narrationTextLooksWeak(seg.text, hint)) return true
    const dur = Math.max(0.5, seg.end - seg.start)
    if (dur > 3 && !seg.text.includes("\n") && narrationPlainCharCount(seg.text) > 12) return true
    return false
  })
}
