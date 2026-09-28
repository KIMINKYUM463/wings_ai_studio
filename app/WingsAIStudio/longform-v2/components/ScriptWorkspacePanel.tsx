"use client"

import { useEffect, useMemo, useState } from "react"
import {
  approxVideoMinutesFromChars,
  clampV2TargetChars,
  enforceV2ScriptLineFormat,
  formatApproxTargetMinutes,
  splitScriptIntoSceneLines,
  V2_TARGET_CHARS_SLIDER_MAX,
  V2_TARGET_CHARS_SLIDER_MIN,
  V2_TARGET_CHARS_SLIDER_STEP,
} from "@/lib/longform-v2/script-utils"
import type { LongformV2Project, MethodId, ScriptSubStep } from "@/lib/longform-v2/project-storage"
import { PlanDocumentView } from "./PlanDocumentView"
import { ScriptLineEditor } from "./ScriptLineEditor"

type Props = {
  project: LongformV2Project
  busy: string | null
  onPatch: (partial: Partial<LongformV2Project>) => void
  onPersist: () => void
  onAnalyzeAndPlan: () => void
  onGenerateScript: () => void
  onApplyExternalScript: () => void
  onFormatFixed: () => void
  onGoVoiceImage: () => void
}

const METHODS: { id: MethodId; tag: string; title: string; desc: string }[] = [
  {
    id: "benchmark",
    tag: "방법 1",
    title: "벤치마킹 대본 → AI 기획·생성",
    desc: "레퍼런스처럼 분석 후 기획·대본·검증까지",
  },
  {
    id: "upload",
    tag: "방법 2",
    title: "외부 대본 업로드",
    desc: "다른 프로그램에서 만든 대본만 가져오기",
  },
]

function analysisCore(analysis: Record<string, unknown> | null): string {
  if (!analysis) return ""
  const core =
    (analysis.core as string) ||
    (analysis.topic as string) ||
    (analysis.theme as string) ||
    (analysis.summary as string) ||
    ""
  return String(core || "").trim()
}

