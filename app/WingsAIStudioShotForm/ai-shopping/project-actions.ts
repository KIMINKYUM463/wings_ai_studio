"use server"

import { createClient } from "@/lib/supabase/server"
import type { Ver2ActiveStep } from "./ver2-steps"
import type {
  KeywordAnalysisSnapshot,
  SelectedKeywordProduct,
} from "@/lib/shotform-keyword-analysis-types"
import type { MvpThumbnailDesign } from "@/lib/mvp-thumbnail-design"
import type { CoupangDetailInsights } from "@/lib/shotform-coupang-detail-insights"
import type { ShotformVisualFocus } from "@/lib/shotform-script-templates"

export type { Ver2ActiveStep } from "./ver2-steps"

export interface ShoppingProject {
  id: string
  user_id: string
  name: string
  description?: string
  data: ShoppingProjectData
  created_at: string
  updated_at: string
}

export interface ProductReviewItem {
  author?: string
  rating?: number
  content: string
  date?: string
  /** 쿠팡 상품평 페이지 (1부터) — UI: "1페이지 · 1번" */
  page?: number
  /** 해당 페이지 내 순번 (1부터) */
  indexOnPage?: number
  images?: string[]
}

export interface StoryboardScene {
  id: string
  title?: string
  narration: string
  imagePrompt?: string
  motionPrompt?: string
  /** 현재 표시 중인 장면 이미지 (AI / 무료 / 업로드 중 하나) */
  imageUrl?: string
  /** AI가 생성한 원본 이미지 — 업로드·무료 이미지로 교체 후 복원용 */
  aiImageUrl?: string
  freeImageUrl?: string
  videoUrl?: string
  selectedForVideo?: boolean
  pixabayKeyword?: string
}

export interface SceneTtsTrack {
  sceneId: string
  sceneIndex: number
  text: string
  audioUrl: string
  durationMs: number
  subtitles: Array<{
    id: number
    text: string
    startTime: number
    endTime: number
    alignmentSource?: "provider" | "whisper" | "estimated"
  }>
}

/** 숏폼 대본 사실·근거 신뢰도 (0~100) */
export interface CoupangFactCheckData {
  overall: number
  reviewEvidence: number
  detailEvidence: number
  specificity: number
  consistency: number
  lowHype: number
  note?: string
}

/** 쿠팡 상품평 AI 인사이트 (대본 참고용) */
export interface CoupangReviewInsightsData {
  strengths: string[]
  useCases: string[]
  concerns: string[]
  quotes: string[]
  factCheck?: CoupangFactCheckData
}

/** @deprecated detailInsights는 lib 타입 사용 — 호환용 별칭 */
export type CoupangDetailInsightsData = CoupangDetailInsights

export interface ShoppingProjectData {
  appVariant?: "ver1" | "ver2" | "story" | "animal"

  keywordAnalysis?: KeywordAnalysisSnapshot
  selectedKeywordProduct?: SelectedKeywordProduct

  productName?: string
  productDescription?: string
  productImage?: string
  /** 상단 제품사진 (AI 선정 베스트 최대 2장) */
  productImages?: string[]
  productPrice?: string
  productDelivery?: string
  coupangUrl?: string
  /** Lucy Collector 등에서 붙인 원본 JSON 문자열 */
  productJson?: string
  reviews?: ProductReviewItem[]
  reviewImages?: string[]
  /** 쿠팡 상품 상세페이지 이미지 URL */
  detailImages?: string[]
  detailInsights?: CoupangDetailInsights
  reviewInsights?: CoupangReviewInsightsData
  reviewCountText?: string

  videoDuration?: 12 | 15 | 20 | 30
  /** 대본 목표 길이(초) · 슬라이더 10~60 */
  targetScriptSeconds?: number
  sceneCount?: number
  /** 선택한 대본 스타일 템플릿 id */
  selectedScriptTemplateId?: string
  visualFocus?: ShotformVisualFocus
  /** 대본 훅 제목 */
  scriptTitle?: string

  script?: string
  editedScript?: string
  storyboardScenes?: StoryboardScene[]

  selectedVoiceId?: string
  selectedSupertoneVoiceId?: string
  selectedSupertoneStyle?: string
  selectedTypecastVoiceId?: string
  selectedTypecastEmotion?: string
  ttsAudioUrl?: string
  sceneTtsTracks?: SceneTtsTrack[]
  ttsDurationMs?: number
  subtitleLines?: Array<{
    id: number
    text: string
    startTime: number
    endTime: number
    sceneIndex?: number
    alignmentSource?: "provider" | "whisper" | "estimated"
  }>
  /** 장면 id → 녹음/업로드 오디오 URL */
  voiceRecordings?: Record<string, string>

