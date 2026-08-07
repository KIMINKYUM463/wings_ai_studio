/**
 * 배포 사이트(wingsaistudio.com)에서는 Next 서버가 아닌
 * 사용자 PC 로컬 에이전트(http://127.0.0.1:3847) → Supertonic(7788) 경로를 사용.
 */

import {
  DEFAULT_LOCAL_COMPANION_URL,
  resolveLocalCompanionUrl,
} from "@/lib/shotform-local-companion-client"

export function isBrowserOnDeployedHost(): boolean {
  if (typeof window === "undefined") return false
  const host = window.location.hostname
  return host !== "localhost" && host !== "127.0.0.1"
}

export function companionSupertonicBase(
  companionUrl = resolveLocalCompanionUrl()
): string {
  return companionUrl.replace(/\/$/, "") || DEFAULT_LOCAL_COMPANION_URL
}

/** TTS — 배포면 로컬 에이전트, 로컬 Next면 /api/supertonic-tts */
export async function fetchSupertonicTts(
  body: Record<string, unknown>,
  init?: RequestInit
): Promise<Response> {
  if (isBrowserOnDeployedHost()) {
    const base = companionSupertonicBase()
    return fetch(`${base}/supertonic/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      body: JSON.stringify(body),
      ...init,
    })
  }
  return fetch("/api/supertonic-tts", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    body: JSON.stringify(body),
    ...init,
  })
}

/** 보이스 목록 */
export async function fetchSupertonicVoices(init?: RequestInit): Promise<Response> {
  if (isBrowserOnDeployedHost()) {
    const base = companionSupertonicBase()
    return fetch(`${base}/supertonic/voices`, { cache: "no-store", ...init })
  }
  return fetch("/api/supertonic-voices", { cache: "no-store", ...init })
}

