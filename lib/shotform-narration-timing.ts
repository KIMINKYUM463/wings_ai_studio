/** 쇼핑숏폼 한국어 나레이션 — 벤치마크 기준 약 4.5자/초 */



export const KOREAN_NARRATION_CHARS_PER_SEC = 4.5

const ORPHAN_PUNCTUATION_LINE = /^[.!?。！？…,，、:·\s]+$/

function isOrphanPunctuationFragment(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  return ORPHAN_PUNCTUATION_LINE.test(t) || (t.length <= 2 && /^[.!?？!！…]+$/.test(t))
}

/** `번거롭죠 ?\n?` 같이 구두점만 따로 떨어진 줄·공백 정리 */
export function cleanNarrationLineBreaks(text: string): string {
  let t = (text || "").replace(/\r/g, "").trim()
  if (!t) return t

  t = t.replace(/\s+([.!?。！？…])/g, "$1")

  const merged: string[] = []
  for (const line of t.split("\n")) {
    const trimmed = line.replace(/\s{2,}/g, " ").trim()
    if (!trimmed) continue
    if (isOrphanPunctuationFragment(trimmed)) {
      if (merged.length) {
        merged[merged.length - 1] = `${merged[merged.length - 1]}${trimmed.replace(/\s+/g, "")}`
      }
      continue
    }
    if (narrationPlainCharCount(trimmed) < 2 && merged.length && /^[.!?？]/.test(trimmed)) {
      merged[merged.length - 1] = `${merged[merged.length - 1]}${trimmed}`
      continue
    }
    merged.push(trimmed)
  }

  return merged.join("\n")
}

/** 줄바꿈 제외 글자 수 */

export function narrationPlainCharCount(text: string): number {

  return text.replace(/\s+/g, "").length

}



/** TTS 예상 재생 시간(초) */

export function estimateNarrationDurationSec(text: string): number {

  const chars = narrationPlainCharCount(text)

  if (!chars) return 0

  return Math.round((chars / KOREAN_NARRATION_CHARS_PER_SEC) * 10) / 10

}



/** 장면 길이에 맞춘 권장 최대 글자 수 — 짧은 컷도 완결 호흡 최소 글자 확보 */

export function maxCharsForSceneDuration(sceneDurationSec: number, ratio = 0.9): number {

  const d = Math.max(0.5, sceneDurationSec)

  const calculated = Math.floor(d * KOREAN_NARRATION_CHARS_PER_SEC * ratio)

  if (d < 1.2) return Math.max(10, calculated)

  if (d < 2.5) return Math.max(14, calculated)

  return Math.max(12, calculated)

}



const NARRATION_COMPLETE_ENDINGS =
  /(?:해요|해요요|합니다|하세요|하죠|하네요|하네|했어요|됐어요|됐죠|이에요|예요|거예요|어요|아요|네요|죠|요|다|음|네|죠|세요|십시오|보세요|닦여요|빨아요|편해요|좋아요|깔끔해요|개운해요)$/

/** 한 줄이 완결된 나레이션인지 */
function narrationLineLooksIncomplete(line: string): boolean {
  const t = line.trim()
  if (!t) return true
  if (/[.!?…]$/.test(t)) return false
  if (NARRATION_COMPLETE_ENDINGS.test(t)) return false
  if (/[요죠네다음][.!?]?$/.test(t)) return false
  if (/[을를이가의에과와도로으로]$/.test(t)) return true
  // 관형형·연결 어미에서 끊김 (설치하는, 간편하게 등 — 다음 컷과 이어지지 않음)
  if (/[가-힣]+(?:하는|되는|할|한|하고|이며|면서|는데|지만|해서|으며|거나|인|된)$/.test(t)) return true
  if (/하게$/.test(t) && !/하게요/.test(t)) return true
  // 형용사·부사 어간에서 끊김 (깨끗하, 부드러우 등)
  if (/[가-힣]{2,}하$/.test(t) && !/하(세요|십시오|면|니|네요|나요|죠)?$/.test(t)) return true
  if (/[가-힣]{2,}게$/.test(t)) return true
  const lastWord = t.split(/\s+/).pop() ?? t
  if (lastWord.length <= 2 && !/[요죠네다음다]$/.test(lastWord)) return true
  if (t.length <= 18 && !NARRATION_COMPLETE_ENDINGS.test(t) && !/[.!?…]$/.test(t)) return true
  return false
}

