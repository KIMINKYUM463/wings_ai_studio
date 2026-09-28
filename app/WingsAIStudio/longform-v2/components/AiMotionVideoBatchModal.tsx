"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { SceneAsset } from "@/lib/longform-v2/project-storage"
import {
  DEFAULT_MOTION_VIDEO_RESOLUTION,
  MOTION_VIDEO_RESOLUTIONS,
  type MotionVideoResolution,
} from "@/lib/longform-v2/motion-video"

type Props = {
  open: boolean
  onClose: () => void
  scenes: SceneAsset[]
  onConfirm: (sceneIndexes: number[], resolution: MotionVideoResolution, overwrite: boolean) => void
}

function canSelect(scene: SceneAsset, overwrite: boolean): boolean {
  if (!scene.imageUrl) return false
  if (scene.motionVideoUrl && !overwrite) return false
  return true
}

export function AiMotionVideoBatchModal({ open, onClose, scenes, onConfirm }: Props) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set())
  const [resolution, setResolution] = useState<MotionVideoResolution>(DEFAULT_MOTION_VIDEO_RESOLUTION)
  const [overwrite, setOverwrite] = useState(false)
  const wasOpen = useRef(false)
  const prevOverwrite = useRef(overwrite)

  const selectable = useMemo(
    () => scenes.filter((s) => canSelect(s, overwrite)).map((s) => s.index),
    [scenes, overwrite]
  )

  useEffect(() => {
    if (open && !wasOpen.current) {
      setSelected(new Set(selectable))
      setResolution(DEFAULT_MOTION_VIDEO_RESOLUTION)
      setOverwrite(false)
      prevOverwrite.current = false
    }
    wasOpen.current = open
  }, [open, selectable])

  useEffect(() => {
    if (!open) return
    if (prevOverwrite.current === overwrite) return
    prevOverwrite.current = overwrite
    setSelected(new Set(scenes.filter((s) => canSelect(s, overwrite)).map((s) => s.index)))
  }, [overwrite, open, scenes])

  if (!open) return null

  const allOn = selectable.length > 0 && selectable.every((i) => selected.has(i))

  return (
    <div
      className="dm-batch-overlay"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="dm-batch-modal dm-motion-batch-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lfv2-motion-batch-title"
      >
        <header className="dm-batch-head">
          <h3 id="lfv2-motion-batch-title">🎞 AI 영상 일괄 생성</h3>
          <button type="button" className="dm-close" aria-label="닫기" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="dm-batch-warn">
          선택한 장면에 대해 <strong>AI 영상 → TTS(없을 때) → 최종영상</strong>을{" "}
          <strong>순차적으로</strong> 만듭니다. 이미 AI 영상이 있는 장면은 기본적으로 선택할 수
          없습니다.
        </div>

        <label className="dm-motion-batch-overwrite" style={{ display: "flex", gap: 8, margin: "0.65rem 0" }}>
          <input
            type="checkbox"
            checked={overwrite}
            onChange={(e) => setOverwrite(e.target.checked)}
          />
          이미 AI 영상이 있는 장면도 다시 생성 (덮어쓰기)
        </label>

        <fieldset className="dm-motion-res dm-motion-batch-res">
          <legend>해상도</legend>
          {MOTION_VIDEO_RESOLUTIONS.map((r) => (
            <label key={r} className="dm-motion-res__opt">
              <input
                type="radio"
                name="lfv2-motion-batch-res"
                value={r}
                checked={resolution === r}
                onChange={() => setResolution(r)}
              />
              {r}
              {r === DEFAULT_MOTION_VIDEO_RESOLUTION ? " (권장)" : ""}
            </label>
          ))}
        </fieldset>

        <button
          type="button"
          className="dm-batch-deselect"
          onClick={() => setSelected(allOn ? new Set() : new Set(selectable))}
        >
          {allOn ? "☑ 전체 해제" : "☐ 선택 가능 장면 전체 선택"}
        </button>

        <ul className="dm-batch-list dm-motion-batch-scenes" style={{ maxHeight: "40vh", overflow: "auto" }}>
          {scenes.map((scene) => {
            const ok = canSelect(scene, overwrite)
            const on = selected.has(scene.index)
            const meta = !scene.imageUrl
              ? "이미지 없음"
              : scene.motionVideoUrl
                ? overwrite
                  ? "AI 영상 있음 (덮어쓰기)"
                  : "AI 영상 있음 — 선택 불가"
                : "생성 가능"
            return (
              <li key={scene.index}>
                <label
                  className={
                    "dm-batch-item" +
                    (on && ok ? " dm-batch-item--on" : "") +
                    (!ok ? " dm-motion-batch-item--disabled" : "")
                  }
                  style={!ok ? { opacity: 0.55 } : undefined}
                >
                  <input
                    type="checkbox"
                    disabled={!ok}
                    checked={on && ok}
                    onChange={() => {
                      if (!ok) return
                      setSelected((prev) => {
                        const next = new Set(prev)
                        if (next.has(scene.index)) next.delete(scene.index)
                        else next.add(scene.index)
                        return next
                      })
                    }}
                  />
                  <span className="dm-batch-item__label">장면 {scene.index + 1}</span>
                  <span className="dm-batch-item__count">{meta}</span>
                </label>
              </li>
            )
          })}
        </ul>

        <footer className="dm-batch-foot">
          <button type="button" className="dm-btn dm-btn--ghost" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="dm-btn dm-btn--accent"
            disabled={selected.size === 0}
            onClick={() =>
              onConfirm(
                [...selected].filter((i) => {
                  const s = scenes.find((x) => x.index === i)
                  return s ? canSelect(s, overwrite) : false
                }).sort((a, b) => a - b),
                resolution,
                overwrite
              )
            }
          >
            {selected.size}개 장면 AI영상→최종영상
          </button>
        </footer>
      </div>
    </div>
  )
}
