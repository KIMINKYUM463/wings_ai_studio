import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyExternalizedAssetsFromSaveResponse,
  duplicateStudioTabLabelForLanguage,
  mergeTabScopedAssetsFromServer,
  promoteSaveResponseIntoDocument,
} from './studioTabsSession'
import type { ThumbnailStudioTab } from './studioTabsTypes'
import { createEmptyStudioDocument } from './document'
import { DEFAULT_PRO_TEMPLATE_ID } from './catalog'

function tab(id: string, bg: string): ThumbnailStudioTab {
  const document = createEmptyStudioDocument(DEFAULT_PRO_TEMPLATE_ID)
  document.background.imageDataUrl = bg
  return { id, label: 'test', document }
}

test('mergeTabScopedAssetsFromServer does not replace fresh inline AI background with stale server URL', () => {
  const local = [tab('a', 'data:image/png;base64,NEW')]
  const server = [tab('a', '/data/projects/p1/thumbnail-studio/tabs/bg-a.jpg')]
  const merged = mergeTabScopedAssetsFromServer(local, server)
  assert.equal(merged[0]!.document.background.imageDataUrl, 'data:image/png;base64,NEW')
})

test('applyExternalizedAssetsFromSaveResponse promotes inline background after save', () => {
  const local = [tab('a', 'data:image/png;base64,NEW')]
  const server = [tab('a', '/data/projects/p1/thumbnail-studio/tabs/bg-a.jpg')]
  const merged = applyExternalizedAssetsFromSaveResponse(local, server)
  assert.equal(
    merged[0]!.document.background.imageDataUrl,
    '/data/projects/p1/thumbnail-studio/tabs/bg-a.jpg',
  )
})

test('applyExternalizedAssetsFromSaveResponse does not resurrect cleared background', () => {
  const local = [tab('a', '')]
  local[0]!.document.background.imageDataUrl = null
  const server = [tab('a', '/data/projects/p1/thumbnail-studio/tabs/bg-a.jpg')]
  const merged = applyExternalizedAssetsFromSaveResponse(local, server)
  assert.equal(merged[0]!.document.background.imageDataUrl, null)
})

test('promoteSaveResponseIntoDocument does not restore deleted background from stale save', () => {
  const live = createEmptyStudioDocument(DEFAULT_PRO_TEMPLATE_ID)
  live.background.imageDataUrl = null
  const saved = createEmptyStudioDocument(DEFAULT_PRO_TEMPLATE_ID)
  saved.background.imageDataUrl = '/data/projects/p1/thumbnail-studio/tabs/bg-a.jpg'
  const next = promoteSaveResponseIntoDocument(live, saved)
  assert.equal(next.background.imageDataUrl, null)
})

test('duplicateStudioTabLabelForLanguage avoids label collisions', () => {
  const labels = ['썸네일 1', '썸네일 1 · 일본어']
  assert.equal(duplicateStudioTabLabelForLanguage('썸네일 1', '일본어', labels), '썸네일 1 · 일본어 2')
})
