"use client"

import { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Search } from "lucide-react"

type KeyframeItem = { index: number; imageUrl: string; label?: string }

function keyframeAbsoluteUrl(imageUrl: string): string {
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) return imageUrl
  return `${window.location.origin}${imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`}`
}

function keyframeFetchSrc(imageUrl: string): string {
  if (imageUrl.startsWith("/api/")) return imageUrl
  if (imageUrl.includes("i.ytimg.com") || imageUrl.includes("img.youtube.com")) {
    return `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`
  }
  return imageUrl
}

type KeyframeSearchGridProps = {
  keyframes: KeyframeItem[]
  serpApiKey?: string
  onError?: (msg: string) => void
  onToast?: (msg: string) => void
}

export function KeyframeSearchGrid({
  keyframes,
  serpApiKey,
  onError,
  onToast,
}: KeyframeSearchGridProps) {
  const [lensBusy, setLensBusy] = useState<string | null>(null)

  const openWebLens = useCallback(
    async (imageUrl: string, busyKey: string) => {
      setLensBusy(busyKey)
      try {
        const absUrl = keyframeAbsoluteUrl(imageUrl)
        const res = await fetch("/api/serpapi/lens-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: absUrl, provider: "google" as const, serpApiKey: serpApiKey || undefined }),
        })
        const json = (await res.json().catch(() => ({}))) as { targetUrl?: string; error?: string; notice?: string }
        if (!res.ok || !json.targetUrl) {
          onError?.(json.error || "이미지 검색 링크를 만들지 못했습니다.")
          return
        }
        if (json.notice) onToast?.(json.notice)
        window.open(json.targetUrl, "_blank", "noopener,noreferrer")
      } catch (e) {
        onError?.(e instanceof Error ? e.message : "네트워크 오류")
      } finally {
        setLensBusy(null)
      }
    },
    [onError, onToast, serpApiKey]
  )

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 pt-1 [-ms-overflow-style:none] [scrollbar-width:thin]">
      {keyframes.map((kf) => {
        const busyKey = `g-${kf.index}`
        const busy = lensBusy === busyKey
        return (
          <div key={`${kf.imageUrl}-${kf.index}`} className="flex w-[min(168px,28vw)] shrink-0 flex-col gap-2">
            <div className="relative aspect-[9/16] overflow-hidden rounded-lg border border-slate-600 bg-black">
              <span className="absolute left-2 top-2 z-[1] rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-slate-100">
                #{kf.index}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={keyframeFetchSrc(kf.imageUrl)}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="h-9 w-full bg-blue-600 px-2 text-xs font-medium text-white hover:bg-blue-500"
              disabled={!!lensBusy}
              onClick={() => void openWebLens(kf.imageUrl, busyKey)}
            >
              {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 shrink-0 animate-spin" /> : <Search className="mr-1.5 h-3.5 w-3.5 shrink-0" />}
              웹으로 검색하기
            </Button>
          </div>
        )
      })}
    </div>
  )
}
