"use client"

import { useEffect } from "react"
import { isTypecastApi403Guide, TYPECAST_API_GUIDE, TYPECAST_API_GUIDE_EVENT } from "@/lib/typecast-api-error"

export function openTypecastApiGuide(rawMessage?: string) {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent(TYPECAST_API_GUIDE_EVENT, { detail: { rawMessage: rawMessage || "" } })
  )
}

export function TypecastApiGuideCard({
  rawMessage,
  compact = false,
}: {
  rawMessage?: string
  compact?: boolean
}) {
  return (
    <div
      className={
        compact
          ? "rounded-xl border border-amber-400/40 bg-amber-950/70 px-3 py-3 text-left text-amber-50"
          : "rounded-2xl border border-amber-400/50 bg-zinc-950 px-4 py-4 text-left text-zinc-100"
      }
    >
      <p className="text-sm font-semibold text-amber-200">{TYPECAST_API_GUIDE.title}</p>
      <p className="mt-1 text-xs leading-relaxed text-amber-100/90">{TYPECAST_API_GUIDE.subtitle}</p>
      <ul className="mt-2 space-y-1 text-xs leading-relaxed text-zinc-200">
        {TYPECAST_API_GUIDE.body.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <ol className="mt-3 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-zinc-100">
        {TYPECAST_API_GUIDE.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        {TYPECAST_API_GUIDE.links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-md bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-zinc-950 hover:bg-amber-400"
          >
            {link.label}
          </a>
        ))}
      </div>
      {rawMessage ? (
        <p className="mt-3 max-h-16 overflow-auto whitespace-pre-wrap break-words rounded-md bg-black/40 px-2 py-1.5 font-mono text-[10px] text-zinc-400">
          {rawMessage}
        </p>
      ) : null}
    </div>
  )
}

/** 오류가 타입캐스트 403이면 안내 모달을 열고, 아래에 안내 카드도 붙입니다. */
export function TypecastApiErrorNotice({ message }: { message: string | null | undefined }) {
  useEffect(() => {
    if (message && isTypecastApi403Guide(message)) openTypecastApiGuide(message)
  }, [message])
  if (!message || !isTypecastApi403Guide(message)) return null
  return (
    <div className="mt-2">
      <TypecastApiGuideCard rawMessage={message} compact />
    </div>
  )
}

export { TYPECAST_API_GUIDE_EVENT }
