"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { loadApiKeys } from "@/lib/longform-v2/api-keys"
import type { LongformV2Project } from "@/lib/longform-v2/project-storage"
import { resolveVoicePersona, type LongformVoicePersona } from "@/lib/longform-v2/voice-personas"
import { fetchSupertonicTts } from "@/lib/supertonic-runtime-client"

type VoiceOption = { id: string; label: string }

type Props = {
  open: boolean
  onClose: () => void
  voices: VoiceOption[]
  selectedId: string
  onSelect: (voiceId: string) => void
  engineLabel?: string
  ttsEngine: LongformV2Project["ttsEngine"]
  ttsSpeed?: number
  ttsLanguage?: string
}

/** 목소리 미리듣기 고정 문구 */
const PREVIEW_TEXT = "안녕하세요 윙스스튜디오 입니다"

function PersonaCard({
  persona,
  selected,
  previewing,
  onClick,
  onPreview,
}: {
  persona: LongformVoicePersona
  selected: boolean
  previewing: boolean
  onClick: () => void
  onPreview: () => void
}) {
  return (
    <button
      type="button"
      className={"lfv2-voice-card" + (selected ? " lfv2-voice-card--on" : "")}
      onClick={onClick}
    >
      <span className="lfv2-voice-card__avatar">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={persona.previewSrc} alt="" />
      </span>
      <span className="lfv2-voice-card__body">
        <strong>{persona.aliasKo}</strong>
        <span>{persona.blurbKo}</span>
      </span>
      <span
        className={
          "lfv2-voice-card__play" + (previewing ? " lfv2-voice-card__play--busy" : "")
        }
        role="button"
        tabIndex={0}
        aria-label={`${persona.aliasKo} 미리 듣기`}
        onClick={(e) => {
          e.stopPropagation()
          onPreview()
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            e.stopPropagation()
            onPreview()
          }
        }}
      >
        {previewing ? "…" : "▶"}
      </span>
      {selected ? <span className="lfv2-voice-card__check">✓</span> : null}
    </button>
  )
}

async function fetchPreviewAudioUrl(opts: {
  voiceId: string
  ttsEngine: LongformV2Project["ttsEngine"]
  ttsSpeed: number
  ttsLanguage: string
}): Promise<string> {
  const bare = String(opts.voiceId || "").replace(/^supertonic-/, "") || opts.voiceId
  const keys = loadApiKeys()

  if (opts.ttsEngine === "supertonic") {
    const lang =
      opts.ttsLanguage === "English" ? "en" : opts.ttsLanguage === "日本語" ? "ja" : "ko"
    const ttsRes = await fetchSupertonicTts({
      text: PREVIEW_TEXT,
      voiceId: bare,
      lang,
      speed: opts.ttsSpeed,
    })
    const ttsData = await ttsRes.json()
    if (!ttsRes.ok || ttsData.success === false) {
      throw new Error(
        ttsData.error ||
          "Supertonic 미리듣기 실패. 로컬 Supertonic이 켜져 있는지 확인하세요."
      )
    }
    const audioUrl = ttsData.audioUrl || ttsData.url
    if (!audioUrl) throw new Error("TTS 응답에 audioUrl이 없습니다.")
    return audioUrl as string
  }

  if (opts.ttsEngine === "supertone") {
    if (!keys.supertone) throw new Error("Supertone API 키가 필요합니다. API 설정에서 입력하세요.")
    const ttsRes = await fetch("/api/supertone-tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: PREVIEW_TEXT,
        voiceId: bare,
        apiKey: keys.supertone,
        language: "ko",
      }),
    })
    const ttsData = await ttsRes.json()
    if (!ttsRes.ok || ttsData.success === false) {
      throw new Error(ttsData.error || "Supertone 미리듣기 실패")
    }
    const audioUrl = ttsData.audioUrl || ttsData.url
    if (!audioUrl) throw new Error("TTS 응답에 audioUrl이 없습니다.")
    return audioUrl as string
  }

  if (!keys.elevenlabs) throw new Error("ElevenLabs API 키가 필요합니다. API 설정에서 입력하세요.")
  const ttsRes = await fetch("/api/elevenlabs-tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: PREVIEW_TEXT,
      voiceId: bare,
      apiKey: keys.elevenlabs,
      speed: opts.ttsSpeed,
    }),
  })
  const ttsData = await ttsRes.json()
  if (!ttsRes.ok || ttsData.success === false) {
    throw new Error(ttsData.error || "ElevenLabs 미리듣기 실패")
  }
  const audioUrl = ttsData.audioUrl
  if (!audioUrl) throw new Error("TTS 응답에 audioUrl이 없습니다.")
  return audioUrl as string
}

/**
 * 목소리 선택 팝업 — 얼굴 + 가명으로 보이게 함 (실제 voiceId는 그대로 저장)
 * 미리듣기: "안녕하세요 윙스스튜디오 입니다"
 */
