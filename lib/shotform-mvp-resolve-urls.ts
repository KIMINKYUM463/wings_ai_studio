import {
  DEFAULT_DOUYIN_VIDEO_ACTOR,
  pickDouyinPlayUrlFromRaw,
  resolveXhsNoteUrlViaApify,
  runDouyinApifyActorRaw,
} from "@/lib/apify-product-search"
import { extractDouyinVideoId } from "@/lib/douyin-embed"
import { MAX_AUTO_EDIT_VIDEOS } from "@/lib/shotform-auto-edit-types"
import {
  extractXhsNoteId,
  fetchXhsNoteVideoUrl,
  isXhsNotePageUrl,
  normalizeXhsNoteUrl,
} from "@/lib/xhs-video"

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

async function followDouyinRedirect(url: string): Promise<string> {
  const u = url.trim()
  if (!/v\.douyin\.com/i.test(u)) return u
  try {
    const res = await fetch(u, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      },
      signal: AbortSignal.timeout(15_000),
    })
    return res.url?.trim() || u
  } catch {
    return u
  }
}

function pickTitleFromDouyinRaw(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "(도우인 영상)"
  const o = raw as Record<string, unknown>
  const title =
    (typeof o.text === "string" && o.text.trim()) ||
    (typeof o.caption === "string" && o.caption.trim()) ||
    (typeof o.desc === "string" && o.desc.trim()) ||
    (typeof o.description === "string" && o.description.trim()) ||
    (typeof o.title === "string" && o.title.trim()) ||
    ""
  return title.slice(0, 200) || "(도우인 영상)"
}

function pickNoteUrlFromDouyinRaw(raw: unknown, fallback: string): string {
  if (!raw || typeof raw !== "object") return fallback
  const o = raw as Record<string, unknown>
  const url =
    (typeof o.url === "string" && o.url.trim()) ||
    (typeof o.shareUrl === "string" && o.shareUrl.trim()) ||
    ""
  if (url.includes("douyin.com") || url.includes("iesdouyin.com")) {
    return url.split("?")[0] || url
  }
  const id =
    (typeof o.videoId === "string" && o.videoId.trim()) ||
    (typeof o.aweme_id === "string" && o.aweme_id.trim()) ||
    (typeof o.awemeId === "string" && o.awemeId.trim()) ||
    ""
  if (/^\d{10,22}$/.test(id)) return `https://www.douyin.com/video/${id}`
  return fallback
}

/** 도우인 노트 URL → playUrl (Apify sian.agency videoDetail) */
export async function resolveDouyinNoteUrl(
  apifyToken: string,
  inputUrl: string
): Promise<{ noteUrl: string; videoUrl: string; title: string }> {
  const canonical = await followDouyinRedirect(inputUrl)
  const videoId = extractDouyinVideoId(canonical)
  if (!videoId) {
    throw new Error("도우인 영상 ID를 URL에서 찾지 못했습니다. 전체 링크를 붙여넣어 주세요.")
  }

  const noteUrl = canonical.includes("/video/")
    ? canonical.split("?")[0]!
    : `https://www.douyin.com/video/${videoId}`

  const run = await runDouyinApifyActorRaw(apifyToken, DEFAULT_DOUYIN_VIDEO_ACTOR, {
    operation: "videoDetail",
    videoId,
  })

  if (run.error) {
    throw new Error(run.error)
  }

  const mapped = run.mappedRows[0]
  if (mapped?.videoUrl?.startsWith("http")) {
    return {
      noteUrl: mapped.url || noteUrl,
      videoUrl: mapped.videoUrl,
      title: mapped.title || "(도우인 영상)",
    }
  }

  const raw = run.rawItems[0]
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>
    const play = pickDouyinPlayUrlFromRaw(o)
    if (play.startsWith("http")) {
      return {
        noteUrl: pickNoteUrlFromDouyinRaw(raw, noteUrl),
        videoUrl: play,
        title: pickTitleFromDouyinRaw(raw),
      }
    }
  }

  throw new Error("도우인 재생 URL(playUrl)을 찾지 못했습니다.")
}

