import type { VideoAnalysis } from "@/lib/shotform-auto-edit-types"
import { descriptionSuggestsPresenterOrFace } from "@/lib/shotform-auto-edit-product-filter"

/** 원본 숏폼 제목·해시태그 — 나레이션은 한국어, 화면 맥락 참고용 */
export function extractTitleVisualHints(title: string): string {
  const t = title.trim()
  if (!t) return ""
  const tags = [...t.matchAll(/#([^\s#]+)/g)].map((m) => m[1]!.trim()).filter(Boolean)
  const plain = t.replace(/#[^\s#]+/g, " ").replace(/\s+/g, " ").trim()
  const parts = [plain, ...tags.map((tag) => `태그:${tag}`)].filter(Boolean)
  return parts.join(" · ").slice(0, 160)
}

export function collectVisionCaptionsForRange(
  analysis: VideoAnalysis,
  sourceStart: number,
  sourceEnd: number
): string[] {
  const frames = analysis.vision_frames ?? []
  const inRange = frames
    .filter((f) => f.caption?.trim() && f.timeSec >= sourceStart - 0.8 && f.timeSec <= sourceEnd + 0.8)
    .map((f) => f.caption!.trim())
    .filter((c) => !descriptionSuggestsPresenterOrFace(c))

  if (inRange.length) return [...new Set(inRange)]

  const mid = (sourceStart + sourceEnd) / 2
  let best = ""
  let bestDist = Number.POSITIVE_INFINITY
  for (const f of frames) {
    const cap = f.caption?.trim()
    if (!cap || descriptionSuggestsPresenterOrFace(cap)) continue
    const d = Math.abs(f.timeSec - mid)
    if (d < bestDist) {
      bestDist = d
      best = cap
    }
  }
  if (best && bestDist <= 8) return [best]

  return frames
    .map((f) => f.caption?.trim())
    .filter((c): c is string => Boolean(c) && !descriptionSuggestsPresenterOrFace(c!))
    .slice(0, 3)
}

export function collectSceneDescriptionsForRange(
  analysis: VideoAnalysis,
  sourceStart: number,
  sourceEnd: number
): string[] {
  const lists = [
    ...(analysis.visual_scenes ?? []).map((s) => ({
      start: s.start,
      end: s.end,
      description: s.description,
    })),
    ...analysis.scenes.map((s) => ({
      start: s.start,
      end: s.end,
      description: s.description,
    })),
  ]
  const out: string[] = []
  for (const sc of lists) {
    const overlap = Math.max(0, Math.min(sourceEnd, sc.end) - Math.max(sourceStart, sc.start))
    const desc = sc.description.replace(/^\[[^\]]+\]\s*/, "").trim()
    if (overlap > 0.08 && desc && !descriptionSuggestsPresenterOrFace(desc)) {
      out.push(desc)
    }
  }
  return [...new Set(out)].slice(0, 3)
}

/** 컷 구간 — 원본 영상 분석(제목·Vision·장면)을 한국어 대본 참고용으로 합침 */
export function buildCutSourceReference(
  analysis: VideoAnalysis | undefined,
  sourceStart: number,
  sourceEnd: number
): string {
  if (!analysis) return ""
  const titleHint = extractTitleVisualHints(analysis.title)
  const vision = collectVisionCaptionsForRange(analysis, sourceStart, sourceEnd)
  const scenes = collectSceneDescriptionsForRange(analysis, sourceStart, sourceEnd)
  const summary = analysis.summary?.trim()

  const lines: string[] = []
  if (titleHint) lines.push(`원본제목(참고): ${titleHint}`)
  if (summary && summary.length <= 80) lines.push(`원본요약: ${summary}`)
  if (vision.length) lines.push(`Vision화면: ${vision.join(" / ")}`)
  if (scenes.length) lines.push(`분석장면: ${scenes.join(" / ")}`)
  return lines.join(" | ").slice(0, 320)
}

/** 프롬프트 — 소스 영상별 중국 숏폼 맥락 (한국어 대본 작성 참고) */
export function buildSourceVideosNarrationBlock(analyses: readonly VideoAnalysis[]): string {
  if (!analyses.length) return ""
  const rows = analyses.map((a) => {
    const title = extractTitleVisualHints(a.title)
    const vision = (a.vision_frames ?? [])
      .map((f) => f.caption?.trim())
      .filter((c): c is string => Boolean(c) && !descriptionSuggestsPresenterOrFace(c!))
      .slice(0, 4)
    const scenes = [
      ...(a.visual_scenes ?? []).map((s) => s.description),
      ...a.scenes.map((s) => s.description),
    ]
      .map((d) => d.replace(/^\[[^\]]+\]\s*/, "").trim())
      .filter((d) => d && !descriptionSuggestsPresenterOrFace(d))
      .slice(0, 5)
    const parts = [
      `[${a.video_id}]`,
      title ? `제목: ${title}` : "",
      a.summary?.trim() ? `요약: ${a.summary.trim().slice(0, 60)}` : "",
      vision.length ? `Vision: ${vision.join(" · ")}` : "",
      scenes.length ? `장면: ${scenes.join(" · ")}` : "",
    ].filter(Boolean)
    return parts.join(" ")
  })
  return [
    "**원본 중국 숏폼 분석 (참고만 — 나레이션은 한국어, 화면에 보이는 내용을 이 맥락과 맞춰 작성)**",
    ...rows,
    "- 원본 제목·Vision·장면에 나온 **사물·행동·장소**를 각 컷 「화면」과 대조해 구체적으로 말할 것",
    "- 중국어·해시태그를 그대로 읽지 말고 한국어 구어체로 화면 설명",
  ].join("\n")
}

/** 빈약한 화면 설명을 원본 분석으로 보강 */
export function mergeCutVisualWithSourceReference(
  visualCard: string,
  sourceRef: string
): string {
  const desc = visualCard
    .replace(/^소스\s+[\d.:–\s]+초\s*/i, "")
    .replace(/^\(\d+(?:\.\d+)?초\)\s*/i, "")
    .trim()
  const weak = !desc || /^(제품\s*사용\s*장면|제품\s*장면)$/i.test(desc)
  if (!sourceRef) return visualCard
  if (weak) return sourceRef
  if (!visualCard.includes(sourceRef.slice(0, 24))) {
    return `${desc} | ${sourceRef}`.slice(0, 360)
  }
  return visualCard
}
