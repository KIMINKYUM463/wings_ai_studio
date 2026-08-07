"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ExternalLink, Link2, Loader2, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  MAX_AUTO_EDIT_VIDEOS,
  type AutoEditPick,
  videoPickKey,
} from "@/lib/shotform-auto-edit-types"
import {
  MVP_DIRECT_URL_MIN_SLOTS,
  mvpDirectUrlSlotsFromText,
  mvpDirectUrlTextFromSlots,
  mvpDirectUrlVisibleSlotCount,
  parseMvpDirectUrls,
  type MvpResolvedUrlItem,
} from "@/lib/shotform-mvp-resolve-urls"
import { studio } from "../components/ShotFormStudioUI"
import { MvpXhsInlineVideoPreview } from "./MvpXhsMediaPreview"

type Props = {
  disabled?: boolean
  urlText: string
  onUrlTextChange: (text: string) => void
  resolved: MvpResolvedUrlItem[]
  onResolvedChange: (items: MvpResolvedUrlItem[]) => void
  onPicksReady: (picks: AutoEditPick[], resolved: MvpResolvedUrlItem[]) => void
  onPicksClear?: () => void
  onError?: (msg: string | null) => void
}

function shotformApifyToken(): string | null {
  if (typeof window === "undefined") return null
  return (localStorage.getItem("shotform_apify_token") || "").trim() || null
}

