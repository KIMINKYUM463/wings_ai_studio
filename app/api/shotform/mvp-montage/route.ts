import { type NextRequest, NextResponse } from "next/server"

type MontageItem = {
  url: string
  videoUrl?: string
  title?: string
  platform?: string
}

/** MVP 자동 짜집기 — ffmpeg 워커 연동 전 job 메타 생성 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const durationSec = [20, 30, 45].includes(Number(body.durationSec)) ? Number(body.durationSec) : 30
    const raw = body.items
    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json({ error: "items 배열이 필요합니다." }, { status: 400 })
    }
    if (raw.length > 5) {
      return NextResponse.json({ error: "짜집기는 최대 5개 클립까지 지원합니다." }, { status: 400 })
    }

    const items = raw.filter((x): x is MontageItem => x && typeof x === "object" && typeof x.url === "string")
    const clipSec = Math.max(3, Math.min(8, Math.floor(durationSec / items.length)))

    const jobId = `mvp-${Date.now().toString(36)}`
    const plan = {
      jobId,
      durationSec,
      clipSecPerVideo: clipSec,
      steps: [
        "선택 영상 다운로드 (videoUrl 우선)",
        `각 영상 앞 ${clipSec}초 추출`,
        "ffmpeg concat + BGM + 간단 자막",
        "mp4 출력",
      ],
      items: items.map((it, i) => ({
        index: i + 1,
        url: it.url,
        videoUrl: it.videoUrl || null,
        platform: it.platform || "unknown",
        title: it.title || "",
      })),
    }

    return NextResponse.json({
      status: "queued",
      jobId,
      plan,
      message:
        `짜집기 job ${jobId} 생성 (${durationSec}초). ffmpeg 워커(STEP 5) 연동 후 mp4 다운로드가 활성화됩니다. ` +
        "현재는 선택 영상을 믹스 소스에 저장하고 AI 쇼핑 숏폼에서 이어가세요.",
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "오류" }, { status: 500 })
  }
}
