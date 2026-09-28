import { NextResponse } from "next/server"
import {
  buildStockPexelsQueryVariants,
  isLikelyAnimatedPexelsStock,
  semanticStockFallbackQueries,
  sortPexelsVideosByRelevance,
  tryResolvePexelsSearchQuery,
} from "@/lib/longform-v2/pexels-live-action"

export const runtime = "nodejs"
export const maxDuration = 60

type PexelsVideoFile = {
  id?: number
  quality?: string
  width?: number
  height?: number
  link?: string
  file_type?: string
}

type PexelsRawVideo = {
  id?: number
  duration?: number
  image?: string
  url?: string
  video_files?: PexelsVideoFile[]
}

export type PexelsVideoPick = {
  id: number
  duration: number
  videoUrl: string
  thumbnailUrl: string
  width?: number
  height?: number
  pageUrl?: string
}

function pickPexelsMp4(
  files: PexelsVideoFile[] | undefined,
): { url: string; width?: number; height?: number } | null {
  if (!files?.length) return null
  const mp4s = files.filter((f) => {
    const link = f.link || ""
    const ft = (f.file_type || "").toLowerCase()
    return link.includes(".mp4") || ft.includes("mp4")
  })
  const pool = mp4s.length ? mp4s : files.filter((f) => f.link)
  if (!pool.length) return null
  const sorted = [...pool].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))
  // 1080p 근처 우선, 너무 큰 4K는 피함
  const mid = sorted.find((f) => (f.width ?? 0) >= 1280 && (f.width ?? 0) <= 1920 && f.link)
  if (mid?.link) return { url: mid.link, width: mid.width, height: mid.height }
  const hd = sorted.find((f) => f.quality === "hd" && f.link)
  if (hd?.link) return { url: hd.link, width: hd.width, height: hd.height }
  const any = sorted.find((f) => f.link)
  return any?.link ? { url: any.link, width: any.width, height: any.height } : null
}

function mapPexelsVideo(v: PexelsRawVideo): PexelsVideoPick | null {
  const picked = pickPexelsMp4(v.video_files)
  if (!picked || typeof v.id !== "number") return null
  return {
    id: v.id,
    duration: typeof v.duration === "number" && v.duration > 0 ? v.duration : 10,
    videoUrl: picked.url,
    thumbnailUrl: v.image || picked.url,
    width: picked.width,
    height: picked.height,
    pageUrl: v.url,
  }
}

