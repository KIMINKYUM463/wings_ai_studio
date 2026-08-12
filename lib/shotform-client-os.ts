/** 브라우저 OS 감지 — 로컬 에이전트 런처 선택용 */

export type ShotformClientOs = "win" | "mac"

export function detectShotformClientOs(): ShotformClientOs {
  if (typeof navigator === "undefined") return "win"
  const platform = navigator.platform || ""
  const ua = navigator.userAgent || ""
  // iPadOS 13+ 는 Macintosh 로 위장하는 경우가 있음 — 에이전트는 데스크톱만
  if (/iPhone|iPod/i.test(ua)) return "mac"
  if (/Mac|Macintosh/i.test(platform) || /Mac OS X/i.test(ua)) return "mac"
  return "win"
}

export function localAgentStarterFilename(os: ShotformClientOs = detectShotformClientOs()): string {
  return os === "mac" ? "start-shotform-agent.command" : "start-shotform-agent.cmd"
}

export function localAgentStarterLabel(os: ShotformClientOs = detectShotformClientOs()): string {
  return os === "mac" ? "에이전트 받기 (.command)" : "에이전트 받기 (.cmd)"
}

export function localAgentStarterHint(os: ShotformClientOs = detectShotformClientOs()): string {
  if (os === "mac") {
    return (
      `${localAgentStarterFilename("mac")} 를 받았습니다.\n` +
      "다운로드 폴더에서 더블클릭하세요.\n" +
      "처음이면 「열 수 없음」→ 우클릭 → 열기 로 허용한 뒤 다시 실행하세요.\n" +
      "(Chrome은 자동 실행 불가 · Terminal 창은 닫지 마세요)"
    )
  }
  return (
    `${localAgentStarterFilename("win")} 를 받았습니다.\n` +
    "Chrome은 .cmd 자동 실행이 불가해, 다운로드 폴더에서 더블클릭하세요.\n" +
    "기존 에이전트 창은 닫은 뒤 실행하세요."
  )
}
