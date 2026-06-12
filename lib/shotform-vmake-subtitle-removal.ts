import { assertPreviewMp4Blob } from "@/lib/mvp-mp4-preview"

export const VMAKE_SUBTITLE_REMOVAL_SLOW_HINT =
  "30초 영상도 보통 2~8분, 서버가 바쁘면 10분 이상 걸릴 수 있습니다. 렌더 후 AI 처리 단계이니 창을 닫지 마세요."

/** 짜집기 파이프라인·단독 API 공통 — 초과 시 자막 제거 없이 원본 영상 유지 */
export const VMAKE_SUBTITLE_REMOVAL_TIMEOUT_MS = Number(
  process.env.VMAKE_SUBTITLE_TIMEOUT_MS || 420_000
)

export const VMAKE_SUBTITLE_REMOVAL_STALL_HINT =
  "12분 이상 멈추면 자막 제거 없이 짜집기 영상으로 자동 진행합니다. 이후 정보 탭에서 다시 시도할 수 있습니다."

export function shotformVmakeApiKey(): string {
  if (typeof window === "undefined") return ""
  return (localStorage.getItem("shotform_vmake_api_key") || "").trim()
}

export function shotformVmakeSecretAccessKey(): string {
  if (typeof window === "undefined") return ""
  return (localStorage.getItem("shotform_vmake_secret_access_key") || "").trim()
}

export async function fetchStudioVideoBlob(videoUrl: string | null): Promise<Blob | null> {
  if (!videoUrl?.trim()) return null
  try {
    const res = await fetch(videoUrl, { cache: "no-store" })
    if (!res.ok) return null
    const blob = await res.blob()
    if (blob.size < 20_000) return null
    return blob
  } catch {
    return null
  }
}

export async function requestChineseSubtitleRemoval(input: {
  videoBlob: Blob
  jobId?: string
  vmakeApiKey: string
  vmakeSecretAccessKey: string
}): Promise<Blob> {
  const form = new FormData()
  form.append("video", input.videoBlob, "studio.mp4")
  form.append("vmakeApiKey", input.vmakeApiKey)
  form.append("vmakeSecretAccessKey", input.vmakeSecretAccessKey)
  if (input.jobId?.trim()) form.append("jobId", input.jobId.trim())

  const res = await fetch("/api/shotform/remove-chinese-subtitles", {
    method: "POST",
    body: form,
  })

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || `중국어 자막 제거 실패 (${res.status})`)
  }

  const blob = await res.blob()
  await assertPreviewMp4Blob(blob)
  return blob
}
