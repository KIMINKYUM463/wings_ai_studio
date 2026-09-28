"use client"

import { useEffect, useState } from "react"
import {
  emptyApiKeys,
  loadApiKeys,
  saveApiKeys,
  type LongformV2ApiKeys,
} from "@/lib/longform-v2/api-keys"

type Props = {
  open: boolean
  onClose: () => void
  onSaved?: (keys: LongformV2ApiKeys) => void
}

const FIELDS: { key: keyof LongformV2ApiKeys; label: string; hint: string }[] = [
  { key: "gemini", label: "Gemini API Key", hint: "대본 기획·생성 · 이미지 프롬프트 · 카피 AI (필수)" },
  { key: "replicate", label: "Replicate API Token", hint: "장면 이미지 생성 (필수)" },
  {
    key: "youtube",
    label: "YouTube Data API Key",
    hint: "썸네일 카피라이팅 참고 수집 · 트렌드 검색 (권장)",
  },
  { key: "elevenlabs", label: "ElevenLabs API Key", hint: "TTS 음성 (권장)" },
  { key: "supertone", label: "Supertone API Key", hint: "TTS 음성 (대안)" },
  { key: "perplexity", label: "Perplexity API Key", hint: "기획 검증 (선택)" },
  { key: "pexels", label: "Pexels API Key", hint: "실사(스톡) 장면 배경 (선택)" },
]

export function LongformV2ApiSettingsModal({ open, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<LongformV2ApiKeys>(emptyApiKeys())
  const [show, setShow] = useState<Record<keyof LongformV2ApiKeys, boolean>>({
    gemini: false,
    replicate: false,
    perplexity: false,
    elevenlabs: false,
    supertone: false,
    pexels: false,
    youtube: false,
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!open) return
    // WingsAIStudio / ShotForm 등 레거시 키도 loadApiKeys에서 승격해 가져옴
    setDraft(loadApiKeys())
    setSaved(false)
  }, [open])

  if (!open) return null

  return (
    <div className="lfv2-modal-backdrop" role="dialog" aria-modal="true" aria-label="API 키 설정">
      <div className="lfv2-modal">
        <h2 className="lfv2-modal__title">API 키 설정</h2>
        <p className="lfv2-modal__desc">
          WingsStudio / 쇼핑숏폼과 같은 키입니다.
          <br />
          <strong>Supertonic 3</strong>은 로컬 serve라 API 키가 필요 없습니다.
          <br />
          YouTube Data API는{" "}
          <a
            href="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
            target="_blank"
            rel="noreferrer"
          >
            Google Cloud Console
          </a>
          에서 발급할 수 있습니다.
        </p>

        {FIELDS.map(({ key, label, hint }) => (
          <div key={key} className="lfv2-key-row">
            <label>
              {label} <span style={{ color: "#71717a", fontWeight: 500 }}>— {hint}</span>
            </label>
            <div className="lfv2-key-row__controls">
              <input
                type={show[key] ? "text" : "password"}
                value={draft[key]}
                onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder="입력하세요"
                autoComplete="off"
              />
              <button
                type="button"
                className="lfv2-btn lfv2-btn--secondary lfv2-btn--sm"
                onClick={() => setShow((prev) => ({ ...prev, [key]: !prev[key] }))}
              >
                {show[key] ? "숨김" : "보기"}
              </button>
            </div>
          </div>
        ))}

        {saved && <p className="lfv2-banner lfv2-banner--info">저장 완료</p>}

        <div className="lfv2-actions">
          <button
            type="button"
            className="lfv2-btn lfv2-btn--primary"
            onClick={() => {
              saveApiKeys(draft)
              const next = loadApiKeys()
              setDraft(next)
              setSaved(true)
              onSaved?.(next)
            }}
          >
            저장
          </button>
          <button type="button" className="lfv2-btn lfv2-btn--secondary" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

const STATUS_ITEMS: { key: keyof LongformV2ApiKeys; label: string }[] = [
  { key: "gemini", label: "Gemini" },
  { key: "replicate", label: "Replicate" },
  { key: "youtube", label: "YouTube Data" },
  { key: "elevenlabs", label: "ElevenLabs" },
  { key: "supertone", label: "Supertone" },
  { key: "perplexity", label: "Perplexity" },
  { key: "pexels", label: "Pexels" },
]

/**
 * 프로젝트 진입 시 키를 하나씩「확인 중…」→ 결과로 순서대로 표시합니다.
 * keys가 바뀌면(설정 저장 후) 애니메이션을 다시 재생합니다.
 */
export function ApiKeyStatusCard({ keys }: { keys: LongformV2ApiKeys }) {
  const [revealed, setRevealed] = useState(0)
  const [checkingIdx, setCheckingIdx] = useState(0)

  useEffect(() => {
    setRevealed(0)
    setCheckingIdx(0)
    const timers: number[] = []
    const stepMs = 480
    const startDelay = 220

    STATUS_ITEMS.forEach((_, i) => {
      timers.push(
        window.setTimeout(() => {
          setCheckingIdx(i)
        }, startDelay + i * stepMs)
      )
      timers.push(
        window.setTimeout(() => {
          setRevealed(i + 1)
        }, startDelay + i * stepMs + 320)
      )
    })

    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [
    keys.gemini,
    keys.replicate,
    keys.youtube,
    keys.elevenlabs,
    keys.supertone,
    keys.perplexity,
    keys.pexels,
  ])

  return (
    <div className="lfv2-key-status" aria-live="polite">
      <strong>API 키 상태</strong>
      <ul className="lfv2-key-status__list">
        {STATUS_ITEMS.map(({ key, label }, i) => {
          const done = i < revealed
          const isChecking = !done && i === checkingIdx
          const ok = Boolean(keys[key])

          if (!done) {
            return (
              <li
                key={key}
                className={
                  "lfv2-key-row-status lfv2-key-row-status--pending" +
                  (isChecking ? " lfv2-key-row-status--checking" : "")
                }
              >
                <span className="lfv2-key-row-status__mark" aria-hidden>
                  {isChecking ? (
                    <span className="lfv2-key-spinner" />
                  ) : (
                    <span className="lfv2-key-dot" />
                  )}
                </span>
                <span>
                  {label} {isChecking ? "확인 중…" : "대기"}
                </span>
              </li>
            )
          }

          return (
            <li
              key={key}
              className={
                "lfv2-key-row-status lfv2-key-row-status--reveal " +
                (ok ? "lfv2-key-ok" : "lfv2-key-bad")
              }
            >
              <span className="lfv2-key-row-status__mark" aria-hidden>
                {ok ? "✓" : "!"}
              </span>
              <span>
                {label} {ok ? "연결됨" : "미설정"}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
