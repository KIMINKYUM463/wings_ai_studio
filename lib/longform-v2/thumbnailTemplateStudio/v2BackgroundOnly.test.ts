import { describe, expect, it } from 'vitest'

import { applyV2TemplateDocument } from './v2BackgroundOnly'
import type { ThumbnailStudioDocument } from './types'

const baseDoc = (): ThumbnailStudioDocument => ({
  version: 1,
  templateId: 'tpl-1',
  background: { source: 'gradient', imageDataUrl: null },
  textLayers: [
    {
      id: 't1',
      kind: 'text',
      text: '이게 착각?',
      x: 10,
      y: 10,
      fontSize: 48,
      fontFamily: 'sans-serif',
      fill: '#fff',
      stroke: '#000',
      strokeWidth: 2,
      textAlign: 'left',
      zIndex: 1,
      visible: true,
    },
  ],
  imageLayers: [],
  shapeLayers: [],
})

describe('applyV2TemplateDocument', () => {
  it('shows populated text layers', () => {
    const doc = applyV2TemplateDocument(baseDoc())
    expect(doc.textLayers.every((t) => t.visible === true)).toBe(true)
    expect(doc.textLayers[0]?.text).toBe('이게 착각?')
  })
})
