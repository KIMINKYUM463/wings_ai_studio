/** 아담 TTS 키트(Qwen3-TTS) 로컬 서버. `python server.py` → 127.0.0.1:8765 */

export const ADAM_TTS_PORT = 8765
export const ADAM_TTS_ORIGIN = `http://127.0.0.1:${ADAM_TTS_PORT}`
export const ADAM_VOICE_BARE_ID = "adam"
export const ADAM_VOICE_FULL_ID = "adam-adam"

export const ADAM_KIT_DIRNAME = "tools/adam-tts-kit"

export const ADAM_SERVER_HINT =
  "아담 TTS 서버가 꺼져 있습니다. 홈 폴더에서 python server.py 를 치면 server.py를 못 찾습니다. 프로젝트의 tools\\adam-tts-kit 폴더에서 python server.py 를 실행하세요. (127.0.0.1:8765)"

/** 서버는 한 요청에 500자까지. 문장 경계로 나눈다. */
export function splitAdamText(text: string, max = 450): string[] {
  const clean = text.replace(/\s+/g, " ").trim()
  if (!clean) return []
  if (clean.length <= max) return [clean]

  const parts: string[] = []
  let buf = ""
  for (const sentence of clean.split(/(?<=[.!?。…])\s+/)) {
    if (!sentence) continue
    if (sentence.length > max) {
      if (buf.trim()) {
        parts.push(buf.trim())
        buf = ""
      }
      for (let i = 0; i < sentence.length; i += max) parts.push(sentence.slice(i, i + max))
      continue
    }
    if (buf && (buf + " " + sentence).length > max) {
      parts.push(buf.trim())
      buf = sentence
    } else {
      buf = buf ? `${buf} ${sentence}` : sentence
    }
  }
  if (buf.trim()) parts.push(buf.trim())
  return parts
}

export async function fetchAdamTts(body: { text: string; tempo?: number }): Promise<Response> {
  return fetch("/api/adam-tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}
