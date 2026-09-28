import { useId, useMemo } from 'react'
import type { ThumbnailVerificationReport, ThumbnailVerifyPin } from '@/lib/longform-v2/youtube/thumbnailVerification'
import {
  THUMBNAIL_VERIFY_PIN_KIND_COLOR,
  THUMBNAIL_VERIFY_PIN_KIND_LABEL,
} from '@/lib/longform-v2/youtube/thumbnailVerification'
import { reportHasActionableWeaknesses } from '@/lib/longform-v2/youtube/thumbnailVerificationImprove'
import '../../styles/thumbnail-verification.css'

type Props = {
  open: boolean
  onClose: () => void
  previewDataUrl: string
  report: ThumbnailVerificationReport | null
  busy?: boolean
  improveBusy?: boolean
  onApplyImprovements?: () => void
}

function labelAnchor(pin: ThumbnailVerifyPin): { lx: number; ly: number } {
  const margin = 8
  if (pin.xn < 0.38) return { lx: margin, ly: pin.yn * 100 }
  if (pin.xn > 0.62) return { lx: 100 - margin, ly: pin.yn * 100 }
  if (pin.yn < 0.45) return { lx: pin.xn * 100, ly: margin }
  return { lx: pin.xn * 100, ly: 100 - margin }
}

function photoVerdictKo(v: ThumbnailVerificationReport['photoQuality']['verdict']): string {
  if (v === 'good') return '좋음'
  if (v === 'weak') return '부족'
  return '보통'
}

function hookVerdictKo(v: ThumbnailVerificationReport['hookStrength']['verdict']): string {
  if (v === 'strong') return '강함'
  if (v === 'weak') return '약함'
  return '보통'
}

function PinOverlay({ pin, markerId }: { pin: ThumbnailVerifyPin; markerId: string }) {
  const color = THUMBNAIL_VERIFY_PIN_KIND_COLOR[pin.kind]
  const { lx, ly } = labelAnchor(pin)
  const tx = pin.xn * 100
  const ty = pin.yn * 100

  return (
    <g className="thumb-verify__pin-g" aria-hidden>
      <line
        x1={lx}
        y1={ly}
        x2={tx}
        y2={ty}
        stroke={color}
        strokeWidth="0.55"
        strokeLinecap="round"
        markerEnd={`url(#${markerId})`}
      />
      <circle cx={tx} cy={ty} r="1.1" fill={color} stroke="#0c0a09" strokeWidth="0.25" />
      <circle cx={tx} cy={ty} r="2.4" fill="none" stroke={color} strokeWidth="0.35" opacity="0.65" />
    </g>
  )
}

function PinLegendCard({ pin }: { pin: ThumbnailVerifyPin }) {
  const color = THUMBNAIL_VERIFY_PIN_KIND_COLOR[pin.kind]
  return (
    <li
      className="thumb-verify__legend-item"
      style={{ borderLeftColor: color }}
      title={pin.detail}
    >
      <span className="thumb-verify__legend-kind" style={{ color }}>
        {THUMBNAIL_VERIFY_PIN_KIND_LABEL[pin.kind]}
      </span>
      <strong className="thumb-verify__legend-label">{pin.label}</strong>
      <p className="thumb-verify__legend-detail">{pin.detail}</p>
    </li>
  )
}

