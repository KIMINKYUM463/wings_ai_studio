/** 짜집기 — 사용 가능한 소스 영상 없음 (클라이언트·서버 공용) */

export const AUTO_EDIT_NO_USABLE_VIDEO_MESSAGE =
  "쓸수있는 영상이 없습니다. 다시 선택해주세요"

export function isAutoEditNoUsableVideoError(message: string): boolean {
  const m = message.trim()
  if (!m) return false
  return (
    m.includes(AUTO_EDIT_NO_USABLE_VIDEO_MESSAGE) ||
    /쓸\s*수\s*있는\s*영상이\s*없/i.test(m)
  )
}
