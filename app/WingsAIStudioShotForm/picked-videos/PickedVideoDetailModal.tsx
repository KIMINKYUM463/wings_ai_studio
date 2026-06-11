"use client"

import { useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Eye, Flag, X } from "lucide-react"
import type { PickedVideoItem } from "@/lib/shotform-picked-videos-types"
import {
  formatViewCount,
  platformBadgeClass,
  platformLabel,
} from "@/lib/shotform-picked-videos-utils"
import { cn } from "@/lib/utils"

type Props = {
  video: PickedVideoItem | null
  onClose: () => void
}

export function PickedVideoDetailModal({ video, onClose }: Props) {
  useEffect(() => {
    if (!video) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = ""
      window.removeEventListener("keydown", onKey)
    }
  }, [video, onClose])

  return (
    <AnimatePresence>
      {video ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            type="button"
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            aria-label="닫기"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            role="dialog"
            aria-modal
            className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-[#12151c] shadow-2xl"
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70"
              aria-label="닫기"
            >
              <X className="h-5 w-5" />
            </button>

            <motion.div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5 pt-12">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
              >
                <h2 className="pr-8 text-xl font-bold text-white">
                  {video.index}. {video.productName}
                </h2>
                <p className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-400">
                  <Eye className="h-4 w-4 shrink-0" aria-hidden />
                  {formatViewCount(video.viewCount)}
                </p>
              </motion.div>

              {video.sourceUrls.length > 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 }}
                >
                  <p className="mb-2 text-xs font-medium text-slate-500">원본 소스</p>
                  <motion.div
                    className="flex flex-wrap gap-2"
                    initial="hidden"
                    animate="show"
                    variants={{
                      hidden: {},
                      show: { transition: { staggerChildren: 0.05 } },
                    }}
                  >
                    {video.platforms.map((p) => (
                      <motion.span
                        key={p}
                        variants={{
                          hidden: { opacity: 0, scale: 0.9 },
                          show: { opacity: 1, scale: 1 },
                        }}
                        className={cn(
                          "rounded px-2 py-1 text-[11px] font-bold",
                          platformBadgeClass(p)
                        )}
                      >
                        {platformLabel(p)}
                      </motion.span>
                    ))}
                  </motion.div>
                  <ul className="mt-2 space-y-1">
                    {video.sourceUrls.slice(0, 4).map((url) => (
                      <li key={url}>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate text-xs text-cyan-400/90 hover:text-cyan-300 hover:underline"
                        >
                          {url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ) : null}

              <motion.div
                className="mt-auto space-y-2.5"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 }}
              >
                {video.coupangLink ? (
                  <a
                    href={video.coupangLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center rounded-xl bg-[#e52528] py-3.5 text-sm font-bold text-white shadow-lg shadow-red-900/30 transition hover:bg-[#ff2d31]"
                  >
                    쿠팡 상품링크 바로가기
                  </a>
                ) : null}
              </motion.div>

              <button
                type="button"
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-400"
              >
                <Flag className="h-3.5 w-3.5" aria-hidden />
                링크 오류 신고
              </button>
            </motion.div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
