/**
 * Apify Store — 小红书/RedNote 관련 Actor 자동 수집·분류
 * GET https://api.apify.com/v2/store?search=...
 */

export type XhsStoreActorRole = "search" | "detail" | "download" | "profile" | "comments" | "shop" | "api" | "other"

export type DiscoveredXhsActor = {
  id: string
  slug: string
  label: string
  username: string
  name: string
  role: XhsStoreActorRole
  searchable: boolean
  description: string
  storeUrl: string
  pictureUrl?: string
  stats: {
    totalRuns: number
    totalUsers: number
    lastRunStartedAt: string | null
    successRate30dPct: number | null
  }
  source: "store" | "known"
}

type StoreItem = {
  title?: string
  name?: string
  username?: string
  description?: string
  pictureUrl?: string
  stats?: {
    totalRuns?: number
    totalUsers?: number
    lastRunStartedAt?: string
    publicActorRunStats30Days?: { SUCCEEDED?: number; TOTAL?: number }
  }
}

const STORE_SEARCH_QUERIES = ["xiaohongshu", "rednote", "xhs scraper", "小红书"] as const

/** Store 검색에 안 잡히는 것 — 수동 보강 */
const KNOWN_XHS_ACTOR_SLUGS: Array<{ slug: string; role?: XhsStoreActorRole; label?: string }> = [
  { slug: "kuaima/xiaohongshu-search", role: "search", label: "Xiaohongshu Search Scraper" },
  { slug: "kuaima/xiaohongshu", role: "detail", label: "XiaoHongShu Scraper" },
  { slug: "kuaima/xiaohongshu-profile", role: "profile" },
  { slug: "tomato_cart/xiaohongshu-search-scraper", role: "search" },
  { slug: "laishaohang/all-in-one-rednote-xiaohongshu-scraper", role: "detail" },
  { slug: "huggable_quote/xiaohongshu-all-in-one-scraper", role: "detail" },
  { slug: "voyger/xiaohongshu-crawler", role: "detail" },
  { slug: "mohamed.k.sirag/rednote-xiaohongshu-downloader-no-watermark", role: "download" },
]

const XHS_RE =
  /xiaohongshu|rednote|xhs|小红书|little red book|小红/i

const NOISE_RE =
  /bilibili|weibo(?!.*xiaohongshu)|douyin(?!.*rednote)|youtube|kick\.com|telegram|solana|booking\.com|1688|jd\.com|zhihu|youku|ixigua|truthsocial|hyperliquid|perplexity|letterboxd|g2 reviews|phone.number|domain.authority|contact.extract|douban movie|twitch|xingtu|wholesale|mcp.server|media.downloader(?!.*rednote)/i

function slugFromItem(item: StoreItem): string | null {
  const u = item.username?.trim()
  const n = item.name?.trim()
  if (!u || !n) return null
  return `${u}/${n}`
}

function successRate30(stats?: StoreItem["stats"]): number | null {
  const s = stats?.publicActorRunStats30Days
  if (!s?.TOTAL || s.TOTAL <= 0) return null
  const ok = s.SUCCEEDED ?? 0
  return Math.round((ok / s.TOTAL) * 100)
}

export function classifyXhsActor(slug: string, title: string, description: string): { role: XhsStoreActorRole; searchable: boolean } {
  const blob = `${slug} ${title} ${description}`.toLowerCase()

  if (/download|downloader|no.watermark|video.scraper api|video-audio/.test(blob) && !/search/.test(blob)) {
    return { role: "download", searchable: false }
  }
  if (/profile.scraper|user.profile|profile scraper/.test(blob) && !/search|all-in-one|posts scraper/.test(blob)) {
    return { role: "profile", searchable: false }
  }
  if (/comment/.test(blob) && !/search|all-in-one/.test(blob)) {
    return { role: "comments", searchable: false }
  }
  if (/shop.scraper|e-commerce|product search|wholesale/.test(blob) && /shop|product|vendor/.test(blob)) {
    return { role: "shop", searchable: /search/.test(blob) }
  }
  if (/\bapi\b|data api|mcp/.test(blob) && !/scraper|search/.test(blob)) {
    return { role: "api", searchable: false }
  }
  if (/search|keyword|multi-keyword/.test(blob)) {
    return { role: "search", searchable: true }
  }
  if (/all-in-one|pro scraper|posts scraper|crawler|scraper/.test(blob)) {
    return { role: "detail", searchable: true }
  }
  if (/transcript|kol.analytics|brand.monitor/.test(blob)) {
    return { role: "other", searchable: false }
  }
  return { role: "other", searchable: /scraper/.test(blob) }
}

