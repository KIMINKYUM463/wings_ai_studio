import { getApiBase } from "./apiBase"

/** blob · data URL · `/data/...` · `projects/...` → 브라우저 `src` 용 절대 URL */
export function resolveDataAssetUrl(src: string | null | undefined): string | null {
  const s = src?.trim()
  if (!s) return null
  if (s.startsWith("blob:") || s.startsWith("data:") || /^https?:\/\//i.test(s)) return s
  const base = getApiBase()
  if (s.startsWith("/data/")) return `${base}${s}`
  if (s.startsWith("/")) return `${base}${s}`
  return `${base}/data/${s.replace(/^\/+/, "")}`
}
