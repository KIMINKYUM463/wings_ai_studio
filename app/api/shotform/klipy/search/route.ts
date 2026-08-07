import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

type KlipyFile = {
  url?: string
  width?: number
  height?: number
}

type KlipyItem = {
  id?: string | number
  title?: string
  slug?: string
  file?: {
    sm?: { gif?: KlipyFile; webp?: KlipyFile }
    md?: { gif?: KlipyFile; webp?: KlipyFile }
    hd?: { gif?: KlipyFile; webp?: KlipyFile }
  }
  media_formats?: Record<string, { url?: string }>
}

function pickUrl(item: KlipyItem): { mediaUrl: string; thumbnailUrl: string } | null {
  const md = item.file?.md?.gif?.url || item.file?.md?.webp?.url
  const sm = item.file?.sm?.gif?.url || item.file?.sm?.webp?.url
  const hd = item.file?.hd?.gif?.url || item.file?.hd?.webp?.url
  const legacy =
    item.media_formats?.gif?.url ||
    item.media_formats?.mediumgif?.url ||
    item.media_formats?.tinygif?.url
  const mediaUrl = (md || hd || sm || legacy || "").trim()
  if (!mediaUrl.startsWith("http")) return null
  const thumbnailUrl = (sm || md || mediaUrl).trim()
  return { mediaUrl, thumbnailUrl }
}

export async function GET(request: NextRequest) {
  try {
    const q = (request.nextUrl.searchParams.get("q") || "").trim()
    const limit = Math.min(
      40,
      Math.max(1, Number(request.nextUrl.searchParams.get("limit") || 24) || 24)
    )
    const apiKey =
      (request.nextUrl.searchParams.get("apiKey") || "").trim() ||
      process.env.KLIPY_API_KEY ||
      process.env.SHOTFORM_KLIPY_API_KEY ||
      ""

    if (!apiKey) {
      return NextResponse.json(
        { error: "Klipy API 키가 필요합니다. 설정에서 저장해주세요." },
        { status: 503 }
      )
    }
    if (!q) {
      return NextResponse.json({ error: "검색어가 필요합니다." }, { status: 400 })
    }

    const url = new URL(`https://api.klipy.com/api/v1/${encodeURIComponent(apiKey)}/gifs/search`)
    url.searchParams.set("q", q)
    url.searchParams.set("limit", String(limit))
    url.searchParams.set("locale", "ko_KR")

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string
      message?: string
      data?: { data?: KlipyItem[]; items?: KlipyItem[] } | KlipyItem[]
      results?: KlipyItem[]
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            payload.error ||
            payload.message ||
            `Klipy 검색 실패 (${response.status})`,
        },
        { status: response.status >= 400 ? response.status : 502 }
      )
    }

    const rawList: KlipyItem[] = Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload.data?.data)
        ? payload.data.data
        : Array.isArray(payload.data?.items)
          ? payload.data.items
          : Array.isArray(payload.results)
            ? payload.results
            : []

    const items = rawList
      .map((item, index) => {
        const urls = pickUrl(item)
        if (!urls) return null
        return {
          id: `klipy-${item.id ?? index}`,
          title: item.title || item.slug || q,
          thumbnailUrl: urls.thumbnailUrl,
          mediaUrl: urls.mediaUrl,
          pageUrl: urls.mediaUrl,
          mediaType: "image" as const,
          source: "upload" as const,
          attribution: "Klipy GIF",
        }
      })
      .filter(Boolean)

    return NextResponse.json({ success: true, items })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Klipy 검색에 실패했습니다." },
      { status: 500 }
    )
  }
}
