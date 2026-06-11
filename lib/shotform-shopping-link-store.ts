import type {
  ShoppingLinkBlock,
  ShoppingLinkDesign,
  ShoppingLinkPageData,
  ShoppingLinkProfile,
} from "@/lib/shotform-shopping-link-types"
import {
  defaultShoppingLinkDesign,
  defaultShoppingLinkProfile,
} from "@/lib/shotform-shopping-link-types"

const DRAFT_KEY = "shotform_shopping_link_draft"

export function normalizeShoppingLinkPageData(data: ShoppingLinkPageData): ShoppingLinkPageData {
  return {
    ...data,
    profile: { ...defaultShoppingLinkProfile(), ...data.profile },
    design: { ...defaultShoppingLinkDesign(), ...data.design },
    updatedAt: data.updatedAt,
  }
}

export function loadShoppingLinkDraft(): ShoppingLinkPageData | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    return normalizeShoppingLinkPageData(JSON.parse(raw) as ShoppingLinkPageData)
  } catch {
    return null
  }
}

export function saveShoppingLinkDraft(data: ShoppingLinkPageData) {
  if (typeof window === "undefined") return
  localStorage.setItem(DRAFT_KEY, JSON.stringify(data))
}

export function createEmptyShoppingLinkDraft(): ShoppingLinkPageData {
  return {
    profile: defaultShoppingLinkProfile(),
    blocks: [],
    design: defaultShoppingLinkDesign(),
    updatedAt: new Date().toISOString(),
  }
}

export async function fetchShoppingLinkPage(slug: string): Promise<ShoppingLinkPageData | null> {
  const res = await fetch(`/api/shotform-shopping-link/${encodeURIComponent(slug)}`, { cache: "no-store" })
  if (res.status === 404) return null
  if (!res.ok) throw new Error("페이지를 불러오지 못했습니다.")
  return normalizeShoppingLinkPageData((await res.json()) as ShoppingLinkPageData)
}

export async function publishShoppingLinkPage(data: ShoppingLinkPageData): Promise<void> {
  const slug = data.profile.slug.trim()
  if (!slug) throw new Error("슬러그를 입력해 주세요.")
  const res = await fetch(`/api/shotform-shopping-link/${encodeURIComponent(slug)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(err?.error ?? "저장에 실패했습니다.")
  }
  saveShoppingLinkDraft(data)
}

export function newShoppingLinkBlock(type: "link" | "text" = "link", order = 0): ShoppingLinkBlock {
  return {
    id: crypto.randomUUID(),
    type,
    title: "",
    url: "",
    thumbnailUrl: "",
    pinned: false,
    enabled: true,
    order,
  }
}

export function sortShoppingLinkBlocks(blocks: ShoppingLinkBlock[]): ShoppingLinkBlock[] {
  return [...blocks].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return a.order - b.order
  })
}

export function patchShoppingLinkDraft(
  current: ShoppingLinkPageData,
  patch: Partial<{
    profile: Partial<ShoppingLinkProfile>
    blocks: ShoppingLinkBlock[]
    design: Partial<ShoppingLinkDesign>
  }>
): ShoppingLinkPageData {
  return {
    ...current,
    profile: patch.profile ? { ...current.profile, ...patch.profile } : current.profile,
    blocks: patch.blocks ?? current.blocks,
    design: patch.design ? { ...current.design, ...patch.design } : current.design,
    updatedAt: new Date().toISOString(),
  }
}

export async function readImageFileAsDataUrl(file: File, maxMb = 5): Promise<string> {
  if (file.size > maxMb * 1024 * 1024) throw new Error(`이미지는 최대 ${maxMb}MB까지 업로드할 수 있습니다.`)
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."))
    reader.readAsDataURL(file)
  })
}
