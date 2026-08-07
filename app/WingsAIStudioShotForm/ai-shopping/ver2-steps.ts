/** ver2 활성 스텝 (클라이언트·서버 공용, server action 아님) */
export type Ver2ActiveStep =
  | "keywordAnalysis"
  | "collect"
  | "scriptJson"
  | "storyboard" // legacy — load 시 voice로 마이그레이션
  | "voice"
  | "images"
  | "videos"
  | "thumbnail"
  | "preview"
  | "metadata"
  // legacy (load 시 마이그레이션)
  | "product"
  | "script"
  | "video"
  | "render"

export type Ver2LiveActiveStep = Exclude<
  Ver2ActiveStep,
  "product" | "script" | "video" | "render" | "storyboard"
>

/** 구 activeStep → 현재 파이프라인 키 마이그레이션 */
export function migrateVer2ActiveStep(
  step: string | undefined,
  hasScript?: boolean
): Ver2LiveActiveStep {
  switch (step) {
    case "keywordAnalysis":
    case "collect":
    case "scriptJson":
    case "voice":
    case "images":
    case "videos":
    case "thumbnail":
    case "preview":
    case "metadata":
      return step
    case "storyboard":
      return "voice"
    case "product":
      return "collect"
    case "script":
      return hasScript ? "voice" : "scriptJson"
    case "video":
      return "images"
    case "render":
      return "videos"
    default:
      return "collect"
  }
}
