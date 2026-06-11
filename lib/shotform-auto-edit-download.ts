/** 짜집기 결과 MP4 다운로드 URL */
export function autoEditDownloadUrl(jobId: string): string {
  return `/api/shotform/auto-edit/download?jobId=${encodeURIComponent(jobId)}`
}
