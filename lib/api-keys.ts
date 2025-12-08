/**
 * API 키 관리 유틸리티
 * 로컬스토리지의 API 키를 우선 사용하고, 없으면 환경 변수를 사용합니다.
 */

/**
 * 클라이언트 사이드에서 API 키 가져오기
 * 로컬스토리지 우선, 없으면 환경 변수
 */
export function getApiKey(keyType: "openai" | "elevenlabs" | "replicate"): string | null {
  if (typeof window === "undefined") {
    // 서버 사이드에서는 환경 변수만 사용
    return getEnvApiKey(keyType)
  }

  // 클라이언트 사이드: 로컬스토리지 우선
  const storageKey = getStorageKey(keyType)
  const storedKey = localStorage.getItem(storageKey)
  
  if (storedKey && storedKey.trim() !== "") {
    return storedKey.trim()
  }

  // 로컬스토리지에 없으면 환경 변수 사용 (클라이언트에서는 접근 불가하므로 null)
  return null
}

/**
 * 서버 사이드에서 환경 변수로 API 키 가져오기
 */
export function getEnvApiKey(keyType: "openai" | "elevenlabs" | "replicate"): string | null {
  switch (keyType) {
    case "openai":
      return process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY || null
    case "elevenlabs":
      return process.env.ELEVENLABS_API_KEY || null
    case "replicate":
      return process.env.REPLICATE_API_KEY || null
    default:
      return null
  }
}

/**
 * 로컬스토리지 키 이름 가져오기
 */
function getStorageKey(keyType: "openai" | "elevenlabs" | "replicate"): string {
  switch (keyType) {
    case "openai":
      return "openai_api_key"
    case "elevenlabs":
      return "elevenlabs_api_key"
    case "replicate":
      return "replicate_api_key"
    default:
      return ""
  }
}

/**
 * 모든 API 키 가져오기 (클라이언트 사이드)
 */
export function getAllApiKeys(): {
  openai: string | null
  elevenlabs: string | null
  replicate: string | null
} {
  return {
    openai: getApiKey("openai"),
    elevenlabs: getApiKey("elevenlabs"),
    replicate: getApiKey("replicate"),
  }
}





