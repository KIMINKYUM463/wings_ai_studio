"use client"

import { useEffect, useMemo, useState } from "react"
import type { LongformV2Project, SceneAsset } from "@/lib/longform-v2/project-storage"
import {
  IMAGE_MODEL_GROUPS,
  STYLE_CATALOG,
  STYLE_CATEGORIES,
  categoryOfStyle,
  findStyleById,
  sceneStyleSampleUrl,
  styleThumbDataUrl,
  type StyleCategory,
  type StyleItem,
} from "@/lib/longform-v2/image-styles"
import { SupertonicSetupBar } from "@/app/WingsAIStudioShotForm/components/SupertonicSetupBar"
import { WorkSettingsModal } from "./WorkSettingsModal"

type VoiceOption = { id: string; label: string }

type Props = {
  project: LongformV2Project
  voices: VoiceOption[]
  supertonicStatus: string
  batchProgress: string
  onPatch: (partial: Partial<LongformV2Project>) => void
  onBatchGenerate: (limit?: number) => void
  onGenerateOne: (sceneIndex: number, mode: "tts" | "image" | "both" | "video") => void
  onBackToScript: () => void
  /** Supertonic 자동 연결 성공/실패 시 부모에서 상태·보이스 갱신 */
  onSupertonicReady?: (info: { online: boolean; message?: string }) => void
}

const ENGINE_LABEL: Record<LongformV2Project["ttsEngine"], string> = {
  supertonic: "Supertonic 3",
  elevenlabs: "ElevenLabs",
  supertone: "Supertone",
}

function StyleThumb({ category, style }: { category: StyleCategory; style: StyleItem }) {
  const sample = sceneStyleSampleUrl(category, style.id)
  const fallback = styleThumbDataUrl(style.hue, style.label, style.id)
  const [src, setSrc] = useState(sample)

  useEffect(() => {
    setSrc(sample)
  }, [sample])

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="dm-style-thumb"
      src={src}
      alt=""
      onError={() => {
        if (src !== fallback) setSrc(fallback)
      }}
    />
  )
}

