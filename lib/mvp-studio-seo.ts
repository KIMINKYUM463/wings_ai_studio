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

export function deriveHashtagsFromTags(tags: readonly string[], max = 8): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of tags) {
    const core = String(raw).trim().replace(/^#+/, "")
    if (!core) continue
    const key = core.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(`#${core}`)
    if (out.length >= max) break
  }
  return out
}

/** 설명 첫 줄에 해시태그가 없으면 자동 삽입 */
export function mergeHashtagsIntoDescription(description: string, hashtags: readonly string[]): string {
  const line = hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ").trim()
  if (!line) return description
  const trimmed = description.trim()
  if (!trimmed) return line
  const firstLine = trimmed.split("\n")[0]?.trim() ?? ""
  if (firstLine.includes("#") && hashtags.some((h) => trimmed.includes(h.replace(/^#/, "")))) {
    return description
  }
  if (trimmed.startsWith(line)) return description
  return `${line}\n\n${trimmed}`
}

export function syncSeoMetaFromTags(meta: MvpStudioSeoMeta): MvpStudioSeoMeta {
  const tags = meta.tags.map((t) => t.trim()).filter(Boolean)
  const hashtags =
    meta.hashtags.length > 0 ? meta.hashtags : deriveHashtagsFromTags(tags, 8)
  return {
    ...meta,
    tags,
    hashtags,
    description: mergeHashtagsIntoDescription(meta.description, hashtags),
  }
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
