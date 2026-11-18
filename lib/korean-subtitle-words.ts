/** 앞뒤 어절에 모두 기대는 의존명사 ("할 수 있다", "한 거임") */
const BOUND_NOUN_BOTH = /^(수|것|거|줄|뿐)[은는이가을를도만의]?[,.!?]?$/
/** 앞 어절에만 기대는 의존명사·단위 ("할 때", "여러 겹", "두 개") */
const BOUND_NOUN_PREV = /^(때|겹|번|개|명|채|척|만큼)[은는이가을를도만의에]?[,.!?]?$/
/** 뒤 명사를 꾸미는 관형사 — 뒤 어절과 떨어지면 "여러 / 겹"처럼 끊겨 보임 */
const DETERMINER = /^(여러|몇|한|두|세|네|각|모든|어느|아무|온갖|매|첫|새|이|그|저|이런|그런|저런)$/

export function isAwkwardKoreanBreak(prevWord: string, nextWord: string): boolean {
  return (
    DETERMINER.test(prevWord) ||
    BOUND_NOUN_BOTH.test(prevWord) ||
    BOUND_NOUN_BOTH.test(nextWord) ||
    BOUND_NOUN_PREV.test(nextWord)
  )
}

/** 자막 줄바꿈에서 떨어지면 안 되는 어절끼리 한 토큰으로 묶음 */
export function glueKoreanWordUnits(words: string[]): string[] {
  const glued: string[] = []
  for (const word of words) {
    const prev = glued[glued.length - 1]
    // 묶인 토큰의 마지막 어절 기준으로 판단해야 "할 수 있다"처럼 연쇄 결합됨
    if (prev !== undefined && isAwkwardKoreanBreak(prev.split(" ").pop() || "", word)) {
      glued[glued.length - 1] = `${prev} ${word}`
    } else {
      glued.push(word)
    }
  }
  return glued
}
