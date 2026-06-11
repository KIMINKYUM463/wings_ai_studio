/**
 * 벤치마크 검증 — 小红书 Apify Actor 중 **영상(playUrl) 수집 가능** 목록 (서비스)
 */

export type XhsVideoApifyActor = {
  slug: string
  label: string
  videoRatioPct: number
}

/** 서비스 — socialdatax XHS API (키워드 연관성·영상 검증) */
export const XHS_VIDEO_APIFY_ACTORS: XhsVideoApifyActor[] = [
  { slug: "socialdatax/socialdatax-xhs-data-api", label: "socialdatax XHS API", videoRatioPct: 36 },
]

export const DEFAULT_XHS_VIDEO_ACTOR = XHS_VIDEO_APIFY_ACTORS[0]!.slug

const SLUG_SET = new Set(XHS_VIDEO_APIFY_ACTORS.map((a) => a.slug.toLowerCase()))

export function isXhsVideoApifyActor(slug: string): boolean {
  return SLUG_SET.has(slug.trim().toLowerCase())
}

export function resolveXhsVideoActorChain(): string[] {
  const env = (process.env.APIFY_XHS_ACTOR || "").trim()
  if (env) return [normalizeXhsVideoActorSlug(env)]
  return XHS_VIDEO_APIFY_ACTORS.map((a) => a.slug)
}

export function normalizeXhsVideoActorSlug(slug: string): string {
  const lower = slug.trim().toLowerCase()
  const hit = XHS_VIDEO_APIFY_ACTORS.find((a) => a.slug.toLowerCase() === lower)
  if (hit) return hit.slug
  console.warn(
    `[apify] APIFY_XHS_ACTOR=${slug} 는 영상 검증 Actor가 아닙니다. ${DEFAULT_XHS_VIDEO_ACTOR} 사용. ` +
      `허용: ${XHS_VIDEO_APIFY_ACTORS.map((a) => a.slug).join(", ")}`
  )
  return DEFAULT_XHS_VIDEO_ACTOR
}

export function filterXhsVideoRows<T extends { platform?: string; videoUrl?: string }>(rows: T[]): T[] {
  return rows.filter(
    (r) =>
      (r.platform === "xiaohongshu" || !r.platform) &&
      typeof r.videoUrl === "string" &&
      r.videoUrl.startsWith("http")
  )
}
