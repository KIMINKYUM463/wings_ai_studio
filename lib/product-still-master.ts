import { randomUUID } from "crypto"
import fs from "fs"
import os from "os"
import path from "path"
import { spawnSync } from "child_process"
import { assertFfmpegExecutable, resolveFfmpegPath } from "@/lib/ffmpeg-binaries"
import { createMvpProjectsClient } from "@/lib/supabase/mvp-projects"
import { SHORTS_MASTER, stillPanFilter } from "@/lib/shorts-master-quality"

/**
 * 실제 제품 사진을 AI로 다시 그리지 않고 1080×1920 마스터 클립으로 만든다.
 * 카메라는 6%만 이동해 제품 형태와 로고가 유지된다.
 */
export async function renderProductPhotoMaster(
  imageUrl: string,
  durationSec: number,
  pan: "left" | "right" = "right"
): Promise<string> {
  const source = imageUrl.trim()
  if (!/^https?:\/\//i.test(source) && !source.startsWith("data:image/")) {
    throw new Error("제품 사진 주소를 영상으로 만들 수 없습니다.")
  }
  assertFfmpegExecutable()
  const duration = Math.max(1, Math.min(12, durationSec))
  const dir = path.join(os.tmpdir(), "product-still-master", randomUUID())
  fs.mkdirSync(dir, { recursive: true })
  try {
    const imgPath = path.join(dir, "still.jpg")
    if (source.startsWith("data:image/")) {
      const matched = source.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,([A-Za-z0-9+/=\s]+)$/)
      if (!matched) throw new Error("제품 사진 데이터 형식을 읽지 못했습니다.")
      fs.writeFileSync(imgPath, Buffer.from(matched[1]!.replace(/\s/g, ""), "base64"))
    } else {
      const response = await fetch(source, { signal: AbortSignal.timeout(30_000) })
      if (!response.ok) throw new Error(`제품 사진을 받지 못했습니다 (${response.status})`)
      fs.writeFileSync(imgPath, Buffer.from(await response.arrayBuffer()))
    }

    const outPath = path.join(dir, "master.mp4")
    const result = spawnSync(
      resolveFfmpegPath(),
      [
        "-y",
        "-loop",
        "1",
        "-i",
        imgPath,
        "-t",
        duration.toFixed(3),
        "-vf",
        stillPanFilter(duration, pan),
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        SHORTS_MASTER.preset,
        "-crf",
        SHORTS_MASTER.crf,
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        outPath,
      ],
      { encoding: "utf8", windowsHide: true, maxBuffer: 32 * 1024 * 1024 }
    )
    if (result.status !== 0 || !fs.existsSync(outPath)) {
      throw new Error(`제품 사진 마스터 렌더 실패: ${(result.stderr || "").slice(-400)}`)
    }

    const storagePath = `generated-media/videos/${Date.now()}_${randomUUID().slice(0, 8)}.mp4`
    const supabase = await createMvpProjectsClient()
    const uploaded = await supabase.storage.from("video-sources").upload(storagePath, fs.readFileSync(outPath), {
      contentType: "video/mp4",
      upsert: false,
    })
    if (uploaded.error) throw new Error(uploaded.error.message)
    return supabase.storage.from("video-sources").getPublicUrl(storagePath).data.publicUrl
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}
