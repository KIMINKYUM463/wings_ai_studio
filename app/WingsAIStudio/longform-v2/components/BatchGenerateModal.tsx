"use client"

import { useEffect, useMemo, useState } from "react"
import type { LongformV2Project, SceneAsset } from "@/lib/longform-v2/project-storage"
import {
  assignSceneBgKinds,
  BATCH_VIDEO_BG_MODE_LABELS,
  DEFAULT_BATCH_TASKS,
  type BatchGeneratePlan,
  type BatchTasks,
  type BatchVideoBgMode,
} from "@/lib/longform-v2/batch-generate"
import { personaLabelForVoice } from "@/lib/longform-v2/voice-personas"

type Props = {
  open: boolean
  onClose: () => void
  project: LongformV2Project
  onConfirm: (plan: BatchGeneratePlan) => void
  /** resume=일괄 생성, overwrite=재생성(덮어쓰기 안내) */
  mode?: "resume" | "overwrite"
}

const ENGINE_SHORT: Record<LongformV2Project["ttsEngine"], string> = {
  supertonic: "Supertonic 3",
  elevenlabs: "ElevenLabs",
  supertone: "Supertone",
}

function sceneStatusLine(s: SceneAsset): string {
  const parts: string[] = []
  if (!s.prompt) parts.push("프롬프트")
  if (!s.imageUrl) parts.push("이미지")
  if (!s.audioUrl) parts.push("TTS")
  if (!s.videoUrl) parts.push("영상")
  if (parts.length === 0) return "모두 완료"
  if (parts.length === 4) return "미완료"
  return `${parts.join("·")} 대기`
}

/**
 * 일괄 생성 확인 모달 — WingsStudio DetailModeBatchModal 과 동일 UX
 * (작업 / 장면 / AI·실사 배경 비율)
 */
