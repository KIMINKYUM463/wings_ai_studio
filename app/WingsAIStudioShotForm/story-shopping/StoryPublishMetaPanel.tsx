"use client"

import { useEffect, useRef, useState } from "react"
import { Copy, Check, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { generateYouTubeMetadata } from "./actions"

export type StoryPublishMeta = {
  youtubeTitle: string
  youtubeDescription: string
  youtubeTags: string[]
}

type Props = {
  productName: string
  productDescription: string
  script: string
  value: StoryPublishMeta
  onChange: (next: StoryPublishMeta) => void
  /** 탭 진입 시 비어 있으면 자동 생성 */
  autoGenerateOnMount?: boolean
}

function tagsToDraft(tags: string[]) {
  return tags.join(", ")
}

function draftToTags(draft: string) {
  return draft
    .split(",")
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean)
}

export function StoryPublishMetaPanel({
  productName,
  productDescription,
  script,
  value,
  onChange,
  autoGenerateOnMount = true,
}: Props) {
  const [tagsDraft, setTagsDraft] = useState(() => tagsToDraft(value.youtubeTags))
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState("")
  const [copiedField, setCopiedField] = useState<"title" | "description" | "tags" | null>(null)
  const autoTriedRef = useRef(false)

  useEffect(() => {
    setTagsDraft(tagsToDraft(value.youtubeTags))
  }, [value.youtubeTags])

  const runGenerate = async () => {
    const trimmedScript = script.trim()
    if (!trimmedScript) {
      setError("대본이 없어 생성할 수 없습니다. 스토리를 먼저 완성해 주세요.")
      return
    }
    setIsGenerating(true)
    setError("")
    try {
      const apiKey =
        typeof window !== "undefined"
          ? localStorage.getItem("shotform_openai_api_key") || undefined
          : undefined
      const metadata = await generateYouTubeMetadata(
        productName.trim() || "스토리 쇼핑",
        productDescription.trim(),
        trimmedScript,
        apiKey
      )
      onChange({
        youtubeTitle: metadata.title,
        youtubeDescription: metadata.description,
        youtubeTags: metadata.tags,
      })
      setTagsDraft(tagsToDraft(metadata.tags))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "메타데이터 생성에 실패했습니다.")
    } finally {
      setIsGenerating(false)
    }
  }

  useEffect(() => {
    if (!autoGenerateOnMount || autoTriedRef.current) return
    const empty =
      !value.youtubeTitle.trim() &&
      !value.youtubeDescription.trim() &&
      value.youtubeTags.length === 0
    if (!empty || !script.trim()) return
    autoTriedRef.current = true
    void runGenerate()
    // 탭 첫 진입 1회만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerateOnMount, script, value.youtubeTitle, value.youtubeDescription, value.youtubeTags.length])

  const copyText = async (field: "title" | "description" | "tags", text: string) => {
    if (!text.trim()) return
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      window.setTimeout(() => setCopiedField(null), 1500)
    } catch {
      setError("클립보드 복사에 실패했습니다.")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-black text-slate-900">제목 · 설명 · 태그</p>
          <p className="mt-1 text-[10px] leading-4 text-slate-500">
            영상 편집이 끝난 뒤, 업로드용 제목·설명·태그를 AI로 만들고 수정하세요.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => void runGenerate()}
          disabled={isGenerating || !script.trim()}
          className="shrink-0 bg-amber-500 text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {isGenerating ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          )}
          {value.youtubeTitle.trim() ? "다시 생성" : "AI로 생성"}
        </Button>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
          {error}
        </p>
      ) : null}

      {isGenerating ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-[11px] text-amber-800">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          대본과 상품 정보를 바탕으로 제목·설명·태그를 만드는 중…
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] text-slate-500">제목</Label>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-slate-700"
            onClick={() => void copyText("title", value.youtubeTitle)}
            disabled={!value.youtubeTitle.trim()}
          >
            {copiedField === "title" ? (
              <Check className="h-3 w-3 text-emerald-600" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            복사
          </button>
        </div>
        <Input
          value={value.youtubeTitle}
          onChange={(event) =>
            onChange({ ...value, youtubeTitle: event.target.value })
          }
          placeholder="쇼츠 업로드용 제목"
          className="border-slate-200 bg-white text-sm text-slate-900"
        />
        <p className="text-right text-[10px] text-slate-400">{value.youtubeTitle.length}자</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] text-slate-500">설명</Label>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-slate-700"
            onClick={() => void copyText("description", value.youtubeDescription)}
            disabled={!value.youtubeDescription.trim()}
          >
            {copiedField === "description" ? (
              <Check className="h-3 w-3 text-emerald-600" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            복사
          </button>
        </div>
        <Textarea
          value={value.youtubeDescription}
          onChange={(event) =>
            onChange({ ...value, youtubeDescription: event.target.value })
          }
          placeholder="영상 설명, 상품 포인트, 해시태그 공간 등"
          className="min-h-36 resize-y border-slate-200 bg-white text-sm text-slate-900"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] text-slate-500">태그</Label>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-slate-700"
            onClick={() => void copyText("tags", value.youtubeTags.join(", "))}
            disabled={value.youtubeTags.length === 0}
          >
            {copiedField === "tags" ? (
              <Check className="h-3 w-3 text-emerald-600" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            복사
          </button>
        </div>
        <Input
          value={tagsDraft}
          onChange={(event) => {
            const draft = event.target.value
            setTagsDraft(draft)
            onChange({ ...value, youtubeTags: draftToTags(draft) })
          }}
          placeholder="쇼츠, 제품명, 추천템"
          className="border-slate-200 bg-white text-sm text-slate-900"
        />
        <p className="text-[10px] text-slate-400">태그는 쉼표로 구분합니다.</p>
        {value.youtubeTags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {value.youtubeTags.map((tag, index) => (
              <span
                key={`${tag}-${index}`}
                className="rounded-full border border-amber-300/60 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800"
              >
                #{tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
