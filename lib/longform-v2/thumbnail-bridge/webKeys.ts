import { loadApiKeys } from "@/lib/longform-v2/api-keys"
import {
  getStoredYoutubeDataApiKey,
  hasStoredYoutubeDataApiKey,
} from "./youtubeDataLocalStorage"
import { resolveYoutubeDataApiKeyForUi as resolveMasked } from "./resolveYoutubeDataApiKeyForUi"

export function getStoredGeminiApiKey(): string {
  return loadApiKeys().gemini || ""
}

export function getStoredReplicateApiKey(): string {
  return loadApiKeys().replicate || ""
}

export function getStoredOpenAiApiKey(): string {
  return ""
}

export async function fetchDesktopSettings(): Promise<{
  geminiApiKey?: string
  openaiApiKey?: string
  replicateApiKey?: string
  youtubeDataApiKey?: string
}> {
  const k = loadApiKeys()
  return {
    geminiApiKey: k.gemini,
    replicateApiKey: k.replicate,
    youtubeDataApiKey: k.youtube,
  }
}

export { getStoredYoutubeDataApiKey, hasStoredYoutubeDataApiKey }

export function resolveYoutubeDataApiKeyForUi(): string {
  return resolveMasked()
}

export const youtubeDataLocalStorage = {
  hasStoredYoutubeDataApiKey,
  getStoredYoutubeDataApiKey,
}
