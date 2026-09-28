import { describe, expect, it } from 'vitest'
import {
  isPrebuiltStudioBackgroundPrompt,
  sanitizeStudioBackgroundPromptForImageModel,
  sanitizeThumbnailImagePromptEn,
} from './thumbnailBackgroundImagePrompt'

describe('sanitizeThumbnailImagePromptEn', () => {
  it('removes Hangul from image prompts', () => {
    expect(sanitizeThumbnailImagePromptEn('Ancient ruins, 충격의 진실, dramatic sky')).toBe(
      'Ancient ruins, dramatic sky',
    )
  })
})

describe('sanitizeStudioBackgroundPromptForImageModel', () => {
  it('strips Korean script body and hook copy from prebuilt prompts', () => {
    const raw = [
      'YOUTUBE BACKGROUND LAYOUT SPEC',
      '=== VIDEO SCRIPT & TOPIC ===',
      'Script excerpt (Korean — topic reference ONLY):',
      '밤하늘에 숨겨진 우주의 진짜 얼굴',
      'On-thumbnail copy (scene must match this story):',
      '- 이게 착각?',
      'PHOTOREALISM (mandatory):',
    ].join('\n')
    const out = sanitizeStudioBackgroundPromptForImageModel(raw)
    expect(out).not.toMatch(/[\uAC00-\uD7A3]/)
    expect(out).not.toContain('이게 착각')
    expect(out).toContain('PHOTOREALISM')
  })
})

describe('isPrebuiltStudioBackgroundPrompt', () => {
  it('detects studio-assembled background prompts', () => {
    const prompt = [
      'YOUTUBE BACKGROUND LAYOUT SPEC (internal instructions):',
      '=== VIDEO SCRIPT & TOPIC ===',
    ].join('\n')
    expect(isPrebuiltStudioBackgroundPrompt(prompt)).toBe(true)
  })

  it('returns false for short topic strings', () => {
    expect(isPrebuiltStudioBackgroundPrompt('space documentary')).toBe(false)
  })
})