  imageUrls?: string[]
  freeImageUrls?: string[]
  imagePrompts?: Array<{
    type: string
    prompt: string
    description: string
    scriptText: string
    pixabayKeyword?: string
  }>
  convertedVideoUrls?: Array<{ index: number; videoUrl: string }>
  videoUrl?: string
  /** true면 Seedance 대신 이미지 줌인 클립으로 영상 단계 진행 */
  useImageZoomInsteadOfAiVideo?: boolean
  /** 줌인 클립 생성 완료 여부 (프로젝트 복원용) */
  imageZoomClipsPrepared?: boolean

  subtitleStyle?: {
    fontSize: number
    fontFamily: string
    color: string
    backgroundColor: string
    position: "top" | "center" | "bottom"
    positionOffset?: number
    textAlign: "left" | "center" | "right"
    fontWeight: "normal" | "bold"
    textShadow: boolean
    outlineEnabled?: boolean
    outlineWidth?: number
    outlineColor?: string
    shadowEnabled?: boolean
    shadowColor?: string
    shadowDistance?: number
    shadowAngle?: number
    horizontalPercent?: number
    verticalPercent?: number
    showAd?: boolean
  }

  bgmUrl?: string
  bgmVolume?: number
  bgmStartTime?: number
  bgmEndTime?: number
  sfxUrl?: string
  sfxVolume?: number
  sfxStartTime?: number
  sfxEndTime?: number
  ttsVolume?: number

  transitionEffect?: "none" | "fade" | "slide" | "zoom"
  transitionDuration?: number

  youtubeTitle?: string
  youtubeDescription?: string
  youtubeTags?: string[]

  thumbnailUrl?: string
  thumbnailHookingText?: { line1: string; line2: string }
  thumbnailStudioDesign?: MvpThumbnailDesign
  thumbnailImages?: Array<{
    url: string
    text: { line1: string; line2: string }
    isCustom: boolean
  }>
  selectedThumbnailIndex?: number

  activeStep?: Ver2ActiveStep
  completedSteps?: string[]
}

/**
 * 사용자의 ver2(AI 쇼핑숏폼) 프로젝트 목록
 */
export async function getShoppingProjects(userId: string): Promise<ShoppingProject[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("shopping_projects")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })

    if (error) {
      console.error("[Shopping Projects] 프로젝트 목록 조회 실패:", error)
      throw error
    }

    return (data || []).filter((project) => project.data?.appVariant === "ver2")
  } catch (error) {
    console.error("[Shopping Projects] 프로젝트 목록 조회 중 오류:", error)
    throw error
  }
}

export async function createShoppingProject(
  userId: string,
  name: string,
  description?: string,
  data?: ShoppingProjectData
): Promise<ShoppingProject> {
  try {
    const supabase = await createClient()
    const { data: project, error } = await supabase
      .from("shopping_projects")
      .insert({
        user_id: userId,
        name,
        description: description || null,
        data: { ...(data || {}), appVariant: "ver2" },
      })
      .select()
      .single()

    if (error) {
      console.error("[Shopping Projects] 프로젝트 생성 실패:", error)
      throw error
    }

    return project
  } catch (error) {
    console.error("[Shopping Projects] 프로젝트 생성 중 오류:", error)
    throw error
  }
}

export async function updateShoppingProject(
  projectId: string,
  updates: {
    name?: string
    description?: string
    data?: ShoppingProjectData
  }
): Promise<ShoppingProject> {
  try {
    const supabase = await createClient()
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.data !== undefined) {
      try {
        const serialized = JSON.stringify(updates.data)
        const dataSizeMB = serialized.length / 1024 / 1024
        console.log(`[Shopping Projects] 저장할 데이터 크기: ${dataSizeMB.toFixed(2)}MB`)
        if (dataSizeMB > 1) {
          console.warn(
            `[Shopping Projects] 데이터 크기가 1MB를 초과합니다: ${dataSizeMB.toFixed(2)}MB`
          )
        }
        updateData.data = { ...updates.data, appVariant: "ver2" }
      } catch (serializeError) {
        console.error("[Shopping Projects] 데이터 직렬화 실패:", serializeError)
        throw new Error(
          `데이터 직렬화 실패: ${
            serializeError instanceof Error ? serializeError.message : String(serializeError)
          }`
        )
      }
    }

    const { data: project, error } = await supabase
      .from("shopping_projects")
      .update(updateData)
      .eq("id", projectId)
      .select()
      .single()

    if (error) {
      console.error("[Shopping Projects] 프로젝트 업데이트 실패:", error)
      console.error("[Shopping Projects] Supabase 에러 상세:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      })
      throw error
    }

    return project
  } catch (error) {
    console.error("[Shopping Projects] 프로젝트 업데이트 중 오류:", error)
    throw error
  }
}

