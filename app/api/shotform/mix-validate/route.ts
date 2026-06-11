import { type NextRequest, NextResponse } from "next/server"

const MAX_URLS = 5
const MIN_URLS = 1

type Row = { url: string; ok: boolean; status?: number; error?: string; contentType?: string }

async function probeUrl(url: string): Promise<Row> {
  try {
    const u = new URL(url)
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return { url, ok: false, error: "http(s)만 허용" }
    }
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 8000)
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": "ShotForm-MixValidate/1.0" },
    }).catch(() => null)
    clearTimeout(t)
    if (!res) {
      return { url, ok: false, error: "연결 실패" }
    }
    const ct = res.headers.get("content-type") || ""
    /** HEAD가 막히면 GET 일부 플랫폼은 실패 — 405면 GET 시도 */
    if (res.status === 405 || res.status === 501) {
      const ctrl2 = new AbortController()
      const t2 = setTimeout(() => ctrl2.abort(), 8000)
      const r2 = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: ctrl2.signal,
        headers: { "User-Agent": "ShotForm-MixValidate/1.0", Range: "bytes=0-0" },
      }).catch(() => null)
      clearTimeout(t2)
      if (!r2?.ok) {
        return { url, ok: res.ok, status: res.status, contentType: ct, error: res.ok ? undefined : `HTTP ${res.status}` }
      }
      const ct2 = r2.headers.get("content-type") || ""
      return { url, ok: true, status: r2.status, contentType: ct2 }
    }
    return {
      url,
      ok: res.ok || res.status === 403,
      status: res.status,
      contentType: ct,
      error: res.ok || res.status === 403 ? undefined : `HTTP ${res.status}`,
    }
  } catch (e) {
    return { url, ok: false, error: e instanceof Error ? e.message : "URL 오류" }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const raw = body.urls
    if (!Array.isArray(raw)) {
      return NextResponse.json({ error: "urls 배열이 필요합니다." }, { status: 400 })
    }
    const urls = raw
      .filter((x: unknown): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_URLS)

    if (urls.length < MIN_URLS) {
      return NextResponse.json({ error: `유효한 URL이 최소 ${MIN_URLS}개 필요합니다.` }, { status: 400 })
    }
    if (urls.length > MAX_URLS) {
      return NextResponse.json({ error: `URL은 최대 ${MAX_URLS}개입니다.` }, { status: 400 })
    }

    const rows: Row[] = []
    for (const url of urls) {
      rows.push(await probeUrl(url))
    }

    const allOk = rows.every((r) => r.ok)
    return NextResponse.json({
      ok: allOk,
      rows,
      note:
        "YouTube·샤오홍슈 등 페이지 URL은 HEAD로 응답이 달라질 수 있습니다. 실제 영상 바이트 다운로드는 서버 워커(예: yt-dlp)가 필요합니다.",
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "검증 실패" },
      { status: 500 }
    )
  }
}
