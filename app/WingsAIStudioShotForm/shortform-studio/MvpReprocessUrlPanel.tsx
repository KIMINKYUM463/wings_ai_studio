"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Upload, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { type AutoEditPick, videoPickKey } from "@/lib/shotform-auto-edit-types"
import {
  detectReprocessUrlPlatform,
  parseReprocessUrl,
  type MvpReprocessResolvedItem,
} from "@/lib/shotform-mvp-reprocess-url-shared"
import {
  fetchReprocessVideoBlobInBrowser,
  resolveYoutubeInBrowser,
} from "@/lib/shotform-youtube-browser-resolve"
import { studio } from "../components/ShotFormStudioUI"

export type MvpReprocessPicksReadyOptions = {
  prefetchedBlobs?: Record<string, Blob>
}

type Props = {
  disabled?: boolean
  urlText: string
  onUrlTextChange: (text: string) => void
  resolved: MvpReprocessResolvedItem | null
  onResolvedChange: (item: MvpReprocessResolvedItem | null) => void
  onPicksReady: (
    picks: AutoEditPick[],
    resolved: MvpReprocessResolvedItem,
    opts?: MvpReprocessPicksReadyOptions
  ) => void
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

function buildPickFromResolved(item: MvpReprocessResolvedItem): AutoEditPick {
  return {
    key: videoPickKey(item.noteUrl, item.videoUrl),
    video_id: "video_001",
    videoUrl: item.videoUrl,
    title: item.title,
    noteUrl: item.noteUrl,
    platform: item.platform,
  }
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
  const [lastError, setLastError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastEmittedTextRef = useRef(urlText)

  useEffect(() => {
    if (urlText === lastEmittedTextRef.current) return
    lastEmittedTextRef.current = urlText
    if (!parseReprocessUrl(urlText)) {
      onResolvedChange(null)
      onPicksClear?.()
      setStatusHint("")
      setLastError(null)
    }
  }, [urlText, onResolvedChange, onPicksClear])

  const prefetchYoutubeBlob = useCallback(
    async (item: MvpReprocessResolvedItem): Promise<Record<string, Blob> | undefined> => {
      if (item.platform !== "youtube" || !item.videoUrl.startsWith("http")) return undefined
      try {
        setStatusHint("브라우저에서 영상 수신 중… (CDN 우회)")
        const blob = await fetchReprocessVideoBlobInBrowser(item.videoUrl, (msg) => setStatusHint(msg))
        return { video_001: blob }
      } catch {
        return undefined
      }
    },
    []
  )

  const finishWithPicks = useCallback(
    async (item: MvpReprocessResolvedItem) => {
      onResolvedChange(item)
      const picks = [buildPickFromResolved(item)]
      const prefetchedBlobs = await prefetchYoutubeBlob(item)
      setStatusHint("AI 리믹스 시작…")
      onPicksReady(picks, item, prefetchedBlobs ? { prefetchedBlobs } : undefined)
    },
    [onPicksReady, onResolvedChange, prefetchYoutubeBlob]
  )

  const runAutoEdit = useCallback(async () => {
    onError?.(null)
    setLastError(null)
    onResolvedChange(null)
    setStatusHint("")

    const url = parseReprocessUrl(urlText)
    if (!url) {
      onError?.("YouTube 또는 TikTok 영상 URL을 입력해 주세요.")
      return
    }

    const platform = detectReprocessUrlPlatform(url)
    const apify = shotformApifyToken()
    const needsApifyHint =
      !apify && typeof window !== "undefined"
        ? " YouTube·TikTok 모두 ShotForm 설정의 Apify(소스 검색) 토큰이 필요합니다."
        : ""

    setLoading(true)
    setStatusHint("영상 URL 해석 중…")
    try {
      let resolvedItem: MvpReprocessResolvedItem | null = null
      let serverError: string | null = null

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
          serverError = formatResolveError(json.error || `영상 해석 실패 (${res.status})`)
        } else if (json.item) {
          resolvedItem = json.item
          if (!resolvedItem.videoUrl.startsWith("http") || resolvedItem.error) {
            serverError = formatResolveError(resolvedItem.error)
          }
        } else {
          serverError = "응답에 영상 정보가 없습니다."
        }
      } catch (e) {
        serverError = e instanceof Error ? e.message : "네트워크 오류"
      }

      if (
        platform === "youtube" &&
        !apify &&
        (!resolvedItem?.videoUrl.startsWith("http") || resolvedItem?.error)
      ) {
        setStatusHint("Apify 토큰 없음 — 브라우저(Piped·Invidious) 재시도…")
        try {
          const browser = await resolveYoutubeInBrowser(url)
          resolvedItem = {
            inputUrl: url,
            noteUrl: resolvedItem?.noteUrl || url,
            videoUrl: browser.videoUrl,
            title: browser.title || resolvedItem?.title || "(YouTube 영상)",
            platform: "youtube",
          }
          serverError = null
        } catch (browserErr) {
          const browserMsg =
            browserErr instanceof Error ? browserErr.message : "브라우저 해석 실패"
          const combined = [serverError, `브라우저 재시도: ${browserMsg}`]
            .filter(Boolean)
            .join("\n\n")
          setLastError(combined + needsApifyHint)
          onError?.(combined + needsApifyHint)
          if (resolvedItem) onResolvedChange(resolvedItem)
          return
        }
      }

      if (!resolvedItem?.videoUrl.startsWith("http")) {
        const msg = (serverError || "영상 URL을 찾지 못했습니다.") + needsApifyHint
        setLastError(msg)
        onError?.(msg)
        return
      }

      await finishWithPicks(resolvedItem)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "네트워크 오류"
      setLastError(msg)
      onError?.(msg)
    } finally {
      setLoading(false)
      setStatusHint("")
    }
  }, [urlText, onPicksReady, onError, onResolvedChange, finishWithPicks])

  const handleFileUpload = useCallback(
    async (file: File | undefined) => {
      if (!file) return
      onError?.(null)
      setLastError(null)
      setLoading(true)
      setStatusHint("업로드한 영상 준비 중…")
      try {
        if (!file.type.startsWith("video/") && !/\.mp4$/i.test(file.name)) {
          throw new Error("MP4 등 영상 파일만 업로드할 수 있습니다.")
        }
        if (file.size < 50_000) {
          throw new Error("영상 파일이 너무 작습니다.")
        }

        const noteUrl = `local-upload://${file.name}`
        const blobUrl = URL.createObjectURL(file)
        const item: MvpReprocessResolvedItem = {
          inputUrl: noteUrl,
          noteUrl,
          videoUrl: blobUrl,
          platform: "youtube",
          title: file.name.replace(/\.[^.]+$/, "") || "(업로드 영상)",
        }
        const picks: AutoEditPick[] = [buildPickFromResolved(item)]
        onResolvedChange(item)
        setStatusHint("AI 리믹스 시작…")
        onPicksReady(picks, item, { prefetchedBlobs: { video_001: file } })
      } catch (e) {
        const msg = e instanceof Error ? e.message : "업로드 오류"
        setLastError(msg)
        onError?.(msg)
      } finally {
        setLoading(false)
        setStatusHint("")
        if (fileInputRef.current) fileInputRef.current.value = ""
      }
    },
    [onError, onPicksReady, onResolvedChange]
  )

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
            setLastError(null)
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
              AI 리믹스
            </>
          )}
        </button>

        <button
          type="button"
          disabled={disabled || loading}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            studio.btnSecondary,
            "inline-flex items-center gap-2 px-3 py-2 text-sm disabled:opacity-50"
          )}
        >
          <Upload className="h-4 w-4" />
          MP4 업로드
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/*"
          className="hidden"
          onChange={(e) => void handleFileUpload(e.target.files?.[0])}
        />

        <span className="text-xs text-slate-500">
          YouTube·TikTok → Apify · YouTube는 Store에서 bytepulselabs Actor 추가 · 실패 시 MP4 업로드
        </span>
      </div>

      {lastError && !loading ? (
        <p className="text-xs text-amber-400/90">
          URL 해석이 안 되면 PC에 저장한 MP4를 「MP4 업로드」로 바로 리믹스할 수 있습니다.
        </p>
      ) : null}

      {resolved?.title && !loading ? (
        <p className="text-xs text-slate-400">
          마지막 소스: <span className="text-slate-200">{resolved.title}</span>
        </p>
      ) : null}
    </div>
  )
}
