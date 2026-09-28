import { describe, expect, it } from 'vitest'
import {
  isThumbnailCapacityRateLimitError,
  thumbnailCapacityBackoffMs,
} from './thumbnailCapacityRetry'

describe('isThumbnailCapacityRateLimitError', () => {
  it('detects Replicate ModelRateLimitError E003', () => {
    expect(
      isThumbnailCapacityRateLimitError(
        'Prediction failed: Async prediction failed: ModelRateLimitError: Service is currently unavailable due to high demand. (E003)',
      ),
    ).toBe(true)
  })

  it('detects HTTP 429', () => {
    expect(isThumbnailCapacityRateLimitError('예측 생성 실패 (429)')).toBe(true)
  })

  it('does not treat sensitive filter as capacity', () => {
    expect(isThumbnailCapacityRateLimitError('flagged as sensitive (E005)')).toBe(false)
  })
})

describe('thumbnailCapacityBackoffMs', () => {
  it('grows then caps at 90s', () => {
    expect(thumbnailCapacityBackoffMs(0)).toBe(8000)
    expect(thumbnailCapacityBackoffMs(20)).toBe(90_000)
  })
})
