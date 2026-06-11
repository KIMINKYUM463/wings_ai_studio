import type { SerpKeyframe } from "@/lib/serpapi-product-search"

export type StoryboardTierParsed = {
  levelIdx: number
  width: number
  height: number
  count: number
  cols: number
  rows: number
  interval: number
  name: string
  sigh: string
}

/** watch / shorts HTML에서 spec 문자열만 추출 */
export function extractPlayerStoryboardSpec(html: string): string | null {
  const m = html.match(/"playerStoryboardSpecRenderer"\s*:\s*\{\s*"spec"\s*:\s*"((?:\\.|[^"\\])*)"/)
  if (!m?.[1]) return null
  return m[1].replace(/\\u0026/g, "&")
}

export function parseStoryboardSpec(specRaw: string): { baseUrl: URL; tiers: StoryboardTierParsed[] } | null {
  const spec = specRaw.replace(/\\u0026/g, "&")
  const parts = spec.split("|").map((p) => p.trim()).filter(Boolean)
  if (parts.length < 2) return null
  const baseStr = parts[0]
  if (!baseStr.includes("/sb/")) return null
  let baseUrl: URL
  try {
    baseUrl = new URL(baseStr)
  } catch {
    return null
  }
  const tiers: StoryboardTierParsed[] = []
  let levelIdx = 0
  for (let i = 1; i < parts.length; i++) {
    const f = parts[i].split("#")
    if (f.length < 8) continue
    const width = parseInt(f[0], 10)
    const height = parseInt(f[1], 10)
    const count = parseInt(f[2], 10)
    const cols = parseInt(f[3], 10)
    const rows = parseInt(f[4], 10)
    const interval = parseInt(f[5], 10)
    const name = f[6] || "default"
    const sigh = f[7] || ""
    if (Number.isNaN(width) || Number.isNaN(count) || Number.isNaN(cols) || Number.isNaN(rows)) continue
    tiers.push({ levelIdx, width, height, count, cols, rows, interval, name, sigh })
    levelIdx += 1
  }
  if (tiers.length === 0) return null
  return { baseUrl, tiers }
}

function pickMosaicTier(tiers: StoryboardTierParsed[]): StoryboardTierParsed | null {
  const mosaic = tiers.filter((t) => t.name.includes("M$") || t.name.includes("$M"))
  if (mosaic.length === 0) return null
  return [...mosaic].sort((a, b) => b.width - a.width)[0]
}

function buildStoryboardSheetUrl(baseUrl: URL, tier: StoryboardTierParsed, sheetIndex: number): string {
  const u = new URL(baseUrl.toString())
  let fileStem = tier.name
  if (tier.name.includes("M$") || tier.name === "M$M") {
    fileStem = `M${sheetIndex}`
  }
  u.pathname = u.pathname.replace(/\$L/g, String(tier.levelIdx)).replace(/\$N/g, fileStem)
  u.searchParams.set("sigh", tier.sigh)
  return u.toString()
}

/** 스토리보드 모자이크 한 칸을 잘라낸 이미지 API (9:16 카드·렌즈용) */
export function youtubeStoryboardCellImageUrl(
  sheetUrl: string,
  col: number,
  row: number,
  cols: number,
  rows: number
): string {
  const q = new URLSearchParams({
    url: sheetUrl,
    col: String(col),
    row: String(row),
    cols: String(cols),
    rows: String(rows),
  })
  return `/api/youtube-storyboard-cell?${q.toString()}`
}

function pickBestCellTier(tiers: StoryboardTierParsed[]): StoryboardTierParsed | null {
  if (tiers.length === 0) return null
  return [...tiers].sort((a, b) => {
    const cellA = (a.width / Math.max(1, a.cols)) * (a.height / Math.max(1, a.rows))
    const cellB = (b.width / Math.max(1, b.cols)) * (b.height / Math.max(1, b.rows))
    return cellB - cellA
  })[0]
}

/**
 * storyboard 모자이크를 칸 단위로 펼쳐 영상 구간별 컷 후보를 만든다(벤치마킹: 제품 나온 장면 캡처).
 */
