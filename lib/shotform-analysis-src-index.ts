import type { MixInfo, MixPick, VideoAnalysis } from "@/lib/shotform-auto-edit-types"

export function resolveAnalysisSrcIndex(analysis: VideoAnalysis, index: number): number {
  return analysis.src_index ?? index
}

export function analysisBySrcIndex(analyses: VideoAnalysis[]): Map<number, VideoAnalysis> {
  return new Map(analyses.map((a, i) => [resolveAnalysisSrcIndex(a, i), a]))
}

export function resolveVideoIdForMixPick(pick: MixPick, analyses: VideoAnalysis[]): string | undefined {
  const bySrc = analysisBySrcIndex(analyses)
  return bySrc.get(pick.srcIndex)?.video_id ?? analyses[pick.srcIndex]?.video_id
}

/** usable 필터 후 src_index·mix picks를 0..n-1로 재정렬 */
export function normalizeUsableAnalysesForMix(
  fullAnalyses: VideoAnalysis[],
  usable: VideoAnalysis[]
): { usable: VideoAnalysis[]; mixRemap: Map<number, number> } {
  const usableIds = new Set(usable.map((a) => a.video_id))
  const normalized: VideoAnalysis[] = []
  const mixRemap = new Map<number, number>()

  for (let i = 0; i < fullAnalyses.length; i++) {
    const a = fullAnalyses[i]!
    if (!usableIds.has(a.video_id)) continue
    const oldSrc = resolveAnalysisSrcIndex(a, i)
    const newSrc = normalized.length
    mixRemap.set(oldSrc, newSrc)
    normalized.push({ ...a, src_index: newSrc })
  }

  return { usable: normalized, mixRemap }
}

export function remapMixInfoSrcIndices(mix: MixInfo, remap: Map<number, number>): MixInfo {
  const picks = mix.picks
    .map((p) => {
      const newSrc = remap.get(p.srcIndex)
      if (newSrc == null) return null
      return { ...p, srcIndex: newSrc }
    })
    .filter((p): p is MixPick => p != null)

  const actualDuration = picks.reduce((s, p) => s + (p.end - p.start), 0)

  return {
    ...mix,
    picks,
    sourceCount: remap.size,
    actualDuration,
  }
}
