"use client"

import { useCallback, useRef, useState } from "react"
import { Clapperboard, FileText, Film, FolderOpen, Loader2, Mic } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { AutoEditJobResult } from "@/lib/shotform-auto-edit-types"
import type { NarrationSegment } from "@/lib/shotform-factory-narration-script"
import type { VoiceLineCue } from "@/lib/shotform-factory-line-tts"
import { downloadBlob } from "@/lib/shotform-factory-capcut-export"
import {
  buildMvpCapCutExportInput,
  buildMvpSubtitleSrt,
  exportMvpCapCutProject,
  fetchMvpTtsBlob,
  fetchMvpVideoBlob,
} from "@/lib/mvp-capcut-export"
import { renderMvpPreviewToBlob } from "@/lib/mvp-preview-render"
import { mvpAssetDownloadFilename, mvpRenderDownloadFilename } from "@/lib/mvp-render-filename"
import type { LineSubtitleCue } from "@/lib/shotform-mvp-edit-script"
import type { PlacedStudioOverlay } from "@/lib/shotform-studio-overlay-catalog"
import type { MvpBgmClip, MvpScriptStyleState, MvpSubtitleStyle } from "@/lib/mvp-studio-types"
import { cn } from "@/lib/utils"
import { StudioPageCard, studio } from "../components/ShotFormStudioUI"

type Props = {
  projectName: string
  result: AutoEditJobResult
  videoUrl: string | null
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
  bgmClips: MvpBgmClip[]
}

type BusyKind = "capcut" | "render" | "mix" | "tts" | "srt" | null

export function MvpExportPanel({
  projectName,
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
  segments,
  lineSchedule,
  subtitleStyle,
  placedOverlays,
  thumbnailUrl,
  thumbnailIntroOn,
  bgmClips,
}: Props) {
  const exportTileBtn = cn(
    studio.btnSecondary,
    "h-auto flex-col items-start gap-1 py-4 text-left"
  )

  const [busy, setBusy] = useState<BusyKind>(null)
  const [exportMsg, setExportMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const videoBlobRef = useRef<Blob | null>(null)

  const buildInput = useCallback(async () => {
    if (!videoBlobRef.current) {
      videoBlobRef.current = await fetchMvpVideoBlob(videoUrl, result.downloadUrl)
    }
    return buildMvpCapCutExportInput({
      result,
      videoBlob: videoBlobRef.current,
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
      seo: scriptStyle.commentKeyword
        ? {
            title: scriptStyle.headcopies[0]?.[0] || scriptStyle.commentKeyword,
            description: scriptStyle.conversionScript.slice(0, 200),
            tags: [scriptStyle.commentKeyword],
            hashtags: [`#${scriptStyle.commentKeyword}`],
            hookShort: scriptStyle.headcopies[0]?.join(" ") || "",
          }
        : undefined,
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
    bgmClips,
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
      const blob =
        videoBlobRef.current ?? (await fetchMvpVideoBlob(videoUrl, result.downloadUrl))
      if (!blob || blob.size < 4096) {
        throw new Error("영상 파일을 읽을 수 없습니다. 다시 편집 후 시도하세요.")
      }
      videoBlobRef.current = blob
      downloadBlob(blob, mvpAssetDownloadFilename(projectName, "mix", "mp4"))
      setExportMsg("짜집기 영상(MP4)을 다운로드했습니다.")
    } catch (e) {
      setErr(e instanceof Error ? e.message : "영상 다운로드 실패")
    } finally {
      setBusy(null)
    }
  }, [projectName, videoUrl, result.downloadUrl])

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
      setExportMsg("렌더 완료. 자막·썸네일·TTS가 합쳐진 MP4를 다운로드했습니다.")
    } catch (e) {
      setErr(e instanceof Error ? e.message : "렌더 실패")
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
  ])

  return (
    <StudioPageCard className="border-emerald-500/25 bg-emerald-950/10">
      <p className={studio.label}>8. 보내기</p>
      <h3 className="mt-1 text-lg font-semibold text-white">CapCut · 렌더 보내기</h3>
      <p className="mt-1 text-xs text-slate-400">
        CapCut PC용 프로젝트를 보내거나, 자막·썸네일·TTS가 합쳐진 MP4(렌더)와 개별 파일(TTS·SRT)을 받을 수
        있습니다.
      </p>

      {err ? <p className="mt-3 text-sm text-red-300">{err}</p> : null}
      {exportMsg ? <p className="mt-3 text-sm text-emerald-300">{exportMsg}</p> : null}

      {thumbnailUrl ? (
        <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <div className="overflow-hidden rounded-lg border border-amber-500/30 shadow-lg">
            <img
              src={thumbnailUrl}
              alt="썸네일 미리보기"
              className="aspect-[9/16] w-[min(100%,140px)] object-cover"
            />
          </div>
          <div className="text-xs text-slate-400">
            <p className="font-medium text-amber-100">썸네일 적용됨</p>
            <p className="mt-1">렌더 MP4 앞부분에 썸네일 인트로가 잠깐 들어갑니다.</p>
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          variant="ghost"
          className={cn(studio.btnPrimary, "h-auto flex-col items-start gap-1 py-4 text-left")}
          disabled={busy != null}
          onClick={() => void handleCapCutExport()}
        >
          {busy === "capcut" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FolderOpen className="h-4 w-4" />
          )}
          <span className="font-semibold">CapCut 보내기</span>
          <span className="text-[10px] font-normal opacity-80">영상+TTS+자막 패키지</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          className={exportTileBtn}
          disabled={busy != null}
          onClick={() => void handleRender()}
        >
          {busy === "render" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Clapperboard className="h-4 w-4" />
          )}
          <span className="font-semibold">렌더</span>
          <span className="text-[10px] font-normal text-slate-400">자막·썸네일·TTS → MP4</span>
        </Button>
      </div>

      <div className="mt-8">
        <p className="text-xs font-medium text-slate-300">개별 받기</p>
        <p className="mt-0.5 text-[10px] text-slate-500">각 파일을 따로 저장할 수 있습니다.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Button
            type="button"
            variant="ghost"
            className={exportTileBtn}
            disabled={busy != null}
            onClick={() => void handleDownloadMixVideo()}
          >
            {busy === "mix" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Film className="h-4 w-4" />
            )}
            <span className="font-semibold">짜집기 영상</span>
            <span className="text-[10px] font-normal text-slate-400">TTS 없는 믹스 MP4</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={exportTileBtn}
            disabled={busy != null}
            onClick={() => void handleDownloadTts()}
          >
            {busy === "tts" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
            <span className="font-semibold">TTS 음성</span>
            <span className="text-[10px] font-normal text-slate-400">나레이션만 따로</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={exportTileBtn}
            disabled={busy != null}
            onClick={() => void handleDownloadSrt()}
          >
            {busy === "srt" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            <span className="font-semibold">자막(SRT)</span>
            <span className="text-[10px] font-normal text-slate-400">자막 파일만</span>
          </Button>
        </div>
      </div>
    </StudioPageCard>
  )
}
