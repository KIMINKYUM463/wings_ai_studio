/** MVP 짜집기 — 선택 영상 MP4 다운로드 (만료 CDN URL 재조회 포함) */

import type { AutoEditPick } from "@/lib/shotform-auto-edit-types"
import { fetchGoogleVideoBlobInBrowser } from "@/lib/shotform-youtube-browser-resolve"
import { isAllowedVideoHost } from "@/lib/video-upstream-fetch"

function shotformApifyToken(): string | null {
  if (typeof window === "undefined") return null
  return (localStorage.getItem("shotform_apify_token") || "").trim() || null
}

export type MvpPickDownloadInput = {
  videoUrl: string
  noteUrl: string
  title: string
  platform: string
  video_id: string
}

type ResolveResult = {
  downloadUrl: string | null
  error?: string
  refreshedVideoUrl?: string
}

function isCdnPlayUrl(url: string): boolean {
  try {
    const host = new URL(url.trim()).hostname
    return (
      host.includes("douyinvod") ||
      host.includes("xhscdn") ||
      host.includes("bytecdn") ||
      host.includes("tiktokcdn") ||
      host.includes("tiktokv") ||
      host.includes("muscdn") ||
      host.includes("googlevideo.com")
    )
  } catch {
    return false
  }
}

function isReprocessNotePage(url: string): boolean {
  const u = url.trim()
  if (!u.startsWith("http")) return false
  return (
    u.includes("youtube.com") ||
    u.includes("youtu.be") ||
    (u.includes("tiktok.com") && !isCdnPlayUrl(u))
  )
}

function isDouyinNotePage(url: string): boolean {
  const u = url.trim()
  if (!u.startsWith("http") || isCdnPlayUrl(u)) return false
  return u.includes("douyin.com") || u.includes("iesdouyin.com") || u.includes("v.douyin.com")
}

function isXhsNotePage(url: string): boolean {
  const u = url.trim()
  return u.startsWith("http") && u.includes("xiaohongshu.com") && !isCdnPlayUrl(u)
}

/** 선택 저장 시 noteUrl=노트 페이지, videoUrl=CDN 재생 주소가 되도록 정리 */
export function normalizeMvpPickUrls(args: { url?: string; videoUrl?: string }): {
  noteUrl: string
  videoUrl: string
} {
  let noteUrl = (args.url ?? "").trim()
  let videoUrl = (args.videoUrl ?? "").trim()

  if (isCdnPlayUrl(noteUrl)) noteUrl = ""

  if (!noteUrl && isDouyinNotePage(videoUrl)) {
    noteUrl = videoUrl.split("?")[0] || videoUrl
  }
  if (!noteUrl && isXhsNotePage(videoUrl)) {
    noteUrl = videoUrl.split("?")[0] || videoUrl
  }
  if (noteUrl && isCdnPlayUrl(videoUrl) && isDouyinNotePage(noteUrl)) {
    return { noteUrl: noteUrl.split("?")[0] || noteUrl, videoUrl }
  }

  return {
    noteUrl: noteUrl.split("?")[0] || noteUrl,
    videoUrl,
  }
}

function pickToDownloadInput(pick: AutoEditPick): MvpPickDownloadInput {
  return {
    videoUrl: pick.videoUrl,
    noteUrl: pick.noteUrl,
    title: pick.title,
    platform: pick.platform,
    video_id: pick.video_id,
  }
}

function canRefreshFromNote(pick: MvpPickDownloadInput): boolean {
  const isDouyinPick =
    pick.platform === "douyin" ||
    pick.noteUrl.includes("douyin.com") ||
    pick.noteUrl.includes("iesdouyin.com") ||
    pick.noteUrl.includes("v.douyin.com")
  const isXhs =
    isXhsPick(pick) && pick.noteUrl.includes("xiaohongshu")
  const isReprocess =
    pick.platform === "youtube" ||
    pick.platform === "tiktok" ||
    isReprocessNotePage(pick.noteUrl)
  return isDouyinPick || isXhs || isReprocess
}

