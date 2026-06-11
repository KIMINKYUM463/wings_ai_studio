import type { MixPick, ProductVideoStructure, VideoAnalysis } from "@/lib/shotform-auto-edit-types"
import { scoreHookImpactPick, scoreMixPick } from "@/lib/shotform-scene-priority"
import { describeSourceRangeFromAnalysis } from "@/lib/shotform-visual-scene-match"

/** 벤치마킹 짜집기 — 스토리 비트 (후킹 → 소개 → 설치 → 데모 → 결과 → 마무리) */
export type StoryBeat = "hook" | "intro" | "setup" | "demo" | "result" | "close"

const BEAT_ORDER: StoryBeat[] = ["hook", "intro", "setup", "demo", "result", "close"]

const BEAT_PATTERNS: Record<StoryBeat, RegExp> = {
  hook: /4[kK]|1080|비교|분할|선명|감동|임팩트|후킹|충격|와우|impact|해상도|생생|몰입|눈길|흡입|싹|말끔|클로즈.*비교|영화.*장면/i,
  intro: /소개|공개|영화관|궁금|처음|만들|오늘|우리\s*집|투사|프로젝|이제\s*직접|혼자서도|나만의|공개할/i,
  setup: /설치|고정|나사|스크린|내리|조립|펼치|봉|벽|천장|매달|걸|지지|포장|도구|문\s*위|조립|부착/i,
  demo: /사용|조작|손|작동|버튼|데모|시연|닦|청소|조절|돌리|누르|착용|적용|분사|흡입|청소기|칫솔/i,
  result: /결과|화질|재생|영화|애니|색감|고화질|분위기|마법|풍부|선명|아이언|투사된|스크린.*재생|큰\s*화면/i,
  close: /완료|마무리|조정|설정|끝|마지막|디버그|세팅|드디어|완벽|사다리|크기\s*조정|마지막\s*디버/i,
}

function beatDistance(want: StoryBeat, got: StoryBeat): number {
  const a = BEAT_ORDER.indexOf(want)
  const b = BEAT_ORDER.indexOf(got)
  if (a < 0 || b < 0) return 4
  return Math.abs(a - b)
}

function beatMatchScore(want: StoryBeat, got: StoryBeat): number {
  if (want === got) return 12
  const dist = beatDistance(want, got)
  if (dist === 1) return 6
  if (dist === 2) return 2
  return 0
}

function pickNarrationText(pick: MixPick, analysis: VideoAnalysis | undefined): string {
  const fromReason = (pick.reason || "").trim()
  if (fromReason) return fromReason
  if (!analysis) return ""
  return describeSourceRangeFromAnalysis(analysis, pick.start, pick.end, "").trim()
}

/** pick·장면 설명 → 스토리 비트 */
export function classifyPickStoryBeat(
  pick: MixPick,
  analysis: VideoAnalysis | undefined
): StoryBeat {
  const text = pickNarrationText(pick, analysis)
  if (!text) return "demo"

  const scores: Partial<Record<StoryBeat, number>> = {}
  for (const beat of BEAT_ORDER) {
    if (BEAT_PATTERNS[beat].test(text)) scores[beat] = (scores[beat] ?? 0) + 2
  }

  if (pick.start < (analysis?.duration ?? 60) * 0.15) {
    scores.intro = (scores.intro ?? 0) + 0.5
  }
  if (pick.start > (analysis?.duration ?? 60) * 0.75) {
    scores.close = (scores.close ?? 0) + 1
  }

  let best: StoryBeat = "demo"
  let bestScore = 0
  for (const beat of BEAT_ORDER) {
    const s = scores[beat] ?? 0
    if (s > bestScore) {
      bestScore = s
      best = beat
    }
  }
  return best
}

/** pick 개수·목표 길이에 맞는 스토리 골격 */
export function buildDesiredBeatSequence(pickCount: number, _targetDuration?: number): StoryBeat[] {
  if (pickCount <= 0) return []
  if (pickCount === 1) return ["hook"]
  if (pickCount === 2) return ["hook", "close"]

  const beats: StoryBeat[] = ["hook", "intro"]
  const remaining = pickCount - 3
  const setupCount = Math.max(1, Math.round(remaining * 0.32))
  const demoCount = Math.max(1, Math.round(remaining * 0.38))
  const resultCount = Math.max(1, remaining - setupCount - demoCount)

  for (let i = 0; i < setupCount; i++) beats.push("setup")
  for (let i = 0; i < demoCount; i++) beats.push("demo")
  for (let i = 0; i < resultCount; i++) beats.push("result")
  beats.push("close")

  return beats.slice(0, pickCount)
}

function pickKey(p: MixPick): string {
  return `${p.srcIndex}:${p.start.toFixed(2)}:${p.end.toFixed(2)}`
}

/**
 * 벤치마킹 방식 — 스토리 골격에 맞게 mix picks 재배치
 * (후킹·소개 → 설치·데모 → 결과·마무리)
 */
export function reorderMixPicksByStoryFlow(
  picks: MixPick[],
  analyses: VideoAnalysis[],
  targetDuration: number,
  videoStructure?: ProductVideoStructure
): MixPick[] {
  if (picks.length <= 2) return picks

  const bySrc = new Map(analyses.map((a) => [a.src_index ?? 0, a]))
  const desired = buildDesiredBeatSequence(picks.length, targetDuration)
  const used = new Set<string>()
  const out: MixPick[] = []
  let lastSrc = -1

  const structureHint = [videoStructure?.hook, videoStructure?.body, videoStructure?.cta]
    .filter(Boolean)
    .join(" ")

  for (let slot = 0; slot < desired.length; slot++) {
    const wantBeat = desired[slot]!
    let best: MixPick | null = null
    let bestScore = -Infinity

    for (const pick of picks) {
      const key = pickKey(pick)
      if (used.has(key)) continue

      const analysis = bySrc.get(pick.srcIndex)
      let beat = classifyPickStoryBeat(pick, analysis)
      const text = pickNarrationText(pick, analysis)

      if (structureHint && BEAT_PATTERNS[wantBeat].test(structureHint)) {
        beat = wantBeat
      }

      let score = beatMatchScore(wantBeat, beat)
      score += scoreMixPick(pick, analysis) * 0.2

      if (slot === 0) {
        score += scoreHookImpactPick(pick, analysis) * 0.35
        if (beat === "hook" || beat === "result") score += 4
      }
      if (slot === desired.length - 1 && beat === "close") score += 5
      if (analyses.length > 1 && lastSrc >= 0 && pick.srcIndex !== lastSrc) score += 1.5

      if (wantBeat === "hook" && /비교|4[kK]|선명|감동|임팩트/.test(text)) score += 6
      if (wantBeat === "setup" && /설치|고정|스크린|나사/.test(text)) score += 4
      if (wantBeat === "result" && /화질|재생|영화|선명/.test(text)) score += 4

      if (score > bestScore) {
        bestScore = score
        best = pick
      }
    }

    if (!best) break
    used.add(pickKey(best))
    out.push(best)
    lastSrc = best.srcIndex
  }

  for (const pick of picks) {
    const key = pickKey(pick)
    if (!used.has(key)) out.push(pick)
  }

  return out.length >= 2 ? out : picks
}
