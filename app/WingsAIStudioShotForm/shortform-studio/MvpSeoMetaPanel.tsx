"use client"

import { useCallback, useState } from "react"
import { Copy, Loader2, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { shotformOpenAiKey } from "@/lib/shotform-factory-seo"
import {
  buildMvpSeoScript,
  collectMvpReferenceTitles,
  inferMvpSeoProductName,
  MVP_SEO_TITLE_MAX,
} from "@/lib/mvp-studio-seo"
import type { MvpStudioSeoMeta } from "@/lib/mvp-studio-types"
import type { NarrationSegment } from "@/lib/shotform-factory-narration-script"
import { studio } from "../components/ShotFormStudioUI"

type Props = {
  productName?: string
  projectName?: string
  sourceKeywords?: string[]
  referenceTitles?: string[]
  segments: readonly NarrationSegment[]
  videoDurationSec: number
  value: MvpStudioSeoMeta
  onChange: (next: MvpStudioSeoMeta) => void
}

async function copyPlain(doneMsg: string, text: string) {
  if (!text.trim()) return
  try {
    await navigator.clipboard.writeText(text)
    window.alert(doneMsg)
  } catch {
    window.alert("복사에 실패했습니다.")
  }
}

export function MvpSeoMetaPanel({
  productName,
  projectName,
  sourceKeywords = [],
  referenceTitles = [],
  segments,
  videoDurationSec,
  value,
  onChange,
}: Props) {
  const [generating, setGenerating] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [tagDraft, setTagDraft] = useState("")

  const script = buildMvpSeoScript(segments)
  const hasScript = script.trim().length > 0

  const patch = useCallback(
    (partial: Partial<MvpStudioSeoMeta>) => onChange({ ...value, ...partial }),
    [onChange, value]
  )

  const removeHashtag = useCallback(
    (tag: string) => patch({ hashtags: value.hashtags.filter((h) => h !== tag) }),
    [patch, value.hashtags]
  )

  const removeTag = useCallback(
    (tag: string) => patch({ tags: value.tags.filter((t) => t !== tag) }),
    [patch, value.tags]
  )

  const addTagFromDraft = useCallback(() => {
    const t = tagDraft.trim().replace(/^#/, "")
    if (!t) return
    if (!value.tags.includes(t)) patch({ tags: [...value.tags, t] })
    setTagDraft("")
  }, [patch, tagDraft, value.tags])

  const generate = useCallback(async () => {
    const apiKey = shotformOpenAiKey()
    if (!apiKey) {
      setErr("ShotForm 설정에 OpenAI API 키(shotform_openai_api_key)를 저장해 주세요.")
      return
    }
    if (!hasScript) {
      setErr("나레이션 대본이 없습니다. 「대본」 탭에서 AI 대본을 먼저 생성해 주세요.")
      return
    }
    setGenerating(true)
    setErr(null)
    try {
      const res = await fetch("/api/shotform-factory-seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          productName: inferMvpSeoProductName(productName, sourceKeywords, projectName),
          referenceTitles: collectMvpReferenceTitles(referenceTitles, sourceKeywords),
          script,
          videoDurationSec,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        title?: string
        recommendedTitles?: string[]
        description?: string
        tags?: string[]
        hashtags?: string[]
        hookShort?: string
        commentCue?: string
      }
      if (!res.ok) throw new Error(data.error || "제목·설명·태그 생성에 실패했습니다.")

      onChange({
        title: typeof data.title === "string" ? data.title : value.title,
        recommendedTitles: Array.isArray(data.recommendedTitles) ? data.recommendedTitles : [],
        description: typeof data.description === "string" ? data.description : value.description,
        tags: Array.isArray(data.tags) ? data.tags : value.tags,
        hashtags: Array.isArray(data.hashtags) ? data.hashtags : value.hashtags,
        hookShort: typeof data.hookShort === "string" ? data.hookShort : value.hookShort,
        commentCue: typeof data.commentCue === "string" ? data.commentCue : value.commentCue,
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : "SEO 생성 실패")
    } finally {
      setGenerating(false)
    }
  }, [
    hasScript,
    onChange,
    productName,
    projectName,
    referenceTitles,
    script,
    sourceKeywords,
    value.commentCue,
    value.description,
    value.hookShort,
    value.tags,
    value.hashtags,
    value.title,
    videoDurationSec,
  ])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-white">제목·설명·태그</p>
          <p className="mt-0.5 text-[10px] text-slate-500">유튜브·숏폼 업로드용 SEO</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn(studio.btnOutline, "h-7 gap-1 text-[10px]")}
          disabled={generating || !hasScript}
          onClick={() => void generate()}
        >
          {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          AI 생성
        </Button>
      </div>

      {!hasScript ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-950/20 px-2 py-1.5 text-[10px] text-amber-200/90">
          대본이 없으면 SEO를 생성할 수 없습니다. 「대본」 탭에서 나레이션을 먼저 작성하세요.
        </p>
      ) : null}

      {err ? (
        <p className="rounded-md border border-rose-500/35 bg-rose-950/25 px-2 py-1.5 text-[10px] text-rose-200">
          {err}
        </p>
      ) : null}

      <div className="rounded-lg border border-white/10 bg-black/30 p-2.5">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[10px] font-medium text-slate-400">영상 제목</span>
          <div className="flex items-center gap-2 text-[9px] text-slate-500">
            <span className="tabular-nums">
              {value.title.length}/{MVP_SEO_TITLE_MAX}
            </span>
            <button
              type="button"
              className="text-violet-300 hover:text-violet-200"
              onClick={() => void copyPlain("제목을 복사했습니다.", value.title)}
            >
              <Copy className="inline h-3 w-3" />
            </button>
          </div>
        </div>
        <Input
          value={value.title}
          maxLength={MVP_SEO_TITLE_MAX}
          onChange={(e) => patch({ title: e.target.value })}
          className="h-8 border-white/10 bg-black/40 text-xs text-white"
          placeholder="클릭을 유도하는 제목"
        />
        {value.recommendedTitles && value.recommendedTitles.length > 0 ? (
          <div className="mt-2 space-y-1">
            <p className="text-[9px] text-slate-500">추천 제목</p>
            {value.recommendedTitles.slice(0, 4).map((t, i) => (
              <button
                key={`${i}-${t}`}
                type="button"
                onClick={() => patch({ title: t })}
                className="w-full rounded border border-white/5 bg-white/[0.03] px-2 py-1 text-left text-[10px] text-slate-300 hover:border-violet-500/40 hover:bg-violet-950/20"
              >
                {t}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-white/10 bg-black/30 p-2.5">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[10px] font-medium text-slate-400">영상 설명</span>
          <button
            type="button"
            className="text-[9px] text-violet-300 hover:text-violet-200"
            onClick={() => void copyPlain("설명을 복사했습니다.", value.description)}
          >
            <Copy className="inline h-3 w-3" />
          </button>
        </div>
        <Textarea
          value={value.description}
          onChange={(e) => patch({ description: e.target.value })}
          rows={6}
          className="resize-y border-white/10 bg-black/40 text-[11px] text-white"
          placeholder="제품 특징·구매 유도·해시태그가 포함된 설명"
        />
        <p className="mt-1 text-[9px] tabular-nums text-slate-600">{value.description.length}자</p>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/30 p-2.5">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[10px] font-medium text-slate-400">태그</span>
          <button
            type="button"
            className="text-[9px] text-violet-300 hover:text-violet-200"
            onClick={() => void copyPlain("태그를 복사했습니다.", value.tags.join(", "))}
          >
            복사
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {value.tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-0.5 rounded-full border border-slate-600/60 bg-slate-900/80 px-2 py-0.5 text-[10px] text-slate-200"
            >
              {t}
              <button type="button" className="text-rose-400" onClick={() => removeTag(t)} aria-label={`${t} 제거`}>
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-1">
          <Input
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addTagFromDraft()
              }
            }}
            placeholder="태그 추가 후 Enter"
            className="h-7 flex-1 border-white/10 bg-black/40 text-[10px] text-white"
          />
          <Button type="button" size="sm" variant="outline" className="h-7 text-[10px]" onClick={addTagFromDraft}>
            추가
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/30 p-2.5">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[10px] font-medium text-slate-400">해시태그</span>
          <button
            type="button"
            className="text-[9px] text-violet-300 hover:text-violet-200"
            onClick={() => void copyPlain("해시태그를 복사했습니다.", value.hashtags.join(" "))}
          >
            전체 복사
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {value.hashtags.map((h) => (
            <span
              key={h}
              className="inline-flex items-center gap-0.5 rounded-full border border-violet-500/40 bg-violet-950/30 px-2 py-0.5 text-[10px] text-violet-100"
            >
              {h}
              <button type="button" className="text-rose-400" onClick={() => removeHashtag(h)} aria-label={`${h} 제거`}>
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
        {value.hashtags.length > 0 ? (
          <p className="mt-2 rounded border border-white/5 bg-black/25 px-2 py-1 text-[10px] leading-relaxed text-slate-400">
            {value.hashtags.join(" ")}
          </p>
        ) : (
          <p className="mt-2 text-[10px] text-slate-600">「AI 생성」 후 해시태그가 채워집니다.</p>
        )}
      </div>
    </div>
  )
}
