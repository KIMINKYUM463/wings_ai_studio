import { getStoredYoutubeDataApiKey } from "./youtubeDataLocalStorage"

export function resolveYoutubeDataApiKeyForUi(): string {
  const k = getStoredYoutubeDataApiKey()
  if (!k) return ""
  if (k.length <= 8) return "••••"
  return `${k.slice(0, 4)}…${k.slice(-4)}`
}
