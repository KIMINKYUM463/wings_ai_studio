"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"

import { isAllowedVideoHost } from "@/lib/video-upstream-fetch"

function normalizeMediaUrl(url: string): string {
  const s = url.trim()
  if (!s) return ""
  if (s.startsWith("//")) return `https:${s}`
  if (s.startsWith("http://")) return `https://${s.slice(7)}`
  return s
}

function isXhsCdnHost(hostname: string): boolean {
  return (
    hostname.endsWith(".xhscdn.com") ||
    hostname.endsWith(".xhscdn.net") ||
    hostname.includes("xiaohongshu.com") ||
    hostname.endsWith(".douyinpic.com")
  )
}

export function xhsThumbDirect(url: string): string {
  return normalizeMediaUrl(url)
}

export function xhsThumbProxy(url: string): string {
  const raw = normalizeMediaUrl(url)
  if (!raw.startsWith("http")) return ""
  try {
    if (isXhsCdnHost(new URL(raw).hostname)) {
      return `/api/proxy-image?url=${encodeURIComponent(raw)}`
    }
  } catch {
    /* ignore */
  }
  return raw
}

export function xhsVideoProxy(url: string): string {
  const raw = normalizeMediaUrl(url)
  if (!raw.startsWith("http")) return ""
  try {
    const host = new URL(raw).hostname
    if (
      host.endsWith(".xhscdn.com") ||
      host.endsWith(".xhscdn.net") ||
      host.includes("sns-video") ||
      isAllowedVideoHost(host)
    ) {
      return `/api/proxy-video?url=${encodeURIComponent(raw)}`
    }
  } catch {
    /* ignore */
  }
  return raw
}

export function proxyXhsThumb(url: string): string {
  return xhsThumbProxy(url)
}

type MvpXhsMediaPreviewProps = {
  thumbnail?: string
  videoUrl?: string
  title?: string
  aspectClass?: string
  imgClassName?: string
}

type MvpXhsInlineVideoPreviewProps = {
  videoUrl?: string
  thumbnail?: string
  title?: string
  aspectClass?: string
  videoClassName?: string
  /** 상단 그리드 — IntersectionObserver 없이 즉시 src 연결 */
  loadPriority?: "eager" | "lazy"
}

/** 小红书 썸네일만 표시 (MP4 요청 없음) */
export function MvpXhsMediaPreview({
  thumbnail,
  title = "",
  aspectClass = "aspect-[3/4]",
  imgClassName = "h-full w-full object-cover",
}: MvpXhsMediaPreviewProps) {
  const direct = xhsThumbDirect(thumbnail || "")
  const proxied = direct ? xhsThumbProxy(thumbnail || "") : ""

  const attempts = useMemo(() => {
    const list: string[] = []
    if (proxied) list.push(proxied)
    if (direct && direct !== proxied) list.push(direct)
    return list
  }, [direct, proxied])

  const [attemptIdx, setAttemptIdx] = useState(0)

  useEffect(() => {
    setAttemptIdx(0)
  }, [thumbnail, attempts])

  const imgSrc = attempts[attemptIdx] || ""
  const showImg = Boolean(imgSrc) && attemptIdx < attempts.length

  const onImgError = useCallback(() => {
    setAttemptIdx((i) => (i + 1 < attempts.length ? i + 1 : attempts.length))
  }, [attempts.length])

  const isProxySrc = imgSrc.startsWith("/api/proxy-image")

  return (
    <div className={cn("relative overflow-hidden bg-slate-900", aspectClass)}>
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imgSrc}
          alt={title}
          className={cn(imgClassName, "relative z-0")}
          loading="lazy"
          decoding="async"
          referrerPolicy={isProxySrc ? undefined : "no-referrer"}
          onError={onImgError}
        />
      ) : (
        <div className="flex h-full min-h-[80px] items-center justify-center p-2 text-center text-[10px] text-slate-500">
          {title.slice(0, 36) || "썸네일 없음"}
        </div>
      )}
    </div>
  )
}

function usePosterSrc(thumbnail?: string): string | undefined {
  const direct = xhsThumbDirect(thumbnail || "")
  const proxied = direct ? xhsThumbProxy(thumbnail || "") : ""
  return proxied || direct || undefined
}

/** 카드 안에서 바로 재생 — eager는 즉시, lazy는 뷰포트 근처에서 로드 */
export function MvpXhsInlineVideoPreview({
  videoUrl,
  thumbnail,
  title = "",
  aspectClass = "aspect-[3/4]",
  videoClassName = "h-full w-full object-cover",
  loadPriority = "lazy",
}: MvpXhsInlineVideoPreviewProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const eager = loadPriority === "eager"
  const [inView, setInView] = useState(eager)
  const hasVideo = Boolean(videoUrl?.trim().startsWith("http"))
  const poster = usePosterSrc(thumbnail)
  const shouldLoad = (inView || eager) && hasVideo
  const videoSrc = shouldLoad ? xhsVideoProxy(videoUrl!) : ""

  useEffect(() => {
    setInView(eager)
  }, [videoUrl, eager])

  useEffect(() => {
    if (eager || !hasVideo) return
    const el = rootRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setInView(true)
      },
      { rootMargin: "600px 0px", threshold: 0 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasVideo, videoUrl, eager])

  if (!hasVideo) {
    return <MvpXhsMediaPreview thumbnail={thumbnail} title={title} aspectClass={aspectClass} />
  }

  return (
    <div ref={rootRef} className={cn("relative bg-black", aspectClass)}>
      {videoSrc ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          key={videoSrc}
          src={videoSrc}
          className={cn("block h-full w-full object-contain", videoClassName)}
          controls
          controlsList="nodownload noremoteplayback"
          playsInline
          muted
          autoPlay
          loop
          preload={eager ? "auto" : "metadata"}
          poster={poster}
          title={title}
        />
      ) : (
        <div className="relative flex h-full min-h-[120px] items-center justify-center bg-slate-900">
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" loading="lazy" />
          ) : (
            <p className="px-2 text-center text-[10px] text-slate-500">{title.slice(0, 40) || "영상"}</p>
          )}
          <span className="relative z-10 rounded-full bg-black/70 px-2 py-1 text-[10px] text-slate-300">▶</span>
        </div>
      )}
    </div>
  )
}
