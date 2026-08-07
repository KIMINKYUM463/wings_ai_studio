import { type NextRequest, NextResponse } from "next/server"
import { getSupertonicBaseUrl } from "@/lib/supertonic-local"
import { sanitizeSupertonicVoiceName } from "@/lib/supertonic-voice-register"

const MAX_JSON_BYTES = 50 * 1024 * 1024

/** Voice Builder JSON → 로컬 `supertonic serve` 에 import */
export async function POST(request: NextRequest) {
  try {
    const form = await request.formData()
    const file = form.get("file")
    const nameRaw = String(form.get("name") || "").trim()
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "JSON 파일이 필요합니다." }, { status: 400 })
    }
    if (file.size <= 0 || file.size > MAX_JSON_BYTES) {
      return NextResponse.json(
        { success: false, error: "JSON 파일은 50MB 이하여야 합니다." },
        { status: 400 }
      )
    }

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(await file.text()) as Record<string, unknown>
    } catch {
      return NextResponse.json(
        { success: false, error: "올바른 JSON 파일이 아닙니다." },
        { status: 400 }
      )
    }
    if (!parsed.style_ttl || !parsed.style_dp) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Supertonic Voice Builder JSON이 아닙니다. style_ttl과 style_dp가 필요합니다.",
        },
        { status: 400 }
      )
    }

    let name = sanitizeSupertonicVoiceName(
      nameRaw || file.name.replace(/\.json$/i, "")
    )
    if (/^[FM][1-5]$/i.test(name) || /^n\d+$/i.test(name)) {
      name = `custom_${name}_${Date.now()}`
    }

    const base = getSupertonicBaseUrl()
    const out = new FormData()
    out.append("file", file, file.name || `${name}.json`)
    out.append("name", name)

    let res: Response
    try {
      res = await fetch(`${base}/v1/styles/import?overwrite=true`, {
        method: "POST",
        body: out,
        signal: AbortSignal.timeout(60000),
      })
    } catch (e) {
      return NextResponse.json(
        {
          success: false,
          error:
            e instanceof Error
              ? `로컬 Supertonic 연결 실패: ${e.message}. serve가 켜져 있는지 확인하세요.`
              : "로컬 Supertonic 연결 실패",
        },
        { status: 503 }
      )
    }

    const text = await res.text().catch(() => "")
    let data: Record<string, unknown> = {}
    try {
      data = JSON.parse(text) as Record<string, unknown>
    } catch {
      data = { raw: text.slice(0, 300) }
    }
    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `import 실패 (${res.status}): ${String(data.detail || data.message || text).slice(0, 300)}`,
        },
        { status: res.status }
      )
    }
    return NextResponse.json({
      success: true,
      name: data.name || name,
      stored_at: data.stored_at,
    })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "import 실패" },
      { status: 500 }
    )
  }
}
