import { type NextRequest, NextResponse } from "next/server"
import { Storage } from "@google-cloud/storage"

/**
 * Cloud Storage에 파일 업로드 API
 * 
 * 환경 변수 설정:
 * - GOOGLE_CLOUD_PROJECT_ID: Google Cloud 프로젝트 ID
 * - GOOGLE_CLOUD_STORAGE_BUCKET: Cloud Storage 버킷 이름
 * - GOOGLE_APPLICATION_CREDENTIALS: 서비스 계정 키 파일 경로 (로컬 개발용)
 * 또는
 * - Vercel 환경 변수에 서비스 계정 JSON을 직접 설정 (배포용)
 * 
 * 요청:
 * - POST /api/upload-to-gcs
 * - body: { fileBase64: string, fileName: string, contentType: string }
 * 
 * 응답:
 * - { success: boolean, url: string, gsUri: string }
 */

// Cloud Storage 클라이언트 초기화
function getStorageClient() {
  try {
    // 환경 변수에서 서비스 계정 정보 가져오기
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID
    const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET

    console.log("[Upload] getStorageClient 호출:")
    console.log("[Upload] projectId:", projectId)
    console.log("[Upload] bucketName:", bucketName)

    if (!projectId || !bucketName) {
      console.error("[Upload] 환경 변수 누락:")
      console.error("[Upload] projectId:", projectId)
      console.error("[Upload] bucketName:", bucketName)
      throw new Error("GOOGLE_CLOUD_PROJECT_ID 또는 GOOGLE_CLOUD_STORAGE_BUCKET이 설정되지 않았습니다.")
    }

    // 서비스 계정 키 설정
    let credentials: any = undefined
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // 로컬 개발: 파일 경로 사용
      const fs = require("fs")
      const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
      if (fs.existsSync(keyPath)) {
        credentials = JSON.parse(fs.readFileSync(keyPath, "utf8"))
      }
    } else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      // 배포 환경: 환경 변수에서 직접 읽기
      credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
    }

    const storage = new Storage({
      projectId,
      ...(credentials && { credentials }),
    })

    return { storage, bucketName }
  } catch (error) {
    console.error("[Upload] Storage client 초기화 실패:", error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    // 요청 본문 크기 확인 (Vercel 제한: 4.5MB)
    const requestBody = await request.text()
    const requestSizeMB = requestBody.length / 1024 / 1024
    
    if (requestSizeMB > 4.5) {
      console.error(`[Upload] 요청 크기가 너무 큽니다: ${requestSizeMB.toFixed(2)}MB (Vercel 제한: 4.5MB)`)
      return NextResponse.json(
        { 
          error: `요청 크기가 너무 큽니다 (${requestSizeMB.toFixed(2)}MB). Vercel의 요청 크기 제한(4.5MB)을 초과합니다. 파일을 더 작게 나누거나 다른 방법을 사용해주세요.`,
          requestSizeMB: requestSizeMB.toFixed(2)
        },
        { status: 413 }
      )
    }
    
    // 디버깅: 환경 변수 확인 (상세)
    console.log("[Upload] 환경 변수 확인:")
    console.log("[Upload] GOOGLE_CLOUD_PROJECT_ID:", process.env.GOOGLE_CLOUD_PROJECT_ID || "undefined")
    console.log("[Upload] GOOGLE_CLOUD_STORAGE_BUCKET:", process.env.GOOGLE_CLOUD_STORAGE_BUCKET || "undefined")
    console.log("[Upload] GOOGLE_APPLICATION_CREDENTIALS:", process.env.GOOGLE_APPLICATION_CREDENTIALS || "undefined")
    console.log("[Upload] 모든 환경 변수 키:", Object.keys(process.env).filter(key => key.includes("GOOGLE")))
    
    const { fileBase64, fileName, contentType } = JSON.parse(requestBody)

    if (!fileBase64 || !fileName) {
      return NextResponse.json(
        { error: "fileBase64와 fileName이 필요합니다." },
        { status: 400 }
      )
    }

    console.log(`[Upload] Cloud Storage 업로드 시작: ${fileName} (${contentType || "unknown"})`)

    const { storage, bucketName } = getStorageClient()
    const bucket = storage.bucket(bucketName)

    // base64 디코딩
    const fileBuffer = Buffer.from(fileBase64, "base64")
    console.log(`[Upload] 파일 크기: ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB`)

    // 고유한 파일명 생성 (타임스탬프 추가)
    const timestamp = Date.now()
    const uniqueFileName = `${timestamp}_${fileName}`

    // Cloud Storage에 업로드
    const file = bucket.file(uniqueFileName)
    
    await file.save(fileBuffer, {
      metadata: {
        contentType: contentType || "application/octet-stream",
        cacheControl: "public, max-age=3600",
      },
    })

    // 공개 URL 생성 (Signed URL 또는 Public URL)
    // 버킷이 공개 설정되어 있으면 public URL 사용
    // 아니면 signed URL 생성 (1시간 유효)
    let url: string
    try {
      // 공개 URL 시도
      url = `https://storage.googleapis.com/${bucketName}/${uniqueFileName}`
      
      // 파일을 공개로 설정
      await file.makePublic()
    } catch (error) {
      // 공개 설정 실패 시 signed URL 생성
      console.log("[Upload] 공개 URL 설정 실패, signed URL 생성")
      const [signedUrl] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 60 * 60 * 1000, // 1시간
      })
      url = signedUrl
    }

    const gsUri = `gs://${bucketName}/${uniqueFileName}`

    console.log(`[Upload] 업로드 완료: ${url}`)

    return NextResponse.json({
      success: true,
      url,
      gsUri,
      fileName: uniqueFileName,
    })
  } catch (error) {
    console.error("[Upload] 업로드 오류:", error)
    return NextResponse.json(
      {
        error: `업로드 실패: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    )
  }
}

