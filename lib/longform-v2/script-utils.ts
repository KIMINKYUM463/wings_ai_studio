/** WingsStudio v2 웹 포트 — 목표 분량 유틸 */

export const V2_SCRIPT_TARGET_CHARS_MIN = 1000
export const V2_SCRIPT_TARGET_CHARS_MAX = 80_000
export const V2_SCRIPT_TARGET_CHARS_DEFAULT = 8300

export function clampV2TargetChars(raw: number, fallback = V2_SCRIPT_TARGET_CHARS_DEFAULT): number {
  const n = Number.isFinite(raw) ? Math.floor(raw) : fallback
  return Math.min(V2_SCRIPT_TARGET_CHARS_MAX, Math.max(V2_SCRIPT_TARGET_CHARS_MIN, n))
}

export function v2ScriptTargetCharRange(targetChars: number): { min: number; max: number; target: number } {
  const target = clampV2TargetChars(targetChars)
  if (target <= 2000) {
    return { target, min: Math.max(320, Math.round(target * 0.88)), max: Math.round(target * 1.08) }
  }
  if (target <= 5000) {
    return { target, min: Math.round(target * 0.85), max: Math.round(target * 1.1) }
  }
  return { target, min: Math.round(target * 0.85), max: Math.round(target * 1.12) }
}

export function targetScriptCharsForVideoMinutes(minutes: number): number {
  // 대략 분당 ~400자 (한국어 나레이션)
  return clampV2TargetChars(Math.round(minutes * 400))
}

export function splitScriptIntoSceneLines(script: string): string[] {
  return script
    .split(/\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export function sanitizeV2ScriptOutput(raw: string): string {
  let t = raw.replace(/\r\n/g, "\n").trim()
  t = t.replace(/^```[\w]*\n?/gm, "").replace(/```\s*$/gm, "")
  t = t.replace(/<artifact[\s\S]*?<\/artifact>/gi, "")
  t = t.replace(/^#{1,6}\s+.*$/gm, "")
  const lines = t.split("\n").filter((line) => {
    const s = line.trim()
    if (!s) return false
    if (/아티팩트|artifact|YouTube 스크립트를/i.test(s)) return false
    return true
  })
  return lines.join("\n").trim()
}

export function enforceV2ScriptLineFormat(script: string): string {
  return script
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n")
}

export function fitV2GeneratedScriptToTarget(script: string, targetChars: number): string {
  const { max } = v2ScriptTargetCharRange(targetChars)
  const s = script.trim()
  if (s.length <= max) return s
  const lines = s.split("\n")
  let out = ""
  for (const line of lines) {
    const candidate = out ? `${out}\n${line}` : line
    if (candidate.length > max) break
    out = candidate
  }
  return out.trim() || s.slice(0, max).trim()
}
