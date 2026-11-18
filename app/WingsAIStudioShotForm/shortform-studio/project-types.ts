import type { MvpStudioPersistData } from "@/lib/mvp-studio-types"
import type { AutoEditJobResult, AutoEditPick } from "@/lib/shotform-auto-edit-types"
import type { KoZhKeywordPair } from "@/lib/shotform-cn-keyword-translate-client"
import type { MvpKeywordSourceResult } from "@/lib/shotform-mvp-keyword-source"

export interface MvpTestProject {
  id: string
  user_id: string
  name: string
  description?: string | null
  data: MvpTestProjectData
  created_at: string
  updated_at: string
}

export type MvpSourceMode = "keyword" | "direct_url" | "reprocess"

export interface MvpTestProjectData {
  sourceMode?: MvpSourceMode
  directUrlText?: string
  reprocessUrlText?: string
  keywordText?: string
  multiKeyword?: boolean
  keywordPairs?: KoZhKeywordPair[]
  sourceResult?: MvpKeywordSourceResult | null
  editPicks?: AutoEditPick[]
  /** 버전2 중간 단계(장면 나누기·문장별 컷 지정·대본·음성) 워크스페이스 프로젝트 ID */
  v2RemixProjectId?: string | null
  analyzedVideoUrl?: string | null
  postEditResult?: AutoEditJobResult | null
  /** 1-based 구간 번호 → 편집된 나레이션 */
  postEditScriptOverrides?: Record<string, string>
  /** 5~8단계 스튜디오 상태 (TTS·대본·타임라인·내보내기) */
  postEditStudioData?: MvpStudioPersistData
}
