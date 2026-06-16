import {
  extractVisualDescription,
  formatSceneDescriptionHint,
  isAbstractShoppingNarration,
  isGenericTemplateNarration,
  looksLikeDescriptiveSceneNarration,
  looksLikeRawSceneCopy,
  narrationMismatchesVisualProduct,
  narrationTextLooksWeak,
  pickUniqueNarrationLine,
  rephraseSceneToShoppingNarration,
  rephraseSceneToShoppingNarrationVariant,
  sanitizeProductNameForNarration,
} from "@/lib/shotform-cut-narration"
import {
  formatNarrationForSceneDuration,
  maxCharsForSceneDuration,
  narrationLooksIncomplete,
} from "@/lib/shotform-narration-timing"
import { applyFlowRhythmToScript } from "@/lib/shotform-narration-flow-rhythm"
import {
  mitigateProductNameSpam,
  NARRATION_PRODUCT_NAME_USAGE_RULE,
} from "@/lib/shotform-narration-script-audit"
import type { CutScriptContext } from "@/lib/shotform-visual-scene-match"
import { sanitizeNarrationForOutput } from "@/lib/shotform-natural-shorts-script"
import type { CutNarrationSceneMeta } from "@/lib/shotform-narration-scene-groups"
import { narrationForRepeatedScene } from "@/lib/shotform-narration-scene-groups"
import { isRepeatMetaNarration } from "@/lib/shotform-shopping-visual-cues"
import {
  hasExcessiveScriptRepetition,
  narrationBlockSimilarity,
  narrationLineIsDuplicateOfPrior,
  narrationSharesRepeatedPhrase,
} from "@/lib/shotform-narration-similarity"

const CLICHE_PATTERNS = [
  /직접 써봤어요/,
  /한번 보세요/,
  /이 제품 한번/,
  /제품 디테일/,
  /실제로 써보면 이렇게 편해요/,
  /직접 보면 차이가/,
  /생각보다 편해요/,
  /이렇게 쉬워요/,
  /이렇게 편해요/,
  /몇\s*번\s*봐도/,
  /아까\s*말한/,
  /이어서\s*보면/,
  /이\s*화면에서도\s*그대로/,
  /또\s*나와도/,
  /색감이\s*깔끔해서\s*선물용/,
  /입안이\s*개운/,
  /치아\s*사이까지/,
] as const

const CONTINUITY_CONNECTORS =
  /^(그래서|그리고|여기서|이어서|이렇게|바로|근데|자|그다음|다음엔|이제|그럼|또|게다가)\s/

const LEADING_CONNECTOR_RE =
  /^(그래서|그리고|여기서|이어서|이렇게|바로|근데|자|그다음|이제)\s+/

/** 문장 앞 연결어 제거 */
export function stripLeadingNarrationConnector(text: string): string {
  let t = text.trim()
  if (!t) return t
  const lines = t.split("\n").map((line) => line.trim()).filter(Boolean)
  if (!lines.length) return t
  lines[0] = lines[0]!.replace(LEADING_CONNECTOR_RE, "")
  return lines.join("\n")
}

/** 컷 전체에서 연결어 남발 완화 — 최대 약 20%만 허용 */
export function limitConnectorsAcrossScript(lines: readonly string[]): string[] {
  if (lines.length <= 2) {
    return lines.map((line, i) => (i === 0 ? stripLeadingNarrationConnector(line) : line))
  }
  const maxWithConnector = Math.max(1, Math.floor(lines.length * 0.2))
  let connectorCount = 0
  return lines.map((line, i) => {
    if (i === 0) return stripLeadingNarrationConnector(line)
    const first = line.split("\n").map((l) => l.trim()).find(Boolean) ?? ""
    if (!LEADING_CONNECTOR_RE.test(first)) return line
    connectorCount++
    if (connectorCount > maxWithConnector) {
      return stripLeadingNarrationConnector(line)
    }
    return line
  })
}

const SCENE_RESET_PATTERNS = [
  /^이 제품/,
  /^제품 디테일/,
  /^실제로 써보면/,
  /^직접 보면/,
  /^한번 보세요/,
  /^직접 써봤/,
  /^장면/,
] as const

const FLOW_STOPWORDS = new Set([
  "그리고",
  "여기서",
  "이렇게",
  "바로",
  "근데",
  "그래서",
  "이어서",
  "이제",
  "정말",
  "진짜",
  "완전",
  "너무",
  "이거",
  "이건",
  "저거",
  "있어요",
  "해요",
  "돼요",
  "되요",
  "편해요",
  "좋아요",
  "쉬워요",
])

