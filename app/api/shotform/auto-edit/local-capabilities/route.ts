import { NextResponse } from "next/server"
import { hasFfmpeg } from "@/lib/ffmpeg-binaries"
import {
  defaultLocalWorkDir,
  isLocalRenderAllowedOnServer,
} from "@/lib/shotform-local-render-dir"

/** GET — 로컬 ffmpeg 렌더 사용 가능 여부 (npm run dev 전용) */
export async function GET() {
  if (!isLocalRenderAllowedOnServer()) {
    return NextResponse.json({
      available: false,
      reason: "배포 사이트에서는 서버(Cloud Run) 렌더만 사용할 수 있습니다.",
    })
  }
  if (!hasFfmpeg()) {
    return NextResponse.json({
      available: false,
      reason: "ffmpeg 바이너리를 찾지 못했습니다. npm install 후 dev 서버를 재시작해 주세요.",
      defaultWorkDir: defaultLocalWorkDir(),
    })
  }
  return NextResponse.json({
    available: true,
    defaultWorkDir: defaultLocalWorkDir(),
    layout: {
      sources: "sources/{video_id}.mp4 — 소스 영상 캐시",
      jobs: "jobs/{jobId}/output.mp4 — 짜집기 결과",
      editPlan: "jobs/{jobId}/edit-plan.json",
    },
  })
}
