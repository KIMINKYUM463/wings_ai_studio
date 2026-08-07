import { type NextRequest, NextResponse } from "next/server"
import { getSupertonicBaseUrl } from "@/lib/supertonic-local"

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      text?: string
      voiceId?: string
      voice?: string
      lang?: string
      speed?: number
      steps?: number
    }

    const text = String(body.text ?? "").trim()
    const voice = String(body.voiceId ?? body.voice ?? "F1").trim()
    const lang = String(body.lang ?? "ko").trim() || "ko"
    const speed =
      typeof body.speed === "number" && Number.isFinite(body.speed)
        ? Math.min(2, Math.max(0.7, body.speed))
        : 1.05
    const steps =
      typeof body.steps === "number" && Number.isFinite(body.steps)
        ? Math.min(12, Math.max(5, Math.round(body.steps)))
        : 8

    if (!text) {
      return NextResponse.json({ success: false, error: "텍스트가 필요합니다." }, { status: 400 })
    }
    if (!voice) {
      return NextResponse.json({ success: false, error: "보이스(voice)가 필요합니다." }, { status: 400 })
    }

    const base = getSupertonicBaseUrl()
    let response: Response
    try {
      response = await fetch(`${base}/v1/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "audio/wav, application/json" },
        body: JSON.stringify({
          text,
          voice,
          lang,
          speed,
          total_steps: steps,
          response_format: "wav",
        }),
        signal: AbortSignal.timeout(180000),
      })
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e)
      const hint = /fetch failed|ECONNREFUSED|ENOTFOUND|timeout|aborted/i.test(raw)
        ? `로컬 Supertonic이 꺼져 있습니다 (${base}). 터미널에서: supertonic serve --host 127.0.0.1 --port 7788 --model supertonic-3`
        : `로컬 Supertonic 연결 실패: ${raw}`
      return NextResponse.json(
        {
          success: false,
          error: hint,
          baseUrl: base,
        },
        { status: 503 }
      )
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "")
      let message = errText.slice(0, 400)
      try {
        const j = JSON.parse(errText) as {
          error?: { message?: string } | string
          message?: string
          detail?: string
        }
        if (typeof j.error === "object" && j.error?.message) message = j.error.message
        else if (typeof j.error === "string") message = j.error
        else message = j.message || j.detail || message
      } catch {
        /* raw */
      }
      return NextResponse.json(
        {
          success: false,
          error: `Supertonic TTS 실패 (${response.status}): ${message}`,
          baseUrl: base,
        },
        { status: response.status }
      )
    }

    const contentType = response.headers.get("content-type") || ""
    if (contentType.includes("application/json")) {
      // 일부 구현이 JSON+base64로 줄 수 있음
      const data = (await response.json().catch(() => ({}))) as {
        audio?: string
        audioBase64?: string
        audio_url?: string
      }
      if (data.audio_url) {
        return NextResponse.json({ success: true, audioUrl: data.audio_url })
      }
      const b64 = data.audioBase64 || data.audio
      if (b64) {
        const audioUrl = b64.startsWith("data:") ? b64 : `data:audio/wav;base64,${b64}`
        return NextResponse.json({ success: true, audioUrl, audioBase64: b64.replace(/^data:[^;]+;base64,/, "") })
      }
      return NextResponse.json(
        { success: false, error: "Supertonic JSON 응답에 오디오가 없습니다." },
        { status: 502 }
      )
    }

    const audioBuffer = await response.arrayBuffer()
    if (!audioBuffer.byteLength) {
      return NextResponse.json({ success: false, error: "오디오가 비어 있습니다." }, { status: 502 })
    }
    const audioBase64 = Buffer.from(audioBuffer).toString("base64")
    const audioUrl = `data:audio/wav;base64,${audioBase64}`

    return NextResponse.json({ success: true, audioUrl, audioBase64 })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Supertonic TTS 실패" },
      { status: 500 }
    )
  }
}
