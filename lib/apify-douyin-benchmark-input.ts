/**
 * 抖音 Apify Actor — slug 기반 검색 input 추론 (벤치마크용)
 */

export function buildDouyinBenchmarkSearchInput(slug: string, keyword: string): Record<string, unknown> {
  const kw = keyword.trim()
  const s = slug.toLowerCase()
  const maxPerQuery = Math.min(
    20,
    Math.max(8, Number(process.env.APIFY_DOUYIN_BENCHMARK_MAX_ITEMS || process.env.APIFY_DOUYIN_COUNT || 12) || 12)
  )

  if (s.includes("zen-studio") && s.includes("douyin") && s.includes("search")) {
    return {
      keywords: [kw],
      maxResultsPerQuery: maxPerQuery,
      sort: "general",
      publishTime: "unlimited",
      duration: "unlimited",
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      shouldDownloadSlideshowImages: false,
    }
  }

  if (s.includes("sian.agency") && s.includes("douyin-scraper")) {
    const perPage = 12
    const maxPages = Math.min(50, Math.max(1, Math.ceil(maxPerQuery / perPage)))
    return {
      operation: "searchVideo",
      keyword: kw,
      maxPages,
    }
  }

  if (s.includes("natanielsantos") && s.includes("douyin")) {
    return {
      searchTermsOrHashtags: [kw],
      searchSortFilter: "general",
      searchPublishTimeFilter: "all",
      searchDurationFilter: "all",
      maxItemsPerUrl: maxPerQuery,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
    }
  }

  if (s.includes("automation-lab") && s.includes("douyin")) {
    return {
      mode: "search",
      keywords: [kw],
      searchType: "video",
      userUrls: [],
      maxResults: maxPerQuery,
    }
  }

  if (s.includes("kuaima") && s.includes("douyin")) {
    return { search_by_keywords: kw }
  }

  if (s.includes("easyapi") && s.includes("douyin") && s.includes("search")) {
    return { keyword: kw, maxItems: maxPerQuery }
  }

  return {
    mode: "search",
    keyword: kw,
    keywords: [kw],
    searchKeyword: kw,
    searchQuery: kw,
    query: kw,
    maxResults: maxPerQuery,
    maxResultsPerQuery: maxPerQuery,
    count: maxPerQuery,
  }
}
