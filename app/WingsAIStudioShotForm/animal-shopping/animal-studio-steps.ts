export type AnimalLiveActiveStep =
  | "product"
  | "script"
  | "voice"
  | "images"
  | "videos"
  | "preview"

export type AnimalActiveStep = AnimalLiveActiveStep

/** 레거시 스텝(video/render/thumbnail) → 새 스튜디오 스텝 */
export function migrateAnimalActiveStep(step: string | undefined): AnimalLiveActiveStep {
  switch (step) {
    case "product":
    case "script":
    case "voice":
    case "images":
    case "videos":
    case "preview":
      return step
    case "video":
      return "images"
    case "render":
      return "videos"
    case "thumbnail":
    case "edit":
    case "export":
      return "preview"
    default:
      return "product"
  }
}
