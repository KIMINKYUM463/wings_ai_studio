/** 서버 라우트용 YouTube Data API 키 해석 */

export function resolveYoutubeDataApiKey(
  clientKey?: string | null,
  headerKey?: string | null,
): string {
  return (
    (clientKey || "").trim() ||
    (headerKey || "").trim() ||
    process.env.YOUTUBE_API_KEY?.trim() ||
    ""
  )
}

export function youtubeApiKeyFromRequest(req: Request, bodyKey?: string | null): string {
  const header = req.headers.get("x-youtube-api-key") || req.headers.get("X-YouTube-Api-Key")
  return resolveYoutubeDataApiKey(bodyKey, header)
}
