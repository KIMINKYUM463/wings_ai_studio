import test from 'node:test'
import assert from 'node:assert/strict'

import { MAIN_COPY_LINE2_VIRTUAL_KEY } from '@/lib/longform-v2/youtube/thumbnailCopyCombos'
import {
  applyCopyComboToDocument,
  applyTemplateToDocument,
  createEmptyStudioDocument,
  resolveTwoLineCopySlotSpec,
} from './document'

test('resolveTwoLineCopySlotSpec — 3단 템플릿은 highlight + main_title', () => {
  let doc = createEmptyStudioDocument('historical_hook_right')
  doc = applyTemplateToDocument(doc, 'historical_hook_right')
  const spec = resolveTwoLineCopySlotSpec(doc)
  assert.ok(spec)
  assert.equal(spec!.line1Key, 'highlight')
  assert.equal(spec!.line2Key, 'main_title')
})

test('resolveTwoLineCopySlotSpec — 상단 hook + 하단 2줄은 highlight + main_title', () => {
  let doc = createEmptyStudioDocument('astronaut_sparks_right')
  doc = applyTemplateToDocument(doc, 'astronaut_sparks_right')
  const spec = resolveTwoLineCopySlotSpec(doc)
  assert.ok(spec)
  assert.equal(spec!.line1Key, 'highlight')
  assert.equal(spec!.line2Key, 'main_title')
})

test('resolveTwoLineCopySlotSpec — 메인 1줄 템플릿은 2줄째 레이어 추가 키', () => {
  let doc = createEmptyStudioDocument('classical_red_frame_left')
  doc = applyTemplateToDocument(doc, 'classical_red_frame_left')
  const spec = resolveTwoLineCopySlotSpec(doc)
  assert.ok(spec)
  assert.equal(spec!.line1Key, 'main_title')
  assert.equal(spec!.line2Key, MAIN_COPY_LINE2_VIRTUAL_KEY)
})

test('applyCopyComboToDocument — 1줄 메인 템플릿에 2줄째 텍스트 레이어 추가', () => {
  let doc = createEmptyStudioDocument('classical_red_frame_left')
  doc = applyTemplateToDocument(doc, 'classical_red_frame_left')
  const next = applyCopyComboToDocument(doc, {
    id: 'c1',
    line1: '우리가 속았다?',
    line2: '아인슈타인의 진실',
  })
  assert.equal(next.textLayers.length, 2)
  assert.match(next.textLayers[0]?.text ?? '', /우리가 속았다/)
  assert.match(next.textLayers[1]?.text ?? '', /아인슈타인/)
})

test('applyCopyComboToDocument — 3단 템플릿 하단 2줄 문구·색상 적용', () => {
  let doc = createEmptyStudioDocument('historical_hook_right')
  doc = applyTemplateToDocument(doc, 'historical_hook_right')
  doc.textLayers[1] = { ...doc.textLayers[1]!, text: '300년 우주 거짓말' }
  doc.textLayers[2] = { ...doc.textLayers[2]!, text: '시공간의 충격' }
  const next = applyCopyComboToDocument(doc, {
    id: 'c1',
    line1: '아인슈타인이 푼',
    line2: '시공간의 충격',
  })
  assert.match(next.textLayers[1]?.text ?? '', /아인슈타인/)
  assert.match(next.textLayers[2]?.text ?? '', /시공간/)
  assert.equal(next.textLayers[1]?.fill, '#ffffff')
  assert.equal(next.textLayers[2]?.fill, '#fde047')
  assert.equal(next.textLayers[1]?.fontSize, doc.textLayers[1]?.fontSize)
  assert.equal(next.textLayers[2]?.fontSize, doc.textLayers[2]?.fontSize)
})

test('applyCopyComboToDocument — sub 슬롯 문구는 유지', () => {
  let doc = createEmptyStudioDocument('battle_news_bottom_center')
  doc = applyTemplateToDocument(doc, 'battle_news_bottom_center')
  const subBefore = doc.textLayers.find((_, i) => i === 1)?.text ?? ''
  const next = applyCopyComboToDocument(doc, {
    id: 'c1',
    line1: '첫 메인 줄',
    line2: '둘째 메인 줄',
  })
  const subAfter = next.textLayers[1]?.text ?? ''
  assert.equal(subBefore, subAfter)
  assert.match(next.textLayers.find((t) => t.text.includes('첫 메인'))?.text ?? '', /첫 메인/)
})
