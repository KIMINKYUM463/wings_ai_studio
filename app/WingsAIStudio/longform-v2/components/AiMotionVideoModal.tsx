"use client"

import { useEffect, useMemo, useState } from "react"
import {
  DEFAULT_MOTION_VIDEO_RESOLUTION,
  MOTION_VIDEO_RESOLUTIONS,
  MOTION_VIDEO_SEEDANCE_MAX_SEC,
  motionVideoSeedanceDurationSec,
  type MotionVideoResolution,
} from "@/lib/longform-v2/motion-video"
import { loadApiKeys } from "@/lib/longform-v2/api-keys"

type Props = {
  open: boolean
  onClose: () => void
  sceneIndex: number
  sceneText: string
  promptEn?: string
  imageSrc: string
  motionVideoSrc?: string
  ttsDurationSec?: number
  onSaved: (result: { videoUrl: string; durationSec: number; motionPrompt: string }) => void
}

type Phase = "idle" | "prompt" | "render" | "done" | "error"

/**
 * WingsStudio DetailModeAiMotionVideoModal 대응 —
 * Seedance로 이미지→무음 AI 움직임 영상
 */
export function AiMotionVideoModal({
  open,
  onClose,
  sceneIndex,
  sceneText,
  promptEn,
  imageSrc,
  motionVideoSrc,
  ttsDurationSec,
  onSaved,
}: Props) {
  const [resolution, setResolution] = useState<MotionVideoResolution>(DEFAULT_MOTION_VIDEO_RESOLUTION)
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState<Phase>("idle")
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState("")
  const [motionPrompt, setMotionPrompt] = useState("")
  const [durationSec, setDurationSec] = useState<number | null>(null)

  const plannedSeedance = useMemo(
    () => motionVideoSeedanceDurationSec(ttsDurationSec),
    [ttsDurationSec]
  )

  useEffect(() => {
    if (!open) return
    setResolution(DEFAULT_MOTION_VIDEO_RESOLUTION)
    setBusy(false)
    setPhase("idle")
    setError(null)
    setPreviewUrl(motionVideoSrc || "")
    setMotionPrompt("")
    setDurationSec(null)
  }, [open, sceneIndex, motionVideoSrc])

  if (!open) return null

  const phaseLabel =
    phase === "prompt"
      ? "AI가 움직임 프롬프트를 작성하는 중…"
      : phase === "render"
        ? "Seedance로 영상 생성 중… (1~3분)"
        : phase === "done"
          ? "생성 완료"
          : ""

  async function onGenerate() {
    if (!imageSrc.trim()) {
      setError("장면 이미지가 없습니다. 먼저 이미지를 생성하세요.")
      return
    }
    const keys = loadApiKeys()
    if (!keys.replicate) {
      setError("Replicate API 키가 필요합니다. API 설정에서 등록하세요.")
      return
    }
    setBusy(true)
    setError(null)
    setPhase("prompt")
    try {
      setPhase("render")
      const res = await fetch("/api/longform-v2/motion-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: imageSrc,
          sceneText,
          promptEn,
          replicateApiKey: keys.replicate,
          geminiApiKey: keys.gemini,
          ttsDurationSec,
          resolution,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "AI 영상 생성 실패")
      }
      const url = String(data.videoUrl || "")
      if (!url) throw new Error("영상 URL이 없습니다.")
      setPreviewUrl(url)
      setMotionPrompt(String(data.motionPrompt || ""))
      setDurationSec(typeof data.durationSec === "number" ? data.durationSec : plannedSeedance)
      setPhase("done")
      onSaved({
        videoUrl: url,
        durationSec: typeof data.durationSec === "number" ? data.durationSec : plannedSeedance,
        motionPrompt: String(data.motionPrompt || ""),
      })
    } catch (e) {
      setPhase("error")
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function onDownload() {
    const url = previewUrl.trim()
    if (!url) {
      setError("저장할 AI 영상이 없습니다. 먼저 생성하세요.")
      return
    }
    try {
      const a = document.createElement("a")
      a.href = url
      a.download = `scene_${String(sceneIndex + 1).padStart(3, "0")}_motion.mp4`
      a.click()
    } catch (e) {
      setError(e instanceof Error ? e.message : "다운로드 실패")
    }
  }

  return (
    <div
      className="dm-motion-overlay"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div className="dm-motion-modal" role="dialog" aria-modal="true" aria-labelledby="lfv2-motion-title">
        <header className="dm-motion-head">
          <div>
            <h3 id="lfv2-motion-title">AI 영상 생성</h3>
            <p className="dm-muted dm-motion-sub">
              장면 {sceneIndex + 1} · Seedance {plannedSeedance}초 생성 (무음 AI 영상)
              {ttsDurationSec
                ? ` · TTS ${ttsDurationSec.toFixed(1)}초는 「최종영상」에서 합성`
                : " · TTS는 「최종영상」 단계에서 합성"}
            </p>
          </div>
          <button type="button" className="dm-close" aria-label="닫기" disabled={busy} onClick={onClose}>
            ×
          </button>
        </header>

        <div className="dm-motion-body">
          <div className="dm-motion-pane">
            <p className="dm-motion-pane__label">원본 이미지</p>
            {imageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="dm-motion-pane__media" src={imageSrc} alt={`장면 ${sceneIndex + 1}`} />
            ) : (
              <div className="dm-motion-pane__empty">이미지 없음</div>
            )}
          </div>
          <div className="dm-motion-pane">
            <p className="dm-motion-pane__label">생성 영상</p>
            {busy ? (
              <div className="dm-motion-pane__generating" role="status" aria-live="polite">
                <div className="dm-motion-pane__spinner" aria-hidden />
                <strong>{phaseLabel}</strong>
                <span className="dm-muted">
                  Replicate · bytedance/seedance-1-pro-fast · 최대 {MOTION_VIDEO_SEEDANCE_MAX_SEC}초
                </span>
              </div>
            ) : previewUrl ? (
              <video
                className="dm-motion-pane__media"
                src={previewUrl}
                controls
                autoPlay
                playsInline
                preload="metadata"
              />
            ) : (
              <div className="dm-motion-pane__empty">
                「생성 시작」을 누르면 이미지에서 AI 움직임 영상(무음)을 만듭니다. TTS는 「최종영상」에서
                합성하세요.
              </div>
            )}
          </div>
        </div>

        {error ? (
          <div className="dm-motion-error" role="alert">
            {error}
          </div>
        ) : null}

        {motionPrompt && phase === "done" ? (
          <p className="dm-motion-prompt-hint" title={motionPrompt}>
            <span className="dm-motion-prompt-hint__label">AI 프롬프트</span> {motionPrompt}
          </p>
        ) : null}

        <footer className="dm-motion-foot">
          <fieldset className="dm-motion-res" disabled={busy}>
            <legend>해상도</legend>
            {MOTION_VIDEO_RESOLUTIONS.map((r) => (
              <label key={r} className="dm-motion-res__opt">
                <input
                  type="radio"
                  name="lfv2-motion-res"
                  value={r}
                  checked={resolution === r}
                  onChange={() => setResolution(r)}
                />
                {r}
                {r === DEFAULT_MOTION_VIDEO_RESOLUTION ? " (권장)" : ""}
              </label>
            ))}
          </fieldset>
          <div className="dm-motion-foot__actions">
            <button type="button" className="dm-btn dm-btn--ghost" disabled={busy} onClick={onClose}>
              닫기
            </button>
            <button
              type="button"
              className="dm-btn dm-btn--ghost"
              disabled={busy || !previewUrl}
              onClick={() => void onDownload()}
            >
              다운로드
            </button>
            <button
              type="button"
              className="dm-btn dm-btn--primary"
              disabled={busy || !imageSrc}
              onClick={() => void onGenerate()}
            >
              {busy ? "생성 중…" : previewUrl ? "다시 생성" : "생성 시작"}
            </button>
          </div>
        </footer>
        {durationSec != null && phase === "done" ? (
          <p className="dm-muted dm-motion-done-meta">
            저장됨 · {durationSec}초 · {resolution}
          </p>
        ) : null}
      </div>
    </div>
  )
}
