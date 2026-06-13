import { waitUntil } from "@vercel/functions"
import { type NextRequest, NextResponse } from "next/server"
import type { AutoEditInput, AutoEditTargetDuration, AutoEditVideoInput } from "@/lib/shotform-auto-edit-types"
import { MAX_AUTO_EDIT_VIDEOS, normalizeAutoEditAnalysisMode } from "@/lib/shotform-auto-edit-types"
import { createAutoEditWorkDir } from "@/lib/shotform-auto-edit-ffmpeg"
import { persistAutoEditJobToSupabase } from "@/lib/shotform-auto-edit-job-store"
import { getAutoEditJobAsync, putAutoEditJob } from "@/lib/shotform-auto-edit-jobs"
import { runAutoEditPipeline } from "@/lib/shotform-auto-edit-pipeline"

export const maxDuration = 800

const DURATIONS = new Set<number>([20, 30, 45, 60])

function openaiKey(body: Record<string, unknown>): string {
  return (
    (typeof body.openaiApiKey === "string" && body.openaiApiKey.trim()) ||
    process.env.shotform_openai_api_key ||
    process.env.OPENAI_API_KEY ||
    ""
  )
}

function vmakeKey(body: Record<string, unknown>): string {
  return (
    (typeof body.vmakeApiKey === "string" && body.vmakeApiKey.trim()) ||
    process.env.shotform_vmake_api_key ||
    process.env.VMAKE_API_KEY ||
    ""
  )
}

function vmakeSecretKey(body: Record<string, unknown>): string {
  return (
    (typeof body.vmakeSecretAccessKey === "string" && body.vmakeSecretAccessKey.trim()) ||
    process.env.shotform_vmake_secret_access_key ||
    process.env.VMAKE_SECRET_ACCESS_KEY ||
    ""
  )
}

function vmakeSubtitleCreatePath(body: Record<string, unknown>): string | undefined {
  const v =
    (typeof body.vmakeSubtitleCreatePath === "string" && body.vmakeSubtitleCreatePath.trim()) ||
    process.env.VMAKE_SUBTITLE_CREATE_PATH ||
    ""
  return v || undefined
}

function vmakeSubtitlePollPath(body: Record<string, unknown>): string | undefined {
  const v =
    (typeof body.vmakeSubtitlePollPath === "string" && body.vmakeSubtitlePollPath.trim()) ||
    process.env.VMAKE_SUBTITLE_POLL_PATH ||
    ""
  return v || undefined
}

function parseRemoveChineseSubtitles(body: Record<string, unknown>): boolean {
  if (typeof body.removeChineseSubtitles === "boolean") return body.removeChineseSubtitles
  if (body.removeChineseSubtitles === "true" || body.removeChineseSubtitles === "1") return true
  return false
}

function parseVideos(raw: unknown): AutoEditVideoInput[] {
  if (!Array.isArray(raw)) return []
  const out: AutoEditVideoInput[] = []
  for (let i = 0; i < raw.length && out.length < MAX_AUTO_EDIT_VIDEOS; i++) {
    const row = raw[i]
    if (!row || typeof row !== "object") continue
    const o = row as Record<string, unknown>
    const videoUrl = typeof o.videoUrl === "string" ? o.videoUrl.trim() : ""
    if (!videoUrl.startsWith("http") && !videoUrl.startsWith("/api/proxy-video")) continue
    out.push({
      video_id:
        typeof o.video_id === "string" && o.video_id.trim()
          ? o.video_id.trim()
          : `video_${String(out.length + 1).padStart(3, "0")}`,
      videoUrl,
      title: typeof o.title === "string" ? o.title : "",
      noteUrl: typeof o.noteUrl === "string" ? o.noteUrl : "",
      platform: typeof o.platform === "string" ? o.platform : "xiaohongshu",
    })
  }
  return out
}

