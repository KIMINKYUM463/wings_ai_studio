import assert from 'node:assert/strict'
import {
  applyCommittedImageCrop,
  cropToCanvasBounds,
  fullImageCanvasBounds,
  fullImageCrop,
  resizeSourceCropOnCanvas,
} from './imageLayerCrop'

const layer = { id: 'a', x: 100, y: 80, width: 400, height: 300, opacity: 1, zIndex: 1, visible: true, kind: 'image' as const, name: 't' }
const crop = fullImageCrop(800, 600)
const fullCanvas = fullImageCanvasBounds(layer, crop, 800, 600)
const cropCanvas = cropToCanvasBounds(fullCanvas, crop, 800, 600)

const shrunk = resizeSourceCropOnCanvas(cropCanvas, fullCanvas, 'se', cropCanvas.x + 350, cropCanvas.y + 230, 800, 600)
assert.ok(shrunk.width < crop.width)
assert.ok(shrunk.height < crop.height)

const applied = applyCommittedImageCrop(layer, crop, shrunk, 800, 600)
assert.ok(applied.width && applied.width < layer.width)
assert.ok(applied.crop)

console.log('imageLayerCrop.test.ts OK')
