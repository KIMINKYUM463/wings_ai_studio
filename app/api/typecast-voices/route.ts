import { type NextRequest, NextResponse } from "next/server"
import { extractTypecastVoiceRows, normalizeTypecastVoiceRow } from "@/lib/shotform-tts-providers"

async function fetchTypecastVoices(apiKey: string, model?: string): Promise<Response> {
  const url = new URL("https://api.typecast.ai/v2/voices")
  if (model) url.searchParams.set("model", model)
  return fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-API-KEY": apiKey,
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    const apiKey = new URL(request.url).searchParams.get("apiKey")?.trim()
    if (!apiKey) {
      return NextResponse.json({ error: "타입캐스트 API 키가 필요합니다." }, { status: 400 })
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    let response: Response
    try {
      response = await fetchTypecastVoices(apiKey, "ssfm-v30")
      clearTimeout(timeoutId)
    } catch (e) {
      clearTimeout(timeoutId)
      const msg = e instanceof Error ? e.message : String(e)
      return NextResponse.json(
        { success: false, error: `타입캐스트 API 연결 실패: ${msg}` },
        { status: 500 }
      )
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "")
      let message = errText.slice(0, 400)
      try {
        const j = JSON.parse(errText) as { message?: string; error?: string; detail?: string }
        message = j.message || j.error || j.detail || message
      } catch {
        /* raw text */
      }
      return NextResponse.json(
        { success: false, error: `타입캐스트 목록 실패 (${response.status}): ${message}` },
        { status: response.status }
      )
    }

    let raw: unknown = await response.json().catch(() => null)
    let rows = extractTypecastVoiceRows(raw)

    if (!rows.length) {
      const fallbackRes = await fetchTypecastVoices(apiKey)
      if (fallbackRes.ok) {
        raw = await fallbackRes.json().catch(() => null)
        rows = extractTypecastVoiceRows(raw)
      }
    }

    const voices = rows
      .map((row) => normalizeTypecastVoiceRow(row))
      .filter((v): v is NonNullable<typeof v> => Boolean(v))

    if (!voices.length) {
      return NextResponse.json(
        {
          success: false,
          error:
            "타입캐스트 목소리를 파싱하지 못했습니다. API 키·계정 권한을 확인하거나 음성 ID를 직접 입력해 주세요.",
        },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true, voices })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "타입캐스트 목록 실패" },
      { status: 500 }
    )
  }
}