function parsePayload(body: Record<string, unknown>) {
  const videos = parseVideos(body.videos)
  if (!videos.length && typeof body.videoUrl === "string") {
    const videoUrl = body.videoUrl.trim()
    if (videoUrl.startsWith("http") || videoUrl.startsWith("/api/proxy-video")) {
      videos.push({
        video_id: "video_001",
        videoUrl,
        title: typeof body.title === "string" ? body.title : "",
        noteUrl: typeof body.noteUrl === "string" ? body.noteUrl : "",
        platform: typeof body.platform === "string" ? body.platform : "xiaohongshu",
      })
    }
  }
  const targetRaw = Number(body.targetDuration ?? 30)
  const targetDuration = (DURATIONS.has(targetRaw) ? targetRaw : 30) as AutoEditTargetDuration
  return { videos, targetDuration }
}

function parseClientVideoMeta(
  raw: unknown
): AutoEditInput["clientVideoMeta"] | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const out: NonNullable<AutoEditInput["clientVideoMeta"]> = {}
  for (const [videoId, row] of Object.entries(raw as Record<string, unknown>)) {
    if (!videoId.trim() || !row || typeof row !== "object") continue
    const o = row as Record<string, unknown>
    const duration = Number(o.duration)
    const keyframeDataUrl = typeof o.keyframeDataUrl === "string" ? o.keyframeDataUrl : ""
    const timeSec = Number(o.timeSec)
    if (!Number.isFinite(duration) || duration <= 0) continue
    const entry: NonNullable<AutoEditInput["clientVideoMeta"]>[string] = { duration }
    if (keyframeDataUrl.startsWith("data:image/")) {
      entry.keyframeDataUrl = keyframeDataUrl
      entry.timeSec = Number.isFinite(timeSec) ? timeSec : duration * 0.12
    }
    out[videoId] = entry
  }
  return Object.keys(out).length ? out : undefined
}

function parseSourceKeywords(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((k) => String(k ?? "").trim()).filter(Boolean)
}

function buildPipelineInput(
  body: Record<string, unknown>,
  videos: AutoEditVideoInput[],
  targetDuration: AutoEditTargetDuration,
  uploadedVideos?: Record<string, Buffer>
): AutoEditInput {
  return {
    videos,
    targetDuration,
    openaiApiKey: openaiKey(body),
    vmakeApiKey: vmakeKey(body) || undefined,
    vmakeSecretAccessKey: vmakeSecretKey(body) || undefined,
    vmakeSubtitleCreatePath: vmakeSubtitleCreatePath(body),
    vmakeSubtitlePollPath: vmakeSubtitlePollPath(body),
    removeChineseSubtitles: parseRemoveChineseSubtitles(body),
    uploadedVideos,
    sourcesPreUploaded: body.sourcesPreUploaded === true,
    analysisMode: normalizeAutoEditAnalysisMode(body.analysisMode),
    scriptTopic: typeof body.scriptTopic === "string" ? body.scriptTopic.trim() || undefined : undefined,
    sourceKeywords: parseSourceKeywords(body.sourceKeywords),
    clientVideoMeta: parseClientVideoMeta(body.clientVideoMeta),
  }
}

async function startPipelineAsync(input: AutoEditInput, clientJobId?: string) {
  const { dir, id: jobId } = await createAutoEditWorkDir(clientJobId)
  const createdAt = Date.now()
  const initialJob = {
    jobId,
    step: "download" as const,
    videoCount: input.videos.length,
    createdAt,
  }
  putAutoEditJob(initialJob)
  if (process.env.VERCEL || process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      await persistAutoEditJobToSupabase({ job: initialJob, createdAt })
    } catch (e) {
      console.error("[auto-edit] initial Supabase persist failed:", e)
    }
  }
  const pipeline = runAutoEditPipeline({ ...input, presetWork: { dir, id: jobId } })
  if (process.env.VERCEL) {
    waitUntil(pipeline)
  } else {
    void pipeline
  }
  return { jobId, step: "download" as const, videoCount: input.videos.length }
}

