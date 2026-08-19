/**
 * 리믹스 ffmpeg API — FormData에서 MP4를 읽습니다.
 * 큰 파일은 브라우저가 blob 대신 URL만 넘깁니다(Vercel 413 회피).
 */

const MAX_DOWNLOAD_BYTES = 220 * 1024 * 1024

function hostnameAllowed(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return (
    h === "storage.googleapis.com" ||
    h.endsWith(".googleapis.com") ||
    h.endsWith(".supabase.co") ||
    h.endsWith(".supabase.in") ||
    h.endsWith(".supabase.net") ||
    h.endsWith(".vercel-storage.com")
  )
}

function assertSafeHttpsMediaUrl(raw: string): URL {
  const url = new URL(raw)
  if (url.protocol !== "https:") {
    throw new Error("영상 URL은 https만 사용할 수 있습니다.")
  }
  if (!hostnameAllowed(url.hostname)) {
    throw new Error("허용되지 않은 영상 저장소입니다.")
  }
  return url
}

async function downloadMp4FromUrl(raw: string): Promise<Buffer> {
  const url = assertSafeHttpsMediaUrl(raw.trim())
  const res = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) {
    throw new Error(`영상 URL을 받지 못했습니다 (${res.status})`)
  }
  const len = Number(res.headers.get("content-length") || "0")
  if (Number.isFinite(len) && len > MAX_DOWNLOAD_BYTES) {
    throw new Error("영상이 너무 큽니다.")
  }
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 1000) throw new Error("내려받은 영상이 너무 작습니다.")
  if (buf.length > MAX_DOWNLOAD_BYTES) throw new Error("영상이 너무 큽니다.")
  return buf
}

export async function readFormMp4Buffer(
  form: FormData,
  blobField: string,
  urlField: string,
  emptyMessage = "원본 리믹스 영상이 없거나 너무 작습니다."
): Promise<Buffer> {
  const urlRaw = String(form.get(urlField) || "").trim()
  if (urlRaw.startsWith("https://")) {
    return downloadMp4FromUrl(urlRaw)
  }
  const video = form.get(blobField)
  if (video instanceof Blob && video.size >= 1000) {
    return Buffer.from(await video.arrayBuffer())
  }
  throw new Error(emptyMessage)
}
