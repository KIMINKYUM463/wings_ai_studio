/** 쇼핑 숏폼 자동 편집 — 공통 타입 */

/** 목표 쇼츠 길이 (5초 단위) */
export const AUTO_EDIT_DURATION_OPTIONS = [
  5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60,
] as const

export type AutoEditTargetDuration = (typeof AUTO_EDIT_DURATION_OPTIONS)[number]

export function normalizeAutoEditTargetDuration(
  raw: unknown,
  fallback: AutoEditTargetDuration = 30
): AutoEditTargetDuration {
  const n = Number(raw)
  if (AUTO_EDIT_DURATION_OPTIONS.includes(n as AutoEditTargetDuration)) {
    return n as AutoEditTargetDuration
  }
  const snapped = Math.round(n / 5) * 5
  if (snapped >= 5 && snapped <= 60) return snapped as AutoEditTargetDuration
  return fallback
}

export const MAX_AUTO_EDIT_VIDEOS = 5

/** 짜집기 제품·장면 분석 속도/정확도 */
export type AutoEditAnalysisMode = "fast" | "precision"

export const AUTO_EDIT_ANALYSIS_MODE_DEFAULT: AutoEditAnalysisMode = "fast"

export const AUTO_EDIT_ANALYSIS_MODE_OPTIONS: Array<{
  id: AutoEditAnalysisMode
  label: string
  hint: string
}> = [
  {
    id: "fast",
    label: "고속",
    hint: "소스 전 구간 핵심 프레임 샘플 · URL 1개(CDN) 약 1~2분",
  },
  {
    id: "precision",
    label: "정밀",
    hint: "URL 1개 최대 2분 구간 심층 행동 분석 + 컷별 Vision · 약 3~10분",
  },
]

export function normalizeAutoEditAnalysisMode(raw: unknown): AutoEditAnalysisMode {
  if (raw === "precision" || raw === "fast") return raw
  return AUTO_EDIT_ANALYSIS_MODE_DEFAULT
}

export type SceneVisualType =
  | "product_showcase"
  | "problem"
  | "demo"
  | "result"
  | "cta"
  | "other"

/** 행동 기반 장면 역할 — 연속 중복 금지 */
export type SceneRole =
  | "문제 제기"
  | "설치 방법"
  | "사용 방법"
  | "기능 소개"
  | "수납 효과"
  | "추가 활용"
  | "세척"
  | "관리"
  | "구매 포인트"
  | "마무리"
  | "데모"

/** 행동 기반 장면 분석 결과 */
export type ActionScene = {
  start: number
  end: number
  shot_type: string
  scene_role: SceneRole
  scene_description: string
  script_lines: string[]
  ocr_text?: string
  content_type?: SceneContentType
}

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
  shot_type?: string
  scene_role?: SceneRole
  script_lines?: string[]
  ocr_text?: string
}

/** 벤치마크 스타일 — 분석용 시각 장면 (대본 없음) */
export type VisualScene = {
  start: number
  end: number
  description: string
  shot_type?: string
  scene_role?: SceneRole
  script_lines?: string[]
  ocr_text?: string
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
  vision_frames?: Array<{
    timeSec: number
    content_type: SceneContentType
    caption?: string
    shot_type?: string
    hand_action?: string
    product?: string
    product_use?: string
    ocr_text?: string
    scene_hint?: string
  }>
  /** 행동 기반 장면 분석 (Scene Understanding) */
  action_scenes?: ActionScene[]
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
  /** 1단계 사용자 입력 키워드 — 대본·제품 정체성 기준 */
  sourceKeywords?: string[]
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
  /** 로컬 ffmpeg 렌더 — 작업·결과 폴더 */
  renderMode?: "server" | "local"
  localWorkDir?: string
  localOutputPath?: string
}

/** 브라우저에서 미리 추출한 영상 메타 */
export type ClientVideoMetaEntry = {
  duration: number
  keyframeDataUrl?: string
  timeSec?: number
  /** 정밀 모드 — 브라우저 다중 키프레임 (서버 ffmpeg 우회) */
  precisionKeyframes?: Array<{ timeSec: number; keyframeDataUrl: string }>
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
  /** 브라우저가 Supabase Storage에 소스 MP4를 미리 올린 경우 */
  sourcesPreUploaded?: boolean
  /** 비동기 job — 미리 생성한 작업 디렉터리 */
  presetWork?: { dir: string; id: string }
  /** 프로젝트명·주제 — 끝에 " 1"이면 자연스러운 스토리형 대본 */
  scriptTopic?: string
  /** 1단계 사용자 입력 한국어 키워드 — 제품·대본 정체성의 기준 */
  sourceKeywords?: string[]
  /** 제품·장면 분석 모드 (기본: fast) */
  analysisMode?: AutoEditAnalysisMode
  /** 브라우저에서 미리 추출한 길이·키프레임 (서버 ffmpeg 분석 생략) */
  clientVideoMeta?: Record<string, ClientVideoMetaEntry>
  /** server=Cloud Run(배포 기본) | local=지정 폴더 ffmpeg (로컬 dev 전용) */
  renderMode?: "server" | "local"
  /** 로컬 렌더 작업 루트 — sources/ · jobs/{jobId}/output.mp4 */
  localWorkDir?: string
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
