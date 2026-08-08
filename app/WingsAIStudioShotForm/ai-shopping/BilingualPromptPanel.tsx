"use client"

import { useEffect, useState } from "react"
import { Check, Copy, Download, ImageIcon, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ensureBilingualPrompt } from "./actions"

type Props = {
  prompt: string
  title?: string
  emptyText?: string
  className?: string
  /** 외부 AI에 넣을 제품 원본(레퍼런스) 사진 */
  referenceImageUrl?: string | null
  referenceDownloadName?: string
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

function extFromUrlOrMime(url: string): string {
  if (url.startsWith("data:image/png")) return "png"
  if (url.startsWith("data:image/webp")) return "webp"
  if (url.startsWith("data:image/jpeg") || url.startsWith("data:image/jpg")) return "jpg"
  const path = url.split("?")[0] || ""
  const m = path.match(/\.(png|jpe?g|webp|gif)$/i)
  return m ? m[1]!.toLowerCase().replace("jpeg", "jpg") : "jpg"
}

async function downloadReferenceImage(url: string, baseName: string) {
  const safe = (baseName || "product-original").replace(/[^\w가-힣\-]+/g, "_").slice(0, 80)
  const filename = `${safe}.${extFromUrlOrMime(url)}`
  try {
    if (url.startsWith("data:")) {
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      return
    }
    const res = await fetch(url, { mode: "cors" })
    if (!res.ok) throw new Error(`download ${res.status}`)
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = objectUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2000)
  } catch {
    // CORS 등으로 blob 실패 시 새 탭 (사용자가 저장 가능)
    window.open(url, "_blank", "noopener,noreferrer")
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

/** 생성 프롬프트를 한글·영어로 보여주고 각각 복사 (+ 제품 원본 사진 다운로드) */
export function BilingualPromptPanel({
  prompt,
  title = "생성 프롬프트",
  emptyText = "프롬프트가 아직 없습니다.",
  className,
  referenceImageUrl,
  referenceDownloadName = "product-original",
}: Props) {
  const [ko, setKo] = useState("")
  const [en, setEn] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState<"ko" | "en" | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [dlBusy, setDlBusy] = useState(false)

  const refUrl = typeof referenceImageUrl === "string" ? referenceImageUrl.trim() : ""

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

  const handleDownloadRef = async () => {
    if (!refUrl) return
    setDlBusy(true)
    try {
      await downloadReferenceImage(refUrl, referenceDownloadName)
    } finally {
      setDlBusy(false)
    }
  }

  const referenceBlock = refUrl ? (
    <div className="flex items-center gap-2 rounded-lg border border-sky-500/25 bg-sky-500/10 p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={refUrl}
        alt="제품 원본"
        className="h-12 w-12 shrink-0 rounded-md object-cover border border-white/15 bg-black/40"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-sky-100">제품 원본 사진</p>
        <p className="text-[10px] text-sky-200/70">
          외부 AI에 프롬프트와 같이 넣을 레퍼런스
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        className="h-8 shrink-0 bg-sky-600 px-2.5 text-[11px] font-semibold text-white hover:bg-sky-500"
        disabled={dlBusy}
        onClick={() => void handleDownloadRef()}
      >
        {dlBusy ? (
          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="mr-1 h-3.5 w-3.5" />
        )}
        사진 받기
      </Button>
    </div>
  ) : (
    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-[10px] text-zinc-500">
      <ImageIcon className="h-3.5 w-3.5 shrink-0" />
      제품 원본 사진이 없습니다. 소싱 단계에서 상품 사진을 넣어 주세요.
    </div>
  )

  if (!prompt.trim()) {
    return (
      <div className={`rounded-xl border border-white/10 bg-black/25 p-3 space-y-2 ${className || ""}`}>
        <p className="text-xs font-semibold text-zinc-300">{title}</p>
        {referenceBlock}
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

      {referenceBlock}

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
