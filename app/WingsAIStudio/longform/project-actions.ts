"use server"

import { createClient } from "@/lib/supabase/client"

export interface LongformProject {
  id: string
  user_id: string
  name: string
  description?: string
  data: any // 프로젝트 데이터 (모든 작업 내용)
  created_at: string
  updated_at: string
}

export interface ProjectData {
  // 주제 관련
  selectedTopic?: string
  keywords?: string
  customTopic?: string
  isCustomTopicSelected?: boolean
  isDirectInputSelected?: boolean
  benchmarkScript?: string
  isDirectScriptInput?: boolean
  directScript?: string
  isStoryMode?: boolean
  generatedTopics?: string[] // 생성된 주제 목록
  selectedCategory?: string // 선택된 카테고리
  
  // 대본 관련
  script?: string
  scriptPlan?: string // 대본 기획
  scriptDraft?: string // 대본 초안
  decomposedScenes?: string
  scriptLines?: Array<{ id: number; text: string }>
  scriptDuration?: number
  maxScenesPerScene?: 1 | 2 | 3
  referenceTitle?: string // 레퍼런스 제목
  referenceScript?: string // 레퍼런스 대본
  
  // 이미지 관련
  sceneImagePrompts?: Array<{ sceneNumber: number; images: Array<{ imageNumber: number; prompt: string; sceneText: string; visualInstruction?: string; imageUrl?: string }> }>
  generatedImages?: Array<{ lineId: number; imageUrl: string; prompt: string }>
  imageStyle?: string
  customStylePrompt?: string
  customStyleCharacterImage?: string | null
  customStyleBackgroundImage?: string | null
  realisticCharacterType?: "korean" | "foreign" | null
  // stickmanCharacterDescription는 이미지 프롬프트 생성 시 지역 변수로만 사용되므로 저장하지 않음
  convertedVideos?: Array<{ lineId: number; videoUrl: string }> // 변환된 영상 (Map을 배열로 변환)
  convertedSceneVideos?: Array<{ key: string; videoUrl: string }> // Scene 변환된 영상 (Map을 배열로 변환)
  
  // TTS 관련
  selectedVoiceId?: string
  generatedAudios?: Array<{ lineId: number; audioUrl: string; alignment?: any }> // audioBase64는 용량이 크므로 저장하지 않음
  
  // 영상 관련
  videoData?: {
    audioUrl: string
    subtitles: Array<{ id: number; start: number; end: number; text: string }>
    duration: number
    videoUrl?: string
    autoImages?: Array<{
      id: string
      url: string
      startTime: number
      endTime: number
      keyword: string
      motion?: string
    }>
  }
  
  // 제목 관련
  generatedTitles?: string[] // 생성된 제목 목록
  selectedTitle?: string // 선택된 제목
  customTitle?: string // 커스텀 제목
  
  // 썸네일 관련
  youtubeTitle?: string
  youtubeDescription?: {
    description: string
    pinnedComment: string
    hashtags: string
    uploadTags: string[]
  } | null
  aiThumbnailUrl?: string | null
  thumbnailCustomText?: string
  thumbnailText?: string[] // 썸네일 텍스트 배열
  
  // 기타
  completedSteps?: string[]
  activeStep?: string
}

/**
 * 사용자의 모든 프로젝트 목록 조회
 */
export async function getProjects(userId: string): Promise<LongformProject[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("longform_projects")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
    
    if (error) {
      console.error("[Projects] 프로젝트 목록 조회 실패:", error)
      throw error
    }
    
    return data || []
  } catch (error) {
    console.error("[Projects] 프로젝트 목록 조회 중 오류:", error)
    throw error
  }
}

/**
 * 프로젝트 생성
 */
export async function createProject(
  userId: string,
  name: string,
  description?: string,
  data?: ProjectData
): Promise<LongformProject> {
  try {
    const supabase = createClient()
    const { data: project, error } = await supabase
      .from("longform_projects")
      .insert({
        user_id: userId,
        name,
        description: description || null,
        data: data || {},
      })
      .select()
      .single()
    
    if (error) {
      console.error("[Projects] 프로젝트 생성 실패:", error)
      throw error
    }
    
    return project
  } catch (error) {
    console.error("[Projects] 프로젝트 생성 중 오류:", error)
    throw error
  }
}

/**
 * 프로젝트 업데이트
 */
export async function updateProject(
  projectId: string,
  updates: {
    name?: string
    description?: string
    data?: ProjectData
  }
): Promise<LongformProject> {
  try {
    const supabase = createClient()
    const updateData: any = {}
    
    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.data !== undefined) updateData.data = updates.data
    
    const { data: project, error } = await supabase
      .from("longform_projects")
      .update(updateData)
      .eq("id", projectId)
      .select()
      .single()
    
    if (error) {
      console.error("[Projects] 프로젝트 업데이트 실패:", error)
      throw error
    }
    
    return project
  } catch (error) {
    console.error("[Projects] 프로젝트 업데이트 중 오류:", error)
    throw error
  }
}

/**
 * 프로젝트 삭제
 */
export async function deleteProject(projectId: string): Promise<void> {
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from("longform_projects")
      .delete()
      .eq("id", projectId)
    
    if (error) {
      console.error("[Projects] 프로젝트 삭제 실패:", error)
      throw error
    }
  } catch (error) {
    console.error("[Projects] 프로젝트 삭제 중 오류:", error)
    throw error
  }
}

/**
 * 프로젝트 조회
 */
export async function getProject(projectId: string): Promise<LongformProject | null> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("longform_projects")
      .select("*")
      .eq("id", projectId)
      .single()
    
    if (error) {
      if (error.code === "PGRST116") {
        // 프로젝트를 찾을 수 없음
        return null
      }
      console.error("[Projects] 프로젝트 조회 실패:", error)
      throw error
    }
    
    return data
  } catch (error) {
    console.error("[Projects] 프로젝트 조회 중 오류:", error)
    throw error
  }
}