const VISUAL_THEME_RULES: Array<{ re: RegExp; theme: string; keywords: string[] }> = [
  { re: /흡입|吸尘|vacuum|먼지|灰尘/, theme: "흡입", keywords: ["흡입", "빨아", "먼지", "쓸어", "싹"] },
  { re: /필터|filter|세척|水洗|清洗/, theme: "필터", keywords: ["필터", "세척", "물", "쓱", "헹"] },
  { re: /송풍|吹风|blow/, theme: "송풍", keywords: ["송풍", "바람", "시원", "불어"] },
  { re: /노즐|吸嘴|喷嘴|tip/, theme: "노즐", keywords: ["노즐", "틈새", "구석", "끝"] },
  { re: /차|车|운전|seat|시트/, theme: "차량", keywords: ["차", "시트", "운전", "차안", "필수템"] },
  { re: /펼치|展开|fold|접/, theme: "펼침", keywords: ["펼치", "접", "보관", "휴대", "컴팩트"] },
  { re: /버튼|按|누르|작동|开关/, theme: "작동", keywords: ["버튼", "작동", "켜", "한 번", "바로"] },
  { re: /선풍기|风扇|fan|미니|휴대|바람|쿨링/, theme: "선풍기", keywords: ["선풍기", "바람", "시원", "휴대", "손바닥", "가방"] },
  {
    re: /마우스\s*패드|mouse\s*pad|게이밍|keyboard|키보드|RGB|LED|데스크\s*매트/i,
    theme: "마우스패드",
    keywords: ["마우스", "패드", "게이밍", "키보드", "책상", "손목"],
  },
  { re: /포장|언박싱|unboxing|开箱/, theme: "포장", keywords: ["포장", "개봉", "언박싱", "사이즈", "색감"] },
  { re: /칫솔|치아|牙刷|电动牙刷|전동칫솔|거치대|꽂|벽걸이|퍼즐/, theme: "칫솔수납", keywords: ["칫솔", "거치대", "욕실", "세면대", "정리", "꽂"] },
  { re: /수납|정리|거치|홀더|organiz|收纳|컵|필기구/, theme: "수납", keywords: ["수납", "정리", "거치", "한곳", "깔끔"] },
  { re: /투사|스크린|프로젝터|TV|티비|설치|screen/, theme: "스크린", keywords: ["스크린", "설치", "투사", "몰입", "영화"] },
  { re: /틈새|缝隙|좁|缝/, theme: "틈새", keywords: ["틈새", "좁", "구석", "사이", "끝"] },
  { re: /보여|展示|확인|特写|클로즈/, theme: "디테일", keywords: ["디테일", "확인", "보", "눈", "직접"] },
  { re: /LED|디스플레이|화면|스크린|彩屏|显示屏|screen|곡면/, theme: "디스플레이", keywords: ["화면", "LED", "선명", "몰입", "야외"] },
  { re: /월드컵|경기|중계|스포츠/, theme: "경기", keywords: ["경기", "중계", "현장", "몰입", "관람"] },
  {
    re: /배드민턴|셔틀콕|라켓|훈련기|badminton|shuttle/i,
    theme: "배드민턴",
    keywords: ["배드민턴", "라켓", "셔틀콕", "연습", "리턴", "혼자"],
  },
]

const OPENING_HOOK_POOLS: Array<{ re: RegExp; hooks: string[] }> = [
  {
    re: /배드민턴|셔틀콕|라켓|훈련기/i,
    hooks: [
      "파트너 없어도 이렇게 연습된다고요?",
      "이거 몰랐으면 연습 시간만 날렸어요",
      "거실에서 혼자 치는데 리턴 연습이 돼요",
      "연습할 사람 없을 때 이게 제일 먼저 떠올라요",
    ],
  },
  {
    re: /선풍기|fan|미니|휴대/i,
    hooks: [
      "이거 몰랐으면 여름에 손만 더 땀났을 것 같아요",
      "손바닥만 한 선풍기, 바람이 이렇게 세다고요?",
      "가방에 쏙 들어가는 선풍기 찾으셨죠?",
    ],
  },
  {
    re: /청소|먼지|흡입|吸尘/i,
    hooks: [
      "이거 몰라서 청소 시간만 늘었어요",
      "구석 먼지, 이렇게 빨아들이는 거 있더라고요",
      "와, 이 정도면 손이 안 놀아요",
    ],
  },
  {
    re: /칫솔|거치대|욕실|세면대|꽂|벽걸이|퍼즐|수납|정리/i,
    hooks: [
      "욕실 칫솔 뒤죽박죽이신 분? 이거 하나면 끝이에요",
      "세면대 위 어지러우셨죠? 이 정리템 보세요",
      "젖은 칫솔 바닥에 두시나요? 이거 쓰면 바로 달라져요",
      "이거 몰랐으면 욕실 정리 시간만 늘었어요",
    ],
  },
]

function openingHookForVisual(visualCard: string, productName: string, cutIndex: number): string | null {
  const desc = extractVisualDescription(visualCard) + " " + productName
  for (const pool of OPENING_HOOK_POOLS) {
    if (pool.re.test(desc)) {
      return pool.hooks[cutIndex % pool.hooks.length]!
    }
  }
  const generic = [
    "이거 몰랐으면 손해 봤을 것 같아요",
    "와, 이건 왜 이제 알았죠?",
    "저만 몰랐던 꿀템인데요",
  ]
  return generic[cutIndex % generic.length]!
}

