import { NextRequest, NextResponse } from "next/server"
import type { ShoppingLinkPageData } from "@/lib/shotform-shopping-link-types"
import { sanitizeShoppingLinkSlug } from "@/lib/shotform-shopping-link-types"
import { readShoppingLinkPage, writeShoppingLinkPage } from "@/lib/shotform-shopping-link-server"
import { normalizeShoppingLinkPageData } from "@/lib/shotform-shopping-link-store"

type RouteContext = { params: Promise<{ slug: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  const { slug } = await context.params
  const safe = sanitizeShoppingLinkSlug(slug)
  if (!safe) return NextResponse.json({ error: "INVALID_SLUG" }, { status: 400 })

  const page = await readShoppingLinkPage(safe)
  if (!page) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })
  return NextResponse.json(normalizeShoppingLinkPageData(page))
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { slug: routeSlug } = await context.params
  const safeRoute = sanitizeShoppingLinkSlug(routeSlug)
  if (!safeRoute) return NextResponse.json({ error: "INVALID_SLUG" }, { status: 400 })

  let body: ShoppingLinkPageData
  try {
    body = (await request.json()) as ShoppingLinkPageData
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 })
  }

  const safeBody = sanitizeShoppingLinkSlug(body.profile?.slug ?? "")
  if (!safeBody) return NextResponse.json({ error: "슬러그를 입력해 주세요." }, { status: 400 })
  if (safeBody !== safeRoute) {
    return NextResponse.json({ error: "URL 슬러그와 저장 데이터가 일치하지 않습니다." }, { status: 400 })
  }
  if (!body.profile.displayName.trim()) {
    return NextResponse.json({ error: "제목을 입력해 주세요." }, { status: 400 })
  }

  const normalized = normalizeShoppingLinkPageData({
    ...body,
    profile: { ...body.profile, slug: safeBody },
  })
  try {
    await writeShoppingLinkPage(safeBody, normalized)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "저장에 실패했습니다."
    console.error("[shotform-shopping-link] PUT failed:", e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
  return NextResponse.json({ ok: true, slug: safeBody })
}
