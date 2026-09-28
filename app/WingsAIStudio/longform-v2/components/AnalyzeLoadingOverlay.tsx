"use client"

import { useEffect, useMemo, useState } from "react"

type Props = {
  /** page busy 문자열 — null이면 숨김 */
  busy: string | null
}

const ANALYZE_STEPS = [
  "대본 구조 스캔",
  "훅·전개 패턴 분석",
  "핵심 주제 추출",
  "차별화 포인트 정리",
  "기획안 초안 작성",
]

const SCRIPT_STEPS = [
  "기획안 반영",
  "장면 흐름 설계",
  "문장·호흡 다듬기",
  "목표 분량 맞추기",
]

const SCAN_LINES = [
  "도입부 훅 강도 측정…",
  "문단 전환 리듬 비교…",
  "키워드 밀도 / 반복 패턴…",
  "시청 유지 구간 추정…",
  "벤치마크 톤·어조 매핑…",
  "차별화 각도 후보 생성…",
]

function isPlanBusy(busy: string) {
  return /분석|기획|대본 생성/i.test(busy)
}

/**
 * 기획/분석/대본 생성 중 전체 화면 로딩.
 * busy 문구에 따라 단계 하이라이트가 진행됩니다.
 */
export function AnalyzeLoadingOverlay({ busy }: Props) {
  const [tick, setTick] = useState(0)
  const [scanIdx, setScanIdx] = useState(0)

  const active = Boolean(busy && isPlanBusy(busy))
  const isScript = Boolean(busy && /대본 생성/i.test(busy))
  const steps = isScript ? SCRIPT_STEPS : ANALYZE_STEPS

  const activeStep = useMemo(() => {
    if (!busy) return 0
    if (/분석/i.test(busy)) return Math.min(2, steps.length - 1)
    if (/기획/i.test(busy)) return Math.min(4, steps.length - 1)
    if (/대본 생성/i.test(busy)) return Math.min(3, steps.length - 1)
    return Math.min(Math.floor(tick / 2), steps.length - 1)
  }, [busy, steps.length, tick])

  useEffect(() => {
    if (!active) {
      setTick(0)
      setScanIdx(0)
      return
    }
    const a = window.setInterval(() => setTick((t) => t + 1), 900)
    const b = window.setInterval(() => setScanIdx((i) => (i + 1) % SCAN_LINES.length), 1400)
    return () => {
      window.clearInterval(a)
      window.clearInterval(b)
    }
  }, [active])

  if (!active || !busy) return null

  return (
    <div className="lfv2-analyze-overlay" role="alertdialog" aria-busy="true" aria-live="polite">
      <div className="lfv2-analyze-panel">
        <div className="lfv2-analyze-radar" aria-hidden>
          <span className="lfv2-analyze-radar__ring" />
          <span className="lfv2-analyze-radar__ring lfv2-analyze-radar__ring--2" />
          <span className="lfv2-analyze-radar__sweep" />
          <span className="lfv2-analyze-radar__core" />
        </div>

        <p className="lfv2-analyze-eyebrow">{isScript ? "SCRIPT ENGINE" : "BENCHMARK ANALYSIS"}</p>
        <h2 className="lfv2-analyze-title">{busy}</h2>
        <p className="lfv2-analyze-scan">{SCAN_LINES[scanIdx]}</p>

        <div className="lfv2-analyze-bars" aria-hidden>
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="lfv2-analyze-bars__col"
              style={{ animationDelay: `${i * 0.08}s` }}
            />
          ))}
        </div>

        <ol className="lfv2-analyze-steps">
          {steps.map((label, i) => {
            const done = i < activeStep
            const current = i === activeStep
            return (
              <li
                key={label}
                className={
                  "lfv2-analyze-step" +
                  (done ? " lfv2-analyze-step--done" : "") +
                  (current ? " lfv2-analyze-step--on" : "")
                }
              >
                <span className="lfv2-analyze-step__mark" aria-hidden>
                  {done ? "✓" : current ? <span className="lfv2-key-spinner" /> : "·"}
                </span>
                <span>{label}</span>
              </li>
            )
          })}
        </ol>

        <p className="lfv2-analyze-hint">창을 닫지 마세요. Gemini가 대본을 읽고 있습니다.</p>
      </div>
    </div>
  )
}
