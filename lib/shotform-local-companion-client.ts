/** 배포 사이트 → PC 로컬 동반 에이전트 (http://127.0.0.1:3847) */

import type { AutoEditPick, EditPlan } from "@/lib/shotform-auto-edit-types"

export const DEFAULT_LOCAL_COMPANION_URL = "http://127.0.0.1:3847"
export const LOCAL_COMPANION_URL_STORAGE_KEY = "shotform_local_companion_url"

export type LocalCompanionHealth = {
  ok: boolean
  ffmpeg?: boolean
  defaultWorkDir?: string
  error?: string
}

export function resolveLocalCompanionUrl(): string {
  if (typeof window === "undefined") return DEFAULT_LOCAL_COMPANION_URL
  return (
    localStorage.getItem(LOCAL_COMPANION_URL_STORAGE_KEY)?.trim() || DEFAULT_LOCAL_COMPANION_URL
  ).replace(/\/$/, "")
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export async function probeLocalCompanion(
  baseUrl = resolveLocalCompanionUrl()
): Promise<LocalCompanionHealth> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/health`, {
      method: "GET",
      cache: "no-store",
    })
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      ffmpeg?: boolean
      defaultWorkDir?: string
      error?: string
    }
    if (!res.ok) {
      return { ok: false, error: json.error || `에이전트 응답 ${res.status}` }
    }
    return {
      ok: Boolean(json.ok),
      ffmpeg: json.ffmpeg,
      defaultWorkDir: json.defaultWorkDir,
    }
  } catch {
    return {
      ok: false,
      error: "로컬 에이전트에 연결하지 못했습니다.",
    }
  }
}

/** 에이전트 자동 기동 — localhost API · shotform-agent:// · 재시도 */
export async function ensureLocalCompanionRunning(opts?: {
  companionUrl?: string
  onProgress?: (message: string) => void
}): Promise<LocalCompanionHealth> {
  const baseUrl = opts?.companionUrl || resolveLocalCompanionUrl()
  const onProgress = opts?.onProgress

  let health = await probeLocalCompanion(baseUrl)
  if (health.ok && health.ffmpeg) return health

  const isLocalHost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")

  if (isLocalHost) {
    onProgress?.("로컬 에이전트 자동 시작 중…")
    try {
      await fetch("/api/shotform/local-agent/start", { method: "POST" })
      for (let i = 0; i < 6; i++) {
        await sleep(500)
        health = await probeLocalCompanion(baseUrl)
        if (health.ok && health.ffmpeg) return health
      }
    } catch {
      /* fall through */
    }
  }

  if (typeof window !== "undefined") {
    onProgress?.("로컬 에이전트 실행 요청 중…")
    try {
      const iframe = document.createElement("iframe")
      iframe.style.display = "none"
      iframe.src = "shotform-agent://start"
      document.body.appendChild(iframe)
      window.setTimeout(() => iframe.remove(), 2000)
    } catch {
      /* protocol not registered */
    }
    for (let i = 0; i < 8; i++) {
      await sleep(400)
      health = await probeLocalCompanion(baseUrl)
      if (health.ok && health.ffmpeg) return health
    }
  }

  return {
    ok: false,
    ffmpeg: false,
    error:
      health.error ||
      "로컬 에이전트를 시작하지 못했습니다. 프로젝트 폴더에서 npm run shotform:install-agent 를 한 번 실행해 주세요.",
  }
}

export async function probeCompanionSourceExists(args: {
  companionUrl?: string
  localWorkDir: string
  videoId: string
}): Promise<boolean> {
  const companionUrl = args.companionUrl || resolveLocalCompanionUrl()
  const base = companionUrl.replace(/\/$/, "")
  const q = new URLSearchParams({ workDir: args.localWorkDir.trim() })
  try {
    const res = await fetch(
      `${base}/sources/${encodeURIComponent(args.videoId)}?${q.toString()}`,
      { method: "HEAD", cache: "no-store" }
    )
    return res.ok
  } catch {
    return false
  }
}

export async function fetchCompanionSourceMp4(args: {
  companionUrl?: string
  localWorkDir: string
  videoId: string
}): Promise<Blob> {
  const companionUrl = args.companionUrl || resolveLocalCompanionUrl()
  const base = companionUrl.replace(/\/$/, "")
  const q = new URLSearchParams({ workDir: args.localWorkDir.trim() })
  const res = await fetch(
    `${base}/sources/${encodeURIComponent(args.videoId)}?${q.toString()}`,
    { cache: "no-store" }
  )
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(json.error || `로컬 소스 불러오기 실패 (${res.status})`)
  }
  const blob = await res.blob()
  if (blob.size < 50_000) {
    throw new Error("로컬 소스 MP4가 너무 작습니다.")
  }
  return blob
}

export async function uploadAutoEditSourcesToCompanion(
  companionUrl: string,
  localWorkDir: string,
  picks: AutoEditPick[],
  onProgress?: (message: string) => void,
  prefetchedBlobs?: Record<string, Blob>
): Promise<void> {
  const { fetchMvpPickVideoBlob } = await import("@/lib/shotform-mvp-pick-video-download")
  const base = companionUrl.replace(/\/$/, "")
  const total = picks.length

  for (let i = 0; i < picks.length; i++) {
    const pick = picks[i]!
    const label = pick.title || pick.video_id
    onProgress?.(`로컬 에이전트 저장 ${i + 1}/${total}… (${label})`)

    const alreadyLocal = await probeCompanionSourceExists({
      companionUrl,
      localWorkDir,
      videoId: pick.video_id,
    })
    if (alreadyLocal) {
      onProgress?.(`로컬 폴더에 이미 있음 — ${label} 건너뜀`)
      continue
    }

    let blob = prefetchedBlobs?.[pick.video_id]
    if (!blob?.size) {
      onProgress?.(`영상 ${i + 1}/${total} 다운로드 중… (${label})`)
      const fetched = await fetchMvpPickVideoBlob(pick, (hint) => onProgress?.(hint), {
        localWorkDir,
        companionUrl,
      })
      blob = fetched.blob
    }

    const res = await fetch(`${base}/sources/${encodeURIComponent(pick.video_id)}`, {
      method: "POST",
      headers: {
        "Content-Type": "video/mp4",
        "X-Work-Dir": localWorkDir,
      },
      body: blob,
    })
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      throw new Error(json.error || `로컬 에이전트 소스 저장 실패 (${res.status})`)
    }
  }
}

export async function renderEditPlanOnCompanion(args: {
  companionUrl: string
  localWorkDir: string
  jobId: string
  editPlan: EditPlan
}): Promise<{ outputPath: string }> {
  const base = args.companionUrl.replace(/\/$/, "")
  const res = await fetch(`${base}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workDir: args.localWorkDir,
      jobId: args.jobId,
      editPlan: args.editPlan,
    }),
  })
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    outputPath?: string
    error?: string
  }
  if (!res.ok || !json.ok || !json.outputPath) {
    throw new Error(json.error || `로컬 에이전트 렌더 실패 (${res.status})`)
  }
  return { outputPath: json.outputPath }
}

