/** 쇼핑숏폼 한국어 나레이션 — 벤치마크 기준 약 4.5자/초 */

export const KOREAN_NARRATION_CHARS_PER_SEC = 4.5

/** TTS·자막에서 완결로 인정하는 이어 말하기 어미 */
export const NARRATION_FLOWING_ENDINGS =
  /(?:하고|이며|으며|면서|는데|지만|해서|거나|니까|라서|다가|거든|인데|치고|편하고|쉽고|좋고|되고|있고|보이고|나오고|적이고|안정적이고|간단하고|확실하고|수월하고|깔끔하고|편한데|좋은데|쉬운데|깔끔한데|같고)$/

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



/** 장면 길이에 맞춘 권장 최대 글자 수 — TTS 1.25~1.5x 여유를 반영 (초단컷도 의미 있는 한 줄) */
export function maxCharsForSceneDuration(sceneDurationSec: number, ratio = 0.9): number {
  const d = Math.max(0.5, sceneDurationSec)
  // 초당 글자 × 배속 여유(1.25) × ratio — 「한번 보세요」만 남을 정도로 조이지 않음
  const withSpeedHeadroom = Math.floor(d * KOREAN_NARRATION_CHARS_PER_SEC * 1.25 * ratio)
  // 최대 배속(1.5x)으로도 영상에 들어가는 상한
  const hardCap = Math.floor(d * KOREAN_NARRATION_CHARS_PER_SEC * 1.5 * 0.92)
  // 1.5초 컷도 최소 한 짧은 구(8~12자)는 쓸 수 있게
  const floor = d < 2.2 ? 10 : d < 3.5 ? 12 : 10
  return Math.max(floor, Math.min(withSpeedHeadroom, Math.max(floor, hardCap)))
}

/**
 * 최대 TTS 배속까지 써도 영상에 들어가게 하는 글자 상한.
 * TTS 직전 강제 축약·재합성에 사용.
 */
export function maxCharsForSceneAtMaxTtsSpeed(
  sceneDurationSec: number,
  maxSpeed = 1.5,
  fillRatio = 0.92
): number {
  const d = Math.max(0.5, sceneDurationSec)
  const cap = Math.floor(d * fillRatio * maxSpeed * KOREAN_NARRATION_CHARS_PER_SEC)
  // 초단컷도 의미 구 최소 확보 (살짝 홀드될 수 있음 — 빈 「한번 보세요」보다 나음)
  const floor = d < 2.2 ? 10 : 8
  return Math.max(floor, cap)
}



/** 완결 어미 — 단독 `음`은 제외 (음식물·음향 등 명사 어간 오인 방지) */
const NARRATION_COMPLETE_ENDINGS =
  /(?:해요|해요요|합니다|하세요|하죠|하네요|하네|했어요|됐어요|됐죠|이에요|예요|거예요|어요|아요|네요|죠|요|다|네|세요|십시오|보세요|닦여요|빨아요|편해요|좋아요|깔끔해요|개운해요)$/