function enrichedContextsForNarration(
  contexts: ReadonlyArray<{ visual_card: string; duration: number }>,
  productName: string,
  productContext?: string
): Array<{ visual_card: string; duration: number }> {
  return contexts.map((c, i) => ({
    ...c,
    visual_card: enrichVisualCardForNarration(c.visual_card, productName, i, productContext),
  }))
}

/** 컷별 대본 — 동일·유사 문장·꼬리문구 반복 절대 금지 */
export function enforceUniqueNarrationLines(
  lines: readonly string[],
  contexts: ReadonlyArray<{ visual_card: string; duration: number }>,
  productName: string,
  rewriteSalt = 0,
  productContext?: string
): string[] {
  const enriched = enrichedContextsForNarration(contexts, productName, productContext)
  const prior: string[] = []
  return lines.map((line, i) => {
    const visualCard = enriched[i]!.visual_card
    const duplicate =
      narrationLineIsDuplicateOfPrior(line, prior) ||
      prior.some((p) => narrationSharesRepeatedPhrase(p, line)) ||
      looksLikeRawSceneCopy(line, visualCard)
    const text = pickUniqueNarrationLine({
      visualHint: visualCard,
      productName,
      duration: enriched[i]!.duration,
      cutIndex: i + rewriteSalt * 13 + (duplicate ? prior.length * 5 : 0),
      priorLines: prior,
      preferred: duplicate ? undefined : line,
    })
    prior.push(text)
    return text
  })
}

function enforceUniqueCutLines(
  lines: readonly string[],
  contexts: ReadonlyArray<{ visual_card: string; duration: number }>,
  productName: string,
  rewriteSalt = 0,
  productContext?: string
): string[] {
  let out = enforceUniqueNarrationLines(lines, contexts, productName, rewriteSalt, productContext)
  if (hasExcessiveScriptRepetition(out)) {
    out = enforceUniqueNarrationLines(
      out.map(() => ""),
      contexts,
      productName,
      rewriteSalt + 7,
      productContext
    )
  }
  return out
}

export function detectVisualThemes(visualCard: string): Array<{ theme: string; keywords: string[] }> {
  const desc = extractVisualDescription(visualCard)
  if (!desc) return []
  const out: Array<{ theme: string; keywords: string[] }> = []
  for (const rule of VISUAL_THEME_RULES) {
    if (rule.re.test(desc)) out.push({ theme: rule.theme, keywords: rule.keywords })
  }
  return out
}

/** 화면 묘사와 대본의 연관도 (0~1) */
export function visualGroundingScore(text: string, visualCard: string): number {
  const themes = detectVisualThemes(visualCard)
  if (!themes.length) return 0.55

  const script = text.replace(/\n/g, " ")
  let hits = 0
  for (const { keywords } of themes) {
    if (keywords.some((k) => script.includes(k))) hits++
  }
  return hits / themes.length
}

const WEAK_VISUAL_RE = /^(제품 사용 장면|제품 장면|장면|사용 장면)$/

const CAR_VACUUM_SCENE_HINTS = [
  "차량 시트 틈새에 낀 먼지를 핸디청소기로 빨아들이는 장면",
  "차량 바닥 매트 위 먼지를 진공청소기로 흡입하는 장면",
  "차 안 구석 먼지를 좁은 노즐로 제거하는 장면",
  "운전석 발밑 먼지를 손 대지 않고 빨아들이는 장면",
  "차량 내부 바닥 청소가 한 번에 되는 장면",
  "핸디청소기로 대시보드·문턱 먼지를 정리하는 장면",
  "차 트렁크 구석 먼지를 흡입하는 장면",
  "좁은 틈새 노즐로 시트 사이 먼지를 빼내는 장면",
  "차량 바닥 먼지가 흡입구에 바로 빨려 들어가는 장면",
] as const

const MINI_FAN_SCENE_HINTS = [
  "손에 들고 있는 블루 색상 미니 선풍기를 보여주는 장면",
  "흰색 포장지에 싸인 연보라색 미니 선풍기 언박싱 장면",
  "미니 선풍기 바람 세기를 조절하는 장면",
  "가방에 넣기 좋은 손바닥 크기 선풍기를 들고 있는 장면",
  "책상 위에 올려둔 미니 선풍기 작동 장면",
  "연보라색 미니 선풍기 색감을 클로즈업하는 장면",
] as const

function productSuggestsMiniFan(productName: string, productContext?: string): boolean {
  const blob = `${productName} ${productContext || ""}`
  if (/청소|吸尘|vacuum|진공/i.test(blob)) return false
  return /선풍기|车载风扇|車載風扇|风扇|風扇|fan|미니\s*팬|휴대\s*선풍|쿨링\s*팬|手持风扇/i.test(blob)
}