/** 저장된 CDN URL이 아직 다운로드 가능한지 가볍게 확인 */
export async function probeMvpPickVideoUrl(videoUrl: string): Promise<boolean> {
  const url = videoUrl.trim()
  if (!url.startsWith("http")) return false

  let probe = url
  try {
    const host = new URL(url).hostname
    if (
      isAllowedVideoHost(host) ||
      host.includes("tiktokcdn") ||
      host.includes("tiktokv") ||
      host.includes("muscdn") ||
      host.includes("googlevideo.com")
    ) {
      probe = `/api/proxy-video?url=${encodeURIComponent(url)}`
    }
  } catch {
    return false
  }

  try {
    const res = await fetch(probe, {
      method: "GET",
      headers: { Range: "bytes=0-8191" },
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok && res.status !== 206) return false
    const ct = (res.headers.get("content-type") || "").toLowerCase()
    const blob = await res.blob()
    if (ct.includes("video") || ct.includes("octet-stream") || ct.includes("mp4")) {
      return blob.size >= 256
    }
    return blob.size >= 2_000
  } catch {
    return false
  }
}

/** 노트 페이지에서 재생 URL만 다시 조회 (MP4 전체 다운로드 없음) */
export async function refreshMvpPickVideoUrl(
  pick: MvpPickDownloadInput
): Promise<{ videoUrl: string | null; error?: string }> {
  if (!canRefreshFromNote(pick)) {
    return { videoUrl: null, error: "노트 URL로 재조회할 수 없는 영상입니다." }
  }
  const resolved = await resolveDownloadUrl(pick, true)
  const fresh = resolved.refreshedVideoUrl?.trim()
  if (fresh?.startsWith("http")) {
    return { videoUrl: fresh }
  }
  return { videoUrl: null, error: resolved.error || "노트에서 재생 URL을 찾지 못했습니다." }
}

export type RefreshExpiredPicksResult = {
  picks: AutoEditPick[]
  refreshedCount: number
  errors: string[]
}

/** 선택(체크)된 영상 중 만료된 videoUrl만 노트에서 다시 살림 */
export async function refreshExpiredMvpEditPicks(
  picks: AutoEditPick[],
  onProgress?: (message: string) => void
): Promise<RefreshExpiredPicksResult> {
  const next = [...picks]
  let refreshedCount = 0
  const errors: string[] = []

  for (let i = 0; i < next.length; i++) {
    const pick = next[i]!
    const label = pick.title || pick.video_id
    onProgress?.(`선택 영상 ${i + 1}/${next.length} URL 확인…`)

    const alive = await probeMvpPickVideoUrl(pick.videoUrl)
    if (alive) continue

    if (!pick.noteUrl.trim()) {
      errors.push(`${label}: 노트 URL이 없어 갱신할 수 없습니다.`)
      continue
    }

    onProgress?.(`선택 영상 ${i + 1}/${next.length} 만료 — URL 갱신 중…`)
    let { videoUrl, error } = await refreshMvpPickVideoUrl(pickToDownloadInput(pick))
    if (
      !videoUrl &&
      pick.platform === "youtube" &&
      typeof window !== "undefined" &&
      pick.noteUrl.includes("youtube")
    ) {
      try {
        const { resolveYoutubeInBrowser } = await import("@/lib/shotform-youtube-browser-resolve")
        const browser = await resolveYoutubeInBrowser(pick.noteUrl)
        videoUrl = browser.videoUrl
        error = undefined
      } catch {
        /* 서버 오류 메시지 유지 */
      }
    }
    if (videoUrl) {
      next[i] = { ...pick, videoUrl }
      refreshedCount++
    } else {
      errors.push(`${label}: ${error || "URL 갱신 실패"}`)
    }
  }

  return { picks: next, refreshedCount, errors }
}

async function resolveDownloadUrl(
  pick: MvpPickDownloadInput,
  refreshFromNote: boolean
): Promise<ResolveResult> {
  const apifyApiKey = shotformApifyToken()
  const res = await fetch("/api/shotform/mvp-download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apifyApiKey: apifyApiKey || undefined,
      items: [
        {
          url: pick.noteUrl,
          videoUrl: refreshFromNote ? "" : pick.videoUrl,
          title: pick.title,
          platform: pick.platform,
          refreshFromNote,
        },
      ],
    }),
  })
  const json = (await res.json().catch(() => ({}))) as {
    results?: Array<{
      downloadUrl: string | null
      error?: string
      refreshedVideoUrl?: string
    }>
    error?: string
  }
  if (!res.ok) return { downloadUrl: null, error: json.error || "다운로드 URL 조회 실패" }
  const row = json.results?.[0]
  return {
    downloadUrl: row?.downloadUrl ?? null,
    error: row?.error,
    refreshedVideoUrl: row?.refreshedVideoUrl,
  }
}