/** 한 줄이 완결된 나레이션인지 */
function narrationLineLooksIncomplete(line: string): boolean {
  const t = line.trim()
  if (!t) return true
  if (/[.!?…]$/.test(t)) return false
  if (NARRATION_COMPLETE_ENDINGS.test(t)) return false
  if (NARRATION_FLOWING_ENDINGS.test(t)) return false
  if (/[요죠네다음][.!?]?$/.test(t)) return false
  if (/[을를이가의에과와도로으로]$/.test(t)) return true
  // 「자를 수」「깎을 수 있」처럼 가능 표현 중간에서 끊김
  if (/(?:할|줄|갈|볼|쓸|자를|깎을|썰을|넣을|빼)\s*수$/.test(t)) return true
  if (/(?:을|를|할)\s*수\s*있$/.test(t)) return true
  if (/\s수$/.test(t) || /수\s*있$/.test(t)) return true
  // 관형형·미완성 연결 (설치하는, 간편하게 등 — 고/며 없이 끊김)
  if (/[가-힣]+(?:하는|되는|할|한)$/.test(t)) return true
  if (/하게$/.test(t) && !/하게요/.test(t)) return true
  // 형용사·부사 어간에서 끊김 (깨끗하, 부드러우 등)
  if (/[가-힣]{2,}하$/.test(t) && !/하(세요|십시오|면|니|네요|나요|죠)?$/.test(t)) return true
  if (/[가-힣]{2,}게$/.test(t)) return true
  const lastWord = t.split(/\s+/).pop() ?? t
  if (lastWord.length <= 2 && !/[요죠네다음다]$/.test(lastWord)) return true
  // 명사·수식어 어간에서 한 글자만 남은 경우 (흩어진 음 ← 음식물)
  if (/[가-힣]{2,}\s+[가-힣]$/.test(t) && lastWord.length === 1) return true
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



  // 하드 글자 절단은 미완성 문장을 만듦 — 완결일 때만 사용
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

  // 미완성 조각 반환 금지
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
  if (
    firstLine &&
    narrationPlainCharCount(firstLine) <= maxPlainChars + 10 &&
    !narrationLooksIncomplete(firstLine)
  ) {
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
    if (
      !narrationLooksIncomplete(part) &&
      narrationPlainCharCount(part) <= maxPlainChars + 8
    ) {
      return part
    }
  }

  // 미완성 하드컷 금지
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



/** AI·규칙 대본을 장면 길이에 맞게 정리 — 글자 상한 + 반드시 완결 문장 (중간 절단 금지) */
export function formatNarrationForSceneDuration(text: string, sceneDurationSec: number): string {
  const trimmed = text.trim()
  if (!trimmed) return ""
  const maxChars = maxCharsForSceneDuration(sceneDurationSec)
  const plainJoined = trimmed.replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim()
  const plainCount = narrationPlainCharCount(plainJoined)

  if (plainCount <= maxChars && !narrationLooksIncomplete(plainJoined)) {
    const wrapped = wrapNarrationShortLines(trimmed, sceneDurationSec)
    return cleanNarrationLineBreaks(wrapped || trimmed)
  }

  // 1) 상한 안 완결 구
  const trimmedComplete = trimToCompleteNarration(trimmed, maxChars)
  if (
    trimmedComplete &&
    narrationPlainCharCount(trimmedComplete) <= maxChars + 2 &&
    !narrationLooksIncomplete(trimmedComplete.replace(/\n/g, " ")) &&
    !/^쓱\s*닦여요$/i.test(trimmedComplete.replace(/\n/g, " ").trim())
  ) {
    const wrapped = wrapNarrationShortLines(trimmedComplete, sceneDurationSec)
    return cleanNarrationLineBreaks(wrapped || trimmedComplete)
  }

  // 2) 살짝 여유를 줘도 완결 구만 (중간 절단 문구 절대 반환 안 함)
  const relaxed = trimToCompleteNarration(trimmed, maxChars + 6)
  if (
    relaxed &&
    !narrationLooksIncomplete(relaxed.replace(/\n/g, " ")) &&
    narrationPlainCharCount(relaxed) <= maxChars + 8
  ) {
    return cleanNarrationLineBreaks(relaxed)
  }

  // 3) 줄 단위로 완결된 첫 줄만
  for (const line of trimmed.split("\n").map((l) => l.trim()).filter(Boolean)) {
    if (
      narrationPlainCharCount(line) <= maxChars + 4 &&
      !narrationLooksIncomplete(line)
    ) {
      return cleanNarrationLineBreaks(line)
    }
  }

  // 4) 완결 구를 못 만들면 빈 문자열 → 호출측에서 화면 기반 짧은 완결 문구 사용
  return ""
}

/**
 * TTS용 하드 클램프 — 최대 배속으로도 영상에 들어가게.
 * 중간에서 자른 미완성 문장(「자를 수」「깎을 수 있」)은 반환하지 않음.
 */
export function clampNarrationForTtsFit(
  text: string,
  videoDurSec: number,
  maxSpeed = 1.5
): string {
  const trimmed = text.trim()
  if (!trimmed) return ""
  const maxChars = maxCharsForSceneAtMaxTtsSpeed(videoDurSec, maxSpeed)
  const flat = trimmed.replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim()

  if (narrationPlainCharCount(flat) <= maxChars && !narrationLooksIncomplete(flat)) {
    return cleanNarrationLineBreaks(formatNarrationForSceneDuration(trimmed, videoDurSec) || flat)
  }

  const hard = trimToCompleteNarration(trimmed, maxChars)
  if (
    hard &&
    narrationPlainCharCount(hard) <= maxChars + 2 &&
    !narrationLooksIncomplete(hard.replace(/\n/g, " "))
  ) {
    return cleanNarrationLineBreaks(hard)
  }

  const relaxed = trimToCompleteNarration(trimmed, maxChars + 4)
  if (relaxed && !narrationLooksIncomplete(relaxed.replace(/\n/g, " "))) {
    return cleanNarrationLineBreaks(relaxed)
  }

  // 미완성 하드컷 금지 — 빈 값이면 상위에서 화면 힌트 완결 구 사용
  return ""
}


