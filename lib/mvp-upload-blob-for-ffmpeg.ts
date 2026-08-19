/**
 * 리믹스 컷 편집(삭제/이동/삽입) — Vercel 요청 본문 한도(~4.5MB)를 피하려고
 * 큰 MP4는 GCS(또는 Supabase)에 올린 뒤 URL만 API로 보냅니다.
 */

import { createClient } from "@/lib/supabase/client"

/** Vercel Hobby/Pro 프록시 한도보다 작게 — 이보다 크면 반드시 URL 전송 */
export const MVP_INLINE_MP4_MAX_BYTES = 3 * 1024 * 1024

async function uploadViaGcsShopping(blob: Blob, fileName: string): Promise<string> {
  const contentType = blob.type || "video/mp4"
  const res = await fetch("/api/upload-to-gcs/signed-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName,
      contentType,
      scope: "shopping",
    }),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || `Signed URL 실패 (${res.status})`)
  }
  const { signedUrl, fileName: storedFileName } = (await res.json()) as {
    signedUrl?: string
    fileName?: string
  }
  if (!signedUrl || !storedFileName) throw new Error("Signed URL 응답이 비어 있습니다.")

  const putRes = await fetch(signedUrl, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": contentType },
  })
  if (!putRes.ok) throw new Error(`GCS 업로드 실패 (${putRes.status})`)

  const readRes = await fetch("/api/upload-to-gcs/signed-read-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: storedFileName, scope: "shopping" }),
  })
  if (!readRes.ok) {
    const err = (await readRes.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || `읽기 URL 생성 실패 (${readRes.status})`)
  }
  const { readUrl } = (await readRes.json()) as { readUrl?: string }
  if (!readUrl?.startsWith("https://")) throw new Error("읽기 URL이 없습니다.")
  return readUrl
}

async function uploadViaSupabase(blob: Blob, projectId: string, kind: string): Promise<string> {
  const supabase = createClient()
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth.user?.id || "anon"
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const mime = (blob.type || "video/mp4").split(";")[0]?.trim() || "video/mp4"
  const path = `remix-ffmpeg/${uid}/${projectId}/${stamp}_${kind}.mp4`

  const primary = await supabase.storage.from("video-sources").upload(path, blob, {
    contentType: mime,
    upsert: false,
    cacheControl: "3600",
  })
  if (!primary.error) {
    const { data } = supabase.storage.from("video-sources").getPublicUrl(path)
    if (data.publicUrl?.startsWith("https://")) return data.publicUrl
  }

  const fallbackPath = `ai-shopping/${uid}/${projectId}/${stamp}_${kind}.mp4`
  const fallback = await supabase.storage.from("shotform-assets").upload(fallbackPath, blob, {
    contentType: mime,
    upsert: true,
    cacheControl: "3600",
  })
  if (fallback.error) {
    throw new Error(
      `Storage 업로드 실패: ${primary.error?.message || "video-sources"} / ${fallback.error.message}`
    )
  }
  const { data } = supabase.storage.from("shotform-assets").getPublicUrl(fallbackPath)
  if (!data.publicUrl?.startsWith("https://")) throw new Error("공개 URL을 만들지 못했습니다.")
  return data.publicUrl
}

export async function uploadBlobForServerFfmpeg(
  blob: Blob,
  projectId: string,
  kind: "video" | "clip"
): Promise<string> {
  const fileName = `remix_${kind}_${Date.now()}.mp4`
  try {
    return await uploadViaGcsShopping(blob, fileName)
  } catch (gcsErr) {
    console.warn("[remix-ffmpeg] GCS 업로드 실패, Supabase로 재시도:", gcsErr)
    return uploadViaSupabase(blob, projectId || "unknown", kind)
  }
}

export async function appendRemixMediaToForm(
  form: FormData,
  args: {
    blob: Blob
    projectId: string
    blobField: "video" | "clip"
    urlField: "videoUrl" | "clipUrl"
    fileName: string
  }
): Promise<void> {
  if (args.blob.size <= MVP_INLINE_MP4_MAX_BYTES) {
    form.append(args.blobField, args.blob, args.fileName)
    return
  }
  try {
    const url = await uploadBlobForServerFfmpeg(args.blob, args.projectId, args.blobField)
    form.append(args.urlField, url)
  } catch (e) {
    console.warn("[remix-ffmpeg] 원격 업로드 실패, 본문에 직접 첨부(로컬 전용):", e)
    form.append(args.blobField, args.blob, args.fileName)
  }
}

export async function throwIfRemixFfmpegFailed(res: Response, label: string): Promise<void> {
  if (res.ok) return
  const text = await res.text().catch(() => "")
  let message = ""
  try {
    const data = JSON.parse(text) as { error?: string }
    message = data.error || ""
  } catch {
    /* html / 빈 본문 */
  }
  if (res.status === 413 || /entity too large/i.test(text)) {
    throw new Error(
      `${label} 실패: 영상이 서버 업로드 한도를 넘었습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.`
    )
  }
  throw new Error(message || `${label} 실패 (${res.status})`)
}
