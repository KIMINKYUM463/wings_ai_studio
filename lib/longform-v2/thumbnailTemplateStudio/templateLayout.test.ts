import test from 'node:test'
import assert from 'node:assert/strict'

import { getProTemplate } from './catalog'
import { resolveTopicBackgroundPrompt } from './templateLayout'

test('cosmic template background prompt does not force space scenery', () => {
  const tpl = getProTemplate('cosmic_dual_bottom')
  assert.ok(tpl)
  const prompt = resolveTopicBackgroundPrompt(tpl!, {
    topic: '조선시대 왕의 마지막 선택',
    scriptExcerpt: '세종대왕이 남긴 유언과 궁궐의 밤',
    hookCopyLines: ['왕이 숨긴', '마지막 유서'],
    titleHint: '조선 왕실의 비밀',
  })
  assert.doesNotMatch(prompt, /Epic space scene/i)
  assert.doesNotMatch(prompt, /galaxies, nebulae/i)
  assert.match(prompt, /ignore template visual theme/i)
  assert.match(prompt, /조선/i)
  assert.match(prompt, /왕이 숨긴/)
})

test('layout prompt keeps text zone without thematic subject', () => {
  const tpl = getProTemplate('historical_hook_right')
  assert.ok(tpl)
  const prompt = resolveTopicBackgroundPrompt(tpl!, {
    topic: 'NASA 화성 탐사',
    scriptExcerpt: '로버가 찍은 첫 번째 균열',
  })
  assert.match(prompt, /TEXT overlay safe zone/i)
  assert.doesNotMatch(prompt, /Do NOT copy template preview actors/i)
})
