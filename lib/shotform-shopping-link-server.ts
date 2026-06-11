import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"
import type { ShoppingLinkPageData } from "@/lib/shotform-shopping-link-types"
import { sanitizeShoppingLinkSlug } from "@/lib/shotform-shopping-link-types"

const DATA_DIR = path.join(process.cwd(), "data", "shotform-shopping-links")

function slugFilePath(slug: string): string {
  const safe = sanitizeShoppingLinkSlug(slug)
  if (!safe) throw new Error("INVALID_SLUG")
  return path.join(DATA_DIR, `${safe}.json`)
}

export async function readShoppingLinkPage(slug: string): Promise<ShoppingLinkPageData | null> {
  try {
    const raw = await readFile(slugFilePath(slug), "utf-8")
    return JSON.parse(raw) as ShoppingLinkPageData
  } catch {
    return null
  }
}

export async function writeShoppingLinkPage(slug: string, data: ShoppingLinkPageData): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true })
  const safe = sanitizeShoppingLinkSlug(slug)
  if (!safe) throw new Error("INVALID_SLUG")
  await writeFile(slugFilePath(safe), JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2), "utf-8")
}

export async function shoppingLinkSlugExists(slug: string, exceptSlug?: string): Promise<boolean> {
  const page = await readShoppingLinkPage(slug)
  if (!page) return false
  if (exceptSlug && sanitizeShoppingLinkSlug(exceptSlug) === sanitizeShoppingLinkSlug(slug)) return false
  return true
}
