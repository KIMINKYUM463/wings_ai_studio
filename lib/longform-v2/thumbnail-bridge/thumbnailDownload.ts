/**
 * 원격 썸네일 URL → 다운로드용 작은 JPEG (긴 변 기준 축소 + JPEG 품질).
 * Blob URL로 디코드해 캔버스 CORS 이슈를 피합니다.
 */
export async function buildMinimalJpegBlobFromImageUrl(
  imageUrl: string,
  opts?: { maxEdge?: number; quality?: number },
): Promise<Blob> {
  const maxEdge = opts?.maxEdge ?? 1280
  const quality = opts?.quality ?? 0.66

  const r = await fetch(imageUrl)
  if (!r.ok) throw new Error(`이미지를 불러오지 못했습니다 (${r.status})`)
  const blob = await r.blob()
  const obj = URL.createObjectURL(blob)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('이미지 디코딩 실패'))
      img.src = obj
    })
    const w = img.naturalWidth
    const h = img.naturalHeight
    if (!w || !h) throw new Error('이미지 크기 없음')
    const scale = Math.min(1, maxEdge / Math.max(w, h))
    const cw = Math.max(1, Math.round(w * scale))
    const ch = Math.max(1, Math.round(h * scale))
    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 2d 미지원')
    ctx.drawImage(img, 0, 0, cw, ch)
    const out = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('JPEG 변환 실패'))),
        'image/jpeg',
        quality,
      )
    })
    return out
  } finally {
    URL.revokeObjectURL(obj)
  }
}

export type FactoryThumbnailDownloadItem = {
  label: string
  templateId?: string
  dataUrl: string
}

/** data URL·HTTP URL 그대로 fetch — 캔버스 재인코딩 없음(스튜디오 내보내기 픽셀 유지) */
export async function blobFromImageSource(urlOrDataUrl: string): Promise<Blob> {
  const r = await fetch(urlOrDataUrl)
  if (!r.ok) throw new Error(`이미지를 불러오지 못했습니다 (${r.status})`)
  const blob = await r.blob()
  if (blob.size === 0) throw new Error('이미지 데이터가 비어 있습니다.')
  return blob
}

function slugForDownloadFilename(s: string): string {
  return s.replace(/[/\\?%*:|"<>]/g, '_').slice(0, 48)
}

export type StudioTabDownloadItem = {
  label: string
  blob: Blob
}

/** 썸네일 편집기 — 열린 탭마다 JPEG 파일로 PC 저장 */
export async function downloadStudioTabBlobs(
  items: StudioTabDownloadItem[],
  safeBaseName: string,
): Promise<{ saved: number; lastResult: TriggerBlobDownloadResult | null; cancelled: boolean }> {
  const base = safeBaseName.trim() || 'thumbnail'
  let saved = 0
  let lastResult: TriggerBlobDownloadResult | null = null
  for (let i = 0; i < items.length; i++) {
    const t = items[i]!
    const slug = slugForDownloadFilename(t.label.trim() || `tab_${i + 1}`)
    const filename =
      items.length <= 1
        ? `${base}_template_studio.jpg`
        : `${base}_${String(i + 1).padStart(2, '0')}_${slug}.jpg`
    const result = await triggerBlobDownload(t.blob, filename)
    lastResult = result
    if (result.cancelled) return { saved, lastResult, cancelled: true }
    saved++
  }
  return { saved, lastResult, cancelled: false }
}

/** 자동화·스튜디오에서 생성한 썸네일 data URL을 그대로 PC에 저장 */
export async function downloadFactoryThumbnailItems(
  items: FactoryThumbnailDownloadItem[],
  safeBaseName: string,
): Promise<number> {
  const base = safeBaseName.trim() || 'thumbnail'
  let saved = 0
  for (let i = 0; i < items.length; i++) {
    const t = items[i]!
    const blob = await blobFromImageSource(t.dataUrl)
    const slug = t.templateId ? slugForDownloadFilename(t.templateId) : ''
    const filename =
      items.length <= 1
        ? `${base}-thumbnail.jpg`
        : i === 0
          ? `${base}-thumbnail.jpg`
          : `${base}-thumbnail-${i + 1}${slug ? `-${slug}` : ''}.jpg`
    await triggerBlobDownload(blob, filename)
    saved++
  }
  return saved
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const s = r.result as string
      const comma = s.indexOf(',')
      resolve(comma >= 0 ? s.slice(comma + 1) : s)
    }
    r.onerror = () => reject(new Error('파일 인코딩 실패'))
    r.readAsDataURL(blob)
  })
}

export type TriggerBlobDownloadResult = {
  mode: 'desktop' | 'browser'
  filename: string
  /** 설치형 `save_binary_file` 성공 시 절대 경로 */
  savedPath?: string
  cancelled?: boolean
}

/** JPEG/MP4 PC 저장 후 안내 문구 */
export function formatBlobDownloadSavedMessage(r: TriggerBlobDownloadResult): string {
  if (r.cancelled) return '저장을 취소했습니다.'
  if (r.savedPath) return `PC에 저장했습니다: ${r.savedPath}`
  return `「${r.filename}」을 브라우저 다운로드 폴더(보통 PC의「다운로드」)에 저장했습니다.`
}

/**
 * 브라우저: `<a download>` + Blob URL.
 * 설치형: `pywebview.api.save_binary_file` — **다른 이름 저장 대화상자 없이**
 * 사용자 `Downloads`/`다운로드`(또는 data/exports/quick-save)에 자동 기록.
 */
export type TriggerBlobDownloadOptions = {
  /** 설치형: 다운로드 폴더 아래 하위 폴더 (예: `롱폼`, `숏폼`) */
  subdir?: string
}

export async function triggerBlobDownload(
  blob: Blob,
  filename: string,
  opts?: TriggerBlobDownloadOptions,
): Promise<TriggerBlobDownloadResult> {
  const safeName = filename.trim() || 'download.bin'
  const subdir = opts?.subdir?.trim() ?? ''
  if (blob.size === 0) {
    throw new Error(
      '저장할 데이터가 비어 있습니다. 원본 파일이 0바이트이거나 네트워크로 받지 못했을 수 있습니다.',
    )
  }
  const api = typeof window !== 'undefined' ? window.pywebview?.api : undefined
  if (api?.save_binary_file) {
    const b64 = await blobToBase64(blob)
    const res = await api.save_binary_file(safeName, b64, subdir)
    if (res?.cancelled) {
      return { mode: 'desktop', filename: safeName, cancelled: true }
    }
    if (res?.ok) {
      const savedPath = typeof res.path === 'string' ? res.path.trim() : undefined
      return { mode: 'desktop', filename: safeName, savedPath: savedPath || undefined }
    }
    throw new Error(res?.error ?? '저장에 실패했습니다.')
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = safeName
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2500)
  return { mode: 'browser', filename: safeName }
}
