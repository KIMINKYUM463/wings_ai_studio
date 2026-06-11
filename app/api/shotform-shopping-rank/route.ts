import { NextResponse } from "next/server"
import { fetchNaverShoppingRankSnapshot } from "@/lib/shotform-naver-datalab"
import type { ShoppingRankApiResponse } from "@/lib/shotform-shopping-rank-types"

export const maxDuration = 60

const EMPTY: ShoppingRankApiResponse = {
  rankings: [],
  officialTrends: [],
  recommendations: { today: [], rising: [], steady: [] },
}

export async function GET() {
  try {
    const data = await fetchNaverShoppingRankSnapshot()
    return NextResponse.json(data)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "순위 조회 실패"
    console.error("[shotform-shopping-rank]", msg)
    return NextResponse.json({ ...EMPTY, error: msg }, { status: 502 })
  }
}
