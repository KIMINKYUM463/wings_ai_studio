"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowRight,
  Film,
  Heart,
  Link2,
  Loader2,
  Play,
  Scissors,
  Sparkles,
  Wand2,
  X,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { writeProductInputUrlToSession } from "@/lib/shotform-mix-source"
import { isLikelyPresenterTitle } from "@/lib/shotform-auto-edit-product-filter"
import {
  MAX_AUTO_EDIT_VIDEOS,
  type AutoEditPick,
  videoPickKey,
} from "@/lib/shotform-auto-edit-types"
import { MvpAutoEditDialog } from "../shortform-studio/MvpAutoEditDialog"
import { MvpXhsInlineVideoPreview } from "../shortform-studio/MvpXhsMediaPreview"
import { pack } from "./ProductSearchLayout"
import { formatMediaDurationLabel } from "@/lib/serpapi-product-search"

const MAX_XHS_URL_ATTEMPTS = 8
const XHS_URL_RETRY_DELAY_MS = 2500

type SimilarVideo = {
  platform: string
  title: string
  thumbnail: string
  videoUrl: string
  url: string
  author: string
  relevanceScore?: number
  durationSec?: number | null
  viewCount?: number | null
  likeCount?: number | null
}

type SearchResponse = {
  input: { url: string; pageTitle: string; pageDescription: string }
  extraction: {
    productName: string
    category: string
    chineseKeywords: Array<{ ko: string; zh: string }>
    xhsSearchQueries: string[]
    summary: string
  }
  similarVideos: SimilarVideo[]
  notice?: string
  error?: string
}

export type ProductUrlSearchStudioViewProps = {
  onStepChange?: (step: number) => void
}

function shotformOpenAIKey(): string | null {
  if (typeof window === "undefined") return null
  return (localStorage.getItem("shotform_openai_api_key") || "").trim() || null
}

function shotformApifyToken(): string | null {
  if (typeof window === "undefined") return null
  return (localStorage.getItem("shotform_apify_token") || "").trim() || null
}

function formatCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString("ko-KR")
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function UrlHeroInput({
  value,
  onChange,
  onSubmit,
  loading,
  retryAttempt,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  loading: boolean
  retryAttempt: number
}) {
  return (
    <div className="relative mx-auto w-full max-w-2xl">
      <div className="relative">
        <Link2 className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={loading}
          placeholder="쿠팡 · 네이버 · 11번가 제품 링크 붙여넣기"
          className={cn(pack.input, "pl-12")}
          onKeyDown={(e) => e.key === "Enter" && !loading && onSubmit()}
        />
        <button
          type="button"
          disabled={loading}
          onClick={onSubmit}
          className={cn(
            "absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition disabled:opacity-70",
            "bg-[#1c1917] hover:bg-[#292524]"
          )}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {retryAttempt > 1 ? `${retryAttempt}/${MAX_XHS_URL_ATTEMPTS}` : "분석"}
            </>
          ) : (
            <>
              시작
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

function SourceVideoCard({
  video,
  index,
  selected,
  selectDisabled,
  onToggle,
}: {
  video: SimilarVideo
  index: number
  selected: boolean
  selectDisabled: boolean
  onToggle: () => void
}) {
  const hasMp4 = video.videoUrl?.trim().startsWith("http")
  const presenter = isLikelyPresenterTitle(video.title)
  const disabled = !hasMp4 || presenter || (selectDisabled && !selected)
  const durationLabel = formatMediaDurationLabel(video.durationSec)

  return (
    <article
      className={cn(
        "group relative flex-shrink-0 snap-center transition-all duration-300",
        "w-[min(72vw,220px)] sm:w-[200px] lg:w-auto",
        selected && "scale-[1.02] lg:scale-105"
      )}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        className={cn(
          "relative w-full overflow-hidden rounded-[1.25rem] text-left transition-all",
          selected
            ? "ring-[3px] ring-[#ff4d3d] ring-offset-4 ring-offset-[#f7f4ef] shadow-[0_20px_40px_rgba(255,77,61,0.2)]"
            : "ring-1 ring-[#1c1917]/10 shadow-[0_8px_24px_rgba(28,25,23,0.08)] hover:ring-[#1c1917]/20 hover:shadow-[0_12px_32px_rgba(28,25,23,0.12)]",
          disabled && "cursor-not-allowed opacity-50"
        )}
        aria-pressed={selected}
      >
        <div className="relative bg-stone-900">
          <MvpXhsInlineVideoPreview
            videoUrl={video.videoUrl}
            thumbnail={video.thumbnail}
            title={video.title}
            aspectClass="aspect-[9/16]"
            loadPriority={index < 8 ? "eager" : "lazy"}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

          <span className="absolute left-3 top-3 rounded-full bg-[#ff4d3d] px-2.5 py-0.5 text-[10px] font-bold text-white">
            小红书
          </span>

          {selected ? (
            <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#ff4d3d] text-white shadow-lg">
              ✓
            </span>
          ) : (
            <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-stone-400 opacity-0 transition group-hover:opacity-100">
              <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
            </span>
          )}
          {durationLabel !== "—" ? (
            <span className="pointer-events-none absolute bottom-14 right-3 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
              {durationLabel}
            </span>
          ) : null}

          <div className="absolute bottom-0 left-0 right-0 p-3">
            <p className="line-clamp-2 text-xs font-semibold leading-snug text-white">{video.title || "제목 없음"}</p>
            <div className="mt-1.5 flex items-center gap-3 text-[10px] text-white/75">
              {durationLabel !== "—" ? <span>{durationLabel}</span> : null}
              <span className="flex items-center gap-0.5">
                <Film className="h-3 w-3" />
                {formatCount(video.viewCount)}
              </span>
              <span className="flex items-center gap-0.5">
                <Heart className="h-3 w-3" />
                {formatCount(video.likeCount)}
              </span>
            </div>
          </div>
        </div>
      </button>
      {presenter ? (
        <p className="mt-2 text-center text-[10px] font-medium text-amber-600">인물 영상 · 선택 불가</p>
      ) : null}
    </article>
  )
}

export function ProductUrlSearchStudioView({ onStepChange }: ProductUrlSearchStudioViewProps) {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [retryAttempt, setRetryAttempt] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const [data, setData] = useState<SearchResponse | null>(null)
  const [editPicks, setEditPicks] = useState<AutoEditPick[]>([])
  const [autoEditOpen, setAutoEditOpen] = useState(false)
  const [pickHint, setPickHint] = useState<string | null>(null)

  const activeStep = useMemo(() => {
    if (autoEditOpen || editPicks.length > 0) return 3
    if (loading || data) return 2
    return 1
  }, [autoEditOpen, editPicks.length, loading, data])

  useEffect(() => {
    onStepChange?.(activeStep)
  }, [activeStep, onStepChange])

  const playableVideos = useMemo(
    () =>
      (data?.similarVideos || []).filter(
        (v) => v.videoUrl?.trim().startsWith("http") && !isLikelyPresenterTitle(v.title)
      ),
    [data?.similarVideos]
  )

  const editPickKeys = useMemo(() => new Set(editPicks.map((p) => p.key)), [editPicks])

  const toggleVideoPick = useCallback((item: SimilarVideo) => {
    if (!item.videoUrl?.trim().startsWith("http")) return
    if (isLikelyPresenterTitle(item.title)) {
      setPickHint("인물 소개형 영상은 사용할 수 없어요. 제품·사용 장면만 골라 주세요.")
      window.setTimeout(() => setPickHint(null), 3500)
      return
    }
    const key = videoPickKey(item.url, item.videoUrl)
    setEditPicks((prev) => {
      const exists = prev.find((p) => p.key === key)
      if (exists) {
        return prev
          .filter((p) => p.key !== key)
          .map((p, i) => ({ ...p, video_id: `video_${String(i + 1).padStart(3, "0")}` }))
      }
      if (prev.length >= MAX_AUTO_EDIT_VIDEOS) return prev
      return [
        ...prev,
        {
          key,
          video_id: `video_${String(prev.length + 1).padStart(3, "0")}`,
          videoUrl: item.videoUrl,
          title: item.title,
          noteUrl: item.url,
          platform: "xiaohongshu",
        },
      ]
    })
  }, [])

  const clearPicks = useCallback(() => {
    setEditPicks([])
    setAutoEditOpen(false)
  }, [])

  const runSearch = async () => {
    setErr(null)
    setData(null)
    setEditPicks([])
    const trimmed = url.trim()
    if (!trimmed) {
      setErr("제품·쇼핑 URL을 입력해 주세요.")
      return
    }
    const openai = shotformOpenAIKey()
    if (!openai) {
      setErr("ShotForm 설정에서 OpenAI API 키를 저장해 주세요.")
      return
    }
    const apify = shotformApifyToken()
    if (!apify) {
      setErr("ShotForm 설정에서 소스 검색 토큰을 저장해 주세요.")
      return
    }

    setLoading(true)
    setRetryAttempt(0)
    try {
      let lastJson: (SearchResponse & { error?: string }) | null = null

      for (let attempt = 1; attempt <= MAX_XHS_URL_ATTEMPTS; attempt++) {
        setRetryAttempt(attempt)
        if (attempt > 1) await sleep(XHS_URL_RETRY_DELAY_MS)

        const res = await fetch("/api/shotform/mvp-test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: trimmed, openaiApiKey: openai, apifyApiKey: apify }),
        })
        const json = (await res.json().catch(() => ({}))) as SearchResponse & { error?: string }
        lastJson = json

        if (!res.ok) {
          if (res.status === 400 || res.status === 401 || res.status === 403) {
            setErr(json.error || `요청 실패 (${res.status})`)
            return
          }
          continue
        }

        const videoCount = (json.similarVideos || []).filter((v) => v.videoUrl?.startsWith("http")).length
        if (videoCount > 0 || attempt === MAX_XHS_URL_ATTEMPTS) {
          setData({
            ...json,
            notice:
              attempt > 1 && videoCount > 0
                ? `${attempt}회 시도 후 영상 ${videoCount}건 · ${json.notice || ""}`
                : json.notice,
          })
          writeProductInputUrlToSession(trimmed)
          if (videoCount === 0) {
            setErr(`${MAX_XHS_URL_ATTEMPTS}회 시도 후에도 小红书 영상을 찾지 못했습니다.`)
          }
          return
        }
      }

      if (lastJson && !lastJson.error) {
        setData(lastJson)
        setErr(`${MAX_XHS_URL_ATTEMPTS}회 시도 후에도 小红书 영상을 찾지 못했습니다.`)
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "네트워크 오류")
    } finally {
      setLoading(false)
      setRetryAttempt(0)
    }
  }

  return (
    <div className="pb-32">
      {/* ── Hero ── */}
      <section className={cn(pack.hero, "px-4 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-14")}>
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-10 left-10 h-40 w-40 rounded-full bg-[#1c1917]/10 blur-2xl"
          aria-hidden
        />

        <div className="relative mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5" />
            URL 하나로 쇼츠 완성
          </span>
          <h1 className="mt-5 text-3xl font-black leading-[1.15] tracking-tight text-white sm:text-5xl">
            제품 링크 넣고
            <br />
            <span className="text-white/90">AI 쇼츠 받기</span>
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-white/80 sm:text-base">
            쿠팡·네이버 URL → 小红书 소스 수집 → 20~60초 짜집기 · 대본까지 한 번에
          </p>

          <div className="mt-8 sm:mt-10">
            <UrlHeroInput
              value={url}
              onChange={setUrl}
              onSubmit={() => void runSearch()}
              loading={loading}
              retryAttempt={retryAttempt}
            />
            <p className="mt-3 text-xs text-white/60">OpenAI + 소스 검색 API 키 필요</p>
          </div>
        </div>
      </section>

      {/* ── Body ── */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {err ? (
          <div className="-mt-6 relative z-10 mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm">
            {err}
          </div>
        ) : null}

        {loading ? (
          <div className={cn(pack.card, "-mt-10 relative z-10 mx-auto max-w-md p-10 text-center")}>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#fff0ec]">
              <Loader2 className="h-8 w-8 animate-spin text-[#ff4d3d]" />
            </div>
            <p className="mt-5 text-lg font-bold text-[#1c1917]">소스 찾는 중…</p>
            <p className="mt-2 text-sm text-stone-500">
              {retryAttempt > 1
                ? `小红书 검색 재시도 ${retryAttempt}/${MAX_XHS_URL_ATTEMPTS}`
                : "제품 분석 → 키워드 추출 → 영상 검색"}
            </p>
            <div className="mt-6 flex justify-center gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-8 animate-pulse rounded-full bg-[#ff4d3d]/30"
                  style={{ animationDelay: `${i * 200}ms` }}
                />
              ))}
            </div>
          </div>
        ) : null}

        {!loading && !data ? (
          <div className="-mt-8 relative z-10 grid gap-4 sm:grid-cols-3">
            {[
              { icon: Link2, title: "URL 붙여넣기", desc: "쇼핑몰 제품 페이지만 있으면 OK" },
              { icon: Zap, title: "소스 자동 수집", desc: "小红书에서 비슷한 쇼핑·데모 영상" },
              { icon: Wand2, title: "AI 쇼츠 생성", desc: `1~${MAX_AUTO_EDIT_VIDEOS}개 고르면 짜집기 + 대본` },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className={cn(pack.card, "p-6")}>
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff0ec] text-[#ff4d3d]">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-bold text-[#1c1917]">{title}</h3>
                <p className="mt-1 text-sm text-stone-500">{desc}</p>
              </div>
            ))}
          </div>
        ) : null}

        {data && !loading ? (
          <div className="-mt-10 relative z-10 space-y-8">
            {data.notice ? (
              <p className="rounded-xl bg-sky-50 px-4 py-2 text-xs text-sky-800">{data.notice}</p>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
              {/* 제품 카드 — sticky */}
              <aside className="lg:sticky lg:top-20 lg:self-start">
                <div className={cn(pack.card, "overflow-hidden")}>
                  <div className="bg-gradient-to-br from-[#1c1917] to-[#44403c] px-6 py-8 text-white">
                    <p className={cn(pack.label, "!text-white/50")}>분석된 제품</p>
                    <h2 className="mt-2 text-2xl font-black leading-tight">{data.extraction.productName}</h2>
                    <p className="mt-2 text-sm text-white/70">{data.extraction.category}</p>
                  </div>
                  <div className="space-y-4 p-6">
                    {data.extraction.summary ? (
                      <p className="text-sm leading-relaxed text-stone-600">{data.extraction.summary}</p>
                    ) : null}
                    <div className="flex items-center justify-between rounded-2xl bg-[#faf8f5] px-4 py-3">
                      <span className="text-sm font-medium text-stone-600">편집 가능 소스</span>
                      <span className="text-2xl font-black text-[#ff4d3d]">{playableVideos.length}</span>
                    </div>
                    {data.extraction.xhsSearchQueries.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {data.extraction.xhsSearchQueries.slice(0, 6).map((q) => (
                          <span key={q} className={pack.chip}>
                            {q}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </aside>

              {/* 영상 갤러리 */}
              <section>
                <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className={pack.label}>소스 선택</p>
                    <h3 className="mt-1 text-xl font-black text-[#1c1917]">
                      탭해서 고르세요 · 최대 {MAX_AUTO_EDIT_VIDEOS}개
                    </h3>
                  </div>
                  {pickHint ? (
                    <p className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">{pickHint}</p>
                  ) : null}
                </div>

                {playableVideos.length === 0 ? (
                  <div className={cn(pack.card, "py-16 text-center text-stone-500")}>
                    편집 가능한 영상이 없습니다. 다른 URL로 시도해 주세요.
                  </div>
                ) : (
                  <>
                    {/* 모바일: 가로 스크롤 필름스트립 */}
                    <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:hidden">
                      {playableVideos.map((v, i) => {
                        const key = videoPickKey(v.url, v.videoUrl)
                        return (
                          <SourceVideoCard
                            key={key}
                            video={v}
                            index={i}
                            selected={editPickKeys.has(key)}
                            selectDisabled={!editPickKeys.has(key) && editPicks.length >= MAX_AUTO_EDIT_VIDEOS}
                            onToggle={() => toggleVideoPick(v)}
                          />
                        )
                      })}
                    </div>
                    {/* 데스크톱: 그리드 */}
                    <div className="hidden gap-5 sm:grid-cols-3 lg:grid xl:grid-cols-4">
                      {playableVideos.map((v, i) => {
                        const key = videoPickKey(v.url, v.videoUrl)
                        return (
                          <SourceVideoCard
                            key={key}
                            video={v}
                            index={i}
                            selected={editPickKeys.has(key)}
                            selectDisabled={!editPickKeys.has(key) && editPicks.length >= MAX_AUTO_EDIT_VIDEOS}
                            onToggle={() => toggleVideoPick(v)}
                          />
                        )
                      })}
                    </div>
                  </>
                )}
              </section>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── 플로팅 CTA ── */}
      {editPicks.length > 0 ? (
        <div className="fixed bottom-6 left-1/2 z-50 w-[min(calc(100vw-2rem),520px)] -translate-x-1/2">
          <div className={cn(pack.card, "flex flex-col gap-3 p-4 shadow-[0_24px_60px_rgba(28,25,23,0.18)] sm:flex-row sm:items-center sm:justify-between")}>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#1c1917]">
                {editPicks.length}개 선택됨 · AI 쇼츠 만들 준비 완료
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {editPicks.map((p, i) => (
                  <span
                    key={p.key}
                    className="inline-flex max-w-[140px] items-center gap-1 rounded-full bg-[#faf8f5] px-2 py-0.5 text-[10px] text-stone-600"
                  >
                    <span className="truncate">{i + 1}. {p.title.slice(0, 16)}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setEditPicks((prev) =>
                          prev
                            .filter((x) => x.key !== p.key)
                            .map((x, j) => ({ ...x, video_id: `video_${String(j + 1).padStart(3, "0")}` }))
                        )
                      }
                      className="shrink-0 text-stone-400 hover:text-stone-700"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={clearPicks} className="rounded-xl px-3 py-2 text-sm text-stone-500 hover:bg-stone-100">
                취소
              </button>
              <button type="button" onClick={() => setAutoEditOpen(true)} className={cn(pack.btnAccent, "flex items-center gap-2 whitespace-nowrap")}>
                <Scissors className="h-4 w-4" />
                AI 쇼츠 만들기
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <MvpAutoEditDialog open={autoEditOpen} onOpenChange={setAutoEditOpen} picks={editPicks} />
    </div>
  )
}
