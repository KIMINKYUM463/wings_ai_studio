/** CutFlow/Wings Express API_BASE — 웹 Next.js는 same-origin */
export const API_BASE = ""

export function getApiBase(): string {
  return API_BASE
}

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`
  if (typeof window !== "undefined" && window.location?.origin) {
    return new URL(p, window.location.origin).href
  }
  return p
}
