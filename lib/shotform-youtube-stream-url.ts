/**
 * YouTube 페이지 URL → googlevideo 직접 재생 URL (Vercel·서버리스용)
 * ANDROID InnerTube player — Apify/yt-dlp 없이 동작
 */

const YT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

type YtStreamFormat = {
  url?: string
  itag?: number
  mimeType?: string
  height?: number
  qualityLabel?: string
}

type YtStreamingData = {
  formats?: YtStreamFormat[]
  adaptiveFormats?: YtStreamFormat[]
}

export function youtubeIdFromUrl(link: string): string | null {
  try {
    const u = new URL(link.trim())
    const v = u.searchParams.get("v")
    if (v && /^[\w-]{11}$/.test(v)) return v
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace(/^\//, "").split("/")[0]
      return id && /^[\w-]{11}$/.test(id) ? id : null
    }
    const shorts = u.pathname.match(/\/shorts\/([\w-]{11})/)
    if (shorts) return shorts[1]!
  } catch {
    return null
  }
  return null
}

function extractTitleFromWatchHtml(html: string): string {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
  if (og?.[1]) return og[1].replace(/ - YouTube$/i, "").trim().slice(0, 200)
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (title?.[1]) return title[1].replace(/ - YouTube$/i, "").trim().slice(0, 200)
  return "(YouTube 영상)"
}

function pickProgressiveMp4Url(streamingData: YtStreamingData | undefined): string | null {
  if (!streamingData) return null
  const progressive = (streamingData.formats || []).filter((f) => f.url?.startsWith("http"))
  const preferItags = [22, 18, 37]
  for (const itag of preferItags) {
    const hit = progressive.find((f) => f.itag === itag && f.url?.startsWith("http"))
    if (hit?.url) return hit.url
  }
  const withAudio = progressive
    .filter((f) => {
      const mime = String(f.mimeType || "").toLowerCase()
      return mime.includes("mp4") && mime.includes("mp4a")
    })
    .sort((a, b) => (b.height || 0) - (a.height || 0))
  if (withAudio[0]?.url) return withAudio[0].url

  const anyMp4 = progressive
    .filter((f) => String(f.mimeType || "").toLowerCase().includes("mp4"))
    .sort((a, b) => (b.height || 0) - (a.height || 0))
  return anyMp4[0]?.url || null
}

/** YouTube watch URL → googlevideo MP4 URL + 제목 */
export async function resolveYoutubeStreamUrl(
  pageUrl: string
): Promise<{ videoUrl: string; title: string }> {
  const videoId = youtubeIdFromUrl(pageUrl)
  if (!videoId) {
    throw new Error("YouTube 영상 ID를 URL에서 찾지 못했습니다.")
  }

  const watchRes = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, {
    headers: { "User-Agent": YT_UA, Accept: "text/html" },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  })
  if (!watchRes.ok) {
    throw new Error(`YouTube 페이지 조회 실패 (${watchRes.status})`)
  }
  const html = await watchRes.text()
  const apiKey = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1]
  if (!apiKey) {
    throw new Error("YouTube 재생 정보를 가져오지 못했습니다.")
  }

  const playerRes = await fetch(
    `https://www.youtube.com/youtubei/v1/player?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": YT_UA,
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "ANDROID",
            clientVersion: "20.10.38",
            hl: "ko",
            gl: "KR",
          },
        },
        videoId,
      }),
      signal: AbortSignal.timeout(25_000),
    }
  )
  if (!playerRes.ok) {
    throw new Error(`YouTube 재생 API 실패 (${playerRes.status})`)
  }

  const data = (await playerRes.json().catch(() => null)) as {
    streamingData?: YtStreamingData
    videoDetails?: { title?: string }
    playabilityStatus?: { status?: string; reason?: string }
  } | null

  const status = data?.playabilityStatus?.status
  if (status && status !== "OK") {
    const reason = data?.playabilityStatus?.reason?.trim()
    throw new Error(reason || `YouTube 영상을 재생할 수 없습니다 (${status})`)
  }

  const videoUrl = pickProgressiveMp4Url(data?.streamingData)
  if (!videoUrl?.startsWith("http")) {
    throw new Error("YouTube MP4 스트림 URL을 찾지 못했습니다.")
  }

  const title =
    (typeof data?.videoDetails?.title === "string" && data.videoDetails.title.trim().slice(0, 200)) ||
    extractTitleFromWatchHtml(html)

  return { videoUrl, title }
}
