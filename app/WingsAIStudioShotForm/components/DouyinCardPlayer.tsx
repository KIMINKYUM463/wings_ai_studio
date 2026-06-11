"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { X } from "lucide-react"
import {
  douyinEmbedCandidates,
  extractDouyinVideoId,
  isDouyinDirectStreamUrl,
  withDouyinPlayerParams,
} from "@/lib/douyin-embed"
import { cn } from "@/lib/utils"
import { studio } from "./ShotFormStudioUI"

type DouyinCardPlayerProps = {
  pageUrl: string
  videoUrl?: string
  title: string
  poster?: string
  frameClass: string
  onClose: () => void
}

const EMBED_TRY_MS = 4500

export function DouyinCardPlayer({
  pageUrl,
  videoUrl,
  title,
  poster,
  frameClass,
  onClose,
}: DouyinCardPlayerProps) {
  const videoId = useMemo(() => extractDouyinVideoId(pageUrl), [pageUrl])
  const directSrc = useMemo(() => {
    const v = videoUrl?.trim() || ""
    if (!isDouyinDirectStreamUrl(v)) return null
    return `/api/proxy-video?url=${encodeURIComponent(v)}`
  }, [videoUrl])

  const candidates = useMemo(
    () => (videoId ? douyinEmbedCandidates(videoId).map((s) => withDouyinPlayerParams(s)) : []),
    [videoId]
  )

  const [embedIdx, setEmbedIdx] = useState(0)
  const [useDirect, setUseDirect] = useState(false)
  const [embedExhausted, setEmbedExhausted] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const tryNextEmbed = useCallback(() => {
    setEmbedIdx((i) => {
      if (i + 1 < candidates.length) return i + 1
      setEmbedExhausted(true)
      if (directSrc) setUseDirect(true)
      return i
    })
  }, [candidates.length, directSrc])

  useEffect(() => {
    setEmbedIdx(0)
    setUseDirect(false)
    setEmbedExhausted(false)
  }, [pageUrl, videoUrl])

  useEffect(() => {
    if (useDirect || embedExhausted || candidates.length === 0) return
    timerRef.current = setTimeout(tryNextEmbed, EMBED_TRY_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [embedIdx, useDirect, embedExhausted, candidates.length, tryNextEmbed])

  if (useDirect && directSrc) {
    return (
      <div className={frameClass}>
        <video
          key={directSrc}
          className="h-full min-h-[200px] w-full object-contain"
          controls
          playsInline
          autoPlay
          preload="metadata"
          poster={poster}
          title={title}
        >
          <source src={directSrc} />
        </video>
        <CloseButton onClose={onClose} />
      </div>
    )
  }

  if (embedExhausted && !directSrc) {
    return (
      <div className={frameClass}>
        <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 p-4 text-center">
          <p className="text-xs leading-relaxed text-slate-300">
            더우인 공식 embed가 이 환경에서 차단되었습니다.
            <br />
            「열기」로 더우인에서 직접 재생해 주세요.
          </p>
          <a
            href={pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(studio.btnPrimary, "px-3 py-1.5 text-xs")}
          >
            더우인에서 열기
          </a>
        </div>
        <CloseButton onClose={onClose} />
      </div>
    )
  }

  const src = candidates[embedIdx]
  if (!src) {
    return (
      <div className={frameClass}>
        <div className="flex h-full items-center justify-center p-3 text-xs text-slate-500">재생 URL 없음</div>
        <CloseButton onClose={onClose} />
      </div>
    )
  }

  return (
    <div className={frameClass}>
      <iframe
        key={src}
        title={title}
        src={src}
        className="absolute inset-0 h-full w-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="unsafe-url"
        onLoad={() => {
          if (timerRef.current) clearTimeout(timerRef.current)
        }}
      />
      <CloseButton onClose={onClose} />
    </div>
  )
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/75 text-white shadow hover:bg-black/90"
      aria-label="미리보기 닫기"
      onClick={onClose}
    >
      <X className="h-4 w-4" />
    </button>
  )
}
