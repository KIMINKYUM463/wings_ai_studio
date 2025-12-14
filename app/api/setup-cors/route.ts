import { type NextRequest, NextResponse } from "next/server"
import { Storage } from "@google-cloud/storage"

/**
 * Cloud Storage 버킷에 CORS 설정을 적용하는 API
 * 
 * 이 API를 한 번 호출하면 CORS 설정이 자동으로 적용됩니다.
 * 
 * GET /api/setup-cors
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

    if (!credentials) {
      throw new Error("Google Cloud 인증 정보를 로드할 수 없습니다.")
    }

    const storage = new Storage({
      projectId,
      credentials,
    })

    return { storage, bucketName }
  } catch (error) {
    console.error("[SetupCORS] Storage client 초기화 실패:", error)
    throw error
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log("[SetupCORS] CORS 설정 시작")

    const { storage, bucketName } = getStorageClient()
    const bucket = storage.bucket(bucketName)

    // CORS 설정
    const corsConfig = [
      {
        origin: [
          "https://wingsaistudio.com",
          "https://www.wingsaistudio.com",
          "http://localhost:3000",
        ],
        method: ["GET", "PUT", "POST", "HEAD", "DELETE"],
        responseHeader: [
          "Content-Type",
          "Content-Length",
          "Access-Control-Allow-Origin",
        ],
        maxAgeSeconds: 3600,
      },
    ]

    // CORS 설정 적용
    await bucket.setCorsConfiguration(corsConfig)

    console.log("[SetupCORS] CORS 설정 완료")

    return NextResponse.json({
      success: true,
      message: "CORS 설정이 성공적으로 적용되었습니다!",
      corsConfig,
      bucket: bucketName,
    })
  } catch (error) {
    console.error("[SetupCORS] CORS 설정 오류:", error)
    return NextResponse.json(
      {
        success: false,
        error: `CORS 설정 실패: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    )
  }
}

