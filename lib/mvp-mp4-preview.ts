/** 브라우저 미리보기용 MP4 유효성 검사 */

const MIN_PREVIEW_MP4_BYTES = 50_000

/** 파일 앞 8바이트 이상 — `ftyp` 박스 시그니처 (오프셋 4) */
export function isLikelyMp4Header(buf: ArrayBuffer | Uint8Array): boolean {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  if (u8.length < 8) return false
  const sig = String.fromCharCode(u8[4]!, u8[5]!, u8[6]!, u8[7]!)
  return sig === "ftyp"
}

/** 전체 버퍼 — 서버·업로드 검증용 */
export function isLikelyMp4Buffer(buf: ArrayBuffer | Uint8Array): boolean {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  if (u8.length < MIN_PREVIEW_MP4_BYTES) return false
  return isLikelyMp4Header(u8)
}

export async function assertPreviewMp4Blob(blob: Blob): Promise<void> {
  if (blob.size < MIN_PREVIEW_MP4_BYTES) {
    throw new Error("MP4 파일이 비어 있거나 너무 작습니다.")
  }
  const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer())
  if (!isLikelyMp4Header(head)) {
    throw new Error("유효한 MP4가 아닙니다. 짜집기를 다시 실행해 주세요.")
  }
}

export async function probeVideoElementPlayable(url: string, timeoutMs = 12_000): Promise<number> {
  if (typeof document === "undefined") return 0
  return new Promise((resolve, reject) => {
    const video = document.createElement("video")
    video.preload = "metadata"
    video.muted = true
    video.playsInline = true
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error("영상 메타데이터를 읽지 못했습니다. 코덱·파일을 확인해 주세요."))
    }, timeoutMs)
    const cleanup = () => {
      clearTimeout(timer)
      video.removeAttribute("src")
      video.load()
    }
    video.onloadedmetadata = () => {
      const d = video.duration
      cleanup()
      if (Number.isFinite(d) && d > 0.2) resolve(d)
      else reject(new Error("영상 길이를 확인할 수 없습니다."))
    }
    video.onerror = () => {
      cleanup()
      reject(new Error("브라우저에서 영상을 재생할 수 없습니다. 짜집기를 다시 실행해 주세요."))
    }
    video.src = url
  })
}