const GAMING_MOUSE_PAD_SCENE_HINTS = [
  "고급스러운 디자인의 대형 게이밍 마우스 패드 사용 장면",
  "게이밍 마우스 패드 위에서 마우스를 움직이는 장면",
  "키보드와 마우스가 함께 올려진 데스크 매트 장면",
  "RGB 분위기의 게이밍 데스크 셋업 장면",
  "넓은 사이즈 마우스 패드로 손목이 편한 장면",
  "책상 위 게이밍 패드 질감을 보여주는 장면",
] as const

function productSuggestsGamingMousePad(productName: string, productContext?: string): boolean {
  const blob = `${productName} ${productContext || ""}`
  return /마우스\s*패드|mouse\s*pad|게이밍\s*패드|데스크\s*매트|keyboard|키보드|gaming|RGB|LED/i.test(blob)
}

function productSuggestsCarVacuum(productName: string, productContext?: string): boolean {
  const blob = `${productName} ${productContext || ""}`
  if (productSuggestsGamingMousePad(productName, productContext)) return false
  return /차량|차\s*안|자동차|진공\s*청소|핸디\s*청소|车载|吸尘|vacuum|車|차량용|운전석|시트.*청소|바닥.*청소/i.test(blob)
}

/** 「제품 사용 장면」 등 빈 화면 설명을 제품·컷 맥락으로 보강 */
export function enrichVisualCardForNarration(
  visualCard: string,
  productName: string,
  cutIndex: number,
  productContext?: string,
  userKeywords?: readonly string[]
): string {
  const desc = extractVisualDescription(visualCard)
  if (/Vision화면|원본제목|분석장면|원본요약/.test(visualCard)) return visualCard
  if (!WEAK_VISUAL_RE.test(desc) && desc.length >= 10) return visualCard

  const safeProductName =
    sanitizeProductNameForNarration(productName, {
      category: productContext,
      visualHint: visualCard,
      userKeywords,
    }) || productName || "제품"

  if (productSuggestsCarVacuum(safeProductName, productContext)) {
    return CAR_VACUUM_SCENE_HINTS[cutIndex % CAR_VACUUM_SCENE_HINTS.length]!
  }

  if (productSuggestsGamingMousePad(safeProductName, productContext)) {
    return GAMING_MOUSE_PAD_SCENE_HINTS[cutIndex % GAMING_MOUSE_PAD_SCENE_HINTS.length]!
  }

  if (productSuggestsMiniFan(safeProductName, productContext)) {
    return MINI_FAN_SCENE_HINTS[cutIndex % MINI_FAN_SCENE_HINTS.length]!
  }

  const genericHints = [
    `${safeProductName} 실사용으로 체감되는 장면`,
    `${safeProductName} 핵심 기능이 보이는 장면`,
    `${safeProductName} 디테일이 보이는 장면`,
  ]
  return genericHints[cutIndex % genericHints.length]!
}

function narrationNeedsPolish(
  text: string,
  visualCard: string,
  priorLines: readonly string[],
  rewriteMode: boolean
): boolean {
  const grounding = visualGroundingScore(text, visualCard)
  const duplicatePrior =
    narrationLineIsDuplicateOfPrior(text, priorLines) ||
    priorLines.some((p) => narrationSharesRepeatedPhrase(p, text))
  const definitelyWeak =
    !text ||
    isAbstractShoppingNarration(text) ||
    isRepeatMetaNarration(text) ||
    narrationTextLooksWeak(text, visualCard) ||
    looksLikeRawSceneCopy(text, visualCard) ||
    looksLikeDescriptiveSceneNarration(text) ||
    narrationMismatchesVisualProduct(text, visualCard) ||
    duplicatePrior

  if (rewriteMode) {
    return Boolean(
      definitelyWeak ||
        duplicatePrior ||
        grounding < 0.34 ||
        narrationLooksIncomplete(text.replace(/\n/g, " "))
    )
  }
  return definitelyWeak || duplicatePrior || grounding < 0.22
}

/** 프롬프트용 — 컷 화면에서 꼭 반영할 키워드 */
export function visualKeywordsForScript(visualCard: string): string[] {
  const themes = detectVisualThemes(visualCard)
  const fromThemes = themes.flatMap((t) => t.keywords.slice(0, 2))
  const desc = extractVisualDescription(visualCard)
  const words = (desc.match(/[\uac00-\ud7a3]{2,}/g) ?? []).filter(
    (w) => !/장면|모습|사용자|카메라|자막|보임|강조/.test(w)
  )
  return [...new Set([...fromThemes, ...words.slice(0, 4)])].slice(0, 6)
}

function lastSubLine(text: string): string {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
  return lines[lines.length - 1] ?? text.trim()
}

function firstSubLine(text: string): string {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
  return lines[0] ?? text.trim()
}