export function ThumbnailVerificationModal({
  open,
  onClose,
  previewDataUrl,
  report,
  busy,
  improveBusy,
  onApplyImprovements,
}: Props) {
  const titleId = useId()
  const arrowMarkerId = useId().replace(/:/g, '')
  const pins = report?.pins ?? []

  const scoreRing = useMemo(() => {
    const s = report?.overallScore ?? 0
    const deg = (s / 100) * 360
    return { deg, s }
  }, [report?.overallScore])

  const canImprove =
    Boolean(report && onApplyImprovements && reportHasActionableWeaknesses(report))

  if (!open) return null

  return (
    <div className="thumb-verify-modal" role="presentation">
      <button
        type="button"
        className="thumb-verify-modal__backdrop"
        aria-label="검증 창 닫기"
        onClick={onClose}
      />
      <div
        className="thumb-verify-modal__shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="thumb-verify-modal__header">
          <div>
            <h2 id={titleId} className="thumb-verify-modal__title">
              썸네일 CTR 검증 리포트
            </h2>
            <p className="thumb-verify-modal__sub">
              AI가 완성 썸네일을 분석해 강점·보완점·후킹·사진 품질을 화살표로 표시합니다
            </p>
          </div>
          {report ? (
            <div
              className="thumb-verify__score-ring"
              style={{
                background: `conic-gradient(#ea580c ${scoreRing.deg}deg, #292524 ${scoreRing.deg}deg)`,
              }}
              aria-label={`종합 점수 ${scoreRing.s}점`}
            >
              <span className="thumb-verify__score-ring-inner">
                <span className="thumb-verify__score-num">{scoreRing.s}</span>
                <span className="thumb-verify__score-unit">종합</span>
              </span>
            </div>
          ) : null}
          <button type="button" className="thumb-verify-modal__close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>

        <div className="thumb-verify-modal__body">
          {busy ? (
            <div className="thumb-verify-modal__loading" role="status" aria-busy="true">
              <div className="thumb-verify-modal__loading-ring" aria-hidden />
              <p>썸네일을 전문가 관점에서 분석하는 중…</p>
              <p className="thumb-verify-modal__loading-sub">후킹 · 가독성 · 구도 · 사진 품질</p>
            </div>
          ) : report ? (
            <>
              <div className="thumb-verify-modal__cols">
                <aside className="thumb-verify-modal__aside thumb-verify-modal__aside--good">
                  <h3 className="thumb-verify__col-title">좋은 점</h3>
                  <ul className="thumb-verify__bullets">
                    {report.strengths.length > 0 ? (
                      report.strengths.map((t, i) => (
                        <li key={`s-${i}`}>{t}</li>
                      ))
                    ) : (
                      <li className="thumb-verify__empty">강점 요약 없음</li>
                    )}
                  </ul>
                  <div className="thumb-verify__metrics">
                    <div className="thumb-verify__metric">
                      <span className="thumb-verify__metric-label">사진·비주얼</span>
                      <span className="thumb-verify__metric-score">{report.photoQuality.score}</span>
                      <span
                        className={
                          'thumb-verify__metric-badge thumb-verify__metric-badge--' +
                          report.photoQuality.verdict
                        }
                      >
                        {photoVerdictKo(report.photoQuality.verdict)}
                      </span>
                      <p>{report.photoQuality.summary}</p>
                    </div>
                  </div>
                </aside>

                <div className="thumb-verify-modal__stage">
                  <div className="thumb-verify__frame">
                    <img
                      className="thumb-verify__img"
                      src={previewDataUrl}
                      alt="검증 대상 썸네일"
                      width={1280}
                      height={720}
                    />
                    <svg
                      className="thumb-verify__svg"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      aria-hidden
                    >
                      <defs>
                        <marker
                          id={arrowMarkerId}
                          markerWidth="6"
                          markerHeight="6"
                          refX="5"
                          refY="3"
                          orient="auto"
                        >
                          <path d="M0,0 L6,3 L0,6 Z" fill="context-stroke" />
                        </marker>
                      </defs>
                      {pins.map((pin) => (
                        <PinOverlay key={pin.id} pin={pin} markerId={arrowMarkerId} />
                      ))}
                    </svg>
                  </div>
                  <p className="thumb-verify__verdict">{report.overallVerdict}</p>
                </div>

                <aside className="thumb-verify-modal__aside thumb-verify-modal__aside--weak">
                  <h3 className="thumb-verify__col-title">보완할 점</h3>
                  <ul className="thumb-verify__bullets thumb-verify__bullets--weak">
                    {report.weaknesses.length > 0 ? (
                      report.weaknesses.map((t, i) => (
                        <li key={`w-${i}`}>{t}</li>
                      ))
                    ) : (
                      <li className="thumb-verify__empty">보완 요약 없음</li>
                    )}
                  </ul>
                  <div className="thumb-verify__metrics">
                    <div className="thumb-verify__metric">
                      <span className="thumb-verify__metric-label">후킹·CTR</span>
                      <span className="thumb-verify__metric-score">{report.hookStrength.score}</span>
                      <span
                        className={
                          'thumb-verify__metric-badge thumb-verify__metric-badge--hook-' +
                          report.hookStrength.verdict
                        }
                      >
                        {hookVerdictKo(report.hookStrength.verdict)}
                      </span>
                      <p>{report.hookStrength.summary}</p>
                    </div>
                  </div>
                </aside>
              </div>

              <section className="thumb-verify__legend" aria-label="화살표 분석 상세">
                <h3 className="thumb-verify__legend-title">화살표 분석 ({pins.length}개 지점)</h3>
                <ul className="thumb-verify__legend-grid">
                  {pins.map((pin) => (
                    <PinLegendCard key={pin.id} pin={pin} />
                  ))}
                </ul>
              </section>
            </>
          ) : (
            <p className="thumb-verify-modal__error">검증 결과를 불러오지 못했습니다.</p>
          )}
        </div>

        <footer className="thumb-verify-modal__footer">
          {canImprove ? (
            <button
              type="button"
              className="thumb-ui-btn thumb-ui-btn--verify thumb-verify-modal__improve-btn"
              disabled={improveBusy || busy}
              onClick={onApplyImprovements}
            >
              {improveBusy ? '보완 적용·재검증 중…' : '보완사항 반영해 개선'}
            </button>
          ) : null}
          <button
            type="button"
            className="thumb-ui-btn thumb-ui-btn--primary"
            onClick={onClose}
            disabled={improveBusy}
          >
            확인
          </button>
        </footer>
      </div>
    </div>
  )
}
