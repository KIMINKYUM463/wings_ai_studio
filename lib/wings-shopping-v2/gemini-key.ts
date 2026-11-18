import fs from "node:fs"
import path from "node:path"

const KEY_FILE = path.join(process.cwd(), "data", "shotform-gemini-key.txt")

export const GEMINI_KEY_MISSING =
  "Gemini API 키가 없습니다. 메인 화면 설정에서 Gemini API 키를 입력하고 저장한 뒤 다시 분석하세요."

/** 환경변수 키가 있으면 그것을 쓰고, 없으면 설정 화면에서 저장한 키를 읽는다. */
export function geminiApiKey(): string {
  const fromEnv = process.env.GEMINI_API_KEY?.trim()
  if (fromEnv) return fromEnv
  try {
    return fs.readFileSync(KEY_FILE, "utf8").trim()
  } catch {
    return ""
  }
}

export function saveGeminiApiKey(apiKey: string): void {
  const clean = apiKey.trim()
  fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true })
  if (!clean) {
    fs.rmSync(KEY_FILE, { force: true })
    return
  }
  fs.writeFileSync(KEY_FILE, clean, { encoding: "utf8", mode: 0o600 })
}
