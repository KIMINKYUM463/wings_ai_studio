"use server"

import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const STORAGE_BUCKET = "video-sources"

export async function getProducts() {
  try {
    console.log("[v0] getProducts 호출됨")
    const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false })

    if (error) {
      console.log("[v0] products 테이블 조회 에러:", error)
      throw error
    }

    console.log("[v0] products 테이블 결과:", data)
    return data || []
  } catch (error) {
    console.error("Error fetching products:", error)
    throw new Error("제품 목록을 불러오는데 실패했습니다.")
  }
}

export async function getVideosByProduct(storageFolder: string) {
  try {
    console.log("[v0] getVideosByProduct 호출됨, storageFolder:", storageFolder)

    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).list(storageFolder, {
      limit: 100,
      offset: 0,
    })

    if (error) {
      console.log("[v0] Storage 파일 목록 조회 에러:", error)
      throw error
    }

    console.log("[v0] Storage 파일 목록:", data)

    const videoExtensions = [".mp4", ".mov", ".avi", ".mkv", ".webm"]
    const videos = data.filter((file) => {
      const fileName = file.name.toLowerCase()
      return videoExtensions.some((ext) => fileName.endsWith(ext))
    })

    console.log("[v0] 필터링된 영상 파일:", videos)

    const videosWithUrls = videos.map((video) => {
      const {
        data: { publicUrl },
      } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(`${storageFolder}/${video.name}`)

      return {
        id: video.id || video.name,
        name: video.name,
        title: video.name.replace(/\.[^/.]+$/, ""), // 확장자 제거
        video_url: publicUrl,
        created_at: video.created_at,
      }
    })

    console.log("[v0] 최종 영상 목록:", videosWithUrls)
    return videosWithUrls
  } catch (error) {
    console.error("Error fetching videos from storage:", error)
    throw new Error("영상 목록을 불러오는데 실패했습니다.")
  }
}

export async function addProduct(data: {
  name: string
  storage_folder: string
  coupang_url?: string
  benchmark_video_url?: string
}) {
  try {
    const { data: result, error } = await supabase
      .from("products")
      .insert({
        name: data.name,
        storage_folder: data.storage_folder,
        coupang_url: data.coupang_url,
        benchmark_video_url: data.benchmark_video_url,
      })
      .select()
      .single()

    if (error) throw error

    return result
  } catch (error) {
    console.error("Error adding product:", error)
    throw new Error("제품 추가에 실패했습니다.")
  }
}

export async function deleteProduct(id: string) {
  try {
    const { error } = await supabase.from("products").delete().eq("id", id)

    if (error) throw error
  } catch (error) {
    console.error("Error deleting product:", error)
    throw new Error("제품 삭제에 실패했습니다.")
  }
}

export async function uploadVideo(file: File, productId: string) {
  try {
    const timestamp = Date.now()
    const fileName = `${productId}/${timestamp}_${file.name}`

    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    })

    if (error) throw error

    const {
      data: { publicUrl },
    } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fileName)

    return {
      path: data.path,
      publicUrl: publicUrl,
    }
  } catch (error) {
    console.error("Error uploading video:", error)
    throw new Error("영상 업로드에 실패했습니다.")
  }
}

export async function deleteVideoFile(filePath: string) {
  try {
    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([filePath])

    if (error) throw error
  } catch (error) {
    console.error("Error deleting video file:", error)
    throw new Error("영상 파일 삭제에 실패했습니다.")
  }
}

