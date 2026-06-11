import type { VideoAnalysis, VideoScene } from "@/lib/shotform-auto-edit-types"

/** 제품 특징·실사용·클로즈업 등 편집 우선 장면 */
const FEATURE_USAGE_KEYWORDS =
  /특징|기능|디테일|클로즈|close.?up|zoom|디자인|소재|성능|스펙|핵심|포인트|장점|효과|비교|실사용|사용법|사용\s*샷|손\s*가|손으로|착용|설치|작동|데모|사용\s*중|촬영|제품\s*단독|제품\s*클|in\s*use|demonstrat|how\s*to|feature|detail/i

const LOW_OPENING_PRIORITY = /인트로|아웃트로|로고|logo|구독|좋아요|마무리|ending|title\s*card|채널\s*소개/i

/** 후킹 첫 장면 — 임팩트·시각적 훅 (벤치마킹 「후킹 첫 장면」) */
const HOOK_IMPACT_KEYWORDS =
  /후킹|훅|hook|임팩트|impact|충격|강력|흡입|suction|vacuum|알록|이물|먼지|부스러기|스프링클|클로즈|close.?up|시선|눈길|순간|단번에|before|비포|데모|시연|제거|싹|깨끗|말끔/i

/** 편집 타임라인 앞쪽에 둘 장면일수록 높은 점수 */
export function sceneEditorialScore(
  scene: Pick<VideoScene, "importance" | "visual_type" | "content_type" | "description">
): number {
  let score = scene.importance ?? 7

  if (scene.visual_type === "demo") score += 4
  if (scene.visual_type === "product_showcase") score += 3
  if (scene.visual_type === "result") score += 2
  if (scene.visual_type === "problem") score += 0.5
  if (scene.visual_type === "cta") score -= 2
  if (scene.visual_type === "other") score -= 1

  if (scene.content_type === "product_in_use") score += 3
  if (scene.content_type === "product_only") score += 6

  const desc = scene.description || ""
  if (FEATURE_USAGE_KEYWORDS.test(desc)) score += 3
  if (LOW_OPENING_PRIORITY.test(desc)) score -= 2

  return score
}

export function compareScenesByEditorialPriority(a: VideoScene, b: VideoScene): number {
  const diff = sceneEditorialScore(b) - sceneEditorialScore(a)
  if (Math.abs(diff) > 0.01) return diff
  return a.start - b.start
}

export function boostSceneImportance(scenes: VideoScene[]): VideoScene[] {
  return scenes.map((sc) => ({
    ...sc,
    importance: Math.min(10, Math.max(1, Math.round(sceneEditorialScore(sc)))),
  }))
}

export function scoreMixPick(
  pick: { start: number; end: number; reason: string },
  analysis: VideoAnalysis | undefined
): number {
  if (!analysis) return 0

  let best = 0
  for (const sc of analysis.scenes) {
    const overlaps = pick.start < sc.end + 0.25 && pick.end > sc.start - 0.25
    if (overlaps) best = Math.max(best, sceneEditorialScore(sc))
  }

  if (analysis.vision_frames?.length) {
    for (const f of analysis.vision_frames) {
      if (f.timeSec >= pick.start - 0.1 && f.timeSec <= pick.end + 0.1) {
        if (f.content_type === "product_only") best += 3
        else if (f.content_type === "product_in_use") best += 2
        else if (f.content_type === "mixed") best += 1
      }
    }
  }

  if (FEATURE_USAGE_KEYWORDS.test(pick.reason)) best += 2
  if (LOW_OPENING_PRIORITY.test(pick.reason)) best -= 2
  return best
}

/** 후킹 첫 컷용 — 임팩트·시각적 훅 점수 (높을수록 오프닝에 적합) */
export function scoreHookImpactPick(
  pick: { start: number; end: number; reason: string },
  analysis: VideoAnalysis | undefined
): number {
  let score = scoreMixPick(pick, analysis) * 1.2

  const reason = pick.reason || ""
  if (HOOK_IMPACT_KEYWORDS.test(reason)) score += 6
  if (LOW_OPENING_PRIORITY.test(reason)) score -= 8

  if (analysis) {
    if (pick.start < analysis.duration * 0.4) score += 3
    if (analysis.videoStructure?.hook?.trim()) {
      const hookWords = analysis.videoStructure.hook
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length >= 2)
      const matched = hookWords.filter((w) => reason.includes(w.slice(0, Math.min(4, w.length)))).length
      score += Math.min(4, matched * 1.5)
    }
    for (const sc of analysis.scenes) {
      const overlaps = pick.start < sc.end + 0.2 && pick.end > sc.start - 0.2
      if (!overlaps) continue
      if (HOOK_IMPACT_KEYWORDS.test(sc.description)) score += 4
      if (sc.visual_type === "demo" || sc.visual_type === "product_showcase") score += 2
      if ((sc.importance ?? 0) >= 9) score += 2
    }
    if (analysis.vision_frames?.length) {
      for (const f of analysis.vision_frames) {
        if (f.timeSec >= pick.start - 0.15 && f.timeSec <= pick.end + 0.15 && f.content_type === "product_only") {
          score += 3
          break
        }
      }
    }
  }

  const dur = pick.end - pick.start
  if (dur >= 1.2 && dur <= 3.5) score += 1

  return score
}

