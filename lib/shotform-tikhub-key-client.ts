/** 브라우저 localStorage의 TikHub 키 (없으면 서버 TIKHUB_API_KEY 사용) */
export const TIKHUB_KEY_STORAGE = "shotform_tikhub_api_key"

export function shotformTikhubKey(): string | undefined {
  if (typeof window === "undefined") return undefined
  return localStorage.getItem(TIKHUB_KEY_STORAGE)?.trim() || undefined
}
