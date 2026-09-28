import { loadApiKeys, saveApiKeys } from "@/lib/longform-v2/api-keys"

/** @deprecated 직접 KEY 쓰지 말고 get/setStored 사용 */
export const YOUTUBE_DATA_API_STORAGE_KEY = "lfv2:youtube-data-api-key"

export function getStoredYoutubeDataApiKey(): string {
  return loadApiKeys().youtube?.trim() || ""
}

export function hasStoredYoutubeDataApiKey(): boolean {
  return Boolean(getStoredYoutubeDataApiKey())
}

export function setStoredYoutubeDataApiKey(key: string): void {
  const next = { ...loadApiKeys(), youtube: key.trim() }
  saveApiKeys(next)
}
