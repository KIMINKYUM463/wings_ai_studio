import { type NextRequest, NextResponse } from "next/server"
import { Storage } from "@google-cloud/storage"

/**
 * Cloud Storage Signed URL 생성 API (클라이언트 직접 업로드용)
 * 
 * 이 API는 작은 요청만 받아서 Signed URL을 반환합니다.
 * 실제 파일 업로드는 클라이언트에서 Signed URL을 사용하여 직접 수행합니다.
 * 
 * 환경 변수 설정:
 * - GOOGLE_CLOUD_PROJECT_ID: Google Cloud 프로젝트 ID
 * - GOOGLE_CLOUD_STORAGE_BUCKET: Cloud Storage 버킷 이름
 * - GOOGLE_SERVICE_ACCOUNT_KEY: 서비스 계정 JSON (Vercel 환경 변수)
 * 
 * 요청:
 * - POST /api/upload-to-gcs/signed-url
 * - body: { fileName: string, contentType: string }
 * 
 * 응답:
 * - { signedUrl: string, fileName: string, publicUrl: string }
 */

// Cloud Storage 클라이언트 초기화
function getStorageClient() {
  try {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID
    const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET

    if (!projectId || !bucketName) {
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
    console.error("[SignedURL] Storage client 초기화 실패:", error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const { fileName, contentType } = await request.json()

    if (!fileName) {
      return NextResponse.json(
        { error: "fileName이 필요합니다." },
        { status: 400 }
      )
    }

    console.log(`[SignedURL] Signed URL 생성 시작: ${fileName}`)

    const { storage, bucketName } = getStorageClient()
    const bucket = storage.bucket(bucketName)

    // 고유한 파일명 생성
    const timestamp = Date.now()
    const uniqueFileName = `${timestamp}_${fileName}`

    // Signed URL 생성 (업로드용, 1시간 유효)
    const file = bucket.file(uniqueFileName)
    const [signedUrl] = await file.getSignedUrl({
      action: "write",
      expires: Date.now() + 60 * 60 * 1000, // 1시간
      contentType: contentType || "application/octet-stream",
    })

    // 공개 URL (업로드 후 사용)
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${uniqueFileName}`

    console.log(`[SignedURL] Signed URL 생성 완료: ${uniqueFileName}`)

    return NextResponse.json({
      signedUrl,
      fileName: uniqueFileName,
      publicUrl,
    })
  } catch (error) {
    console.error("[SignedURL] Signed URL 생성 오류:", error)
    return NextResponse.json(
      {
        error: `Signed URL 생성 실패: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    )
  }
}

