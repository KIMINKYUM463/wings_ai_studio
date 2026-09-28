import type { ThumbnailCopyResearchResult } from '@/lib/longform-v2/youtube/thumbnailCopyResearch'
import type {
  ThumbnailCopyCombo,
  ThumbnailCopyComboSlotSpec,
} from '@/lib/longform-v2/youtube/thumbnailCopyCombos'
import type { ThumbnailSubCopy, ThumbnailSubCopySlotSpec } from '@/lib/longform-v2/youtube/thumbnailSubCopy'

export type ThumbnailCopyResearchSession = {
  topicDraft: string
  aiKeywords: string[]
  /** 유튜브 search.list 1회에 쓸 선택 키워드 */
  selectedSearchKeyword?: string
  result: ThumbnailCopyResearchResult | null
  manualPanelOpen?: boolean
  /** AI 조합 — 2줄 추천 (선택 후 슬롯 적용) */
  aiCombos?: ThumbnailCopyCombo[]
  slotSpec?: ThumbnailCopyComboSlotSpec
  /** AI 서브카피 — 괄호·라벨 (선택 후 슬롯 적용) */
  aiSubCopies?: ThumbnailSubCopy[]
  subCopySlotSpec?: ThumbnailSubCopySlotSpec
  /** 카피 참고 플로팅 패널 — 사용자 메모 */
  userNotes?: string
  /** 카피 참고 플로팅 패널 — 세로 높이(px) */
  panelHeight?: number
}

const STORAGE_PREFIX = 'wings-thumb-copy-research:'

function storageKey(projectId: string): string {
  return `${STORAGE_PREFIX}${projectId.trim() || '_default'}`
}

export function loadCopyResearchSession(projectId: string): ThumbnailCopyResearchSession {
  if (typeof window === 'undefined') {
    return { topicDraft: '', aiKeywords: [], selectedSearchKeyword: '', result: null, manualPanelOpen: false }
  }
  try {
    const raw = window.localStorage.getItem(storageKey(projectId))
    if (!raw) return { topicDraft: '', aiKeywords: [], selectedSearchKeyword: '', result: null, manualPanelOpen: false }
    const parsed = JSON.parse(raw) as Partial<ThumbnailCopyResearchSession>
    return {
      topicDraft: typeof parsed.topicDraft === 'string' ? parsed.topicDraft : '',
      aiKeywords: Array.isArray(parsed.aiKeywords)
        ? parsed.aiKeywords.map((k) => String(k ?? '').trim()).filter(Boolean).slice(0, 4)
        : [],
      selectedSearchKeyword:
        typeof parsed.selectedSearchKeyword === 'string' ? parsed.selectedSearchKeyword.trim() : '',
      result:
        parsed.result && typeof parsed.result === 'object' && Array.isArray(parsed.result.items)
          ? (parsed.result as ThumbnailCopyResearchResult)
          : null,
      manualPanelOpen: parsed.manualPanelOpen === true,
      aiCombos: Array.isArray(parsed.aiCombos)
        ? (parsed.aiCombos as ThumbnailCopyCombo[]).filter(
            (c) => c && typeof c.line1 === 'string' && typeof c.line2 === 'string',
          )
        : undefined,
      slotSpec:
        parsed.slotSpec && typeof parsed.slotSpec === 'object' && !Array.isArray(parsed.slotSpec)
          ? (parsed.slotSpec as ThumbnailCopyResearchSession['slotSpec'])
          : undefined,
      aiSubCopies: Array.isArray(parsed.aiSubCopies)
        ? (parsed.aiSubCopies as ThumbnailSubCopy[]).filter(
            (s) => s && typeof s.text === 'string' && s.text.trim(),
          )
        : undefined,
      subCopySlotSpec:
        parsed.subCopySlotSpec &&
        typeof parsed.subCopySlotSpec === 'object' &&
        !Array.isArray(parsed.subCopySlotSpec)
          ? (parsed.subCopySlotSpec as ThumbnailCopyResearchSession['subCopySlotSpec'])
          : undefined,
      userNotes: typeof parsed.userNotes === 'string' ? parsed.userNotes : undefined,
      panelHeight:
        typeof parsed.panelHeight === 'number' && Number.isFinite(parsed.panelHeight)
          ? parsed.panelHeight
          : undefined,
    }
  } catch {
    return { topicDraft: '', aiKeywords: [], selectedSearchKeyword: '', result: null, manualPanelOpen: false }
  }
}

export function saveCopyResearchSession(
  projectId: string,
  session: ThumbnailCopyResearchSession,
): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(projectId), JSON.stringify(session))
  } catch {
    /* quota 등 — 무시 */
  }
}
