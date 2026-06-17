import { youtubeIdFromUrl } from "@/lib/shotform-youtube-stream-url"

const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://pipedapi.in.projectsegfau.lt",
]

type PipedStream = {
  url?: string
  mimeType?: string
  quality?: string
  videoOnly?: boolean
  format?: string
}

function qualityRank(s: PipedStream): number {
  const q = String(s.quality || "")
  const n = parseInt(q, 10)
  if (Number.isFinite(n) && n > 0) return n
  if (q.includes("720")) return 720
  if (q.includes("480")) return 480
  if (q.includes("360")) return 360
  return 0
}

/** 공개 Piped API — Vercel에서 YouTube googlevideo URL 확보용 폴백 */
export async function resolveYoutubeViaPiped(
  pageUrl: string
): Promise<{ videoUrl: string; title: string }> {
  const videoId = youtubeIdFromUrl(pageUrl)
  if (!videoId) {
    throw new Error("YouTube 영상 ID를 URL에서 찾지 못했습니다.")
  }

  const errors: string[] = []
  for (const base of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${base.replace(/\/$/, "")}/streams/${videoId}`, {
        headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(22_000),
      })
      if (!res.ok) {
        errors.push(`${new URL(base).hostname}: HTTP ${res.status}`)
        continue
      }

      const data = (await res.json().catch(() => ({}))) as {
        title?: string
        videoStreams?: PipedStream[]
      }

      const streams = (data.videoStreams || []).filter((s) => s.url?.startsWith("http"))
      const muxed = streams
        .filter((s) => !s.videoOnly && /mp4/i.test(String(s.mimeType || s.format || "")))
        .sort((a, b) => qualityRank(b) - qualityRank(a))
      const anyMp4 = streams
        .filter((s) => /mp4/i.test(String(s.mimeType || s.format || "")) || s.url?.includes("googlevideo"))
        .sort((a, b) => qualityRank(b) - qualityRank(a))

      const videoUrl = muxed[0]?.url || anyMp4[0]?.url || streams.sort((a, b) => qualityRank(b) - qualityRank(a))[0]?.url
      if (!videoUrl?.startsWith("http")) {
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
