import { type NextRequest, NextResponse } from "next/server"
import { Storage } from "@google-cloud/storage"

/**
 * GCS 객체에 대한 읽기용 Signed URL 생성 (균일 버킷 수준 액세스 버킷에서 make-public 없이 접근용)
 * body: { fileName: string, scope?: "shopping" }
 */
function getStorageClient(scope?: "shopping") {
  const isShopping = scope === "shopping"
  const projectId = isShopping
    ? (process.env.SHOPPING_GOOGLE_CLOUD_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT_ID)
    : process.env.GOOGLE_CLOUD_PROJECT_ID
  const bucketName = isShopping
    ? (process.env.SHOPPING_GOOGLE_CLOUD_STORAGE_BUCKET || process.env.GOOGLE_CLOUD_STORAGE_BUCKET)
    : process.env.GOOGLE_CLOUD_STORAGE_BUCKET

  if (!projectId || !bucketName) {
    throw new Error(
      isShopping
        ? "SHOPPING_GOOGLE_CLOUD_PROJECT_ID / SHOPPING_GOOGLE_CLOUD_STORAGE_BUCKET (또는 공통)이 설정되지 않았습니다."
        : "GOOGLE_CLOUD_PROJECT_ID 또는 GOOGLE_CLOUD_STORAGE_BUCKET이 설정되지 않았습니다."
    )
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
    if (fs.existsSync(credsPath)) {
      credentials = JSON.parse(fs.readFileSync(credsPath, "utf8"))
    }
  } else if (serviceAccountKey) {
    try {
      credentials = JSON.parse(serviceAccountKey)
    } catch {
      throw new Error("SERVICE_ACCOUNT_KEY가 유효한 JSON 형식이 아닙니다.")
    }
  }
  if (!credentials) {
    throw new Error("Google Cloud 인증 정보를 로드할 수 없습니다.")
  }

  const storage = new Storage({ projectId, credentials })
  return { storage, bucketName }
}

export async function POST(request: NextRequest) {
  try {
    const { fileName, scope } = await request.json()

    if (!fileName) {
      return NextResponse.json(
        { error: "fileName이 필요합니다." },
        { status: 400 }
      )
    }

    const isShopping = scope === "shopping"
    const { storage, bucketName } = getStorageClient(isShopping ? "shopping" : undefined)
    const bucket = storage.bucket(bucketName)
    const file = bucket.file(fileName)

    const [readUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 2 * 60 * 60 * 1000, // 2시간 (렌더 시간 여유)
    })

    return NextResponse.json({ readUrl })
  } catch (error) {
    console.error("[SignedReadURL] 오류:", error)
    return NextResponse.json(
      { error: `읽기 Signed URL 생성 실패: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    )
  }
}
