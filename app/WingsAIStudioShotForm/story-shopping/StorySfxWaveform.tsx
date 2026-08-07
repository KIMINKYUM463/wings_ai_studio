"use client"

import { useEffect, useMemo, useState } from "react"

const audioBufferCache = new Map<string, Promise<AudioBuffer>>()
let decoderContext: AudioContext | null = null

function loadAudioBuffer(url: string): Promise<AudioBuffer> {
  const cached = audioBufferCache.get(url)
  if (cached) return cached
  const pending = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`audio ${response.status}`)
      return response.arrayBuffer()
    })
    .then((bytes) => {
      decoderContext ||= new AudioContext()
      return decoderContext.decodeAudioData(bytes.slice(0))
    })
  audioBufferCache.set(url, pending)
  pending.catch(() => audioBufferCache.delete(url))
  return pending
}

export function StorySfxWaveform({
  audioUrl,
  sourceOffsetSec = 0,
  durationSec,
  width,
  selected = false,
}: {
  audioUrl: string
  sourceOffsetSec?: number
  durationSec: number
  width: number
  selected?: boolean
}) {
  const barCount = Math.max(10, Math.min(140, Math.round(width / 3)))
  const [peaks, setPeaks] = useState<number[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setPeaks(null)
    setFailed(false)
    void loadAudioBuffer(audioUrl)
      .then((buffer) => {
        if (cancelled) return
        const channel = buffer.getChannelData(0)
        const startSample = Math.max(
          0,
          Math.min(channel.length - 1, Math.floor(sourceOffsetSec * buffer.sampleRate))
        )
        const endSample = Math.max(
          startSample + 1,
          Math.min(
            channel.length,
            Math.ceil((sourceOffsetSec + durationSec) * buffer.sampleRate)
          )
        )
        const samplesPerBar = Math.max(1, (endSample - startSample) / barCount)
        const next = Array.from({ length: barCount }, (_, index) => {
          const from = Math.floor(startSample + index * samplesPerBar)
          const to = Math.min(
            endSample,
            Math.max(from + 1, Math.floor(startSample + (index + 1) * samplesPerBar))
          )
          let peak = 0
          for (let sample = from; sample < to; sample += 1) {
            peak = Math.max(peak, Math.abs(channel[sample] || 0))
          }
          return peak
        })
        const maximum = Math.max(0.02, ...next)
        setPeaks(next.map((peak) => peak / maximum))
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [audioUrl, barCount, durationSec, sourceOffsetSec])

  const fallbackBars = useMemo(
    () => Array.from({ length: barCount }, (_, index) => 0.25 + (index % 5) * 0.12),
    [barCount]
  )
  const values = peaks || fallbackBars

  return (
    <div
      className={`absolute inset-0 flex items-center gap-px overflow-hidden px-1 ${
        failed || !peaks ? "opacity-45" : "opacity-90"
      }`}
      aria-hidden="true"
    >
      {values.map((peak, index) => (
        <span
          key={index}
          className={`min-w-px flex-1 rounded-full ${
            selected ? "bg-white" : "bg-amber-950/70"
          }`}
          style={{ height: `${Math.max(12, peak * 88)}%` }}
        />
      ))}
    </div>
  )
}