function isRelevantXhsItem(item: StoreItem): boolean {
  const slug = slugFromItem(item)
  if (!slug) return false
  const blob = `${slug} ${item.title || ""} ${item.description || ""}`
  if (!XHS_RE.test(blob)) return false
  if (NOISE_RE.test(blob) && !XHS_RE.test(`${item.username}/${item.name}`)) return false
  return true
}

function itemToDiscovered(item: StoreItem, source: "store" | "known"): DiscoveredXhsActor | null {
  const slug = slugFromItem(item)
  if (!slug) return null
  const title = (item.title || item.name || slug).trim()
  const desc = (item.description || "").trim()
  const { role, searchable } = classifyXhsActor(slug, title, desc)
  const id = slug.replace(/\//g, "--")

  return {
    id,
    slug,
    label: title,
    username: item.username!.trim(),
    name: item.name!.trim(),
    role,
    searchable,
    description: desc.slice(0, 280),
    storeUrl: `https://apify.com/${item.username}/${item.name}`,
    pictureUrl: item.pictureUrl,
    stats: {
      totalRuns: item.stats?.totalRuns ?? 0,
      totalUsers: item.stats?.totalUsers ?? 0,
      lastRunStartedAt: item.stats?.lastRunStartedAt ?? null,
      successRate30dPct: successRate30(item.stats),
    },
    source,
  }
}

async function fetchStorePage(search: string, limit: number, offset: number): Promise<StoreItem[]> {
  const url = new URL("https://api.apify.com/v2/store")
  url.searchParams.set("search", search)
  url.searchParams.set("limit", String(limit))
  url.searchParams.set("offset", String(offset))
  url.searchParams.set("sortBy", "relevance")

  const r = await fetch(url.toString(), { signal: AbortSignal.timeout(25_000) })
  if (!r.ok) return []
  const j = (await r.json()) as { data?: { items?: StoreItem[] } }
  return j.data?.items ?? []
}

/** Apify Store에서 小红书 관련 Actor 전부 수집 (중복 제거·노이즈 필터) */
export async function discoverXhsStoreActors(): Promise<DiscoveredXhsActor[]> {
  const bySlug = new Map<string, DiscoveredXhsActor>()

  for (const q of STORE_SEARCH_QUERIES) {
    const items = await fetchStorePage(q, 100, 0)
    for (const item of items) {
      if (!isRelevantXhsItem(item)) continue
      const d = itemToDiscovered(item, "store")
      if (d) bySlug.set(d.slug, d)
    }
  }

  for (const known of KNOWN_XHS_ACTOR_SLUGS) {
    if (bySlug.has(known.slug)) continue
    const [username, name] = known.slug.split("/")
    const d = itemToDiscovered(
      {
        username,
        name,
        title: known.label || name,
        description: "Known actor (Store search miss)",
      },
      "known"
    )
    if (d) {
      if (known.role) d.role = known.role
      if (known.role === "search" || known.role === "detail") d.searchable = true
      bySlug.set(d.slug, d)
    }
  }

  return [...bySlug.values()].sort((a, b) => b.stats.totalRuns - a.stats.totalRuns)
}

export function discoveredToBenchmarkDef(a: DiscoveredXhsActor) {
  const benchRole: "search" | "detail" | "download" =
    a.role === "download" ? "download" : a.searchable ? "search" : "detail"
  return {
    id: a.id,
    slug: a.slug,
    label: a.label,
    role: benchRole,
    rank: 0,
    description: a.description,
    storeUrl: a.storeUrl,
    searchable: a.searchable,
    storeRole: a.role,
    stats: a.stats,
  }
}
