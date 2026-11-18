import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { nanoid } from "nanoid"
import { GEMINI_VOICES, geminiTts } from "@/lib/wings-shopping-v2/tts/gemini"

export const runtime = "nodejs"
export const maxDuration = 60

/** AI 쇼핑 숏폼 장면 TTS (Gemini). 다른 TTS 라우트와 같은 모양 { success, audioBase64, alignment } 으로 돌려준다. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { text?: string; voiceId?: string; speed?: number }
  const text = String(body.text ?? "").trim().slice(0, 2000)
  if (!text) return Response.json({ error: "텍스트가 필요합니다." }, { status: 400 })
  const voice = GEMINI_VOICES.find((v) => v.id === body.voiceId)?.id ?? GEMINI_VOICES[0].id
  const speed = Math.min(1.5, Math.max(0.7, Number(body.speed) || 1))
  const out = path.join(os.tmpdir(), `ai-shop-gtts-${nanoid(8)}.mp3`)
  try {
    const { duration, alignment } = await geminiTts(text, voice, speed, "", out)
    const buf = await fs.readFile(out)
    return Response.json({
      success: true,
      audioBase64: buf.toString("base64"),
      duration,
      // ElevenLabs 정렬 모양으로 맞춰 자막 정렬 코드를 그대로 쓴다
      alignment: {
        characters: alignment.chars,
        character_start_times_seconds: alignment.starts,
        character_end_times_seconds: alignment.ends,
      },
    })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 })
  } finally {
    await fs.rm(out, { force: true })
  }
}
