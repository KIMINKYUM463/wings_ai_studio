"use server"

import { createMvpProjectsClient } from "@/lib/supabase/mvp-projects"
import { requireStoryUserId } from "@/lib/story-shopping-security"

const TTS_STORAGE_BUCKET = "video-sources"

export type StorageMediaKind = "tts" | "clip" | "image" | "sfx"

const MEDIA_RULES: Record<StorageMediaKind, { folder: string; exts: Set<string>; fallbackExt: string }> = {
  tts: { folder: "tts-audio", exts: new Set(["wav", "mp3", "ogg", "webm", "m4a"]), fallbackExt: "wav" },
  clip: { folder: "scene-clips", exts: new Set(["webm", "mp4"]), fallbackExt: "webm" },
  image: { folder: "scene-images", exts: new Set(["jpg", "jpeg", "png", "webp", "gif"]), fallbackExt: "jpg" },
  sfx: { folder: "story-sfx", exts: new Set(["wav", "mp3", "ogg", "webm", "m4a"]), fallbackExt: "wav" },
}

function safePathSegment(value: string): string {
  return value.trim().replace(/[^\w@.-]+/g, "_").slice(0, 120) || "unknown"
}

/**
 * 브라우저(익명 Supabase 세션)는 Storage RLS에 막히므로,
 * 서버(service role)가 1회용 업로드 URL을 발급하고 파일은 브라우저가 직접 올린다.
 */
export async function createMediaSignedUpload(
  userId: string,
  projectId: string,
  ext: string,
  kind: StorageMediaKind
): Promise<{ path: string; token: string; publicUrl: string }> {
  const verifiedUserId = await requireStoryUserId(userId)
  if (!projectId?.trim()) throw new Error("프로젝트 ID가 없습니다.")
  const rule = MEDIA_RULES[kind] ?? MEDIA_RULES.tts
  const safeExt = rule.exts.has(ext) ? ext : rule.fallbackExt

  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const supabase = await createMvpProjectsClient()
  const { data: project, error: projectError } = await supabase
    .from("shopping_projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", verifiedUserId)
    .maybeSingle()
  if (projectError || !project) {
    throw new Error("프로젝트 소유권을 확인할 수 없습니다.")
  }
  const path = `${rule.folder}/${safePathSegment(verifiedUserId)}/${safePathSegment(projectId)}/${stamp}_${kind}.${safeExt}`

  const { data, error } = await supabase.storage.from(TTS_STORAGE_BUCKET).createSignedUploadUrl(path)
  if (error || !data?.token) {
    throw new Error(`업로드 URL 발급 실패: ${error?.message || "토큰 없음"}`)
  }
  const { data: pub } = supabase.storage.from(TTS_STORAGE_BUCKET).getPublicUrl(path)
  return { path: data.path, token: data.token, publicUrl: pub.publicUrl }
}

export async function createTtsSignedUpload(
  userId: string,
  projectId: string,
  ext: string
): Promise<{ path: string; token: string; publicUrl: string }> {
  return createMediaSignedUpload(userId, projectId, ext, "tts")
}