function hasContinuityConnector(text: string): boolean {
  return CONTINUITY_CONNECTORS.test(text.trim())
}

function sharesTopicHint(prevLast: string, nextFirst: string): boolean {
  const tokensA = (prevLast.match(/[\uac00-\ud7a3]{2,}/g) ?? []).filter((w) => !FLOW_STOPWORDS.has(w))
  const tokensB = (nextFirst.match(/[\uac00-\ud7a3]{2,}/g) ?? []).slice(0, 4)
  return tokensB.some((w) => tokensA.includes(w))
}

function looksLikeSceneReset(text: string, productName?: string): boolean {
  const t = firstSubLine(text)
  if (!t) return false
  if (SCENE_RESET_PATTERNS.some((re) => re.test(t))) return true
  const product = productName?.trim()
  if (product && new RegExp(`^${product.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[,\\s]`).test(t)) {
    return true
  }
  return looksLikeDescriptiveSceneNarration(t)
}

function continuityFromPrior(candidate: string, priorLine: string | undefined): number {
  if (!priorLine) return 0
  const first = firstSubLine(candidate)
  const prevLast = lastSubLine(priorLine)
  if (hasContinuityConnector(first)) return 0.18
  if (sharesTopicHint(prevLast, first)) return 0.14
  if (looksLikeSceneReset(first)) return -0.22
  return 0
}

function pickContinuityConnector(cutIndex: number, totalCuts: number, prevLast: string): string {
  if (cutIndex >= totalCuts - 1) return "그래서"
  if (/[?？]$/.test(prevLast.trim())) return "이제"
  const mids = ["그리고", "이어서", "여기서", "이렇게", "바로"] as const
  return mids[cutIndex % mids.length]!
}

function prependConnectorToBlock(block: string, connector: string): string {
  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean)
  if (!lines.length) return block
  const first = lines[0]!
  if (hasContinuityConnector(first)) return block
  lines[0] = `${connector} ${first.replace(/^[,.\s]+/, "")}`
  return lines.join("\n")
}

/** @deprecated limitConnectorsAcrossScript 사용 — 연결어 추가 대신 남발만 제거 */
export function weaveNarrationContinuity(
  lines: readonly string[],
  _productName?: string
): string[] {
  return limitConnectorsAcrossScript(lines)
}

function lineNeedsPolish(
  text: string,
  visualCard: string,
  priorLines: readonly string[],
  grounding: number
): boolean {
  if (narrationTextLooksWeak(text, visualCard)) return true
  if (looksLikeRawSceneCopy(text, visualCard)) return true
  if (grounding < 0.35 && looksLikeDescriptiveSceneNarration(text)) return true
  if (CLICHE_PATTERNS.some((re) => re.test(text))) return true

  const themes = detectVisualThemes(visualCard)
  if (themes.length > 0 && grounding < 0.2) return true

  return priorLines.some((p) => narrationBlockSimilarity(p, text) >= 0.72)
}

function pickBetterLine(
  current: string,
  candidate: string,
  visualCard: string,
  priorLines: readonly string[]
): string {
  if (
    narrationMismatchesVisualProduct(current, visualCard) &&
    !narrationMismatchesVisualProduct(candidate, visualCard)
  ) {
    return candidate
  }
  const priorLast = priorLines[priorLines.length - 1]
  const dupPenalty = (line: string) =>
    priorLines.some(
      (p) => narrationBlockSimilarity(p, line) >= 0.42 || narrationSharesRepeatedPhrase(p, line)
    )
      ? 0.45
      : 0
  const curScore =
    visualGroundingScore(current, visualCard) +
    continuityFromPrior(current, priorLast) -
    dupPenalty(current) -
    (looksLikeRawSceneCopy(current, visualCard) ? 0.3 : 0)
  const candScore =
    visualGroundingScore(candidate, visualCard) +
    continuityFromPrior(candidate, priorLast) -
    dupPenalty(candidate) -
    (looksLikeRawSceneCopy(candidate, visualCard) ? 0.3 : 0)

  if (candScore > curScore + 0.05) return candidate
  if (narrationTextLooksWeak(current, visualCard) || looksLikeRawSceneCopy(current, visualCard)) {
    return candidate
  }
  return current
}

