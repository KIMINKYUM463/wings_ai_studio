"use client"

import { useMemo, useState } from "react"
import {
  clampV2TargetChars,
  enforceV2ScriptLineFormat,
  splitScriptIntoSceneLines,
  targetScriptCharsForVideoMinutes,
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

  const setSub = (sid: ScriptSubStep) => {
    if (sid === "plan" && !canOpenPlan && !project.planMarkdown.trim()) return
    if (sid === "script" && !canOpenScript) return
    onPatch({ scriptSub: sid })
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
              onClick={() => onPatch({ method: m.id, scriptSub: "input" })}
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
                레퍼런스 대본을 붙여 넣으면 Gemini가 분석·기획안을 작성합니다. 영어는 원문 그대로 넣어도
                됩니다(검증·번역은 이번 웹 범위 밖).
              </p>
              <div className="v2sw-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label className="v2sw-label">
                  주제 방향 (선택)
                  <input
                    className="v2sw-input"
                    value={project.topicDirection}
                    onChange={(e) => onPatch({ topicDirection: e.target.value })}
                    placeholder="예: 시니어 건강·생활 정보"
                  />
                </label>
                <label className="v2sw-label">
                  목표 분량
                  <div className="v2sw-preset-row">
                    {[10, 15, 20, 30].map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={
                          "v2sw-preset" +
                          (project.targetChars === targetScriptCharsForVideoMinutes(m)
                            ? " v2sw-preset--on"
                            : "")
                        }
                        onClick={() => onPatch({ targetChars: targetScriptCharsForVideoMinutes(m) })}
                      >
                        {m}분
                      </button>
                    ))}
                    <input
                      className="v2sw-input"
                      style={{ width: 110 }}
                      type="number"
                      value={project.targetChars}
                      onChange={(e) =>
                        onPatch({ targetChars: clampV2TargetChars(Number(e.target.value) || 8300) })
                      }
                    />
                  </div>
                </label>
              </div>
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
                    : `대본 생성 (${project.targetChars.toLocaleString()}자 목표)`}
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
            다른 프로그램에서 만든 대본을 붙여 넣으세요. 줄마다 번호가 붙어 편집할 수 있습니다.
          </p>
          <ScriptLineEditor
            value={project.benchmarkText}
            onChange={(t) => onPatch({ benchmarkText: t })}
          />
          <div className="v2sw-actions">
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
            <button type="button" className="v2sw-btn v2sw-btn--primary" onClick={onApplyExternalScript}>
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
        </section>
      )}
    </div>
  )
}
