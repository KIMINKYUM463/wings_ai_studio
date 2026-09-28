"use client"

import { useEffect, useState } from "react"
import type { LongformV2Project } from "@/lib/longform-v2/project-storage"
import { IMAGE_MODEL_GROUPS } from "@/lib/longform-v2/image-styles"
import { resolveVoicePersona, defaultVoiceIdForEngine } from "@/lib/longform-v2/voice-personas"
import { SupertonicSetupBar } from "@/app/WingsAIStudioShotForm/components/SupertonicSetupBar"
import { VoicePersonaPicker } from "./VoicePersonaPicker"

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
  /** 설정에서 엔진만 바꿨을 때 해당 엔진 보이스 목록 즉시 로드 */
  onPreviewEngine?: (engine: LongformV2Project["ttsEngine"]) => void
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
  onPreviewEngine,
}: Props) {
  const [draft, setDraft] = useState<Draft>({
    ttsEngine: project.ttsEngine,
    voiceId: project.voiceId,
    ttsLanguage: project.ttsLanguage || "한국어",
    ttsSpeed: project.ttsSpeed ?? 1.05,
    imageModel: project.imageModel,
    imageStyleLabel: project.imageStyleLabel,
  })

  const [voicePickerOpen, setVoicePickerOpen] = useState(false)

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
    setVoicePickerOpen(false)
  }, [open, project])

  if (!open) return null

  const catalogLabel =
    voices.find((v) => v.id === draft.voiceId)?.label || draft.voiceId || ""
  const persona = resolveVoicePersona(draft.voiceId, catalogLabel, draft.ttsEngine)
  const voiceLabel = persona.aliasKo || catalogLabel || "미선택"

  const switchEngine = (id: LongformV2Project["ttsEngine"]) => {
    setDraft((d) => ({
      ...d,
      ttsEngine: id,
      voiceId: defaultVoiceIdForEngine(id),
    }))
    onPreviewEngine?.(id)
  }

  return (
    <div
      className="dm-settings-overlay"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="dm-settings-modal dm-settings-modal--wide"
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
          <h4>현재 작업 설정</h4>
          <div className="lfv2-settings-summary lfv2-settings-summary--in-modal">
            <div className="lfv2-settings-summary__meta">
              <span>
                TTS {ENGINE_LABEL[draft.ttsEngine]} · {voiceLabel} ·{" "}
                {(draft.ttsSpeed ?? 1.05).toFixed(2)}× · {draft.ttsLanguage || "한국어"}
              </span>
              {draft.ttsEngine === "supertonic" && supertonicStatus ? (
                <span>{supertonicStatus}</span>
              ) : null}
            </div>
          </div>
        </section>

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
                  onClick={() => switchEngine(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="v2sw-meta" style={{ marginTop: 6 }}>
              엔진마다 목소리·인물 목록이 다릅니다. 전환하면 해당 엔진 보이스를 다시 불러옵니다.
            </p>
          </label>

          {draft.ttsEngine === "supertonic" ? (
            <div className="lfv2-supertonic-setup" style={{ marginTop: 10, marginBottom: 12 }}>
              <p className="dm-muted dm-settings-hint" style={{ marginBottom: 8 }}>
                Supertonic 로컬 연결 · 설치·재연결은 아래에서 진행합니다.
              </p>
              {supertonicStatus ? <p className="v2sw-meta">{supertonicStatus}</p> : null}
              <SupertonicSetupBar onReady={onSupertonicReady} />
            </div>
          ) : null}

          <div className="dm-field">
            <span>목소리</span>
            <button
              type="button"
              className="lfv2-voice-trigger"
              onClick={() => setVoicePickerOpen(true)}
            >
              <span className="lfv2-voice-trigger__avatar">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={persona.previewSrc} alt="" />
              </span>
              <span className="lfv2-voice-trigger__text">
                <strong>{voiceLabel}</strong>
                <span>{persona.blurbKo}</span>
              </span>
              <span className="lfv2-voice-trigger__chev" aria-hidden>
                ▾
              </span>
            </button>
            <p className="v2sw-meta" style={{ marginTop: 6 }}>
              얼굴·가명은 안내용입니다. 실제 음성은 {ENGINE_LABEL[draft.ttsEngine]} ID(
              {draft.voiceId.length > 14 ? `${draft.voiceId.slice(0, 10)}…` : draft.voiceId})로
              생성됩니다.
            </p>
          </div>

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

      <VoicePersonaPicker
        open={voicePickerOpen}
        onClose={() => setVoicePickerOpen(false)}
        voices={voices}
        selectedId={draft.voiceId}
        engineLabel={ENGINE_LABEL[draft.ttsEngine]}
        ttsEngine={draft.ttsEngine}
        ttsSpeed={draft.ttsSpeed ?? 1.05}
        ttsLanguage={draft.ttsLanguage || "한국어"}
        onSelect={(id) => setDraft((d) => ({ ...d, voiceId: id }))}
      />
    </div>
  )
}
