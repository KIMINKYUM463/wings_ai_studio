import type {
  MvpSeoCommonOutput,
  MvpSeoPlatformKey,
  MvpSeoPlatformOutputs,
  MvpSeoShortformOutput,
  MvpSeoYoutubeOutput,
  MvpStudioSeoMeta,
} from "@/lib/mvp-studio-types"
import {
  clampTitle,
  normalizeHashtagList,
  normalizeTagList,
  sanitizeSeoText,
} from "@/lib/mvp-studio-seo-sanitize"

function deriveHashtagsFromTags(tags: readonly string[], max = 8): string[] {
  return normalizeHashtagList(tags, max)
}

function mergeHashtagsIntoDescription(description: string, hashtags: readonly string[]): string {
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

export const MVP_SEO_PLATFORM_ORDER: MvpSeoPlatformKey[] = [
  "common",
  "youtube",
  "tiktok",
  "instagram",
  "threads",
  "naverclip",
]

export const MVP_SEO_PLATFORM_LABELS: Record<MvpSeoPlatformKey, string> = {
  common: "공통",
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  threads: "Threads",
  naverclip: "네이버 클립",
}

export function emptyCommonOutput(): MvpSeoCommonOutput {
  return {
    title: "",
    description: "",
    tags: [],
    hashtags: [],
    hookShort: "",
    commentCue: "",
  }
}

export function emptyYoutubeOutput(): MvpSeoYoutubeOutput {
  return {
    title: "",
    description: "",
    tags: [],
    hashtags: [],
    recommendedTitles: [],
    pinnedComment: "",
  }
}

export function emptyShortformOutput(): MvpSeoShortformOutput {
  return {
    title: "",
    body: "",
    hashtags: [],
    commentPrompt: "",
    cta: "",
  }
}

export function emptyPlatformOutputs(): MvpSeoPlatformOutputs {
  return {
    common: emptyCommonOutput(),
    youtube: emptyYoutubeOutput(),
    tiktok: emptyShortformOutput(),
    instagram: emptyShortformOutput(),
    threads: emptyShortformOutput(),
    naverclip: emptyShortformOutput(),
  }
}

function isBlankCommon(c: MvpSeoCommonOutput): boolean {
  return !c.title.trim() && !c.description.trim() && c.tags.length === 0
}

function isBlankYoutube(y: MvpSeoYoutubeOutput): boolean {
  return !y.title.trim() && !y.description.trim() && y.tags.length === 0
}

function isBlankShortform(s: MvpSeoShortformOutput): boolean {
  return !s.title.trim() && !s.body.trim() && s.hashtags.length === 0
}

export function sanitizeCommonOutput(
  raw: Partial<MvpSeoCommonOutput> | undefined,
  productName: string
): MvpSeoCommonOutput {
  const tags = normalizeTagList(raw?.tags, 20, [productName, "쇼핑", "숏폼", "리뷰"])
  const hashtags =
    normalizeHashtagList(raw?.hashtags, 10).length > 0
      ? normalizeHashtagList(raw?.hashtags, 10)
      : deriveHashtagsFromTags(tags, 8)
  const description = mergeHashtagsIntoDescription(
    sanitizeSeoText(raw?.description || "", 1200),
    hashtags
  )
  return {
    title: clampTitle(raw?.title || `${productName} 리뷰`, 100),
    description,
    tags,
    hashtags,
    hookShort: sanitizeSeoText(raw?.hookShort || `${productName}, 이거 실화?`, 30),
    commentCue: sanitizeSeoText(raw?.commentCue || "꿀템", 20),
  }
}

export function sanitizeYoutubeOutput(
  raw: Partial<MvpSeoYoutubeOutput> | undefined,
  productName: string,
  common?: MvpSeoCommonOutput
): MvpSeoYoutubeOutput {
  const tags = normalizeTagList(
    raw?.tags,
    20,
    common?.tags?.length ? common.tags : [productName, "쇼핑", "숏폼", "리뷰"]
  )
  const hashtags =
    normalizeHashtagList(raw?.hashtags, 10).length > 0
      ? normalizeHashtagList(raw?.hashtags, 10)
      : common?.hashtags?.length
        ? common.hashtags
        : deriveHashtagsFromTags(tags, 8)
  const description = mergeHashtagsIntoDescription(
    sanitizeSeoText(raw?.description || common?.description || "", 2000),
    hashtags
  )
  const title = clampTitle(raw?.title || common?.title || `${productName} 리뷰`, 100)
  const recommendedTitles = (Array.isArray(raw?.recommendedTitles) ? raw!.recommendedTitles : [])
    .map((t) => clampTitle(String(t), 100))
    .filter(Boolean)
    .slice(0, 5)
  return {
    title,
    description,
    tags,
    hashtags,
    recommendedTitles:
      recommendedTitles.length >= 3
        ? recommendedTitles
        : [title, `${productName} 솔직 리뷰`, `${productName} 꿀템 추천`].slice(0, 5),
    pinnedComment: sanitizeSeoText(
      raw?.pinnedComment ||
        (common?.commentCue
          ? `궁금한 점 있으면 「${common.commentCue}」라고 남겨 주세요!`
          : "궁금한 점 댓글로 남겨 주세요!"),
      200
    ),
  }
}

export function sanitizeShortformOutput(
  raw: Partial<MvpSeoShortformOutput> | undefined,
  productName: string,
  common?: MvpSeoCommonOutput
): MvpSeoShortformOutput {
  const hashtags =
    normalizeHashtagList(raw?.hashtags, 12).length > 0
      ? normalizeHashtagList(raw?.hashtags, 12)
      : common?.hashtags?.length
        ? common.hashtags.slice(0, 12)
        : deriveHashtagsFromTags(common?.tags ?? [productName], 8)

  return {
    title: clampTitle(raw?.title || common?.title || `${productName} 추천`, 80),
    body: sanitizeSeoText(raw?.body || common?.description || "", 2200),
    hashtags,
    commentPrompt: sanitizeSeoText(
      raw?.commentPrompt ||
        (common?.commentCue ? `「${common.commentCue}」 댓글 달아 주세요` : "의견 댓글로 남겨 주세요"),
      120
    ),
    cta: sanitizeSeoText(raw?.cta || common?.hookShort || "프로필 링크에서 확인해 보세요", 80),
  }
}

/** AI raw → sanitize + common 머지 + 빈 플랫폼 폴백 */
export function normalizePlatformOutputsFromAi(
  raw: Partial<MvpSeoPlatformOutputs> | undefined,
  productName: string
): MvpSeoPlatformOutputs {
  const common = sanitizeCommonOutput(raw?.common, productName)
  const youtube = sanitizeYoutubeOutput(raw?.youtube, productName, common)
  const fillShort = (key: keyof Pick<MvpSeoPlatformOutputs, "tiktok" | "instagram" | "threads" | "naverclip">) =>
    sanitizeShortformOutput(raw?.[key], productName, common)

  return {
    common,
    youtube,
    tiktok: fillShort("tiktok"),
    instagram: fillShort("instagram"),
    threads: fillShort("threads"),
    naverclip: fillShort("naverclip"),
  }
}

function mergePlatformOutputs(po: MvpSeoPlatformOutputs): MvpSeoPlatformOutputs {
  const base = emptyPlatformOutputs()
  return {
    common: { ...base.common, ...po.common },
    youtube: { ...base.youtube, ...po.youtube },
    tiktok: { ...base.tiktok, ...po.tiktok },
    instagram: { ...base.instagram, ...po.instagram },
    threads: { ...base.threads, ...po.threads },
    naverclip: { ...base.naverclip, ...po.naverclip },
  }
}

/** flat 필드 → platformOutputs hydrate (구 프로젝트 호환) */
export function hydratePlatformOutputs(meta: MvpStudioSeoMeta): MvpSeoPlatformOutputs {
  if (meta.platformOutputs) {
    const merged = mergePlatformOutputs(meta.platformOutputs)
    const hasAny =
      !isBlankCommon(merged.common) ||
      !isBlankYoutube(merged.youtube) ||
      !isBlankShortform(merged.tiktok) ||
      !isBlankShortform(merged.instagram) ||
      !isBlankShortform(merged.threads) ||
      !isBlankShortform(merged.naverclip)
    if (hasAny) return merged
  }

  const hasFlat =
    Boolean(meta.title.trim()) ||
    Boolean(meta.description.trim()) ||
    meta.tags.length > 0 ||
    meta.hashtags.length > 0

  if (!hasFlat) {
    return emptyPlatformOutputs()
  }

  const productName = meta.title.trim() || "쇼핑 숏폼 제품"
  const common = sanitizeCommonOutput(
    {
      title: meta.title,
      description: meta.description,
      tags: meta.tags,
      hashtags: meta.hashtags,
      hookShort: meta.hookShort,
      commentCue: meta.commentCue,
    },
    productName
  )

  return {
    common,
    youtube: sanitizeYoutubeOutput(
      {
        title: meta.title,
        description: meta.description,
        tags: meta.tags,
        hashtags: meta.hashtags,
        recommendedTitles: meta.recommendedTitles,
      },
      productName,
      common
    ),
    tiktok: sanitizeShortformOutput(undefined, productName, common),
    instagram: sanitizeShortformOutput(undefined, productName, common),
    threads: sanitizeShortformOutput(undefined, productName, common),
    naverclip: sanitizeShortformOutput(undefined, productName, common),
  }
}

/** platformOutputs → flat 동기화 (CapCut·기존 필드) */
export function syncFlatFromPlatformOutputs(
  outputs: MvpSeoPlatformOutputs
): Pick<
  MvpStudioSeoMeta,
  "title" | "description" | "tags" | "hashtags" | "hookShort" | "commentCue" | "recommendedTitles"
> {
  const src = outputs.common.title.trim() ? outputs.common : outputs.youtube
  const commonLike =
    "hookShort" in src
      ? (src as MvpSeoCommonOutput)
      : {
          title: outputs.youtube.title,
          description: outputs.youtube.description,
          tags: outputs.youtube.tags,
          hashtags: outputs.youtube.hashtags,
          hookShort: outputs.common.hookShort,
          commentCue: outputs.common.commentCue,
        }
  return {
    title: commonLike.title,
    description: commonLike.description,
    tags: commonLike.tags,
    hashtags: commonLike.hashtags,
    hookShort: outputs.common.hookShort || "",
    commentCue: outputs.common.commentCue || "",
    recommendedTitles: outputs.youtube.recommendedTitles,
  }
}

export function applyPlatformOutputsToMeta(
  meta: MvpStudioSeoMeta,
  outputs: MvpSeoPlatformOutputs
): MvpStudioSeoMeta {
  return {
    ...meta,
    ...syncFlatFromPlatformOutputs(outputs),
    platformOutputs: outputs,
  }
}

/**
 * 공통 탭 수정 시 — 비어 있는 플랫폼만 soft-fill.
 * 이미 내용이 있는 플랫폼은 덮지 않음.
 */
export function softFillFromCommon(
  outputs: MvpSeoPlatformOutputs,
  common: MvpSeoCommonOutput,
  productName: string
): MvpSeoPlatformOutputs {
  const next: MvpSeoPlatformOutputs = {
    ...outputs,
    common,
  }
  if (isBlankYoutube(outputs.youtube)) {
    next.youtube = sanitizeYoutubeOutput(undefined, productName, common)
  }
  for (const key of ["tiktok", "instagram", "threads", "naverclip"] as const) {
    if (isBlankShortform(outputs[key])) {
      next[key] = sanitizeShortformOutput(undefined, productName, common)
    }
  }
  return next
}

export function seoMetaIsReady(meta: MvpStudioSeoMeta): boolean {
  const po = meta.platformOutputs
  if (po?.common?.title?.trim() || (po?.common?.tags?.length ?? 0) > 0) return true
  if (po?.youtube?.title?.trim() || (po?.youtube?.tags?.length ?? 0) > 0) return true
  return Boolean(meta.title.trim() || meta.tags.length > 0)
}

export function copyTextForPlatform(
  key: MvpSeoPlatformKey,
  outputs: MvpSeoPlatformOutputs
): string {
  if (key === "common") {
    const c = outputs.common
    return [
      c.title,
      "",
      c.description,
      "",
      c.tags.join(", "),
      c.hashtags.join(" "),
      c.hookShort ? `훅: ${c.hookShort}` : "",
      c.commentCue ? `댓글: ${c.commentCue}` : "",
    ]
      .filter((l) => l !== undefined)
      .join("\n")
      .trim()
  }
  if (key === "youtube") {
    const y = outputs.youtube
    return [
      y.title,
      "",
      y.description,
      "",
      y.tags.join(", "),
      y.hashtags.join(" "),
      y.pinnedComment ? `고정댓글: ${y.pinnedComment}` : "",
    ]
      .join("\n")
      .trim()
  }
  const s = outputs[key]
  return [s.title, "", s.body, "", s.hashtags.join(" "), s.commentPrompt, s.cta]
    .filter(Boolean)
    .join("\n")
    .trim()
}
