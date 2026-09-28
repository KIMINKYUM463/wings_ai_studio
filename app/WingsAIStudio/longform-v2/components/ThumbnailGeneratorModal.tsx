"use client"

import { useEffect, useRef, useState } from "react"
import { loadApiKeys } from "@/lib/longform-v2/api-keys"
import type { CtrThumbnailPackageOption } from "@/lib/longform-v2/youtube/youtubeCtrThumbnailPackageKo"

type Props = {
  open: boolean
  onClose: () => void
  script: string
  topic?: string
  videoTitle?: string
  existingThumbnailUrl?: string
  onSaved: (thumbnailUrl: string) => void
  onNotify?: (message: string, kind?: "info" | "error") => void
}

const W = 1280
const H = 720

async function composeThumbnail(
  bgUrl: string,
  opt: CtrThumbnailPackageOption
): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.crossOrigin = "anonymous"
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error("배경 이미지를 불러오지 못했습니다."))
    el.src = bgUrl
  })

  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("캔버스를 열 수 없습니다.")

  // cover fit
  const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight)
  const dw = img.naturalWidth * scale
  const dh = img.naturalHeight * scale
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh)

  // bottom gradient for readability
  const grad = ctx.createLinearGradient(0, H * 0.45, 0, H)
  grad.addColorStop(0, "rgba(0,0,0,0)")
  grad.addColorStop(0.55, "rgba(0,0,0,0.55)")
  grad.addColorStop(1, "rgba(0,0,0,0.78)")
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  const drawStrokeText = (
    text: string,
    x: number,
    y: number,
    fill: string,
    fontPx: number,
    maxWidth: number
  ) => {
    ctx.font = `900 ${fontPx}px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.lineJoin = "round"
    ctx.miterLimit = 2
    ctx.lineWidth = Math.max(6, Math.round(fontPx * 0.12))
    ctx.strokeStyle = "rgba(0,0,0,0.92)"
    ctx.fillStyle = fill
    // shrink if needed
    let size = fontPx
    while (size > 28 && ctx.measureText(text).width > maxWidth) {
      size -= 2
      ctx.font = `900 ${size}px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`
      ctx.lineWidth = Math.max(5, Math.round(size * 0.12))
    }
    ctx.strokeText(text, x, y)
    ctx.fillText(text, x, y)
  }

  const line1 = opt.mainLine1.trim()
  const line2 = opt.mainLine2.trim()
  const sub = opt.subCopies?.[0]?.trim() || ""

  if (line1) drawStrokeText(line1, W / 2, H * 0.62, "#ffffff", 72, W * 0.9)
  if (line2) drawStrokeText(line2, W / 2, H * 0.74, "#ffe566", 78, W * 0.9)
  if (sub) drawStrokeText(sub, W / 2, H * 0.88, "#b8f26a", 40, W * 0.85)

  return canvas.toDataURL("image/jpeg", 0.92)
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a")
  a.href = dataUrl
  a.download = filename
  a.click()
}

/**
 * WingsStudio 썸네일 스튜디오의 CTR 패키지 → 배경 생성 → 문구 합성 흐름을 웹용으로 이식
 * (전체 레이어 편집기는 별도; 생성·저장·다운로드는 동일 파이프라인)
 */
export function ThumbnailGeneratorModal({
  open,
  onClose,
  script,
  topic,
  videoTitle,
  existingThumbnailUrl,
  onSaved,
  onNotify,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState("")
  const [options, setOptions] = useState<CtrThumbnailPackageOption[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [previewUrl, setPreviewUrl] = useState(existingThumbnailUrl || "")
  const [error, setError] = useState<string | null>(null)
  const wasOpen = useRef(false)

  useEffect(() => {
    if (!open) {
      wasOpen.current = false
      return
    }
    if (wasOpen.current) return
    wasOpen.current = true
    setOptions([])
    setSelectedId("")
    setPreviewUrl(existingThumbnailUrl || "")
    setError(null)
    setPhase("")
  }, [open, existingThumbnailUrl])

  if (!open) return null

  const selected = options.find((o) => o.id === selectedId) || null

  async function generatePackage() {
    if (!script.trim()) {
      setError("대본이 없습니다.")
      return
    }
    setBusy(true)
    setError(null)
    setPhase("CTR 패키지(문구·이미지 프롬프트) 생성 중…")
    try {
      const keys = loadApiKeys()
      if (!keys.gemini) throw new Error("Gemini API 키가 필요합니다.")
      const res = await fetch("/api/longform-v2/thumbnail-ctr-package", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script,
          videoTitle,
          topic,
          count: 8,
          geminiApiKey: keys.gemini,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || "CTR 패키지 실패")
      const list = (data.options || []) as CtrThumbnailPackageOption[]
      setOptions(list)
      setSelectedId(list[0]?.id || "")
      setPhase("")
      onNotify?.(`썸네일 옵션 ${list.length}개를 만들었습니다. 골라 「이미지 생성」하세요.`, "info")
    } catch (e) {
      setError(e instanceof Error ? e.message : "생성 실패")
    } finally {
      setBusy(false)
      setPhase("")
    }
  }

  async function generateImage() {
    if (!selected) {
      setError("옵션을 먼저 선택하세요.")
      return
    }
    setBusy(true)
    setError(null)
    setPhase("배경 이미지 생성 중… (1~2분)")
    try {
      const keys = loadApiKeys()
      if (!keys.replicate) throw new Error("Replicate API 키가 필요합니다.")
      const res = await fetch("/api/longform-v2/thumbnail-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imagePromptEn: selected.imagePromptEn,
          videoTitle,
          topic,
          replicateApiKey: keys.replicate,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || "이미지 생성 실패")
      setPhase("문구 합성 중…")
      const composed = await composeThumbnail(String(data.imageUrl), selected)
      setPreviewUrl(composed)
      setPhase("")
      onNotify?.("썸네일을 만들었습니다. 저장하거나 다운로드하세요.", "info")
    } catch (e) {
      setError(e instanceof Error ? e.message : "이미지 생성 실패")
    } finally {
      setBusy(false)
      setPhase("")
    }
  }

  return (
    <div
      className="dm-batch-overlay"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div
        className="dm-batch-modal dm-thumb-gen-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lfv2-thumb-title"
        style={{ width: "min(960px, 100%)", maxHeight: "92vh", overflow: "auto" }}
      >
        <header className="dm-batch-head">
          <h3 id="lfv2-thumb-title">🖼 썸네일 생성기</h3>
          <button type="button" className="dm-close" aria-label="닫기" disabled={busy} onClick={onClose}>
            ×
          </button>
        </header>

        <p className="dm-title-modal__lead">
          WingsStudio와 같은 <strong>CTR 패키지</strong>(메인 2줄·서브·영문 이미지 프롬프트) → Replicate
          배경 → 한글 문구 합성입니다.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                className="dm-btn dm-btn--accent"
                disabled={busy || !script.trim()}
                onClick={() => void generatePackage()}
              >
                {busy && phase.includes("CTR") ? "생성 중…" : "1. CTR 옵션 생성"}
              </button>
              <button
                type="button"
                className="dm-btn dm-btn--accent"
                disabled={busy || !selected}
                onClick={() => void generateImage()}
              >
                {busy && phase.includes("배경") ? "생성 중…" : "2. 이미지 생성·합성"}
              </button>
            </div>
            {phase ? <p className="dm-muted">{phase}</p> : null}
            {error ? <p style={{ color: "#fca5a5", fontSize: "0.85rem" }}>{error}</p> : null}

            <ul
              className="dm-batch-list"
              style={{ maxHeight: "48vh", overflow: "auto", margin: 0, padding: 0, listStyle: "none" }}
            >
              {options.map((opt) => {
                const on = opt.id === selectedId
                return (
                  <li key={opt.id} style={{ marginBottom: 6 }}>
                    <button
                      type="button"
                      className={"dm-title-card" + (on ? " dm-title-card--on" : "")}
                      style={{ width: "100%", textAlign: "left" }}
                      disabled={busy}
                      onClick={() => setSelectedId(opt.id)}
                    >
                      <span className="dm-title-card__title">
                        {opt.mainLine1} / {opt.mainLine2}
                      </span>
                      <span className="dm-title-card__desc">
                        {(opt.subCopies || []).join(" · ")}
                        {opt.angle ? ` · ${opt.angle}` : ""}
                      </span>
                    </button>
                  </li>
                )
              })}
              {options.length === 0 && !busy ? (
                <li className="dm-muted" style={{ padding: "1rem 0" }}>
                  「CTR 옵션 생성」을 눌러 시작하세요.
                </li>
              ) : null}
            </ul>
          </div>

          <div>
            <p className="dm-batch-section-label" style={{ marginTop: 0 }}>
              미리보기
            </p>
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="썸네일 미리보기"
                style={{
                  width: "100%",
                  aspectRatio: "16 / 9",
                  objectFit: "cover",
                  borderRadius: 10,
                  border: "1px solid #2e3545",
                  background: "#0b0e14",
                }}
              />
            ) : (
              <div
                style={{
                  aspectRatio: "16 / 9",
                  borderRadius: 10,
                  border: "1px dashed #2e3545",
                  display: "grid",
                  placeItems: "center",
                  color: "#8b93a8",
                  fontSize: "0.85rem",
                }}
              >
                생성된 썸네일이 여기 표시됩니다
              </div>
            )}
          </div>
        </div>

        <footer className="dm-batch-foot">
          <button type="button" className="dm-btn dm-btn--ghost" disabled={busy} onClick={onClose}>
            닫기
          </button>
          <button
            type="button"
            className="dm-btn dm-btn--ghost"
            disabled={busy || !previewUrl}
            onClick={() =>
              downloadDataUrl(
                previewUrl,
                `${(videoTitle || topic || "thumbnail").replace(/[\\/:*?"<>|]/g, "_").slice(0, 40)}.jpg`
              )
            }
          >
            JPG 다운로드
          </button>
          <button
            type="button"
            className="dm-btn dm-btn--accent"
            disabled={busy || !previewUrl}
            onClick={() => {
              onSaved(previewUrl)
              onNotify?.("프로젝트 썸네일로 저장했습니다.", "info")
              onClose()
            }}
          >
            프로젝트에 저장
          </button>
        </footer>
      </div>
    </div>
  )
}
