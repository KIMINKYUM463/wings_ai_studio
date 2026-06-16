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
      error:
        "로컬 에이전트에 연결하지 못했습니다. PC에서 npm run shotform:local-agent 를 실행했는지 확인해 주세요.",
    }
  }
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

    let blob = prefetchedBlobs?.[pick.video_id]
    if (!blob?.size) {
      onProgress?.(`영상 ${i + 1}/${total} 다운로드 중… (${label})`)
      const fetched = await fetchMvpPickVideoBlob(pick, (hint) => onProgress?.(hint))
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