export function BatchGenerateModal({
  open,
  onClose,
  project,
  onConfirm,
  mode = "resume",
}: Props) {
  const [tasks, setTasks] = useState<BatchTasks>({ ...DEFAULT_BATCH_TASKS })
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [videoBgMode, setVideoBgMode] = useState<BatchVideoBgMode>("ai")
  const [aiRatioPercent, setAiRatioPercent] = useState(50)

  useEffect(() => {
    if (!open) return
    setTasks({ ...DEFAULT_BATCH_TASKS })
    setSelected(new Set(project.scenes.map((s) => s.index)))
    setVideoBgMode("ai")
    setAiRatioPercent(50)
  }, [open, project.scenes])

  const selectedIndexes = useMemo(
    () => project.scenes.map((s) => s.index).filter((i) => selected.has(i)),
    [project.scenes, selected]
  )

  const counts = useMemo(() => {
    const n = selectedIndexes.length
    return {
      prompt: tasks.prompt ? n : 0,
      image: tasks.image ? n : 0,
      tts: tasks.tts ? n : 0,
      video: tasks.video ? n : 0,
    }
  }, [selectedIndexes.length, tasks])

  const bgKinds = useMemo(
    () => assignSceneBgKinds(selectedIndexes, videoBgMode, aiRatioPercent),
    [selectedIndexes, videoBgMode, aiRatioPercent]
  )
  const stockCount = useMemo(
    () => selectedIndexes.filter((i) => bgKinds.get(i) === "stock").length,
    [selectedIndexes, bgKinds]
  )

  const voiceLabel = personaLabelForVoice(project.voiceId, project.voiceId)
  const anyTask = tasks.prompt || tasks.image || tasks.tts || tasks.video
  const canRun = selectedIndexes.length > 0 && anyTask
  const showBgRatio = tasks.image
  const allTasksOn = tasks.prompt && tasks.image && tasks.tts && tasks.video
  const allScenesSelected =
    project.scenes.length > 0 && project.scenes.every((s) => selected.has(s.index))

  if (!open) return null

  const toggleScene = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const toggleTask = (key: keyof BatchTasks) => {
    setTasks((t) => ({ ...t, [key]: !t[key] }))
  }

  return (
    <div
      className="dm-batch-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="dm-batch-modal dm-batch-modal--split"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lfv2-batch-title"
      >
        <header className="dm-batch-head">
          <h3 id="lfv2-batch-title">{mode === "overwrite" ? "↻ 일괄 재생성" : "⚡ 일괄 생성"}</h3>
          <button type="button" className="dm-close" aria-label="닫기" onClick={onClose}>
            ×
          </button>
        </header>

        {mode === "overwrite" ? (
          <p className="dm-batch-warn dm-batch-warn--overwrite">
            선택한 작업을 <strong>선택한 장면에 다시 실행</strong>합니다. 이미 있는 결과도 새 결과로{" "}
            <strong>덮어씁니다</strong>.
          </p>
        ) : (
          <p className="dm-batch-warn">
            생성할 <strong>작업</strong>과 <strong>장면</strong>을 선택하세요. 이미지(영상)·TTS는 장면
            순서대로 진행되며, <strong>둘 다 완료된 장면부터</strong> 최종영상이 만들어집니다.
          </p>
        )}

        <div className="dm-batch-split">
          <div className="dm-batch-split__col dm-batch-split__tasks">
            <p className="dm-batch-section-label">작업 선택</p>
            <button
              type="button"
              className="dm-batch-deselect"
              onClick={() =>
                setTasks(
                  allTasksOn
                    ? { prompt: false, image: false, tts: false, video: false }
                    : { ...DEFAULT_BATCH_TASKS }
                )
              }
            >
              {allTasksOn ? "☑ 작업 전체 해제" : "☐ 작업 전체 선택"}
            </button>
            <ul className="dm-batch-list">
              <li>
                <label className={"dm-batch-item" + (tasks.prompt ? " dm-batch-item--on" : "")}>
                  <input
                    type="checkbox"
                    checked={tasks.prompt}
                    onChange={() => toggleTask("prompt")}
                  />
                  <span className="dm-batch-item__icon" aria-hidden>
                    ✏
                  </span>
                  <span className="dm-batch-item__label">프롬프트 생성</span>
                  <span className="dm-batch-item__count">{counts.prompt}장면</span>
                </label>
              </li>
              <li>
                <label className={"dm-batch-item" + (tasks.image ? " dm-batch-item--on" : "")}>
                  <input type="checkbox" checked={tasks.image} onChange={() => toggleTask("image")} />
                  <span className="dm-batch-item__icon" aria-hidden>
                    🖼
                  </span>
                  <span className="dm-batch-item__label">이미지(영상)</span>
                  <span className="dm-batch-item__count">{counts.image}장면</span>
                </label>
                {tasks.image ? (
                  <p className="dm-batch-hint">AI 이미지 · Pexels 스톡 · 업로드</p>
                ) : null}
              </li>
              <li>
                <label className={"dm-batch-item" + (tasks.tts ? " dm-batch-item--on" : "")}>
                  <input type="checkbox" checked={tasks.tts} onChange={() => toggleTask("tts")} />
                  <span className="dm-batch-item__icon" aria-hidden>
                    🎙
                  </span>
                  <span className="dm-batch-item__label">TTS 생성</span>
                  <span className="dm-batch-item__count">{counts.tts}장면</span>
                </label>
                {tasks.tts ? (
                  <p className="dm-batch-hint">
                    음성: {voiceLabel} · {ENGINE_SHORT[project.ttsEngine]}
                  </p>
                ) : null}
              </li>
              <li>
                <label className={"dm-batch-item" + (tasks.video ? " dm-batch-item--on" : "")}>
                  <input type="checkbox" checked={tasks.video} onChange={() => toggleTask("video")} />
                  <span className="dm-batch-item__icon" aria-hidden>
                    ▶
                  </span>
                  <span className="dm-batch-item__label">최종영상</span>
                  <span className="dm-batch-item__count">{counts.video}장면</span>
                </label>
                {tasks.video ? (
                  <p className="dm-batch-hint">
                    AI 영상(또는 이미지) 소스와 TTS 길이에 맞춰 최종 mp4 생성 (Ken Burns · 스톡)
                  </p>
                ) : null}
              </li>
            </ul>

            {showBgRatio ? (
              <div className="dm-batch-video-bg-inline">
                <p className="dm-batch-section-label" style={{ marginTop: 0 }}>
                  장면 배경 (AI · 실사)
                </p>
                <div className="dm-video-bg-mode dm-video-bg-mode--inline">
                  {(Object.keys(BATCH_VIDEO_BG_MODE_LABELS) as BatchVideoBgMode[]).map((id) => (
                    <label key={id} className="dm-video-bg-mode__opt">
                      <input
                        type="radio"
                        name="lfv2-video-bg"
                        checked={videoBgMode === id}
                        onChange={() => setVideoBgMode(id)}
                      />
                      <span>{BATCH_VIDEO_BG_MODE_LABELS[id]}</span>
                    </label>
                  ))}
                </div>

                {videoBgMode === "mix" ? (
                  <div className="dm-video-bg-ratio dm-video-bg-ratio--inline">
                    <span>AI {aiRatioPercent}%</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={aiRatioPercent}
                      onChange={(e) => setAiRatioPercent(Number(e.target.value))}
                      aria-label="AI 이미지 비율"
                    />
                    <span>실사 {100 - aiRatioPercent}%</span>
                  </div>
                ) : null}

                <p className="dm-batch-bg-note">
                  실사 장면은 Pexels에서 <strong>스톡 영상(mp4)</strong>을 가져와 TTS와 합성합니다. TTS
                  생성이 함께 필요하며, 비율은 선택한 {selectedIndexes.length}개 장면에 고르게 배분됩니다
                  {videoBgMode === "mix"
                    ? ` (실사 ${stockCount} · AI ${selectedIndexes.length - stockCount})`
                    : ""}
                  .
                </p>
              </div>
            ) : null}
          </div>

          <div className="dm-batch-split__col dm-batch-split__scenes">
            <p className="dm-batch-section-label">장면 선택</p>
            <button
              type="button"
              className="dm-batch-deselect"
              onClick={() =>
                setSelected(
                  allScenesSelected ? new Set() : new Set(project.scenes.map((s) => s.index))
                )
              }
            >
              {allScenesSelected ? "☑ 장면 전체 해제" : "☐ 장면 전체 선택"}
            </button>
            <ul className="dm-batch-list dm-batch-split__scene-list">
              {project.scenes.map((s) => {
                const on = selected.has(s.index)
                const kind = showBgRatio ? bgKinds.get(s.index) : undefined
                return (
                  <li key={s.index}>
                    <label className={"dm-batch-item" + (on ? " dm-batch-item--on" : "")}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleScene(s.index)}
                      />
                      <span className="dm-batch-item__label">
                        장면 {s.index + 1}
                        {on && kind === "stock" ? " · 실사" : on && kind === "ai" ? " · AI" : ""}
                      </span>
                      <span className="dm-batch-item__count">{sceneStatusLine(s)}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        <p className="dm-batch-note">
          {showBgRatio
            ? "실사 장면은 생성 전 스톡 검색어를 입력합니다. Pexels API 키는 설정에서 등록하세요."
            : "⚙ TTS·이미지 모델 변경은 「설정」에서 가능합니다."}
        </p>

        <footer className="dm-batch-foot">
          <button type="button" className="dm-btn dm-btn--ghost" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="dm-btn dm-btn--accent"
            disabled={!canRun}
            onClick={() => {
              onConfirm({
                sceneIndexes: selectedIndexes,
                tasks,
                videoBgMode: showBgRatio ? videoBgMode : "ai",
                aiRatioPercent,
                stockKeywords: {},
              })
            }}
          >
            {selectedIndexes.length}개 장면 {mode === "overwrite" ? "재생성" : "생성"}
          </button>
        </footer>
      </div>
    </div>
  )
}
