import fs from "node:fs"
import path from "node:path"
import { BROWSER_KEY_HEADERS, requestHeader } from "./request-ctx"

const KEY_FILE = path.join(process.cwd(), "data", "shotform-tikhub-key.txt")

/** 설정 화면에 저장한 키를 먼저 쓴다. 없을 때만 서버 환경변수 키를 쓴다. */
export function tikhubApiKey(): string {
  const fromRequest = requestHeader(BROWSER_KEY_HEADERS.tikhub)
  if (fromRequest) return fromRequest
  try {
    const saved = fs.readFileSync(KEY_FILE, "utf8").trim()
    if (saved) return saved
  } catch {
    /* 아직 설정에서 저장하지 않음 */
  }
  return process.env.TIKHUB_API_KEY?.trim() || ""
}

export function saveTikhubApiKey(apiKey: string): void {
  const clean = apiKey.trim()
  fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true })
  if (!clean) {
    fs.rmSync(KEY_FILE, { force: true })
    return
  }
  fs.writeFileSync(KEY_FILE, clean, { encoding: "utf8", mode: 0o600 })
}
