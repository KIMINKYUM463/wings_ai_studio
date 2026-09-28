"use client"

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react"

type Props = {
  value: string
  onChange: (next: string) => void
}

function linesFromValue(value: string): string[] {
  const raw = value.replace(/\r\n/g, "\n")
  if (!raw.trim()) return [""]
  return raw.split("\n")
}

export function ScriptLineEditor({ value, onChange }: Props) {
  const [lines, setLines] = useState(() => linesFromValue(value))
  const [activeIndex, setActiveIndex] = useState(0)
  const [copied, setCopied] = useState(false)
  const inputRefs = useRef<Array<HTMLTextAreaElement | null>>([])
  const copyTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const next = linesFromValue(value)
    setLines((prev) => (prev.join("\n") === next.join("\n") ? prev : next))
  }, [value])

  const commit = useCallback(
    (next: string[]) => {
      setLines(next)
      onChange(next.join("\n"))
    },
    [onChange]
  )

  const focusLine = useCallback((index: number, caret?: number) => {
    requestAnimationFrame(() => {
      const el = inputRefs.current[index]
      if (!el) return
      el.focus()
      if (typeof caret === "number") {
        el.setSelectionRange(caret, caret)
      }
    })
  }, [])

  const updateLine = (index: number, text: string) => {
    const next = [...lines]
    next[index] = text
    commit(next)
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget
    const start = ta.selectionStart ?? 0
    const end = ta.selectionEnd ?? 0
    const current = lines[index] ?? ""

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      const before = current.slice(0, start)
      const after = current.slice(end)
      const next = [...lines]
      next[index] = before
      next.splice(index + 1, 0, after)
      commit(next)
      setActiveIndex(index + 1)
      focusLine(index + 1, 0)
      return
    }

    if (e.key === "Backspace" && start === 0 && end === 0 && index > 0) {
      e.preventDefault()
      const prev = lines[index - 1] ?? ""
      const next = [...lines]
      next[index - 1] = prev + current
      next.splice(index, 1)
      commit(next)
      setActiveIndex(index - 1)
      focusLine(index - 1, prev.length)
    }
  }

  const nonEmptyCount = lines.filter((l) => l.trim().length > 0).length
  const charCount = lines.reduce((sum, l) => sum + l.trim().length, 0)

  const copyAllScript = useCallback(async () => {
    const text = lines
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .join("\n")
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current)
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard denied */
    }
  }, [lines])

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current)
    }
  }, [])

  return (
    <div className="v2sw-script-lines">
      <div className="v2sw-script-lines__head">
        <p className="v2sw-script-lines__hint">
          {nonEmptyCount}줄 · Enter로 커서 위치에서 줄 나누기 · 줄 맨 앞에서 Backspace로 위 줄과 합치기
        </p>
        <button
          type="button"
          className={"v2sw-script-lines__copy-btn" + (copied ? " v2sw-script-lines__copy-btn--done" : "")}
          disabled={charCount === 0}
          title="편집 중인 대본 전체를 클립보드에 복사"
          onClick={() => void copyAllScript()}
        >
          {copied ? "복사됨 ✓" : "대본 전체 복사"}
        </button>
      </div>
      <ol className="v2sw-script-lines__list">
        {lines.map((line, index) => {
          const active = activeIndex === index
          return (
            <li
              key={index}
              className={"v2sw-script-lines__item" + (active ? " v2sw-script-lines__item--on" : "")}
            >
              <span className="v2sw-script-lines__idx" aria-hidden>
                {index + 1}
              </span>
              <div className="v2sw-script-lines__body">
                <textarea
                  ref={(el) => {
                    inputRefs.current[index] = el
                  }}
                  className="v2sw-script-lines__input"
                  value={line}
                  rows={Math.min(4, Math.max(1, Math.ceil(line.length / 48)))}
                  spellCheck={false}
                  aria-label={`${index + 1}번째 줄`}
                  onFocus={() => setActiveIndex(index)}
                  onChange={(e) => updateLine(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                />
                <span className="v2sw-script-lines__len">{line.trim().length}자</span>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