export function VoicePersonaPicker({
  open,
  onClose,
  voices,
  selectedId,
  onSelect,
  engineLabel,
  ttsEngine,
  ttsSpeed = 1.05,
  ttsLanguage = "한국어",
}: Props) {
  const [draft, setDraft] = useState(selectedId)
  const [filter, setFilter] = useState<"all" | "female" | "male">("all")
  const [previewingId, setPreviewingId] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const previewSeq = useRef(0)

  useEffect(() => {
    if (!open) return
    setDraft(selectedId)
    setFilter("all")
    setPreviewError(null)
    setPreviewingId(null)
  }, [open, selectedId])

  useEffect(() => {
    if (open) return
    previewSeq.current += 1
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setPreviewingId(null)
  }, [open])

  useEffect(() => {
    return () => {
      previewSeq.current += 1
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const personas = useMemo(() => {
    return voices.map((v) => {
      const bare = String(v.id || "").replace(/^supertonic-|^supertone-|^elevenlabs-/, "")
      return resolveVoicePersona(bare || v.id, v.label, ttsEngine)
    })
  }, [voices, ttsEngine])

  const filtered = useMemo(() => {
    if (filter === "all") return personas
    return personas.filter((p) => p.gender === filter)
  }, [personas, filter])

  const playPreview = async (voiceId: string) => {
    const bare = String(voiceId || "").replace(/^supertonic-/, "") || voiceId
    const seq = ++previewSeq.current
    setPreviewError(null)
    setDraft(bare)

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    setPreviewingId(bare)
    try {
      const audioUrl = await fetchPreviewAudioUrl({
        voiceId: bare,
        ttsEngine,
        ttsSpeed,
        ttsLanguage,
      })
      if (seq !== previewSeq.current) return

      const audio = new Audio(audioUrl)
      audioRef.current = audio
      audio.onended = () => {
        if (seq === previewSeq.current) setPreviewingId(null)
      }
      audio.onerror = () => {
        if (seq === previewSeq.current) {
          setPreviewingId(null)
          setPreviewError("오디오 재생에 실패했습니다.")
        }
      }
      await audio.play()
    } catch (err) {
      if (seq !== previewSeq.current) return
      setPreviewingId(null)
      setPreviewError(err instanceof Error ? err.message : "미리듣기에 실패했습니다.")
    }
  }

  if (!open) return null

  const draftPersona = personas.find((p) => p.voiceId === draft.replace(/^supertonic-/, ""))
  const draftBare = draft.replace(/^supertonic-/, "") || draft
  const footerBusy = previewingId === draftBare

  return (
    <div
      className="lfv2-voice-picker-root"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="lfv2-voice-picker" role="dialog" aria-modal="true" aria-labelledby="lfv2-voice-picker-title">
        <header className="lfv2-voice-picker__head">
          <div>
            <h2 id="lfv2-voice-picker-title">목소리 선택</h2>
            <p>
              {engineLabel ? `${engineLabel} · ` : ""}
              얼굴과 가명은 UI용입니다. 실제 음성 ID는 그대로 사용됩니다.
            </p>
          </div>
          <button type="button" className="lfv2-voice-picker__close" aria-label="닫기" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="lfv2-voice-picker__filters" role="tablist">
          {(
            [
              ["all", "전체"],
              ["female", "여성"],
              ["male", "남성"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={
                "lfv2-voice-picker__filter" + (filter === id ? " lfv2-voice-picker__filter--on" : "")
              }
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="lfv2-voice-picker__grid">
          {filtered.length === 0 ? (
            <p className="lfv2-voice-picker__empty">표시할 목소리가 없습니다.</p>
          ) : (
            filtered.map((p) => (
              <PersonaCard
                key={p.voiceId}
                persona={p}
                selected={draftBare === p.voiceId}
                previewing={previewingId === p.voiceId}
                onClick={() => setDraft(p.voiceId)}
                onPreview={() => void playPreview(p.voiceId)}
              />
            ))
          )}
        </div>

        {previewError ? <p className="lfv2-voice-picker__err">{previewError}</p> : null}

        <footer className="lfv2-voice-picker__foot">
          <div className="lfv2-voice-picker__preview">
            {draftPersona ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={draftPersona.previewSrc} alt="" />
                <div>
                  <strong>{draftPersona.aliasKo}</strong>
                  <span>{draftPersona.blurbKo}</span>
                </div>
                <button
                  type="button"
                  className="lfv2-voice-picker__listen"
                  disabled={!draftBare || footerBusy}
                  onClick={() => void playPreview(draftBare)}
                >
                  {footerBusy ? "생성 중…" : "미리 듣기"}
                </button>
              </>
            ) : (
              <span className="dm-muted">목소리를 골라 주세요</span>
            )}
          </div>
          <div className="lfv2-voice-picker__actions">
            <button type="button" className="v2sw-btn v2sw-btn--secondary" onClick={onClose}>
              취소
            </button>
            <button
              type="button"
              className="v2sw-btn v2sw-btn--primary"
              disabled={!draft.trim()}
              onClick={() => {
                onSelect(draft.replace(/^supertonic-/, "") || draft)
                onClose()
              }}
            >
              이 목소리로 선택
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