async function handleMultipart(req: NextRequest) {
  const form = await req.formData()
  const payloadRaw = form.get("payload")
  if (typeof payloadRaw !== "string") {
    return NextResponse.json({ error: "payload JSON이 필요합니다." }, { status: 400 })
  }
  let body: Record<string, unknown>
  try {
    body = JSON.parse(payloadRaw) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "payload JSON 파싱 실패" }, { status: 400 })
  }

  const { videos, targetDuration } = parsePayload(body)
  if (!videos.length) {
    return NextResponse.json({ error: `videos(1~${MAX_AUTO_EDIT_VIDEOS}개)가 필요합니다.` }, { status: 400 })
  }

  const openaiApiKey = openaiKey(body)
  if (!openaiApiKey) {
    return NextResponse.json(
      { error: "OpenAI API 키가 필요합니다 (shotform_openai_api_key 또는 OPENAI_API_KEY)." },
      { status: 400 }
    )
  }

  const removeChineseSubtitles = parseRemoveChineseSubtitles(body)
  const vmakeApiKey = vmakeKey(body)
  const vmakeSecretAccessKey = vmakeSecretKey(body)
  if (removeChineseSubtitles && (!vmakeApiKey || !vmakeSecretAccessKey)) {
    return NextResponse.json(
      {
        error:
          "중국어 자막 제거에 Vmake AI API Key와 Secret Access Key(shotform_vmake_api_key, shotform_vmake_secret_access_key)가 필요합니다.",
      },
      { status: 400 }
    )
  }

  const uploadedVideos: Record<string, Buffer> = {}
  for (const v of videos) {
    const file = form.get(`video_${v.video_id}`)
    if (file instanceof File && file.size > 0) {
      uploadedVideos[v.video_id] = Buffer.from(await file.arrayBuffer())
    }
  }
  if (Object.keys(uploadedVideos).length !== videos.length) {
    return NextResponse.json(
      { error: "선택한 모든 영상 MP4 파일이 업로드되지 않았습니다." },
      { status: 400 }
    )
  }

  const clientJobId =
    typeof body.clientJobId === "string" && body.clientJobId.trim()
      ? body.clientJobId.trim()
      : undefined
  const started = await startPipelineAsync(
    buildPipelineInput(body, videos, targetDuration, uploadedVideos),
    clientJobId
  )
  return NextResponse.json(started)
}

/** GET — jobId로 비동기 짜집기 진행 상태 조회 */
export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId")?.trim()
  if (!jobId) {
    return NextResponse.json({ error: "jobId가 필요합니다." }, { status: 400 })
  }
  const job = await getAutoEditJobAsync(jobId)
  if (!job) {
    return NextResponse.json(
      {
        error:
          "작업을 찾을 수 없습니다. 만료되었거나 아직 시작 중일 수 있습니다. Supabase 테이블(shotform_auto_edit_jobs) 생성 여부도 확인해 주세요.",
      },
      { status: 404 }
    )
  }
  const { outputPath: _outputPath, createdAt: _createdAt, ...clientJob } = job
  return NextResponse.json(clientJob)
}

/** POST — 영상 1~N개 → (브라우저 MP4 업로드 또는 URL) → 분석 → 짜집기 → ffmpeg */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || ""
    if (contentType.includes("multipart/form-data")) {
      return handleMultipart(req)
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const { videos, targetDuration } = parsePayload(body)

    if (!videos.length) {
      return NextResponse.json(
        { error: `videos(1~${MAX_AUTO_EDIT_VIDEOS}개) 또는 videoUrl이 필요합니다.` },
        { status: 400 }
      )
    }

    const openaiApiKey = openaiKey(body)
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: "OpenAI API 키가 필요합니다 (shotform_openai_api_key 또는 OPENAI_API_KEY)." },
        { status: 400 }
      )
    }

    const removeChineseSubtitles = parseRemoveChineseSubtitles(body)
    const vmakeApiKey = vmakeKey(body)
    const vmakeSecretAccessKey = vmakeSecretKey(body)
    if (removeChineseSubtitles && (!vmakeApiKey || !vmakeSecretAccessKey)) {
      return NextResponse.json(
        {
          error:
            "중국어 자막 제거에 Vmake AI API Key와 Secret Access Key(shotform_vmake_api_key, shotform_vmake_secret_access_key)가 필요합니다.",
        },
        { status: 400 }
      )
    }

    const clientJobId =
      typeof body.clientJobId === "string" && body.clientJobId.trim()
        ? body.clientJobId.trim()
        : undefined
    const started = await startPipelineAsync(
      buildPipelineInput(body, videos, targetDuration),
      clientJobId
    )
    return NextResponse.json(started)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "오류" }, { status: 500 })
  }
}