export function ScriptWorkspacePanel({
  project,
  busy,
  onPatch,
  onPersist,
  onAnalyzeAndPlan,
  onGenerateScript,
  onApplyExternalScript,
  onFormatFixed,
  onGoVoiceImage,
}: Props) {
  const [planEditMode, setPlanEditMode] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteDraft, setPasteDraft] = useState("")

  useEffect(() => {
    if (project.method === "upload" && !project.benchmarkText.trim()) {
      setPasteOpen(true)
    }
    // 최초 진입 시 한 번만 — 이후엔 방법 카드 / 버튼으로 연다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const livePreview = useMemo(() => {
    if (project.scriptSub === "script" && project.scriptText.trim()) return project.scriptText
    if (project.scriptSub === "plan" && project.planMarkdown.trim()) return project.planMarkdown
    return project.benchmarkText
  }, [project.scriptSub, project.scriptText, project.planMarkdown, project.benchmarkText])

  const previewStats = useMemo(() => {
    const t = livePreview.trim()
    return { chars: t.length, lines: t ? t.split("\n").length : 0 }
  }, [livePreview])

  const topic = analysisCore(project.analysis)
  const canOpenPlan = !!project.planMarkdown.trim() || !!project.analysis
  const canOpenScript = !!project.scriptText.trim()
  const scriptLineCount = splitScriptIntoSceneLines(project.scriptText).length
  const targetMinutes = approxVideoMinutesFromChars(project.targetChars)
  const sliderChars = clampV2TargetChars(
    Math.min(V2_TARGET_CHARS_SLIDER_MAX, Math.max(V2_TARGET_CHARS_SLIDER_MIN, project.targetChars))
  )

  const setSub = (sid: ScriptSubStep) => {
    if (sid === "plan" && !canOpenPlan && !project.planMarkdown.trim()) return
    if (sid === "script" && !canOpenScript) return
    onPatch({ scriptSub: sid })
  }

  const openPasteNotepad = (prefill = "") => {
    setPasteDraft(prefill)
    setPasteOpen(true)
  }

  const commitPasteUpload = () => {
    const raw = pasteDraft.replace(/\r\n/g, "\n").trim()
    if (!raw) return
    const formatted = enforceV2ScriptLineFormat(raw)
    onPatch({
      method: "upload",
      benchmarkText: formatted,
      scriptText: formatted,
      scriptSub: "input",
    })
    onFormatFixed()
    setPasteOpen(false)
    setPasteDraft("")
  }

  const clearAllScript = (scope: "upload" | "generated") => {
    const label = scope === "upload" ? "업로드된 대본" : "생성된 대본"
    if (!confirm(`${label}을 전부 삭제할까요?`)) return
    if (scope === "upload") {
      onPatch({ benchmarkText: "", scriptText: "", scenes: [] })
      openPasteNotepad("")
    } else {
      onPatch({ scriptText: "", scenes: [] })
    }
  }

  return (
    <div className="v2sw-root">
      <div className="v2sw-method-grid" role="tablist" aria-label="대본 입력 방법">
        {METHODS.map((m) => {
          const on = project.method === m.id
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={on}
              className={"v2sw-method-card" + (on ? " v2sw-method-card--on" : "")}
              onClick={() => {
                onPatch({ method: m.id, scriptSub: "input" })
                if (m.id === "upload" && !project.benchmarkText.trim()) {
                  openPasteNotepad("")
                }
              }}
            >
              <span className="v2sw-method-card__tag">{m.tag}</span>
              <span className="v2sw-method-card__title">{m.title}</span>
              <span className="v2sw-method-card__desc">{m.desc}</span>
            </button>
          )
        })}
      </div>

      <aside className="v2sw-preview-strip" aria-live="polite">
        <span>작업 중 대본</span>
        <strong>
          {previewStats.chars > 0
            ? `${previewStats.chars.toLocaleString()}자 · ${previewStats.lines}줄`
            : project.scriptText.trim()
              ? `저장됨 ${project.scriptText.trim().length.toLocaleString()}자`
              : "없음"}
        </strong>
      </aside>

      {project.method === "benchmark" ? (
        <div className="v2sw-bench">
          <nav className="v2sw-steps" aria-label="벤치마킹 대본 단계">
            {(
              [
                ["input", "1. 벤치마킹 대본"],
                ["plan", "2. 기획·검증"],
                ["script", "3. 대본·검증"],
              ] as [ScriptSubStep, string][]
            ).map(([sid, label]) => {
              const disabled =
                (sid === "plan" && !canOpenPlan && project.scriptSub !== "plan") ||
                (sid === "script" && !canOpenScript && project.scriptSub !== "script")
              return (
                <button
                  key={sid}
                  type="button"
                  className={
                    "v2sw-steps__item" +
                    (project.scriptSub === sid ? " v2sw-steps__item--on" : "") +
                    (disabled ? " v2sw-steps__item--disabled" : "")
                  }
                  disabled={disabled}
                  onClick={() => setSub(sid)}
                >
                  {label}
                </button>
              )
            })}
          </nav>

          {project.scriptSub === "input" && (
            <section className="v2sw-card">
              <h3 className="v2sw-card__title">벤치마킹 영상 대본 붙여넣기</h3>
              <p className="v2sw-card__desc">
                레퍼런스 대본만 붙여 넣으면 됩니다. Gemini가 주제·패턴을 분석해 기획안을 만듭니다.
                목표 분량은 다음 단계(기획·검증)에서 정합니다.
              </p>
              <label className="v2sw-label">
                벤치마킹 대본
                <textarea
                  className="v2sw-textarea v2sw-textarea--tall"
                  value={project.benchmarkText}
                  onChange={(e) => onPatch({ benchmarkText: e.target.value })}
                  placeholder="YouTube 자막·대본 전문을 붙여 넣으세요…"
                  spellCheck={false}
                />
              </label>
              <p className="v2sw-meta">{project.benchmarkText.trim().length.toLocaleString()}자</p>
              <div className="v2sw-actions">
                <button
                  type="button"
                  className="v2sw-btn v2sw-btn--secondary"
                  disabled={!!busy || !project.benchmarkText.trim()}
                  onClick={onPersist}
                >
                  작업 저장
                </button>
                <button
                  type="button"
                  className="v2sw-btn v2sw-btn--primary"
                  disabled={!!busy}
                  onClick={onAnalyzeAndPlan}
                >
                  {busy ? "기획 생성 중…" : "기획 생성 · 검증"}
                </button>
              </div>
            </section>
          )}

          {project.scriptSub === "plan" && (
            <section className="v2sw-card v2sw-card--plan">
              <div className="v2sw-plan__head">
                <div className="v2sw-plan__head-text">
                  <h3 className="v2sw-card__title">기획안</h3>
                  {topic ? (
                    <p className="v2sw-plan__topic">
                      <span className="v2sw-plan__topic-label">벤치마킹 주제</span>
                      <span className="v2sw-plan__topic-value">{topic}</span>
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className={"v2sw-plan__mode-btn" + (planEditMode ? " v2sw-plan__mode-btn--on" : "")}
                  onClick={() => setPlanEditMode((v) => !v)}
                >
                  {planEditMode ? "미리보기" : "편집"}
                </button>
              </div>

              <div className={"v2sw-plan__body" + (planEditMode ? " v2sw-plan__body--edit" : "")}>
                {planEditMode ? (
                  <textarea
                    className="v2sw-textarea v2sw-textarea--plan-edit"
                    value={project.planMarkdown}
                    onChange={(e) => onPatch({ planMarkdown: e.target.value })}
                    spellCheck={false}
                    aria-label="기획안 편집"
                  />
                ) : (
                  <PlanDocumentView markdown={project.planMarkdown} />
                )}
              </div>

              <div className="v2sw-target-slider">
                <div className="v2sw-target-slider__head">
                  <span className="v2sw-label" style={{ margin: 0 }}>
                    목표 분량 (새 대본 생성 시)
                  </span>
                  <strong className="v2sw-target-slider__value">
                    약 {formatApproxTargetMinutes(targetMinutes)} · 약{" "}
                    {sliderChars.toLocaleString()}자
                  </strong>
                </div>
                <input
                  type="range"
                  className="v2sw-target-slider__range"
                  min={V2_TARGET_CHARS_SLIDER_MIN}
                  max={V2_TARGET_CHARS_SLIDER_MAX}
                  step={V2_TARGET_CHARS_SLIDER_STEP}
                  value={sliderChars}
                  onChange={(e) => {
                    onPatch({
                      targetChars: clampV2TargetChars(Number(e.target.value) || V2_TARGET_CHARS_SLIDER_MIN),
                    })
                  }}
                  aria-label="목표 글자 수·영상 길이"
                />
                <div className="v2sw-target-slider__ticks">
                  <span>1,000자</span>
                  <span>약 15분</span>
                  <span>약 30분</span>
                  <span>1시간</span>
                </div>
                <p className="v2sw-meta" style={{ marginTop: 6 }}>
                  최소 1,000자부터 · 분당 약 400자 기준으로 길이를 대략 맞춥니다.
                </p>
              </div>

              <div className="v2sw-fact-empty">
                <strong>FACT CHECK</strong> — 출처·검증 자료가 있으면 여기에 표시됩니다. (이번 웹 범위에서는
                빈 상태)
              </div>

              <div className="v2sw-actions">
                <button
                  type="button"
                  className="v2sw-btn v2sw-btn--secondary"
                  disabled={!!busy}
                  onClick={onPersist}
                >
                  작업 저장
                </button>
                <button
                  type="button"
                  className="v2sw-btn v2sw-btn--secondary"
                  disabled={!!busy}
                  onClick={onAnalyzeAndPlan}
                  title="기획안을 다시 생성합니다"
                >
                  기획 재생성
                </button>
                <button
                  type="button"
                  className="v2sw-btn v2sw-btn--primary"
                  disabled={!!busy || !project.planMarkdown.trim()}
                  onClick={onGenerateScript}
                >
                  {busy
                    ? "대본 생성 중…"
                    : `대본 생성 (약 ${formatApproxTargetMinutes(targetMinutes)} · ${sliderChars.toLocaleString()}자)`}
                </button>
              </div>
            </section>
          )}

          {project.scriptSub === "script" && (
            <section className="v2sw-card v2sw-card--script">
              <h3 className="v2sw-card__title">생성된 대본</h3>
              <p className="v2sw-card__desc">
                줄마다 번호가 붙습니다. 줄 중간에서 Enter를 누르면 그 위치에서 나뉘어 다음 줄로
                이동합니다.
              </p>
              <ScriptLineEditor
                value={project.scriptText}
                onChange={(t) => onPatch({ scriptText: t })}
              />
              <p className="v2sw-meta">
                {project.scriptText.length.toLocaleString()}자 · {scriptLineCount}줄
              </p>
              <div className="v2sw-actions">
                <button
                  type="button"
                  className="v2sw-btn v2sw-btn--secondary"
                  disabled={!!busy || !project.scriptText.trim()}
                  onClick={() => {
                    onPatch({ scriptText: enforceV2ScriptLineFormat(project.scriptText) })
                    onFormatFixed()
                  }}
                >
                  줄 길이·도입부·본문 형식 자동 맞춤
                </button>
                <button
                  type="button"
                  className="v2sw-btn v2sw-btn--danger"
                  disabled={!!busy || !project.scriptText.trim()}
                  onClick={() => clearAllScript("generated")}
                >
                  대본 전체 삭제
                </button>
                <button
                  type="button"
                  className="v2sw-btn v2sw-btn--secondary"
                  disabled
                  title="이번 범위 밖 — WingsStudio 데스크톱의 AI 품질 검증"
                >
                  AI 품질 검증
                </button>
                <button
                  type="button"
                  className="v2sw-btn v2sw-btn--primary"
                  disabled={!!busy || !project.scriptText.trim()}
                  onClick={onPersist}
                >
                  프로젝트에 저장
                </button>
                <button
                  type="button"
                  className="v2sw-btn v2sw-btn--secondary"
                  disabled={!project.scriptText.trim()}
                  onClick={onGoVoiceImage}
                >
                  음성·이미지 단계로 →
                </button>
              </div>
              <p className="lfv2-disabled-hint">AI 품질 검증은 이번 웹 범위 밖입니다.</p>
            </section>
          )}
        </div>
      ) : (
        <section className="v2sw-card">
          <h3 className="v2sw-card__title">외부 대본 업로드</h3>
          <p className="v2sw-card__desc">
            메모장에 붙여 넣은 뒤 「업로드」하면 줄번호 편집기로 들어갑니다.
          </p>

          {!project.benchmarkText.trim() ? (
            <div className="v2sw-upload-empty">
              <p>아직 업로드된 대본이 없습니다.</p>
              <button
                type="button"
                className="v2sw-btn v2sw-btn--primary"
                onClick={() => openPasteNotepad("")}
              >
                메모장에서 붙여넣기
              </button>
            </div>
          ) : (
            <>
              <ScriptLineEditor
                value={project.benchmarkText}
                onChange={(t) => onPatch({ benchmarkText: t })}
              />
              <div className="v2sw-actions">
                <button
                  type="button"
                  className="v2sw-btn v2sw-btn--secondary"
                  onClick={() => openPasteNotepad(project.benchmarkText)}
                >
                  메모장에서 다시 붙여넣기
                </button>
                <button
                  type="button"
                  className="v2sw-btn v2sw-btn--secondary"
                  disabled={!project.benchmarkText.trim()}
                  onClick={() => {
                    onPatch({
                      scriptText: enforceV2ScriptLineFormat(project.benchmarkText),
                    })
                    onFormatFixed()
                  }}
                >
                  줄 길이·도입부·본문 형식 자동 맞춤
                </button>
                <button
                  type="button"
                  className="v2sw-btn v2sw-btn--danger"
                  disabled={!project.benchmarkText.trim()}
                  onClick={() => clearAllScript("upload")}
                >
                  대본 전체 삭제
                </button>
                <button
                  type="button"
                  className="v2sw-btn v2sw-btn--primary"
                  onClick={onApplyExternalScript}
                >
                  대본 저장
                </button>
                <button
                  type="button"
                  className="v2sw-btn v2sw-btn--secondary"
                  disabled={!project.scriptText.trim() && !project.benchmarkText.trim()}
                  onClick={onGoVoiceImage}
                >
                  음성·이미지 단계로 →
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {pasteOpen ? (
        <div
          className="v2sw-notepad-root"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPasteOpen(false)
          }}
        >
          <div className="v2sw-notepad" role="dialog" aria-modal="true" aria-labelledby="v2sw-notepad-title">
            <header className="v2sw-notepad__bar">
              <div className="v2sw-notepad__bar-left">
                <span className="v2sw-notepad__dot" />
                <span className="v2sw-notepad__dot v2sw-notepad__dot--amber" />
                <span className="v2sw-notepad__dot v2sw-notepad__dot--green" />
                <h2 id="v2sw-notepad-title">메모장 · 외부 대본</h2>
              </div>
              <button
                type="button"
                className="v2sw-notepad__close"
                aria-label="닫기"
                onClick={() => setPasteOpen(false)}
              >
                ×
              </button>
            </header>
            <p className="v2sw-notepad__hint">
              다른 프로그램에서 복사한 대본을 아래에 붙여 넣으세요. 「업로드」하면 줄마다 번호가 붙은
              편집기로 들어갑니다.
            </p>
            <textarea
              className="v2sw-notepad__area"
              value={pasteDraft}
              onChange={(e) => setPasteDraft(e.target.value)}
              placeholder={"여기에 대본을 붙여 넣으세요…\n\n줄바꿈이 있으면 그대로 장면 줄로 나뉩니다."}
              spellCheck={false}
              autoFocus
            />
            <footer className="v2sw-notepad__foot">
              <span className="v2sw-meta" style={{ margin: 0 }}>
                {pasteDraft.trim().length.toLocaleString()}자 ·{" "}
                {pasteDraft.trim() ? pasteDraft.trim().split(/\n+/).filter(Boolean).length : 0}줄
              </span>
              <div className="v2sw-notepad__actions">
                <button
                  type="button"
                  className="v2sw-btn v2sw-btn--secondary"
                  onClick={() => setPasteOpen(false)}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="v2sw-btn v2sw-btn--primary"
                  disabled={!pasteDraft.trim()}
                  onClick={commitPasteUpload}
                >
                  업로드
                </button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  )
}