async function searchPexelsVideosPage(
  apiKey: string,
  apiQuery: string,
  opts: { landscape: boolean; perPage: number; page?: number },
): Promise<{ videos: PexelsRawVideo[]; error?: string }> {
  const params = new URLSearchParams({
    query: apiQuery,
    per_page: String(opts.perPage),
    page: String(opts.page ?? 1),
    size: "medium",
  })
  if (opts.landscape) params.set("orientation", "landscape")

  const res = await fetch(`https://api.pexels.com/videos/search?${params}`, {
    headers: { Authorization: apiKey, Accept: "application/json" },
    cache: "no-store",
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    console.error("[longform-v2/stock-image/videos]", res.status, errText.slice(0, 200))
    return { videos: [], error: `Pexels 영상 검색 실패 (${res.status})` }
  }

  const data = (await res.json()) as { videos?: PexelsRawVideo[] }
  return { videos: data.videos || [] }
}

function pickVideo(
  videos: PexelsRawVideo[],
  excludeIds: Set<number>,
  englishCore: string,
  opts: { filterAnimated: boolean; useRelevance: boolean; allowExcluded: boolean },
): PexelsVideoPick | null {
  let raw = videos.filter(
    (v) => typeof v.id === "number" && (opts.allowExcluded || !excludeIds.has(v.id)),
  )
  if (!raw.length) return null

  if (opts.filterAnimated) {
    const live = raw.filter(
      (v) => !isLikelyAnimatedPexelsStock({ pageUrl: v.url, imageUrl: v.image }),
    )
    if (live.length > 0) raw = live
  }

  const mapped = raw
    .map((v) => mapPexelsVideo(v))
    .filter((x): x is PexelsVideoPick => Boolean(x))

  if (!mapped.length) return null

  const ranked = opts.useRelevance
    ? sortPexelsVideosByRelevance(
        mapped.map((m) => ({
          ...m,
          pageUrl: m.pageUrl,
          imageUrl: m.thumbnailUrl,
        })),
        englishCore,
      )
    : mapped

  return (ranked[0] as PexelsVideoPick | undefined) ?? null
}

/**
 * Pexels 스톡 **영상** 검색 — 검색어를 자동으로 바꿔가며 결과가 나올 때까지 재시도
 * (엔드포인트 이름은 stock-image 이지만 Videos API 사용)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const rawQuery = String(body.query || "").trim()
    const apiKey = String(body.apiKey || process.env.PEXELS_API_KEY || "").trim()
    const excludeIds = new Set(
      (
        Array.isArray(body.excludeVideoIds)
          ? body.excludeVideoIds
          : Array.isArray(body.excludePhotoIds)
            ? body.excludePhotoIds
            : []
      )
        .map((n: unknown) => Number(n))
        .filter((n: number) => Number.isFinite(n)),
    )

    if (!rawQuery) {
      return NextResponse.json({ success: false, error: "검색어가 필요합니다." }, { status: 400 })
    }
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Pexels API 키가 필요합니다. API 설정에서 등록하세요.",
        },
        { status: 400 },
      )
    }

    const variants = buildStockPexelsQueryVariants(rawQuery)
    for (const fb of semanticStockFallbackQueries(rawQuery)) {
      if (!variants.includes(fb)) variants.push(fb)
    }

    if (variants.length === 0) {
      return NextResponse.json({ success: false, error: "검색어가 비어 있습니다." }, { status: 400 })
    }

    let lastError = ""
    const attemptModes: Array<{
      landscape: boolean
      filterAnimated: boolean
      useRelevance: boolean
      allowExcluded: boolean
    }> = [
      { landscape: true, filterAnimated: true, useRelevance: true, allowExcluded: false },
      { landscape: true, filterAnimated: false, useRelevance: false, allowExcluded: false },
      { landscape: false, filterAnimated: false, useRelevance: false, allowExcluded: false },
      { landscape: false, filterAnimated: false, useRelevance: false, allowExcluded: true },
    ]

    for (let modeIdx = 0; modeIdx < attemptModes.length; modeIdx++) {
      const mode = attemptModes[modeIdx]!
      for (const variant of variants) {
        const resolved = tryResolvePexelsSearchQuery(variant)
        if (!resolved) continue

        const { videos, error } = await searchPexelsVideosPage(apiKey, resolved.apiQuery, {
          landscape: mode.landscape,
          perPage: modeIdx >= 2 ? 30 : 15,
        })
        if (error) {
          lastError = error
          continue
        }
        if (videos.length === 0) continue

        const picked = pickVideo(videos, excludeIds, resolved.englishCore, mode)
        if (!picked) continue

        return NextResponse.json({
          success: true,
          /** 스톡 mp4 — 장면 motionVideoUrl 로 저장 */
          videoUrl: picked.videoUrl,
          /** 포스터(썸네일) — imageUrl 겸용 */
          imageUrl: picked.thumbnailUrl,
          thumbnailUrl: picked.thumbnailUrl,
          alt: rawQuery,
          videoId: picked.id,
          photoId: picked.id,
          duration: picked.duration,
          width: picked.width,
          height: picked.height,
          pexelsQuery: resolved.apiQuery,
          englishKeywords: resolved.englishCore,
          translatedFromKorean: resolved.translatedFromKorean,
          rawQuery,
          usedVariant: variant,
          relaxed: modeIdx > 0,
          mediaType: "video",
        })
      }
    }

    return NextResponse.json(
      {
        success: false,
        error:
          lastError ||
          `「${rawQuery}」및 대체 검색어로도 스톡 영상을 찾지 못했습니다. Pexels 키·네트워크를 확인해 주세요.`,
      },
      { status: lastError ? 502 : 404 },
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : "스톡 영상 검색 실패"
    console.error("[longform-v2/stock-image]", message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
