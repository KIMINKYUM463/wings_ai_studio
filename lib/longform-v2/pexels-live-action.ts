import {
  extractCoreStockKeywordsKo,
  extractStockKeywordsFromScriptLine,
  isPrimarilyLatinText,
} from "./stock-keywords-ko"

/** Pexels 스톡 — 실사(live-action) 우선 · 애니/CGI 후보 제외 */

const ANIMATION_SLUG_RE =
  /\b(animation|animated|animate|cartoon|anime|cgi|3d-?render(?:ed|ing)?|3d-?animation|motion-?graphics?|illustration|illustrated|looping-?background|abstract-?background|particle|infographic|digital-?art|vector|rendering|low-?poly|pixel-?art|kaleidoscope|screensaver|wallpaper|intro-?template|title-?sequence|logo-?reveal|green-?screen-?animation)\b/i

const SPACE_VISUAL_RE =
  /\b(space|universe|cosmos|cosmic|galaxy|galaxies|planet|planets|star|stars|solar|nebula|astronomy|telescope|orbit|milky\s+way|night\s+sky|moon|comet|aurora|celestial|spacecraft|rocket)\b/i

const LIVE_ACTION_SUFFIX = 'real footage live action'

const SPACE_LIVE_ACTION_SUFFIX = 'night sky timelapse telescope astronomy'

const LIVE_ACTION_STOP_WORDS = new Set([
  'real',
  'footage',
  'live',
  'action',
  'night',
  'sky',
  'timelapse',
  'telescope',
  'astronomy',
])

/** 한국어 시각 키워드 → Pexels(영어) 검색어 */
const KO_EN_STOCK: Record<string, string> = {
  밤하늘: 'night sky',
  은하수: 'milky way',
  태양계: 'solar system',
  천문대: 'observatory telescope',
  천문학: 'astronomy',
  천체: 'celestial',
  스카이줄: 'zipline',
  해변: 'beach',
  일출: 'sunrise',
  일몰: 'sunset',
  폭포: 'waterfall',
  야경: 'city night',
  지하철: 'subway',
  공항: 'airport',
  항구: 'harbor port',
  사무실: 'office',
  우주선: 'spacecraft',
  로켓: 'rocket launch',
  은하: 'galaxy',
  외계: 'space alien',
  우주: 'space universe cosmos',
  행성: 'planet',
  혜성: 'comet',
  오로라: 'aurora',
  태양: 'sun solar',
  별: 'stars',
  지구: 'earth',
  달: 'moon',
  바다: 'ocean sea',
  섬: 'island',
  산: 'mountain',
  숲: 'forest',
  나무: 'trees forest',
  강: 'river',
  사막: 'desert',
  초원: 'meadow grassland',
  들판: 'field meadow',
  호수: 'lake',
  빙하: 'glacier ice',
  구름: 'clouds sky',
  하늘: 'sky clouds',
  번개: 'lightning storm',
  도시: 'city urban',
  거리: 'street city',
  건물: 'building architecture',
  교통: 'traffic city',
  카페: 'cafe coffee shop',
  공장: 'factory industrial',
  시장: 'market street',
  가족: 'family people',
  할머니: 'grandmother senior',
  의사: 'doctor hospital',
  뇌: 'brain neuroscience',
  노화: 'aging elderly senior',
  치매: 'dementia elderly care',
  기억: 'memory mind',
  건강: 'health wellness',
  의료: 'medical healthcare',
  신경: 'nervous system neuron',
  수면: 'sleep resting',
  스트레스: 'stress anxiety',
  혈압: 'blood pressure health',
  요리: 'cooking kitchen',
  운동: 'exercise fitness',
  축구: 'soccer football',
  요가: 'yoga',
  걷기: 'walking people',
  달리기: 'running jog',
  음식: 'food cooking',
  커피: 'coffee',
  과일: 'fruit',
  빛: 'light rays',
  불: 'fire flame',
  불꽃: 'fire sparks',
  연기: 'smoke',
  물결: 'waves water',
  그림자: 'shadow silhouette',
  새: 'birds flying',
  고양이: 'cat',
  강아지: 'dog',
  물고기: 'fish underwater',
  곰: 'bear wildlife',
  사자: 'lion wildlife',
  눈: 'snow winter',
  비: 'rain',
  바람: 'wind',
  사람: 'people',
  아이: 'child kids',
  학교: 'school classroom',
  병원: 'hospital clinic',
  교실: 'classroom school',
  도서관: 'library',
  농장: 'farm agriculture',
  트럭: 'truck road',
  자동차: 'car driving',
  비행기: 'airplane aviation',
  배: 'ship boat',
  // 전쟁·역사·감정 (한글 미번역 시 검색 전체가 스킵되던 케이스)
  전쟁: 'war conflict battlefield',
  군인: 'soldier military',
  전장: 'battlefield war',
  전투: 'battle combat',
  군대: 'army military',
  병사: 'soldier infantry',
  영웅: 'hero statue memorial',
  리더: 'leader commander',
  부하: 'soldiers troops',
  승리: 'victory celebration',
  패배: 'defeat aftermath',
  무기: 'weapons armor',
  칼: 'sword blade',
  방패: 'shield armor',
  성: 'castle fortress',
  왕궁: 'palace castle',
  왕: 'king crown',
  황제: 'emperor royal',
  비극: 'tragedy drama solemn',
  슬픔: 'sorrow melancholy',
  절망: 'despair solitude',
  후회: 'regret reflection',
  죄책: 'guilt solemn face',
  폭풍: 'storm clouds dramatic',
  폐허: 'ruins abandoned',
  유적: 'ruins ancient',
  기념비: 'war memorial monument',
}

