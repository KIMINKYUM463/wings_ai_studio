"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { type AutoEditPick, videoPickKey } from "@/lib/shotform-auto-edit-types"
import { parseReprocessUrl, type MvpReprocessResolvedItem } from "@/lib/shotform-mvp-reprocess-url-shared"
import { studio } from "../components/ShotFormStudioUI"

type Props = {
  disabled?: boolean
  urlText: string
  onUrlTextChange: (text: string) => void
  resolved: MvpReprocessResolvedItem | null
  onResolvedChange: (item: MvpReprocessResolvedItem | null) => void
  onPicksReady: (picks: AutoEditPick[], resolved: MvpReprocessResolvedItem) => void
  onPicksClear?: () => void
  onError?: (msg: string | null) => void
}

function shotformApifyToken(): string | null {
  if (typeof window === "undefined") return null
  return (localStorage.getItem("shotform_apify_token") || "").trim() || null
}

function formatResolveError(raw: string | undefined): string {
  const msg = (raw || "").trim()
  if (!msg) return "영상 URL 해석에 실패했습니다."
  if (msg.startsWith("{")) {
    try {
      const j = JSON.parse(msg) as { error?: { message?: string } }
      const inner = j?.error?.message?.trim()
      if (inner) {
        if (/run did not succeed|run-failed|status:\s*FAILED/i.test(inner)) {
          return "Apify 영상 조회에 실패했습니다. TikTok은 토큰·Actor 구독을 확인해 주세요."
        }
        return inner.length > 240 ? `${inner.slice(0, 240)}…` : inner
      }
    } catch {
      /* plain */
    }
  }
  return msg.length > 280 ? `${msg.slice(0, 280)}…` : msg
}

export function MvpReprocessUrlPanel({
  disabled,
  urlText,
  onUrlTextChange,
  resolved,
  onResolvedChange,
  onPicksReady,
  onPicksClear,
  onError,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [statusHint, setStatusHint] = useState("")
  const lastEmittedTextRef = useRef(urlText)

  useEffect(() => {
    if (urlText === lastEmittedTextRef.current) return
    lastEmittedTextRef.current = urlText
    if (!parseReprocessUrl(urlText)) {
      onResolvedChange(null)
      onPicksClear?.()
      setStatusHint("")
    }
  }, [urlText, onResolvedChange, onPicksClear])

  const runAutoEdit = useCallback(async () => {
    onError?.(null)
    onResolvedChange(null)
    setStatusHint("")

    const url = parseReprocessUrl(urlText)
    if (!url) {
      onError?.("YouTube 또는 TikTok 영상 URL을 입력해 주세요.")
      return
    }

    const apify = shotformApifyToken()
    const needsApifyHint =
      !apify && typeof window !== "undefined"
        ? "배포 서버에 yt-dlp가 없으면 ShotForm 설정의 소스 검색 토큰이 필요할 수 있습니다."
        : ""

    setLoading(true)
    setStatusHint("영상 URL 해석 중…")
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
      if (!res.ok) {
        onError?.(formatResolveError(json.error || `영상 해석 실패 (${res.status})`))
        return
      }

      const item = json.item
      if (!item) {
        onError?.("응답에 영상 정보가 없습니다.")
        return
      }

      onResolvedChange(item)

      if (!item.videoUrl.startsWith("http") || item.error) {
        onError?.(formatResolveError(item.error) + (needsApifyHint ? ` ${needsApifyHint}` : ""))
        return
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
      setStatusHint("AI 짜집기 시작…")
      onPicksReady(picks, item)
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "네트워크 오류")
    } finally {
      setLoading(false)
      setStatusHint("")
    }
  }, [urlText, onPicksReady, onError, onResolvedChange])

  const hasUrlInput = Boolean(parseReprocessUrl(urlText))

  return (
    <div className="mt-3 space-y-3">
      <input
        type="url"
        value={urlText}
        onChange={(e) => {
          const next = e.target.value
          lastEmittedTextRef.current = next
          onUrlTextChange(next)
          if (!parseReprocessUrl(next)) {
            onResolvedChange(null)
            onPicksClear?.()
          }
        }}
        disabled={disabled || loading}
        placeholder="https://www.youtube.com/watch?v=… 또는 https://www.tiktok.com/@…/video/…"
        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-white placeholder:text-slate-600"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !loading && hasUrlInput) void runAutoEdit()
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={disabled || loading || !hasUrlInput}
          onClick={() => void runAutoEdit()}
          className={cn(
            studio.btnPrimary,
            "inline-flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-50"
          )}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {statusHint || "준비 중…"}
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              AI 짜집기
            </>
          )}
        </button>
        <span className="text-xs text-slate-500">
          URL 입력 후 Enter 또는 AI 짜집기 · YouTube는 서버 InnerTube, TikTok은 Apify 토큰
        </span>
      </div>

      {resolved?.title && !loading ? (
        <p className="text-xs text-slate-400">
          마지막 소스: <span className="text-slate-200">{resolved.title}</span>
        </p>
      ) : null}
    </div>
  )
}
