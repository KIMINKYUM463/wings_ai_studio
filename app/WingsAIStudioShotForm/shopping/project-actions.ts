"use server"

import { createClient } from "@/lib/supabase/server"

export interface ShoppingProject {
  id: string
  user_id: string
  name: string
  description?: string
  data: ShoppingProjectData
  created_at: string
  updated_at: string
}

export interface ShoppingProjectData {
  // 제품 정보
  productName?: string
  productDescription?: string
  productImage?: string // base64 또는 URL
  
  // 영상 길이
  videoDuration?: 12 | 15 | 20 | 30
  
  // 대본 관련
  script?: string
  editedScript?: string
  
  // TTS 관련
  selectedVoiceId?: string
  selectedSupertoneVoiceId?: string
  selectedSupertoneStyle?: string
  ttsAudioUrl?: string
  
  // 이미지 및 영상
  imageUrls?: string[]
  imagePrompts?: Array<{ type: string; prompt: string; description: string; scriptText: string }>
  convertedVideoUrls?: Array<{ index: number; videoUrl: string }>
  videoUrl?: string
  
  // 자막 스타일
  subtitleStyle?: {
    fontSize: number
    fontFamily: string
    color: string
    backgroundColor: string
    position: "top" | "center" | "bottom"
    positionOffset?: number // 위치 세부 조정 (픽셀 단위, -200 ~ +200)
    textAlign: "left" | "center" | "right"
    fontWeight: "normal" | "bold"
    textShadow: boolean
  }
  
  // BGM 관련
  bgmUrl?: string
  bgmVolume?: number
  bgmStartTime?: number
  bgmEndTime?: number
  ttsVolume?: number
  
  // 효과음 관련
  sfxUrl?: string
  sfxVolume?: number
  sfxStartTime?: number
  sfxEndTime?: number
  
  // 영상 효과 및 전환
  transitionEffect?: "none" | "fade" | "slide" | "zoom"
  transitionDuration?: number
  
  // 유튜브 메타데이터
  youtubeTitle?: string
  youtubeDescription?: string
  youtubeTags?: string[]
  
  // 썸네일
  thumbnailUrl?: string
  thumbnailHookingText?: { line1: string; line2: string }
  thumbnailImages?: Array<{ url: string; text: { line1: string; line2: string }; isCustom: boolean }>
  selectedThumbnailIndex?: number
  
  // 진행 상태
  activeStep?: "product" | "script" | "video" | "render" | "thumbnail" | "preview"
  completedSteps?: string[]
}

/**
 * 사용자의 모든 쇼핑 프로젝트 목록 조회
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
    
    return data || []
  } catch (error) {
    console.error("[Shopping Projects] 프로젝트 목록 조회 중 오류:", error)
    throw error
  }
}

/**
 * 쇼핑 프로젝트 생성
 */
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
        data: data || {},
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

/**
 * 쇼핑 프로젝트 업데이트
 */
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
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }
    
    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.data !== undefined) {
      // 데이터 직렬화 테스트 및 크기 확인
      try {
        const serialized = JSON.stringify(updates.data)
        const dataSizeMB = serialized.length / 1024 / 1024
        console.log(`[Shopping Projects] 저장할 데이터 크기: ${dataSizeMB.toFixed(2)}MB`)
        if (dataSizeMB > 1) {
          console.warn(`[Shopping Projects] 데이터 크기가 1MB를 초과합니다: ${dataSizeMB.toFixed(2)}MB`)
        }
        updateData.data = updates.data
      } catch (serializeError) {
        console.error("[Shopping Projects] 데이터 직렬화 실패:", serializeError)
        throw new Error(`데이터 직렬화 실패: ${serializeError instanceof Error ? serializeError.message : String(serializeError)}`)
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
    console.error("[Shopping Projects] 에러 상세:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      error: error,
    })
    throw error
  }
}

/**
 * 쇼핑 프로젝트 삭제
 */
export async function deleteShoppingProject(projectId: string): Promise<void> {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from("shopping_projects")
      .delete()
      .eq("id", projectId)
    
    if (error) {
      console.error("[Shopping Projects] 프로젝트 삭제 실패:", error)
      throw error
    }
  } catch (error) {
    console.error("[Shopping Projects] 프로젝트 삭제 중 오류:", error)
    throw error
  }
}

/**
 * 쇼핑 프로젝트 조회
 */
export async function getShoppingProject(projectId: string): Promise<ShoppingProject | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("shopping_projects")
      .select("*")
      .eq("id", projectId)
      .single()
    
    if (error) {
      if (error.code === "PGRST116") {
        // 프로젝트를 찾을 수 없음
        return null
      }
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
 * TTS 오디오 파일을 Supabase Storage에 업로드
 */
export async function uploadTTSAudio(
  audioBlob: Blob,
  projectId: string,
  userId: string
): Promise<string> {
  try {
    const supabase = await createClient()
    
    // 고유한 파일명 생성
    const timestamp = Date.now()
    const fileName = `tts-audio/${userId}/${projectId}/${timestamp}_tts.wav`
    
    // Blob을 File로 변환
    const audioFile = new File([audioBlob], `${timestamp}_tts.wav`, { type: "audio/wav" })
    
    // Supabase Storage에 업로드
    const { data, error } = await supabase.storage
      .from("video-sources")
      .upload(fileName, audioFile, {
        contentType: "audio/wav",
        upsert: false,
      })
    
    if (error) {
      console.error("[Shopping Projects] 오디오 업로드 실패:", error)
      throw error
    }
    
    // 공개 URL 가져오기
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


