"use client"

import { useCallback, useMemo, useState } from "react"
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
  syncSeoMetaFromTags,
} from "@/lib/mvp-studio-seo"
import {
  applyPlatformOutputsToMeta,
  copyTextForPlatform,
  emptyPlatformOutputs,
  hydratePlatformOutputs,
  MVP_SEO_PLATFORM_LABELS,
  MVP_SEO_PLATFORM_ORDER,
  softFillFromCommon,
} from "@/lib/mvp-studio-seo-platforms"
import type {
  MvpSeoCommonOutput,
  MvpSeoPlatformKey,
  MvpSeoPlatformOutputs,
  MvpSeoShortformOutput,
  MvpSeoYoutubeOutput,
  MvpStudioSeoMeta,
} from "@/lib/mvp-studio-types"
import type { NarrationSegment } from "@/lib/shotform-factory-narration-script"

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

function FieldCopy({ label, text }: { label: string; text: string }) {
  return (
    <button
      type="button"
      className="rounded px-1.5 py-0.5 text-[10px] font-medium text-violet-600 hover:bg-violet-50"
      onClick={() => void copyPlain(`${label}을(를) 복사했습니다.`, text)}
    >
      복사
    </button>
  )
}

function TagChips({
  tags,
  onRemove,
  onAdd,
}: {
  tags: string[]
  onRemove: (tag: string) => void
  onAdd: (tag: string) => void
}) {
  const [draft, setDraft] = useState("")
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-700"
          >
            {t}
            <button
              type="button"
              className="text-slate-400 hover:text-rose-500"
              onClick={() => onRemove(t)}
              aria-label={`${t} 제거`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {tags.length === 0 ? <span className="text-[11px] text-slate-400">아직 없습니다.</span> : null}
      </div>
      <div className="mt-2.5 flex gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              const t = draft.trim().replace(/^#/, "")
              if (t) onAdd(t)
              setDraft("")
            }
          }}
          placeholder="추가 후 Enter"
          className="h-9 flex-1 border-slate-200 bg-white text-xs text-slate-900"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 border-slate-200 bg-white text-xs text-slate-700"
          onClick={() => {
            const t = draft.trim().replace(/^#/, "")
            if (t) onAdd(t)
            setDraft("")
          }}
        >
          추가
        </Button>
      </div>
    </div>
  )
}

