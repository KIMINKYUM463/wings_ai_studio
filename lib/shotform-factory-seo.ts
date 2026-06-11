import { FACTORY_NARRATION_SEGMENTS, FACTORY_NARRATION_TOTAL_SEC } from "@/lib/shotform-factory-narration-script"

export type FactorySeoAiResult = {
  title: string
  recommendedTitles: string[]
  description: string
  tags: string[]
  hashtags: string[]
  hookShort: string
  commentCue: string
}

export function shotformOpenAiKey(): string {
  if (typeof window === "undefined") return ""
  return (localStorage.getItem("shotform_openai_api_key") || "").trim()
}

/** 3·5단계 나레이션(덮어쓰기 반영)을 SEO용 평문 대본으로 */
export function buildFactorySeoScript(overrides: Record<number, string>): string {
  return FACTORY_NARRATION_SEGMENTS.map((seg, i) => {
    const text = overrides[i + 1] ?? seg.text
    return text.replace(/\n/g, " ").trim()
  })
    .filter(Boolean)
    .join("\n")
}

/** 레퍼런스·파이프라인 제목에서 제품명 후보 추출 */
export function inferFactoryProductName(referenceTitles: string[]): string {
  const cleaned = referenceTitles.map((t) => t.trim()).filter(Boolean)
  if (cleaned.length === 0) return "쇼핑 숏폼 제품"
  const primary = cleaned[0]!
  return primary.length > 80 ? `${primary.slice(0, 77)}…` : primary
}

export function collectFactoryReferenceTitles(
  mixTitles: string[],
  pipelineTitles: string[] | undefined,
  summaryTitles: string[] | undefined
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of [...(pipelineTitles ?? []), ...(summaryTitles ?? []), ...mixTitles]) {
    const v = t.trim()
    if (!v || seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}

export function defaultFactorySeoDurationSec(audioDurationSec: number): number {
  if (Number.isFinite(audioDurationSec) && audioDurationSec > 0.5) return audioDurationSec
  return FACTORY_NARRATION_TOTAL_SEC
}