export function ProductionPanel({
  project,
  voices,
  supertonicStatus,
  batchProgress,
  onPatch,
  onBatchGenerate,
  onGenerateOne,
  onBackToScript,
  onSupertonicReady,
}: Props) {
  const [category, setCategory] = useState<StyleCategory>(() =>
    categoryOfStyle(project.imageStyleId || "realistic")
  )
  const [workOpen, setWorkOpen] = useState(false)
  const styles = STYLE_CATALOG[category] || []
  const tab = project.productionTab || "style"

  useEffect(() => {
    setCategory(categoryOfStyle(project.imageStyleId || "realistic"))
  }, [project.imageStyleId])

  const counts = useMemo(() => {
    const total = project.scenes.length
    const prompt = project.scenes.filter((s) => !!s.prompt).length
    const image = project.scenes.filter((s) => !!s.imageUrl).length
    const tts = project.scenes.filter((s) => !!s.audioUrl).length
    const video = project.scenes.filter((s) => !!s.videoUrl).length
    return { total, prompt, image, tts, video }
  }, [project.scenes])

  const voiceLabel =
    voices.find((v) => v.id === project.voiceId)?.label || project.voiceId || "미선택"

  const selectStyle = (id: string) => {
    const item = STYLE_CATALOG[category].find((s) => s.id === id) || findStyleById(id)
    if (!item) return
    onPatch({
      imageStyleId: item.id,
      imageStyleLabel: item.label,
      styleHint: item.hint,
    })
  }

  const pct = (n: number, d: number) => (d <= 0 ? 0 : Math.round((n / d) * 100))

  return (
    <div className="dm-style">
      <div className="lfv2-prod-tabs" role="tablist" aria-label="제작 단계">
        <button
          type="button"
          role="tab"
          className={"lfv2-prod-tab" + (tab === "style" ? " lfv2-prod-tab--on" : "")}
          onClick={() => onPatch({ productionTab: "style" })}
        >
          이미지 스타일
        </button>
        <button
          type="button"
          role="tab"
          className={"lfv2-prod-tab" + (tab === "scenes" ? " lfv2-prod-tab--on" : "")}
          onClick={() => onPatch({ productionTab: "scenes" })}
        >
          장면 이미지 생성
        </button>
      </div>

      {tab === "style" && (
        <>
          <h3>이미지 스타일 선택</h3>
          <p className="dm-sub" style={{ margin: "0 0 0.5rem", color: "#8b93a8", fontSize: "0.85rem" }}>
            카테고리를 고른 뒤 썸네일을 선택하세요. WingsStudio와 동일한 샘플 이미지를 사용합니다.
          </p>
          <div className="dm-style__tabs" role="tablist" aria-label="스타일 카테고리">
            {STYLE_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={"dm-style__tab" + (category === c.id ? " dm-style__tab--on" : "")}
                onClick={() => setCategory(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="dm-style__grid">
            {styles.map((s) => {
              const on = project.imageStyleId === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  className={"dm-style__card" + (on ? " dm-style__card--on" : "")}
                  onClick={() => selectStyle(s.id)}
                >
                  <span className="dm-style-thumb-frame">
                    <StyleThumb category={category} style={s} />
                  </span>
                  <span className="dm-style__label">{s.label}</span>
                </button>
              )
            })}
          </div>

          <div className="dm-style__models">
            <p className="dm-style__models-title">이미지 모델</p>
            <p className="dm-style__models-hint">
              WingsStudio와 동일한 목록입니다. 선택값은 프로젝트에 저장됩니다.
            </p>
            <div className="dm-img-models">
              {IMAGE_MODEL_GROUPS.map((group) => (
                <div
                  key={group.id}
                  className={
                    "dm-img-models__group" +
                    (group.id === "featured" ? " dm-img-models__group--featured" : "")
                  }
                >
                  <div className="dm-img-models__group-head">
                    <span className="dm-img-models__group-label">{group.label}</span>
                    <span className="dm-muted dm-img-models__group-hint">{group.hint}</span>
                  </div>
                  <div
                    className={
                      "dm-img-models__grid" +
                      (group.id === "featured" ? " dm-img-models__grid--featured" : "")
                    }
                  >
                    {group.models.map((m) => {
                      const on = project.imageModel === m.id
                      return (
                        <button
                          key={m.id}
                          type="button"
                          className={"dm-img-model-card" + (on ? " dm-img-model-card--on" : "")}
                          onClick={() => onPatch({ imageModel: m.id })}
                          aria-pressed={on}
                        >
                          <div className="dm-img-model-card__head">
                            <strong>{m.label}</strong>
                            {m.badge ? (
                              <span className="dm-img-model-card__badge">{m.badge}</span>
                            ) : null}
                            {on ? (
                              <span className="dm-img-model-card__check" aria-hidden>
                                ✓
                              </span>
                            ) : null}
                          </div>
                          <p className="dm-img-model-card__desc">{m.desc}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="dm-style__foot">
            <button
              type="button"
              className="v2sw-btn v2sw-btn--primary"
              onClick={() => onPatch({ productionTab: "scenes" })}
            >
              장면 생성으로 →
            </button>
            <button type="button" className="v2sw-btn v2sw-btn--secondary" onClick={onBackToScript}>
              ← 대본으로
            </button>
          </div>
        </>
      )}

      {tab === "scenes" && (
        <>
          <div className="lfv2-prod-toolbar">
            <button type="button" className="dm-btn dm-btn--ghost" onClick={() => setWorkOpen(true)}>
              ⚙ 설정
            </button>
            <button
              type="button"
              className="dm-head-action dm-head-action--batch"
              disabled={!!batchProgress || project.scenes.length === 0}
              onClick={() => onBatchGenerate(8)}
            >
              <span className="dm-head-action__icon" aria-hidden>
                ⚡
              </span>
              {batchProgress || "일괄 생성"}
            </button>
            <button type="button" className="dm-head-action" disabled title="이번 범위 밖">
              <span className="dm-head-action__icon" aria-hidden>
                🎞
              </span>
              AI 영상 일괄
            </button>
            <button
              type="button"
              className="dm-head-action"
              disabled={!!batchProgress || project.scenes.length === 0}
              title="앞 장면부터 다시 생성합니다"
              onClick={() => onBatchGenerate(8)}
            >
              <span className="dm-head-action__icon" aria-hidden>
                ↻
              </span>
              재생성
            </button>
            <button type="button" className="dm-head-action" disabled title="이번 범위 밖">
              <span className="dm-head-action__icon" aria-hidden>
                ✂
              </span>
              영상 편집
            </button>
            <button type="button" className="v2sw-btn v2sw-btn--secondary" onClick={onBackToScript}>
              ← 대본으로
            </button>
          </div>
          <p className="lfv2-disabled-hint">
            「일괄 생성」은 음성·이미지·최종영상(이미지+TTS 합성)까지 만듭니다. AI 영상 일괄·영상 편집은
            이번 웹 범위 밖입니다.
          </p>

          <div className="lfv2-settings-summary">
            <div className="lfv2-settings-summary__meta">
              <strong>현재 작업 설정</strong>
              <span>
                TTS {ENGINE_LABEL[project.ttsEngine]} · {voiceLabel} ·{" "}
                {(project.ttsSpeed ?? 1.05).toFixed(2)}× · {project.ttsLanguage || "한국어"}
              </span>
              {project.ttsEngine === "supertonic" && supertonicStatus ? (
                <span>{supertonicStatus}</span>
              ) : null}
            </div>
            <button type="button" className="dm-btn dm-btn--accent" onClick={() => setWorkOpen(true)}>
              TTS 엔진·목소리 설정
            </button>
          </div>

          {project.ttsEngine === "supertonic" ? (
            <div className="lfv2-supertonic-setup" style={{ marginTop: 12, maxWidth: 520 }}>
              <SupertonicSetupBar onReady={onSupertonicReady} />
            </div>
          ) : null}

          <div className="dm-progress-panel">
            <div className="dm-progress-panel__head">
              <h3>전체 진행</h3>
              <span className="dm-progress-panel__summary">
                장면 {counts.total} · 스타일 {project.imageStyleLabel || "미선택"}
              </span>
            </div>
            <ul className="dm-progress-tracks">
              {(
                [
                  ["프롬프트", counts.prompt, "prompt"],
                  ["이미지", counts.image, "image"],
                  ["TTS", counts.tts, "tts"],
                  ["최종영상", counts.video, "video"],
                ] as const
              ).map(([label, n, kind]) => {
                const done = counts.total > 0 && n >= counts.total
                return (
                  <li
                    key={kind}
                    className={
                      "dm-progress-track" + (done ? " dm-progress-track--done" : "")
                    }
                  >
                    <span className="dm-progress-track__label">{label}</span>
                    <div className="dm-progress-track__bar">
                      <span
                        className={`dm-progress-track__fill dm-progress-track__fill--${kind}`}
                        style={{ width: `${pct(n, counts.total)}%` }}
                      />
                    </div>
                    <span className="dm-progress-track__count">
                      {`${n}/${counts.total}`}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="dm-scene-list">
            {project.scenes.length === 0 ? (
              <p className="v2sw-plan-doc__empty">장면이 없습니다. 대본을 먼저 저장하세요.</p>
            ) : (
              project.scenes.map((scene) => (
                <SceneCard key={scene.index} scene={scene} onGenerate={onGenerateOne} />
              ))
            )}
          </div>
        </>
      )}

      <WorkSettingsModal
        open={workOpen}
        onClose={() => setWorkOpen(false)}
        project={project}
        voices={voices}
        supertonicStatus={supertonicStatus}
        onSave={onPatch}
        onSupertonicReady={onSupertonicReady}
      />
    </div>
  )
}

function SceneCard({
  scene,
  onGenerate,
}: {
  scene: SceneAsset
  onGenerate: (sceneIndex: number, mode: "tts" | "image" | "both" | "video") => void
}) {
  const working = !!scene.busy
  return (
    <article className={"dm-scene-card" + (working ? " dm-scene-card--working" : "")}>
      <div className="dm-scene-card__grid">
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span className="lfv2-pill">장면 {scene.index + 1}</span>
            {scene.videoUrl ? (
              <span className="lfv2-pill lfv2-pill--ok">최종영상</span>
            ) : scene.audioUrl && scene.imageUrl ? (
              <span className="lfv2-pill">이미지·TTS 완료</span>
            ) : null}
            {scene.busy && (
              <span className="lfv2-pill">
                <span className="lfv2-spin" /> {scene.busy}
              </span>
            )}
          </div>
          <p className="dm-scene-card__text">{scene.text}</p>
          {scene.error && <p className="dm-scene-card__err">{scene.error}</p>}
          <div className="dm-scene-card__acts">
            <button
              type="button"
              className="v2sw-btn v2sw-btn--secondary"
              style={{ padding: "6px 10px", fontSize: 12 }}
              disabled={working}
              onClick={() => onGenerate(scene.index, "tts")}
            >
              음성만
            </button>
            <button
              type="button"
              className="v2sw-btn v2sw-btn--secondary"
              style={{ padding: "6px 10px", fontSize: 12 }}
              disabled={working}
              onClick={() => onGenerate(scene.index, "image")}
            >
              이미지만
            </button>
            <button
              type="button"
              className="v2sw-btn v2sw-btn--primary"
              style={{ padding: "6px 10px", fontSize: 12 }}
              disabled={working}
              onClick={() => onGenerate(scene.index, "both")}
            >
              음성·이미지·영상
            </button>
            <button
              type="button"
              className="v2sw-btn v2sw-btn--secondary"
              style={{ padding: "6px 10px", fontSize: 12 }}
              disabled={working || !scene.imageUrl || !scene.audioUrl}
              title={!scene.imageUrl || !scene.audioUrl ? "이미지와 음성이 모두 필요합니다" : "이미지+TTS 합성"}
              onClick={() => onGenerate(scene.index, "video")}
            >
              최종영상만
            </button>
          </div>
          {scene.audioUrl && (
            <audio controls src={scene.audioUrl} style={{ width: "100%", marginTop: 10 }} />
          )}
          {scene.videoUrl && (
            <video
              controls
              src={scene.videoUrl}
              style={{ width: "100%", marginTop: 10, borderRadius: 8, background: "#000" }}
            />
          )}
          {scene.prompt && (
            <p className="v2sw-meta" style={{ marginTop: 8 }}>
              프롬프트: {scene.prompt.slice(0, 120)}
              {scene.prompt.length > 120 ? "…" : ""}
            </p>
          )}
        </div>
        <div className="dm-scene-card__media">
          {scene.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={scene.imageUrl} alt={`장면 ${scene.index + 1}`} />
          ) : (
            "이미지 없음"
          )}
        </div>
      </div>
    </article>
  )
}
