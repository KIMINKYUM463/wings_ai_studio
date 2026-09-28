/** AI 썸네일 요소 스티커 — Gemini(nanobanana) + 흰 배경 누끼 */
export const ELEMENT_STICKER_STYLE =
  'YouTube thumbnail cutout sticker, bold 3D clip-art, vibrant saturated colors, thick clean outline, single object only, centered on pure solid white background, no text, no letters, no watermark, no scenery, no collage'

export function buildElementStickerPrompt(stickerSubject: string): string {
  const subject = stickerSubject.trim() || 'decorative icon'
  return `${subject}, ${ELEMENT_STICKER_STYLE}`
}

export type ElementStickerCacheMeta = {
  presetId: string
  width: number
  height: number
  generatedAt: number
}
