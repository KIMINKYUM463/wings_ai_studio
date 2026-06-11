import { NextRequest, NextResponse } from "next/server"
import { verifyVmakeApiKey } from "@/lib/shotform-vmake-client"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const apiKey = typeof body.apiKey === "string" ? body.apiKey : ""
    const secretAccessKey = typeof body.secretAccessKey === "string" ? body.secretAccessKey : ""
    const subtitleCreatePath =
      typeof body.subtitleCreatePath === "string" ? body.subtitleCreatePath.trim() : undefined
    const result = await verifyVmakeApiKey({ apiKey, secretAccessKey, subtitleCreatePath })
    return NextResponse.json({
      success: result.ok,
      message: result.message,
      suggestedCreatePath: result.suggestedCreatePath,
      suggestedPollPath: result.suggestedPollPath,
      suggestedBaseUrl: result.suggestedBaseUrl,
    })
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        message: e instanceof Error ? e.message : "Vmake API 테스트 실패",
      },
      { status: 500 }
    )
  }
}
