import { MAX_AUTO_EDIT_VIDEOS } from "@/lib/shotform-auto-edit-types"
import { extractXhsNoteId, normalizeXhsNoteUrl } from "@/lib/xhs-video"

export type MvpSourcePlatform = "douyin" | "xiaohongshu" | "tiktok"

export type MvpResolvedUrlItem = {
  inputUrl: string
  noteUrl: string
  videoUrl: string
  platform: MvpSourcePlatform
  title: string
  error?: string
}

const DOUYIN_HOST_RE = /douyin\.com|iesdouyin\.com|v\.douyin\.com/i

export function isDouyinNotePageUrl(url: string): boolean {
  return DOUYIN_HOST_RE.test(url.trim())
}

export function detectMvpUrlPlatform(url: string): MvpSourcePlatform | null {
  const u = url.trim()
  if (extractXhsNoteId(u) || u.includes("xhslink.com")) return "xiaohongshu"
  if (isDouyinNotePageUrl(u)) return "douyin"
  if (/tiktok\.com/i.test(u)) return "tiktok"
  return null
}

export function normalizeMvpDirectInputUrl(url: string): string {
  const u = url.trim()
  if (extractXhsNoteId(u)) return normalizeXhsNoteUrl(u)
  return u
}

export const MVP_DIRECT_URL_MIN_SLOTS = 2

/** UI 슬롯 ↔ 저장용 텍스트 (줄바꿈 구분) */
export function mvpDirectUrlSlotsFromText(text: string, max = MAX_AUTO_EDIT_VIDEOS): string[] {
  const trimmed = text.trim()
  if (!trimmed) {
    return Array.from({ length: MVP_DIRECT_URL_MIN_SLOTS }, () => "")
  }
  const parts = trimmed.split("\n").map((s) => s.trim())
  while (parts.length < MVP_DIRECT_URL_MIN_SLOTS) parts.push("")
  return parts.slice(0, max)
}

export function mvpDirectUrlTextFromSlots(slots: string[]): string {
  return slots.map((s) => s.trim()).filter(Boolean).join("\n")
}

export function mvpDirectUrlVisibleSlotCount(text: string): number {
  const slots = mvpDirectUrlSlotsFromText(text)
  const filled = slots.filter(Boolean).length
  return Math.min(MAX_AUTO_EDIT_VIDEOS, Math.max(MVP_DIRECT_URL_MIN_SLOTS, filled))
}

/** 줄바꿈·쉼표·공백으로 분리, 중복 제거 */
export function parseMvpDirectUrls(text: string, max = MAX_AUTO_EDIT_VIDEOS): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of text.split(/[\n,\s]+/)) {
    const u = part.trim()
    if (!u.startsWith("http")) continue
    const key = u.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(u)
    if (out.length >= max) break
  }
  return out
}
