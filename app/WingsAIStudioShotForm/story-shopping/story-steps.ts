/** 스토리 쇼핑 활성 스텝 (클라이언트·서버 공용, server action 아님) */
export type StoryActiveStep =
  | "content"
  | "product"
  | "story"
  | "voice"
  | "template"
  | "edit"
  // legacy
  | "assets"
  | "brief"
  | "blueprint"
  | "frames"
  | "review"
  | "script"
  | "storyboard"
  | "media"
  | "preview"
  | "video"
  | "render"
  | "thumbnail"

export type StoryLiveActiveStep =
  | "content"
  | "product"
  | "story"
  | "voice"
  | "template"
  | "edit"

/** 구 activeStep → 스토리 파이프라인 키 마이그레이션 */
export function migrateStoryActiveStep(step: string | undefined): StoryLiveActiveStep {
  switch (step) {
    case "content":
    case "product":
    case "story":
    case "voice":
    case "template":
    case "edit":
      return step
    case "brief":
    case "blueprint":
    case "script":
    case "storyboard":
      return "story"
    case "frames":
      return "template"
    case "assets":
    case "media":
    case "video":
    case "render":
    case "review":
    case "preview":
    case "thumbnail":
      return "edit"
    default:
      return "content"
  }
}
