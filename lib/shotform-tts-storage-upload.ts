/**
 * TTS 오디오·장면 클립을 Supabase Storage에 올리고 공개 URL을 돌려줍니다.
 * 브라우저 세션은 익명이라 Storage RLS에 막히므로 서버가 발급한 서명 업로드 URL을 사용합니다.
 * (Server Action에 파일 본문을 직접 넘기지 않아 Vercel 본문 한도도 피함)
 */

import { createClient } from "@/lib/supabase/client"
import { createMediaSignedUpload, type StorageMediaKind } from "@/lib/shotform-tts-storage-actions"

function pickMediaExt(mime: string, kind: StorageMediaKind): string {
  const m = mime.toLowerCase()
  if (kind === "clip") return m.includes("mp4") ? "mp4" : "webm"
  if (kind === "image") {
    if (m.includes("png")) return "png"
    if (m.includes("webp")) return "webp"
    if (m.includes("gif")) return "gif"
    return "jpg"
  }
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3"
  if (m.includes("ogg")) return "ogg"
  if (m.includes("webm")) return "webm"
  if (m.includes("mp4") || m.includes("m4a")) return "m4a"
  return "wav"
}

/** @returns 공개 URL */
export async function uploadMediaBlobToStorage(
  blob: Blob,
  userId: string,
  projectId: string,
  kind: StorageMediaKind
): Promise<string> {
  if (!userId?.trim()) throw new Error("로그인이 필요합니다.")
  if (!projectId?.trim()) throw new Error("프로젝트 ID가 없습니다.")
  if (!blob?.size) throw new Error("업로드할 파일이 비어 있습니다.")

  const defaultMime =
    kind === "clip"
      ? "video/webm"
      : kind === "image"
        ? "image/jpeg"
        : "audio/wav"
  const mime = (blob.type || defaultMime).split(";")[0]?.trim() || defaultMime
  const { path, token, publicUrl } = await createMediaSignedUpload(
    userId,
    projectId,
    pickMediaExt(mime, kind),
    kind
  )

  const { error } = await createClient()
    .storage.from("video-sources")
    .uploadToSignedUrl(path, token, blob, { contentType: mime, cacheControl: "3600" })
  if (error) throw new Error(`Storage 업로드 실패: ${error.message}`)
  return publicUrl
}

/** @returns 공개 URL */
export async function uploadTtsBlobToStorage(
  blob: Blob,
  userId: string,
  projectId: string
): Promise<string> {
  return uploadMediaBlobToStorage(blob, userId, projectId, "tts")
}
