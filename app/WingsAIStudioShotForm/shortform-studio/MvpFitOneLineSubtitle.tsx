"use client"

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import {
  MVP_SUBTITLE_ENTRANCE_SEC,
  subtitleEntranceKeyframes,
  type MvpSubtitleEntrance,
} from "@/lib/mvp-subtitle-entrance"

type Props = {
  /** buildSubtitleOverlayStyle(...) 결과 */
  style: CSSProperties
  children: ReactNode
  /** 문구가 바뀔 때 등장 효과 */
  entrance?: MvpSubtitleEntrance
}

/**
 * 자막을 한 줄로 유지하고, 스테이지 가로 92%를 넘으면 비율만 줄여 화면 밖으로 나가지 않게 합니다.
 */
export function MvpFitOneLineSubtitle({ style, children, entrance }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(1)

  useEffect(() => {
    const el = ref.current
    // 측정(useLayoutEffect)이 먼저 돌며 el.style.transform에 위치·맞춤 축소를 써 둠
    const frames = subtitleEntranceKeyframes(entrance, el?.style.transform ?? "")
    if (!frames || !el?.animate) return
    const anim = el.animate(frames, { duration: MVP_SUBTITLE_ENTRANCE_SEC * 1000, fill: "none" })
    return () => anim.cancel()
  }, [children, entrance])

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
