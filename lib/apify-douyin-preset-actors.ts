/** 抖音 벤치마크·서비스 기본 검색 Actor 프리셋 */

export type DouyinPresetActor = {
  slug: string
  label: string
  description: string
}

export const DOUYIN_PRESET_SEARCH_ACTORS: DouyinPresetActor[] = [
  {
    slug: "sian.agency/douyin-scraper",
    label: "SIÁN Douyin",
    description: "operation=searchVideo · maxPages (~12건/페이지)",
  },
  {
    slug: "natanielsantos/douyin-scraper",
    label: "natanielsantos Douyin",
    description: "searchTermsOrHashtags · Full access 승인 필요할 수 있음",
  },
]

export const DEFAULT_DOUYIN_PRESET_ACTOR = DOUYIN_PRESET_SEARCH_ACTORS[0]!.slug
