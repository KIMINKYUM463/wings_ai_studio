export type InfoLiveActiveStep =
  | "source"
  | "script"
  | "images"
  | "voice"
  | "preview"

export type InfoActiveStep = InfoLiveActiveStep

export function migrateInfoActiveStep(step: string | undefined): InfoLiveActiveStep {
  switch (step) {
    case "source":
    case "script":
    case "images":
    case "voice":
    case "preview":
      return step
    case "product":
    case "ingest":
      return "source"
    case "cards":
    case "story":
      return "script"
    case "assets":
    case "media":
      return "images"
    case "edit":
    case "export":
      return "preview"
    default:
      return "source"
  }
}
