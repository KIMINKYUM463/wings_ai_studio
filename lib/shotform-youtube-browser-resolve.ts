/**
 * 브라우저(사용자 IP)에서 YouTube 재생 URL 해석 — Vercel·Cloud Run yt-dlp 봇 차단 우회
 * Piped → Invidious 순 (youtubei.js는 CORS로 웹에서 동작하지 않음)
 * 클라이언트 컴포넌트에서만 호출하세요.
 */

import {
  resolveYoutubeViaInvidious,
  resolveYoutubeViaPiped,
} from "@/lib/shotform-youtube-piped-fallback"

export async function resolveYoutubeInBrowser(
  pageUrl: string
): Promise<{ videoUrl: string; title: string }> {
  if (typeof window === "undefined") {
    throw new Error("브라우저에서만 YouTube URL을 해석할 수 있습니다.")
  }

  const errors: string[] = []
  try {
    return await resolveYoutubeViaPiped(pageUrl)
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "Piped 오류")
  }

  try {
    return await resolveYoutubeViaInvidious(pageUrl)
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "Invidious 오류")
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

/** 재가공 YouTube·Piped 직접 URL → 브라우저 MP4 Blob */
export async function fetchReprocessVideoBlobInBrowser(
  videoUrl: string,
  onHint?: (msg: string) => void
): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("브라우저에서만 다운로드할 수 있습니다.")
  }

  const url = videoUrl.trim()
  if (!url.startsWith("http")) {
    throw new Error("유효하지 않은 영상 URL입니다.")
  }

  if (url.includes("googlevideo.com")) {
    return fetchGoogleVideoBlobInBrowser(url, onHint)
  }

  onHint?.("브라우저에서 영상 수신 중…")
  try {
    const res = await fetch(url, {
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
    xhr.open("GET", url, true)
    xhr.responseType = "blob"
    xhr.timeout = 300_000
    xhr.onload = () => {
      const blob = xhr.response as Blob
      if (xhr.status >= 200 && xhr.status < 300 && blob?.size >= 50_000) {
        resolve(blob)
        return
      }
      reject(new Error(`영상 수신 실패 (HTTP ${xhr.status})`))
    }
    xhr.onerror = () => reject(new Error("영상 네트워크 오류"))
    xhr.ontimeout = () => reject(new Error("영상 다운로드 시간 초과"))
    xhr.send()
  })
}
