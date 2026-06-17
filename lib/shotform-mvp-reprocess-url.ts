import {
  detectReprocessUrlPlatform,
  type MvpReprocessPlatform,
  type MvpReprocessResolvedItem,
} from "@/lib/shotform-mvp-reprocess-url-shared"
import { isYtDlpAvailable, resolveMediaUrlWithYtDlp } from "@/lib/shotform-ytdlp"

export type { MvpReprocessPlatform, MvpReprocessResolvedItem } from "@/lib/shotform-mvp-reprocess-url-shared"
export { detectReprocessUrlPlatform } from "@/lib/shotform-mvp-reprocess-url-shared"

const DEFAULT_TIKTOK_VIDEO_ACTOR = "clockworks/tiktok-video-scraper"
const DEFAULT_YOUTUBE_ACTOR = "epctex/youtube-video-downloader"

function actorPathId(slug: string): string {
  const s = slug.trim()
  return s.includes("~") ? s : s.replace("/", "~")
}

async function apifyRunSyncGetDatasetItems(
  token: string,
  actorSlug: string,
  input: Record<string, unknown>,
  opts?: { timeoutSec?: number; maxItems?: number }
): Promise<unknown[]> {
  const pathId = actorPathId(actorSlug)
  const timeoutSec = opts?.timeoutSec ?? 180
  const url = new URL(`https://api.apify.com/v2/acts/${encodeURIComponent(pathId)}/run-sync-get-dataset-items`)
  url.searchParams.set("token", token)
  url.searchParams.set("timeout", String(timeoutSec))
  if (opts?.maxItems != null) url.searchParams.set("maxItems", String(opts.maxItems))

  const r = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(timeoutSec * 1000 + 120_000),
  })
  if (!r.ok) {
    const t = await r.text().catch(() => "")
    throw new Error(t.slice(0, 280) || `Apify ${actorSlug} HTTP ${r.status}`)
  }
  const data = (await r.json().catch(() => null)) as unknown
  return Array.isArray(data) ? data : []
}

function pickStr(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === "string" && v.trim().startsWith("http")) return v.trim()
  }
  return ""
}

function collectHttpStrings(value: unknown, out: string[], depth = 0): void {
  if (depth > 8 || out.length > 40) return
  if (typeof value === "string") {
    const s = value.trim()
    if (s.startsWith("http")) out.push(s)
    return
  }
  if (!value || typeof value !== "object") return
  if (Array.isArray(value)) {
    for (const item of value) collectHttpStrings(item, out, depth + 1)
    return
  }
  for (const v of Object.values(value as Record<string, unknown>)) {
    collectHttpStrings(v, out, depth + 1)
  }
}

function pickPlayUrlFromRaw(raw: unknown): string {
  if (!raw || typeof raw !== "object") return ""
  const o = raw as Record<string, unknown>
  const vm = o.videoMeta as Record<string, unknown> | undefined
  let play =
    pickStr(o, ["downloadUrl", "videoUrl", "playUrl", "mediaUrl"]) ||
    (vm ? pickStr(vm, ["downloadAddr", "downloadUrl", "playAddr", "playUrl", "videoUrl"]) : "")

  if (!play && Array.isArray(o.mediaUrls)) {
    play = o.mediaUrls.find((u): u is string => typeof u === "string" && u.startsWith("http")) || ""
  }

  if (!play) {
    const urls: string[] = []
    collectHttpStrings(o, urls)
    play =
      urls.find((u) => /\.mp4(\?|$)/i.test(u) || u.includes("tiktokcdn") || u.includes("googlevideo")) || ""
  }
  return play
}

function pickTitleFromRaw(raw: unknown, fallback = "(영상)"): string {
  if (!raw || typeof raw !== "object") return fallback
  const o = raw as Record<string, unknown>
  const text =
    (typeof o.text === "string" && o.text.trim()) ||
    (typeof o.desc === "string" && o.desc.trim()) ||
    (typeof o.title === "string" && o.title.trim()) ||
    (typeof o.caption === "string" && o.caption.trim()) ||
    ""
  return text.slice(0, 200) || fallback
}

function pickDurationFromRaw(raw: unknown): number | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const vm = o.videoMeta as Record<string, unknown> | undefined
  const candidates = [o.duration, vm?.duration]
  for (const v of candidates) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return Math.round(v)
  }
  return null
}

