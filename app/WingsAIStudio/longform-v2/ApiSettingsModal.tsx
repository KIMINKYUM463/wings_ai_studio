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
  { key: "gemini", label: "Gemini API Key", hint: "대본 기획·생성 · 이미지 프롬프트 (필수)" },
  { key: "replicate", label: "Replicate API Token", hint: "장면 이미지 생성 (필수)" },
  { key: "elevenlabs", label: "ElevenLabs API Key", hint: "TTS 음성 (권장)" },
  { key: "supertone", label: "Supertone API Key", hint: "TTS 음성 (대안)" },
  { key: "perplexity", label: "Perplexity API Key", hint: "기획 검증 (선택)" },
]

export function LongformV2ApiSettingsModal({ open, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<LongformV2ApiKeys>(emptyApiKeys())
  const [show, setShow] = useState<Record<keyof LongformV2ApiKeys, boolean>>({
    gemini: false,
    replicate: false,
    perplexity: false,
    elevenlabs: false,
    supertone: false,
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!open) return
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
          TTSMaker·OpenAI는 쓰지 않습니다.
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

export function ApiKeyStatusCard({ keys }: { keys: LongformV2ApiKeys }) {
  return (
    <div className="lfv2-key-status">
      <strong>API 키 상태</strong>
      <div className={keys.gemini ? "lfv2-key-ok" : "lfv2-key-bad"}>
        Gemini {keys.gemini ? "연결됨" : "미설정"}
      </div>
      <div className={keys.replicate ? "lfv2-key-ok" : "lfv2-key-bad"}>
        Replicate {keys.replicate ? "연결됨" : "미설정"}
      </div>
      <div className={keys.elevenlabs ? "lfv2-key-ok" : "lfv2-key-bad"}>
        ElevenLabs {keys.elevenlabs ? "연결됨" : "미설정"}
      </div>
      <div className={keys.supertone ? "lfv2-key-ok" : "lfv2-key-bad"}>
        Supertone {keys.supertone ? "연결됨" : "미설정"}
      </div>
    </div>
  )
}
