/** 짜집기 결과 MP4 다운로드 URL */
export function autoEditDownloadUrl(
  jobId: string,
  opts?: { inline?: boolean; mode?: "url" }
): string {
  const params = new URLSearchParams({ jobId })
  if (opts?.inline) params.set("inline", "1")
  if (opts?.mode === "url") params.set("mode", "url")
  return `/api/shotform/auto-edit/download?${params.toString()}`
}
