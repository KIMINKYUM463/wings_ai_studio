/** Pexels 스톡 검색용 한국어 키워드 — 대본에서 시각 요소 추출 (클라이언트·서버 공용) */

const STOP_WORDS = new Set([
  '은',
  '는',
  '이',
  '가',
  '을',
  '를',
  '의',
  '에',
  '에서',
  '으로',
  '와',
  '과',
  '도',
  '만',
  '하며',
  '하지만',
  '그',
  '저',
  '것',
  '수',
  '등',
  '때',
  '면',
  '며',
  '고',
  '서',
  '까지',
  '당신',
  '우리',
  '그것',
  '이것',
  '저것',
  '있',
  '없',
  '한다',
  '합니다',
  '입니다',
  '되는',
  '하는',
  '있는',
  '없는',
  '보는',
  '보이',
  '가장',
  '멀리',
  '떨어진',
  '이미',
  '아주',
  '높',
  '높거든요',
  '가능성',
  '때문',
  '경우',
  '사실',
  '정도',
  '방법',
  '이유',
  '과거',
  '유령',
  '전',
  '후',
  '지금',
  '순간',
  '년',
  '월',
  '일',
])

/** 스톡 영상 검색에 유리한 시각 명사 — 긴 구문 우선 매칭 */
const STOCK_VISUAL_TERMS = [
  '밤하늘',
  '은하수',
  '태양계',
  '천문대',
  '스카이줄',
  '해변',
  '일출',
  '일몰',
  '폭포',
  '야경',
  '지하철',
  '공항',
  '항구',
  '사무실',
  '우주선',
  '로켓',
  '은하',
  '외계',
  '우주',
  '행성',
  '혜성',
  '오로라',
  '태양',
  '별',
  '지구',
  '달',
  '바다',
  '섬',
  '산',
  '숲',
  '나무',
  '강',
  '사막',
  '초원',
  '들판',
  '호수',
  '빙하',
  '구름',
  '하늘',
  '번개',
  '도시',
  '거리',
  '건물',
  '교통',
  '카페',
  '공장',
  '시장',
  '가족',
  '할머니',
  '의사',
  '요리',
  '운동',
  '축구',
  '요가',
  '걷기',
  '달리기',
  '음식',
  '커피',
  '과일',
  '빛',
  '불',
  '불꽃',
  '연기',
  '물결',
  '그림자',
  '새',
  '고양이',
  '강아지',
  '물고기',
  '곰',
  '사자',
  '눈',
  '비',
  '바람',
  '사람',
  '아이',
  '학교',
  '병원',
  '교실',
  '도서관',
  '농장',
  '트럭',
  '자동차',
  '비행기',
  '배',
  '전쟁',
  '군인',
  '전장',
  '전투',
  '군대',
  '병사',
  '영웅',
  '승리',
  '패배',
  '무기',
  '폐허',
  '유적',
  '기념비',
  '폭풍',
].sort((a, b) => b.length - a.length)

const PARTICLE_ENDINGS = /(의|은|는|이|가|을|를|에|에서|으로|와|과|도|만|에게|께서|부터|까지|처럼|보다|한테)$/

const HANGUL_WORD_RE = /[\uAC00-\uD7A3]{2,}/g

export function isPrimarilyLatinText(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  const latin = (t.match(/[a-zA-Z]/g) ?? []).length
  const hangul = (t.match(/[\uAC00-\uD7A3]/g) ?? []).length
  if (hangul === 0) return latin > 0
  return latin > hangul * 2
}

