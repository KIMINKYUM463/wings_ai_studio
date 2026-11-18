import { NextRequest, NextResponse } from "next/server"
import { adamOfflineMessage } from "@/lib/adam-server"
import { ADAM_TTS_ORIGIN, splitAdamText } from "@/lib/adam-tts"
import { concatWav } from "@/lib/adam-wav"

export const runtime = "nodejs"
export const maxDuration = 300

async function adamOnline(): Promise<boolean> {
  try {
    const res = await fetch(`${ADAM_TTS_ORIGIN}/tts`, {
      method: "OPTIONS",
      signal: AbortSignal.timeout(1500),
    })
    return res.status < 500
  } catch {
    return false
  }
}

export async function GET() {
  const online = await adamOnline()
  return NextResponse.json({
    online,
    message: online ? "아담 TTS 서버가 켜져 있습니다." : adamOfflineMessage(),
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { text?: string; tempo?: number }
    const text = String(body.text || "").trim()
    if (!text) {
      return NextResponse.json({ success: false, error: "읽을 문장이 없습니다." }, { status: 400 })
    }
    const tempoRaw = Number(body.tempo ?? 1)
    const tempo = Number.isFinite(tempoRaw) ? Math.min(2, Math.max(0.5, tempoRaw)) : 1
    const chunks = splitAdamText(text).slice(0, 40)
    if (!chunks.length) {
      return NextResponse.json({ success: false, error: "읽을 문장이 없습니다." }, { status: 400 })
    }

    const wavs: Buffer[] = []
    for (const chunk of chunks) {
      let res: Response
      try {
        res = await fetch(`${ADAM_TTS_ORIGIN}/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: chunk, tempo, lang: "Korean" }),
          signal: AbortSignal.timeout(180000),
        })
      } catch {
        return NextResponse.json({ success: false, error: adamOfflineMessage() }, { status: 503 })
      }
      if (!res.ok) {
        const detail = (await res.text().catch(() => "")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
        return NextResponse.json(
          { success: false, error: detail.slice(0, 240) || `아담 TTS 실패 (${res.status})` },
          { status: 502 }
        )
      }
      wavs.push(Buffer.from(await res.arrayBuffer()))
    }

    const wav = concatWav(wavs)
    const audioBase64 = wav.toString("base64")
    return NextResponse.json({
      success: true,
      audioBase64,
      mime: "audio/wav",
      audioUrl: `data:audio/wav;base64,${audioBase64}`,
    })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "아담 TTS 실패" },
      { status: 500 }
    )
  }
}
