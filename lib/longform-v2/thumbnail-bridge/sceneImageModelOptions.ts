export const SCENE_IMAGE_MODEL_OPTIONS = [
  { id: "prunaai/z-image-turbo", label: "Z-Image Turbo", desc: "Replicate · 추천모델 (1920×1080)" },
  { id: "qwen/qwen-image", label: "Qwen Image", desc: "Replicate · 베이직모델 (반실사)" },
  { id: "standard", label: "나노바나나 1", desc: "Gemini 나노바나나 1" },
  { id: "nano2", label: "나노바나나 2", desc: "Gemini 나노바나나 2 (기본 권장)" },
  { id: "black-forest-labs/flux-pro", label: "FLUX Pro", desc: "Replicate · 고품질" },
  { id: "black-forest-labs/flux-schnell", label: "FLUX Schnell", desc: "Replicate · 빠른 생성" },
  { id: "google/imagen-4-fast", label: "Imagen 4 Fast", desc: "Replicate" },
  { id: "prunaai/hidream-l1-fast", label: "HiDream L1 Fast", desc: "Replicate" },
  { id: "minimax/image-01", label: "MiniMax Image-01", desc: "Replicate · 16:9" },
] as const

export type SceneImageModelId = (typeof SCENE_IMAGE_MODEL_OPTIONS)[number]["id"]

export function sceneImageModelLabel(id: string): string {
  const row = SCENE_IMAGE_MODEL_OPTIONS.find((o) => o.id === id)
  return row?.label ?? id
}

export function isReplicateSceneImageModelId(id: string): boolean {
  const t = id.trim()
  return (
    t.startsWith("qwen/") ||
    t.startsWith("black-forest-labs/") ||
    t.startsWith("google/") ||
    t.startsWith("prunaai/") ||
    t.startsWith("minimax/")
  )
}
