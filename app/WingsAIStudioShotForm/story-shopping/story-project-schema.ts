import { z } from "zod"
import type { ShoppingProjectData } from "./project-actions"

export const STORY_PROJECT_SCHEMA_VERSION = 2

const projectDataSchema = z
  .object({
    schemaVersion: z.number().int().nonnegative().optional(),
    appVariant: z.literal("story").optional(),
    activeStep: z.string().optional(),
    storyBrief: z.record(z.unknown()).optional(),
    storyBlueprint: z.record(z.unknown()).optional(),
    youtubeTags: z.array(z.string()).optional(),
    imageUrls: z.array(z.string()).optional(),
    convertedVideoUrls: z
      .array(z.object({ index: z.number(), videoUrl: z.string() }))
      .optional(),
  })
  .passthrough()

/** 오래된 JSONB 프로젝트를 안전한 최신 형태로 읽습니다. 알 수 없는 필드는 보존합니다. */
export function migrateStoryProjectData(raw: unknown): ShoppingProjectData {
  const parsed = projectDataSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error("프로젝트 데이터 형식이 손상되었습니다.")
  }
  const data = parsed.data as ShoppingProjectData
  return {
    ...data,
    schemaVersion: STORY_PROJECT_SCHEMA_VERSION,
    appVariant: "story",
    youtubeTags: Array.isArray(data.youtubeTags) ? data.youtubeTags : [],
    imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
    convertedVideoUrls: Array.isArray(data.convertedVideoUrls)
      ? data.convertedVideoUrls
      : [],
  }
}
