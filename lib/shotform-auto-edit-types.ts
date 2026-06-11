/** 쇼핑 숏폼 자동 편집 — 공통 타입 */

export type AutoEditTargetDuration = 20 | 30 | 45 | 60

export const MAX_AUTO_EDIT_VIDEOS = 5

/** 짜집기 제품·장면 분석 속도/정확도 */
export type AutoEditAnalysisMode = "fast" | "balanced" | "precision"

export const AUTO_EDIT_ANALYSIS_MODE_DEFAULT: AutoEditAnalysisMode = "fast"

export const AUTO_EDIT_ANALYSIS_MODE_OPTIONS: Array<{
  id: AutoEditAnalysisMode
  label: string
  hint: string
}> = [
  {
    id: "fast",
    label: "고속",
    hint: "영상당 키프레임 최소 · Vision 타임아웃 · 약 15~60초",
  },
  {
    id: "balanced",
    label: "중간",
    hint: "키프레임·장면 분석 균형 · 약 1~3분",
  },
  {
    id: "precision",
    label: "정밀",
    hint: "영상별 심층 분석 + 컷별 Vision 캡션 · 약 3~8분",
  },
]

export function normalizeAutoEditAnalysisMode(raw: unknown): AutoEditAnalysisMode {
  if (raw === "balanced" || raw === "precision" || raw === "fast") return raw
  return AUTO_EDIT_ANALYSIS_MODE_DEFAULT
}

export type SceneVisualType =
  | "product_showcase"
  | "problem"
  | "demo"
  | "result"
  | "cta"
  | "other"

/** 장면에 사람이 나와 소개하는지 등 — 짜집기 필터용 */
export type SceneContentType =
  | "product_only"
  | "product_in_use"
  | "person_presenting"
  | "talking_head"
  | "mixed"
  | "text_overlay"
  | "other"

export type VideoProductFit = "approved" | "partial" | "rejected"

export type VideoScene = {
  start: number
  end: number
  description: string
  importance: number
  visual_type: SceneVisualType
  content_type?: SceneContentType
  has_person_presenting?: boolean
}

/** 벤치마크 스타일 — 분석용 시각 장면 (대본 없음) */
export type VisualScene = {
  start: number
  end: number
  description: string
  shot_type?: string
}

export type ProductVideoStructure = {
  hook: string
  body: string
  cta: string
}

export type ProductAnalysis = {
  productName: string
  category: string
  targetKeywords: string[]
  videoStructure: ProductVideoStructure
  summary: string
  scenes: VisualScene[]
  videoDuration: number
}

/** mix picks — srcIndex = videos[] 순서 */
export type MixPick = {
  srcIndex: number
  start: number
  end: number
  reason: string
}

export type MixInfo = {
  sourceCount: number
  targetDuration: AutoEditTargetDuration
  actualDuration: number
  picks: MixPick[]
}

export type VideoAnalysis = {
  video_id: string
  title: string
  platform: string
  duration: number
  source_url: string
  /** 편집용 안전 장면 */
  scenes: VideoScene[]
  /** 벤치마크 스타일 전체 시각 분석 장면 */
  visual_scenes?: VisualScene[]
  productName?: string
  category?: string
  targetKeywords?: string[]
  videoStructure?: ProductVideoStructure
  summary?: string
  src_index?: number
  product_fit?: VideoProductFit
  product_fit_reason?: string
  vision_frames?: Array<{ timeSec: number; content_type: SceneContentType; caption?: string }>
}

export type EditPlanSegment = {
  video_id: string
  source_start: number
  source_end: number
  output_start: number
  output_end: number
  reason: string
  /** 컷 중간 프레임 Vision 캡션 — 실제 화면 기준 */
  visual_caption?: string
}

export type EditPlan = {
  target_duration: AutoEditTargetDuration
  edit_plan: EditPlanSegment[]
}

export type ScriptLine = {
  start: number
  end: number
  text: string
  /** 편집에 매칭할 소스 영상 ID */
  video_id?: string
  /** 해당 영상 scenes[] 인덱스 */
  scene_index?: number
}

export type SceneSubtitleBlock = {
  start: number
  end: number
  /** 줄바꿈(\\n)으로 여러 자막 줄 */
  text: string
}

/** 벤치마크 프로그램 스크립트 출력 형식 */
export type ShotFormScriptBundle = {
  scripts: {
    conversion: string
    storytelling: string
  }
  headcopies: string[][]
  commentKeyword: string
  sceneSubtitles: {
    conversion: SceneSubtitleBlock[]
    storytelling: SceneSubtitleBlock[]
  }
}

export type ShoppingScript = {
  script: ScriptLine[]
  tone?: string
  /** 벤치마크 형식 — scripts / headcopies / sceneSubtitles */
  bundle?: ShotFormScriptBundle
}

export type AutoEditPipelineStep =
  | "download"
  | "subtitle_removal"
  | "analyze"
  | "mix"
  | "edit_plan"
  | "script"
  | "render"
  | "done"
  | "error"

export type AutoEditVideoInput = {
  video_id: string
  videoUrl: string
  title?: string
  noteUrl?: string
  platform?: string
}

export type AutoEditJobResult = {
  jobId: string
  step: AutoEditPipelineStep
  /** @deprecated 단일 영상 — analyses 사용 */
  analysis?: VideoAnalysis
  analyses?: VideoAnalysis[]
  /** 벤치마크 스타일 통합 제품 분석 */
  productAnalysis?: ProductAnalysis
  /** mix picks (벤치마크 mixInfo) */
  mixInfo?: MixInfo
  editPlan?: EditPlan
  script?: ShoppingScript
  downloadUrl?: string
  outputDuration?: number
  renderSkipped?: boolean
  renderSkipReason?: string
  /** Vmake 자막 제거를 건너뛴 경우 */
  subtitleRemovalSkipped?: boolean
  subtitleRemovalWarning?: string
  error?: string
  videoCount?: number
  excludedVideos?: Array<{ video_id: string; title: string; reason: string }>
}

export type AutoEditInput = {
  videos: AutoEditVideoInput[]
  targetDuration: AutoEditTargetDuration
  openaiApiKey: string
  /** Vmake AI — 중국어 하드 자막 제거 */
  vmakeApiKey?: string
  vmakeSecretAccessKey?: string
  vmakeSubtitleCreatePath?: string
  vmakeSubtitlePollPath?: string
  removeChineseSubtitles?: boolean
  /** 브라우저에서 프록시로 받은 MP4 (video_id → bytes) */
  uploadedVideos?: Record<string, Buffer>
  /** 비동기 job — 미리 생성한 작업 디렉터리 */
  presetWork?: { dir: string; id: string }
  /** 프로젝트명·주제 — 끝에 " 1"이면 자연스러운 스토리형 대본 */
  scriptTopic?: string
  /** 제품·장면 분석 모드 (기본: fast) */
  analysisMode?: AutoEditAnalysisMode
}

/** UI 선택용 */
export type AutoEditPick = {
  key: string
  video_id: string
  videoUrl: string
  title: string
  noteUrl: string
  platform: string
}

export function videoPickKey(noteUrl: string, videoUrl: string): string {
  return (noteUrl || videoUrl).trim().toLowerCase()
}

export function toAutoEditVideoInputs(picks: AutoEditPick[]): AutoEditVideoInput[] {
  return picks.map((p) => ({
    video_id: p.video_id,
    videoUrl: p.videoUrl,
    title: p.title,
    noteUrl: p.noteUrl,
    platform: p.platform,
  }))
}
