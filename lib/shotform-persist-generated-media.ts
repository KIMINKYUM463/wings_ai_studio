import { createMvpProjectsClient } from "@/lib/supabase/mvp-projects"

/** Replicate 출력 URL은 약 1시간 뒤 삭제됨 — 저장된 프로젝트가 깨지지 않게 영구 스토리지로 복사 */
const EXPIRING_MEDIA_HOSTS = ["replicate.delivery"]
const BUCKET = "video-sources"
const MAX_BYTES = 80 * 1024 * 1024

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "video/mp4": "mp4",
  "video/webm": "webm",
}

function isExpiringMediaUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname
    return EXPIRING_MEDIA_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
  } catch {
    return false
  }
}

/** 실패해도 원본 URL을 그대로 돌려줌 (생성 결과 자체는 잃지 않게) */
export async function persistGeneratedMediaUrl(url: string, folder: string): Promise<string> {
  if (!url || !isExpiringMediaUrl(url)) return url
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const contentType = (res.headers.get("content-type") || "").split(";")[0]!.trim()
    const bytes = Buffer.from(await res.arrayBuffer())
    if (!bytes.length || bytes.length > MAX_BYTES) throw new Error(`크기 ${bytes.length}`)
    const ext =
      EXT_BY_TYPE[contentType] ||
      new URL(url).pathname.match(/\.(png|webp|jpe?g|mp4|webm)$/i)?.[1]?.toLowerCase() ||
      "bin"
    const path = `generated-media/${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
    const supabase = await createMvpProjectsClient()
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: contentType || undefined, upsert: false })
    if (error) throw error
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  } catch (error) {
    console.warn("[persistGeneratedMedia] 영구 저장 실패, 임시 URL 유지:", error)
    return url
  }
}

/** 생성 결과 바이트(예: Veo 영상)를 영구 스토리지에 올리고 공개 URL을 돌려준다 */
export async function persistMediaBytes(bytes: Buffer, contentType: string, folder: string): Promise<string> {
  if (!bytes.length || bytes.length > MAX_BYTES) throw new Error(`생성 파일 크기가 올바르지 않습니다 (${bytes.length})`)
  const ext = EXT_BY_TYPE[contentType] || "bin"
  const path = `generated-media/${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
  const supabase = await createMvpProjectsClient()
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: false })
  if (error) throw error
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
