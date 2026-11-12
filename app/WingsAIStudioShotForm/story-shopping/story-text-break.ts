const MIN_PART_CHARS = 4

/** 이 말로 끝나는 어절 뒤에서 끊으면 의미가 자연스럽게 나뉨 (조사·연결 어미) */
const KOREAN_BREAK_ENDING =
  /(은|는|이|가|을|를|에|에서|으로|로|와|과|도|만|고|서|면|며|데|게|지|니까|지만|는데|면서|어서|아서|해서)$/
const PUNCTUATION_ENDING = /[,，、.!?。！？~]$/

export const plainLength = (text: string) => text.replace(/\s/g, "").length

/** 가운데에 가깝고, 조사·어미·문장부호 뒤인 띄어쓰기를 골라 [앞, 뒤]로 나눔 */
export function findStoryTwoCutBreak(
  text: string,
  minPartChars = MIN_PART_CHARS
): [string, string] | null {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length < 2) return null

  const total = plainLength(text)
  let best: { index: number; score: number } | null = null
  let leftChars = 0
  for (let index = 0; index < words.length - 1; index += 1) {
    const word = words[index]!
    leftChars += plainLength(word)
    const rightChars = total - leftChars
    if (leftChars < minPartChars || rightChars < minPartChars) continue

    const balance = 1 - Math.abs(leftChars - rightChars) / total
    const bonus = PUNCTUATION_ENDING.test(word)
      ? 0.5
      : KOREAN_BREAK_ENDING.test(word)
        ? 0.25
        : 0
    const score = balance + bonus
    if (!best || score > best.score) best = { index, score }
  }
  if (!best) return null

  return [
    words.slice(0, best.index + 1).join(" "),
    words.slice(best.index + 1).join(" "),
  ]
}
