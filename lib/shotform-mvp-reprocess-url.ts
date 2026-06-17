import {
  detectReprocessUrlPlatform,
  type MvpReprocessPlatform,
  type MvpReprocessResolvedItem,
} from "@/lib/shotform-mvp-reprocess-url-shared"
import { resolveMediaUrlViaCloudRun } from "@/lib/shotform-cloud-run-media-resolve"
import { isYtDlpAvailable, resolveMediaUrlWithYtDlp } from "@/lib/shotform-ytdlp"
import { resolveYoutubeViaPiped } from "@/lib/shotform-youtube-piped-fallback"
import { resolveYoutubeStreamUrl } from "@/lib/shotform-youtube-stream-url"

export type { MvpReprocessPlatform, MvpReprocessResolvedItem } from "@/lib/shotform-mvp-reprocess-url-shared"
export { detectReprocessUrlPlatform } from "@/lib/shotform-mvp-reprocess-url-shared"

const DEFAULT_TIKTOK_VIDEO_ACTOR = "clockworks/tiktok-video-scraper"
const DEFAULT_YOUTUBE_ACTOR = "streamers/youtube-scraper"

function formatApifyError(raw: string, actorSlug: string): string {
  const trimmed = raw.trim()
  try {
    const j = JSON.parse(trimmed) as {
      error?: { type?: string; message?: string }
    }
    const msg = j?.error?.message?.trim()
    if (msg) {
      if (/run did not succeed|run-failed|status:\s*FAILED/i.test(msg)) {
        return `Apify ${actorSlug} 실행 실패. Actor 구독·입력 형식을 확인하거나 잠시 후 다시 시도해 주세요.`
      }
      return msg.length > 220 ? `${msg.slice(0, 220)}…` : msg
    }
  } catch {
    /* plain text */
  }
  return trimmed.length > 220 ? `${trimmed.slice(0, 220)}…` : trimmed || `Apify ${actorSlug} 오류`
}

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
    throw new Error(formatApifyError(t, actorSlug))
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
  const videoId = noteUrl.match(/[?&]v=([\w-]{11})/)?.[1]
  const items = await apifyRunSyncGetDatasetItems(
    apifyToken,
    actor,
    {
      startUrls: [{ url: noteUrl }],
      maxResults: 1,
      downloadSubtitles: false,
    },
    { timeoutSec: Number(process.env.APIFY_YOUTUBE_TIMEOUT_SEC || 240), maxItems: 2 }
  )
  const raw = items[0]
  let videoUrl = pickPlayUrlFromRaw(raw)
  if (!videoUrl.startsWith("http") && videoId) {
    const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
    videoUrl =
      pickStr(o, ["downloadUrl", "videoUrl", "streamingUrl", "hlsUrl"]) ||
      pickPlayUrlFromRaw(o)
  }
  if (!videoUrl.startsWith("http")) {
    throw new Error("YouTube 영상 다운로드 URL을 Apify에서 찾지 못했습니다.")
  }
  return {
    videoUrl,
    title: pickTitleFromRaw(raw, "(YouTube 영상)"),
  }
}

type YoutubeResolveStep = {
  label: string
  run: () => Promise<{ videoUrl: string; title: string }>
}

function isVercelDeploy(): boolean {
  return Boolean(process.env.VERCEL)
}

async function resolveYoutubeForServer(
  apifyToken: string,
  noteUrl: string
): Promise<{ videoUrl: string; title: string }> {
  const attempts: string[] = []
  const token = apifyToken.trim()

  const steps: YoutubeResolveStep[] = isVercelDeploy()
    ? [
        { label: "Cloud Run yt-dlp", run: () => resolveMediaUrlViaCloudRun(noteUrl) },
        { label: "Piped", run: () => resolveYoutubeViaPiped(noteUrl) },
        { label: "InnerTube", run: () => resolveYoutubeStreamUrl(noteUrl) },
      ]
    : [
        { label: "InnerTube", run: () => resolveYoutubeStreamUrl(noteUrl) },
        { label: "Cloud Run yt-dlp", run: () => resolveMediaUrlViaCloudRun(noteUrl) },
        { label: "Piped", run: () => resolveYoutubeViaPiped(noteUrl) },
      ]

  if (token) {
    steps.push({
      label: "Apify",
      run: () => resolveYoutubeViaApify(token, noteUrl),
    })
  }

  for (const step of steps) {
    try {
      const r = await step.run()
      if (r.videoUrl.startsWith("http")) return r
      attempts.push(`${step.label}: 재생 URL 없음`)
    } catch (e) {
      attempts.push(
        `${step.label}: ${e instanceof Error ? e.message : "실패"}`.slice(0, 180)
      )
    }
  }

  const vercelHint = isVercelDeploy()
    ? " Vercel: SHOPPING_CLOUD_RUN_RENDER_URL 설정 후 cloud-run-service(yt-dlp) 재배포를 확인하세요."
    : " 로컬: npm run dev + yt-dlp 설치를 권장합니다."

  throw new Error(
    `YouTube 영상을 가져오지 못했습니다.${vercelHint} (${attempts.slice(0, 3).join(" · ")})`
  )
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

    if (platform === "youtube") {
      try {
        const r = await resolveYoutubeForServer(apifyToken, noteUrl)
        return { ...base, videoUrl: r.videoUrl, title: r.title }
      } catch (e) {
        return {
          ...base,
          error: e instanceof Error ? e.message : "YouTube URL 해석 실패",
        }
      }
    }

    if (platform === "tiktok") {
      try {
        const cloud = await resolveMediaUrlViaCloudRun(noteUrl)
        return { ...base, videoUrl: cloud.videoUrl, title: cloud.title }
      } catch {
        /* Apify 폴백 */
      }

      const token = apifyToken.trim()
      if (!token) {
        return {
          ...base,
          error: "TikTok URL 해석에 yt-dlp(서버)·Cloud Run 또는 소스 검색 토큰(Apify)이 필요합니다.",
        }
      }

      const r = await resolveTiktokViaApify(token, noteUrl)
      return {
        ...base,
        videoUrl: r.videoUrl,
        title: r.title,
        durationSec: r.durationSec,
      }
    }

    return {
      ...base,
      error: "지원하지 않는 플랫폼입니다.",
    }
  } catch (e) {
    return {
      ...base,
      error: e instanceof Error ? e.message : "URL 해석 실패",
    }
  }
}
