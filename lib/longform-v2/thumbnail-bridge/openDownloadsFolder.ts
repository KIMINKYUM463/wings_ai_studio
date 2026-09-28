/**
 * 사용자 PC의「다운로드」폴더를 탐색기/파인더로 연다.
 * 웹에서는 폴더 picker / 클립보드 안내로 폴백.
 */

export type OpenDownloadsResult = { ok: boolean; message: string }

export async function openDownloadsFolder(): Promise<OpenDownloadsResult> {
  if (typeof window === "undefined") {
    return { ok: false, message: "브라우저에서만 사용할 수 있습니다." }
  }

  const w = window as Window & {
    showDirectoryPicker?: (opts?: {
      startIn?: "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos"
    }) => Promise<FileSystemDirectoryHandle>
  }

  if (typeof w.showDirectoryPicker === "function") {
    try {
      await w.showDirectoryPicker({ startIn: "downloads" })
      return { ok: true, message: "다운로드 폴더 위치에서 폴더를 선택했습니다." }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        return { ok: false, message: "선택 창을 닫았습니다." }
      }
    }
  }

  const isWin = /Win/i.test(navigator.userAgent)
  const cmd = isWin ? "shell:Downloads" : "open ~/Downloads"
  try {
    await navigator.clipboard.writeText(cmd)
  } catch {
    /* ignore */
  }

  return {
    ok: true,
    message: isWin
      ? "탐색기에서 다운로드 폴더를 바로 열 수 없어, 실행 명령을 클립보드에 넣었습니다. Win+R → 붙여넣기(Ctrl+V) → Enter 로 다운로드 폴더를 여세요."
      : "터미널에서 다운로드 폴더로 가는 명령을 클립보드에 복사했습니다. 터미널에 붙여 넣어 실행하세요.",
  }
}
