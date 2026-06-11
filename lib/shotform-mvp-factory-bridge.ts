import type { AutoEditPick } from "@/lib/shotform-auto-edit-types"
import {
  MIX_FACTORY_URL_MIN,
  type MixSourceItem,
  writeMixPipelineResult,
  writeMixSourcesToSession,
  writeProductInputUrlToSession,
} from "@/lib/shotform-mix-source"

export const SHOTFORM_FACTORY_BACK_KEY = "shotform_factory_back"

export type FactoryBackLink = {
  href: string
  label: string
}

export function autoEditPickToMixSource(pick: AutoEditPick): MixSourceItem {
  return {
    url: pick.noteUrl || pick.videoUrl,
    title: pick.title || "레퍼런스 영상",
    platform: pick.platform || "xiaohongshu",
    thumbnail: "",
    videoUrl: pick.videoUrl,
  }
}

export function autoEditPicksToMixSources(picks: AutoEditPick[]): MixSourceItem[] {
  return picks.map(autoEditPickToMixSource)
}

export function writeFactoryBackLink(link: FactoryBackLink) {
  if (typeof window === "undefined") return
  sessionStorage.setItem(SHOTFORM_FACTORY_BACK_KEY, JSON.stringify(link))
}

export function readFactoryBackLink(): FactoryBackLink | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(SHOTFORM_FACTORY_BACK_KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as Record<string, unknown>
    if (typeof o.href !== "string" || typeof o.label !== "string") return null
    return { href: o.href, label: o.label }
  } catch {
    return null
  }
}

export type PushMvpPicksToFactoryArgs = {
  picks: AutoEditPick[]
  /** 영상 URL 키워드 분석에 쓴 YouTube 등 URL — 쇼핑숏폼 대본·미리보기 번들 매칭 */
  productInputUrl?: string | null
  /** AI 짜집기 완료 후 파이프라인 요약 (선택) */
  pipeline?: {
    targetSeconds: number
  }
}

export function pushMvpPicksToFactorySession(args: PushMvpPicksToFactoryArgs): {
  ok: boolean
  error?: string
  mixCount: number
} {
  const picks = args.picks.filter((p) => p.videoUrl?.trim().startsWith("http"))
  if (picks.length === 0) {
    return { ok: false, error: "선택된 영상 URL이 없습니다.", mixCount: 0 }
  }

  const autoEditDone = Boolean(args.pipeline)
  if (!autoEditDone && picks.length < MIX_FACTORY_URL_MIN) {
    return {
      ok: false,
      error: `쇼핑숏폼(대본·TTS·자막)은 소스를 ${MIX_FACTORY_URL_MIN}개 이상 선택하거나, 먼저 AI 짜집기를 완료해 주세요.`,
      mixCount: picks.length,
    }
  }

  let mixItems = autoEditPicksToMixSources(picks)
  // 쇼핑숏폼 1단계 URL 칸(최소 2칸) — 짜집기 1개 소스면 product URL 또는 동일 소스로 채움
  if (mixItems.length < MIX_FACTORY_URL_MIN) {
    const productUrl = args.productInputUrl?.trim()
    if (productUrl) {
      mixItems = [
        ...mixItems,
        {
          url: productUrl,
          title: mixItems[0]?.title || "레퍼런스 영상",
          platform: "youtube",
          thumbnail: "",
          videoUrl: productUrl,
        },
      ]
    } else if (mixItems[0]) {
      mixItems = [mixItems[0], { ...mixItems[0], title: `${mixItems[0].title} (2)` }]
    }
  }

  writeMixSourcesToSession(mixItems.slice(0, MIX_FACTORY_URL_MIN))

  const productUrl = args.productInputUrl?.trim()
  if (productUrl) writeProductInputUrlToSession(productUrl)

  if (args.pipeline) {
    writeMixPipelineResult({
      urls: mixItems.map((m) => m.url),
      titles: mixItems.map((m) => m.title),
      targetSeconds: args.pipeline.targetSeconds,
      finishedAt: new Date().toISOString(),
    })
  }

  writeFactoryBackLink({
    href: "/WingsAIStudioShotForm/shortform-studio",
    label: "숏폼 스튜디오로",
  })

  return { ok: true, mixCount: mixItems.length }
}
