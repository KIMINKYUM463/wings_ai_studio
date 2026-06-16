import { NextResponse } from "next/server"
import { hasFfmpeg } from "@/lib/ffmpeg-binaries"
import {
  defaultLocalWorkDir,
  isLocalRenderAllowedOnServer,
} from "@/lib/shotform-local-render-dir"

/** GET — 로컬 ffmpeg 렌더 (dev 서버) 또는 동반 에이전트 안내 */
export async function GET() {
  if (!isLocalRenderAllowedOnServer()) {
    return NextResponse.json({
      available: false,
      companionRecommended: true,
      defaultCompanionUrl: "http://127.0.0.1:3847",
      reason: "배포 사이트에서는 PC에서 npm run shotform:local-agent 실행 후 로컬 렌더를 사용하세요.",
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
