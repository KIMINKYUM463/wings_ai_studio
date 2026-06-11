import { type NextRequest, NextResponse } from "next/server"
import {
  listAllXhsBenchmarkActors,
  runXhsActorBenchmark,
  XHS_BENCHMARK_ACTORS,
  XHS_BENCHMARK_DEFAULT_KEYWORDS,
} from "@/lib/shotform-xhs-actor-benchmark"
import { XHS_VIDEO_APIFY_ACTORS } from "@/lib/apify-xhs-video-actors"

export const maxDuration = 300

function apifyTokenFromBody(body: Record<string, unknown>): string {
  return (
    (typeof body.apifyApiKey === "string" && body.apifyApiKey.trim()) ||
    process.env.APIFY_TOKEN ||
    ""
  )
}

/** GET — 선정 小红书 Actor (socialdatax) */
export async function GET(req: NextRequest) {
  const discover = req.nextUrl.searchParams.get("discover") === "1"

  if (discover) {
    const actors = await listAllXhsBenchmarkActors(true)
    return NextResponse.json({
      actors,
      videoActorsOnly: true,
      discoveredCount: actors.length,
      searchableCount: actors.length,
      serviceActors: XHS_VIDEO_APIFY_ACTORS,
      defaultKeywords: XHS_BENCHMARK_DEFAULT_KEYWORDS,
      criteria: ["키워드 연관성", "영상 playUrl", "썸네일", "속도"],
    })
  }

  return NextResponse.json({
    presetActors: XHS_BENCHMARK_ACTORS,
    defaultKeywords: XHS_BENCHMARK_DEFAULT_KEYWORDS,
    videoActors: XHS_VIDEO_APIFY_ACTORS,
    hint: "GET ?discover=1 — socialdatax/socialdatax-xhs-data-api",
  })
}

/** POST — Actor 벤치마크 (배치 지원) */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const apifyToken = apifyTokenFromBody(body as Record<string, unknown>)

    if (!apifyToken) {
      return NextResponse.json(
        { error: "소스 검색 토큰이 필요합니다." },
        { status: 400 }
      )
    }

    const keywords = Array.isArray(body.keywords)
      ? body.keywords.filter((k): k is string => typeof k === "string").map((k) => k.trim()).filter(Boolean)
      : undefined

    const actorIds = Array.isArray(body.actorIds)
      ? body.actorIds.filter((k): k is string => typeof k === "string")
      : undefined

    const actorSlugs = Array.isArray(body.actorSlugs)
      ? body.actorSlugs.filter((k): k is string => typeof k === "string")
      : undefined

    const testDownload = body.testDownload === true
    const searchableOnly = body.searchableOnly !== false
    const batchOffset = typeof body.batchOffset === "number" ? body.batchOffset : undefined
    const batchSize = typeof body.batchSize === "number" ? body.batchSize : undefined

    const report = await runXhsActorBenchmark({
      apifyToken,
      keywords,
      actorIds,
      actorSlugs,
      searchableOnly,
      testDownload,
      batchOffset,
      batchSize,
    })

    return NextResponse.json(report)
  } catch (e) {
    console.error("[xhs-actor-benchmark]", e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "알 수 없는 오류" }, { status: 500 })
  }
}
