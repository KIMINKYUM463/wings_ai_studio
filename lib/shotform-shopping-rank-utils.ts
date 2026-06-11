import type { ShoppingRankEntry } from "@/lib/shotform-shopping-rank-types"

export function formatShoppingRankDateLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split("-")
  if (!y || !m || !d) return isoDate
  return `${y}.${m}.${d}`
}

export function formatCollectedAtKorean(iso: string): string {
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return iso
  return dt.toLocaleString("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  })
}

export function naverShoppingSearchUrl(keyword: string): string {
  return `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(keyword)}`
}

export function groupRankingsByDate(
  rankings: ShoppingRankEntry[],
  categoryName: string
): { date: string; items: ShoppingRankEntry[] }[] {
  const byDate = new Map<string, ShoppingRankEntry[]>()
  for (const row of rankings) {
    if (row.category_name !== categoryName) continue
    const list = byDate.get(row.target_date) ?? []
    list.push(row)
    byDate.set(row.target_date, list)
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({
      date,
      items: [...items].sort((x, y) => x.rank_order - y.rank_order),
    }))
}