export function storyboardCellsToCandidates(
  baseUrl: URL,
  tier: StoryboardTierParsed,
  maxSheets: number,
  maxCells: number
): SerpKeyframe[] {
  const perSheet = tier.cols * tier.rows
  const totalSheets = Math.max(1, Math.ceil(tier.count / perSheet))
  const sheetCount = Math.min(maxSheets, totalSheets, 4)
  const raw: SerpKeyframe[] = []

  for (let s = 0; s < sheetCount; s++) {
    const sheetUrl = buildStoryboardSheetUrl(baseUrl, tier, s)
    for (let r = 0; r < tier.rows; r++) {
      for (let c = 0; c < tier.cols; c++) {
        const frameIdx = s * perSheet + r * tier.cols + c
        if (frameIdx >= tier.count) continue
        const intervalMs = tier.interval > 0 ? tier.interval : 5000
        const timeSec = Math.round((frameIdx * intervalMs) / 1000)
        raw.push({
          index: raw.length + 1,
          imageUrl: youtubeStoryboardCellImageUrl(sheetUrl, c, r, tier.cols, tier.rows),
          label: timeSec > 0 ? `약 ${timeSec}초` : `컷 ${frameIdx + 1}`,
        })
      }
    }
  }

  if (raw.length <= maxCells) {
    return raw.map((k, i) => ({ ...k, index: i + 1 }))
  }

  /** 시간축을 고르게 샘플링해 다양한 장면을 남긴다 */
  const step = raw.length / maxCells
  const out: SerpKeyframe[] = []
  for (let i = 0; i < maxCells; i++) {
    const pick = raw[Math.min(raw.length - 1, Math.floor(i * step))]!
    out.push({ ...pick, index: out.length + 1 })
  }
  return out
}

/**
 * YouTube watch HTML의 storyboard spec으로 시간축이 다른 모자이크 시트 URL을 만든다(정적 썸네일보다 장면 다양성↑).
 * CDN은 Referer·UA 없으면 403일 수 있어, 호출부 fetch 옵션을 맞춘다.
 */
export function storyboardSheetsToKeyframes(
  baseUrl: URL,
  tier: StoryboardTierParsed,
  maxSheets: number
): SerpKeyframe[] {
  const perSheet = tier.cols * tier.rows
  const totalSheets = Math.max(1, Math.ceil(tier.count / perSheet))
  const n = Math.min(maxSheets, totalSheets, 12)
  const out: SerpKeyframe[] = []
  for (let s = 0; s < n; s++) {
    const imageUrl = buildStoryboardSheetUrl(baseUrl, tier, s)
    out.push({
      index: out.length + 1,
      imageUrl,
      label: `storyboard M${s} (${tier.width}×${tier.height})`,
    })
  }
  return out
}

export async function fetchYoutubeWatchHtml(videoId: string): Promise<string | null> {
  const id = videoId.trim()
  if (!id) return null
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US,en;q=0.8",
  } as const
  for (const path of [`/watch?v=${id}`, `/shorts/${id}`]) {
    try {
      const r = await fetch(`https://www.youtube.com${path}`, {
        headers,
        next: { revalidate: 0 },
      })
      if (!r.ok) continue
      const html = await r.text()
      if (html.length > 50_000 && extractPlayerStoryboardSpec(html)) return html
    } catch {
      /* try next */
    }
  }
  return null
}

export async function fetchYoutubeStoryboardCellCandidates(
  videoId: string,
  maxCells: number
): Promise<SerpKeyframe[]> {
  const html = await fetchYoutubeWatchHtml(videoId)
  if (!html) return []
  const spec = extractPlayerStoryboardSpec(html)
  if (!spec) return []
  const parsed = parseStoryboardSpec(spec)
  if (!parsed) return []
  const tier = pickBestCellTier(parsed.tiers) || pickMosaicTier(parsed.tiers) || parsed.tiers[parsed.tiers.length - 1]
  if (!tier) return []
  return storyboardCellsToCandidates(parsed.baseUrl, tier, 4, maxCells)
}

export async function fetchYoutubeStoryboardKeyframes(
  videoId: string,
  maxSheets: number
): Promise<SerpKeyframe[]> {
  const html = await fetchYoutubeWatchHtml(videoId)
  if (!html) return []
  const spec = extractPlayerStoryboardSpec(html)
  if (!spec) return []
  const parsed = parseStoryboardSpec(spec)
  if (!parsed) return []
  const tier = pickMosaicTier(parsed.tiers) || parsed.tiers[parsed.tiers.length - 1]
  return storyboardSheetsToKeyframes(parsed.baseUrl, tier, maxSheets)
}