function decodeJsonishUrl(raw: string): string {
  return raw.replace(/\\u002F/gi, "/").replace(/\\\//g, "/").replace(/&amp;/g, "&")
}

function extractXhsTitleFromHtml(html: string): string | null {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
  if (og?.[1]) return decodeJsonishUrl(og[1]).trim().slice(0, 200)
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (title?.[1]) {
    const t = decodeJsonishUrl(title[1]).replace(/\s*[-|·]\s*小红书.*$/i, "").trim()
    if (t) return t.slice(0, 200)
  }
  return null
}

async function resolveXhsNoteUrlFromHtml(
  noteUrl: string,
  noteId: string
): Promise<{ noteUrl: string; videoUrl: string; title: string }> {
  const pageRes = await fetch(noteUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      Referer: "https://www.xiaohongshu.com/",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
    redirect: "follow",
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(20_000),
  })
  const html = pageRes.ok ? await pageRes.text() : ""
  const videoUrl =
    (html ? extractXhsVideoUrlFromHtml(html, noteId) : null) ?? (await fetchXhsNoteVideoUrl(noteUrl))
  if (!videoUrl) {
    throw new Error("노트 페이지에서 재생 가능한 영상 URL을 찾지 못했습니다.")
  }
  const title = (html ? extractXhsTitleFromHtml(html) : null) || "(샤오홍슈 노트)"
  return { noteUrl, videoUrl, title }
}

/** 샤오홍슈 노트 URL → playUrl (Apify 우선 — 소스 검색과 동일, HTML은 폴백) */
export async function resolveXhsNoteUrl(
  inputUrl: string,
  apifyToken?: string
): Promise<{ noteUrl: string; videoUrl: string; title: string }> {
  const noteId = extractXhsNoteId(inputUrl)
  if (!noteId) {
    throw new Error("샤오홍슈 노트 URL이 아닙니다. explore/discovery 링크를 붙여넣어 주세요.")
  }
  const noteUrl = normalizeXhsNoteUrl(inputUrl)
  const token = apifyToken?.trim()

  if (token) {
    try {
      return await resolveXhsNoteUrlViaApify(token, noteUrl)
    } catch (apifyErr) {
      try {
        return await resolveXhsNoteUrlFromHtml(noteUrl, noteId)
      } catch {
        throw apifyErr
      }
    }
  }

  try {
    return await resolveXhsNoteUrlFromHtml(noteUrl, noteId)
  } catch {
    throw new Error(
      "샤오홍슈 URL 해석에 소스 검색 토큰(Apify)이 필요합니다. ShotForm 설정에 저장한 뒤 다시 시도해 주세요."
    )
  }
}

function extractXhsVideoUrlFromHtml(html: string, noteId: string): string | null {
  const candidates: string[] = []
  const re = /https:\/\/[^"'\\\s]+xhscdn\.com\/[^"'\\\s]+/g
  for (const m of html.matchAll(re)) {
    candidates.push(decodeJsonishUrl(m[0]))
  }
  const videoish = candidates.filter(
    (u) => u.includes(".mp4") || u.includes("/stream/") || /\/video\//i.test(u) || u.includes("sns-video")
  )
  if (!videoish.length) return null
  const scored = videoish.map((u) => {
    let score = 0
    if (u.includes("master")) score += 6
    if (u.includes(".mp4")) score += 5
    if (u.includes("720")) score += 3
    return { u, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.u ?? null
}

export async function resolveMvpDirectUrls(
  apifyToken: string,
  urls: string[]
): Promise<MvpResolvedUrlItem[]> {
  const results: MvpResolvedUrlItem[] = []

  for (const rawInputUrl of urls) {
    const inputUrl = normalizeMvpDirectInputUrl(rawInputUrl)
    const platform = detectMvpUrlPlatform(inputUrl)
    if (!platform) {
      results.push({
        inputUrl: rawInputUrl,
        noteUrl: rawInputUrl,
        videoUrl: "",
        platform: "douyin",
        title: "",
        error:
          rawInputUrl.includes("xiaohongshu.com/404") || rawInputUrl.includes("error_code=")
            ? "샤오홍슈 링크가 만료·차단된 404 페이지입니다. 앱에서 노트를 다시 열고 explore 링크를 복사해 주세요."
            : "도우인·샤오홍슈·TikTok 영상 URL만 지원합니다.",
      })
      continue
    }

    try {
      if (platform === "xiaohongshu") {
        const r = await resolveXhsNoteUrl(inputUrl, apifyToken)
        results.push({
          inputUrl: rawInputUrl,
          noteUrl: r.noteUrl,
          videoUrl: r.videoUrl,
          platform,
          title: r.title,
        })
      } else if (platform === "douyin") {
        const r = await resolveDouyinNoteUrl(apifyToken, inputUrl)
        results.push({
          inputUrl: rawInputUrl,
          noteUrl: r.noteUrl,
          videoUrl: r.videoUrl,
          platform,
          title: r.title,
        })
      } else {
        throw new Error("TikTok URL은 서버 전용 해석 경로를 사용해야 합니다.")
      }
    } catch (e) {
      results.push({
        inputUrl: rawInputUrl,
        noteUrl: inputUrl,
        videoUrl: "",
        platform,
        title: "",
        error: e instanceof Error ? e.message : "URL 해석 실패",
      })
    }
  }

  return results
}
