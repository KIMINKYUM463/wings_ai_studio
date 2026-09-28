import test from 'node:test'
import assert from 'node:assert/strict'

import { getProTemplate } from './catalog'
import {
  applyTemplateToDocument,
  createEmptyStudioDocument,
  resolveTemplateSlotTexts,
} from './document'

test('createEmptyStudioDocument — 템플릿 슬롯 수·샘플 문구 일치', () => {
  const doc = createEmptyStudioDocument('historical_hook_right')
  const tpl = getProTemplate('historical_hook_right')!
  assert.equal(doc.textLayers.length, tpl.textSlots.length)
  assert.equal(doc.textLayers[0]?.text, '첫번째 문장')
  assert.equal(doc.textLayers[1]?.fill, '#fde047')
  assert.equal(doc.textLayers[0]?.boxBackground, true)
})

test('applyTemplateToDocument — 2단→3단 템플릿 전환 시 슬롯 수·카탈로그 스타일', () => {
  let doc = createEmptyStudioDocument('cosmic_dual_bottom')
  doc = applyTemplateToDocument(doc, 'historical_hook_right')
  const tpl = getProTemplate('historical_hook_right')!
  assert.equal(doc.textLayers.length, tpl.textSlots.length)
  assert.equal(doc.textLayers[1]?.fill, '#fde047')
  assert.equal(doc.textLayers[2]?.fontSize, 92)
  assert.equal(doc.templateStyle?.layoutFromGeneratedBackground, false)
})

test('resolveTemplateSlotTexts — slotKey로 문구 이전 (인덱스 불일치)', () => {
  const from = getProTemplate('cosmic_dual_bottom')!
  const to = getProTemplate('historical_hook_right')!
  const texts = resolveTemplateSlotTexts(
    to,
    [{ text: '사용자 훅' }, { text: '사용자 강조' }],
    from,
  )
  assert.equal(texts.length, 3)
  assert.equal(texts[0], '사용자 훅')
  assert.equal(texts[1], '사용자 강조')
  assert.equal(texts[2], '사용자 강조')
})
