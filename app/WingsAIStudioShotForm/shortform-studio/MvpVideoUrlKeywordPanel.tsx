"use client"

import { useCallback, useMemo, useState } from "react"
import { Check, Link2, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { MvpVideoKeywordAnalysis } from "@/lib/shotform-mvp-video-keywords"
import { studio } from "../components/ShotFormStudioUI"

type Props = {
  disabled?: boolean
  onApplyKeywords: (keywords: string[]) => void
  /** 분석 성공 시 — 쇼핑숏폼 대본·미리보기 번들 매칭용 */
  onAnalyzedUrl?: (url: string) => void
}

function shotformOpenAIKey(): string | null {
  if (typeof window === "undefined") return null
  return (localStorage.getItem("shotform_openai_api_key") || "").trim() || null
}

const PLATFORM_LABEL: Record<string, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
}

const EVIDENCE_LABEL: Record<string, string> = {
  title: "제목",
  transcript: "대본·자막",
  ocr: "영상·장면",
  author: "작성자",
}

const QUALITY_STYLE: Record<string, string> = {
  high: "border-emerald-500/40 bg-emerald-950/30 text-emerald-200",
  medium: "border-amber-500/40 bg-amber-950/30 text-amber-200",
  low: "border-red-500/30 bg-red-950/20 text-red-200",
}