export async function fetchCompanionOutputMp4(args: {
  companionUrl: string
  localWorkDir: string
  jobId: string
}): Promise<Blob> {
  const base = args.companionUrl.replace(/\/$/, "")
  const q = new URLSearchParams({ workDir: args.localWorkDir })
  const res = await fetch(
    `${base}/jobs/${encodeURIComponent(args.jobId)}/output?${q.toString()}`,
    { cache: "no-store" }
  )
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(json.error || `로컬 MP4 불러오기 실패 (${res.status})`)
  }
  const blob = await res.blob()
  if (blob.size < 50_000) {
    throw new Error("로컬 MP4가 너무 작습니다.")
  }
  return blob
}

/** 로컬 output.mp4 조회 — 없으면 editPlan으로 렌더 후 반환 */
export async function resolveLocalCompanionMp4(args: {
  localWorkDir: string
  jobId: string
  editPlan?: EditPlan
  localRenderPending?: boolean
  companionUrl?: string
  onProgress?: (message: string) => void
}): Promise<{ blob: Blob; localOutputPath?: string }> {
  const companionUrl = args.companionUrl || resolveLocalCompanionUrl()
  const workDir = args.localWorkDir.trim()
  if (!workDir) throw new Error("로컬 작업 폴더 경로가 필요합니다.")

  const health = await ensureLocalCompanionRunning({
    companionUrl,
    onProgress: args.onProgress,
  })
  if (!health.ok || !health.ffmpeg) {
    throw new Error(health.error || "로컬 에이전트에 연결하지 못했습니다.")
  }

  let localOutputPath: string | undefined

  try {
    const blob = await fetchCompanionOutputMp4({
      companionUrl,
      localWorkDir: workDir,
      jobId: args.jobId,
    })
    return { blob }
  } catch {
    /* output 없음 — 아래에서 렌더 */
  }

  if (!args.editPlan?.edit_plan?.length) {
    throw new Error("짜집기 타임라인(editPlan)이 없어 로컬 MP4를 만들 수 없습니다.")
  }

  args.onProgress?.("로컬 에이전트에서 ffmpeg 렌더 중…")
  const rendered = await renderEditPlanOnCompanion({
    companionUrl,
    localWorkDir: workDir,
    jobId: args.jobId,
    editPlan: args.editPlan,
  })
  localOutputPath = rendered.outputPath

  const blob = await fetchCompanionOutputMp4({
    companionUrl,
    localWorkDir: workDir,
    jobId: args.jobId,
  })
  return { blob, localOutputPath }
}
