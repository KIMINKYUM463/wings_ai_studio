import { NextResponse, type NextRequest } from "next/server"
import { fetchCoupangRankedProducts } from "@/lib/server/coupang-partners"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  try {
    const modeParam = request.nextUrl.searchParams.get("mode")
    const mode = modeParam === "goldbox" || modeParam === "best" ? modeParam : "search"
    const query = request.nextUrl.searchParams.get("query")?.trim() || ""
    const categoryId = request.nextUrl.searchParams.get("categoryId")?.trim() || "1001"
    const products = await fetchCoupangRankedProducts({
      mode,
      query,
      categoryId,
      limit: 10,
    })
    return NextResponse.json({
      success: true,
      mode,
      query,
      categoryId,
      products,
      collectedAt: new Date().toISOString(),
      source: "coupang_partners",
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "쿠팡 순위 조회 실패" },
      { status: 502 }
    )
  }
}
