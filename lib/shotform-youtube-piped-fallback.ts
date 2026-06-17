import { youtubeIdFromUrl } from "@/lib/shotform-youtube-stream-url"

/** 서버·브라우저 공용 Piped API 인스턴스 */
export const PIPED_API_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://pipedapi.in.projectsegfau.lt",
  "https://pipedapi.leptons.xyz",
  "https://api.piped.privacydev.net",
  "https://pipedapi.syncpundit.io",
  "https://pipedapi.moomoo.me",
]

/** 브라우저 CORS 허용 Invidious API */
export const INVIDIOUS_API_INSTANCES = [
  "https://invidious.fdn.fr",
  "https://vid.puffyan.us",
  "https://invidious.privacyredirect.com",
  "https://invidious.protokolla.fi",
  "https://inv.nadeko.net",
]

type PipedStream = {
  url?: string
  mimeType?: string
  quality?: string
  videoOnly?: boolean
  format?: string
}

type InvidiousFormat = {
  url?: string
  quality?: string
  type?: string
  container?: string
}

function qualityRank(s: { quality?: string }): number {
  const q = String(s.quality || "")
  const n = parseInt(q, 10)
  if (Number.isFinite(n) && n > 0) return n
  if (q.includes("1080")) return 1080
  if (q.includes("720")) return 720
  if (q.includes("480")) return 480
  if (q.includes("360")) return 360
  return 0
}

function pickBestMuxedMp4(streams: PipedStream[]): string {
  const http = streams.filter((s) => s.url?.startsWith("http"))
  const muxed = http
    .filter((s) => !s.videoOnly && /mp4/i.test(String(s.mimeType || s.format || "")))
    .sort((a, b) => qualityRank(b) - qualityRank(a))
  const anyMp4 = http
    .filter(
      (s) =>
        /mp4/i.test(String(s.mimeType || s.format || "")) || s.url?.includes("googlevideo")
    )
    .sort((a, b) => qualityRank(b) - qualityRank(a))
  return (
    muxed[0]?.url ||
    anyMp4[0]?.url ||
    http.sort((a, b) => qualityRank(b) - qualityRank(a))[0]?.url ||
    ""
  )
}

function pickInvidiousMp4(formats: InvidiousFormat[]): string {
  const http = formats.filter((f) => f.url?.startsWith("http"))
  const muxed = http
    .filter((f) => /mp4/i.test(String(f.type || f.container || "")) && !/audio/i.test(String(f.type || "")))
    .sort((a, b) => qualityRank(b) - qualityRank(a))
  const any = http
    .filter((f) => /mp4|googlevideo/i.test(`${f.type || ""}${f.url || ""}`))
    .sort((a, b) => qualityRank(b) - qualityRank(a))
  return muxed[0]?.url || any[0]?.url || http.sort((a, b) => qualityRank(b) - qualityRank(a))[0]?.url || ""
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 22_000): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  return res.json().catch(() => ({}))
}

/** 공개 Piped API — YouTube googlevideo·직접 MP4 URL 확보 */
export async function resolveYoutubeViaPiped(
  pageUrl: string,
  instances: readonly string[] = PIPED_API_INSTANCES
): Promise<{ videoUrl: string; title: string }> {
  const videoId = youtubeIdFromUrl(pageUrl)
  if (!videoId) {
    throw new Error("YouTube 영상 ID를 URL에서 찾지 못했습니다.")
  }

  const errors: string[] = []
  for (const base of instances) {
    try {
      const data = (await fetchJsonWithTimeout(
        `${base.replace(/\/$/, "")}/streams/${videoId}`
      )) as {
        title?: string
        videoStreams?: PipedStream[]
      }

      const videoUrl = pickBestMuxedMp4(data.videoStreams || [])
      if (!videoUrl.startsWith("http")) {
        errors.push(`${new URL(base).hostname}: 재생 URL 없음`)
        continue
      }

      return {
        videoUrl,
        title: (data.title || "").trim().slice(0, 200) || "(YouTube 영상)",
      }
    } catch (e) {
      errors.push(
        `${new URL(base).hostname}: ${e instanceof Error ? e.message : "오류"}`.slice(0, 100)
      )
    }
  }

  throw new Error(errors[0] ? `Piped 실패 (${errors[0]})` : "Piped 인스턴스에 연결하지 못했습니다.")
}

/** Invidious API — Piped 실패 시 폴백 */
export async function resolveYoutubeViaInvidious(
  pageUrl: string,
  instances: readonly string[] = INVIDIOUS_API_INSTANCES
): Promise<{ videoUrl: string; title: string }> {
  const videoId = youtubeIdFromUrl(pageUrl)
  if (!videoId) {
    throw new Error("YouTube 영상 ID를 URL에서 찾지 못했습니다.")
  }

  const errors: string[] = []
  for (const base of instances) {
    try {
      const data = (await fetchJsonWithTimeout(
        `${base.replace(/\/$/, "")}/api/v1/videos/${videoId}`
      )) as {
        title?: string
        formatStreams?: InvidiousFormat[]
        adaptiveFormats?: InvidiousFormat[]
      }

      const formats = [...(data.formatStreams || []), ...(data.adaptiveFormats || [])]
      const videoUrl = pickInvidiousMp4(formats)
      if (!videoUrl.startsWith("http")) {
        errors.push(`${new URL(base).hostname}: 재생 URL 없음`)
        continue
      }

      return {
        videoUrl,
        title: (data.title || "").trim().slice(0, 200) || "(YouTube 영상)",
      }
    } catch (e) {
      errors.push(
        `${new URL(base).hostname}: ${e instanceof Error ? e.message : "오류"}`.slice(0, 100)
      )
    }
  }

  throw new Error(
    errors[0] ? `Invidious 실패 (${errors[0]})` : "Invidious 인스턴스에 연결하지 못했습니다."
  )
}
