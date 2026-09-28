import { useEffect, useRef, useState } from 'react'

export type StudioNumericInputProps = {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  className?: string
  id?: string
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/** 숫자 필드 — 백스페이스로 비워도 즉시 기본값/0으로 튀지 않음 (blur·Enter 시 확정) */
export function StudioNumericInput({
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
  className,
  id,
}: StudioNumericInputProps) {
  const [draft, setDraft] = useState(String(value))
  const [focused, setFocused] = useState(false)
  const lastCommitted = useRef(value)

  useEffect(() => {
    lastCommitted.current = value
    if (!focused) setDraft(String(value))
  }, [value, focused])

  const commitDraft = (raw: string) => {
    const trimmed = raw.trim()
    if (trimmed === '' || trimmed === '-' || trimmed === '.') {
      setDraft(String(lastCommitted.current))
      return
    }
    const n = Number(trimmed)
    if (!Number.isFinite(n)) {
      setDraft(String(lastCommitted.current))
      return
    }
    const next = clamp(n, min, max)
    lastCommitted.current = next
    setDraft(String(next))
    if (next !== value) onChange(next)
  }

  return (
    <input
      id={id}
      type="number"
      className={className}
      min={min}
      max={max}
      step={step}
      value={focused ? draft : String(value)}
      onFocus={() => {
        setFocused(true)
        setDraft(String(value))
      }}
      onChange={(e) => {
        setDraft(e.target.value)
      }}
      onBlur={() => {
        setFocused(false)
        commitDraft(draft)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commitDraft(draft)
          e.currentTarget.blur()
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          setDraft(String(value))
          e.currentTarget.blur()
        }
      }}
    />
  )
}
