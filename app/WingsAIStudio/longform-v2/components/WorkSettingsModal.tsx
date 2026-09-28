"use client"

import { useEffect, useState } from "react"
import type { LongformV2Project } from "@/lib/longform-v2/project-storage"
import { IMAGE_MODEL_GROUPS } from "@/lib/longform-v2/image-styles"
import { SupertonicSetupBar } from "@/app/WingsAIStudioShotForm/components/SupertonicSetupBar"

type VoiceOption = { id: string; label: string }

type Draft = Pick<
  LongformV2Project,
  "ttsEngine" | "voiceId" | "ttsLanguage" | "ttsSpeed" | "imageModel" | "imageStyleLabel"
>

type Props = {
  open: boolean
  onClose: () => void
  project: LongformV2Project
  voices: VoiceOption[]
  supertonicStatus: string
  onSave: (partial: Partial<LongformV2Project>) => void
  onSupertonicReady?: (info: { online: boolean; message?: string }) => void
}

const ENGINE_LABEL: Record<LongformV2Project["ttsEngine"], string> = {
  supertonic: "Supertonic 3",
  elevenlabs: "ElevenLabs",
  supertone: "Supertone",
}

function modelLabel(id: string): string {
  for (const g of IMAGE_MODEL_GROUPS) {
    const hit = g.models.find((m) => m.id === id)
    if (hit) return hit.label
  }
  return id
}

export function WorkSettingsModal({
  open,
  onClose,
  project,
  voices,
  supertonicStatus,
  onSave,
  onSupertonicReady,
}: Props) {
  const [draft, setDraft] = useState<Draft>({
    ttsEngine: project.ttsEngine,
    voiceId: project.voiceId,
    ttsLanguage: project.ttsLanguage || "한국어",
    ttsSpeed: project.ttsSpeed ?? 1.05,
    imageModel: project.imageModel,
    imageStyleLabel: project.imageStyleLabel,
  })

  useEffect(() => {
    if (!open) return
    setDraft({
      ttsEngine: project.ttsEngine,
      voiceId: project.voiceId,
      ttsLanguage: project.ttsLanguage || "한국어",
      ttsSpeed: project.ttsSpeed ?? 1.05,
      imageModel: project.imageModel,
      imageStyleLabel: project.imageStyleLabel,
    })
  }, [open, project])

  if (!open) return null

  const voiceLabel =
    voices.find((v) => v.id === draft.voiceId)?.label || draft.voiceId || "미선택"

  return (
    <div
      className="dm-settings-overlay"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="dm-settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lfv2-settings-title"
      >
        <header className="dm-settings-head">
          <h3 id="lfv2-settings-title">⚙ 설정</h3>
          <button type="button" className="dm-close" aria-label="닫기" onClick={onClose}>
            ×
          </button>
        </header>

        <section className="dm-settings-section">
          <h4>🖼 이미지 (요약)</h4>
          <p className="dm-muted dm-settings-hint">
            이미지 모델·스타일은 「이미지 스타일」 탭에서 고릅니다. WingsStudio v2와 같습니다.
          </p>
          <p className="v2sw-meta" style={{ margin: 0 }}>
            스타일: <strong>{draft.imageStyleLabel || "미선택"}</strong>
            <br />
            모델: <strong>{modelLabel(draft.imageModel)}</strong> ({draft.imageModel})
          </p>
        </section>

        <section className="dm-settings-section">
          <h4>🔊 TTS 설정</h4>
          <p className="dm-muted dm-settings-hint">
            「AI 음성·이미지 생성」과 동일한 엔진·목소리입니다. Supertonic 3(로컬), ElevenLabs,
            Supertone을 고를 수 있습니다.
          </p>

          <label className="dm-field">
            <span>언어 선택</span>
            <select
              value={draft.ttsLanguage}
              onChange={(e) => setDraft((d) => ({ ...d, ttsLanguage: e.target.value }))}
            >
              <option value="한국어">한국어</option>
              <option value="English">English</option>
              <option value="日本語">日本語</option>
            </select>
          </label>

          <label className="dm-field">
            <span>TTS 엔진</span>
            <div className="v2sw-preset-row">
              {(
                [
                  ["supertonic", "Supertonic 3"],
                  ["elevenlabs", "ElevenLabs"],
                  ["supertone", "Supertone"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={
                    "v2sw-preset" + (draft.ttsEngine === id ? " v2sw-preset--on" : "")
                  }
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      ttsEngine: id,
                      voiceId:
                        id === "supertonic"
                          ? "F1"
                          : id === "elevenlabs"
                            ? "jB1Cifc2UQbq1gR3wnb0"
                            : d.voiceId,
                    }))
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </label>

          {draft.ttsEngine === "supertonic" ? (
            <div style={{ marginTop: 10 }}>
              {supertonicStatus ? <p className="v2sw-meta">{supertonicStatus}</p> : null}
              <SupertonicSetupBar onReady={onSupertonicReady} />
            </div>
          ) : null}

          <label className="dm-field">
            <span>목소리</span>
            <select
              value={draft.voiceId}
              onChange={(e) => setDraft((d) => ({ ...d, voiceId: e.target.value }))}
            >
              {voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>

          <label className="dm-field">
            <span>속도 {draft.ttsSpeed.toFixed(2)}×</span>
            <input
              type="range"
              min={0.75}
              max={1.25}
              step={0.05}
              value={draft.ttsSpeed}
              onChange={(e) =>
                setDraft((d) => ({ ...d, ttsSpeed: Number(e.target.value) || 1 }))
              }
            />
          </label>

          <div className="dm-tts-pick-card" style={{ marginTop: 8 }}>
            <div className="dm-tts-pick-card__meta">
              <strong>{ENGINE_LABEL[draft.ttsEngine]}</strong>
              <span className="dm-muted">{voiceLabel}</span>
              <span className="dm-muted">
                {draft.ttsLanguage} · 속도 {draft.ttsSpeed.toFixed(2)}×
              </span>
            </div>
          </div>
        </section>

        <footer className="dm-settings-foot">
          <button type="button" className="dm-btn dm-btn--ghost" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="dm-btn dm-btn--accent"
            disabled={!draft.voiceId.trim()}
            onClick={() => {
              onSave({
                ttsEngine: draft.ttsEngine,
                voiceId: draft.voiceId,
                ttsLanguage: draft.ttsLanguage,
                ttsSpeed: draft.ttsSpeed,
              })
              onClose()
            }}
          >
            저장
          </button>
        </footer>
      </div>
    </div>
  )
}
