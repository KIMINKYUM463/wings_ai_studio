/** API 전송 전 프레임 축소 — 502/타임아웃 방지 */

export async function compressMosaicFrameForApi(
  imageBase64: string,
  options?: { maxWidth?: number; quality?: number }
): Promise<string> {
  const maxWidth = options?.maxWidth ?? 512
  const quality = options?.quality ?? 0.72

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width)
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("캔버스를 사용할 수 없습니다."))
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      const dataUrl = canvas.toDataURL("image/jpeg", quality)
      const i = dataUrl.indexOf(",")
      resolve(i >= 0 ? dataUrl.slice(i + 1) : dataUrl)
    }
    img.onerror = () => reject(new Error("프레임 압축 실패"))
    const src = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`
    img.src = src
  })
}

export async function compressMosaicFramesForApi(
  frames: { timeSec: number; imageBase64: string }[],
  options?: { maxWidth?: number; quality?: number }
): Promise<{ timeSec: number; imageBase64: string }[]> {
  const out: { timeSec: number; imageBase64: string }[] = []
  for (const f of frames) {
    out.push({
      timeSec: f.timeSec,
      imageBase64: await compressMosaicFrameForApi(f.imageBase64, options),
    })
  }
  return out
}

export function isRetryableMosaicApiError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return false
  const msg = err instanceof Error ? err.message : String(err)
  return (
    /\(502\)|\(503\)|\(504\)|\(524\)|502|503|504|524|gateway|timeout|ECONNRESET|fetch failed/i.test(
      msg
    )
  )
}

export function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