/** 프롬프트용 컷 블록 (mvp-narration-script·짜집기 파이프라인 공용) */
export function buildNarrationCutsPromptBlock(
  cuts: readonly CutScriptContext[],
  naturalShorts: boolean,
  sceneMetas?: readonly CutNarrationSceneMeta[],
  userKeywords?: readonly string[]
): string {
  const kwBlock =
    userKeywords?.length
      ? `**키워드 제품 (최우선)**: ${userKeywords.join(", ")} — 각 컷 「화면에 보이는 사물·행동」+ 제품 이점을 **한 문장**으로 결합. 화면만 읽기 금지.
${NARRATION_PRODUCT_NAME_USAGE_RULE}

**쇼핑숏폼 공식**: ①문제·후킹 → ②제품 가치 → ③화면별 데모(각도 다르게) → ④마무리·CTA

**좋은 예 (키워드: 칫솔 거치대)**:
- 컷1(퍼즐 거치대): "욕실 칫솔 뒤죽박죽이신 분? 퍼즐 모양 칫솔 거치대 하나면 끝이에요"
- 컷2(컵·필기구): "욕실 소품도 한곳에 모으면 찾기 쉬워요, 칫솔 거치대로 세면대 정돈해보세요"
- 컷3(벽걸이): "벽에 걸어두니 젖은 칫솔 바닥에 안 둬도 돼요"

**나쁜 예 (금지)**:
- "색감이 깔끔해서 선물용" (화면·제품 무관)
- "몇 번 봐도 칫솔 거치대" / "아까 말한 칫솔 거치대" (메타 반복)
- "치아 사이까지 깔끔해요" (거치대인데 칫솔질 기능 지어내기)

`
      : ""
  return (
    kwBlock +
    cuts
    .map((c, i) => {
      const meta = sceneMetas?.[i]
      const maxChars = maxCharsForSceneDuration(c.duration)
      const lineHint = c.duration <= 2.5 ? 2 : c.duration <= 4 ? 3 : Math.max(3, Math.round(c.duration / 1.4))
      const role = naturalShorts
        ? c.index === 1
          ? "역할: ①초반 후킹"
          : c.index === cuts.length
            ? "역할: ⑤마무리·CTA"
            : c.index === 2
              ? "역할: ②일상 갈등"
              : c.index <= Math.ceil(cuts.length * 0.45)
                ? "역할: ③제품 발견·반전"
                : "역할: ④사용·결과·제품 효과"
        : c.index === 1
          ? "역할: 오프닝·후킹"
          : c.index === cuts.length
            ? "역할: 마무리·CTA"
            : c.index <= Math.ceil(cuts.length * 0.35)
              ? "역할: 문제·관심 유지"
              : "역할: 기능·데모·장점"
      const shortCut =
        c.duration < 2.5
          ? " · **1초 내외 컷**: 짧은 호흡 한 줄 — 조사·명사로 끝나는 미완성 금지"
          : ""
      const rhythmHint =
        c.index > 1 && c.index < cuts.length
          ? " · **중간 컷**: ~고/~며/~는데 등 이어 말하기 어미 (~요만 반복 금지)"
          : ""
      const visualForPrompt = meta?.enrichedVisual ?? formatSceneDescriptionHint(c.visual_card)
      const vk = visualKeywordsForScript(c.visual_card)
      const keywordHint = vk.length ? ` · **반드시 포함**: ${vk.join(", ")}` : ""
      const benefitHint = meta?.productBenefitHint
        ? ` · **제품 장점 각도**: ${meta.productBenefitHint}`
        : ""
      const repeatHint =
        meta?.isRepeat && meta.occurrence > 1
          ? ` · **반복 장면 ${meta.occurrence}/${meta.groupSize}** — 앞 등장 컷 나레이션을 이어 깊이 추가 (같은 문장 금지)`
          : meta?.isRepeat && meta.occurrence === 1
            ? ` · **반복 장면 그룹 첫 등장** — 이 화면의 제품 장점을 소개`
            : ""
      const mustMention =
        vk.length > 0
          ? ` · 이 컷 대본에 위 키워드 중 1개 이상·구체 행동(빨아들이다/흡입/닦다 등) 필수`
          : " · 화면에 보이는 사물·행동을 구체적으로 말할 것"
      return `${c.index}. 출력 ${c.output_start}-${c.output_end}s (${c.duration}초, ${lineHint}줄 권장, 최대 ${maxChars}자) · ${role}${shortCut}${rhythmHint}
   소스 ${c.source_start.toFixed(1)}-${c.source_end.toFixed(1)}s · video ${c.video_id}
   화면: ${visualForPrompt}${keywordHint}${benefitHint}${repeatHint}${mustMention}`
    })
    .join("\n\n")
  )
}