export function MvpDirectUrlPickPanel({
  disabled,
  urlText,
  onUrlTextChange,
  resolved,
  onResolvedChange,
  onPicksReady,
  onPicksClear,
  onError,
}: Props) {
  const [slots, setSlots] = useState(() => mvpDirectUrlSlotsFromText(urlText))
  const [slotCount, setSlotCount] = useState(() => mvpDirectUrlVisibleSlotCount(urlText))
  const [loading, setLoading] = useState(false)
  const lastEmittedTextRef = useRef(urlText)

  useEffect(() => {
    if (urlText === lastEmittedTextRef.current) return
    lastEmittedTextRef.current = urlText
    const nextSlots = mvpDirectUrlSlotsFromText(urlText)
    setSlots(nextSlots)
    const filled = nextSlots.filter(Boolean).length
    if (filled >= MAX_AUTO_EDIT_VIDEOS) setSlotCount(MAX_AUTO_EDIT_VIDEOS)
    else if (!filled) setSlotCount(MVP_DIRECT_URL_MIN_SLOTS)
  }, [urlText])

  const activeUrlText = useCallback(() => {
    return mvpDirectUrlTextFromSlots(slots.slice(0, slotCount))
  }, [slots, slotCount])

  const addSlot = useCallback(() => {
    setSlotCount((current) => {
      if (current >= MAX_AUTO_EDIT_VIDEOS) return current
      const nextCount = current + 1
      setSlots((previous) => {
        if (previous.length >= nextCount) return previous
        return [...previous, ...Array.from({ length: nextCount - previous.length }, () => "")]
      })
      return nextCount
    })
  }, [])

  const updateSlot = useCallback(
    (index: number, value: string) => {
      setSlots((prev) => {
        const next = [...prev]
        next[index] = value
        const text = mvpDirectUrlTextFromSlots(next.slice(0, slotCount))
        lastEmittedTextRef.current = text
        onUrlTextChange(text)
        if (!parseMvpDirectUrls(text).length) {
          onResolvedChange([])
          onPicksClear?.()
        }
        return next
      })
    },
    [onUrlTextChange, slotCount, onResolvedChange, onPicksClear]
  )

  const runResolve = useCallback(async () => {
    onError?.(null)
    onResolvedChange([])

    const text = activeUrlText()
    if (!text.trim()) {
      onError?.("도우인·샤오홍슈·TikTok 영상 URL을 입력해 주세요.")
      return
    }

    const urls = parseMvpDirectUrls(text)
    if (!urls.length) {
      onError?.("올바른 URL을 입력해 주세요.")
      return
    }

    const apify = shotformApifyToken()
    const hasDouyin = urls.some((u) => /douyin\.com|iesdouyin\.com|v\.douyin\.com/i.test(u))
    const hasXhs = urls.some((u) => /xiaohongshu\.com|xhslink\.com/i.test(u))
    if ((hasDouyin || hasXhs) && !apify) {
      onError?.(
        hasDouyin && hasXhs
          ? "도우인·샤오홍슈 URL 해석에 소스 검색 토큰(Apify)이 필요합니다."
          : hasDouyin
            ? "도우인 URL 해석에 소스 검색 토큰이 필요합니다."
            : "샤오홍슈 URL 해석에 소스 검색 토큰(Apify)이 필요합니다. 소스 찾기와 동일한 토큰을 설정해 주세요."
      )
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/shotform/mvp-resolve-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urlText: text,
          apifyApiKey: apify || undefined,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        items?: MvpResolvedUrlItem[]
        error?: string
      }
      if (!res.ok) {
        onError?.(json.error || `URL 해석 실패 (${res.status})`)
        return
      }

      const items = json.items ?? []
      onResolvedChange(items)

      const ok = items.filter((i) => i.videoUrl.startsWith("http") && !i.error)
      if (!ok.length) {
        const firstErr = items.find((i) => i.error)?.error || "재생 URL을 찾지 못했습니다."
        onError?.(firstErr)
        return
      }

      const picks: AutoEditPick[] = ok.map((item, i) => ({
        key: videoPickKey(item.noteUrl, item.videoUrl),
        video_id: `video_${String(i + 1).padStart(3, "0")}`,
        videoUrl: item.videoUrl,
        title: item.title,
        noteUrl: item.noteUrl,
        platform: item.platform,
      }))
      onPicksReady(picks, items)
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "네트워크 오류")
    } finally {
      setLoading(false)
    }
  }, [activeUrlText, onPicksReady, onError, onResolvedChange])

  const visibleSlots = slots.slice(0, slotCount)
  const canAddSlot = slotCount < MAX_AUTO_EDIT_VIDEOS
  const hasUrlInput = parseMvpDirectUrls(activeUrlText()).length > 0

  return (
    <div className="mt-3 space-y-3">
      <div className="space-y-2">
        {visibleSlots.map((value, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-center text-xs font-medium text-slate-500">{index + 1}</span>
            <input
              type="url"
              value={value}
              onChange={(e) => updateSlot(index, e.target.value)}
              disabled={disabled || loading}
              placeholder={
                index === 0
                  ? "도우인·샤오홍슈·TikTok 영상 URL"
                  : "추가 URL (선택)"
              }
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-white placeholder:text-slate-600"
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {canAddSlot ? (
          <button
            type="button"
            disabled={disabled || loading}
            onClick={addSlot}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-xs text-slate-300 transition hover:border-violet-500/40 hover:text-violet-200 disabled:opacity-50"
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            URL 추가
          </button>
        ) : null}
        <button
          type="button"
          disabled={disabled || loading || !hasUrlInput}
          onClick={() => void runResolve()}
          className={cn(
            studio.btnPrimary,
            "inline-flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-50"
          )}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              URL 해석 중…
            </>
          ) : (
            <>
              <Link2 className="h-4 w-4" />
              URL 해석
            </>
          )}
        </button>
        <span className="text-xs text-slate-500">
          해석 후 하단 「AI 리믹스」 실행 · 도우인·TikTok은 소스 검색 토큰 권장 · 최대 {MAX_AUTO_EDIT_VIDEOS}개
        </span>
      </div>

      {resolved.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {resolved.map((item) => {
            const ok = item.videoUrl.startsWith("http") && !item.error
            const isDouyin = item.platform === "douyin"
            const isTikTok = item.platform === "tiktok"
            return (
              <div
                key={item.inputUrl}
                className={cn(
                  "overflow-hidden rounded-xl border bg-black/20",
                  ok
                    ? isDouyin
                      ? "border-amber-500/25"
                      : isTikTok
                        ? "border-cyan-500/25"
                        : "border-rose-500/25"
                    : "border-red-500/30"
                )}
              >
                {ok ? (
                  <MvpXhsInlineVideoPreview
                    videoUrl={item.videoUrl}
                    title={item.title}
                    aspectClass="aspect-[9/16]"
                    loadPriority="eager"
                  />
                ) : (
                  <div className="flex aspect-[9/16] items-center justify-center bg-black/40 p-4 text-center text-xs text-red-300">
                    {item.error || "해석 실패"}
                  </div>
                )}
                <div className="p-3">
                  <p className="line-clamp-2 text-sm font-medium text-white">
                    {item.title || item.inputUrl}
                  </p>
                  <span
                    className={cn(
                      "mt-1 inline-block rounded px-1.5 py-0.5 text-[10px]",
                      isDouyin
                        ? "bg-amber-950/80 text-amber-200"
                        : isTikTok
                          ? "bg-cyan-950/80 text-cyan-200"
                          : "bg-rose-950/80 text-rose-200"
                    )}
                  >
                    {isDouyin ? "도우인" : isTikTok ? "TikTok" : "샤오홍슈"}
                  </span>
                </div>
                {item.noteUrl ? (
                  <a
                    href={item.noteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 border-t border-white/[0.06] px-3 py-2 text-xs text-slate-400 hover:text-violet-300"
                  >
                    <ExternalLink className="h-3 w-3" />
                    원본 보기
                  </a>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