function HashtagChips({
  hashtags,
  onChange,
}: {
  hashtags: string[]
  onChange: (next: string[]) => void
}) {
  return (
    <TagChips
      tags={hashtags}
      onRemove={(tag) => onChange(hashtags.filter((h) => h !== tag))}
      onAdd={(tag) => {
        const h = tag.startsWith("#") ? tag : `#${tag}`
        if (!hashtags.includes(h)) onChange([...hashtags, h])
      }}
    />
  )
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
  const [tab, setTab] = useState<MvpSeoPlatformKey>("common")

  const script = buildMvpSeoScript(segments)
  const hasScript = script.trim().length > 0
  const inferredProduct = inferMvpSeoProductName(productName, sourceKeywords, projectName)

  const outputs = useMemo(() => hydratePlatformOutputs(value), [value])

  const commitOutputs = useCallback(
    (next: MvpSeoPlatformOutputs) => {
      onChange(applyPlatformOutputsToMeta(value, next))
    },
    [onChange, value]
  )

  const patchCommon = useCallback(
    (partial: Partial<MvpSeoCommonOutput>, softFill = true) => {
      let common = { ...outputs.common, ...partial }
      if (partial.tags) {
        const synced = syncSeoMetaFromTags({
          ...value,
          title: common.title,
          description: common.description,
          tags: common.tags,
          hashtags: common.hashtags,
          hookShort: common.hookShort,
          commentCue: common.commentCue,
        })
        common = {
          ...common,
          description: synced.description,
          hashtags: synced.hashtags,
          tags: synced.tags,
        }
      }
      const merged = softFill
        ? softFillFromCommon(outputs, common, inferredProduct)
        : { ...outputs, common }
      commitOutputs(merged)
    },
    [commitOutputs, inferredProduct, outputs, value]
  )

  const patchYoutube = useCallback(
    (partial: Partial<MvpSeoYoutubeOutput>) => {
      commitOutputs({ ...outputs, youtube: { ...outputs.youtube, ...partial } })
    },
    [commitOutputs, outputs]
  )

  const patchShortform = useCallback(
    (key: "tiktok" | "instagram" | "threads" | "naverclip", partial: Partial<MvpSeoShortformOutput>) => {
      commitOutputs({ ...outputs, [key]: { ...outputs[key], ...partial } })
    },
    [commitOutputs, outputs]
  )

  const generate = useCallback(async () => {
    const apiKey = shotformOpenAiKey()
    if (!apiKey) {
      setErr("ShotForm 설정에 OpenAI API 키(shotform_openai_api_key)를 저장해 주세요.")
      return
    }
    if (!hasScript) {
      setErr("나레이션 대본이 없습니다. 편집 단계 「대본」 탭에서 AI 대본을 먼저 생성해 주세요.")
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
          productName: inferredProduct,
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
        platformOutputs?: MvpSeoPlatformOutputs
      }
      if (!res.ok) throw new Error(data.error || "제목·설명·태그 생성에 실패했습니다.")

      const nextOutputs = data.platformOutputs ?? emptyPlatformOutputs()
      onChange(
        applyPlatformOutputsToMeta(value, {
          ...emptyPlatformOutputs(),
          ...nextOutputs,
          common: { ...emptyPlatformOutputs().common, ...nextOutputs.common },
          youtube: { ...emptyPlatformOutputs().youtube, ...nextOutputs.youtube },
          tiktok: { ...emptyPlatformOutputs().tiktok, ...nextOutputs.tiktok },
          instagram: { ...emptyPlatformOutputs().instagram, ...nextOutputs.instagram },
          threads: { ...emptyPlatformOutputs().threads, ...nextOutputs.threads },
          naverclip: { ...emptyPlatformOutputs().naverclip, ...nextOutputs.naverclip },
        })
      )
    } catch (e) {
      setErr(e instanceof Error ? e.message : "SEO 생성 실패")
    } finally {
      setGenerating(false)
    }
  }, [
    hasScript,
    inferredProduct,
    onChange,
    referenceTitles,
    script,
    sourceKeywords,
    value,
    videoDurationSec,
  ])

  const sectionClass = "rounded-xl border border-slate-200 bg-slate-50/80 p-3.5"
  const labelClass = "text-[11px] font-semibold text-slate-700"

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] leading-relaxed text-slate-500">
          AI로 전 플랫폼을 채우거나, 탭별로 수정한 뒤 복사해 업로드하세요. CapCut에는 공통·YouTube 제목·태그가
          포함됩니다.
        </p>
        <Button
          type="button"
          size="sm"
          className="h-8 shrink-0 gap-1.5 bg-violet-600 text-[11px] font-semibold text-white hover:bg-violet-500"
          disabled={generating || !hasScript}
          onClick={() => void generate()}
        >
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          AI 생성
        </Button>
      </div>

      {!hasScript ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          대본이 없으면 SEO를 생성할 수 없습니다. 편집 단계 「대본」 탭에서 나레이션을 먼저 작성하세요.
        </p>
      ) : null}

      {err ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">{err}</p>
      ) : null}

      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {MVP_SEO_PLATFORM_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition",
              tab === key
                ? "bg-violet-600 text-white shadow-sm"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            )}
          >
            {MVP_SEO_PLATFORM_LABELS[key]}
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          className="rounded px-2 py-1 text-[10px] font-medium text-violet-600 hover:bg-violet-50"
          onClick={() =>
            void copyPlain(
              `${MVP_SEO_PLATFORM_LABELS[tab]} 전체를 복사했습니다.`,
              copyTextForPlatform(tab, outputs)
            )
          }
        >
          <span className="inline-flex items-center gap-1">
            <Copy className="h-3 w-3" />이 탭 전체 복사
          </span>
        </button>
      </div>

      {tab === "common" ? (
        <div className="space-y-3">
          <div className={sectionClass}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className={labelClass}>영상 제목</span>
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <span className="tabular-nums">
                  {outputs.common.title.length}/{MVP_SEO_TITLE_MAX}
                </span>
                <FieldCopy label="제목" text={outputs.common.title} />
              </div>
            </div>
            <Input
              value={outputs.common.title}
              maxLength={MVP_SEO_TITLE_MAX}
              onChange={(e) => patchCommon({ title: e.target.value })}
              className="h-10 border-slate-200 bg-white text-sm text-slate-900"
              placeholder="클릭을 유도하는 제목"
            />
          </div>

          <div className={sectionClass}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className={labelClass}>영상 설명</span>
              <FieldCopy label="설명" text={outputs.common.description} />
            </div>
            <Textarea
              value={outputs.common.description}
              onChange={(e) => patchCommon({ description: e.target.value })}
              rows={7}
              className="resize-y border-slate-200 bg-white text-[12px] leading-relaxed text-slate-900"
              placeholder="제품 특징·구매 유도·해시태그가 포함된 설명"
            />
            <p className="mt-1.5 text-[10px] tabular-nums text-slate-400">
              {outputs.common.description.length}자
            </p>
          </div>

          <div className={sectionClass}>
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <span className={labelClass}>업로드 태그</span>
                <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
                  공통 초안. 빈 플랫폼 탭은 이 내용으로 soft-fill 됩니다.
                </p>
              </div>
              <FieldCopy label="태그" text={outputs.common.tags.join(", ")} />
            </div>
            <TagChips
              tags={outputs.common.tags}
              onRemove={(tag) => patchCommon({ tags: outputs.common.tags.filter((t) => t !== tag) })}
              onAdd={(tag) => {
                if (!outputs.common.tags.includes(tag)) {
                  patchCommon({ tags: [...outputs.common.tags, tag] })
                }
              }}
            />
          </div>

          <div className={sectionClass}>
            <div className="mb-2 flex items-center justify-between">
              <span className={labelClass}>해시태그</span>
              <FieldCopy label="해시태그" text={outputs.common.hashtags.join(" ")} />
            </div>
            <HashtagChips
              hashtags={outputs.common.hashtags}
              onChange={(hashtags) => patchCommon({ hashtags })}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className={sectionClass}>
              <div className="mb-2 flex items-center justify-between">
                <span className={labelClass}>짧은 훅</span>
                <FieldCopy label="훅" text={outputs.common.hookShort} />
              </div>
              <Input
                value={outputs.common.hookShort}
                onChange={(e) => patchCommon({ hookShort: e.target.value }, false)}
                className="h-9 border-slate-200 bg-white text-xs"
                placeholder="15자 내외"
              />
            </div>
            <div className={sectionClass}>
              <div className="mb-2 flex items-center justify-between">
                <span className={labelClass}>댓글 키워드</span>
                <FieldCopy label="댓글 키워드" text={outputs.common.commentCue} />
              </div>
              <Input
                value={outputs.common.commentCue}
                onChange={(e) => patchCommon({ commentCue: e.target.value }, false)}
                className="h-9 border-slate-200 bg-white text-xs"
                placeholder="꿀템, 링크…"
              />
            </div>
          </div>
        </div>
      ) : null}

      {tab === "youtube" ? (
        <div className="space-y-3">
          <div className={sectionClass}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className={labelClass}>YouTube 제목</span>
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <span className="tabular-nums">
                  {outputs.youtube.title.length}/{MVP_SEO_TITLE_MAX}
                </span>
                <FieldCopy label="제목" text={outputs.youtube.title} />
              </div>
            </div>
            <Input
              value={outputs.youtube.title}
              maxLength={MVP_SEO_TITLE_MAX}
              onChange={(e) => patchYoutube({ title: e.target.value })}
              className="h-10 border-slate-200 bg-white text-sm text-slate-900"
            />
            {outputs.youtube.recommendedTitles.length > 0 ? (
              <div className="mt-2.5 space-y-1.5">
                <p className="text-[10px] font-medium text-slate-500">추천 제목 · 클릭하여 적용</p>
                {outputs.youtube.recommendedTitles.slice(0, 5).map((t, i) => (
                  <button
                    key={`${i}-${t}`}
                    type="button"
                    onClick={() => patchYoutube({ title: t })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-[11px] text-slate-700 transition hover:border-violet-300 hover:bg-violet-50"
                  >
                    {t}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className={sectionClass}>
            <div className="mb-2 flex items-center justify-between">
              <span className={labelClass}>설명</span>
              <FieldCopy label="설명" text={outputs.youtube.description} />
            </div>
            <Textarea
              value={outputs.youtube.description}
              onChange={(e) => patchYoutube({ description: e.target.value })}
              rows={7}
              className="resize-y border-slate-200 bg-white text-[12px] leading-relaxed text-slate-900"
            />
          </div>

          <div className={sectionClass}>
            <div className="mb-2 flex items-center justify-between">
              <span className={labelClass}>태그</span>
              <FieldCopy label="태그" text={outputs.youtube.tags.join(", ")} />
            </div>
            <TagChips
              tags={outputs.youtube.tags}
              onRemove={(tag) => patchYoutube({ tags: outputs.youtube.tags.filter((t) => t !== tag) })}
              onAdd={(tag) => {
                if (!outputs.youtube.tags.includes(tag)) {
                  patchYoutube({ tags: [...outputs.youtube.tags, tag] })
                }
              }}
            />
          </div>

          <div className={sectionClass}>
            <div className="mb-2 flex items-center justify-between">
              <span className={labelClass}>해시태그</span>
              <FieldCopy label="해시태그" text={outputs.youtube.hashtags.join(" ")} />
            </div>
            <HashtagChips
              hashtags={outputs.youtube.hashtags}
              onChange={(hashtags) => patchYoutube({ hashtags })}
            />
          </div>

          <div className={sectionClass}>
            <div className="mb-2 flex items-center justify-between">
              <span className={labelClass}>고정 댓글</span>
              <FieldCopy label="고정 댓글" text={outputs.youtube.pinnedComment} />
            </div>
            <Textarea
              value={outputs.youtube.pinnedComment}
              onChange={(e) => patchYoutube({ pinnedComment: e.target.value })}
              rows={3}
              className="resize-y border-slate-200 bg-white text-[12px]"
              placeholder="업로드 후 고정할 댓글"
            />
          </div>
        </div>
      ) : null}

      {tab === "tiktok" || tab === "instagram" || tab === "threads" || tab === "naverclip" ? (
        <ShortformTab
          platform={tab}
          value={outputs[tab]}
          onChange={(partial) => patchShortform(tab, partial)}
          sectionClass={sectionClass}
          labelClass={labelClass}
        />
      ) : null}
    </div>
  )
}

function ShortformTab({
  platform,
  value,
  onChange,
  sectionClass,
  labelClass,
}: {
  platform: "tiktok" | "instagram" | "threads" | "naverclip"
  value: MvpSeoShortformOutput
  onChange: (partial: Partial<MvpSeoShortformOutput>) => void
  sectionClass: string
  labelClass: string
}) {
  const hint =
    platform === "naverclip"
      ? "네이버 클립 — 검색 친화·실용 정보 톤"
      : platform === "threads"
        ? "Threads — 대화형·짧은 본문"
        : platform === "instagram"
          ? "Instagram — 감성·비주얼 캡션"
          : "TikTok — 캐주얼·트렌디 캡션"

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-slate-500">{hint}</p>
      <div className={sectionClass}>
        <div className="mb-2 flex items-center justify-between">
          <span className={labelClass}>제목 / 캡션 헤드</span>
          <FieldCopy label="제목" text={value.title} />
        </div>
        <Input
          value={value.title}
          maxLength={80}
          onChange={(e) => onChange({ title: e.target.value })}
          className="h-10 border-slate-200 bg-white text-sm"
        />
      </div>
      <div className={sectionClass}>
        <div className="mb-2 flex items-center justify-between">
          <span className={labelClass}>본문</span>
          <FieldCopy label="본문" text={value.body} />
        </div>
        <Textarea
          value={value.body}
          onChange={(e) => onChange({ body: e.target.value })}
          rows={6}
          className="resize-y border-slate-200 bg-white text-[12px] leading-relaxed"
        />
        <p className="mt-1.5 text-[10px] tabular-nums text-slate-400">{value.body.length}자</p>
      </div>
      <div className={sectionClass}>
        <div className="mb-2 flex items-center justify-between">
          <span className={labelClass}>해시태그</span>
          <FieldCopy label="해시태그" text={value.hashtags.join(" ")} />
        </div>
        <HashtagChips hashtags={value.hashtags} onChange={(hashtags) => onChange({ hashtags })} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={sectionClass}>
          <div className="mb-2 flex items-center justify-between">
            <span className={labelClass}>댓글 유도</span>
            <FieldCopy label="댓글 유도" text={value.commentPrompt} />
          </div>
          <Input
            value={value.commentPrompt}
            onChange={(e) => onChange({ commentPrompt: e.target.value })}
            className="h-9 border-slate-200 bg-white text-xs"
          />
        </div>
        <div className={sectionClass}>
          <div className="mb-2 flex items-center justify-between">
            <span className={labelClass}>CTA</span>
            <FieldCopy label="CTA" text={value.cta} />
          </div>
          <Input
            value={value.cta}
            onChange={(e) => onChange({ cta: e.target.value })}
            className="h-9 border-slate-200 bg-white text-xs"
          />
        </div>
      </div>
    </div>
  )
}