/** AI·폴백 대본 후처리 — 반복 완화·화면 정합성·컷 간 흐름 보정 */
export function polishCutNarrationLines(
  lines: readonly string[],
  contexts: ReadonlyArray<{ visual_card: string; duration: number }>,
  productName: string,
  opts?: {
    allowTemplateFallback?: boolean
    fitToDuration?: boolean
    /** 대본 다시쓰기 — AI 문장 유지·결정론적 폴백 회피 */
    rewriteMode?: boolean
    rewriteSalt?: number
    productContext?: string
    /** 다시쓰기 시 이전 컷별 대본 — 동일 문장이면 강제 교체 */
    previousScripts?: Record<string, string>
    /** 반복 장면 그룹·제품 장점 힌트 */
    sceneMetas?: readonly CutNarrationSceneMeta[]
    /** 1단계 사용자 키워드 */
    userKeywords?: readonly string[]
  }
): string[] {
  const allowTemplate = opts?.allowTemplateFallback !== false
  const fitToDuration = opts?.fitToDuration === true
  const rewriteMode = Boolean(opts?.rewriteMode)
  const rewriteSalt = opts?.rewriteSalt ?? 0
  const productContext = opts?.productContext
  const previousScripts = opts?.previousScripts ?? {}
  const sceneMetas = opts?.sceneMetas
  const userKeywords = opts?.userKeywords
  const safeProductName =
    sanitizeProductNameForNarration(productName, {
      category: productContext,
      userKeywords,
      visualHint: productContext,
    }) || productName || "제품"
  const prior: string[] = []
  const groupLastNarration = new Map<number, string>()

  const polished = lines.map((raw, i) => {
    const ctx = contexts[i]!
    const sceneMeta = sceneMetas?.[i]
    const priorInGroup = sceneMeta ? groupLastNarration.get(sceneMeta.groupId) : undefined
    const visualCard = enrichVisualCardForNarration(
      sceneMeta?.enrichedVisual ?? ctx.visual_card,
      safeProductName,
      i,
      productContext,
      userKeywords
    )
    let text = sanitizeNarrationForOutput(raw.trim())

    if (sceneMeta?.isRepeat && sceneMeta.occurrence > 1 && priorInGroup) {
      const dupWithGroup =
        narrationLineIsDuplicateOfPrior(text, prior) ||
        text.trim() === priorInGroup.trim() ||
        narrationBlockSimilarity(text, priorInGroup) >= 0.55
      const weakRepeat = isRepeatMetaNarration(text) || narrationNeedsPolish(text, visualCard, prior, rewriteMode)
      if (dupWithGroup || weakRepeat) {
        const variant = rephraseSceneToShoppingNarrationVariant(
          visualCard,
          safeProductName,
          ctx.duration,
          i * 11 + sceneMeta.occurrence * 7 + rewriteSalt
        )
        if (
          variant &&
          !narrationLineIsDuplicateOfPrior(variant, prior) &&
          !isAbstractShoppingNarration(variant) &&
          !isRepeatMetaNarration(variant)
        ) {
          text = variant
        } else {
          const continued = narrationForRepeatedScene({
            occurrence: sceneMeta.occurrence,
            groupSize: sceneMeta.groupSize,
            productBenefitHint: sceneMeta.productBenefitHint,
            priorInGroup,
            visualHint: ctx.visual_card,
            cutIndex: i,
            productName: safeProductName,
          })
          if (continued && !narrationLineIsDuplicateOfPrior(continued, prior) && !isRepeatMetaNarration(continued)) {
            text = continued
          }
        }
      }
    }

    const duplicatePrior = narrationLineIsDuplicateOfPrior(text, prior)
    const variantBase = (duplicatePrior ? i * 7 + 3 : i * 5 + 1) + rewriteSalt
    const weakOpening =
      i === 0 &&
      (narrationNeedsPolish(text, visualCard, prior, rewriteMode) ||
        /화면\s*보니까|장면\s*보면|바로\s*이해됐/.test(text) ||
        isRepeatMetaNarration(text))
    const needsPolish = narrationNeedsPolish(text, visualCard, prior, rewriteMode) || weakOpening

    if (i === 0 && weakOpening) {
      const hook = openingHookForVisual(visualCard, safeProductName, 0)
      if (hook && !isAbstractShoppingNarration(hook)) text = hook
    }

    if (needsPolish) {
      const candidates = [
        rephraseSceneToShoppingNarration(visualCard, safeProductName, ctx.duration),
        rephraseSceneToShoppingNarrationVariant(visualCard, safeProductName, ctx.duration, variantBase),
        rephraseSceneToShoppingNarrationVariant(visualCard, safeProductName, ctx.duration, variantBase + 4),
        rephraseSceneToShoppingNarrationVariant(visualCard, safeProductName, ctx.duration, variantBase + 9),
        rephraseSceneToShoppingNarrationVariant(visualCard, safeProductName, ctx.duration, variantBase + 13),
      ]
      for (const cand of candidates) {
        if (!allowTemplate && isAbstractShoppingNarration(cand)) continue
        text = pickBetterLine(text, cand, visualCard, prior)
      }
      if (narrationLineIsDuplicateOfPrior(text, prior) || isAbstractShoppingNarration(text)) {
        text = rephraseSceneToShoppingNarrationVariant(
          visualCard,
          safeProductName,
          ctx.duration,
          variantBase + 19
        )
      }
    }

    if (fitToDuration) {
      text = formatNarrationForSceneDuration(text, ctx.duration)
    } else {
      text = sanitizeNarrationForOutput(text)
    }
    if (fitToDuration && narrationLooksIncomplete(text)) {
      const fallback = formatNarrationForSceneDuration(
        rephraseSceneToShoppingNarrationVariant(visualCard, safeProductName, ctx.duration, i + 17),
        ctx.duration
      )
      if (fallback && !narrationLooksIncomplete(fallback.replace(/\n/g, " "))) {
        text = fallback
      } else {
        text = rephraseSceneToShoppingNarrationVariant(visualCard, safeProductName, ctx.duration, i + 31)
      }
    }
    if (rewriteMode) {
      const prevLine = previousScripts[String(i + 1)]?.trim().replace(/\r/g, "")
      const tooSimilar =
        Boolean(prevLine) &&
        (text.trim() === prevLine || narrationBlockSimilarity(text, prevLine) >= 0.48)
      const mustReplace =
        narrationMismatchesVisualProduct(text, visualCard) || tooSimilar
      if (mustReplace) {
        for (let attempt = 0; attempt < 16; attempt++) {
          const forced = rephraseSceneToShoppingNarrationVariant(
            visualCard,
            safeProductName,
            ctx.duration,
            variantBase + rewriteSalt * 3 + attempt * 11 + i * 7
          )
          if (
            forced.trim() &&
            forced.trim() !== prevLine &&
            !narrationMismatchesVisualProduct(forced, visualCard) &&
            !narrationLineIsDuplicateOfPrior(forced, prior) &&
            !isAbstractShoppingNarration(forced)
          ) {
            text = forced
            break
          }
        }
      }
    }

    text = pickUniqueNarrationLine({
      visualHint: visualCard,
      productName: safeProductName,
      duration: ctx.duration,
      cutIndex: i + rewriteSalt * 13,
      priorLines: prior,
      preferred:
        isAbstractShoppingNarration(text) || narrationMismatchesVisualProduct(text, visualCard)
          ? undefined
          : text,
      sceneMeta,
      priorInGroup,
    })
    prior.push(text)
    if (sceneMeta) groupLastNarration.set(sceneMeta.groupId, text)
    return sanitizeNarrationForOutput(text)
  })

  const woven = weaveNarrationContinuity(polished, safeProductName).map(sanitizeNarrationForOutput)
  const unique = enforceUniqueCutLines(woven, contexts, safeProductName, rewriteSalt, productContext).map(
    sanitizeNarrationForOutput
  )
  const primaryLabel = userKeywords?.[0]?.trim() || safeProductName
  const rhythm = applyFlowRhythmToScript(unique)
  return mitigateProductNameSpam(rhythm, primaryLabel).map(sanitizeNarrationForOutput)
}