/** 문장이 끝나지 않고 조사·명사·어간에서 끊겼는지 */
export function narrationLooksIncomplete(text: string): boolean {
  const t = text.trim()
  if (!t) return true
  const lines = t.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  if (lines.length > 1) {
    return lines.some((line) => narrationLineLooksIncomplete(line))
  }
  return narrationLineLooksIncomplete(t)
}



export type NarrationFitStatus = "ok" | "warn" | "empty"



export function narrationFitForScene(

  text: string,

  sceneDurationSec: number

): { status: NarrationFitStatus; charCount: number; estimatedSec: number; maxChars: number } {

  const charCount = narrationPlainCharCount(text)

  const estimatedSec = estimateNarrationDurationSec(text)

  const maxChars = maxCharsForSceneDuration(sceneDurationSec)

  if (!charCount) {

    return { status: "empty", charCount: 0, estimatedSec: 0, maxChars }

  }

  const incomplete = narrationLooksIncomplete(text)

  const status: NarrationFitStatus =

    !incomplete && estimatedSec <= sceneDurationSec + 0.5 && charCount <= maxChars + 4

      ? "ok"

      : "warn"

  return { status, charCount, estimatedSec, maxChars }

}



function truncateAtPhraseBoundary(text: string, maxPlainChars: number): string {

  const t = text.trim()

  if (!t || narrationPlainCharCount(t) <= maxPlainChars) return t



  let best = ""

  for (let end = t.length; end >= 4; end--) {

    const slice = t.slice(0, end).trim()

    if (narrationPlainCharCount(slice) > maxPlainChars) continue

    if (narrationLooksIncomplete(slice)) continue

    best = slice

    break

  }

  if (best) return best



  let buf = ""

  for (const ch of t) {

    const next = buf + ch

    if (narrationPlainCharCount(next) > maxPlainChars && buf) break

    buf = next

  }

  buf = buf.trim()

  if (buf && !narrationLooksIncomplete(buf)) return buf

  for (let end = t.length; end >= 3; end--) {
    const slice = t.slice(0, end).trim()
    if (narrationPlainCharCount(slice) <= maxPlainChars && !narrationLooksIncomplete(slice)) {
      return slice
    }
  }

  return ""

}



/** 완결된 구문 우선 — 잘리는 꼬리(을/를/바닥→바) 방지 */

export function trimToCompleteNarration(text: string, maxPlainChars: number): string {

  const t = text.trim()

  if (!t) return ""

  if (narrationPlainCharCount(t) <= maxPlainChars && !narrationLooksIncomplete(t)) return t



  const parts = t

    .split(/(?<=[.!?…])\s*|(?<=[요죠네다음][.!?]?)\s*|\n+/)

    .map((s) => s.trim())

    .filter(Boolean)



  for (let i = parts.length; i >= 1; i--) {

    const candidate = parts.slice(0, i).join(" ")

    if (

      narrationPlainCharCount(candidate) <= maxPlainChars + 6 &&

      !narrationLooksIncomplete(candidate)

    ) {

      return candidate

    }

  }



  for (const part of parts) {

    if (narrationPlainCharCount(part) <= maxPlainChars + 6 && !narrationLooksIncomplete(part)) {

      return part

    }

  }



  const boundary = truncateAtPhraseBoundary(t, maxPlainChars)
  if (boundary && !narrationLooksIncomplete(boundary)) return boundary

  const firstLine = t
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean)
  if (firstLine && narrationPlainCharCount(firstLine) <= maxPlainChars + 10) {
    return firstLine
  }

  let buf = ""
  for (const ch of t.replace(/\n/g, " ")) {
    const next = buf + ch
    if (narrationPlainCharCount(next) > maxPlainChars && buf) break
    buf = next
  }
  buf = buf.trim()
  if (buf && !narrationLooksIncomplete(buf)) return buf

  for (const part of parts) {
    if (!narrationLooksIncomplete(part)) return part
  }

  return ""

}



/** 장면 길이에 맞게 짧은 줄(Enter)로 나눔 — 미리보기 자막 넘침 방지 */

