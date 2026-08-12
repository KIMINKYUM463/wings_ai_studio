"use client"

import { useCallback, useRef, useState } from "react"
import {
  CheckCircle2,
  Clapperboard,
  Download,
  FileText,
  Film,
  ImageIcon,
  Loader2,
  Mic,
  Sparkles,
  Tags,
} from "lucide-react"
import type { AutoEditJobResult } from "@/lib/shotform-auto-edit-types"
import type { NarrationSegment } from "@/lib/shotform-factory-narration-script"
import type { VoiceLineCue } from "@/lib/shotform-factory-line-tts"
import { downloadBlob } from "@/lib/shotform-factory-capcut-export"
import {
  buildMvpCapCutExportInput,
  buildMvpSubtitleSrt,
  exportMvpCapCutProject,
  fetchMvpTtsBlob,
} from "@/lib/mvp-capcut-export"
import { resolveMvpStudioVideoBlob } from "@/lib/mvp-studio-video-blob"
import { renderMvpPreviewToBlob } from "@/lib/mvp-preview-render"
import { mvpAssetDownloadFilename, mvpRenderDownloadFilename } from "@/lib/mvp-render-filename"
import type { LineSubtitleCue } from "@/lib/shotform-mvp-edit-script"
import type { PlacedStudioOverlay } from "@/lib/shotform-studio-overlay-catalog"
import type {
  MvpBgmClip,
  MvpEffectClip,
  MvpScriptStyleState,
  MvpStudioSeoMeta,
  MvpSubtitleStyle,
} from "@/lib/mvp-studio-types"
import type { MvpVideoSourceTransforms } from "@/lib/mvp-video-source-transform"
import { mvpSeoMetaToCapCutSeo, seoMetaIsReady } from "@/lib/mvp-studio-seo"
import { cn } from "@/lib/utils"
import { MvpSeoMetaPanel } from "./MvpSeoMetaPanel"

type Props = {
  projectName: string
  projectId?: string
  result: AutoEditJobResult
  videoUrl: string | null
  videoBlobRef?: React.MutableRefObject<Blob | null>
  audioUrl: string | null
  ttsBlobRef: React.MutableRefObject<Blob | null>
  voiceLineCues: VoiceLineCue[] | null
  sceneText: (sceneIndex0: number) => string
  voiceId: string
  voiceStyle: string
  videoDurationSec: number
  audioDurationSec: number
  scriptStyle: MvpScriptStyleState
  segments: NarrationSegment[]
  lineSchedule: LineSubtitleCue[]
  subtitleStyle: MvpSubtitleStyle
  placedOverlays: PlacedStudioOverlay[]
  thumbnailUrl?: string
  thumbnailIntroOn: boolean
  seoMeta: MvpStudioSeoMeta
  onSeoMetaChange: (next: MvpStudioSeoMeta) => void
  productName?: string
  sourceKeywords?: string[]
  bgmClips: MvpBgmClip[]
  effectClips: MvpEffectClip[]
  videoSourceTransforms?: MvpVideoSourceTransforms
}

type BusyKind = "capcut" | "render" | "mix" | "tts" | "srt" | "thumb" | null

async function loadExportVideoBlob(
  videoBlobRef: React.MutableRefObject<Blob | null> | undefined,
  videoUrl: string | null,
  result: AutoEditJobResult,
  projectId?: string
): Promise<Blob | null> {
  if (videoBlobRef?.current && videoBlobRef.current.size >= 4096) {
    return videoBlobRef.current
  }
  const blob = await resolveMvpStudioVideoBlob({
    videoUrl,
    downloadUrl: result.downloadUrl,
    jobId: result.jobId,
    projectId,
  })
  if (blob && videoBlobRef) videoBlobRef.current = blob
  return blob
}

function ExportActionCard({
  title,
  description,
  icon,
  busy,
  primary,
  disabled,
  onClick,
}: {
  title: string
  description: string
  icon: React.ReactNode
  busy: boolean
  primary?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group flex w-full flex-col items-start gap-3 rounded-2xl border p-5 text-left transition",
        primary
          ? "border-blue-200 bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-blue-400"
          : "border-slate-200 bg-white text-slate-900 shadow-sm hover:border-slate-300 hover:shadow-md",
        disabled && "pointer-events-none opacity-55"
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl",
          primary ? "bg-white/15" : "bg-slate-100 text-slate-700 group-hover:bg-slate-200/80"
        )}
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
      </span>
      <div>
        <p className={cn("text-sm font-bold", primary ? "text-white" : "text-slate-900")}>{title}</p>
        <p className={cn("mt-1 text-[11px] leading-relaxed", primary ? "text-blue-50/85" : "text-slate-500")}>
          {description}
        </p>
      </div>
    </button>
  )
}

