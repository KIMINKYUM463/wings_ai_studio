import { type NextRequest, NextResponse } from "next/server"
import { Storage } from "@google-cloud/storage"

/**
 * Cloud Storage 파일을 공개로 설정하는 API
 * 
 * 환경 변수 설정:
 * - GOOGLE_CLOUD_PROJECT_ID: Google Cloud 프로젝트 ID
 * - GOOGLE_CLOUD_STORAGE_BUCKET: Cloud Storage 버킷 이름
 * - GOOGLE_SERVICE_ACCOUNT_KEY: 서비스 계정 JSON (Vercel 환경 변수)
 * 
 * 요청:
 * - POST /api/upload-to-gcs/make-public
 * - body: { fileName: string }
 * 
 * 응답:
 * - { success: boolean, url: string }
 */

// Cloud Storage 클라이언트 초기화
function getStorageClient() {
  try {
    // 환경 변수에서 서비스 계정 정보 가져오기
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
      } else {
        throw new Error(`Credentials 파일이 존재하지 않습니다: ${keyPath}`)
      }
    } else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      // 배포 환경: 환경 변수에서 직접 읽기
      try {
        credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
      } catch (parseError) {
        throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY가 유효한 JSON 형식이 아닙니다.")
      }
    } else {
      throw new Error("Google Cloud 인증 정보가 설정되지 않았습니다. GOOGLE_APPLICATION_CREDENTIALS (로컬) 또는 GOOGLE_SERVICE_ACCOUNT_KEY (배포) 환경 변수를 설정해주세요.")
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
    console.error("[MakePublic] Storage client 초기화 실패:", error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const { fileName } = await request.json()

    if (!fileName) {
      return NextResponse.json(
        { error: "fileName이 필요합니다." },
        { status: 400 }
      )
    }

    console.log(`[MakePublic] 파일 공개 설정 시작: ${fileName}`)

    const { storage, bucketName } = getStorageClient()
    const bucket = storage.bucket(bucketName)
    const file = bucket.file(fileName)

    // 파일을 공개로 설정
    await file.makePublic()

    const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`

    console.log(`[MakePublic] 파일 공개 설정 완료: ${publicUrl}`)

    return NextResponse.json({
      success: true,
      url: publicUrl,
    })
  } catch (error) {
    console.error("[MakePublic] 파일 공개 설정 오류:", error)
    return NextResponse.json(
      {
        error: `파일 공개 설정 실패: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    )
  }
}

