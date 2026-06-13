import type { NarrationSegment } from "@/lib/shotform-factory-narration-script"
import type { MvpStudioSeoMeta } from "@/lib/mvp-studio-types"

export const MVP_SEO_TITLE_MAX = 100

export function emptyMvpStudioSeoMeta(): MvpStudioSeoMeta {
  return {
    title: "",
    recommendedTitles: [],
    description: "",
    tags: [],
    hashtags: [],
    hookShort: "",
    commentCue: "",
  }
}

/** 장면별 나레이션 → SEO API용 평문 대본 */
export function buildMvpSeoScript(segments: readonly NarrationSegment[]): string {
  return segments
    .map((seg) => seg.text.replace(/\n/g, " ").trim())
    .filter(Boolean)
    .join("\n")
}

export function collectMvpReferenceTitles(
  analysisTitles: readonly string[],
  sourceKeywords: readonly string[]
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of [...sourceKeywords, ...analysisTitles]) {
    const v = t.trim()
    if (!v || seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}

export function inferMvpSeoProductName(
  productName?: string,
  sourceKeywords?: readonly string[],
  projectName?: string
): string {
  const kw = sourceKeywords?.map((k) => k.trim()).find(Boolean)
  if (kw) return kw.length > 80 ? `${kw.slice(0, 77)}…` : kw
  const pn = productName?.trim()
  if (pn) return pn.length > 80 ? `${pn.slice(0, 77)}…` : pn
  const proj = projectName?.trim()
  if (proj) return proj.length > 80 ? `${proj.slice(0, 77)}…` : proj
  return "쇼핑 숏폼 제품"
}

export function mvpSeoMetaToCapCutSeo(meta: MvpStudioSeoMeta | undefined) {
  if (!meta?.title?.trim()) return undefined
  return {
    title: meta.title.trim(),
    description: meta.description.trim(),
    tags: meta.tags.filter(Boolean),
    hashtags: meta.hashtags.filter(Boolean),
    hookShort: meta.hookShort?.trim() || "",
    commentCue: meta.commentCue?.trim() || "",
  }
}
