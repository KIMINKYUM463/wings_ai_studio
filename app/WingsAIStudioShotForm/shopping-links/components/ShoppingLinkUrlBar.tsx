"use client"

import { useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { shoppingLinkPublicUrl, sanitizeShoppingLinkSlug } from "@/lib/shotform-shopping-link-types"

type SlugFieldProps = {
  slug: string
  onChange: (slug: string) => void
  /** 기본값 `URL` */
  label?: string
  required?: boolean
  inputId?: string
  className?: string
}

export function ShoppingLinkSlugField({
  slug,
  onChange,
  label = "공개 주소 (슬러그)",
  required,
  inputId = "shopping-link-slug",
  className,
}: SlugFieldProps) {
  const [draft, setDraft] = useState(slug)

  useEffect(() => {
    setDraft(slug)
  }, [slug])

  const previewUrl = useMemo(
    () => (sanitizeShoppingLinkSlug(draft) ? shoppingLinkPublicUrl(sanitizeShoppingLinkSlug(draft)) : ""),
    [draft]
  )

  return (
    <div className={className}>
      <Label htmlFor={inputId} className="text-slate-300">
        {label}
        {required ? " *" : null}
      </Label>
      <Input
        id={inputId}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const safe = sanitizeShoppingLinkSlug(draft)
          setDraft(safe)
          onChange(safe)
        }}
        placeholder="test1dfdf"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        className="mt-2 w-full min-w-0 border-slate-700 bg-slate-950 text-white"
      />
      {previewUrl ? (
        <p className="mt-2 break-all text-[10px] leading-relaxed text-slate-400">{previewUrl}</p>
      ) : (
        <p className="mt-2 text-[10px] text-slate-500">영문·숫자·하이픈만 입력 (예: wings-shop)</p>
      )}
      <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
        한글은 자동 변환되지 않습니다. <span className="text-slate-400">wings-shop</span>처럼 영문으로 입력해 주세요.
      </p>
    </div>
  )
}

type Props = {
  slug: string
}

/** 공개 URL 표시·복사 (슬러그 편집은 `ShoppingLinkSlugField` — 프로필 설정에서만 사용) */
export function ShoppingLinkUrlBar({ slug }: Props) {
  const [copied, setCopied] = useState(false)
  const url = useMemo(() => (slug.trim() ? shoppingLinkPublicUrl(slug.trim()) : ""), [slug])

  if (!slug.trim()) {
    return (
      <p className="mx-auto mt-4 max-w-[280px] text-center text-xs text-slate-500">
        프로필에서 슬러그를 설정하면 공개 URL이 생성됩니다.
      </p>
    )
  }

  const btnClass =
    "inline-flex min-h-9 flex-1 items-center justify-center rounded-lg border border-slate-600 bg-slate-800/80 px-2 py-2 text-center text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-700 hover:text-white"

  return (
    <div className="mx-auto mt-4 w-full max-w-[280px]">
      <p className="mb-2 break-all text-center text-[10px] leading-relaxed text-slate-400">{url}</p>
      <div className="flex gap-2 rounded-xl border border-slate-700 bg-slate-900/80 p-3">
        <a href={url} target="_blank" rel="noopener noreferrer" className={btnClass}>
          URL 이동하기
        </a>
        <button
          type="button"
          className={btnClass}
          onClick={() => {
            void navigator.clipboard.writeText(url)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1500)
          }}
        >
          URL 복사하기
        </button>
      </div>
      {copied ? <p className="mt-2 text-center text-[10px] text-emerald-400">복사됨</p> : null}
    </div>
  )
}