export function formatShotformFetchError(e: unknown, context?: string): string {
  const raw = e instanceof Error ? e.message : String(e)
  const prefix = context ? `${context}: ` : ""
  if (raw && !/failed to fetch|networkerror|load failed/i.test(raw) && raw.length > 30) {
    return raw
  }
  if (/failed to fetch|networkerror|load failed/i.test(raw)) {
    return (
      `${prefix}서버와 연결이 끊겼습니다.\n\n` +
      "짜집기는 2~4분 걸릴 수 있습니다. 개발 서버가 재시작되면 진행 중 작업이 사라집니다. " +
      "페이지를 닫지 않고 다시 「편집 실행」을 눌러 주세요. " +
      "반복되면 CDN 링크 만료일 수 있으니 소스 검색·URL 직접 입력으로 영상을 다시 추가해 주세요."
    )
  }
  if (/403|forbidden|upstream fetch/i.test(raw)) {
    return (
      `${prefix}영상 CDN 링크가 만료되었거나 접근이 거부되었습니다(403).\n\n` +
      "로컬 렌더 모드면 PC 작업 폴더 sources/ 에 영상이 있는지 확인하고, " +
      "抖音 영상은 ShotForm 설정에 소스 검색(Apify) 토큰이 있어야 URL을 다시 조회할 수 있습니다. " +
      "또는 소스 검색·URL 직접 입력으로 영상을 다시 추가해 주세요."
    )
  }
  if (/timeout|timed out|aborted/i.test(raw)) {
    return (
      `${prefix}영상 다운로드 시간이 초과됐습니다.\n\n` +
      "네트워크가 느리거나 CDN 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요."
    )
  }
  return prefix + (raw || "알 수 없는 네트워크 오류")
}

async function fetchBlobFromDownloadUrl(downloadUrl: string): Promise<Blob | null> {
  try {
    const res = await fetch(downloadUrl, { signal: AbortSignal.timeout(300_000) })
    if (!res.ok) {
      const hint = await res
        .json()
        .then((j: { error?: string }) => j.error)
        .catch(() => null)
      throw new Error(hint || `영상 프록시 응답 실패 (${res.status})`)
    }
    const blob = await res.blob()
    if (blob.size < 50_000) return null
    return blob
  } catch (e) {
    if (e instanceof Error && e.message.includes("프록시")) throw e
    throw new Error(formatShotformFetchError(e, "MP4 수신"))
  }
}

function isXhsPick(pick: MvpPickDownloadInput): boolean {
  return (
    pick.platform === "xiaohongshu" ||
    pick.noteUrl.includes("xiaohongshu.com") ||
    pick.videoUrl.includes("xhscdn")
  )
}

export type MvpPickFetchOptions = {
  /** 로컬 작업 폴더 sources/ 에 있으면 CDN 대신 에이전트에서 읽기 */
  localWorkDir?: string
  companionUrl?: string
}

async function tryFetchFromLocalCompanion(
  pick: MvpPickDownloadInput,
  opts?: MvpPickFetchOptions,
  onHint?: (hint: string) => void
): Promise<{ blob: Blob } | null> {
  const workDir = opts?.localWorkDir?.trim()
  if (!workDir) return null
  const { probeCompanionSourceExists, fetchCompanionSourceMp4 } = await import(
    "@/lib/shotform-local-companion-client"
  )
  const exists = await probeCompanionSourceExists({
    companionUrl: opts?.companionUrl,
    localWorkDir: workDir,
    videoId: pick.video_id,
  })
  if (!exists) return null
  onHint?.("로컬 작업 폴더에 저장된 영상 사용…")
  const blob = await fetchCompanionSourceMp4({
    companionUrl: opts?.companionUrl,
    localWorkDir: workDir,
    videoId: pick.video_id,
  })
  return { blob }
}

