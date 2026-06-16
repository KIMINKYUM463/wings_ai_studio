import fs from "fs/promises"
import {
  autoEditJobStoreEnabled,
  uploadAutoEditSourceToSupabase,
} from "@/lib/shotform-auto-edit-job-store"
import { hasFfmpeg } from "@/lib/ffmpeg-binaries"
import type { EditPlanSegment } from "@/lib/shotform-auto-edit-types"
import { unwrapProxyVideoUrl } from "@/lib/video-upstream-fetch"

/** 짜집기 렌더 — shotform_auto_edit 가 my-project 에 배포됨 (wingsshort 보다 우선) */
export function resolveShotformCloudRunRenderUrl(): string | null {
  const url =
    process.env.SHOTFORM_CLOUD_RUN_RENDER_URL?.trim() ||
    process.env.CLOUD_RUN_RENDER_URL?.trim() ||
    process.env.SHOPPING_CLOUD_RUN_RENDER_URL?.trim() ||
    ""
  return url || null
}

function resolveCloudRunSourceUrl(videoUrl: string): string {
  const trimmed = videoUrl.trim()
  if (!trimmed) {
    throw new Error("렌더 소스 URL이 비어 있습니다.")
  }
  const upstream = unwrapProxyVideoUrl(trimmed)
  if (upstream.startsWith("http")) return upstream
  if (trimmed.startsWith("/api/proxy-video")) {
    const origin =
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://wingsaistudio.com"
    return `${origin.replace(/\/$/, "")}${trimmed}`
  }
  if (trimmed.startsWith("http")) return trimmed
  throw new Error(
    `렌더 소스 URL이 유효하지 않습니다 (${trimmed.slice(0, 80)}). 브라우저 업로드 또는 CDN URL 갱신 후 다시 시도해 주세요.`
  )
}

export function resolveShotformCloudRunAuthToken(): string | undefined {
  const token =
    process.env.SHOPPING_CLOUD_RUN_AUTH_TOKEN?.trim() ||
    process.env.CLOUD_RUN_AUTH_TOKEN?.trim() ||
    ""
  return token || undefined
}

/** Vercel serverless — ffmpeg 번들 제한으로 Cloud Run 렌더 사용 */
export function shouldUseCloudRunForAutoEditRender(): boolean {
  if (process.env.VERCEL) return true
  if (process.env.SHOTFORM_FORCE_CLOUD_RUN_RENDER === "1") return true
  return !hasFfmpeg()
}

async function buildSourceUrlMap(args: {
  jobId: string
  sourcePaths: Record<string, string>
  fallbackUrls?: Record<string, string>
}): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  const videoIds = new Set([
    ...Object.keys(args.sourcePaths),
    ...Object.keys(args.fallbackUrls ?? {}),
  ])

  for (const videoId of videoIds) {
    const localPath = args.sourcePaths[videoId]
    if (localPath && autoEditJobStoreEnabled()) {
      const signed = await uploadAutoEditSourceToSupabase(args.jobId, videoId, localPath)
      if (signed) {
        out[videoId] = signed
        continue
      }
    }
    const fallback = args.fallbackUrls?.[videoId]
    if (fallback) out[videoId] = resolveCloudRunSourceUrl(fallback)
  }
  if (!Object.keys(out).length) {
    throw new Error(
      "렌더용 소스 URL을 준비하지 못했습니다. Supabase Storage·SUPABASE_SERVICE_ROLE_KEY 설정을 확인해 주세요."
    )
  }
  if (process.env.VERCEL) {
    for (const [vid, url] of Object.entries(out)) {
      if (!url.startsWith("http")) {
        throw new Error(
          `렌더 소스 URL이 유효하지 않습니다 (${vid}). Supabase 업로드가 실패했을 수 있습니다.`
        )
      }
    }
  }
  return out
}

export async function renderEditPlanOnCloudRun(args: {
  jobId: string
  sourcePaths: Record<string, string>
  sourceUrls?: Record<string, string>
  segments: EditPlanSegment[]
  outputPath: string
  targetDuration: number
  defaultVideoId?: string
}): Promise<void> {
  const cloudRunUrl = resolveShotformCloudRunRenderUrl()
  if (!cloudRunUrl) {
    throw new Error(
      "Cloud Run 렌더 URL이 없습니다. Vercel에 SHOPPING_CLOUD_RUN_RENDER_URL 또는 CLOUD_RUN_RENDER_URL을 설정해 주세요."
    )
  }

  const sourceUrls = await buildSourceUrlMap({
    jobId: args.jobId,
    sourcePaths: args.sourcePaths,
    fallbackUrls: args.sourceUrls,
  })

  const auth = resolveShotformCloudRunAuthToken()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 780_000)

  let res: Response
  try {
    res = await fetch(`${cloudRunUrl.replace(/\/$/, "")}/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      },
      body: JSON.stringify({
        type: "shotform_auto_edit",
        sourceUrls,
        segments: args.segments,
        targetDuration: args.targetDuration,
        defaultVideoId: args.defaultVideoId,
        serverless: true,
      }),
      signal: controller.signal,
    })
  } catch (e) {
    clearTimeout(timer)
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("abort")) {
      throw new Error("Cloud Run 렌더 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.")
    }
    throw new Error(`Cloud Run 연결 실패: ${msg.slice(0, 200)}`)
  } finally {
    clearTimeout(timer)
  }

  const rawText = await res.text()
  let payload: {
    success?: boolean
    error?: string
    videoBase64?: string
    videoUrl?: string
  } | null = null
  try {
    payload = JSON.parse(rawText) as typeof payload
  } catch {
    const snippet = rawText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 240)
    throw new Error(
      snippet
        ? `Cloud Run 응답 오류 (HTTP ${res.status}): ${snippet}`
        : `Cloud Run 렌더 실패 (HTTP ${res.status}). SHOPPING_CLOUD_RUN_RENDER_URL 대신 CLOUD_RUN_RENDER_URL(my-project)을 사용하는지 확인해 주세요.`
    )
  }

  if (!res.ok || !payload?.success) {
    throw new Error(payload?.error || `Cloud Run 렌더 실패 (HTTP ${res.status})`)
  }

  if (payload.videoUrl) {
    const videoRes = await fetch(payload.videoUrl, { signal: AbortSignal.timeout(300_000) })
    if (!videoRes.ok) throw new Error(`렌더 결과 다운로드 실패 (${videoRes.status})`)
    const buf = Buffer.from(await videoRes.arrayBuffer())
    await fs.writeFile(args.outputPath, buf)
  } else if (payload.videoBase64) {
    const buf = Buffer.from(payload.videoBase64, "base64")
    await fs.writeFile(args.outputPath, buf)
  } else {
    throw new Error("Cloud Run 응답에 영상 데이터가 없습니다.")
  }
}
