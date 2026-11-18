import fs from "node:fs"
import path from "node:path"

const KEY_FILE = path.join(process.cwd(), "data", "shotform-youtube-key.txt")

/** 설정 화면에 저장한 키를 먼저 쓰고, 없을 때만 서버 환경변수 키를 쓴다. */
export function youtubeApiKey(): string {
  try {
    const saved = fs.readFileSync(KEY_FILE, "utf8").trim()
    if (saved) return saved
  } catch {
    /* 아직 설정에서 저장하지 않음 */
  }
  return (
    process.env.YOUTUBE_API_KEY?.trim() ||
    process.env.YOUTUBE_DATA_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_YOUTUBE_API_KEY?.trim() ||
    ""
  )
}

export function saveYoutubeApiKey(apiKey: string): void {
  const clean = apiKey.trim()
  fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true })
  if (!clean) {
    fs.rmSync(KEY_FILE, { force: true })
    return
  }
  fs.writeFileSync(KEY_FILE, clean, { encoding: "utf8", mode: 0o600 })
}
