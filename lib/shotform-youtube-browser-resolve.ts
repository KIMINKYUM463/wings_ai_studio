/**
 * 브라우저(사용자 IP)에서 YouTube 재생 URL 해석 — Vercel·Cloud Run yt-dlp 봇 차단 우회
 * 클라이언트 컴포넌트에서만 호출하세요.
 */

import { youtubeIdFromUrl } from "@/lib/shotform-youtube-stream-url"

export async function resolveYoutubeInBrowser(
  pageUrl: string
): Promise<{ videoUrl: string; title: string }> {
  if (typeof window === "undefined") {
    throw new Error("브라우저에서만 YouTube URL을 해석할 수 있습니다.")
  }

  const videoId = youtubeIdFromUrl(pageUrl)
  if (!videoId) {
    throw new Error("YouTube 영상 ID를 URL에서 찾지 못했습니다.")
  }

  const { ClientType, Innertube, Platform } = await import("youtubei.js/web")
  Platform.shim.eval = async (data: { output: string }) => {
    return new Function(data.output)()
  }

  const clients = [
    ClientType.WEB,
    ClientType.IOS,
    ClientType.ANDROID,
    ClientType.TV_EMBEDDED,
  ] as const

  const errors: string[] = []
  for (const client_type of clients) {
    try {
      const yt = await Innertube.create({
        client_type,
        retrieve_player: true,
        generate_session_locally: true,
      })
      const info = await yt.getBasicInfo(videoId)
      const title =
        String(info.basic_info?.title || "")
          .trim()
          .slice(0, 200) || "(YouTube 영상)"

      const format =
        info.chooseFormat({ type: "video+audio", quality: "best", format: "mp4" }) ||
        info.chooseFormat({ type: "video+audio", quality: "360p", format: "mp4" }) ||
        info.chooseFormat({ type: "video+audio", quality: "best" })

      if (!format) {
        errors.push(`${client_type}: 재생 포맷 없음`)
        continue
      }

      const videoUrl = format.decipher(yt.session.player)
      if (!videoUrl?.startsWith("http")) {
        errors.push(`${client_type}: URL 복호화 실패`)
        continue
      }

      return { videoUrl, title }
    } catch (e) {
      errors.push(
        `${client_type}: ${e instanceof Error ? e.message : "오류"}`.slice(0, 120)
      )
    }
  }

  throw new Error(
    errors.length
      ? `브라우저 YouTube 해석 실패 (${errors[0]})`
      : "브라우저 YouTube 해석 실패"
  )
}

/** googlevideo — 브라우저에서 직접 MP4 수신 (프록시·서버 IP 우회) */
export async function fetchGoogleVideoBlobInBrowser(
  videoUrl: string,
  onHint?: (msg: string) => void
): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("브라우저에서만 다운로드할 수 있습니다.")
  }

  onHint?.("브라우저에서 YouTube 영상 수신 중…")

  try {
    const res = await fetch(videoUrl, {
      signal: AbortSignal.timeout(300_000),
      credentials: "omit",
    })
    if (res.ok) {
      const blob = await res.blob()
      if (blob.size >= 50_000) return blob
    }
  } catch {
    /* XHR 폴백 */
  }

  return await new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("GET", videoUrl, true)
    xhr.responseType = "blob"
    xhr.timeout = 300_000
    xhr.onload = () => {
      const blob = xhr.response as Blob
      if (xhr.status >= 200 && xhr.status < 300 && blob?.size >= 50_000) {
        resolve(blob)
        return
      }
      reject(new Error(`YouTube MP4 수신 실패 (HTTP ${xhr.status})`))
    }
    xhr.onerror = () => reject(new Error("YouTube MP4 네트워크 오류"))
    xhr.ontimeout = () => reject(new Error("YouTube MP4 다운로드 시간 초과"))
    xhr.send()
  })
}
