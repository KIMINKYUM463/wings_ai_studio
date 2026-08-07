"use client"

import { useEffect, useState } from "react"
import { Check, Copy, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ensureBilingualPrompt } from "./actions"

type Props = {
  prompt: string
  title?: string
  emptyText?: string
  className?: string
}

async function copyText(text: string) {
  if (!text.trim()) return false
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function PromptLangBlock({
  label,
  text,
  loading,
  onCopy,
  copied,
}: {
  label: string
  text: string
  loading: boolean
  onCopy: () => void
  copied: boolean
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          {label}
        </p>
        <button
          type="button"
          disabled={!text.trim() || loading}
          onClick={onCopy}
          className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-400 transition hover:border-white/20 hover:text-zinc-100 disabled:opacity-40"
          title={`${label} 복사`}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              복사됨
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              복사
            </>
          )}
        </button>
      </div>
      <div className="max-h-28 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-white/10 bg-black/40 p-2.5 font-mono text-[11px] leading-relaxed text-zinc-300">
        {loading && !text ? (
          <span className="inline-flex items-center gap-1.5 text-zinc-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            변환 중…
          </span>
        ) : (
          text || "—"
        )}
      </div>
    </div>
  )
}

/** 생성 프롬프트를 한글·영어로 보여주고 각각 복사 */
export function BilingualPromptPanel({
  prompt,
  title = "생성 프롬프트",
  emptyText = "프롬프트가 아직 없습니다.",
  className,
}: Props) {
  const [ko, setKo] = useState("")
  const [en, setEn] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState<"ko" | "en" | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const source = prompt.trim()

    if (!source) {
      setKo("")
      setEn("")
      setError("")
      setLoading(false)
      return
    }

    const run = async () => {
      setLoading(true)
      setError("")
      try {
        const apiKey =
          typeof window !== "undefined"
            ? localStorage.getItem("shotform_openai_api_key") || undefined
            : undefined
        const result = await ensureBilingualPrompt(source, apiKey)
        if (cancelled) return
        setKo(result.ko)
        setEn(result.en)
      } catch (e) {
        if (cancelled) return
        const hasHangul = /[가-힣]/.test(source)
        setKo(hasHangul ? source : "")
        setEn(hasHangul ? "" : source)
        setError(
          e instanceof Error
            ? e.message
            : "한·영 변환에 실패했습니다. OpenAI API 키를 확인해 주세요."
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [prompt, reloadKey])

  const handleCopy = async (lang: "ko" | "en") => {
    const text = lang === "ko" ? ko : en
    const ok = await copyText(text)
    if (!ok) return
    setCopied(lang)
    window.setTimeout(() => setCopied((prev) => (prev === lang ? null : prev)), 1500)
  }

  if (!prompt.trim()) {
    return (
      <div className={`rounded-xl border border-white/10 bg-black/25 p-3 space-y-2 ${className || ""}`}>
        <p className="text-xs font-semibold text-zinc-300">{title}</p>
        <p className="text-[11px] text-zinc-600">{emptyText}</p>
      </div>
    )
  }

  return (
    <div className={`rounded-xl border border-white/10 bg-black/25 p-3 space-y-3 ${className || ""}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-zinc-300">{title}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px] text-zinc-400 hover:text-zinc-100"
          disabled={loading}
          onClick={() => setReloadKey((n) => n + 1)}
          title="한·영 다시 변환"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          <span className="ml-1">다시 변환</span>
        </Button>
      </div>

      <PromptLangBlock
        label="한글"
        text={ko}
        loading={loading}
        copied={copied === "ko"}
        onCopy={() => void handleCopy("ko")}
      />
      <PromptLangBlock
        label="English"
        text={en}
        loading={loading}
        copied={copied === "en"}
        onCopy={() => void handleCopy("en")}
      />

      {error ? (
        <p className="text-[10px] leading-snug text-amber-300/90">{error}</p>
      ) : null}
    </div>
  )
}
