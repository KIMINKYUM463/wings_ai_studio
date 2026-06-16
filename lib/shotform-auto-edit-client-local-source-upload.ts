/** 브라우저 → 로컬 dev 서버 작업 폴더 sources/ 업로드 */

import type { AutoEditPick } from "@/lib/shotform-auto-edit-types"

export async function uploadAutoEditSourcesToLocalDir(
  localWorkDir: string,
  picks: AutoEditPick[],
  onProgress?: (message: string) => void,
  prefetchedBlobs?: Record<string, Blob>
): Promise<void> {
  const { fetchMvpPickVideoBlob } = await import("@/lib/shotform-mvp-pick-video-download")
  const { probeCompanionSourceMeta } = await import("@/lib/shotform-local-companion-client")
  const form = new FormData()
  form.set("localWorkDir", localWorkDir)

  const total = picks.length
  for (let i = 0; i < picks.length; i++) {
    const pick = picks[i]!
    const label = pick.title || pick.video_id
    onProgress?.(`로컬 폴더 저장 ${i + 1}/${total}… (${label})`)

    let blob = prefetchedBlobs?.[pick.video_id]
    if (!blob?.size) {
      const meta = await probeCompanionSourceMeta({
        localWorkDir,
        videoId: pick.video_id,
      })
      if (meta.exists && meta.hasVideo) {
        onProgress?.(`로컬 폴더에 유효한 영상 있음 — ${label} 건너뜀`)
        continue
      }
      onProgress?.(`영상 ${i + 1}/${total} 다운로드 중… (${label})`)
      const fetched = await fetchMvpPickVideoBlob(pick, (hint) => onProgress?.(hint), {
        localWorkDir,
      })
      blob = fetched.blob
    }
    form.set(`video_${pick.video_id}`, blob, `${pick.video_id}.mp4`)
  }

  onProgress?.(`로컬 작업 폴더에 소스 ${total}개 저장 중…`)
  const res = await fetch("/api/shotform/auto-edit/local-sources", {
    method: "POST",
    body: form,
  })
  const json = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) {
    throw new Error(json.error || `로컬 소스 저장 실패 (${res.status})`)
  }
}
