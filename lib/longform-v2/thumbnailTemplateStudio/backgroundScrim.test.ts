import assert from 'node:assert/strict'
import {
  DEFAULT_BACKGROUND_SCRIM,
  buildScrimPreviewCss,
  normalizeBackgroundScrim,
} from './backgroundScrim'

assert.deepEqual(normalizeBackgroundScrim(null), DEFAULT_BACKGROUND_SCRIM)

assert.deepEqual(normalizeBackgroundScrim({ enabled: true, opacity: 0.5 }), {
  enabled: true,
  direction: 'bottom-up',
  opacity: 0.5,
  extent: 0.8,
  feather: 0.28,
  midpoint: 0.35,
  color: '#000000',
})

assert.equal(normalizeBackgroundScrim({ opacity: 0.02 }).opacity, 0.05)
assert.equal(normalizeBackgroundScrim({ opacity: 0.99 }).opacity, 0.95)
assert.equal(normalizeBackgroundScrim({ extent: 0.05 }).extent, 0.15)
assert.equal(normalizeBackgroundScrim({ extent: 1.5 }).extent, 1)
assert.equal(normalizeBackgroundScrim({ feather: 0.01 }).feather, 0.05)
assert.equal(normalizeBackgroundScrim({ direction: 'top-down' }).direction, 'top-down')
assert.equal(normalizeBackgroundScrim({ direction: 'vignette' }).direction, 'vignette')
assert.equal(normalizeBackgroundScrim({ color: '#ff0000' }).color, '#ff0000')
assert.equal(normalizeBackgroundScrim({ midpoint: 0.02 }).midpoint, 0.05)

assert.match(buildScrimPreviewCss({ ...DEFAULT_BACKGROUND_SCRIM, enabled: true }), /linear-gradient|radial-gradient/)
assert.equal(buildScrimPreviewCss({ ...DEFAULT_BACKGROUND_SCRIM, enabled: false }), '#64748b')

console.log('backgroundScrim.test.ts: ok')