/** 저장된 검색어가 대본 앞부분만 잘라 넣은 값인지 */
export function isWeakStockKeywords(saved: string, scriptLine: string): boolean {
  const s = saved.trim()
  const line = scriptLine.trim()
  if (!s || !line) return false
  if (line.startsWith(s)) return true
  const savedWords = s.split(/\s+/).filter(Boolean)
  const lineWords = line
    .replace(/[,.!?…「」『』""''()（）[\]:：·]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (savedWords.length >= 2) {
    let prefix = true
    for (let i = 0; i < savedWords.length; i++) {
      if (lineWords[i] !== savedWords[i]) {
        prefix = false
        break
      }
    }
    if (prefix) return true
  }
  return false
}

function stripKoreanToken(raw: string): string {
  return raw.replace(/[^가-힣]/g, '').trim()
}

function stemKoreanToken(token: string): string {
  let w = stripKoreanToken(token)
  for (let n = 0; n < 3 && w.length >= 2; n++) {
    const next = w.replace(PARTICLE_ENDINGS, '')
    if (next === w) break
    w = next
  }
  return w
}

function findLexiconTerms(line: string): string[] {
  const found: string[] = []
  const seen = new Set<string>()
  for (const term of STOCK_VISUAL_TERMS) {
    if (!line.includes(term) || seen.has(term)) continue
    found.push(term)
    seen.add(term)
  }
  return found
}

function scoreToken(token: string, lexiconHits: Set<string>): number {
  let score = 0
  if (lexiconHits.has(token)) score += 20
  if (token.length >= 3) score += 3
  if (token.length >= 2) score += 1
  if (STOP_WORDS.has(token)) score -= 15
  return score
}

function collectStemCandidates(line: string): string[] {
  const spaced = line
    .replace(/[,.!?…「」『』""''()（）[\]:：·]/g, ' ')
    .split(/\s+/)
    .map(stemKoreanToken)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w))

  const runs = (line.match(HANGUL_WORD_RE) ?? []).map(stemKoreanToken).filter(
    (w) => w.length >= 2 && !STOP_WORDS.has(w),
  )

  const out: string[] = []
  const seen = new Set<string>()
  for (const w of [...spaced, ...runs]) {
    if (!seen.has(w)) {
      seen.add(w)
      out.push(w)
    }
  }
  return out
}

/** 대본 한 줄에서 스톡 검색용 한국어 키워드 3~5개 */
export function extractStockKeywordsFromScriptLine(scriptLine: string): string {
  const line = scriptLine.trim()
  if (!line) return ''

  const lexicon = findLexiconTerms(line)
  const lexiconSet = new Set(lexicon)

  const ranked = collectStemCandidates(line)
    .map((w) => ({ w, score: scoreToken(w, lexiconSet) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)

  const picked: string[] = []
  const used = new Set<string>()

  for (const term of lexicon) {
    if (picked.length >= 5) break
    if (!used.has(term)) {
      picked.push(term)
      used.add(term)
    }
  }

  for (const { w } of ranked) {
    if (picked.length >= 5) break
    if (used.has(w)) continue
    if (lexiconSet.has(w)) continue
    picked.push(w)
    used.add(w)
  }

  if (picked.length > 0) return picked.slice(0, 5).join(' ')

  const lexiconOnly = lexicon.slice(0, 3).join(' ')
  if (lexiconOnly) return lexiconOnly

  const fallback = collectStemCandidates(line)
    .filter((w) => !STOP_WORDS.has(w))
    .slice(0, 2)
    .join(' ')
  if (fallback) return fallback

  return line.slice(0, 24).trim()
}

/** 스톡 검색어에서 핵심 키워드만 (Pexels 재시도·긴 검색어 축소) */
export function extractCoreStockKeywordsKo(keywords: string, maxWords = 3): string {
  const line = keywords.trim()
  if (!line) return ''
  const refined = extractStockKeywordsFromScriptLine(line)
  const base = refined || line
  return base
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, Math.max(1, maxWords))
    .join(' ')
}

/** 저장값·대본·프롬프트에서 최종 스톡 검색어 결정 */
export function resolveStockSearchKeywordsKo(input: {
  stockSearchKeywordsKo?: string
  scriptLine?: string
  narrationText?: string
  promptKo?: string
}): string {
  const script = input.narrationText?.trim() || input.scriptLine?.trim() || ''
  const saved = input.stockSearchKeywordsKo?.trim()
  if (saved && !isPrimarilyLatinText(saved)) {
    if (!script || !isWeakStockKeywords(saved, script)) return saved
  }
  if (script) {
    const fromScript = extractStockKeywordsFromScriptLine(script)
    if (fromScript) return fromScript
  }
  const promptKo = input.promptKo?.trim()
  if (promptKo && !isPrimarilyLatinText(promptKo)) {
    return extractStockKeywordsFromScriptLine(promptKo)
  }
  return saved || ''
}