function AssetDownloadButton({
  label,
  hint,
  icon,
  busy,
  disabled,
  onClick,
}: {
  label: string
  hint: string
  icon: React.ReactNode
  busy: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50",
        disabled && "pointer-events-none opacity-55"
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-slate-900">{label}</span>
        <span className="mt-0.5 block text-[10px] text-slate-500">{hint}</span>
      </span>
      <Download className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-400" />
    </button>
  )
}

export function MvpExportPanel({
  projectName,
  projectId,
  result,
  videoUrl,
  videoBlobRef: parentVideoBlobRef,
  audioUrl,
  ttsBlobRef,
  voiceLineCues,
  sceneText,
  voiceId,
  voiceStyle,
  videoDurationSec,
  audioDurationSec,
  scriptStyle,
  segments,
  lineSchedule,
  subtitleStyle,
  placedOverlays,
  thumbnailUrl,
  thumbnailIntroOn,
  seoMeta,
  onSeoMetaChange,
  productName,
  sourceKeywords = [],
  bgmClips,
  effectClips,
  videoSourceTransforms = {},
}: Props) {
  const [busy, setBusy] = useState<BusyKind>(null)
  const [exportMsg, setExportMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const localVideoBlobRef = useRef<Blob | null>(null)
  const videoBlobRef = parentVideoBlobRef ?? localVideoBlobRef

  const seoReady = seoMetaIsReady(seoMeta)

  const buildInput = useCallback(async () => {
    const blob = await loadExportVideoBlob(videoBlobRef, videoUrl, result, projectId)
    return buildMvpCapCutExportInput({
      result,
      videoBlob: blob,
      videoUrl,
      audioUrl,
      ttsFallbackBlob: ttsBlobRef.current,
      voiceLineCues,
      sceneText,
      voiceId,
      voiceStyle,
      videoDurationSec,
      audioDurationSec,
      projectLabel: result.productAnalysis?.productName,
      bgmClips,
      seo:
        mvpSeoMetaToCapCutSeo(seoMeta) ??
        (scriptStyle.commentKeyword
          ? {
              title: scriptStyle.headcopies[0]?.[0] || scriptStyle.commentKeyword,
              description: scriptStyle.conversionScript.slice(0, 200),
              tags: [scriptStyle.commentKeyword],
              hashtags: [`#${scriptStyle.commentKeyword}`],
              hookShort: scriptStyle.headcopies[0]?.join(" ") || "",
            }
          : undefined),
    })
  }, [
    result,
    videoUrl,
    audioUrl,
    ttsBlobRef,
    voiceLineCues,
    sceneText,
    voiceId,
    voiceStyle,
    videoDurationSec,
    audioDurationSec,
    scriptStyle,
    seoMeta,
    bgmClips,
    projectId,
    videoBlobRef,
  ])

  const handleCapCutExport = useCallback(async () => {
    setBusy("capcut")
    setErr(null)
    setExportMsg(null)
    try {
      const input = await buildInput()
      const out = await exportMvpCapCutProject(input)
      if (out.mode === "folder") {
        setExportMsg(
          `CapCut drafts 폴더에 「${out.folderName}」 프로젝트를 저장했습니다. CapCut을 실행하세요.`
        )
      } else {
        setExportMsg(
          `CapCut ZIP (${out.filename}) 저장 완료. drafts 폴더에 풀고 CapCut을 실행하세요.`
        )
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "CapCut 보내기 실패")
    } finally {
      setBusy(null)
    }
  }, [buildInput])

  const handleDownloadMixVideo = useCallback(async () => {
    setBusy("mix")
    setErr(null)
    setExportMsg(null)
    try {
      if (!videoUrl && !result.downloadUrl) {
        throw new Error("영상 URL이 없습니다. 먼저 편집 단계에서 영상을 불러오세요.")
      }
      const blob = await loadExportVideoBlob(videoBlobRef, videoUrl, result, projectId)
      if (!blob || blob.size < 4096) {
        throw new Error(
          "리믹스 영상을 불러오지 못했습니다. 편집 탭에서 미리보기가 재생되는지 확인한 뒤 다시 시도해 주세요."
        )
      }
      downloadBlob(blob, mvpAssetDownloadFilename(projectName, "mix", "mp4"))
      setExportMsg("리믹스 영상(MP4)을 다운로드했습니다.")
    } catch (e) {
      setErr(e instanceof Error ? e.message : "영상 다운로드 실패")
    } finally {
      setBusy(null)
    }
  }, [projectName, projectId, videoUrl, result, videoBlobRef])

  const handleDownloadTts = useCallback(async () => {
    setBusy("tts")
    setErr(null)
    setExportMsg(null)
    try {
      const out = await fetchMvpTtsBlob(audioUrl, ttsBlobRef.current)
      if (!out) {
        throw new Error("TTS가 없습니다. 먼저 편집기에서 TTS를 생성한 뒤 시도하세요.")
      }
      downloadBlob(out.blob, mvpAssetDownloadFilename(projectName, "tts", out.ext))
      setExportMsg(`TTS 음성(${out.ext.toUpperCase()})을 다운로드했습니다.`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "TTS 다운로드 실패")
    } finally {
      setBusy(null)
    }
  }, [projectName, audioUrl, ttsBlobRef])

  const handleDownloadSrt = useCallback(async () => {
    setBusy("srt")
    setErr(null)
    setExportMsg(null)
    try {
      const srt = buildMvpSubtitleSrt({
        voiceLineCues,
        lineSchedule,
        sceneText,
        hasAudio: Boolean(audioUrl || ttsBlobRef.current),
      }).trim()
      if (!srt) {
        throw new Error("자막이 없습니다. 자막·TTS를 먼저 생성하세요.")
      }
      const blob = new Blob([srt], { type: "text/plain;charset=utf-8" })
      downloadBlob(blob, mvpAssetDownloadFilename(projectName, "subtitles", "srt"))
      setExportMsg("자막(SRT) 파일을 다운로드했습니다.")
    } catch (e) {
      setErr(e instanceof Error ? e.message : "자막 다운로드 실패")
    } finally {
      setBusy(null)
    }
  }, [projectName, voiceLineCues, lineSchedule, sceneText, audioUrl, ttsBlobRef])

  const handleDownloadThumbnail = useCallback(async () => {
    setBusy("thumb")
    setErr(null)
    setExportMsg(null)
    try {
      if (!thumbnailUrl?.trim()) {
        throw new Error("썸네일이 없습니다. 썸네일 단계에서 먼저 만들어 주세요.")
      }
      const res = await fetch(thumbnailUrl)
      if (!res.ok) throw new Error(`썸네일을 불러오지 못했습니다 (${res.status})`)
      const blob = await res.blob()
      if (blob.size < 64) throw new Error("썸네일 파일이 비어 있습니다.")
      downloadBlob(blob, mvpAssetDownloadFilename(projectName, "thumbnail", "png"))
      setExportMsg("썸네일(PNG)을 다운로드했습니다.")
    } catch (e) {
      setErr(e instanceof Error ? e.message : "썸네일 다운로드 실패")
    } finally {
      setBusy(null)
    }
  }, [projectName, thumbnailUrl])

  const handleRender = useCallback(async () => {
    setBusy("render")
    setErr(null)
    setExportMsg("렌더링 진행 중입니다 (완료 후 자동 다운로드됩니다)")
    try {
      if (!videoUrl) {
        throw new Error("영상 URL이 없습니다. 먼저 편집 단계에서 영상을 불러오세요.")
      }

      let resolvedAudioUrl = audioUrl
      let tempAudioUrl: string | null = null
      if (!resolvedAudioUrl && ttsBlobRef.current) {
        tempAudioUrl = URL.createObjectURL(ttsBlobRef.current)
        resolvedAudioUrl = tempAudioUrl
      }
      if (!resolvedAudioUrl) {
        throw new Error("TTS가 없습니다. 먼저 편집기에서 TTS를 생성한 뒤 렌더하세요.")
      }

      const { blob, ext } = await renderMvpPreviewToBlob({
        videoUrl,
        audioUrl: resolvedAudioUrl,
        voiceLineCues,
        segments,
        lineSchedule,
        subtitleStyle,
        thumbnailUrl,
        thumbnailIntroOn,
        placedOverlays,
        videoDurationSec,
        audioDurationSec,
        bgmClips,
        effectClips,
        editPlan: result.editPlan?.edit_plan ?? [],
        videoSourceTransforms,
        onProgress: (ratio) => {
          if (ratio >= 0.84) {
            setExportMsg(
              `MP4 인코딩 중 ${Math.round(((ratio - 0.84) / 0.16) * 100)}% (약 1분 ffmpeg 대기)`
            )
          } else {
            setExportMsg(`렌더링 중 ${Math.round((ratio / 0.82) * 100)}%`)
          }
        },
      })

      if (tempAudioUrl) URL.revokeObjectURL(tempAudioUrl)

      downloadBlob(blob, mvpRenderDownloadFilename(projectName, ext))
      setExportMsg(
        "렌더 완료. 자막·모자이크·썸네일·TTS·효과음이 합쳐진 MP4를 다운로드했습니다."
      )
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : e && typeof e === "object" && "message" in e
              ? String((e as { message: unknown }).message)
              : "렌더 실패"
      setErr(msg || "렌더 실패")
      setExportMsg(null)
    } finally {
      setBusy(null)
    }
  }, [
    projectName,
    videoUrl,
    audioUrl,
    ttsBlobRef,
    voiceLineCues,
    segments,
    lineSchedule,
    subtitleStyle,
    thumbnailUrl,
    thumbnailIntroOn,
    placedOverlays,
    videoDurationSec,
    audioDurationSec,
    bgmClips,
    effectClips,
    videoSourceTransforms,
    result.editPlan?.edit_plan,
  ])

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-1 pb-8 pt-2">
      <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(ellipse_at_top_right,_rgba(59,130,246,0.12),_transparent_60%)]" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-blue-600">EXPORT</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">내보내기</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
              업로드용 제목·태그를 확정한 뒤, CapCut 프로젝트나 완성 MP4로 내보냅니다.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-medium text-slate-400">프로젝트</p>
            <p className="mt-0.5 max-w-[220px] truncate text-sm font-semibold text-slate-800">
              {projectName || "이름 없는 프로젝트"}
            </p>
          </div>
        </div>
      </header>

      {err ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</p>
      ) : null}
      {exportMsg ? (
        <p className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{exportMsg}</span>
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
              <Tags className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">제목 · 설명 · 태그</h3>
              <p className="text-[11px] text-slate-500">유튜브·숏폼 업로드 메타데이터</p>
            </div>
            {seoReady ? (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                <CheckCircle2 className="h-3 w-3" />
                작성됨
              </span>
            ) : (
              <span className="ml-auto rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
                AI 생성 권장
              </span>
            )}
          </div>
          <MvpSeoMetaPanel
            productName={productName}
            projectName={projectName}
            sourceKeywords={sourceKeywords}
            referenceTitles={
              scriptStyle.commentKeyword ? [scriptStyle.commentKeyword] : undefined
            }
            segments={segments}
            videoDurationSec={videoDurationSec}
            value={seoMeta}
            onChange={onSeoMetaChange}
          />
        </section>

        <div className="space-y-6">
          {thumbnailUrl && thumbnailIntroOn ? (
            <section className="flex items-center gap-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
              <div className="overflow-hidden rounded-lg border border-amber-200 shadow-md">
                <img
                  src={thumbnailUrl}
                  alt="썸네일 미리보기"
                  className="aspect-[9/16] w-[88px] object-cover"
                />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-900">썸네일 맨 앞 표시 ON</p>
                <p className="mt-1 text-[11px] leading-relaxed text-amber-800/80">
                  렌더 시 0~0.01초 구간에 미리보기와 동일한 썸네일이 들어갑니다.
                </p>
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <div className="flex items-center gap-2 px-0.5">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">최종 보내기</h3>
            </div>
            <div className="grid gap-3">
              {/* CapCut 보내기는 당분간 숨김 */}
              <ExportActionCard
                primary
                title="렌더 MP4"
                description="자막·모자이크·썸네일·TTS·효과음이 합쳐진 완성본"
                icon={<Clapperboard className="h-5 w-5" />}
                busy={busy === "render"}
                disabled={busy != null}
                onClick={() => void handleRender()}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3">
              <h3 className="text-sm font-bold text-slate-900">개별 파일 받기</h3>
              <p className="mt-0.5 text-[11px] text-slate-500">필요한 에셋만 따로 저장합니다.</p>
            </div>
            <div className="space-y-2">
              <AssetDownloadButton
                label="리믹스 영상"
                hint="TTS 없는 믹스 MP4"
                icon={<Film className="h-4 w-4" />}
                busy={busy === "mix"}
                disabled={busy != null}
                onClick={() => void handleDownloadMixVideo()}
              />
              <AssetDownloadButton
                label="TTS 음성"
                hint="나레이션 오디오만"
                icon={<Mic className="h-4 w-4" />}
                busy={busy === "tts"}
                disabled={busy != null}
                onClick={() => void handleDownloadTts()}
              />
              <AssetDownloadButton
                label="자막 (SRT)"
                hint="자막 파일만"
                icon={<FileText className="h-4 w-4" />}
                busy={busy === "srt"}
                disabled={busy != null}
                onClick={() => void handleDownloadSrt()}
              />
              <AssetDownloadButton
                label="썸네일"
                hint="썸네일 PNG만"
                icon={<ImageIcon className="h-4 w-4" />}
                busy={busy === "thumb"}
                disabled={busy != null || !thumbnailUrl}
                onClick={() => void handleDownloadThumbnail()}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
