import sharp from "sharp"

const YT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Referer: "https://www.youtube.com/",
} as const

export async function fetchAndCropStoryboardCell(
  sheetUrl: string,
  col: number,
  row: number,
  cols: number,
  rows: number
): Promise<Buffer> {
  const upstream = await fetch(sheetUrl, { headers: YT_HEADERS, next: { revalidate: 3600 } })
  if (!upstream.ok) {
    throw new Error(`storyboard fetch failed (${upstream.status})`)
  }
  const buf = Buffer.from(await upstream.arrayBuffer())
  const meta = await sharp(buf).metadata()
  const fullW = meta.width ?? 0
  const fullH = meta.height ?? 0
  if (fullW < 2 || fullH < 2) throw new Error("invalid storyboard dimensions")

  const cellW = Math.floor(fullW / cols)
  const cellH = Math.floor(fullH / rows)
  const left = col * cellW
  const top = row * cellH
  const width = col === cols - 1 ? fullW - left : cellW
  const height = row === rows - 1 ? fullH - top : cellH

  return sharp(buf)
    .extract({ left, top, width: Math.max(1, width), height: Math.max(1, height) })
    .jpeg({ quality: 90 })
    .toBuffer()
}

export function parseStoryboardCellApiPath(pathWithQuery: string): {
  sheetUrl: string
  col: number
  row: number
  cols: number
  rows: number
} | null {
  try {
    const u = new URL(pathWithQuery, "http://local")
    if (!u.pathname.endsWith("/api/youtube-storyboard-cell") && u.pathname !== "/api/youtube-storyboard-cell") {
      return null
    }
    const sheetUrl = u.searchParams.get("url")
    if (!sheetUrl) return null
    const col = parseInt(u.searchParams.get("col") || "0", 10)
    const row = parseInt(u.searchParams.get("row") || "0", 10)
    const cols = parseInt(u.searchParams.get("cols") || "1", 10)
    const rows = parseInt(u.searchParams.get("rows") || "1", 10)
    return { sheetUrl, col, row, cols, rows }
  } catch {
    return null
  }
}

export async function keyframeImageToDataUrl(imageUrl: string, origin: string): Promise<string> {
  if (imageUrl.startsWith("data:")) return imageUrl
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) return imageUrl

  const path = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`
  const parsed = parseStoryboardCellApiPath(path)
  if (parsed) {
    const buf = await fetchAndCropStoryboardCell(
      parsed.sheetUrl,
      parsed.col,
      parsed.row,
      parsed.cols,
      parsed.rows
    )
    return `data:image/jpeg;base64,${buf.toString("base64")}`
  }

  const abs = `${origin.replace(/\/$/, "")}${path}`
  const r = await fetch(abs, { next: { revalidate: 0 } })
  if (!r.ok) return abs
  const buf = Buffer.from(await r.arrayBuffer())
  const type = r.headers.get("content-type") || "image/jpeg"
  return `data:${type};base64,${buf.toString("base64")}`
}
