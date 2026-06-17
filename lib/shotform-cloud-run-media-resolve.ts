import {
  resolveShotformCloudRunAuthToken,
  resolveShotformCloudRunRenderUrl,
} from "@/lib/shotform-auto-edit-cloud-run-render"

/** Cloud Run yt-dlp — Vercel에서 YouTube·TikTok URL 해석 (서비스 재배포 필요) */
export async function resolveMediaUrlViaCloudRun(
  pageUrl: string
): Promise<{ videoUrl: string; title: string }> {
  const base = resolveShotformCloudRunRenderUrl()
  if (!base) {
    throw new Error(
      "Cloud Run URL 미설정 — Vercel에 SHOPPING_CLOUD_RUN_RENDER_URL 또는 SHOTFORM_CLOUD_RUN_RENDER_URL을 설정하세요."
    )
  }

  const token = resolveShotformCloudRunAuthToken()
  const endpoint = `${base.replace(/\/$/, "")}/resolve-media-url`

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ url: pageUrl.trim() }),
    signal: AbortSignal.timeout(200_000),
  })

  if (res.status === 404) {
    throw new Error(
      "Cloud Run에 /resolve-media-url 엔드포인트가 없습니다. cloud-run-service를 최신 Dockerfile로 재배포하세요."
    )
  }

  const json = (await res.json().catch(() => ({}))) as {
    videoUrl?: string
    title?: string
    error?: string
  }

  if (!res.ok) {
    throw new Error(json.error || `Cloud Run URL 해석 실패 (HTTP ${res.status})`)
  }

  const videoUrl = json.videoUrl?.trim() || ""
  if (!videoUrl.startsWith("http")) {
    throw new Error(json.error || "Cloud Run에서 재생 URL을 찾지 못했습니다.")
  }

  return {
    videoUrl,
    title: (json.title || "").trim().slice(0, 200) || "(영상)",
  }
}