/** 다시쓰기 — 이전 대본과 동일·유사하면 화면 기반으로 강제 교체 */
export function ensureRewriteDiffersFromPrevious(
  lines: readonly string[],
  previousScripts: Record<string, string>,
  contexts: ReadonlyArray<{ visual_card: string; duration: number }>,
  productName: string,
  rewriteSalt: number
): string[] {
  const prior: string[] = []
  return lines.map((line, i) => {
    const prev = previousScripts[String(i + 1)]?.trim().replace(/\r/g, "") ?? ""
    const ctx = contexts[i]!
    let text = sanitizeNarrationForOutput(line.trim())
    const tooSimilar =
      Boolean(prev) &&
      (text === prev || narrationBlockSimilarity(text, prev) >= 0.48)
    if (tooSimilar) {
      for (let attempt = 0; attempt < 28; attempt++) {
        const forced = rephraseSceneToShoppingNarrationVariant(
          ctx.visual_card,
          productName,
          ctx.duration,
          rewriteSalt + i * 19 + attempt * 11
        )
        if (
          forced.trim() &&
          forced.trim() !== prev &&
          narrationBlockSimilarity(forced, prev) < 0.42 &&
          !narrationLineIsDuplicateOfPrior(forced, prior)
        ) {
          text = forced
          break
        }
      }
    }
    prior.push(text)
    return sanitizeNarrationForOutput(text)
  })
}

/** OpenAI JSON lines 파싱 — 빈 컷도 슬롯 유지 (filter로 개수 줄어듦 방지) */
export function parseNarrationLinesFromAi(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((l) => sanitizeNarrationForOutput(String(l ?? "").trim()))
}

/** AI가 컷 수를 어긋내도 편집 컷 수에 맞춤 — 부족·빈 줄은 화면 기반 완결 문장으로 채움 */
export function alignNarrationLinesToCuts(
  lines: readonly string[],
  cuts: ReadonlyArray<{ visual_card: string; duration: number }>,
  productName: string
): string[] {
  const cutCount = cuts.length
  if (!cutCount) return []

  const out: string[] = []
  for (let i = 0; i < cutCount; i++) {
    let text = (lines[i] ?? "").trim()
    if (!text) {
      text = rephraseSceneToShoppingNarrationVariant(
        cuts[i]!.visual_card,
        productName,
        cuts[i]!.duration,
        i + 51
      )
    }
    out.push(sanitizeNarrationForOutput(text))
  }
  return applyFlowRhythmToScript(out)
}