/**
 * 저장 프로젝트 등에서 CDN URL이 만료된 경우 노트 페이지에서 URL을 다시 조회합니다.
 */
export async function fetchMvpPickVideoBlob(
  pick: MvpPickDownloadInput,
  onHint?: (hint: string) => void,
  opts?: MvpPickFetchOptions
): Promise<{ blob: Blob; refreshedVideoUrl?: string }> {
  const label = pick.title || pick.video_id

  try {
    const local = await tryFetchFromLocalCompanion(pick, opts, onHint)
    if (local) return local
  } catch {
    /* CDN 폴백 */
  }

  onHint?.("저장된 영상 URL로 다운로드 시도…")

  const isYoutubeGoogleVideo =
    pick.platform === "youtube" ||
    pick.videoUrl.includes("googlevideo.com") ||
    isReprocessNotePage(pick.noteUrl)

  if (isYoutubeGoogleVideo && pick.videoUrl.includes("googlevideo.com")) {
    try {
      const blob = await fetchGoogleVideoBlobInBrowser(pick.videoUrl, onHint)
      return { blob }
    } catch {
      onHint?.("브라우저 직접 수신 실패 — 서버 프록시 재시도…")
    }
  }

  let resolved = await resolveDownloadUrl(pick, false)
  let firstFetchError: string | undefined
  if (resolved.downloadUrl) {
    try {
      const blob = await fetchBlobFromDownloadUrl(resolved.downloadUrl)
      if (blob) {
        return { blob, refreshedVideoUrl: resolved.refreshedVideoUrl }
      }
    } catch (e) {
      firstFetchError = e instanceof Error ? e.message : String(e)
      const is403 = /403|forbidden|upstream fetch|만료|거부/i.test(firstFetchError)
      if (!is403 && !canRefreshFromNote(pick)) {
        throw e
      }
    }
  }

  const isDouyinPick =
    pick.platform === "douyin" ||
    pick.noteUrl.includes("douyin.com") ||
    pick.noteUrl.includes("iesdouyin.com") ||
    pick.noteUrl.includes("v.douyin.com")
  const isReprocessPick =
    pick.platform === "youtube" ||
    pick.platform === "tiktok" ||
    isReprocessNotePage(pick.noteUrl)

  if (canRefreshFromNote(pick)) {
    onHint?.(
      isDouyinPick
        ? "만료된 링크 감지 — 抖音 노트에서 영상 URL 재조회…"
        : isReprocessPick
          ? "만료된 링크 감지 — YouTube·TikTok에서 영상 URL 재조회…"
          : "만료된 링크 감지 — 샤오홍슈 노트에서 영상 URL 재조회…"
    )
    resolved = await resolveDownloadUrl(pick, true)
    if (resolved.downloadUrl) {
      const blob = await fetchBlobFromDownloadUrl(resolved.downloadUrl)
      if (blob) {
        return { blob, refreshedVideoUrl: resolved.refreshedVideoUrl }
      }
    }
  }

  const platformHint = isXhsPick(pick)
    ? "샤오홍슈 노트에서 영상을 다시 찾지 못했습니다."
    : isDouyinPick
      ? "抖音 CDN 링크가 만료되었을 수 있습니다. ShotForm 설정에 소스 검색 토큰이 있는지 확인한 뒤, URL 직접 입력 또는 소스 검색으로 영상을 다시 추가해 주세요."
      : "영상 CDN 링크가 만료되었을 수 있습니다."

  throw new Error(
    `영상 다운로드 실패: ${label}\n\n${platformHint}${
      resolved.error ? `\n(${resolved.error})` : ""
    }${firstFetchError ? `\n(${firstFetchError})` : ""}`
  )
}
