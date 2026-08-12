import JSZip from "jszip"
import { downloadBlob, formatSrtTimestamp } from "@/lib/shotform-factory-capcut-export"

export function sanitizeAssetBasename(name: string, fallback = "shotform"): string {
  const cleaned = (name || "")
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 48)
  return cleaned || fallback
}

export function assetFilename(
  projectName: string,
  kind: "subtitles" | "thumbnail" | "video" | "tts" | "videos",
  ext: string
): string {
  return `${sanitizeAssetBasename(projectName)}_${kind}_${Date.now()}.${ext.replace(/^\./, "")}`
}

export function buildSrtFromTimedCues(
  cues: Array<{ text: string; start: number; end: number }>
): string {
  const rows = cues
    .map((c) => ({
      text: (c.text || "").replace(/\r/g, "").trim(),
      start: Math.max(0, c.start),
      end: Math.max(c.start + 0.05, c.end),
    }))
    .filter((c) => c.text.length > 0)
  if (!rows.length) return ""
  return rows
    .map(
      (c, i) =>
        `${i + 1}\n${formatSrtTimestamp(c.start)} --> ${formatSrtTimestamp(c.end)}\n${c.text}\n`
    )
    .join("\n")
}

export function downloadTextFile(text: string, filename: string, mime = "text/plain;charset=utf-8") {
  downloadBlob(new Blob([text], { type: mime }), filename)
}

export async function downloadUrlAsFile(url: string, filename: string): Promise<void> {
  if (!url?.trim()) throw new Error("다운로드할 파일이 없습니다.")
  if (url.startsWith("data:")) {
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    return
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`파일을 불러오지 못했습니다 (${res.status})`)
  const blob = await res.blob()
  if (blob.size < 32) throw new Error("파일이 비어 있습니다.")
  downloadBlob(blob, filename)
}

export function guessExtFromUrlOrType(url: string, mime?: string, fallback = "bin"): string {
  if (mime?.includes("mpeg") || mime?.includes("mp3")) return "mp3"
  if (mime?.includes("wav")) return "wav"
  if (mime?.includes("webm")) return "webm"
  if (mime?.includes("mp4")) return "mp4"
  if (mime?.includes("png")) return "png"
  if (mime?.includes("jpeg") || mime?.includes("jpg")) return "jpg"
  const path = url.split("?")[0] || ""
  const m = path.match(/\.([a-z0-9]{2,5})$/i)
  return m?.[1]?.toLowerCase() || fallback
}

export async function downloadTtsUrl(url: string, projectName: string): Promise<void> {
  if (!url?.trim()) throw new Error("TTS가 없습니다. 먼저 음성을 생성해 주세요.")
  const res = await fetch(url)
  if (!res.ok) throw new Error(`TTS를 불러오지 못했습니다 (${res.status})`)
  const blob = await res.blob()
  if (blob.size < 64) throw new Error("TTS 파일이 비어 있습니다.")
  const ext = guessExtFromUrlOrType(url, blob.type, "mp3")
  downloadBlob(blob, assetFilename(projectName, "tts", ext))
}

/** 여러 영상/오디오 URL을 ZIP으로 묶어 저장 */
export async function downloadUrlsAsZip(
  entries: Array<{ url: string; name: string }>,
  zipFilename: string
): Promise<void> {
  const valid = entries.filter((e) => e.url?.trim())
  if (!valid.length) throw new Error("저장할 파일이 없습니다.")
  if (valid.length === 1) {
    await downloadUrlAsFile(valid[0]!.url, valid[0]!.name)
    return
  }
  const zip = new JSZip()
  let added = 0
  for (const entry of valid) {
    try {
      const res = await fetch(entry.url)
      if (!res.ok) continue
      const blob = await res.blob()
      if (blob.size < 32) continue
      zip.file(entry.name, blob)
      added += 1
    } catch {
      /* skip broken urls */
    }
  }
  if (!added) throw new Error("파일을 불러오지 못했습니다.")
  const out = await zip.generateAsync({ type: "blob" })
  downloadBlob(out, zipFilename)
}
