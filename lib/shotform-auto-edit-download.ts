/** 짜집기 결과 MP4 다운로드 URL */
export function autoEditDownloadUrl(jobId: string, opts?: { inline?: boolean }): string {
  const base = `/api/shotform/auto-edit/download?jobId=${encodeURIComponent(jobId)}`
  return opts?.inline ? `${base}&inline=1` : base
}