export async function ensureDefaultProducts() {
  try {
    console.log("[v0] ensureDefaultProducts 호출됨")

    const { data: productsWithoutFolder, error: checkNullError } = await supabase
      .from("products")
      .select("id, name")
      .is("storage_folder", null)

    if (checkNullError) {
      console.log("[v0] storage_folder null 확인 에러:", checkNullError)
    } else if (productsWithoutFolder && productsWithoutFolder.length > 0) {
      console.log("[v0] storage_folder가 null인 제품 발견:", productsWithoutFolder.length)

      // 각 제품에 순차적으로 번호 할당
      for (let i = 0; i < productsWithoutFolder.length; i++) {
        const product = productsWithoutFolder[i]
        const folderNumber = (i + 1).toString()

        const { error: updateError } = await supabase
          .from("products")
          .update({ storage_folder: folderNumber })
          .eq("id", product.id)

        if (updateError) {
          console.log(`[v0] 제품 ${product.name} storage_folder 업데이트 에러:`, updateError)
        } else {
          console.log(`[v0] 제품 ${product.name}에 storage_folder ${folderNumber} 할당 완료`)
        }
      }
    }

    const { data: existingProducts, error: checkError } = await supabase.from("products").select("id").limit(1)

    if (checkError) {
      console.log("[v0] 제품 확인 에러:", checkError)
      throw checkError
    }

    if (existingProducts && existingProducts.length > 0) {
      console.log("[v0] 기존 제품이 있음, 생성 건너뜀")
      return
    }

    const defaultProducts = [
      {
        name: "샘플 제품 1",
        storage_folder: "1",
        coupang_url: "https://www.coupang.com",
        benchmark_video_url: "https://www.youtube.com",
      },
      {
        name: "샘플 제품 2",
        storage_folder: "2",
        coupang_url: null,
        benchmark_video_url: null,
      },
      {
        name: "샘플 제품 3",
        storage_folder: "3",
        coupang_url: null,
        benchmark_video_url: null,
      },
    ]

    const { error: insertError } = await supabase.from("products").insert(defaultProducts)

    if (insertError) {
      console.log("[v0] 기본 제품 생성 에러:", insertError)
      throw insertError
    }

    console.log("[v0] 기본 제품 3개 생성 완료")
  } catch (error) {
    console.error("Error ensuring default products:", error)
  }
}

export async function getMaxFolderNumber() {
  try {
    console.log("[v0] getMaxFolderNumber 호출됨")

    // 모든 storage_folder 값을 가져오기
    const { data, error } = await supabase.from("products").select("storage_folder").not("storage_folder", "is", null)

    if (error) {
      console.log("[v0] storage_folder 조회 에러:", error)
      throw error
    }

    if (!data || data.length === 0) {
      console.log("[v0] 제품이 없음, 0 반환")
      return 0
    }

    // 모든 storage_folder를 숫자로 변환하여 최대값 찾기
    const numbers = data.map((item) => Number.parseInt(item.storage_folder || "0", 10)).filter((num) => !isNaN(num))

    const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0

    console.log("[v0] 모든 폴더 번호:", numbers)
    console.log("[v0] 최대 폴더 번호:", maxNumber)

    return maxNumber
  } catch (error) {
    console.error("Error getting max folder number:", error)
    return 0
  }
}

export async function uploadMultipleVideos(files: File[], storageFolder: string) {
  try {
    const results = []
    const errors = []

    for (const file of files) {
      try {
        const timestamp = Date.now()
        const fileName = `${storageFolder}/${timestamp}_${file.name}`

        console.log(`[v0] 업로드 시작: ${file.name}`)

        const { data, error } = await supabase.storage.from(STORAGE_BUCKET).upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        })

        if (error) {
          console.error(`[v0] 업로드 실패: ${file.name}`, error)
          errors.push({ name: file.name, error: error.message })
          continue
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fileName)

        console.log(`[v0] 업로드 성공: ${file.name}`)

        results.push({
          name: file.name,
          path: data.path,
          publicUrl: publicUrl,
        })
      } catch (fileError) {
        console.error(`[v0] 파일 처리 중 에러: ${file.name}`, fileError)
        errors.push({ name: file.name, error: String(fileError) })
      }
    }

    console.log(`[v0] 업로드 완료 - 성공: ${results.length}, 실패: ${errors.length}`)

    return {
      success: results,
      errors: errors,
      totalSuccess: results.length,
      totalFailed: errors.length,
    }
  } catch (error) {
    console.error("[v0] uploadMultipleVideos 전체 에러:", error)
    throw new Error("영상 업로드 중 오류가 발생했습니다.")
  }
}
