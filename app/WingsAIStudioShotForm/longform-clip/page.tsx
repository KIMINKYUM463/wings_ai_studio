"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Home,
  Loader2,
  Scissors,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  Film,
  Clock,
  Flame,
  Link2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type ClipItem = {
  id: string
  rank: number
  title: string
  hook: string
  startSec: number
  endSec: number
  durationSec: number
  score: number
  reason: string
  transcriptSnippet: string
  youtubeWatchUrl: string
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}:${String(m % 60).padStart(2, "0")}:${String(r).padStart(2, "0")}`
  return `${m}:${String(r).padStart(2, "0")}`
}

function getOpenaiKey(): string {
  if (typeof window === "undefined") return ""
  return (
    localStorage.getItem("shotform_openai_api_key") ||
    localStorage.getItem("openai_api_key") ||
    ""
  ).trim()
}

export default function LongformClipPage() {
  const router = useRouter()
  const [url, setUrl] = useState("")
  const [maxClips, setMaxClips] = useState(8)
  const [targetDurationSec, setTargetDurationSec] = useState(45)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<{
    title: string
    author: string
    thumbnail: string
    durationSec?: number | null
  } | null>(null)
  const [videoId, setVideoId] = useState<string | null>(null)
  const [clips, setClips] = useState<ClipItem[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const sortedClips = useMemo(
    () => [...clips].sort((a, b) => a.rank - b.rank),
    [clips]
  )

  const handleAnalyze = async () => {
    setError(null)
    setClips([])
    setMeta(null)
    setVideoId(null)

    const apiKey = getOpenaiKey()
    if (!apiKey) {
      setError("OpenAI API 키가 필요합니다. ShotForm 홈 → 설정(톱니바퀴)에서 입력해주세요.")
      return
    }
    if (!url.trim()) {
      setError("YouTube 롱폼 URL을 입력해주세요.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/shotform/longform-clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          openaiApiKey: apiKey,
          maxClips,
          targetDurationSec,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "클립 분석에 실패했습니다.")
      setMeta(data.meta)
      setVideoId(data.videoId)
      setClips(data.clips || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const copyClip = async (clip: ClipItem) => {
    const text = [
      clip.title,
      clip.hook,
      `${formatTime(clip.startSec)} – ${formatTime(clip.endSec)} (${clip.durationSec}초)`,
      clip.youtubeWatchUrl,
      clip.transcriptSnippet,
    ]
      .filter(Boolean)
      .join("\n")
    await navigator.clipboard.writeText(text)
    setCopiedId(clip.id)
    window.setTimeout(() => setCopiedId(null), 1500)
  }

  const copyAllJson = async () => {
    await navigator.clipboard.writeText(JSON.stringify({ videoId, meta, clips }, null, 2))
    setCopiedId("all")
    window.setTimeout(() => setCopiedId(null), 1500)
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0b0d] text-zinc-100">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-rose-500/15 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-fuchsia-500/12 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0b0d]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/10"
              onClick={() => router.push("/WingsAIStudioShotForm")}
              title="뒤로"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/10"
              onClick={() => router.push("/WingsAIStudioShotForm")}
              title="홈"
            >
              <Home className="h-4 w-4" />
            </Button>
            <div className="ml-1">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/25 bg-rose-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-200">
                <Scissors className="h-3 w-3" />
                Opus-style
              </div>
              <h1 className="mt-1 text-lg font-bold tracking-tight text-zinc-50">AI 롱폼 클립</h1>
            </div>
          </div>
          <Link
            href="/WingsAIStudioShotForm/shorts"
            className="hidden text-sm text-zinc-400 transition hover:text-zinc-200 sm:inline-flex sm:items-center sm:gap-1.5"
          >
            <Film className="h-4 w-4" />
            일반 숏폼으로
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 md:py-8">
        <Card className="border-white/10 bg-white/[0.03] text-zinc-100 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-xl text-zinc-50">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-fuchsia-600">
                <Sparkles className="h-4 w-4 text-white" />
              </span>
              롱폼 URL → 바이럴 숏폼 구간
            </CardTitle>
            <p className="text-sm text-zinc-400">
              <a
                href="https://www.opus.pro/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-rose-300 underline-offset-2 hover:underline"
              >
                OpusClip
              </a>
              처럼 YouTube 롱폼 URL만 넣으면, 자막을 분석해 쇼츠로 쓸 만한 구간을 자동으로 골라줍니다.
              (자막 기반 AI 하이라이트 · 실제 영상 재인코딩은 별도)
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">YouTube URL</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="h-11 border-white/10 bg-black/40 pl-9 text-zinc-100 placeholder:text-zinc-600"
                    onKeyDown={(e) => e.key === "Enter" && void handleAnalyze()}
                  />
                </div>
                <Button
                  onClick={() => void handleAnalyze()}
                  disabled={loading}
                  className="h-11 shrink-0 rounded-xl bg-gradient-to-r from-rose-500 to-fuchsia-600 px-5 font-semibold text-white"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      분석 중…
                    </>
                  ) : (
                    <>
                      <Scissors className="mr-2 h-4 w-4" />
                      클립 생성
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-500">클립 개수</Label>
                <Input
                  type="number"
                  min={3}
                  max={12}
                  value={maxClips}
                  onChange={(e) => setMaxClips(Number(e.target.value) || 8)}
                  className="h-9 w-24 border-white/10 bg-black/40 text-zinc-100"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-500">목표 길이(초)</Label>
                <Input
                  type="number"
                  min={15}
                  max={90}
                  value={targetDurationSec}
                  onChange={(e) => setTargetDurationSec(Number(e.target.value) || 45)}
                  className="h-9 w-28 border-white/10 bg-black/40 text-zinc-100"
                />
              </div>
              <p className="pb-1 text-xs text-zinc-500">
                지원: YouTube (자막/자동생성 자막 필요)
              </p>
            </div>

            {error && (
              <div className="rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {meta && (
          <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={meta.thumbnail}
              alt=""
              className="h-28 w-full rounded-2xl object-cover sm:h-24 sm:w-40"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold text-zinc-50">{meta.title}</p>
              <p className="mt-1 text-sm text-zinc-500">
                {meta.author || "채널"}
                {meta.durationSec ? ` · 약 ${formatTime(meta.durationSec)}` : ""}
                {videoId ? ` · ${videoId}` : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/15 bg-white/5 text-zinc-200"
                  onClick={() => void copyAllJson()}
                >
                  {copiedId === "all" ? (
                    <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  전체 JSON 복사
                </Button>
                {videoId && (
                  <a
                    href={`https://www.youtube.com/watch?v=${videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 text-xs font-medium text-zinc-200 hover:bg-white/10"
                  >
                    원본 열기 <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {sortedClips.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-zinc-100">
                추천 클립 {sortedClips.length}개
              </h2>
              <p className="text-xs text-zinc-500">점수 높은 순 · YouTube에서 해당 시각부터 미리보기</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {sortedClips.map((clip) => (
                <article
                  key={clip.id}
                  className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#121316] transition hover:border-rose-400/35"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-500/20 px-1.5 text-xs font-bold text-rose-200">
                          #{clip.rank}
                        </span>
                        <h3 className="truncate font-semibold text-zinc-50">{clip.title}</h3>
                      </div>
                      {clip.hook && (
                        <p className="mt-1 line-clamp-1 text-sm text-fuchsia-200/90">{clip.hook}</p>
                      )}
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 text-xs font-semibold text-amber-200">
                      <Flame className="h-3 w-3" />
                      {clip.score}
                    </span>
                  </div>
                  <div className="space-y-3 px-4 py-3">
                    <p className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
                      <Clock className="h-3.5 w-3.5" />
                      {formatTime(clip.startSec)} – {formatTime(clip.endSec)} · {clip.durationSec}초
                    </p>
                    {clip.reason && <p className="text-sm text-zinc-300">{clip.reason}</p>}
                    {clip.transcriptSnippet && (
                      <p className="rounded-xl bg-black/40 p-2.5 text-xs leading-relaxed text-zinc-500">
                        {clip.transcriptSnippet}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={clip.youtubeWatchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-fuchsia-600 px-3 text-xs font-semibold text-white"
                      >
                        미리보기 <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 border-white/15 bg-white/5 text-zinc-200"
                        onClick={() => void copyClip(clip)}
                      >
                        {copiedId === clip.id ? (
                          <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        복사
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {!loading && !clips.length && !error && (
          <div className="rounded-3xl border border-dashed border-white/10 py-16 text-center text-sm text-zinc-500">
            롱폼 링크를 넣고 「클립 생성」을 누르면 AI가 하이라이트 구간을 제안합니다.
          </div>
        )}
      </main>
    </div>
  )
}
