/** WingsStudio / WingsAIStudio 호환 API 키 저장·조회 */

export type LongformV2ApiKeys = {
  gemini: string
  replicate: string
  perplexity: string
  elevenlabs: string
  supertone: string
}

const KEY_MAP: Record<keyof LongformV2ApiKeys, string[]> = {
  gemini: ["wingsstudio.geminiApiKey", "geminiApiKey", "gemini_api_key", "GEMINI_API_KEY"],
  replicate: ["wingsstudio.replicateApiKey", "replicateApiKey", "replicate_api_key", "REPLICATE_API_KEY"],
  perplexity: ["wingsstudio.perplexityApiKey", "perplexityApiKey", "perplexity_api_key", "PERPLEXITY_API_KEY"],
  elevenlabs: ["wingsstudio.elevenlabsApiKey", "elevenlabs_api_key", "elevenlabsApiKey"],
  supertone: ["wingsstudio.supertoneApiKey", "supertoneApiKey", "supertone_api_key"],
}

const WRITE_PRIMARY: Record<keyof LongformV2ApiKeys, string> = {
  gemini: "wingsstudio.geminiApiKey",
  replicate: "wingsstudio.replicateApiKey",
  perplexity: "wingsstudio.perplexityApiKey",
  elevenlabs: "wingsstudio.elevenlabsApiKey",
  supertone: "wingsstudio.supertoneApiKey",
}

const WRITE_ALIASES: Partial<Record<keyof LongformV2ApiKeys, string[]>> = {
  gemini: ["geminiApiKey", "gemini_api_key"],
  replicate: ["replicateApiKey", "replicate_api_key"],
  perplexity: ["perplexityApiKey"],
  elevenlabs: ["elevenlabs_api_key"],
  supertone: ["supertoneApiKey", "supertone_api_key"],
}

export function emptyApiKeys(): LongformV2ApiKeys {
  return { gemini: "", replicate: "", perplexity: "", elevenlabs: "", supertone: "" }
}

export function loadApiKeys(): LongformV2ApiKeys {
  if (typeof window === "undefined") return emptyApiKeys()
  const out = emptyApiKeys()
  for (const key of Object.keys(KEY_MAP) as (keyof LongformV2ApiKeys)[]) {
    for (const storageKey of KEY_MAP[key]) {
      try {
        const v = localStorage.getItem(storageKey)?.trim()
        if (v) {
          out[key] = v
          break
        }
      } catch {
        /* ignore */
      }
    }
  }
  return out
}

export function saveApiKeys(keys: LongformV2ApiKeys) {
  for (const key of Object.keys(WRITE_PRIMARY) as (keyof LongformV2ApiKeys)[]) {
    const v = (keys[key] || "").trim()
    const primary = WRITE_PRIMARY[key]
    try {
      if (v) localStorage.setItem(primary, v)
      else localStorage.removeItem(primary)
      for (const alias of WRITE_ALIASES[key] || []) {
        if (v) localStorage.setItem(alias, v)
        else localStorage.removeItem(alias)
      }
    } catch {
      /* ignore */
    }
  }
}
