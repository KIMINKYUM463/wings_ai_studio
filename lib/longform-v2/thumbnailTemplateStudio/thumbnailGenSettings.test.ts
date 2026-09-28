import test from 'node:test'
import assert from 'node:assert/strict'

import {
  normalizeThumbnailGenSettings,
  thumbnailStyleApiPayload,
} from './thumbnailGenSettings'

test('normalizeThumbnailGenSettings — hq-stickman id restores NEW category', () => {
  const normalized = normalizeThumbnailGenSettings({
    imageModel: 'flux-schnell',
    styleCategory: '실사',
    styleTemplateId: 'hq-stickman',
  })
  assert.equal(normalized.styleCategory, 'NEW')
  assert.equal(normalized.styleTemplateId, 'hq-stickman')
})

test('thumbnailStyleApiPayload — includes NEW preset customStylePrompt', () => {
  const payload = thumbnailStyleApiPayload({
    imageModel: 'flux-schnell',
    styleCategory: 'NEW',
    styleTemplateId: 'hq-stickman',
    imagesLocaleMode: 'auto',
  })
  assert.equal(payload.thumbnailStyle, 'animation')
  assert.match(payload.customStylePrompt, /stick-figure/i)
  assert.match(payload.customStylePrompt, /Cyanide and Happiness/i)
})
