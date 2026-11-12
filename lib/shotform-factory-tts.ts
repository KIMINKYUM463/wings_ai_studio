import { FACTORY_NARRATION_SEGMENTS } from "@/lib/shotform-factory-narration-script"

/** 나레이션 전체를 한 번에 TTS로 넘길 때 사용하는 본문(구간 사이 빈 줄). */
export function factoryNarrationTtsFullText(): string {
  return FACTORY_NARRATION_SEGMENTS.map((s) => s.text.trim()).filter(Boolean).join("\n\n")
}

/** 캐릭터 썸네일 없을 때 아바타 배경색 */
export function voiceAvatarFallbackColor(name: string): string {
  const hues = [198, 262, 318, 158, 38, 278, 12, 220]
  let idx = 0
  for (let i = 0; i < name.length; i++) idx = (idx + name.charCodeAt(i)) % hues.length
  return `hsl(${hues[idx]}, 52%, 40%)`
}