/**
 * 벤치마킹 「후킹 첫 장면 — 임팩트 장면을 맨 앞에 배치」
 * 체크 없이 항상 가장 임팩트 있는 pick을 첫 컷으로 고정.
 */
export function ensureHookFirstPick<T extends { srcIndex: number; start: number; end: number; reason: string }>(
  picks: T[],
  analyses: VideoAnalysis[]
): T[] {
  if (picks.length <= 1) return picks

  const bySrc = new Map(analyses.map((a) => [a.src_index ?? 0, a]))
  let bestIdx = 0
  let bestScore = -Infinity

  for (let i = 0; i < picks.length; i++) {
    const s = scoreHookImpactPick(picks[i]!, bySrc.get(picks[i]!.srcIndex))
    if (s > bestScore) {
      bestScore = s
      bestIdx = i
    }
  }

  if (bestIdx === 0) return picks

  const hookPick = picks[bestIdx]!
  const tail = [...picks.slice(0, bestIdx), ...picks.slice(bestIdx + 1)]
  return [hookPick, ...tail]
}

/** mix picks — 제품·실사용 우선, 다중 소스는 **무조건** 영상 번갈아 (같은 풍 연속 방지) */
export function reorderMixPicksProductFirst(
  picks: Array<{ srcIndex: number; start: number; end: number; reason: string }>,
  analyses: VideoAnalysis[]
): typeof picks {
  if (picks.length <= 1) return picks

  const bySrc = new Map(analyses.map((a) => [a.src_index ?? 0, a]))
  const multi = analyses.length > 1

  type Scored = { pick: (typeof picks)[number]; idx: number; score: number }
  const scored: Scored[] = picks.map((pick, idx) => ({
    pick,
    idx,
    score: scoreMixPick(pick, bySrc.get(pick.srcIndex)),
  }))

  if (!multi) {
    scored.sort((a, b) => b.score - a.score || a.idx - b.idx)
    return scored.map((s) => s.pick)
  }

  const out: typeof picks = []
  const remaining = [...scored]
  let lastSrc = -1

  while (remaining.length) {
    let pool = remaining
    if (lastSrc >= 0 && remaining.length > 1) {
      const otherSrc = remaining.filter((r) => r.pick.srcIndex !== lastSrc)
      if (otherSrc.length) pool = otherSrc
    }
    pool.sort((a, b) => b.score - a.score || a.idx - b.idx)
    const chosenRef = pool[0]!
    const chosenIdx = remaining.indexOf(chosenRef)
    const [chosen] = remaining.splice(chosenIdx >= 0 ? chosenIdx : 0, 1)
    if (!chosen) break
    out.push(chosen.pick)
    lastSrc = chosen.pick.srcIndex
  }

  return out
}

/** 같은 소스에서 시간이 겹치거나 너무 가까운 pick 제거 */
export function mixPicksTooClose(
  a: { srcIndex: number; start: number; end: number },
  b: { srcIndex: number; start: number; end: number },
  minGapSec = 2.5
): boolean {
  if (a.srcIndex !== b.srcIndex) return false
  if (a.start < b.end && b.start < a.end) return true
  const gap =
    a.end <= b.start ? b.start - a.end : a.start >= b.end ? a.start - b.end : 0
  return gap < minGapSec
}

/** fallback·fill — 타임라인 앞·중·뒤를 골고루 돌며 서로 다른 장면 선택 */
export function scenesForPickingDiverse(scenes: VideoScene[]): VideoScene[] {
  if (scenes.length <= 3) return sortedScenesForPicking(scenes)
  const byScore = sortedScenesForPicking(scenes)
  const byTime = [...scenes].sort((a, b) => a.start - b.start)
  const out: VideoScene[] = []
  const seen = new Set<string>()
  const push = (sc: VideoScene) => {
    const key = `${sc.start.toFixed(1)}-${sc.end.toFixed(1)}`
    if (seen.has(key)) return
    seen.add(key)
    out.push(sc)
  }
  for (let i = 0; i < byScore.length; i++) {
    push(byScore[i]!)
    const tIdx = Math.min(byTime.length - 1, Math.floor((i * byTime.length) / byScore.length))
    push(byTime[tIdx]!)
  }
  return out.length ? out : byScore
}

/** fallback·fill용 — 점수 높은 장면부터 순회 */
export function sortedScenesForPicking(scenes: VideoScene[]): VideoScene[] {
  return [...scenes].sort(compareScenesByEditorialPriority)
}
