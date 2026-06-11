/**
 * Apify Store — 抖音/Douyin 관련 Actor 자동 수집·분류
 */

export type DouyinStoreActorRole =
  | "search"
  | "download"
  | "profile"
  | "live"
  | "shop"
  | "analytics"
  | "other"

export type DiscoveredDouyinActor = {
  id: string
  slug: string
  label: string
  username: string
  name: string
  role: DouyinStoreActorRole
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

const STORE_SEARCH_QUERIES = ["douyin scraper", "douyin search", "douyin", "抖音", "tiktok china"] as const

const KNOWN_DOUYIN_ACTOR_SLUGS: Array<{ slug: string; role?: DouyinStoreActorRole; label?: string }> = [
  { slug: "sian.agency/douyin-scraper", role: "search", label: "SIÁN Douyin Scraper" },
  { slug: "natanielsantos/douyin-scraper", role: "search", label: "Douyin Scraper" },
  { slug: "zen-studio/douyin-search-scraper", role: "search", label: "Douyin Search Scraper" },
  { slug: "automation-lab/douyin-analytics-scraper", role: "search", label: "Douyin Analytics Scraper" },
  { slug: "kuaima/douyin-search", role: "search" },
  { slug: "easyapi/douyin-video-downloader", role: "download" },
  { slug: "clockworks/tiktok-scraper", role: "other", label: "TikTok (noise filter)" },
]

const DOUYIN_RE = /douyin|抖音|aweme|tiktok china|chinese tiktok/i

const NOISE_RE =
  /xiaohongshu|rednote|xhs|小红书|bilibili|youtube(?!.*short)|kick\.com|telegram|instagram|facebook|twitter|x\.com|twitch|whatsapp|wechat(?!.*douyin)|kuaishou|快手|tiktok(?! china)(?!.*douyin)|shopify|amazon|1688(?!.*douyin)/i

function slugFromItem(item: StoreItem): string | null {
  const u = item.username?.trim()
  const n = item.name?.trim()
  if (!u || !n) return null
  return `${u}/${n}`
}

function successRate30(stats?: StoreItem["stats"]): number | null {
  const s = stats?.publicActorRunStats30Days
  if (!s?.TOTAL || s.TOTAL <= 0) return null
  return Math.round(((s.SUCCEEDED ?? 0) / s.TOTAL) * 100)
}

export function classifyDouyinActor(
  slug: string,
  title: string,
  description: string
): { role: DouyinStoreActorRole; searchable: boolean } {
  const blob = `${slug} ${title} ${description}`.toLowerCase()

  if (/live.recorder|live stream|live scraper/.test(blob) && !/search/.test(blob)) {
    return { role: "live", searchable: false }
  }
  if (/download|downloader|no.watermark|without watermark/.test(blob) && !/search/.test(blob)) {
    return { role: "download", searchable: false }
  }
  if (/shop.scraper|e-commerce|product search|vendor/.test(blob) && /shop|product/.test(blob)) {
    return { role: "shop", searchable: /search/.test(blob) }
  }
  if (/profile|user scraper|creator profile/.test(blob) && !/search|analytics/.test(blob)) {
    return { role: "profile", searchable: false }
  }
  if (/analytics|xingtu|kol|trend|hashtag analytics/.test(blob)) {
    return { role: "analytics", searchable: /search|keyword/.test(blob) }
  }
  if (/search|keyword|hashtag scraper|video search/.test(blob)) {
    return { role: "search", searchable: true }
  }
  if (/scraper|crawler/.test(blob)) {
    return { role: "search", searchable: true }
  }
  return { role: "other", searchable: false }
}

function isRelevantDouyinItem(item: StoreItem): boolean {
  const slug = slugFromItem(item)
  if (!slug) return false
  if (slug === "clockworks/tiktok-scraper") return false
  const blob = `${slug} ${item.title || ""} ${item.description || ""}`
  if (!DOUYIN_RE.test(blob)) return false
  if (NOISE_RE.test(blob) && !/douyin|抖音|aweme/.test(`${item.username}/${item.name}`)) return false
  return true
}

function itemToDiscovered(item: StoreItem, source: "store" | "known"): DiscoveredDouyinActor | null {
  const slug = slugFromItem(item)
  if (!slug || slug === "clockworks/tiktok-scraper") return null
  const title = (item.title || item.name || slug).trim()
  const desc = (item.description || "").trim()
  const { role, searchable } = classifyDouyinActor(slug, title, desc)

  return {
    id: slug.replace(/\//g, "--"),
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

async function fetchStorePage(search: string, limit: number): Promise<StoreItem[]> {
  const url = new URL("https://api.apify.com/v2/store")
  url.searchParams.set("search", search)
  url.searchParams.set("limit", String(limit))
  url.searchParams.set("offset", "0")
  url.searchParams.set("sortBy", "relevance")

  const r = await fetch(url.toString(), { signal: AbortSignal.timeout(25_000) })
  if (!r.ok) return []
  const j = (await r.json()) as { data?: { items?: StoreItem[] } }
  return j.data?.items ?? []
}

export async function discoverDouyinStoreActors(): Promise<DiscoveredDouyinActor[]> {
  const bySlug = new Map<string, DiscoveredDouyinActor>()

  for (const q of STORE_SEARCH_QUERIES) {
    const items = await fetchStorePage(q, 100)
    for (const item of items) {
      if (!isRelevantDouyinItem(item)) continue
      const d = itemToDiscovered(item, "store")
      if (d) bySlug.set(d.slug, d)
    }
  }

  for (const known of KNOWN_DOUYIN_ACTOR_SLUGS) {
    if (known.slug === "clockworks/tiktok-scraper") continue
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
      if (known.role === "search" || known.role === "analytics") d.searchable = true
      bySlug.set(d.slug, d)
    }
  }

  return [...bySlug.values()].sort((a, b) => b.stats.totalRuns - a.stats.totalRuns)
}

export function discoveredDouyinToBenchmarkDef(a: DiscoveredDouyinActor) {
  const benchRole: "search" | "download" =
    a.role === "download" ? "download" : a.searchable ? "search" : "search"
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
