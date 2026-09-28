/**
 * 버전 2 썸네일 템플릿 스튜디오 — v1 generate 래퍼 (studioVersion: v2)
 * v1은 `../generate` 를 그대로 사용합니다.
 */
import { THUMBNAIL_STUDIO_VERSION_V2 } from '@/lib/longform-v2/youtube/thumbnailStudioVersion'
import type { GenerateStudioLayersOpts, GenerateStudioLayersResult } from '../generate'
import * as gen from '../generate'

export type { GenerateStudioLayersOpts, GenerateStudioLayersResult }
export { THUMBNAIL_STUDIO_VERSION_V2 }

function withV2<T extends GenerateStudioLayersOpts>(opts: T): T {
  return { ...opts, studioVersion: THUMBNAIL_STUDIO_VERSION_V2 }
}

export function generateStudioLayersFromTemplate(
  opts: GenerateStudioLayersOpts,
): Promise<GenerateStudioLayersResult> {
  return gen.generateStudioLayersFromTemplate(withV2(opts))
}

export function generateStudioOnTemplateSelect(
  opts: GenerateStudioLayersOpts,
): Promise<GenerateStudioLayersResult> {
  return gen.generateStudioOnTemplateSelect(withV2(opts))
}

export function regenerateStudioBackgroundOnly(
  opts: GenerateStudioLayersOpts,
): Promise<GenerateStudioLayersResult> {
  return gen.regenerateStudioBackgroundOnly(withV2(opts))
}

export function regenerateStudioTextOnly(
  opts: Parameters<typeof gen.regenerateStudioTextOnly>[0],
): ReturnType<typeof gen.regenerateStudioTextOnly> {
  return gen.regenerateStudioTextOnly(opts)
}

export function applyStudioTabOutputLanguage(
  opts: Parameters<typeof gen.applyStudioTabOutputLanguage>[0],
): ReturnType<typeof gen.applyStudioTabOutputLanguage> {
  return gen.applyStudioTabOutputLanguage(opts)
}
