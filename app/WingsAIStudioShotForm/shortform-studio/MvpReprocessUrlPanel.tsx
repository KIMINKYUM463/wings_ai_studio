"use client"

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { type AutoEditPick, videoPickKey } from "@/lib/shotform-auto-edit-types"
import { parseReprocessUrl, type MvpReprocessResolvedItem } from "@/lib/shotform-mvp-reprocess-url-shared"

const REPROCESS_URL_DEBOUNCE_MS = 700

export type MvpReprocessUrlPanelHandle = {
  /** URL 해석이 안 됐으면 지금 해석. 성공 여부 반환 */
  resolveNow: () => Promise<boolean>
  resolving: boolean
}

type Props = {
  disabled?: boolean
  urlText: string
  onUrlTextChange: (text: string) => void
  resolved: MvpReprocessResolvedItem | null
  onResolvedChange: (item: MvpReprocessResolvedItem | null) => void
  onPicksReady: (picks: AutoEditPick[], resolved: MvpReprocessResolvedItem) => void
  onPicksClear?: () => void
  onError?: (msg: string | null) => void
  onResolvingChange?: (resolving: boolean) => void
}

function shotformApifyToken(): string | null {
  if (typeof window === "undefined") return null
  return (localStorage.getItem("shotform_apify_token") || "").trim() || null
}

export const MvpReprocessUrlPanel = forwardRef<MvpReprocessUrlPanelHandle, Props>(
  function MvpReprocessUrlPanel(
    {
      disabled,
      urlText,
      onUrlTextChange,
      resolved,
      onResolvedChange,
      onPicksReady,
      onPicksClear,
      onError,
      onResolvingChange,
    },
    ref
  ) {
    const [loading, setLoading] = useState(false)
    const lastEmittedTextRef = useRef(urlText)
    const lastResolvedInputRef = useRef<string | null>(null)
    const resolveGenRef = useRef(0)

    const setResolving = useCallback(
      (next: boolean) => {
        setLoading(next)
        onResolvingChange?.(next)
      },
      [onResolvingChange]
    )

    const runResolve = useCallback(
      async (inputUrl: string): Promise<boolean> => {
        const url = parseReprocessUrl(inputUrl)
        if (!url) {
          onError?.("YouTube 또는 TikTok 영상 URL을 입력해 주세요.")
          return false
        }

        if (lastResolvedInputRef.current === url && resolved?.videoUrl.startsWith("http") && !resolved.error) {
          return true
        }

        const gen = ++resolveGenRef.current
        onError?.(null)
        setResolving(true)

        const apify = shotformApifyToken()
        const needsApifyHint =
          !apify && typeof window !== "undefined"
            ? "배포 서버에 yt-dlp가 없으면 ShotForm 설정의 소스 검색 토큰이 필요할 수 있습니다."
            : ""

        try {
          const res = await fetch("/api/shotform/mvp-reprocess-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url,
              apifyApiKey: apify || undefined,
            }),
          })
          const json = (await res.json().catch(() => ({}))) as {
            item?: MvpReprocessResolvedItem
            error?: string
          }
          if (gen !== resolveGenRef.current) return false

          if (!res.ok) {
            onError?.(json.error || `영상 해석 실패 (${res.status})`)
            return false
          }

          const item = json.item
          if (!item) {
            onError?.("응답에 영상 정보가 없습니다.")
            return false
          }

          onResolvedChange(item)

          if (!item.videoUrl.startsWith("http") || item.error) {
            onError?.(item.error || "재생 URL을 찾지 못했습니다." + (needsApifyHint ? ` ${needsApifyHint}` : ""))
            return false
          }

          const picks: AutoEditPick[] = [
            {
              key: videoPickKey(item.noteUrl, item.videoUrl),
              video_id: "video_001",
              videoUrl: item.videoUrl,
              title: item.title,
              noteUrl: item.noteUrl,
              platform: item.platform,
            },
          ]
          lastResolvedInputRef.current = url
          onPicksReady(picks, item)
          return true
        } catch (e) {
          if (gen === resolveGenRef.current) {
            onError?.(e instanceof Error ? e.message : "네트워크 오류")
          }
          return false
        } finally {
          if (gen === resolveGenRef.current) setResolving(false)
        }
      },
      [onPicksReady, onError, onResolvedChange, resolved, setResolving]
    )

    useImperativeHandle(
      ref,
      () => ({
        resolveNow: () => runResolve(urlText),
        resolving: loading,
      }),
      [runResolve, urlText, loading]
    )

    useEffect(() => {
      if (urlText === lastEmittedTextRef.current) return
      lastEmittedTextRef.current = urlText

      const url = parseReprocessUrl(urlText)
      if (!url) {
        lastResolvedInputRef.current = null
        onResolvedChange(null)
        onPicksClear?.()
        return
      }

      if (lastResolvedInputRef.current === url) return

      const timer = window.setTimeout(() => {
        void runResolve(urlText)
      }, REPROCESS_URL_DEBOUNCE_MS)

      return () => window.clearTimeout(timer)
    }, [urlText, onResolvedChange, onPicksClear, runResolve])

    return (
      <div className="mt-3 space-y-2">
        <input
          type="url"
          value={urlText}
          onChange={(e) => {
            const next = e.target.value
            lastEmittedTextRef.current = next
            onUrlTextChange(next)
            if (!parseReprocessUrl(next)) {
              lastResolvedInputRef.current = null
              onResolvedChange(null)
              onPicksClear?.()
            }
          }}
          disabled={disabled || loading}
          placeholder="https://www.youtube.com/watch?v=… 또는 https://www.tiktok.com/@…/video/…"
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-white placeholder:text-slate-600"
        />

        {loading ? (
          <p className="inline-flex items-center gap-1.5 text-xs text-violet-200/90">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            영상 URL 해석 중…
          </p>
        ) : resolved?.title ? (
          <p className="text-xs text-slate-400">
            소스: <span className="text-slate-200">{resolved.title}</span>
            <span className="ml-2 text-slate-500">· 하단 「AI 짜집기」로 시작</span>
          </p>
        ) : parseReprocessUrl(urlText) ? (
          <p className="text-xs text-slate-500">URL 확인 후 하단 「AI 짜집기」를 눌러 주세요.</p>
        ) : (
          <p className="text-xs text-slate-500">YouTube·TikTok URL 1개 · 로컬은 yt-dlp, 배포는 Apify 토큰</p>
        )}
      </div>
    )
  }
)
