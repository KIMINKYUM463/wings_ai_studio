import type {
  ShoppingLinkBlock,
  ShoppingLinkDesign,
  ShoppingLinkPageData,
  ShoppingLinkProfile,
} from "@/lib/shotform-shopping-link-types"
import {
  defaultShoppingLinkDesign,
  defaultShoppingLinkProfile,
  sanitizeShoppingLinkSlug,
} from "@/lib/shotform-shopping-link-types"

const DRAFT_KEY = "shotform_shopping_link_draft"

export function normalizeShoppingLinkPageData(data: ShoppingLinkPageData): ShoppingLinkPageData {
  return {
    profile: {
      ...defaultShoppingLinkProfile(),
      ...data.profile,
      slug: sanitizeShoppingLinkSlug(data.profile?.slug ?? ""),
    },
    blocks: Array.isArray(data.blocks) ? data.blocks : [],
    design: { ...defaultShoppingLinkDesign(), ...data.design },
    updatedAt: data.updatedAt || new Date().toISOString(),
  }
}

/** PUT 성공 후 서버 응답 검증. 저장 요청(payload)과 DB(saved)가 일치해야 합니다. */
export function assertPublishMatchesPayload(
  payload: ShoppingLinkPageData,
  saved: ShoppingLinkPageData
): ShoppingLinkPageData {
  const client = normalizeShoppingLinkPageData(payload)
  const remote = normalizeShoppingLinkPageData(saved)

  if (client.blocks.length > 0 && remote.blocks.length < client.blocks.length) {
    throw new Error(
      `블록 ${client.blocks.length}개 중 ${remote.blocks.length}개만 DB에 저장되었습니다. 「블록 저장 · 페이지에 반영」을 다시 눌러 주세요.`
    )
  }

  const wantedTitle = client.profile.displayName.trim()
  const savedTitle = remote.profile.displayName.trim()
  if (wantedTitle && savedTitle !== wantedTitle) {
    throw new Error(
      `프로필 제목이 DB에 반영되지 않았습니다. (DB: "${savedTitle}" / 요청: "${wantedTitle}")`
    )
  }

  return remote
}

/** 로컬 draft와 서버 데이터를 합칩니다. 서버에 블록이 없을 때 로컬 블록이 지워지지 않게 합니다. */
export function mergeShoppingLinkPageData(
  local: ShoppingLinkPageData,
  remote: ShoppingLinkPageData
): ShoppingLinkPageData {
  const localN = normalizeShoppingLinkPageData(local)
  const remoteN = normalizeShoppingLinkPageData(remote)
  const localTs = Date.parse(localN.updatedAt) || 0
  const remoteTs = Date.parse(remoteN.updatedAt) || 0
  const useLocal = localTs >= remoteTs
  const blocks = useLocal
    ? localN.blocks.length > 0
      ? localN.blocks
      : remoteN.blocks
    : remoteN.blocks.length > 0
      ? remoteN.blocks
      : localN.blocks
  const profile = useLocal ? localN.profile : remoteN.profile
  const design = useLocal ? localN.design : remoteN.design
  return normalizeShoppingLinkPageData({
    profile,
    design,
    blocks,
    updatedAt: new Date(Math.max(localTs, remoteTs)).toISOString(),
  })
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

export async function publishShoppingLinkPage(data: ShoppingLinkPageData): Promise<ShoppingLinkPageData> {
  const slug = sanitizeShoppingLinkSlug(data.profile.slug)
  if (!slug) throw new Error("슬러그를 영문·숫자로 입력해 주세요.")
  const payload = normalizeShoppingLinkPageData({
    ...data,
    profile: { ...data.profile, slug },
    updatedAt: new Date().toISOString(),
  })
  const res = await fetch(`/api/shotform-shopping-link/${encodeURIComponent(slug)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(err?.error ?? "저장에 실패했습니다.")
  }
  const saved = normalizeShoppingLinkPageData((await res.json()) as ShoppingLinkPageData)
  const result = assertPublishMatchesPayload(payload, saved)
  saveShoppingLinkDraft(result)
  return result
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
