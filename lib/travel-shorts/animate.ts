/** 여행 사진 → 몇 초짜리 움직이는 클립 (Replicate Seedance, 브라우저 전용) */

import { generateVideoWithSeedance } from "@/app/WingsAIStudioShotForm/ai-shopping/actions"
import { photoToSmallDataUrl } from "@/lib/travel-shorts/render"
import { TRAVEL_PHOTO_ROLES, type TravelPhoto } from "@/lib/travel-shorts/types"

export const REPLICATE_KEY_MISSING = "Replicate API 키가 없습니다. 숏폼 홈 → 설정에서 입력해 주세요."

/** 이보다 짧게 만들면 장면 도중 클립이 끝나 멈춰 보임 */
const MIN_CLIP_SEC = 3
const MAX_CLIP_SEC = 10
const CONCURRENCY = 3

export function shotformReplicateKey(): string {
  if (typeof window === "undefined") return ""
  return (localStorage.getItem("shotform_replicate_api_key") || "").trim()
}

const travelMotionContract = (sec: number) => `IMAGE-TO-VIDEO MOTION RULES — HIGHEST PRIORITY:
Animate this exact travel / accommodation photo as a calm, real ${sec}-second camera recording.
Keep the composition, architecture, furniture, room layout and every object exactly where they are. Straight lines stay straight.
Do not add or remove people, objects, buildings, signs, text or logos.
Use only natural ambient motion the scene already implies: water ripples and pool reflections, waves, drifting clouds, swaying trees and plants, curtains moving in a soft breeze, flickering lights, steam from food or drinks.
For a still indoor room, use soft daylight shifting through the window.
No cuts, no morphing, no warping, photorealistic.`

export function clipSecondsFor(sceneSec: number): number {
  return Math.min(MAX_CLIP_SEC, Math.max(MIN_CLIP_SEC, Math.ceil(sceneSec)))
}

export async function animateTravelPhoto(photo: TravelPhoto, sceneSec: number): Promise<Blob> {
  const key = shotformReplicateKey()
  if (!key) throw new Error(REPLICATE_KEY_MISSING)
  const sec = clipSecondsFor(sceneSec)
  // Replicate는 작은 파일만 data URL로 받으므로 긴 변 960px로 줄여 보냄
  const image = await photoToSmallDataUrl(photo.blob, 960, 0.85)
  const subject = photo.note || TRAVEL_PHOTO_ROLES.find((r) => r.id === photo.role)?.hint || "travel scene"
  const url = await generateVideoWithSeedance(
    image,
    `${subject}. Gentle, natural ambient motion.`,
    sec,
    key,
    "seedance-1-pro-fast",
    travelMotionContract(sec)
  )
  // Replicate 결과 URL은 1시간 뒤 만료 → 받아서 프로젝트(IndexedDB)에 보관
  const res = await fetch(url)
  if (!res.ok) throw new Error(`생성된 영상을 받지 못했습니다. (${res.status})`)
  return res.blob()
}

/**
 * 클립이 없는 사진만 동시에 몇 장씩 영상화. 하나가 실패해도 나머지는 계속하고,
 * 끝난 사진마다 onDone으로 바로 저장해 중간에 멈춰도 결과가 남게 함
 */
export async function animateTravelPhotos(
  photos: TravelPhoto[],
  sceneSecById: Map<string, number>,
  onDone: (photoId: string, video: Blob) => void
): Promise<{ done: number; failed: string[] }> {
  const queue = photos.filter((p) => !p.video)
  const failed: string[] = []
  let done = 0
  const worker = async () => {
    for (let photo = queue.shift(); photo; photo = queue.shift()) {
      try {
        onDone(photo.id, await animateTravelPhoto(photo, sceneSecById.get(photo.id) ?? 4))
        done += 1
      } catch (e) {
        failed.push(e instanceof Error ? e.message : String(e))
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return { done, failed }
}