const SORTED_KO_TERMS = Object.keys(KO_EN_STOCK).sort((a, b) => b.length - a.length)

export type PexelsStockVideoMeta = {
  pageUrl?: string | null
  imageUrl?: string | null
}

function slugFromUrl(url: string | null | undefined): string {
  const s = url?.trim()
  if (!s) return ''
  try {
    const path = new URL(s).pathname
    return decodeURIComponent(path.replace(/\/+/g, '/')).replace(/-/g, ' ')
  } catch {
    return s.replace(/-/g, ' ')
  }
}

/** Pexels 페이지 URL·썸네일 경로에 애니/CGI·모션그래픽 시그널이 있으면 true */
export function isLikelyAnimatedPexelsStock(meta: PexelsStockVideoMeta): boolean {
  const haystack = `${slugFromUrl(meta.pageUrl)} ${slugFromUrl(meta.imageUrl)}`.trim()
  if (!haystack) return false
  return ANIMATION_SLUG_RE.test(haystack)
}

function translateKoLexiconToEnglish(trimmed: string): string {
  const englishParts: string[] = []
  let scratch = trimmed
  for (const ko of SORTED_KO_TERMS) {
    if (!scratch.includes(ko)) continue
    englishParts.push(KO_EN_STOCK[ko]!)
    scratch = scratch.split(ko).join(' ')
  }

  for (const token of trimmed.split(/\s+/)) {
    const bare = token.replace(/[^\uAC00-\uD7A3a-zA-Z0-9]/g, '')
    if (bare && KO_EN_STOCK[bare]) englishParts.push(KO_EN_STOCK[bare]!)
  }

  const words = [...new Set(englishParts.join(' ').split(/\s+/).filter(Boolean))]
  return words.join(' ')
}

/** 한국어 스톡 검색어 → Pexels용 영어 키워드 */
export function translateStockQueryToPexelsEnglish(query: string): string {
  const trimmed = query.trim()
  if (!trimmed) return ''
  if (isPrimarilyLatinText(trimmed)) return trimmed

  const direct = translateKoLexiconToEnglish(trimmed)
  if (direct.trim()) return direct

  const coreKo = extractStockKeywordsFromScriptLine(trimmed)
  if (coreKo && coreKo !== trimmed) {
    const fromCore = translateKoLexiconToEnglish(coreKo)
    if (fromCore.trim()) return fromCore
  }

  return ''
}

/** 실사 스톡 검색에 유리하도록 영어 쿼리 보강 */
export function buildLiveActionPexelsQuery(baseQuery: string): string {
  const core = baseQuery.trim()
  if (!core) return LIVE_ACTION_SUFFIX
  const parts = [core, LIVE_ACTION_SUFFIX]
  if (SPACE_VISUAL_RE.test(core)) parts.push(SPACE_LIVE_ACTION_SUFFIX)
  return parts.join(' ')
}

export type PexelsResolvedSearchQuery = {
  apiQuery: string
  englishCore: string
  translatedFromKorean: boolean
}

/** UI 입력(한/영) → Pexels API 검색 문자열 */
export function resolvePexelsSearchQuery(rawQuery: string): PexelsResolvedSearchQuery {
  const resolved = tryResolvePexelsSearchQuery(rawQuery)
  if (!resolved) {
    throw new Error('Pexels 검색용 영어 키워드를 만들 수 없습니다. 다른 검색어를 입력해 보세요.')
  }
  return resolved
}

/**
 * 클라이언트가 encodeURIComponent + URLSearchParams로 이중 인코딩한 경우
 * (`%EB%87%8C…`) 복구. 정상 한글/영어는 그대로.
 */
export function normalizePexelsIncomingQuery(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  if (!/%[0-9A-Fa-f]{2}/.test(t)) return t
  try {
    let cur = t
    for (let i = 0; i < 2; i++) {
      if (!/%[0-9A-Fa-f]{2}/.test(cur)) break
      const next = decodeURIComponent(cur.replace(/\+/g, ' '))
      if (next === cur) break
      cur = next
    }
    return cur.trim() || t
  } catch {
    return t
  }
}

