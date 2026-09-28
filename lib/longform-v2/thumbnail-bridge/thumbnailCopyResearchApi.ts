import { API_BASE } from "./apiBase"
import { getStoredGeminiApiKey } from "./geminiLocalStorage"
import { getStoredYoutubeDataApiKey } from "./youtubeDataLocalStorage"
import { formatYoutubeDataApiErrorMessage } from "@/lib/longform-v2/youtube/youtubeDataApiErrors"
import type {
  ThumbnailCopyCombo,
  ThumbnailCopyComboSlotSpec,
} from "@/lib/longform-v2/youtube/thumbnailCopyCombos"
import type {
  ThumbnailCopyFromResearchRequest,
  ThumbnailCopyResearchRequest,
  ThumbnailCopyResearchResult,
} from "@/lib/longform-v2/youtube/thumbnailCopyResearch"
import type { ThumbnailCopywriterRequest } from "@/lib/longform-v2/youtube/thumbnailCopywriter"
import type { ThumbnailSubCopy, ThumbnailSubCopySlotSpec } from "@/lib/longform-v2/youtube/thumbnailSubCopy"
import { resolveGeminiKeyForApi } from "./thumbnailAiApi"

function researchHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" }
  const yt = getStoredYoutubeDataApiKey()
  if (yt) h["X-YouTube-Api-Key"] = yt
  const gem = getStoredGeminiApiKey()
  if (gem) {
    h["X-Gemini-Api-Key"] = gem
    h.Authorization = `Bearer ${gem}`
  }
  return h
}

/** 주제에서 검색 키워드 후보 (API 실패 시 로컬 폴백) */
function localKeywordsFromTopic(topic: string): string[] {
  const t = topic.trim()
  if (!t) return []
  const parts = t
    .split(/[\s,./|·，、]+/u)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
  return [...new Set([t, ...parts])].slice(0, 4)
}

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: researchHeaders(),
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as T & {
    success?: boolean
    error?: string
  }
  if (!res.ok || data.success === false) {
    throw new Error(
      formatYoutubeDataApiErrorMessage(data.error || res.statusText || "요청 실패"),
    )
  }
  return data
}

/** 주제에서 AI 핵심 검색 키워드 추출 */
export async function postThumbnailCopyKeywordSuggest(body: {
  topic: string
}): Promise<{ keywords: string[] }> {
  return { keywords: localKeywordsFromTopic(body.topic) }
}

/** 주제 키워드로 유튜브 검색 → 제목·썸네일 문구 참고 수집 */
export async function postThumbnailCopyResearch(
  body: ThumbnailCopyResearchRequest,
): Promise<ThumbnailCopyResearchResult> {
  const yt = getStoredYoutubeDataApiKey()
  const data = await postJson<ThumbnailCopyResearchResult & { success?: boolean }>(
    "/api/longform-v2/thumbnail-copy-research",
    {
      ...body,
      youtubeApiKey: yt || undefined,
    },
  )
  return {
    topic: data.topic,
    keywords: data.keywords ?? body.keywords ?? [],
    items: data.items ?? [],
    ocrWarnings: data.ocrWarnings,
  }
}

/** 참고 수집 결과 + 대본·주제 → 템플릿 슬롯 최적 카피 AI 생성 */
export async function postThumbnailCopyFromResearch(
  body: ThumbnailCopyFromResearchRequest,
): Promise<{ replacements: Record<string, string> }> {
  const key = await resolveGeminiKeyForApi()
  if (!key) {
    throw new Error("Google(Gemini) API 키가 없습니다. 설정 → API 키에서 Gemini 키를 저장하세요.")
  }
  // 템플릿 슬롯 일괄 치환은 2줄 조합·서브카피 플로우로 대체됨
  void body
  throw new Error(
    "이 경로는 더 이상 사용하지 않습니다. 「AI 조합」으로 2줄 카피·서브카피를 생성해 주세요.",
  )
}

/** 참고 + 대본 → 2줄 카피 조합 여러 개 (선택 후 적용) */
export async function postThumbnailCopyCombos(body: {
  templateId: string
  topic: string
  scriptExcerpt: string
  videoTitle?: string
  outputLanguage?: string
  slotSpec: ThumbnailCopyComboSlotSpec
  researchItems?: ThumbnailCopyFromResearchRequest["researchItems"]
  count?: number
}): Promise<{ combos: ThumbnailCopyCombo[] }> {
  const gemini = await resolveGeminiKeyForApi()
  if (!gemini) {
    throw new Error("Google(Gemini) API 키가 없습니다. 설정 → API 키에서 Gemini 키를 저장하세요.")
  }
  const data = await postJson<{ combos: ThumbnailCopyCombo[] }>(
    "/api/longform-v2/thumbnail-copy-combos",
    { ...body, geminiApiKey: gemini },
  )
  return { combos: data.combos ?? [] }
}

/** 참고 + 대본 → 괄호형 서브카피 여러 개 */
export async function postThumbnailSubCopies(body: {
  templateId: string
  topic: string
  scriptExcerpt: string
  videoTitle?: string
  outputLanguage?: string
  slotSpec: ThumbnailSubCopySlotSpec
  researchItems?: ThumbnailCopyFromResearchRequest["researchItems"]
  count?: number
}): Promise<{ subCopies: ThumbnailSubCopy[] }> {
  const gemini = await resolveGeminiKeyForApi()
  if (!gemini) {
    throw new Error("Google(Gemini) API 키가 없습니다. 설정 → API 키에서 Gemini 키를 저장하세요.")
  }
  const data = await postJson<{ subCopies: ThumbnailSubCopy[] }>(
    "/api/longform-v2/thumbnail-sub-copies",
    { ...body, geminiApiKey: gemini },
  )
  return { subCopies: data.subCopies ?? [] }
}

export type { ThumbnailCopywriterRequest }
