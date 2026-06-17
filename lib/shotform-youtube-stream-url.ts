/**
 * YouTube 페이지 URL → googlevideo 직접 재생 URL
 * Vercel 등 데이터센터 IP — ANDROID_VR·visitorData 등 여러 InnerTube 클라이언트 시도
 */

const YT_MOBILE_UA =
  "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"

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

type YtPlayerClient = Record<string, string | number>

const STATIC_PLAYER_CLIENTS: YtPlayerClient[] = [
  {
    clientName: "ANDROID_VR",
    clientVersion: "1.65.10",
    deviceModel: "Quest 3",
    osName: "Android",
    osVersion: "12L",
    androidSdkVersion: 32,
  },
  { clientName: "ANDROID", clientVersion: "20.10.38" },
  { clientName: "ANDROID", clientVersion: "19.17.34" },
]

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

function decodeVisitorData(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined
  try {
    return raw.replace(/\\u002F/g, "/").replace(/\\\//g, "/")
  } catch {
    return raw
  }
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

function buildPlayerClients(webClientVersion: string | undefined, visitorData: string | undefined): YtPlayerClient[] {
  const clients = [...STATIC_PLAYER_CLIENTS]
  if (webClientVersion) {
    clients.push({ clientName: "WEB", clientVersion: webClientVersion })
    clients.push({ clientName: "MWEB", clientVersion: webClientVersion })
  }
  if (visitorData) {
    return clients.map((c) => ({ ...c, visitorData }))
  }
  return clients
}

async function fetchPlayerResponse(
  videoId: string,
  apiKey: string,
  client: YtPlayerClient,
  visitorData: string | undefined
): Promise<{
  streamingData?: YtStreamingData
  videoDetails?: { title?: string }
  playabilityStatus?: { status?: string; reason?: string }
}> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": YT_MOBILE_UA,
    Accept: "*/*",
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
  }
  if (visitorData) headers["X-Goog-Visitor-Id"] = visitorData

  const res = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      context: {
        client: {
          ...client,
          hl: "ko",
          gl: "KR",
        },
      },
      videoId,
    }),
    signal: AbortSignal.timeout(25_000),
  })

  if (!res.ok) {
    throw new Error(`YouTube 재생 API 실패 (${res.status})`)
  }

  return (await res.json().catch(() => ({}))) as {
    streamingData?: YtStreamingData
    videoDetails?: { title?: string }
    playabilityStatus?: { status?: string; reason?: string }
  }
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
    headers: {
      "User-Agent": YT_MOBILE_UA,
      Accept: "text/html",
      "Accept-Language": "ko-KR,ko;q=0.9",
    },
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

  const visitorData = decodeVisitorData(html.match(/"VISITOR_DATA":"([^"]+)"/)?.[1])
  const webClientVersion = html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)?.[1]
  const fallbackTitle = extractTitleFromWatchHtml(html)

  const errors: string[] = []
  for (const client of buildPlayerClients(webClientVersion, visitorData)) {
    try {
      const data = await fetchPlayerResponse(videoId, apiKey, client, visitorData)
      const status = data.playabilityStatus?.status
      if (status && status !== "OK") {
        const reason = data.playabilityStatus?.reason?.trim()
        errors.push(
          `${String(client.clientName)}: ${reason || status}`.slice(0, 120)
        )
        continue
      }
      const videoUrl = pickProgressiveMp4Url(data.streamingData)
      if (!videoUrl?.startsWith("http")) {
        errors.push(`${String(client.clientName)}: MP4 URL 없음`)
        continue
      }
      const title =
        (typeof data.videoDetails?.title === "string" && data.videoDetails.title.trim().slice(0, 200)) ||
        fallbackTitle
      return { videoUrl, title }
    } catch (e) {
      errors.push(
        `${String(client.clientName)}: ${e instanceof Error ? e.message : "오류"}`.slice(0, 120)
      )
    }
  }

  const tail = errors.length ? ` (${errors[0]})` : ""
  throw new Error(
    `YouTube가 서버에서 영상 재생을 허용하지 않았습니다. 데이터센터 IP 차단일 수 있습니다.${tail}`
  )
}