/** 주제 힌트 → 영어 폴백 검색어 (번역 실패·0건일 때 무조건 히트용) */
export function semanticStockFallbackQueries(rawQuery: string): string[] {
  const raw = normalizePexelsIncomingQuery(rawQuery)
  const hay = `${raw} ${translateStockQueryToPexelsEnglish(raw)}`.toLowerCase()
  const out: string[] = []
  const add = (q: string) => {
    const t = q.trim()
    if (t) out.push(t)
  }

  if (/전쟁|군인|전장|전투|군대|병사|weapon|battle|war|soldier|military|army/.test(hay + raw)) {
    add('soldier silhouette sunset')
    add('battlefield smoke dramatic sky')
    add('military training field')
    add('war memorial monument')
    add('abandoned armor weapons ruins')
  }
  if (/우주|행성|은하|space|planet|galaxy|cosmos|astronomy/.test(hay + raw)) {
    add('milky way night sky')
    add('earth from space')
    add('stars nebula cosmos')
  }
  if (/바다|ocean|sea|beach|wave/.test(hay + raw)) {
    add('ocean waves sunset')
    add('dramatic sea storm')
  }
  if (/도시|거리|city|urban|street/.test(hay + raw)) {
    add('city skyline dusk')
    add('busy city street night')
  }

  // 최후 보편 검색어 — Pexels에 거의 항상 결과 있음
  add('dramatic cinematic landscape')
  add('storm clouds atmosphere')
  add('mountain valley fog')
  add('forest sunlight nature')
  add('ocean horizon sunset')
  add('city urban skyline')
  return [...new Set(out)]
}

/** resolvePexelsSearchQuery — 빈 입력만 null (한글 미번역이어도 폴백으로 통과) */
export function tryResolvePexelsSearchQuery(rawQuery: string): PexelsResolvedSearchQuery | null {
  const trimmed = normalizePexelsIncomingQuery(rawQuery)
  if (!trimmed) return null
  const translatedFromKorean = !isPrimarilyLatinText(trimmed)
  let englishCore = translatedFromKorean ? translateStockQueryToPexelsEnglish(trimmed) : trimmed
  // 이미 영어 폴백 쿼리이거나 라틴 텍스트면 그대로
  if (!englishCore.trim() && isPrimarilyLatinText(trimmed)) {
    englishCore = trimmed
  }
  // 한글인데 사전 미등록 → 의미 폴백 첫 항 사용 (검색 루프가 스킵되지 않게)
  if (!englishCore.trim()) {
    englishCore = semanticStockFallbackQueries(trimmed)[0] || 'dramatic cinematic landscape'
  }
  return {
    apiQuery: buildLiveActionPexelsQuery(englishCore),
    englishCore,
    translatedFromKorean,
  }
}

/**
 * Pexels 검색 재시도용 — 원문 → 핵심 키워드 → 점진적 축소 → 의미/보편 영어 폴백
 */
export function buildStockPexelsQueryVariants(rawQuery: string): string[] {
  const trimmed = normalizePexelsIncomingQuery(rawQuery)
  if (!trimmed) return []

  const seen = new Set<string>()
  const out: string[] = []
  const add = (q: string) => {
    const t = q.trim()
    if (!t || t.length < 1 || seen.has(t)) return
    seen.add(t)
    out.push(t)
  }

  add(trimmed)

  const coreKo = extractCoreStockKeywordsKo(trimmed, 3)
  add(coreKo)
  add(extractCoreStockKeywordsKo(trimmed, 2))
  add(extractCoreStockKeywordsKo(trimmed, 1))

  const refined = extractStockKeywordsFromScriptLine(trimmed)
  if (refined) add(refined)

  const bases = [trimmed, coreKo, refined].filter(Boolean)
  for (const base of bases) {
    const words = base.split(/\s+/).filter(Boolean)
    for (let n = Math.min(words.length - 1, 4); n >= 1; n--) {
      add(words.slice(0, n).join(' '))
    }
  }

  // 개별 한글 토큰 (전쟁 / 군인 / 전장 각각 재시도)
  for (const w of trimmed.split(/\s+/).filter((x) => x.length >= 2)) {
    add(w)
  }

  for (const fb of semanticStockFallbackQueries(trimmed)) {
    add(fb)
  }

  return out
}

export function extractPexelsRelevanceTerms(englishCore: string): string[] {
  return [
    ...new Set(
      englishCore
        .toLowerCase()
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 3 && !LIVE_ACTION_STOP_WORDS.has(t)),
    ),
  ]
}

export function scorePexelsVideoRelevance(meta: PexelsStockVideoMeta, terms: string[]): number {
  if (!terms.length) return 0
  const slug = slugFromUrl(meta.pageUrl).toLowerCase()
  if (!slug) return 0
  let score = 0
  for (const term of terms) {
    if (slug.includes(term.replace(/\s+/g, ' '))) score += 2
    if (term.includes(' ') && slug.includes(term.split(' ')[0]!)) score += 1
  }
  return score
}

export function sortPexelsVideosByRelevance<T extends PexelsStockVideoMeta>(
  items: T[],
  englishCore: string,
): T[] {
  const terms = extractPexelsRelevanceTerms(englishCore)
  if (!terms.length) return items
  const scored = items.map((item) => ({
    item,
    score: scorePexelsVideoRelevance(item, terms),
  }))
  const anyMatch = scored.some((s) => s.score > 0)
  const filtered = anyMatch ? scored.filter((s) => s.score > 0) : scored
  filtered.sort((a, b) => b.score - a.score)
  return filtered.map((s) => s.item)
}
