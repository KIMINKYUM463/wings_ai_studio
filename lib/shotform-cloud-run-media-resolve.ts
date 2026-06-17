import {
  resolveShotformCloudRunAuthToken,
  resolveShotformCloudRunRenderUrl,
} from "@/lib/shotform-auto-edit-cloud-run-render"

/** Cloud Run yt-dlp — Vercel에서 YouTube·TikTok URL 해석 (서비스 재배포 필요) */
export async function resolveMediaUrlViaCloudRun(
  pageUrl: string
): Promise<{ videoUrl: string; title: string } | null> {
  const base = resolveShotformCloudRunRenderUrl()
  if (!base) return null

  const token = resolveShotformCloudRunAuthToken()
  const endpoint = `${base.replace(/\/$/, "")}/resolve-media-url`

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ url: pageUrl.trim() }),
      signal: AbortSignal.timeout(200_000),
    })

    if (res.status === 404) return null

    const json = (await res.json().catch(() => ({}))) as {
      videoUrl?: string
      title?: string
      error?: string
    }

    if (!res.ok) {
      throw new Error(json.error || `Cloud Run URL 해석 실패 (${res.status})`)
    }

    const videoUrl = json.videoUrl?.trim() || ""
    if (!videoUrl.startsWith("http")) {
      throw new Error(json.error || "Cloud Run에서 재생 URL을 찾지 못했습니다.")
    }

    return {
      videoUrl,
      title: (json.title || "").trim().slice(0, 200) || "(영상)",
    }
  } catch (e) {
    if (e instanceof Error && /404|not found/i.test(e.message)) return null
    throw e
  }
}
