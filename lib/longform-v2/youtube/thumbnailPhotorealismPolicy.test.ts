import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isThumbnailPhotorealisticStyle,
  isThumbnailStickmanStyle,
} from '../../shared/thumbnailPhotorealismPolicy'

test('isThumbnailPhotorealisticStyle — 실사 only', () => {
  assert.equal(isThumbnailPhotorealisticStyle('실사', 'cinematic'), true)
  assert.equal(isThumbnailPhotorealisticStyle('NEW', 'hq-stickman'), false)
  assert.equal(isThumbnailPhotorealisticStyle('정보성 캐릭터', 'stickman'), false)
})

test('isThumbnailStickmanStyle — NEW hq-stickman and 정보성 stickman', () => {
  assert.equal(isThumbnailStickmanStyle('NEW', 'hq-stickman'), true)
  assert.equal(isThumbnailStickmanStyle('정보성 캐릭터', 'stickman'), true)
  assert.equal(isThumbnailStickmanStyle('실사', 'cinematic'), false)
})
