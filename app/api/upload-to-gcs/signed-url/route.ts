import { type NextRequest, NextResponse } from "next/server"
import { Storage } from "@google-cloud/storage"

/**
 * Cloud Storage Signed URL 생성 API (클라이언트 직접 업로드용)
 *
 * [롱폼] 환경 변수: GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_STORAGE_BUCKET, GOOGLE_SERVICE_ACCOUNT_KEY
 * [숏폼] body.scope === "shopping" 일 때 별도 GCP 사용:
 *   SHOPPING_GOOGLE_CLOUD_PROJECT_ID, SHOPPING_GOOGLE_CLOUD_STORAGE_BUCKET, SHOPPING_GOOGLE_SERVICE_ACCOUNT_KEY
 *
 * 요청 body: { fileName: string, contentType?: string, scope?: "shopping" }
 */

// Cloud Storage 클라이언트 초기화 (scope: "shopping" 이면 숏폼 전용 프로젝트/버킷 사용)
function getStorageClient(scope?: "shopping") {
  const isShopping = scope === "shopping"
  const projectId = isShopping
    ? (process.env.SHOPPING_GOOGLE_CLOUD_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT_ID)
    : process.env.GOOGLE_CLOUD_PROJECT_ID
  const bucketName = isShopping
    ? (process.env.SHOPPING_GOOGLE_CLOUD_STORAGE_BUCKET || process.env.GOOGLE_CLOUD_STORAGE_BUCKET)
    : process.env.GOOGLE_CLOUD_STORAGE_BUCKET

  try {
    console.log("[SignedURL] getStorageClient 호출:", isShopping ? "shopping" : "longform")
    console.log("[SignedURL] projectId:", projectId)
    console.log("[SignedURL] bucketName:", bucketName)

    if (!projectId || !bucketName) {
      const prefix = isShopping ? "SHOPPING_GOOGLE_CLOUD_PROJECT_ID / SHOPPING_GOOGLE_CLOUD_STORAGE_BUCKET (또는 공통)" : "GOOGLE_CLOUD_PROJECT_ID / GOOGLE_CLOUD_STORAGE_BUCKET"
      throw new Error(`${prefix}이 설정되지 않았습니다.`)
    }

    let credentials: any = undefined
    const credsPath = isShopping
      ? (process.env.SHOPPING_GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS)
      : process.env.GOOGLE_APPLICATION_CREDENTIALS
    const serviceAccountKey = isShopping
      ? (process.env.SHOPPING_GOOGLE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
      : process.env.GOOGLE_SERVICE_ACCOUNT_KEY

    if (credsPath) {
      const fs = require("fs")
      console.log("[SignedURL] credentials 경로:", credsPath)
      if (fs.existsSync(credsPath)) {
        credentials = JSON.parse(fs.readFileSync(credsPath, "utf8"))
        console.log("[SignedURL] 파일에서 credentials 로드 성공")
      } else {
        console.error("[SignedURL] credentials 파일이 존재하지 않습니다:", credsPath)
      }
    } else if (serviceAccountKey) {
      try {
        credentials = JSON.parse(serviceAccountKey)
        console.log("[SignedURL] 환경 변수에서 credentials 로드 성공")
      } catch (parseError) {
        console.error("[SignedURL] SERVICE_ACCOUNT_KEY JSON 파싱 실패:", parseError)
        throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY(또는 SHOPPING_*)가 유효한 JSON 형식이 아닙니다.")
      }
    } else {
      throw new Error("Google Cloud 인증 정보가 없습니다. GOOGLE_APPLICATION_CREDENTIALS(로컬) 또는 GOOGLE_SERVICE_ACCOUNT_KEY(배포) 또는 숏폼용 SHOPPING_* 환경 변수를 설정해주세요.")
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
    console.error("[SignedURL] Storage client 초기화 실패:", error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const { fileName, contentType, scope } = await request.json()

    if (!fileName) {
      return NextResponse.json(
        { error: "fileName이 필요합니다." },
        { status: 400 }
      )
    }

    console.log(`[SignedURL] Signed URL 생성 시작: ${fileName}`, scope === "shopping" ? "(숏폼)" : "")

    const { storage, bucketName } = getStorageClient(scope === "shopping" ? "shopping" : undefined)
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

