/**
 * YouTube 자막 — TTS·자동 생성 자막(asr) 포함.
 * WEB timedtext(exp=xpe)는 poToken 없이 빈 응답 → ANDROID InnerTube player API 사용.
 */

const YT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

type CaptionTrack = {
  baseUrl?: string
  languageCode?: string
  kind?: string
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9A-Fa-f]+);/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
}

function extractTranscriptFromJson3(content: string): string {
  try {
    const jsonData = JSON.parse(content) as {
      events?: Array<{ segs?: Array<{ utf8?: string; text?: string }> }>
    }
    if (!jsonData.events?.length) return ""
    return jsonData.events
      .filter((event) => event.segs?.length)
      .map((event) =>
        (event.segs || [])
          .map((seg) => seg.utf8 || seg.text || "")
          .join("")
      )
      .filter((text) => text.trim().length > 0)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
  } catch {
    return ""
  }
}

function extractTranscriptFromSrv3Xml(content: string): string {
  const parts: string[] = []
  for (const m of content.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)) {
    const inner = m[1]!.replace(/<[^>]+>/g, "")
    const t = decodeHtmlEntities(inner).trim()
    if (t) parts.push(t)
  }
  if (parts.length) return parts.join(" ").replace(/\s+/g, " ").trim()

  const textMatches = content.match(/<text[^>]*>([^<]+)<\/text>/g)
  if (!textMatches?.length) return ""
  return textMatches
    .map((match) => decodeHtmlEntities(match.replace(/<[^>]+>/g, "")))
    .filter((text) => text.trim().length > 0)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
}

function parseTranscriptContent(content: string, fmt: string): string {
  if (!content.trim()) return ""
  if (fmt === "json3") {
    const fromJson = extractTranscriptFromJson3(content)
    if (fromJson) return fromJson
  }
  if (fmt === "srv3" || fmt === "srv1" || content.trim().startsWith("<")) {
    const fromXml = extractTranscriptFromSrv3Xml(content)
    if (fromXml) return fromXml
  }
  if (fmt === "ttml1" || fmt === "xml") {
    return extractTranscriptFromSrv3Xml(content)
  }
  return extractTranscriptFromJson3(content)
}

function parseYtInitialPlayerResponse(html: string): Record<string, unknown> | null {
  const patterns = [
    /var ytInitialPlayerResponse = ({.+?});/s,
    /ytInitialPlayerResponse\s*=\s*({.+?});/s,
    /window\["ytInitialPlayerResponse"\]\s*=\s*({.+?});/s,
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (!match) continue
    try {
      return JSON.parse(match[1]!) as Record<string, unknown>
    } catch {
      continue
    }
  }
  return null
}

function extractInnertubeApiKey(html: string): string | null {
  const m = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)
  return m?.[1] || null
}

function selectCaptionTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  const languagePriority = ["ko", "ko-KR", "en", "en-US"]
  for (const lang of languagePriority) {
    const track = tracks.find((t) => {
      const code = (t.languageCode || "").toLowerCase()
      const target = lang.toLowerCase()
      return code === target || code.startsWith(target)
    })
    if (track?.baseUrl) return track
  }
  const asr = tracks.find((t) => t.kind === "asr" && t.baseUrl)
  if (asr) return asr
  return tracks.find((t) => t.baseUrl) || null
}

async function fetchTranscriptFromCaptionTrack(
  videoId: string,
  track: CaptionTrack
): Promise<string> {
  if (!track.baseUrl) return ""
  const watchPageUrl = `https://www.youtube.com/watch?v=${videoId}`
  const urlObj = new URL(track.baseUrl.replace(/&fmt=\w+$/, ""))
  const fmtOptions = ["json3", "srv3", "srv1", "ttml1"]

  for (const fmt of fmtOptions) {
    urlObj.searchParams.set("fmt", fmt)
    try {
      const r = await fetch(urlObj.toString(), {
        headers: {
          "User-Agent": YT_UA,
          Accept: "*/*",
          "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
          Referer: watchPageUrl,
          Origin: "https://www.youtube.com",
        },
        next: { revalidate: 0 },
      })
      if (!r.ok) continue
      const content = await r.text()
      const text = parseTranscriptContent(content, fmt)
      if (text.length >= 20) return text.slice(0, 4000)
    } catch {
      continue
    }
  }
  return ""
}

