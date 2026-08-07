/**
 * TTS 오디오를 브라우저에서 바로 Supabase Storage에 올립니다.
 * Server Action으로 Blob을 넘기면 파일이 깨지거나 비어 실패하는 경우가 있어
 * 클라이언트 업로드를 기본으로 씁니다.
 */

import { createClient } from "@/lib/supabase/client"

function pickAudioExt(mime: string): string {
  const m = mime.toLowerCase()
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3"
  if (m.includes("ogg")) return "ogg"
  if (m.includes("webm")) return "webm"
  if (m.includes("mp4") || m.includes("m4a")) return "m4a"
  return "wav"
}

/**
 * video-sources 우선, 실패 시 shotform-assets 폴백.
 * @returns 공개 URL
 */
export async function uploadTtsBlobToStorage(
  blob: Blob,
  userId: string,
  projectId: string
): Promise<string> {
  if (!userId?.trim()) throw new Error("로그인이 필요합니다.")
  if (!projectId?.trim()) throw new Error("프로젝트 ID가 없습니다.")
  if (!blob?.size) throw new Error("업로드할 오디오가 비어 있습니다.")

  const supabase = createClient()
  const mime = (blob.type || "audio/wav").split(";")[0]?.trim() || "audio/wav"
  const ext = pickAudioExt(mime)
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const primaryPath = `tts-audio/${userId}/${projectId}/${stamp}_tts.${ext}`

  const primary = await supabase.storage.from("video-sources").upload(primaryPath, blob, {
    contentType: mime,
    upsert: false,
    cacheControl: "3600",
  })

  if (!primary.error) {
    const { data } = supabase.storage.from("video-sources").getPublicUrl(primaryPath)
    return data.publicUrl
  }

  console.warn(
    "[TTS Upload] video-sources 실패, shotform-assets로 재시도:",
    primary.error.message
  )

  const fallbackPath = `ai-shopping/${userId}/${projectId}/${stamp}_tts.${ext}`
  const fallback = await supabase.storage.from("shotform-assets").upload(fallbackPath, blob, {
    contentType: mime,
    upsert: true,
    cacheControl: "3600",
  })

  if (fallback.error) {
    throw new Error(
      `Storage 업로드 실패: ${primary.error.message} / fallback: ${fallback.error.message}`
    )
  }

  const { data } = supabase.storage.from("shotform-assets").getPublicUrl(fallbackPath)
  return data.publicUrl
}
