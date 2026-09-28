"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { SceneAsset } from "@/lib/longform-v2/project-storage"
import { deriveStockKeywordsKo } from "@/lib/longform-v2/stock-keywords"
import { loadApiKeys } from "@/lib/longform-v2/api-keys"

type Props = {
  open: boolean
  onClose: () => void
  scenes: SceneAsset[]
  stockIndexes: number[]
  initialKeywords: Record<number, string>
  onConfirm: (keywords: Record<number, string>) => void
}

/**
 * 실사(스톡) 장면용 검색어 — WingsStudio DetailModeStockKeywordsModal 대응
 * 휴리스틱 프리필 + Gemini 「검색어 자동 채우기」
 */
export function StockKeywordModal({
  open,
  onClose,
  scenes,
  stockIndexes,
  initialKeywords,
  onConfirm,
}: Props) {
  const [keywords, setKeywords] = useState<Record<number, string>>({})
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const wasOpenRef = useRef(false)
  const extractGenRef = useRef(0)

  const fillWithAi = useCallback(async () => {
    if (stockIndexes.length === 0) return
    const gen = ++extractGenRef.current
    setAiBusy(true)
    setAiError(null)
    try {
      const keys = loadApiKeys()
      const payloadScenes = stockIndexes.map((index) => {
        const scene = scenes.find((s) => s.index === index)
        return { index, text: scene?.text || "" }
      })
      const res = await fetch("/api/longform-v2/stock-keywords-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: payloadScenes,
          geminiApiKey: keys.gemini,
        }),
      })
      const data = await res.json()
      if (extractGenRef.current !== gen) return
      if (!res.ok || !data.success) {
        throw new Error(data.error || "키워드 추출 실패")
      }
      const map = (data.keywordsBySceneIndex || {}) as Record<number, string>
      setKeywords((prev) => {
        const next = { ...prev }
        for (const i of stockIndexes) {
          const kw = map[i]?.trim()
          if (kw) next[i] = kw
        }
        return next
      })
    } catch (e) {
      if (extractGenRef.current !== gen) return
      // Gemini 실패 시에도 휴리스틱으로 채움
      const fallback: Record<number, string> = {}
      for (const i of stockIndexes) {
        const scene = scenes.find((s) => s.index === i)
        if (scene) fallback[i] = deriveStockKeywordsKo(scene)
      }
      setKeywords((prev) => ({ ...prev, ...fallback }))
      setAiError(e instanceof Error ? e.message : "자동 채우기 실패 — 휴리스틱으로 채웠습니다.")
    } finally {
      if (extractGenRef.current === gen) setAiBusy(false)
    }
  }, [scenes, stockIndexes])

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false
      setAiBusy(false)
      setAiError(null)
      return
    }
    if (wasOpenRef.current) return
    wasOpenRef.current = true

    const next: Record<number, string> = {}
    for (const i of stockIndexes) {
      const scene = scenes.find((s) => s.index === i)
      next[i] =
        initialKeywords[i]?.trim() ||
        (scene ? deriveStockKeywordsKo(scene) : "") ||
        ""
    }
    setKeywords(next)
    void fillWithAi()
  }, [open, stockIndexes, scenes, initialKeywords, fillWithAi])

  if (!open) return null

  const missing = stockIndexes.filter((i) => !(keywords[i] || "").trim())
  const canRun = missing.length === 0 && !aiBusy

  return (
    <div
      className="dm-batch-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="dm-batch-modal dm-stock-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lfv2-stock-kw-title"
      >
        <header className="dm-batch-head">
          <h3 id="lfv2-stock-kw-title">클립별 배경 검색어 설정</h3>
          <button type="button" className="dm-close" aria-label="닫기" onClick={onClose}>
            ×
          </button>
        </header>

        <p className="dm-stock-kw-modal__hint" style={{ margin: "0 0 0.75rem" }}>
          장면 대본에서 <strong>실사로 보일 시각 요소</strong>만 골라 넣습니다. 대본 앞부분을 그대로
          쓰지 않습니다.
          {aiBusy ? " · 검색어 추출 중…" : null}
        </p>

        <div className="dm-stock-kw-list" style={{ padding: 0, maxHeight: "min(52vh, 420px)" }}>
          {stockIndexes.map((index) => {
            const scene = scenes.find((s) => s.index === index)
            return (
              <div key={index} className="dm-stock-kw-row">
                <p className="dm-stock-kw-row__label">장면 {index + 1} · 스톡</p>
                <p className="dm-stock-kw-row__script">
                  {(scene?.text || "").slice(0, 160)}
                  {(scene?.text || "").length > 160 ? "…" : ""}
                </p>
                <input
                  className="dm-stock-kw-row__input"
                  value={keywords[index] || ""}
                  placeholder="예: 은하 우주 밤하늘 별빛"
                  disabled={aiBusy}
                  onChange={(e) =>
                    setKeywords((prev) => ({ ...prev, [index]: e.target.value }))
                  }
                />
              </div>
            )
          })}
        </div>

        {aiError ? (
          <p className="dm-batch-bg-note" style={{ color: "#fcd34d" }}>
            {aiError}
          </p>
        ) : null}

        {!canRun && !aiBusy ? (
          <p className="dm-batch-bg-note" style={{ color: "#fca5a5" }}>
            검색어가 비어 있는 장면이 {missing.length}개 있습니다.
          </p>
        ) : null}

        <div className="dm-video-bg-foot" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <button
            type="button"
            className="dm-btn dm-btn--ghost"
            disabled={aiBusy}
            onClick={() => void fillWithAi()}
          >
            {aiBusy ? "추출 중…" : "검색어 자동 채우기"}
          </button>
          <div className="dm-video-bg-foot__right">
            <button type="button" className="dm-btn dm-btn--ghost" onClick={onClose} disabled={aiBusy}>
              뒤로
            </button>
            <button
              type="button"
              className="dm-btn dm-btn--accent"
              disabled={!canRun}
              onClick={() => {
                const cleaned: Record<number, string> = {}
                for (const i of stockIndexes) {
                  cleaned[i] = (keywords[i] || "").trim()
                }
                onConfirm(cleaned)
              }}
            >
              검색어 확정 · 생성 시작
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
