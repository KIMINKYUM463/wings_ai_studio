/** 추가 영상 팝업 → 타임라인 HTML5 드래그 페이로드 (blob은 drop 시 resolve) */

export const MVP_INSERT_CLIP_MIME = "application/x-mvp-insert-clip"

export type MvpInsertClipDragPayload = {
  label: string
  trimStartSec: number
  durationSec: number
  resolveBlob: () => Promise<Blob>
}

let activeDrag: MvpInsertClipDragPayload | null = null

export function armMvpInsertClipDrag(payload: MvpInsertClipDragPayload): void {
  activeDrag = payload
}

export function peekMvpInsertClipDrag(): MvpInsertClipDragPayload | null {
  return activeDrag
}

export function clearMvpInsertClipDrag(): void {
  activeDrag = null
}

export function isMvpInsertClipDragEvent(dt: DataTransfer | null | undefined): boolean {
  if (!dt) return false
  if (activeDrag) return true
  const types = Array.from(dt.types || [])
  return types.includes(MVP_INSERT_CLIP_MIME)
}
