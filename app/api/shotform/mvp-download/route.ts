import { type NextRequest, NextResponse } from "next/server"
import { resolveDouyinNoteUrl } from "@/lib/shotform-mvp-resolve-urls"
import { detectReprocessUrlPlatform, resolveReprocessUrl } from "@/lib/shotform-mvp-reprocess-url"
import { fetchXhsNoteVideoUrl } from "@/lib/xhs-video"
import { isAllowedVideoHost } from "@/lib/video-upstream-fetch"

export const maxDuration = 300

function apifyTokenFromBody(body: Record<string, unknown>): string {
  return (
    (typeof body.apifyApiKey === "string" && body.apifyApiKey.trim()) ||
    process.env.APIFY_TOKEN ||
    ""
  )
}

type DownloadItem = {
  url: string
  videoUrl?: string
  platform?: string
  title?: string
  /** true면 저장된 CDN URL 무시하고 노트 페이지에서 MP4 재조회 */
  refreshFromNote?: boolean
}

/** 선택 영상만 다운로드 URL 반환 (직접 MP4 링크 우선) */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const apifyToken = apifyTokenFromBody(body)
    const raw = body.items
    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json({ error: "items 배열이 필요합니다." }, { status: 400 })
    }
    if (raw.length > 5) {
      return NextResponse.json({ error: "한 번에 최대 5개까지 다운로드할 수 있습니다." }, { status: 400 })
    }

    const items = raw.filter((x): x is DownloadItem => x && typeof x === "object" && typeof x.url === "string")
    const results: Array<{
      url: string
      title: string
      platform: string
      downloadUrl: string | null
      direct: boolean
      refreshedVideoUrl?: string
      error?: string
    }> = []

    for (const item of items) {
      const pageUrl = item.url.trim()
      const refreshFromNote = Boolean(item.refreshFromNote)
      const direct = refreshFromNote ? "" : (item.videoUrl || "").trim()
      let downloadUrl: string | null = null
      let refreshedVideoUrl: string | undefined
      let error: string | undefined

      if (direct.startsWith("http")) {
        try {
          const host = new URL(direct).hostname
          if (
            host.includes("douyinvod") ||
            host.includes("xhscdn") ||
            host.includes("tiktokcdn") ||
            host.includes("tiktokv") ||
            host.includes("muscdn") ||
            host.includes("googlevideo.com") ||
            host.includes("bytecdn") ||
            isAllowedVideoHost(host)
          ) {
            downloadUrl = `/api/proxy-video?url=${encodeURIComponent(direct)}`
          } else {
            downloadUrl = direct
          }
        } catch {
          downloadUrl = direct
        }
      } else if (detectReprocessUrlPlatform(pageUrl)) {
        try {
          const resolved = await resolveReprocessUrl(apifyToken, pageUrl)
          if (resolved.videoUrl.startsWith("http")) {
            refreshedVideoUrl = resolved.videoUrl
            downloadUrl = `/api/proxy-video?url=${encodeURIComponent(resolved.videoUrl)}`
          } else {
            error = resolved.error || "YouTube·TikTok 재생 URL 조회 실패"
          }
        } catch (e) {
          error = e instanceof Error ? e.message : "YouTube·TikTok 영상 URL 조회 실패"
        }
      } else if (
        (item.platform === "xiaohongshu" || pageUrl.includes("xiaohongshu.com")) &&
        pageUrl.includes("xiaohongshu")
      ) {
        try {
          const resolved = await fetchXhsNoteVideoUrl(pageUrl)
          if (resolved) {
            refreshedVideoUrl = resolved
            downloadUrl = `/api/proxy-video?url=${encodeURIComponent(resolved)}`
          } else {
            error = "노트 페이지에서 MP4를 찾지 못했습니다"
          }
        } catch {
          error = "샤오홍슈 노트 영상 URL 조회 실패"
        }
      } else if (
        item.platform === "douyin" ||
        pageUrl.includes("douyin.com") ||
        pageUrl.includes("iesdouyin.com") ||
        pageUrl.includes("v.douyin.com")
      ) {
        if (!apifyToken) {
          error = "抖音 노트 URL 재조회에 소스 검색 토큰이 필요합니다. ShotForm 설정에 토큰을 저장해 주세요."
        } else {
          try {
            const resolved = await resolveDouyinNoteUrl(apifyToken, pageUrl)
            if (resolved.videoUrl.startsWith("http")) {
              refreshedVideoUrl = resolved.videoUrl
              downloadUrl = `/api/proxy-video?url=${encodeURIComponent(resolved.videoUrl)}`
            } else {
              error = "抖音 노트에서 재생 URL을 찾지 못했습니다"
            }
          } catch (e) {
            error = e instanceof Error ? e.message : "抖音 노트 영상 URL 조회 실패"
          }
        }
      } else {
        error = "직접 MP4(videoUrl) 없음 — playUrl이 포함된 항목을 선택하세요"
      }

      results.push({
        url: pageUrl,
        title: item.title || "",
        platform: item.platform || "unknown",
        downloadUrl,
        direct: Boolean(direct),
        refreshedVideoUrl,
        error,
      })
    }

    return NextResponse.json({
      count: results.length,
      results,
      notice: "선택한 영상만 다운로드합니다. videoUrl(직접 재생 링크)이 있는 항목이 성공률이 높습니다.",
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "오류" }, { status: 500 })
  }
}
