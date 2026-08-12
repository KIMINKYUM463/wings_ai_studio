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

/**
 * Voice Builder JSON import.
 * 배포 사이트는 Next(Vercel)가 PC의 7788에 못 붙으므로 로컬 에이전트(3847)로 보낸다.
 */
export async function fetchSupertonicImport(
  form: FormData,
  init?: RequestInit
): Promise<Response> {
  if (isBrowserOnDeployedHost()) {
    const base = companionSupertonicBase()
    return fetch(`${base}/supertonic/import`, {
      method: "POST",
      body: form,
      ...init,
    })
  }
  return fetch("/api/supertonic-import", {
    method: "POST",
    body: form,
    ...init,
  })
}

/** 상태 확인 — 배포면 로컬 에이전트, 로컬 Next면 /api/supertonic-health */
export async function fetchSupertonicHealth(init?: RequestInit): Promise<{
  online: boolean
  baseUrl?: string
  model?: string
  message?: string
  error?: string
}> {
  try {
    if (isBrowserOnDeployedHost()) {
      const base = companionSupertonicBase()
      const res = await fetch(`${base}/supertonic/status`, {
        cache: "no-store",
        ...init,
      })
      if (res.status === 404) {
        return {
          online: false,
          message:
            "에이전트가 오래되어 Supertonic을 지원하지 않습니다. 에이전트 창을 닫고 「에이전트 실행」으로 최신 실행 파일을 한 번만 다시 받아 실행하세요.",
        }
      }
      const data = (await res.json().catch(() => ({}))) as {
        online?: boolean
        baseUrl?: string
        model?: string
        message?: string
        error?: string
      }
      return {
        online: Boolean(data.online),
        baseUrl: data.baseUrl,
        model: data.model,
        message: data.message,
        error: data.error,
      }
    }
    const res = await fetch("/api/supertonic-health", {
      cache: "no-store",
      ...init,
    })
    const data = (await res.json().catch(() => ({}))) as {
      online?: boolean
      baseUrl?: string
      model?: string
      error?: string
    }
    return {
      online: Boolean(data.online),
      baseUrl: data.baseUrl,
      model: data.model,
      error: data.error,
    }
  } catch (e) {
    return {
      online: false,
      error:
        e instanceof Error
          ? e.message
          : "Supertonic 상태 확인에 실패했습니다.",
    }
  }
}