export function wrapNarrationShortLines(text: string, sceneDurationSec: number): string {

  const maxChars = maxCharsForSceneDuration(sceneDurationSec)

  const maxLineLen =

    sceneDurationSec <= 2.5 ? 16 : sceneDurationSec <= 5 ? 18 : sceneDurationSec <= 10 ? 20 : 24

  const maxLines =

    sceneDurationSec <= 2.5 ? 2 : sceneDurationSec <= 5 ? 3 : sceneDurationSec <= 10 ? 3 : 4



  const existing = text

    .replace(/\r/g, "")

    .split("\n")

    .map((l) => l.trim())

    .filter(Boolean)



  if (existing.length > 1) {

    const joined = existing.join("\n")

    if (

      narrationPlainCharCount(joined) <= maxChars + 6 &&

      existing.every((l) => l.length <= maxLineLen + 4) &&

      existing.length <= maxLines &&

      !narrationLooksIncomplete(joined.replace(/\n/g, " "))

    ) {

      return joined

    }

  }



  const source = existing.length ? existing.join(" ") : text.trim()

  if (!source) return ""



  if (narrationPlainCharCount(source) <= maxChars + 4 && !narrationLooksIncomplete(source)) {

    return source

  }



  const lines: string[] = []

  let remaining = source



  while (remaining && lines.length < maxLines) {

    if (remaining.length <= maxLineLen) {

      lines.push(remaining)

      break

    }

    let splitAt = -1

    for (const sep of [" ", "，", ",", "·"]) {

      const idx = remaining.lastIndexOf(sep, maxLineLen)

      if (idx >= 4) {

        splitAt = idx

        break

      }

    }

    if (splitAt < 0) {
      const chunk = trimToCompleteNarration(remaining, maxLineLen)
      if (chunk) {
        lines.push(chunk)
      }
      break
    }

    const lineChunk = remaining.slice(0, splitAt).trim()
    if (lineChunk && !narrationLineLooksIncomplete(lineChunk)) {
      lines.push(lineChunk)
    } else {
      const safe = trimToCompleteNarration(remaining, maxLineLen)
      if (safe) lines.push(safe)
      break
    }

    remaining = remaining.slice(splitAt).trim()

  }

  if (remaining.trim()) {
    const tail = trimToCompleteNarration(remaining, maxChars - narrationPlainCharCount(lines.join("")))
    if (tail && !narrationLooksIncomplete(tail)) {
      lines.push(tail)
    }
  }

  const deduped = lines.filter(Boolean).filter((line, i, arr) => i === 0 || line !== arr[i - 1])
  const joined = cleanNarrationLineBreaks(deduped.join("\n"))

  if (
    !joined ||
    narrationPlainCharCount(joined) > maxChars + 6 ||
    narrationLooksIncomplete(joined)
  ) {
    return cleanNarrationLineBreaks(trimToCompleteNarration(source, maxChars))
  }

  return joined

}



/** @deprecated trimToCompleteNarration 사용 권장 */

export function truncateNarrationPlain(text: string, maxPlainChars: number): string {

  return trimToCompleteNarration(text, maxPlainChars)

}



/** AI·규칙 대본을 장면 길이에 맞게 정리 — 완결 문장은 길어도 끊지 않음 */

export function formatNarrationForSceneDuration(text: string, sceneDurationSec: number): string {

  const trimmed = text.trim()

  if (!trimmed) return ""

  const maxChars = maxCharsForSceneDuration(sceneDurationSec)
  const joined = trimmed.replace(/\n/g, " ")

  if (!narrationLooksIncomplete(joined)) {
    return cleanNarrationLineBreaks(trimmed)
  }

  const wrapped = wrapNarrationShortLines(trimmed, sceneDurationSec)
  if (wrapped && !narrationLooksIncomplete(wrapped.replace(/\n/g, " "))) {
    return wrapped
  }

  const trimmedComplete = trimToCompleteNarration(trimmed, maxChars)
  if (
    trimmedComplete &&
    !narrationLooksIncomplete(trimmedComplete) &&
    !/^쓱\s*닦여요$/i.test(trimmedComplete.replace(/\n/g, " ").trim())
  ) {
    return trimmedComplete
  }

  const completeLine = trimmed
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !narrationLineLooksIncomplete(line))
  if (completeLine) return completeLine

  return cleanNarrationLineBreaks(trimmed)

}


