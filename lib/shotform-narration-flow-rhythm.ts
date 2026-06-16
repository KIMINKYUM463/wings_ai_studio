/** 쇼츠 나레이션 리듬 — 중간 컷은 이어 말하기(~고/~며), 첫·마지막만 완결(~요) */

import {
  cleanNarrationLineBreaks,
  NARRATION_FLOWING_ENDINGS,
} from "@/lib/shotform-narration-timing"

export { NARRATION_FLOWING_ENDINGS }

export const NARRATION_FLOW_RHYTHM_PROMPT = `**리듬(이탈 방지)**: 2번째~마지막 직전 컷은 매번 「~요」로 끝내지 말고 **~고, ~며, ~는데, ~면서, ~해서** 등 이어 말하기 어미로 끝내기. 첫 컷(후킹)과 마지막 컷(CTA)만 「~요」「~세요」 완결 허용.`

export function isFlowingNarrationEnding(text: string): boolean {
  const t = text.trim().replace(/\n/g, " ")
  return Boolean(t) && NARRATION_FLOWING_ENDINGS.test(t)
}

export function softenNarrationEndingForFlow(text: string): string {
  let t = text.trim().replace(/\n/g, " ")
  if (!t || isFlowingNarrationEnding(t)) return t
  if (/[?!…]$/.test(t)) return t

  const rules: Array<[RegExp, string]> = [
    [/편해요$/, "편하고"],
    [/쉬워요$/, "쉽고"],
    [/깔끔해요$/, "깔끔하고"],
    [/간단해요$/, "간단하고"],
    [/안정적이에요$/, "안정적이고"],
    [/확실해요$/, "확실하고"],
    [/수월해요$/, "수월하고"],
    [/좋아요$/, "좋고"],
    [/돼요$/, "되고"],
    [/나와요$/, "나오고"],
    [/있어요$/, "있고"],
    [/보여요$/, "보이고"],
    [/했어요$/, "했고"],
    [/같아요$/, "같고"],
    [/해요$/, "하고"],
    [/예요$/, "인데"],
    [/이에요$/, "이고"],
    [/죠$/, "고"],
    [/네요$/, "고"],
    [/어요$/, "고"],
  ]
  for (const [re, rep] of rules) {
    if (re.test(t)) return t.replace(re, rep)
  }
  return t
}

export function shouldUseFlowingEnding(cutIndex: number, totalCuts: number): boolean {
  if (totalCuts <= 2) return false
  if (cutIndex <= 0) return false
  if (cutIndex >= totalCuts - 1) return false
  return true
}

export function applyFlowRhythmToLine(text: string, cutIndex: number, totalCuts: number): string {
  const cleaned = cleanNarrationLineBreaks(text)
  if (!shouldUseFlowingEnding(cutIndex, totalCuts)) return cleaned

  const lines = cleaned
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
  if (!lines.length) return cleaned

  const last = lines.length - 1
  const out = lines.map((line, li) => (li === last ? softenNarrationEndingForFlow(line) : line))
  return out.join("\n")
}

export function applyFlowRhythmToScript(lines: readonly string[]): string[] {
  const total = lines.length
  return lines.map((line, i) => applyFlowRhythmToLine(line, i, total))
}
