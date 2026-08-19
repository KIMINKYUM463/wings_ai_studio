import { type NextRequest, NextResponse } from "next/server"
import { explainTypecastApiError } from "@/lib/typecast-api-error"

export async function POST(request: NextRequest) {
  try {
    const { text, voiceId, apiKey, emotion, speed: speedRaw } = (await request.json()) as {
      text?: string
      voiceId?: string
      apiKey?: string
      emotion?: string
      speed?: number
    }
    const audioTempo =
      typeof speedRaw === "number" && Number.isFinite(speedRaw)
        ? Math.min(2, Math.max(0.5, Math.round(speedRaw * 10) / 10))
        : 1

    const trimmedText = String(text ?? "").trim()
    if (!trimmedText) {
      return NextResponse.json({ error: "텍스트가 필요합니다." }, { status: 400 })
    }
    if (!voiceId) {
      return NextResponse.json({ error: "목소리 ID가 필요합니다." }, { status: 400 })
    }
    if (!apiKey) {
      return NextResponse.json({ error: "타입캐스트 API 키가 필요합니다." }, { status: 400 })
    }

    const style = emotion?.trim() || "smart"
    const presetEmotions = new Set([
      "normal",
      "happy",
      "sad",
      "angry",
      "whisper",
      "toneup",
      "tonedown",
    ])
    const prompt =
      style === "smart"
        ? { emotion_type: "smart" }
        : presetEmotions.has(style)
          ? { emotion_type: "preset", emotion_preset: style }
          : { emotion_type: "smart" }

    const response = await fetch("https://api.typecast.ai/v1/text-to-speech", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey.trim(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: trimmedText,
        model: "ssfm-v30",
        voice_id: voiceId,
        prompt,
        output: {
          audio_format: "wav",
          audio_tempo: audioTempo,
        },
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => "")
      let message = errText.slice(0, 400)
      try {
        const j = JSON.parse(errText) as { message?: string; error?: string }
        message = j.message || j.error || message
      } catch {
        /* raw text */
      }
      return NextResponse.json(
        { success: false, error: explainTypecastApiError(response.status, message) },
        { status: response.status }
      )
    }

    const audioBuffer = await response.arrayBuffer()
    const audioBase64 = Buffer.from(audioBuffer).toString("base64")
    const audioUrl = `data:audio/wav;base64,${audioBase64}`

    return NextResponse.json({
      success: true,
      audioBase64,
      audioUrl,
    })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "타입캐스트 TTS 실패" },
      { status: 500 }
    )
  }
}
