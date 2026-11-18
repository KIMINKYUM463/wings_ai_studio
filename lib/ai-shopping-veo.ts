import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { GoogleGenAI } from "@google/genai"
import { geminiApiKey } from "@/lib/wings-shopping-v2/gemini-key"

/**
 * Google Veo 이미지→영상 (Google Flow 가 쓰는 것과 같은 Veo 모델, 공식 Gemini API).
 * 키에 Veo 권한이 있어야 하고, .env.local 에 VEO_MODEL(예: veo-3.1-fast-generate-preview)을 넣어야 켜진다.
 * Flow 화면을 자동으로 조작하는 비공식 API(봇 차단 우회)는 약관 위반·계정 정지 위험이 있어 쓰지 않는다.
 */
export const veoModelName = () => process.env.VEO_MODEL?.trim() || ""
export const veoReady = () => !!veoModelName() && !!geminiApiKey()

/** Veo 가 받는 길이(초)로 맞춘다: 4·6·8초 */
export function veoSeconds(seconds: number): number {
  return seconds <= 4.5 ? 4 : seconds <= 6.5 ? 6 : 8
}

export async function generateVeoFromImage(imageUrl: string, prompt: string, seconds: number): Promise<Buffer> {
  if (!veoReady()) {
    throw new Error(
      "Veo(공식 API)를 쓸 수 없어요. Gemini 키에 Veo 권한이 있어야 하고 .env.local 에 VEO_MODEL 을 넣어야 합니다. 그 전에는 'Flow에서 직접 만들기'로 만든 영상을 올려 주세요."
    )
  }
  const img = await fetch(imageUrl, { signal: AbortSignal.timeout(60_000) })
  if (!img.ok) throw new Error(`장면 이미지를 불러오지 못했어요 (HTTP ${img.status})`)
  const mimeType = (img.headers.get("content-type") || "image/png").split(";")[0]!.trim()
  const imageBytes = Buffer.from(await img.arrayBuffer()).toString("base64")

  const ai = new GoogleGenAI({ apiKey: geminiApiKey(), httpOptions: { apiVersion: "v1beta" } })
  let op = await ai.models.generateVideos({
    model: veoModelName(),
    prompt,
    image: { imageBytes, mimeType },
    config: { aspectRatio: "9:16", durationSeconds: veoSeconds(seconds), numberOfVideos: 1 },
  })
  // 보통 1~3분. 최대 6분 기다린다
  for (let i = 0; !op.done && i < 36; i++) {
    await new Promise((r) => setTimeout(r, 10_000))
    op = await ai.operations.getVideosOperation({ operation: op })
  }
  const video = op.response?.generatedVideos?.[0]?.video
  if (!op.done || !video) throw new Error("Veo 영상 생성이 끝나지 않았거나 결과가 없어요 (안전 필터에 걸렸을 수도 있어요)")
  const tmp = path.join(os.tmpdir(), `veo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.mp4`)
  try {
    await ai.files.download({ file: video, downloadPath: tmp })
    return await fs.readFile(tmp)
  } finally {
    await fs.rm(tmp, { force: true }).catch(() => {})
  }
}
