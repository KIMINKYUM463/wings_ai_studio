import { type NextRequest, NextResponse } from "next/server"

function resolveSerpKey(body: Record<string, unknown>): string {
  const fromBody = typeof body.serpApiKey === "string" ? body.serpApiKey.trim() : ""
  if (fromBody) return fromBody
  return (process.env.SERPAPI_KEY || "").trim()
}

function googleLensFallback(imageUrl: string): string {
  return `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageUrl)}`
}

function yandexImagesFallback(imageUrl: string): string {
  return `https://yandex.com/images/search?source=cbir&rpt=imageview&url=${encodeURIComponent(imageUrl)}`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : ""
    const provider = body.provider === "yandex" ? "yandex" : "google"

    if (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://")) {
      return NextResponse.json({ error: "유효한 imageUrl(https)이 필요합니다." }, { status: 400 })
    }

    const key = resolveSerpKey(body as Record<string, unknown>)

    if (provider === "google") {
      if (key) {
        const u = new URL("https://serpapi.com/search.json")
        u.searchParams.set("engine", "google_lens")
        u.searchParams.set("url", imageUrl)
        u.searchParams.set("type", "all")
        u.searchParams.set("hl", "ko")
        u.searchParams.set("api_key", key)
        const r = await fetch(u.toString(), { next: { revalidate: 0 } })
        const data = (await r.json().catch(() => ({}))) as {
          search_metadata?: { google_lens_url?: string }
          error?: string
        }
        const target = data.search_metadata?.google_lens_url
        if (target) {
          return NextResponse.json({ targetUrl: target, source: "serpapi" as const })
        }
      }
      return NextResponse.json({
        targetUrl: googleLensFallback(imageUrl),
        source: key ? ("serpapi_fallback" as const) : ("direct" as const),
        notice: key
          ? "SerpApi 응답에 google_lens_url이 없어 직접 렌즈 링크로 열었습니다."
          : "SerpApi 키가 없어 Google 렌즈 직접 링크로 열었습니다. ShotForm 설정에 SerpApi 키를 저장하거나 서버 SERPAPI_KEY를 설정하세요.",
      })
    }

    /* yandex */
    if (key) {
      const u = new URL("https://serpapi.com/search.json")
      u.searchParams.set("engine", "yandex_images")
      u.searchParams.set("url", imageUrl)
      u.searchParams.set("api_key", key)
      const r = await fetch(u.toString(), { next: { revalidate: 0 } })
      const data = (await r.json().catch(() => ({}))) as {
        search_metadata?: { yandex_images_url?: string }
        error?: string
      }
      const target = data.search_metadata?.yandex_images_url
      if (target) {
        return NextResponse.json({ targetUrl: target, source: "serpapi" as const })
      }
    }
    return NextResponse.json({
      targetUrl: yandexImagesFallback(imageUrl),
      source: key ? ("serpapi_fallback" as const) : ("direct" as const),
      notice: key
        ? "SerpApi 응답에 yandex_images_url이 없어 얀덱스 직접 링크로 열었습니다."
        : "SerpApi 키가 없어 Yandex 이미지 직접 링크로 열었습니다. ShotForm 설정 또는 SERPAPI_KEY를 설정하세요.",
    })
  } catch (e) {
    console.error("[serpapi/lens-link]", e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "오류" }, { status: 500 })
  }
}
