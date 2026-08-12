function mvpFilenameBase(projectName: string, fallback: string): string {
  return (
    projectName
      .trim()
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\.+$/g, "")
      .trim() || fallback
  )
}

/** 렌더 MP4 다운로드 파일명 — 프로젝트명과 동일 (OS 금지 문자만 제거) */
export function mvpRenderDownloadFilename(projectName: string, ext = "mp4"): string {
  const safeExt = ext.replace(/^\./, "").trim() || "mp4"
  return `${mvpFilenameBase(projectName, "render")}.${safeExt}`
}

/** 개별 자산 다운로드 파일명 — mix / tts / subtitles / thumbnail */
export function mvpAssetDownloadFilename(
  projectName: string,
  kind: "mix" | "tts" | "subtitles" | "thumbnail",
  ext: string
): string {
  const safeExt = ext.replace(/^\./, "").trim() || "bin"
  return `${mvpFilenameBase(projectName, "shotform")}_${kind}.${safeExt}`
}
