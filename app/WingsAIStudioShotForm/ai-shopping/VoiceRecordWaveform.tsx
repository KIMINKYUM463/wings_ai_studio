"use client"

import { useEffect, useRef } from "react"

type Props = {
  /** 녹음 중일 때 AnalyserNode */
  analyser: AnalyserNode | null
  /** 녹음이 끝났을 때 재생용 URL (정지 파형) */
  audioUrl?: string
  active: boolean
  className?: string
}

/** 실시간/정지 파형 캔버스 */
export function VoiceRecordWaveform({ analyser, audioUrl, active, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const staticPeaksRef = useRef<Float32Array | null>(null)

  // 녹음 완료 후 URL → 피크 추출
  useEffect(() => {
    if (!audioUrl) {
      staticPeaksRef.current = null
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(audioUrl)
        const buf = await res.arrayBuffer()
        const ctx = new AudioContext()
        const decoded = await ctx.decodeAudioData(buf.slice(0))
        await ctx.close()
        if (cancelled) return
        const ch = decoded.getChannelData(0)
        const bars = 96
        const block = Math.floor(ch.length / bars) || 1
        const peaks = new Float32Array(bars)
        for (let i = 0; i < bars; i++) {
          let max = 0
          const start = i * block
          for (let j = 0; j < block && start + j < ch.length; j++) {
            max = Math.max(max, Math.abs(ch[start + j] || 0))
          }
          peaks[i] = max
        }
        staticPeaksRef.current = peaks
        drawStatic(canvasRef.current, peaks)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [audioUrl])

  // 녹음 중 실시간 파형
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !active || !analyser) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return
    }
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const data = new Uint8Array(analyser.fftSize)

    const paint = () => {
      const w = canvas.width
      const h = canvas.height
      analyser.getByteTimeDomainData(data)
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = "rgba(15, 23, 42, 0.95)"
      ctx.fillRect(0, 0, w, h)

      const mid = h / 2
      const bars = 64
      const step = Math.floor(data.length / bars)
      const gap = 2
      const bw = Math.max(2, (w - gap * bars) / bars)

      for (let i = 0; i < bars; i++) {
        let sum = 0
        for (let j = 0; j < step; j++) {
          const v = (data[i * step + j] || 128) / 128 - 1
          sum += Math.abs(v)
        }
        const amp = Math.min(1, (sum / step) * 2.2)
        const bh = Math.max(3, amp * (h * 0.85))
        const x = i * (bw + gap)
        const grad = ctx.createLinearGradient(0, mid - bh / 2, 0, mid + bh / 2)
        grad.addColorStop(0, "#fb923c")
        grad.addColorStop(0.5, "#f97316")
        grad.addColorStop(1, "#ea580c")
        ctx.fillStyle = grad
        ctx.beginPath()
        const r = Math.min(3, bw / 2)
        roundRect(ctx, x, mid - bh / 2, bw, bh, r)
        ctx.fill()
      }
      rafRef.current = requestAnimationFrame(paint)
    }
    paint()
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [active, analyser])

  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={120}
      className={className || "h-[120px] w-full rounded-xl border border-orange-400/25 bg-slate-950"}
    />
  )
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawStatic(canvas: HTMLCanvasElement | null, peaks: Float32Array) {
  if (!canvas) return
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  const w = canvas.width
  const h = canvas.height
  const mid = h / 2
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = "rgba(15, 23, 42, 0.95)"
  ctx.fillRect(0, 0, w, h)
  const bars = peaks.length
  const gap = 2
  const bw = Math.max(2, (w - gap * bars) / bars)
  for (let i = 0; i < bars; i++) {
    const amp = Math.min(1, (peaks[i] || 0) * 1.8)
    const bh = Math.max(3, amp * (h * 0.85))
    const x = i * (bw + gap)
    ctx.fillStyle = "#34d399"
    ctx.beginPath()
    roundRect(ctx, x, mid - bh / 2, bw, bh, Math.min(3, bw / 2))
    ctx.fill()
  }
}
