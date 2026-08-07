import { type NextRequest, NextResponse } from "next/server"
import { MAX_AUTO_EDIT_VIDEOS } from "@/lib/shotform-auto-edit-types"
import {
  detectMvpUrlPlatform,
  normalizeMvpDirectInputUrl,
  parseMvpDirectUrls,
  resolveMvpDirectUrls,
  type MvpResolvedUrlItem,
} from "@/lib/shotform-mvp-resolve-urls"
import { resolveReprocessUrl } from "@/lib/shotform-mvp-reprocess-url"

export const maxDuration = 300

function apifyTokenFromBody(body: Record<string, unknown>): string {
  return (
    (typeof body.apifyApiKey === "string" && body.apifyApiKey.trim()) ||
    process.env.APIFY_TOKEN ||
    ""
  )
}

/** POST — 도우인·샤오홍슈·TikTok URL(최대 MAX_AUTO_EDIT_VIDEOS개) → playUrl·메타 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const apifyToken = apifyTokenFromBody(body)

    let urls: string[] = []
    if (Array.isArray(body.urls)) {
      urls = body.urls.filter((u): u is string => typeof u === "string").map((u) => u.trim()).filter(Boolean)
    } else if (typeof body.urlText === "string" && body.urlText.trim()) {
      urls = parseMvpDirectUrls(body.urlText)
    }

    const seen = new Set<string>()
    const deduped: string[] = []
    for (const u of urls) {
      const k = u.toLowerCase()
      if (seen.has(k)) continue
      seen.add(k)
      deduped.push(u)
    }
    urls = deduped

    if (!urls.length) {
      return NextResponse.json({ error: "도우인·샤오홍슈·TikTok 영상 URL을 1개 이상 입력해 주세요." }, { status: 400 })
    }
    if (urls.length > MAX_AUTO_EDIT_VIDEOS) {
      return NextResponse.json(
        { error: `한 번에 최대 ${MAX_AUTO_EDIT_VIDEOS}개 URL만 처리할 수 있습니다.` },
        { status: 400 }
      )
    }

    const needsDouyin = urls.some((u) => /douyin\.com|iesdouyin\.com|v\.douyin\.com/i.test(u))
    const needsXhs = urls.some(
      (u) => detectMvpUrlPlatform(normalizeMvpDirectInputUrl(u)) === "xiaohongshu"
    )
    if ((needsDouyin || needsXhs) && !apifyToken) {
      return NextResponse.json(
        {
          error: needsDouyin && needsXhs
            ? "도우인·샤오홍슈 URL 해석에 소스 검색 토큰(Apify)이 필요합니다. ShotForm 설정에 저장해 주세요."
            : needsDouyin
              ? "도우인 URL 해석에 소스 검색 토큰이 필요합니다. ShotForm 설정에 소스 검색 토큰을 저장하거나 서버 환경 변수를 설정하세요."
              : "샤오홍슈 URL 해석에 소스 검색 토큰(Apify)이 필요합니다. 소스 찾기와 동일한 토큰을 ShotForm 설정에 저장해 주세요.",
        },
        { status: 400 }
      )
    }

    const items: MvpResolvedUrlItem[] = []
    for (const url of urls) {
      const normalized = normalizeMvpDirectInputUrl(url)
      if (detectMvpUrlPlatform(normalized) === "tiktok") {
        const resolved = await resolveReprocessUrl(apifyToken, normalized)
        items.push({
          inputUrl: url,
          noteUrl: resolved.noteUrl,
          videoUrl: resolved.videoUrl,
          platform: "tiktok",
          title: resolved.title || "(TikTok 영상)",
          error: resolved.error,
        })
        continue
      }
      const [resolved] = await resolveMvpDirectUrls(apifyToken, [url])
      if (resolved) items.push(resolved)
    }
    const ok = items.filter((i) => i.videoUrl.startsWith("http"))
    const failed = items.filter((i) => i.error || !i.videoUrl.startsWith("http"))

    return NextResponse.json({
      items,
      count: items.length,
      successCount: ok.length,
      notice:
        ok.length > 0
          ? `${ok.length}개 URL 해석 완료 — 짜집기에 바로 사용할 수 있습니다.`
          : "해석된 영상이 없습니다. URL·소스 검색 토큰을 확인해 주세요.",
      errors: failed.length ? failed.map((f) => ({ url: f.inputUrl, error: f.error || "videoUrl 없음" })) : undefined,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "URL 해석 오류" }, { status: 500 })
  }
}
