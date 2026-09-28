import { NextResponse } from "next/server"
import {
  buildStockPexelsQueryVariants,
  isLikelyAnimatedPexelsStock,
  sortPexelsVideosByRelevance,
  tryResolvePexelsSearchQuery,
} from "@/lib/longform-v2/pexels-live-action"

export const runtime = "nodejs"
export const maxDuration = 45

type PexelsPhoto = {
  id: number
  alt?: string
  url?: string
  src?: { large2x?: string; large?: string; medium?: string; original?: string }
}

/**
 * Pexels 스톡 이미지 검색 — WingsStudio 실사 bias(KO→EN · live-action · 애니 제외) 반영
 * (웹 최종 합성은 정지 이미지+TTS이므로 Photos API 사용, 검색 쿼리/필터는 원본과 동일)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const rawQuery = String(body.query || "").trim()
    const apiKey = String(body.apiKey || process.env.PEXELS_API_KEY || "").trim()
    const excludeIds = new Set(
      (Array.isArray(body.excludePhotoIds) ? body.excludePhotoIds : [])
        .map((n: unknown) => Number(n))
        .filter((n: number) => Number.isFinite(n))
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
        { status: 400 }
      )
    }

    const variants = buildStockPexelsQueryVariants(rawQuery)
    if (variants.length === 0) {
      return NextResponse.json({ success: false, error: "검색어가 비어 있습니다." }, { status: 400 })
    }

    let lastError = ""
    let usedQuery = ""
    let englishKeywords = ""
    let translatedFromKorean = false

    for (const variant of variants) {
      const resolved = tryResolvePexelsSearchQuery(variant)
      if (!resolved) continue

      usedQuery = resolved.apiQuery
      englishKeywords = resolved.englishCore
      translatedFromKorean = resolved.translatedFromKorean

      const params = new URLSearchParams({
        query: resolved.apiQuery,
        per_page: "15",
        orientation: "landscape",
      })
      const res = await fetch(`https://api.pexels.com/v1/search?${params}`, {
        headers: { Authorization: apiKey, Accept: "application/json" },
        cache: "no-store",
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => "")
        lastError = `Pexels 검색 실패 (${res.status})`
        console.error("[longform-v2/stock-image]", res.status, errText.slice(0, 200))
        continue
      }

      const data = (await res.json()) as { photos?: PexelsPhoto[] }
      const photos = (data.photos || []).filter((p) => p?.id && !excludeIds.has(p.id))
      if (photos.length === 0) continue

      const liveAction = photos.filter(
        (p) =>
          !isLikelyAnimatedPexelsStock({
            pageUrl: p.url,
            imageUrl: p.src?.large || p.src?.medium || p.src?.original,
          })
      )
      const pool = liveAction.length > 0 ? liveAction : photos

      const ranked = sortPexelsVideosByRelevance(
        pool.map((p) => ({
          ...p,
          pageUrl: p.url,
          imageUrl: p.src?.large || p.src?.medium,
        })),
        resolved.englishCore
      )

      const photo = ranked[0] as PexelsPhoto | undefined
      const imageUrl =
        photo?.src?.large2x ||
        photo?.src?.large ||
        photo?.src?.original ||
        photo?.src?.medium ||
        ""

      if (!photo || !imageUrl) continue

      return NextResponse.json({
        success: true,
        imageUrl,
        alt: photo.alt || rawQuery,
        photoId: photo.id,
        pexelsQuery: usedQuery,
        englishKeywords,
        translatedFromKorean,
        rawQuery,
      })
    }

    return NextResponse.json(
      {
        success: false,
        error:
          lastError ||
          `「${rawQuery}」에 맞는 실사 스톡 이미지를 찾지 못했습니다. 검색어를 바꿔 보세요.`,
      },
      { status: lastError ? 502 : 404 }
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : "스톡 검색 실패"
    console.error("[longform-v2/stock-image]", message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
