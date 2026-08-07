import { NextResponse } from "next/server"
import { getSupertonicBaseUrl } from "@/lib/supertonic-local"

export async function GET() {
  const base = getSupertonicBaseUrl()
  try {
    const res = await fetch(`${base}/v1/health`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          online: false,
          baseUrl: base,
          error: `로컬 서버 응답 오류 (${res.status})`,
          detail: data,
        },
        { status: 502 }
      )
    }
    return NextResponse.json({
      success: true,
      online: true,
      baseUrl: base,
      ...data,
    })
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e)
    const offlineHint =
      /fetch failed|ECONNREFUSED|ENOTFOUND|timeout|aborted|NetworkError/i.test(raw)
        ? `${base} 에 연결되지 않았습니다. 터미널에서 아래를 다시 실행하세요:\nsupertonic serve --host 127.0.0.1 --port 7788 --model supertonic-3`
        : raw
    return NextResponse.json(
      {
        success: false,
        online: false,
        baseUrl: base,
        error: offlineHint,
      },
      { status: 503 }
    )
  }
}
