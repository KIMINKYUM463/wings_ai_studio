"use client"

import { useState } from "react"
import { Check, Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Platform = "xiaohongshu" | "douyin"

function safeFilename(title: string, platform: Platform): string {
  const base = title
    .slice(0, 48)
    .replace(/[^\w\u4e00-\u9fff\uac00-\ud7af-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
  return `${base || platform}_${Date.now()}.mp4`
}

function shotformApifyToken(): string | null {
  if (typeof window === "undefined") return null
  return (localStorage.getItem("shotform_apify_token") || "").trim() || null
}

async function resolveDownloadUrl(
  noteUrl: string,
  videoUrl: string | undefined,
  platform: Platform,
  refreshFromNote = false
): Promise<{ downloadUrl: string | null; error?: string }> {
  const apifyApiKey = shotformApifyToken()
  const res = await fetch("/api/shotform/mvp-download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apifyApiKey: apifyApiKey || undefined,
      items: [
        {
          url: noteUrl,
          videoUrl: refreshFromNote ? "" : videoUrl || "",
          title: "",
          platform,
          refreshFromNote,
        },
      ],
    }),
  })
  const json = (await res.json().catch(() => ({}))) as {
    results?: Array<{ downloadUrl: string | null; error?: string }>
    error?: string
  }
  if (!res.ok) return { downloadUrl: null, error: json.error || "다운로드 URL 조회 실패" }
  const row = json.results?.[0]
  return { downloadUrl: row?.downloadUrl ?? null, error: row?.error }
}

export function MvpVideoSaveButton({
  noteUrl,
  videoUrl,
  title,
  platform,
  className,
}: {
  noteUrl: string
  videoUrl?: string
  title?: string
  platform: Platform
  className?: string
}) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle")
  const [hint, setHint] = useState("")

  const save = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!noteUrl && !videoUrl) {
      setState("error")
      setHint("URL 없음")
      return
    }
    setState("loading")
    setHint("")
    try {
      let direct = (videoUrl || "").trim()
      if (!direct && platform === "xiaohongshu" && noteUrl.includes("xiaohongshu")) {
        const xhsRes = await fetch(`/api/xhs-note-video?url=${encodeURIComponent(noteUrl)}`)
        const xhsJson = (await xhsRes.json().catch(() => ({}))) as { videoUrl?: string; error?: string }
        if (xhsRes.ok && xhsJson.videoUrl) direct = xhsJson.videoUrl
      }

      let { downloadUrl, error } = await resolveDownloadUrl(noteUrl, direct, platform)
      let blobRes = downloadUrl ? await fetch(downloadUrl) : null
      let blob = blobRes?.ok ? await blobRes.blob() : null

      const isDouyin =
        platform === "douyin" ||
        noteUrl.includes("douyin.com") ||
        noteUrl.includes("iesdouyin.com") ||
        noteUrl.includes("v.douyin.com")

      if ((!blob || blob.size < 50_000) && (isDouyin || (platform === "xiaohongshu" && noteUrl.includes("xiaohongshu")))) {
        const retry = await resolveDownloadUrl(noteUrl, direct, platform, true)
        if (retry.downloadUrl) {
          blobRes = await fetch(retry.downloadUrl)
          if (blobRes.ok) {
            blob = await blobRes.blob()
            downloadUrl = retry.downloadUrl
            error = retry.error
          }
        } else if (!error) {
          error = retry.error
        }
      }

      if (!downloadUrl || !blob || blob.size < 50_000) {
        setState("error")
        setHint(error || "MP4 없음")
        return
      }
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = safeFilename(title || "video", platform)
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(a.href)
      setState("done")
      setHint("저장됨")
      window.setTimeout(() => {
        setState("idle")
        setHint("")
      }, 2500)
    } catch (err) {
      setState("error")
      setHint(err instanceof Error ? err.message.slice(0, 40) : "오류")
    }
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 gap-1 border-white/15 bg-black/40 px-2 text-[11px] text-slate-200 hover:bg-white/10"
        disabled={state === "loading"}
        onClick={(e) => void save(e)}
      >
        {state === "loading" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : state === "done" ? (
          <Check className="h-3 w-3 text-emerald-400" />
        ) : (
          <Download className="h-3 w-3" />
        )}
        {state === "loading" ? "저장 중…" : state === "done" ? "완료" : "저장"}
      </Button>
      {hint ? (
        <span className={cn("text-[10px]", state === "error" ? "text-red-300" : "text-emerald-300")}>{hint}</span>
      ) : null}
    </div>
  )
}