function canonicalReprocessNoteUrl(inputUrl: string, platform: MvpReprocessPlatform): string {
  const raw = inputUrl.trim()
  if (platform === "youtube") {
    try {
      const parsed = new URL(raw)
      const v = parsed.searchParams.get("v")
      if (v) return `https://www.youtube.com/watch?v=${v}`
      if (parsed.hostname.includes("youtu.be")) {
        const id = parsed.pathname.replace(/^\//, "").split("/")[0]
        if (id) return `https://www.youtube.com/watch?v=${id}`
      }
      if (parsed.pathname.includes("/shorts/")) {
        const id = parsed.pathname.match(/\/shorts\/([^/]+)/)?.[1]
        if (id) return `https://www.youtube.com/watch?v=${id}`
      }
    } catch {
      /* ignore */
    }
  }
  return raw.split("?")[0] || raw
}

async function resolveViaYtDlp(noteUrl: string): Promise<{ videoUrl: string; title: string }> {
  const r = await resolveMediaUrlWithYtDlp(noteUrl)
  if (!r?.videoUrl.startsWith("http")) {
    throw new Error("yt-dlp로 재생 URL을 찾지 못했습니다.")
  }
  return r
}

async function resolveTiktokViaApify(
  apifyToken: string,
  noteUrl: string
): Promise<{ videoUrl: string; title: string; durationSec: number | null }> {
  const actor = (process.env.APIFY_TIKTOK_VIDEO_ACTOR || DEFAULT_TIKTOK_VIDEO_ACTOR).trim()
  const items = await apifyRunSyncGetDatasetItems(
    apifyToken,
    actor,
    {
      postURLs: [noteUrl],
      shouldDownloadVideos: true,
      shouldDownloadCovers: false,
      shouldDownloadSlideshowImages: false,
      shouldDownloadSubtitles: false,
    },
    { timeoutSec: Number(process.env.APIFY_TIKTOK_VIDEO_TIMEOUT_SEC || 200), maxItems: 3 }
  )
  const raw = items[0]
  const videoUrl = pickPlayUrlFromRaw(raw)
  if (!videoUrl.startsWith("http")) {
    throw new Error("TikTok 영상 다운로드 URL을 Apify에서 찾지 못했습니다.")
  }
  return {
    videoUrl,
    title: pickTitleFromRaw(raw, "(TikTok 영상)"),
    durationSec: pickDurationFromRaw(raw),
  }
}

async function resolveYoutubeViaApify(
  apifyToken: string,
  noteUrl: string
): Promise<{ videoUrl: string; title: string }> {
  const actor = (process.env.APIFY_YOUTUBE_ACTOR || DEFAULT_YOUTUBE_ACTOR).trim()
  const items = await apifyRunSyncGetDatasetItems(
    apifyToken,
    actor,
    {
      videoUrls: [noteUrl],
      quality: "720",
    },
    { timeoutSec: Number(process.env.APIFY_YOUTUBE_TIMEOUT_SEC || 240), maxItems: 2 }
  )
  const raw = items[0]
  const videoUrl = pickPlayUrlFromRaw(raw)
  if (!videoUrl.startsWith("http")) {
    throw new Error("YouTube 영상 다운로드 URL을 Apify에서 찾지 못했습니다.")
  }
  return {
    videoUrl,
    title: pickTitleFromRaw(raw, "(YouTube 영상)"),
  }
}

/** YouTube·TikTok 페이지 URL → playUrl (yt-dlp 우선, 없으면 Apify) */
export async function resolveReprocessUrl(
  apifyToken: string,
  inputUrl: string
): Promise<MvpReprocessResolvedItem> {
  const platform = detectReprocessUrlPlatform(inputUrl)
  const base: MvpReprocessResolvedItem = {
    inputUrl,
    noteUrl: inputUrl,
    videoUrl: "",
    platform: platform || "youtube",
    title: "",
  }

  if (!platform) {
    return {
      ...base,
      error: "YouTube 또는 TikTok 영상 URL만 지원합니다.",
    }
  }

  const noteUrl = canonicalReprocessNoteUrl(inputUrl, platform)
  base.noteUrl = noteUrl
  base.platform = platform

  try {
    if (await isYtDlpAvailable()) {
      const r = await resolveViaYtDlp(noteUrl)
      return {
        ...base,
        videoUrl: r.videoUrl,
        title: r.title,
      }
    }

    const token = apifyToken.trim()
    if (!token) {
      return {
        ...base,
        error:
          platform === "youtube"
            ? "YouTube URL 해석에 yt-dlp(서버) 또는 소스 검색 토큰(Apify)이 필요합니다."
            : "TikTok URL 해석에 yt-dlp(서버) 또는 소스 검색 토큰(Apify)이 필요합니다.",
      }
    }

    if (platform === "tiktok") {
      const r = await resolveTiktokViaApify(token, noteUrl)
      return {
        ...base,
        videoUrl: r.videoUrl,
        title: r.title,
        durationSec: r.durationSec,
      }
    }

    const r = await resolveYoutubeViaApify(token, noteUrl)
    return {
      ...base,
      videoUrl: r.videoUrl,
      title: r.title,
    }
  } catch (e) {
    return {
      ...base,
      error: e instanceof Error ? e.message : "URL 해석 실패",
    }
  }
}
