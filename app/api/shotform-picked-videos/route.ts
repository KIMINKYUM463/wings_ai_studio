import { NextResponse } from "next/server"
import type { PickedVideosResponse } from "@/lib/shotform-picked-videos-types"

export async function GET() {
  const body: PickedVideosResponse = { videos: [] }
  return NextResponse.json(body)
}