async function fetchYoutubeWatchHtml(videoId: string): Promise<string> {
  const watchPageUrl = `https://www.youtube.com/watch?v=${videoId}`
  const r = await fetch(watchPageUrl, {
    headers: {
      "User-Agent": YT_UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    },
    next: { revalidate: 0 },
  })
  if (!r.ok) return ""
  return r.text()
}

/** ANDROID InnerTube player — TTS·자동 자막(asr) poToken 없이 동작 */
async function fetchYoutubeTranscriptViaAndroidPlayer(
  videoId: string,
  watchHtml?: string
): Promise<string> {
  const id = videoId.trim()
  if (!id) return ""

  try {
    const html = watchHtml || (await fetchYoutubeWatchHtml(id))
    if (!html) return ""

    const apiKey = extractInnertubeApiKey(html)
    if (!apiKey) return ""

    const r = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${encodeURIComponent(apiKey)}`, {
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
        videoId: id,
      }),
      next: { revalidate: 0 },
    })
    if (!r.ok) return ""

    const playerData = (await r.json().catch(() => null)) as {
      captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] } }
    } | null
    const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks || []
    const selected = selectCaptionTrack(tracks)
    if (!selected) return ""

    return fetchTranscriptFromCaptionTrack(id, selected)
  } catch {
    return ""
  }
}

/** WEB watch HTML captionTracks (exp=xpe 영상은 빈 응답 가능) */
async function fetchYoutubeTranscriptFromWebCaptionTracks(
  videoId: string,
  watchHtml?: string
): Promise<string> {
  const id = videoId.trim()
  if (!id) return ""

  try {
    const html = watchHtml || (await fetchYoutubeWatchHtml(id))
    if (!html) return ""

    const playerResponse = parseYtInitialPlayerResponse(html)
    if (!playerResponse) return ""

    const captions = playerResponse.captions as
      | { playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] } }
      | undefined
    const tracks = captions?.playerCaptionsTracklistRenderer?.captionTracks || []
    const selected = selectCaptionTrack(tracks)
    if (!selected) return ""

    return fetchTranscriptFromCaptionTrack(id, selected)
  } catch {
    return ""
  }
}

/** 레거시: timedtext 직접 호출 */
export async function fetchYoutubeTranscriptJson3(videoId: string): Promise<string> {
  const id = videoId.trim()
  if (!id) return ""
  const langs = ["ko", "en"]
  for (const lang of langs) {
    const u = `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(id)}&lang=${lang}&fmt=json3`
    try {
      const r = await fetch(u, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; WingsProductSearch/1.0)" },
        next: { revalidate: 0 },
      })
      if (!r.ok) continue
      const js = (await r.json().catch(() => null)) as {
        events?: Array<{ segs?: Array<{ utf8?: string }> }>
      } | null
      if (!js?.events?.length) continue
      const parts: string[] = []
      for (const ev of js.events) {
        if (!ev.segs) continue
        for (const s of ev.segs) {
          if (typeof s.utf8 === "string" && s.utf8.trim()) parts.push(s.utf8.trim())
        }
      }
      const text = parts.join(" ").replace(/\s+/g, " ").trim()
      if (text.length >= 20) return text.slice(0, 4000)
    } catch {
      continue
    }
  }
  return ""
}

/** TTS·수동·자동 자막 — MVP·product-search 공용 */
export async function fetchYoutubeTranscript(videoId: string): Promise<string> {
  const id = videoId.trim()
  if (!id) return ""

  const watchHtml = await fetchYoutubeWatchHtml(id)

  const fromAndroid = await fetchYoutubeTranscriptViaAndroidPlayer(id, watchHtml)
  if (fromAndroid.length >= 20) return fromAndroid

  const fromWebTracks = await fetchYoutubeTranscriptFromWebCaptionTracks(id, watchHtml)
  if (fromWebTracks.length >= 20) return fromWebTracks

  const fromTimedtext = await fetchYoutubeTranscriptJson3(id)
  if (fromTimedtext.length >= fromAndroid.length) return fromTimedtext

  return fromAndroid.length > fromWebTracks.length ? fromAndroid : fromWebTracks
}
