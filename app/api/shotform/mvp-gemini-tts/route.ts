import { NextResponse } from "next/server"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { defaultVoice, voiceStyle } from "@/lib/wings-shopping-v2/tts"
import { geminiTts } from "@/lib/wings-shopping-v2/tts/gemini"

export const runtime = "nodejs"

/** 리믹스 편집기의 음성 다시 만들기. 버전2와 같은 Gemini 목소리를 씁니다. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { text?: string; speed?: number }
  const text = body.text?.trim() ?? ""
  if (!text) return NextResponse.json({ error: "읽을 문장이 없습니다." }, { status: 400 })
  const voice = defaultVoice("remix")
  const speed = Number.isFinite(body.speed) ? Number(body.speed) : voice.speed
  const out = path.join(os.tmpdir(), `remix-gemini-${Date.now()}.mp3`)
  try {
    await geminiTts(text, voice.voiceId, speed, voiceStyle("remix"), out, "ko")
    const buffer = await fs.readFile(out)
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "음성 생성 실패"
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    await fs.rm(out, { force: true }).catch(() => undefined)
  }
}
