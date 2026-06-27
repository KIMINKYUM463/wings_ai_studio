import { MVP_THUMBNAIL_INTRO_SEC } from "@/lib/mvp-thumbnail-intro"

export type PrependMvpThumbnailIntroClientInput = {
  mainMp4: Blob
  thumbBytes: Uint8Array
  introSec?: number
  mainDurationSec: number
  onProgress?: (ratio: number) => void
}

const PREPEND_FETCH_TIMEOUT_MS = 10 * 60 * 1000

function wrapPrependFetchError(e: unknown): Error {
  if (e instanceof DOMException && e.name === "TimeoutError") {
    return new Error(
      "썸네일 합성 시간이 초과되었습니다. 영상을 짧게 하거나 「썸네일 맨 앞 표시」를 끄고 다시 시도해 주세요."
    )
  }
  if (e instanceof TypeError && /failed to fetch/i.test(e.message)) {
    return new Error(
      "썸네일 합성 서버에 연결하지 못했습니다. dev 서버가 실행 중인지 확인한 뒤 다시 시도해 주세요. (Failed to fetch)"
    )
  }
  if (e instanceof Error) return e
  return new Error("썸네일 합성 요청 실패")
}

/** 브라우저 ffmpeg.wasm 대신 서버 API로 0.01초 썸네일 인트로 합성 */
export async function prependMvpThumbnailIntroViaApi(
  input: PrependMvpThumbnailIntroClientInput
): Promise<Blob> {
  const introSec = input.introSec ?? MVP_THUMBNAIL_INTRO_SEC
  input.onProgress?.(0.1)

  const fd = new FormData()
  fd.append("video", input.mainMp4, "render.mp4")
  fd.append("thumbnail", new Blob([input.thumbBytes], { type: "image/png" }), "thumb.png")
  fd.append("introSec", String(introSec))
  fd.append("durationSec", String(input.mainDurationSec))

  let res: Response
  try {
    res = await fetch("/api/shotform/mvp-prepend-thumbnail", {
      method: "POST",
      body: fd,
      signal: AbortSignal.timeout(PREPEND_FETCH_TIMEOUT_MS),
    })
  } catch (e) {
    throw wrapPrependFetchError(e)
  }

  input.onProgress?.(0.9)

  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(json.error || `썸네일 합성 실패 (${res.status})`)
  }

  let blob: Blob
  try {
    blob = await res.blob()
  } catch (e) {
    throw wrapPrependFetchError(e)
  }

  if (blob.size < 4096) {
    throw new Error("썸네일 합성 결과 MP4가 비어 있습니다.")
  }
  return blob
}