export async function deleteShoppingProject(projectId: string): Promise<void> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from("shopping_projects").delete().eq("id", projectId)

    if (error) {
      console.error("[Shopping Projects] 프로젝트 삭제 실패:", error)
      throw error
    }
  } catch (error) {
    console.error("[Shopping Projects] 프로젝트 삭제 중 오류:", error)
    throw error
  }
}

export async function getShoppingProject(projectId: string): Promise<ShoppingProject | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("shopping_projects")
      .select("*")
      .eq("id", projectId)
      .single()

    if (error) {
      if (error.code === "PGRST116") return null
      console.error("[Shopping Projects] 프로젝트 조회 실패:", error)
      throw error
    }

    return data
  } catch (error) {
    console.error("[Shopping Projects] 프로젝트 조회 중 오류:", error)
    throw error
  }
}

/**
 * TTS 오디오 업로드 (Server Action).
 * Blob 직접 전달은 깨질 수 있으므로 FormData(file)를 권장합니다.
 * 클라이언트에서는 lib/shotform-tts-storage-upload.ts 를 우선 사용하세요.
 */
export async function uploadTTSAudio(
  audioBlobOrForm: Blob | FormData,
  projectId?: string,
  userId?: string
): Promise<string> {
  try {
    const supabase = await createClient()

    let bytes: Buffer
    let mime = "audio/wav"
    let pid = projectId || ""
    let uid = userId || ""

    if (typeof FormData !== "undefined" && audioBlobOrForm instanceof FormData) {
      const file = audioBlobOrForm.get("file")
      pid = String(audioBlobOrForm.get("projectId") || pid)
      uid = String(audioBlobOrForm.get("userId") || uid)
      if (!(file instanceof Blob)) {
        throw new Error("오디오 파일이 없습니다. (FormData.file)")
      }
      mime = (file.type || "audio/wav").split(";")[0]?.trim() || "audio/wav"
      bytes = Buffer.from(await file.arrayBuffer())
    } else {
      const blob = audioBlobOrForm as Blob
      if (!blob || typeof (blob as Blob).arrayBuffer !== "function") {
        throw new Error(
          "오디오 Blob이 Server Action으로 전달되지 않았습니다. 클라이언트 업로드를 사용하세요."
        )
      }
      mime = (blob.type || "audio/wav").split(";")[0]?.trim() || "audio/wav"
      bytes = Buffer.from(await blob.arrayBuffer())
    }

    if (!uid || !pid) throw new Error("userId/projectId가 필요합니다.")
    if (!bytes.length) throw new Error("업로드할 오디오가 비어 있습니다.")

    const ext =
      mime.includes("mpeg") || mime.includes("mp3")
        ? "mp3"
        : mime.includes("ogg")
          ? "ogg"
          : mime.includes("webm")
            ? "webm"
            : "wav"
    const timestamp = Date.now()
    const fileName = `tts-audio/${uid}/${pid}/${timestamp}_tts.${ext}`

    const { error } = await supabase.storage.from("video-sources").upload(fileName, bytes, {
      contentType: mime,
      upsert: false,
    })

    if (error) {
      console.error("[Shopping Projects] 오디오 업로드 실패:", error)
      // shotform-assets 폴백
      const fallback = `ai-shopping/${uid}/${pid}/${timestamp}_tts.${ext}`
      const { error: err2 } = await supabase.storage
        .from("shotform-assets")
        .upload(fallback, bytes, { contentType: mime, upsert: true })
      if (err2) {
        throw new Error(`${error.message} / fallback: ${err2.message}`)
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from("shotform-assets").getPublicUrl(fallback)
      return publicUrl
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("video-sources").getPublicUrl(fileName)

    console.log("[Shopping Projects] 오디오 업로드 완료:", publicUrl)
    return publicUrl
  } catch (error) {
    console.error("[Shopping Projects] 오디오 업로드 중 오류:", error)
    throw error
  }
}
