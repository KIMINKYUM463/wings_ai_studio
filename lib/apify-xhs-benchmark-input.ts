/**
 * 小红书 Apify Actor — slug 기반 검색 input 추론 (스키마 없이 벤치마크용)
 */

export function buildXhsBenchmarkSearchInput(slug: string, keyword: string): Record<string, unknown> {
  const kw = keyword.trim()
  const s = slug.toLowerCase()
  const cookie = (process.env.APIFY_XHS_COOKIE || "").trim()
  const maxItems = Math.min(
    20,
    Math.max(8, Number(process.env.APIFY_XHS_BENCHMARK_MAX_ITEMS || 12) || 12)
  )

  if (s.includes("kuaima") && s.includes("search")) {
    return {
      categories: "全部",
      search_key: kw,
      scrape_detail: false,
      download_image: false,
      cookie_val: cookie,
      filter: "综合",
      maxItems,
    }
  }
  if (s.includes("kuaima") && s.includes("xiaohongshu") && !s.includes("profile")) {
    return {
      categories: "全部",
      search_key: kw,
      scrape_detail: s.includes("profile") ? false : true,
      download_image: false,
      cookie_val: cookie,
      filter: "综合",
      maxItems,
    }
  }
  if (s.includes("zhorex") && s.includes("rednote") && s.includes("shop")) {
    return { mode: "product_search", searchQuery: kw, maxResults: maxItems }
  }
  if (s.includes("zhorex") && s.includes("rednote")) {
    const useResidential = process.env.APIFY_XHS_RESIDENTIAL_PROXY !== "0"
    return {
      mode: "search",
      searchQuery: kw,
      maxResults: maxItems,
      sortBy: "general",
      filterByType: "video",
      filterByMinLikes: 0,
      includeComments: false,
      proxyConfiguration: useResidential
        ? { useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"] }
        : { useApifyProxy: false },
      ...(cookie ? { cookieString: cookie } : {}),
    }
  }
  if (s.includes("zen-studio") && s.includes("rednote") && s.includes("search")) {
    return {
      keywords: [kw],
      maxResults: maxItems,
      sortType: "general",
      noteType: "video",
      timeFilter: "all",
      topUpFromOtherSorts: false,
    }
  }
  if (s.includes("dltik") && s.includes("rednote")) {
    return {
      mode: "search",
      queries: [kw],
      maxResultsPerInput: maxItems,
      noteUrls: [],
      userIds: [],
      ...(cookie ? { cookiesString: cookie } : {}),
    }
  }
  if (s.includes("actorzlab") && s.includes("rednote")) {
    return { mode: "search", query: kw, maxResults: maxItems, ...(cookie ? { cookie: cookie } : {}) }
  }
  if (s.includes("habit.zhou") || s.includes("xiaohongshu-pro")) {
    return {
      mode: "search",
      keywords: [kw],
      maxItemsPerInput: maxItems,
      sortType: "general",
      noteType: "all",
    }
  }
  if (s.includes("sian.agency") && s.includes("xiaohongshu-rednote")) {
    return { mode: "search", query: kw, maxResults: maxItems }
  }
  if (s.includes("easyapi") && s.includes("search")) {
    const mi = Math.max(100, maxItems)
    return {
      keywords: [kw],
      maxItems: mi,
      sortType: "general",
      noteType: "video",
      proxyConfiguration: { useApifyProxy: false },
    }
  }
  if (s.includes("easyapi") && s.includes("all-in-one")) {
    return {
      mode: "search",
      keywords: [kw],
      maxItems: Math.max(30, maxItems),
      postUrls: [],
      profileUrls: [],
    }
  }
  if (s.includes("laishaohang") && s.includes("all-in-one")) {
    return { enableSearchModule: true, searchKeywords: [kw], maxNotesPerKeyword: maxItems }
  }
  if (s.includes("socialdatax") && s.includes("xhs")) {
    return {
      operation: "search_notes",
      keyword: kw,
      page: 1,
      sort_type: "general",
      note_type: "video",
      publish_time_range: "all",
      max_items: maxItems,
      auto_paginate: true,
    }
  }
  if (s.includes("tomato_cart")) {
    return { keywords: kw, maxItems, enableDetail: true }
  }
  if (s.includes("nexgendata") && s.includes("rednote")) {
    return { keyword: kw, maxItems, mode: "search" }
  }
  if (s.includes("sovanza") && s.includes("rednote-api")) {
    return { action: "search", keyword: kw, limit: maxItems }
  }
  if (s.includes("huggable_quote")) {
    return { mode: "search", keywords: [kw], maxItems }
  }
  if (s.includes("parsebird") && s.includes("posts")) {
    return { searchKeyword: kw, maxPosts: maxItems }
  }

  /** 범용 fallback — Actor마다 다른 필드명을 한 번에 시도 */
  return {
    mode: "search",
    keyword: kw,
    keywords: [kw],
    searchKeyword: kw,
    searchQuery: kw,
    search_key: kw,
    query: kw,
    searchKeywords: [kw],
    maxResults: maxItems,
    maxItems,
    maxNotesPerKeyword: maxItems,
  }
}
