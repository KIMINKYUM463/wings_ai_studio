import { type NextRequest, NextResponse } from "next/server"
import {
  DOUYIN_BENCHMARK_ACTORS,
  DOUYIN_BENCHMARK_DEFAULT_KEYWORDS,
  listAllDouyinBenchmarkActors,
  runDouyinActorBenchmark,
} from "@/lib/shotform-douyin-actor-benchmark"

import { DOUYIN_VIDEO_APIFY_ACTORS } from "@/lib/apify-douyin-video-actors"

export const maxDuration = 300

function apifyTokenFromBody(body: Record<string, unknown>): string {
  return (
    (typeof body.apifyApiKey === "string" && body.apifyApiKey.trim()) ||
    process.env.APIFY_TOKEN ||
    ""
  )
}

/** GET — 선정 抖音 Actor 목록(discover=1) */
export async function GET(req: NextRequest) {
  const discover = req.nextUrl.searchParams.get("discover") === "1"

  if (discover) {
    const actors = await listAllDouyinBenchmarkActors(true)
    return NextResponse.json({
      actors,
      videoActorsOnly: true,
      discoveredCount: actors.length,
      searchableCount: actors.length,
      defaultKeywords: DOUYIN_BENCHMARK_DEFAULT_KEYWORDS,
      presetActors: DOUYIN_BENCHMARK_ACTORS,
      criteria: ["검색 결과 수", "썸네일", "좋아요/조회", "영상 URL", "속도"],
    })
  }

  return NextResponse.json({
    presetActors: DOUYIN_BENCHMARK_ACTORS,
    defaultKeywords: DOUYIN_BENCHMARK_DEFAULT_KEYWORDS,
    videoActors: DOUYIN_VIDEO_APIFY_ACTORS,
    hint: "GET ?discover=1 — 선정 抖音 Actor 2개만",
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const apifyToken = apifyTokenFromBody(body as Record<string, unknown>)
    if (!apifyToken) {
      return NextResponse.json({ error: "소스 검색 토큰이 필요합니다." }, { status: 400 })
    }

    const keywords = Array.isArray(body.keywords)
      ? body.keywords.filter((k: unknown): k is string => typeof k === "string").map((k) => k.trim()).filter(Boolean)
      : undefined
    const actorIds = Array.isArray(body.actorIds)
      ? body.actorIds.filter((k: unknown): k is string => typeof k === "string")
      : undefined
    const actorSlugs = Array.isArray(body.actorSlugs)
      ? body.actorSlugs.filter((k: unknown): k is string => typeof k === "string")
      : undefined
    const searchableOnly = body.searchableOnly !== false
    const batchOffset = typeof body.batchOffset === "number" ? body.batchOffset : undefined
    const batchSize = typeof body.batchSize === "number" ? body.batchSize : undefined

    const report = await runDouyinActorBenchmark({
      apifyToken,
      keywords,
      actorIds,
      actorSlugs,
      searchableOnly,
      batchOffset,
      batchSize,
    })

    return NextResponse.json(report)
  } catch (e) {
    console.error("[douyin-actor-benchmark]", e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "알 수 없는 오류" }, { status: 500 })
  }
}
