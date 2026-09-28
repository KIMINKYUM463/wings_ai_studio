"use client"

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import {
  DEFAULT_FLOW_WATERMARK_MOSAIC_PARAMS,
  drawMosaicOnCanvas,
  type FlowWatermarkMosaicParams,
} from "@/lib/longform-v2/flow-watermark-mosaic"

type Props = {
  open: boolean
  imageSrc: string
  sceneLabel?: string
  imageCount: number
  busy?: boolean
  error?: string | null
  statusText?: string
  onClose: () => void
  onConfirm: (params: FlowWatermarkMosaicParams) => void
}

type DragMode = "move" | "resize-nw" | null

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n))
}

function mosaicBoxPx(imgW: number, imgH: number, params: FlowWatermarkMosaicParams) {
  const boxW = Math.max(24, Math.round(imgW * params.widthRatio))
  const boxH = Math.max(24, Math.round(imgH * params.heightRatio))
  const left = Math.max(
    0,
    Math.min(imgW - boxW, imgW - boxW - Math.round(imgW * params.marginRightRatio))
  )
  const top = Math.max(
    0,
    Math.min(imgH - boxH, imgH - boxH - Math.round(imgH * params.marginBottomRatio))
  )
  return { left, top, boxW, boxH }
}

export function FlowWatermarkMosaicModal({
  open,
  imageSrc,
  sceneLabel = "첫 번째 이미지",
  imageCount,
  busy = false,
  error = null,
  statusText = "",
  onClose,
  onConfirm,
}: Props) {
  const [params, setParams] = useState<FlowWatermarkMosaicParams>({
    ...DEFAULT_FLOW_WATERMARK_MOSAIC_PARAMS,
  })
  const [imgReady, setImgReady] = useState(false)
  const [boxSelected, setBoxSelected] = useState(true)
  const [nat, setNat] = useState({ w: 1, h: 1 })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    mode: DragMode
    startX: number
    startY: number
    start: FlowWatermarkMosaicParams
  } | null>(null)

  useEffect(() => {
    if (!open) return
    setParams({ ...DEFAULT_FLOW_WATERMARK_MOSAIC_PARAMS })
    setBoxSelected(true)
    setImgReady(false)
    const img = new Image()
    img.decoding = "async"
    img.onload = () => {
      imgRef.current = img
      setNat({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 })
      setImgReady(true)
    }
    img.onerror = () => {
      imgRef.current = null
      setImgReady(false)
    }
    img.src = imageSrc
    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [open, imageSrc])

  useEffect(() => {
    if (!open || !imgReady) return
    const img = imgRef.current
    const canvas = canvasRef.current
    if (!img || !canvas) return
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    drawMosaicOnCanvas(ctx, img, params, boxSelected)
  }, [open, imgReady, params, boxSelected])

  const boxCss = useMemo(() => {
    const leftPct = (1 - params.widthRatio - params.marginRightRatio) * 100
    const topPct = (1 - params.heightRatio - params.marginBottomRatio) * 100
    return {
      left: `${clamp(leftPct, 0, 96)}%`,
      top: `${clamp(topPct, 0, 96)}%`,
      width: `${params.widthRatio * 100}%`,
      height: `${params.heightRatio * 100}%`,
    }
  }, [params])

  const clientToImage = (clientX: number, clientY: number) => {
    const stage = stageRef.current
    if (!stage) return { x: 0, y: 0 }
    const rect = stage.getBoundingClientRect()
    const x = ((clientX - rect.left) / Math.max(1, rect.width)) * nat.w
    const y = ((clientY - rect.top) / Math.max(1, rect.height)) * nat.h
    return { x, y }
  }

  const pointInMosaicBox = (clientX: number, clientY: number) => {
    const { x, y } = clientToImage(clientX, clientY)
    const { left, top, boxW, boxH } = mosaicBoxPx(nat.w, nat.h, params)
    return x >= left && x <= left + boxW && y >= top && y <= top + boxH
  }

  const onPointerDown = (mode: DragMode) => (e: ReactPointerEvent) => {
    if (busy || !mode) return
    e.preventDefault()
    e.stopPropagation()
    setBoxSelected(true)
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      start: { ...params },
    }
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const drag = dragRef.current
    if (!drag?.mode) return
    const cur = clientToImage(e.clientX, e.clientY)
    const startPt = clientToImage(drag.startX, drag.startY)
    const dx = cur.x - startPt.x
    const dy = cur.y - startPt.y
    const s = drag.start

    if (drag.mode === "move") {
      const nextMarginRight = clamp(s.marginRightRatio - dx / nat.w, 0, 0.35)
      const nextMarginBottom = clamp(s.marginBottomRatio - dy / nat.h, 0, 0.35)
      const maxMR = Math.max(0, 1 - s.widthRatio - 0.02)
      const maxMB = Math.max(0, 1 - s.heightRatio - 0.02)
      setParams({
        ...s,
        marginRightRatio: clamp(nextMarginRight, 0, maxMR),
        marginBottomRatio: clamp(nextMarginBottom, 0, maxMB),
      })
      return
    }

    if (drag.mode === "resize-nw") {
      const nextW = clamp(s.widthRatio - dx / nat.w, 0.04, 0.4)
      const nextH = clamp(s.heightRatio - dy / nat.h, 0.05, 0.45)
      const maxW = 1 - s.marginRightRatio - 0.02
      const maxH = 1 - s.marginBottomRatio - 0.02
      setParams({
        ...s,
        widthRatio: clamp(nextW, 0.04, maxW),
        heightRatio: clamp(nextH, 0.05, maxH),
      })
    }
  }

  const endDrag = () => {
    dragRef.current = null
  }

  const onStagePointerDown = (e: ReactPointerEvent) => {
    if (busy || !imgReady) return
    const t = e.target as HTMLElement
    if (t.closest(".dm-flow-wm-hit")) return
    if (pointInMosaicBox(e.clientX, e.clientY)) {
      setBoxSelected(true)
      return
    }
    setBoxSelected(false)
  }

  if (!open) return null

  return (
    <div
      className="dm-settings-overlay dm-flow-wm-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div
        className="dm-settings-modal dm-flow-wm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lfv2-flow-wm-title"
      >
        <header className="dm-settings-head">
          <h3 id="lfv2-flow-wm-title">▦ Flow 워터마크 모자이크</h3>
          <button type="button" className="dm-close" aria-label="닫기" disabled={busy} onClick={onClose}>
            ×
          </button>
        </header>

        <p className="dm-muted dm-flow-wm-lead">
          {sceneLabel}에서 파란 박스 위치·크기를 맞춘 뒤, 모자이크 강도를 조절하세요. 확인하면 이미지가
          있는 장면 <strong>{imageCount}장</strong>에 같은 비율로 적용됩니다.
        </p>

        <div
          ref={stageRef}
          className={`dm-flow-wm-stage${boxSelected ? "" : " dm-flow-wm-stage--deselected"}`}
          onPointerDown={onStagePointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {!imgReady ? (
            <p className="dm-muted dm-flow-wm-loading">미리보기 불러오는 중…</p>
          ) : (
            <>
              <canvas ref={canvasRef} className="dm-flow-wm-canvas" />
              {boxSelected ? (
                <div
                  className="dm-flow-wm-hit"
                  style={boxCss}
                  onPointerDown={onPointerDown("move")}
                  title="드래그하여 위치 이동"
                >
                  <span
                    className="dm-flow-wm-handle"
                    onPointerDown={onPointerDown("resize-nw")}
                    title="드래그하여 크기 조절"
                  />
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="dm-flow-wm-controls">
          <label className="dm-flow-wm-slider">
            <span>모자이크 강도 (칸 크기 {params.pixelSize}px)</span>
            <input
              type="range"
              min={8}
              max={40}
              step={1}
              value={params.pixelSize}
              disabled={busy}
              onChange={(e) => setParams((p) => ({ ...p, pixelSize: Number(e.target.value) }))}
            />
            <span className="dm-flow-wm-slider__hint">← 약함 · 강함 →</span>
          </label>
          <label className="dm-flow-wm-slider">
            <span>가로 크기 {Math.round(params.widthRatio * 100)}%</span>
            <input
              type="range"
              min={4}
              max={40}
              step={1}
              value={Math.round(params.widthRatio * 100)}
              disabled={busy}
              onChange={(e) =>
                setParams((p) => ({
                  ...p,
                  widthRatio: clamp(Number(e.target.value) / 100, 0.04, 0.4),
                }))
              }
            />
          </label>
          <label className="dm-flow-wm-slider">
            <span>세로 크기 {Math.round(params.heightRatio * 100)}% (위쪽 덮기)</span>
            <input
              type="range"
              min={5}
              max={45}
              step={1}
              value={Math.round(params.heightRatio * 100)}
              disabled={busy}
              onChange={(e) =>
                setParams((p) => ({
                  ...p,
                  heightRatio: clamp(Number(e.target.value) / 100, 0.05, 0.45),
                }))
              }
            />
          </label>
        </div>

        {error ? (
          <p className="dm-flow-wm-error" role="alert">
            {error}
          </p>
        ) : null}
        {statusText ? <p className="dm-flow-wm-status">{statusText}</p> : null}

        <footer className="dm-flow-wm-foot">
          <button type="button" className="dm-btn dm-btn--ghost" disabled={busy} onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="dm-btn dm-btn--primary"
            disabled={busy || !imgReady || imageCount < 1}
            onClick={() => onConfirm(params)}
          >
            {busy ? "적용 중…" : `${imageCount}장에 모자이크 적용`}
          </button>
        </footer>
      </div>
    </div>
  )
}
