import assert from 'node:assert/strict'
import {
  DEFAULT_IMAGE_GRADIENT_MASK,
  normalizeImageGradientMask,
} from './imageGradientMask'

assert.deepEqual(normalizeImageGradientMask(undefined), DEFAULT_IMAGE_GRADIENT_MASK)
assert.equal(normalizeImageGradientMask({ enabled: true, type: 'radial', range: 120 }).range, 100)
assert.equal(normalizeImageGradientMask({ enabled: true, type: 'bogus' as 'rect', range: 63 }).type, 'rect')
assert.equal(normalizeImageGradientMask({ enabled: true, type: 'linear', range: 40 }).direction, 'right')
assert.equal(
  normalizeImageGradientMask({ enabled: true, type: 'rect', direction: 'left', range: 50 }).direction,
  'left',
)

console.log('imageGradientMask.test.ts OK')
