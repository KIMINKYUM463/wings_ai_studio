/**
 * 벤치마크 검증 — 抖音 Apify Actor 중 **영상 수집 가능** 목록만 서비스에서 사용
 */

export type DouyinVideoApifyActor = {
  slug: string
  label: string
  videoRatioPct: number
}

/** 영상 검증 Actor 2개 — sian.agency · natanielsantos (병합 수집) */
export const DOUYIN_VIDEO_APIFY_ACTORS: DouyinVideoApifyActor[] = [
  { slug: "sian.agency/douyin-scraper", label: "SIÁN Douyin", videoRatioPct: 90 },
  { slug: "natanielsantos/douyin-scraper", label: "natanielsantos Douyin", videoRatioPct: 85 },
]

export const DEFAULT_DOUYIN_VIDEO_ACTOR = DOUYIN_VIDEO_APIFY_ACTORS[0]!.slug

const SLUG_SET = new Set(DOUYIN_VIDEO_APIFY_ACTORS.map((a) => a.slug.toLowerCase()))

export function isDouyinVideoApifyActor(slug: string): boolean {
  return SLUG_SET.has(slug.trim().toLowerCase())
}

export function resolveDouyinVideoActorChain(): string[] {
  const env = (process.env.APIFY_DOUYIN_ACTOR || "").trim()
  if (env) return [normalizeDouyinVideoActorSlug(env)]
  return DOUYIN_VIDEO_APIFY_ACTORS.map((a) => a.slug)
}

export function normalizeDouyinVideoActorSlug(slug: string): string {
  const lower = slug.trim().toLowerCase()
  const hit = DOUYIN_VIDEO_APIFY_ACTORS.find((a) => a.slug.toLowerCase() === lower)
  if (hit) return hit.slug
  console.warn(
    `[apify] APIFY_DOUYIN_ACTOR=${slug} 는 영상 검증 Actor가 아닙니다. ${DEFAULT_DOUYIN_VIDEO_ACTOR} 사용. ` +
      `허용: ${DOUYIN_VIDEO_APIFY_ACTORS.map((a) => a.slug).join(", ")}`
  )
  return DEFAULT_DOUYIN_VIDEO_ACTOR
}
