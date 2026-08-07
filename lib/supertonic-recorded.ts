/** 학습용 녹음으로 등록한 Supertonic 커스텀 보이스 메타 */

export type RecordedSupertonicVoice = {
  id: string
  /** UI 두 글자 라벨 예: 내1 */
  label: string
  createdAt: string
}

export const RECORDED_VOICES_REL = "voices/supertonic/recorded.json"

/** 서버 voice id: n1, n2, … */
export function recordedVoiceId(index: number): string {
  return `n${Math.max(1, index)}`
}

/** 화면 표시: 내1, 내2, … */
export function recordedVoiceLabel(index: number): string {
  return `내${Math.max(1, index)}`
}

export function isRecordedVoiceId(id: string): boolean {
  const bare = id.replace(/^supertonic-/, "").trim()
  if (/^n\d{1,3}$/i.test(bare)) return true
  if (/^myvoice_/i.test(bare)) return true
  return false
}

export function parseRecordedIndex(id: string): number | null {
  const bare = id.replace(/^supertonic-/, "").trim()
  const m = /^n(\d{1,3})$/i.exec(bare)
  if (!m) return null
  return Number(m[1])
}
