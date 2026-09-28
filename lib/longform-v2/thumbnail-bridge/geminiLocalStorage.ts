import { loadApiKeys } from "@/lib/longform-v2/api-keys"

export function getStoredGeminiApiKey(): string {
  return loadApiKeys().gemini || ""
}

export function hasStoredGeminiApiKey(): boolean {
  return Boolean(getStoredGeminiApiKey().trim())
}

export function getStoredReplicateApiKey(): string {
  return loadApiKeys().replicate || ""
}

export async function fetchDesktopSettings(): Promise<{
  geminiApiKey?: string
  openaiApiKey?: string
  replicateApiKey?: string
}> {
  const k = loadApiKeys()
  return {
    geminiApiKey: k.gemini,
    replicateApiKey: k.replicate,
  }
}
