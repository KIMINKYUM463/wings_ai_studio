import { type NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { saveUploadedVideoBuffer } from "@/lib/shotform-auto-edit-ffmpeg"
import {
  isLocalRenderAllowedOnServer,
  localSourceCachePath,
  normalizeLocalWorkDir,
} from "@/lib/shotform-local-render-dir"

/** POST multipart — 로컬 작업 폴더 sources/ 에 소스 MP4 저장 */
export async function POST(req: NextRequest) {
  if (!isLocalRenderAllowedOnServer()) {
    return NextResponse.json(
      { error: "로컬 소스 저장은 npm run dev 환경에서만 사용할 수 있습니다." },
      { status: 403 }
    )
  }

  try {
    const form = await req.formData()
    const localWorkDir = String(form.get("localWorkDir") ?? "").trim()
    if (!localWorkDir) {
      return NextResponse.json({ error: "localWorkDir가 필요합니다." }, { status: 400 })
    }
    const workRoot = normalizeLocalWorkDir(localWorkDir)

    const saved: string[] = []
    for (const [key, value] of form.entries()) {
      if (!key.startsWith("video_") || !(value instanceof File) || value.size < 50_000) continue
      const videoId = key.slice("video_".length).trim()
      if (!videoId) continue
      const buf = Buffer.from(await value.arrayBuffer())
      const dest = localSourceCachePath(workRoot, videoId)
      await fs.mkdir(path.dirname(dest), { recursive: true })
      await saveUploadedVideoBuffer(buf, dest)
      saved.push(videoId)
    }

    if (!saved.length) {
      return NextResponse.json({ error: "업로드된 영상 파일이 없습니다." }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      workRoot,
      saved,
      paths: Object.fromEntries(saved.map((id) => [id, localSourceCachePath(workRoot, id)])),
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "오류" }, { status: 500 })
  }
}