export function MvpVideoUrlKeywordPanel({ disabled, onApplyKeywords, onAnalyzedUrl }: Props) {
  const [videoUrl, setVideoUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<MvpVideoKeywordAnalysis | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const selectedList = useMemo(() => [...selected], [selected])

  const toggleKeyword = useCallback((keyword: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(keyword)) next.delete(keyword)
      else next.add(keyword)
      return next
    })
  }, [])

  const runAnalysis = useCallback(async () => {
    setErr(null)
    setAnalysis(null)
    setSelected(new Set())

    const url = videoUrl.trim()
    if (!url) {
      setErr("영상 URL을 입력해 주세요.")
      return
    }

    const openai = shotformOpenAIKey()
    if (!openai) {
      setErr("ShotForm 설정에서 OpenAI API 키를 저장해 주세요.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/shotform/mvp-video-keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, openaiApiKey: openai }),
      })
      const json = (await res.json().catch(() => ({}))) as MvpVideoKeywordAnalysis & { error?: string }
      if (!res.ok) {
        setErr(json.error || `분석 실패 (${res.status})`)
        return
      }
      setAnalysis(json)
      onAnalyzedUrl?.(url)
      if (json.keywords.length === 1) {
        setSelected(new Set([json.keywords[0]!.keyword]))
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "네트워크 오류")
    } finally {
      setLoading(false)
    }
  }, [videoUrl, onAnalyzedUrl])

  const applySelected = useCallback(() => {
    if (!selectedList.length) {
      setErr("적용할 키워드를 하나 이상 선택해 주세요.")
      return
    }
    onApplyKeywords(selectedList)
    setErr(null)
  }, [onApplyKeywords, selectedList])

  return (
    <div className="mt-3 rounded-xl border border-dashed border-violet-500/25 bg-violet-950/10 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link2 className="h-4 w-4 text-violet-300" />
        <p className="text-sm font-medium text-violet-100">영상 URL → 제품 키워드 추출</p>
        <span className="text-[10px] text-slate-500">YouTube · TikTok · Instagram</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        영상 URL만 넣으면 AI가 <span className="text-violet-200">대본(자막)</span>과{" "}
        <span className="text-violet-200">영상 장면·썸네일</span>을 분석해,{" "}
        <span className="text-amber-200">제품과 관련된 키워드만</span> 추출합니다.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="url"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          disabled={disabled || loading}
          placeholder="https://www.youtube.com/shorts/… · tiktok.com/… · instagram.com/reel/…"
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading && !disabled && videoUrl.trim()) void runAnalysis()
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled || loading || !videoUrl.trim()}
          className={cn(studio.btnGhost, "shrink-0")}
          onClick={() => void runAnalysis()}
        >
          {loading ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              대본·장면 분석 중…
            </>
          ) : (
            <>
              <Sparkles className="mr-1.5 h-4 w-4" />
              AI 키워드 추출
            </>
          )}
        </Button>
      </div>

      {err ? <p className="mt-2 text-xs text-red-300">{err}</p> : null}

      {analysis ? (
        <div className="mt-4 space-y-3 border-t border-white/[0.06] pt-4">
          <div className="flex flex-wrap items-start gap-3">
            {analysis.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={analysis.thumbnail}
                alt=""
                className="h-20 w-28 shrink-0 rounded-lg border border-white/10 object-cover"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-xs text-violet-300/80">
                {PLATFORM_LABEL[analysis.platform] || analysis.platform}
                {analysis.author ? ` · ${analysis.author}` : ""}
                {analysis.framesAnalyzed > 0 ? ` · 장면 ${analysis.framesAnalyzed}장 분석` : ""}
              </p>
              <p className="line-clamp-2 text-sm font-medium text-white">{analysis.title}</p>
              {analysis.productName ? (
                <p className="mt-0.5 text-xs text-amber-200/90">
                  핵심 제품: {analysis.productName}
                  {analysis.category ? ` · ${analysis.category}` : ""}
                </p>
              ) : null}
              {analysis.summary ? <p className="mt-1 text-xs text-slate-400">{analysis.summary}</p> : null}

              <div className="mt-2 flex flex-wrap gap-1.5">
                <span
                  className={cn(
                    "rounded-md border px-1.5 py-0.5 text-[10px]",
                    QUALITY_STYLE[analysis.dataQuality] || QUALITY_STYLE.medium
                  )}
                >
                  분석 신뢰도:{" "}
                  {analysis.dataQuality === "high" ? "높음" : analysis.dataQuality === "medium" ? "보통" : "낮음"}
                </span>
                {analysis.evidenceSources.map((src) => (
                  <span
                    key={src}
                    className="rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5 text-[10px] text-slate-400"
                  >
                    {EVIDENCE_LABEL[src] || src}
                  </span>
                ))}
              </div>
              {analysis.qualityNote ? (
                <p className="mt-1.5 text-[11px] text-slate-500">{analysis.qualityNote}</p>
              ) : null}
            </div>
          </div>

          {analysis.transcriptExcerpt ? (
            <details className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
              <summary className="cursor-pointer text-xs text-slate-400">대본·자막 (발췌)</summary>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{analysis.transcriptExcerpt}</p>
            </details>
          ) : null}

          {analysis.searchFeatures.length > 0 ? (
            <div>
              <p className="text-xs text-slate-400">제품 관련 특징 (대본·장면 근거)</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {analysis.searchFeatures.map((f) => (
                  <span
                    key={f}
                    className="rounded-md border border-emerald-500/20 bg-emerald-950/20 px-2 py-0.5 text-[10px] text-emerald-200/90"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {analysis.ocrNotes ? (
            <details className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
              <summary className="cursor-pointer text-xs text-slate-400">영상 장면·썸네일 OCR</summary>
              <pre className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-500">
                {analysis.ocrNotes}
              </pre>
            </details>
          ) : null}

          <div>
            <p className="text-xs text-slate-400">제품 관련 키워드 — 클릭하여 선택</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {analysis.keywords.map((item) => {
                const on = selected.has(item.keyword)
                const tip = [item.reason, item.evidence ? `근거: ${EVIDENCE_LABEL[item.evidence] || item.evidence}` : ""]
                  .filter(Boolean)
                  .join(" · ")
                return (
                  <button
                    key={item.keyword}
                    type="button"
                    title={tip || undefined}
                    onClick={() => toggleKeyword(item.keyword)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition",
                      on
                        ? studio.btnSegmentActive
                        : "border-white/10 bg-black/30 text-slate-300 hover:border-violet-500/40"
                    )}
                  >
                    {on ? <Check className="h-3 w-3 shrink-0" /> : null}
                    {item.keyword}
                    {item.evidence ? (
                      <span className="text-[9px] opacity-60">{EVIDENCE_LABEL[item.evidence] || item.evidence}</span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={selectedList.length === 0}
              variant="ghost"
              className={studio.btnPrimary}
              onClick={applySelected}
            >
              선택 키워드 적용 ({selectedList.length})
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={studio.btnGhost}
              onClick={() => {
                setSelected(new Set(analysis.keywords.map((k) => k.keyword)))
              }}
            >
              전체 선택
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
