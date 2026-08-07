"use server"

import { createClient } from "@supabase/supabase-js"

// Service Role Key를 사용하여 Storage 접근 권한 확보
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[Audio Library] Supabase 환경 변수가 설정되지 않았습니다.")
    throw new Error("Supabase 환경 변수가 설정되지 않았습니다.")
  }
  
  return createClient(supabaseUrl, supabaseServiceKey)
}

export interface AudioLibraryItem {
  name: string
  url: string
  path: string
  type: "bgm" | "sfx"
  duration?: number
}

/**
 * Supabase Storage에서 오디오 라이브러리 목록 가져오기
 */
export async function getAudioLibrary(type: "bgm" | "sfx"): Promise<AudioLibraryItem[]> {
  try {
    const supabase = getSupabaseClient()
    
    // 오디오 라이브러리 폴더 경로
    // Supabase Storage 구조: Buckets > video-sources > bgm 또는 sfx
    const folderPath = type === "bgm" ? "bgm" : "sfx"
    
    console.log(`[Audio Library] ========== ${type.toUpperCase()} 폴더 조회 시작 ==========`)
    console.log(`[Audio Library] Bucket: video-sources`)
    console.log(`[Audio Library] Folder Path: ${folderPath}`)
    
    // 먼저 루트 레벨에서 확인
    const { data: rootData, error: rootError } = await supabase.storage
      .from("video-sources")
      .list("", {
        limit: 100,
        offset: 0,
      })
    
    console.log(`[Audio Library] 루트 레벨 데이터:`, rootData?.map(item => item.name))
    
    // Storage에서 파일 목록 가져오기 (모든 파일 가져오기 - 페이지네이션)
    let allFiles: any[] = []
    let offset = 0
    const pageLimit = 1000 // 한 번에 가져올 최대 개수
    let hasError = false
    
    console.log(`[Audio Library] ${type} 폴더 전체 파일 가져오기 시작 (페이지네이션)`)
    
    while (true) {
      const { data, error } = await supabase.storage
        .from("video-sources")
        .list(folderPath, {
          limit: pageLimit,
          offset: offset,
        })
      
      if (error) {
        console.error(`[Audio Library] ${type} 목록 가져오기 실패 (offset: ${offset}):`, error)
        console.error(`[Audio Library] 에러 코드:`, error.statusCode)
        console.error(`[Audio Library] 에러 메시지:`, error.message)
        console.error(`[Audio Library] 에러 상세:`, JSON.stringify(error, null, 2))
        hasError = true
        break
      }
      
      if (!data || data.length === 0) {
        console.log(`[Audio Library] ${type} 폴더 조회 완료 (offset: ${offset}, 더 이상 데이터 없음)`)
        break
      }
      
      console.log(`[Audio Library] ${type} 폴더 조회 (offset: ${offset}): ${data.length}개 항목 발견`)
      allFiles = [...allFiles, ...data]
      
      // 마지막 페이지인지 확인
      if (data.length < pageLimit) {
        console.log(`[Audio Library] ${type} 폴더 마지막 페이지 도달 (총 ${allFiles.length}개 항목)`)
        break
      }
      
      offset += pageLimit
    }
    
    if (hasError) {
      console.error(`[Audio Library] ${type} 목록 가져오기 실패`)
      return []
    }
    
    const data = allFiles
    
    console.log(`[Audio Library] ${type} 폴더 원본 데이터 개수:`, data?.length || 0)
    if (data && data.length > 0) {
      console.log(`[Audio Library] ${type} 폴더 원본 데이터 항목들:`, data.map(item => ({
        name: item.name,
        id: item.id,
        metadata: item.metadata ? '있음' : '없음',
        updated_at: item.updated_at
      })))
      console.log(`[Audio Library] ${type} 폴더 원본 데이터 전체:`, JSON.stringify(data, null, 2))
    } else {
      console.log(`[Audio Library] ${type} 폴더 원본 데이터: null 또는 빈 배열`)
    }
    
    if (!data || data.length === 0) {
      console.log(`[Audio Library] ${type} 폴더가 비어있거나 존재하지 않음`)
      console.log(`[Audio Library] ========== ${type.toUpperCase()} 폴더 조회 종료 (데이터 없음) ==========`)
      return []
    }
    
    // 파일 정보와 공개 URL 생성
    // Supabase Storage의 list() 결과에서 파일만 필터링
    const audioExtensions = [".mp3", ".wav", ".m4a", ".ogg", ".aac", ".flac", ".mp4"]
    
    const audioItems: AudioLibraryItem[] = data
      .filter((item) => {
        // 확장자가 있는 항목만 파일로 간주
        const hasExtension = /\.\w+$/.test(item.name)
        if (!hasExtension) {
          console.log(`[Audio Library] 확장자 없음 (폴더로 간주): ${item.name}`)
          return false
        }
        
        // 오디오 파일 확장자 확인
        const fileName = item.name.toLowerCase()
        const isAudioFile = audioExtensions.some((ext) => fileName.endsWith(ext))
        
        if (!isAudioFile) {
          console.log(`[Audio Library] 오디오 파일이 아님: ${item.name}`)
          return false
        }
        
        console.log(`[Audio Library] 오디오 파일 확인: ${item.name}`)
        return true
      })
      .map((item) => {
        // 파일 경로 생성
        const filePath = `${folderPath}/${item.name}`
        const {
          data: { publicUrl },
        } = supabase.storage.from("video-sources").getPublicUrl(filePath)
        
        console.log(`[Audio Library] ${type} 파일 추가: ${item.name}`)
        console.log(`[Audio Library] 파일 경로: ${filePath}`)
        console.log(`[Audio Library] 공개 URL: ${publicUrl}`)
        
        return {
          name: item.name,
          url: publicUrl,
          path: filePath,
          type: type,
        }
      })
    
    console.log(`[Audio Library] ${type} ${audioItems.length}개 항목 로드 완료`)
    console.log(`[Audio Library] ${type} 파일 목록:`, audioItems.map(a => a.name))
    console.log(`[Audio Library] ========== ${type.toUpperCase()} 폴더 조회 종료 ==========`)
    return audioItems
  } catch (error) {
    console.error(`[Audio Library] ${type} 목록 가져오기 중 오류:`, error)
    if (error instanceof Error) {
      console.error(`[Audio Library] 에러 메시지:`, error.message)
      console.error(`[Audio Library] 에러 스택:`, error.stack)
    }
    console.error(`[Audio Library] ========== ${type.toUpperCase()} 폴더 조회 실패 ==========`)
    return []
  }
}

/**
 * 모든 오디오 라이브러리 항목 가져오기 (BGM + 효과음)
 */
export async function getAllAudioLibrary(): Promise<{
  bgm: AudioLibraryItem[]
  sfx: AudioLibraryItem[]
}> {
  try {
    const [bgm, sfx] = await Promise.all([
      getAudioLibrary("bgm"),
      getAudioLibrary("sfx"),
    ])
    
    return { bgm, sfx }
  } catch (error) {
    console.error("[Audio Library] 전체 목록 가져오기 중 오류:", error)
    return { bgm: [], sfx: [] }
  }
}

