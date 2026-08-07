"use client"

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"

type Props = {
  /** buildSubtitleOverlayStyle(...) 결과 */
  style: CSSProperties
  children: ReactNode
}

/**
 * 자막을 한 줄로 유지하고, 스테이지 가로 92%를 넘으면 비율만 줄여 화면 밖으로 나가지 않게 합니다.
 */
export function MvpFitOneLineSubtitle({ style, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(1)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const measure = () => {
      const parent = el.offsetParent as HTMLElement | null
      const limit = Math.max(1, (parent?.clientWidth ?? el.clientWidth) * 0.92)
      // scale(1) 기준으로 측정
      el.style.transform = "translate(-50%, -50%) scale(1)"
      const natural = el.scrollWidth
      const next = natural > limit ? Math.max(0.55, limit / natural) : 1
      setFit(next)
      el.style.transform = `translate(-50%, -50%) scale(${next})`
    }

    measure()
    const parent = el.offsetParent
    if (!parent || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(measure)
    ro.observe(parent)
    return () => ro.disconnect()
  }, [children, style.fontSize, style.fontFamily, style.fontWeight, style.padding])

  return (
    <div
      ref={ref}
      style={{
        ...style,
        maxWidth: "none",
        overflow: "visible",
        transform: `translate(-50%, -50%) scale(${fit})`,
        transformOrigin: "center center",
      }}
    >
      {children}
    </div>
  )
}
