import { assertPreviewMp4Blob } from "@/lib/mvp-mp4-preview"
import { resolveMvpStudioVideoBlob } from "@/lib/mvp-studio-video-blob"

export const VMAKE_SUBTITLE_REMOVAL_SLOW_HINT =
  "30초 영상도 보통 2~8분, 서버가 바쁘면 12분까지 걸릴 수 있습니다. 처리 중에는 창을 닫지 마세요."

/**
 * 짜집기 파이프라인·단독 API 공통 타임아웃.
 * Vmake 폴링(기본 ~12분)보다 짧으면 폴링 중간에 끊기므로, maxDuration(800초) 안에서 여유 있게 맞춤.
 */
export const VMAKE_SUBTITLE_REMOVAL_TIMEOUT_MS = Number(
  process.env.VMAKE_SUBTITLE_TIMEOUT_MS || 750_000
)

export const VMAKE_SUBTITLE_REMOVAL_STALL_HINT =
  "12분 이상 멈추면 자막 제거 없이 짜집기 영상으로 자동 진행합니다. 이후 미리보기 옆 「중국어 자막 제거」에서 다시 시도할 수 있습니다."

export const VMAKE_SUBTITLE_REMOVAL_TIMEOUT_HINT =
  "Vmake 자막 제거 시간 초과(약 12분). 서버가 바쁠 때 더 걸릴 수 있으니 1~2분 뒤 다시 시도해 주세요."

export function shotformVmakeApiKey(): string {
  if (typeof window === "undefined") return ""
  return (localStorage.getItem("shotform_vmake_api_key") || "").trim()
}

export function shotformVmakeSecretAccessKey(): string {
  if (typeof window === "undefined") return ""
  return (localStorage.getItem("shotform_vmake_secret_access_key") || "").trim()
}

export async function fetchStudioVideoBlob(
  videoUrl: string | null,
  opts?: {
    jobId?: string
    projectId?: string
    downloadUrl?: string | null
    skipLocalCache?: boolean
  }
): Promise<Blob | null> {
  return resolveMvpStudioVideoBlob({
    videoUrl,
    downloadUrl: opts?.downloadUrl,
    jobId: opts?.jobId,
    projectId: opts?.projectId,
    skipLocalCache: opts?.skipLocalCache,
  })
}

function subtitleRemovalHttpError(status: number, message?: string): Error {
  if (status === 413) {
    return new Error(
      "영상 업로드 용량이 서버 제한(약 4.5MB)을 초과했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요. " +
        "같은 오류가 반복되면 짜집기를 다시 실행해 jobId가 연결된 상태에서 시도해 주세요."
    )
  }
  return new Error(friendlySubtitleRemovalError(message) || `중국어 자막 제거 실패 (${status})`)
}

/** 클라이언트에서도 Vmake 단문 오류를 읽기 쉬운 안내로 바꿉니다. */
export function friendlySubtitleRemovalError(message?: string | null): string {
  const msg = (message || "").trim()
  if (!msg || /^internal error\.?$/i.test(msg)) {
    return (
      "Vmake 자막 제거 서버에서 일시적 오류(Internal error)가 났습니다. " +
      "영상에 자막이 이미 지워졌다면 미리보기를 확인한 뒤 무시해도 됩니다. " +
      "아직 남아 있으면 조금 뒤 다시 시도해 주세요."
    )
  }
  return msg
}

/** Vmake 완료 후 Storage에 저장된 MP4 — 배포 응답 본문 제한 우회 */
async function fetchCleanedMp4FromJob(
  jobId: string,
  playableUrl?: string | null
): Promise<Blob> {
  let lastErr: Error | null = null
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1200 * attempt))
    try {
      if (playableUrl && attempt === 0) {
        const direct = await fetch(playableUrl, { cache: "no-store" })
        if (direct.ok) {
          const blob = await direct.blob()
          if (blob.size >= 50_000) {
            await assertPreviewMp4Blob(blob)
            return blob
          }
        }
      }

      const blob = await resolveMvpStudioVideoBlob({
        videoUrl: null,
        jobId,
        skipLocalCache: true,
      })
      if (!blob) {
        lastErr = new Error("처리된 영상을 불러오지 못했습니다.")
        continue
      }
      return blob
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
    }
  }
  throw (
    lastErr ??
    new Error("자막 제거 후 영상을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.")
  )
}

async function parseSubtitleRemovalResponse(res: Response): Promise<Blob> {
  const contentType = res.headers.get("content-type") || ""

  if (contentType.includes("application/json")) {
    const json = (await res.json()) as {
      success?: boolean
      jobId?: string
      playableUrl?: string
      error?: string
      delivery?: string
    }
    if (!json.success || !json.jobId) {
      throw new Error(friendlySubtitleRemovalError(json.error) || "자막 제거 응답이 올바르지 않습니다.")
    }
    return fetchCleanedMp4FromJob(json.jobId, json.playableUrl)
  }

  const blob = await res.blob()
  if (blob.size < 50_000) {
    const text = await blob.text().catch(() => "")
    if (text.trimStart().startsWith("{")) {
      const json = JSON.parse(text) as { error?: string }
      throw new Error(friendlySubtitleRemovalError(json.error) || "자막 제거 응답이 올바르지 않습니다.")
    }
  }
  await assertPreviewMp4Blob(blob)
  return blob
}

export async function requestChineseSubtitleRemoval(input: {
  videoBlob?: Blob | null
  jobId?: string
  vmakeApiKey: string
  vmakeSecretAccessKey: string
}): Promise<Blob> {
  const jobId = input.jobId?.trim()
  const payload = {
    jobId,
    vmakeApiKey: input.vmakeApiKey,
    vmakeSecretAccessKey: input.vmakeSecretAccessKey,
  }

  /** 배포(Vercel) 본문 4.5MB 제한 — jobId 있으면 서버가 Storage/API에서 MP4 직접 로드 */
  if (jobId) {
    const res = await fetch("/api/shotform/remove-chinese-subtitles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string }
      throw subtitleRemovalHttpError(res.status, err.error)
    }
    return parseSubtitleRemovalResponse(res)
  }

  const videoBlob = input.videoBlob
  if (!videoBlob || videoBlob.size < 20_000) {
    throw new Error("처리할 짜집기 영상이 없습니다. 미리보기가 재생되는지 확인한 뒤 다시 시도해 주세요.")
  }

  const form = new FormData()
  form.append("video", videoBlob, "studio.mp4")
  form.append("vmakeApiKey", input.vmakeApiKey)
  form.append("vmakeSecretAccessKey", input.vmakeSecretAccessKey)

  const res = await fetch("/api/shotform/remove-chinese-subtitles", {
    method: "POST",
    body: form,
  })

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw subtitleRemovalHttpError(res.status, err.error)
  }

  return parseSubtitleRemovalResponse(res)
}
