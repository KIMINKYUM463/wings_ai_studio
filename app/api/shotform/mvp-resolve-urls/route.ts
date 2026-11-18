import { type NextRequest, NextResponse } from "next/server"
import { MAX_AUTO_EDIT_VIDEOS } from "@/lib/shotform-auto-edit-types"
import {
  detectMvpUrlPlatform,
  normalizeMvpDirectInputUrl,
  parseMvpDirectUrls,
  type MvpResolvedUrlItem,
} from "@/lib/shotform-mvp-resolve-urls"
import { resolveTikhubKey, resolveTikhubVideo, tikhubErrorMessage } from "@/lib/tikhub"

export const maxDuration = 300

/** POST — 도우인·샤오홍슈·TikTok URL(최대 MAX_AUTO_EDIT_VIDEOS개) → TikHub로 원본 mp4·메타 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const tikhubKey = resolveTikhubKey(body.tikhubApiKey)

    let urls: string[] = []
    if (Array.isArray(body.urls)) {
      urls = body.urls.filter((u): u is string => typeof u === "string").map((u) => u.trim()).filter(Boolean)
    } else if (typeof body.urlText === "string" && body.urlText.trim()) {
      urls = parseMvpDirectUrls(body.urlText)
    }
    urls = [...new Map(urls.map((u) => [u.toLowerCase(), u])).values()]

    if (!urls.length) {
      return NextResponse.json({ error: "도우인·샤오홍슈·TikTok 영상 URL을 1개 이상 입력해 주세요." }, { status: 400 })
    }
    if (urls.length > MAX_AUTO_EDIT_VIDEOS) {
      return NextResponse.json({ error: `한 번에 최대 ${MAX_AUTO_EDIT_VIDEOS}개 URL만 처리할 수 있습니다.` }, { status: 400 })
    }
    if (!tikhubKey) {
      return NextResponse.json(
        { error: "URL 해석에 TikHub API 키가 필요합니다. ShotForm 설정에 저장해 주세요." },
        { status: 400 }
      )
    }

    const items: MvpResolvedUrlItem[] = await Promise.all(
      urls.map(async (inputUrl): Promise<MvpResolvedUrlItem> => {
        const normalized = normalizeMvpDirectInputUrl(inputUrl)
        const platform = detectMvpUrlPlatform(normalized) ?? "douyin"
        try {
          const row = await resolveTikhubVideo(tikhubKey, normalized)
          if (!row?.videoUrl) {
            return { inputUrl, noteUrl: normalized, videoUrl: "", platform, title: "", error: "영상 주소를 찾지 못했습니다 (이미지 노트이거나 삭제된 영상)" }
          }
          return {
            inputUrl,
            noteUrl: row.url,
            videoUrl: row.videoUrl,
            platform: (row.platform as MvpResolvedUrlItem["platform"]) || platform,
            title: row.title,
          }
        } catch (e) {
          return { inputUrl, noteUrl: normalized, videoUrl: "", platform, title: "", error: tikhubErrorMessage(e) }
        }
      })
    )
    const ok = items.filter((i) => i.videoUrl.startsWith("http"))
    const failed = items.filter((i) => i.error || !i.videoUrl.startsWith("http"))

    return NextResponse.json({
      items,
      count: items.length,
      successCount: ok.length,
      notice:
        ok.length > 0
          ? `${ok.length}개 URL 해석 완료 — 짜집기에 바로 사용할 수 있습니다.`
          : "해석된 영상이 없습니다. URL·TikHub 키를 확인해 주세요.",
      errors: failed.length ? failed.map((f) => ({ url: f.inputUrl, error: f.error || "videoUrl 없음" })) : undefined,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "URL 해석 오류" }, { status: 500 })
  }
}
