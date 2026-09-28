/**
 * 웹 longform-v2: scriptByLanguage 맵을 부모가 넘기면 그걸 쓰고,
 * 없으면 기본 대본만 반환.
 */
export function getScriptForLanguage(
  project: {
    script?: string | null
    script_by_language?: Record<string, string> | null
    scriptByLanguage?: Record<string, string> | null
  },
  lang: string,
): string {
  const l = lang.trim()
  const map = project.script_by_language ?? project.scriptByLanguage ?? {}
  if (!l || l === "한국어" || l === "ko" || l === "Korean") {
    return project.script ?? map["한국어"] ?? map.ko ?? ""
  }
  const direct = map[l]
  if (typeof direct === "string" && direct.trim()) return direct
  return project.script ?? ""
}
