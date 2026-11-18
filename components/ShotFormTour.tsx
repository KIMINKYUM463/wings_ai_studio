"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { X } from "lucide-react"

/** 처음 들어온 분께 숏폼 메인 화면 구성을 한 칸씩 짚어 주는 안내. [다시 보지 않기]를 누르면 이 브라우저에서는 다시 안 뜬다. */
const HIDE_KEY = "shotform_tour_hidden"

type Step = { target?: string; title: string; body: string }

const STEPS: Step[] = [
  { title: "숏폼 스튜디오에 오신 걸 환영해요", body: "처음 오셨다면 화면 구성을 30초만 같이 둘러볼게요." },
  { target: "settings", title: "먼저 API 키 넣기", body: "톱니바퀴(설정)에서 Gemini · YouTube · TikHub 키를 넣어야 영상 만들기를 시작할 수 있어요." },
  { target: "api-guide", title: "키 발급이 처음이라면", body: "이 버튼을 누르면 키 만드는 방법을 영상으로 보여드려요." },
  { target: "guide-video", title: "사용법 가이드", body: "기능별 사용법을 정리한 가이드 영상 모음이에요." },
  { target: "section-0", title: "쇼핑숏폼 제작", body: "상품 링크나 참고 쇼츠로 15초 쇼핑 쇼츠를 만드는 메인 기능이에요. 카드를 눌러 시작하세요." },
  { target: "section-1", title: "일반 숏폼", body: "대본만 넣으면 목소리와 자막(SRT)을 바로 받을 수 있는 도구예요." },
  { target: "section-2", title: "분석 & 도구", body: "내 채널 진단, 1:1 AI 상담 같은 보조 도구예요." },
]

const find = (t?: string) => (t ? (document.querySelector(`[data-tour="${t}"]`) as HTMLElement | null) : null)
const visible = (el: HTMLElement | null) => !!el && el.getClientRects().length > 0 && el.offsetWidth > 0

export default function ShotFormTour() {
  const [steps, setSteps] = useState<Step[] | null>(null)
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [cardH, setCardH] = useState(180)

  useEffect(() => {
    let hidden = false
    try { hidden = localStorage.getItem(HIDE_KEY) === "1" } catch { /* 저장소를 못 쓰면 매번 보여 줌 */ }
    if (hidden) return
    // 화면이 다 그려진 뒤, 지금 보이는 칸만 골라서 시작 (모바일에서 숨은 버튼은 건너뜀)
    const t = setTimeout(() => setSteps(STEPS.filter((s) => !s.target || visible(find(s.target)))), 600)
    return () => clearTimeout(t)
  }, [])

  const step = steps?.[i]
  const measure = useCallback(() => {
    const el = find(step?.target)
    setRect(el ? el.getBoundingClientRect() : null)
  }, [step])

  useEffect(() => {
    if (!step) return
    const el = find(step.target)
    if (el) el.scrollIntoView({ block: el.offsetHeight > window.innerHeight * 0.6 ? "start" : "center", behavior: "smooth" })
    measure()
    const t = setTimeout(measure, 450) // 부드러운 스크롤이 끝난 뒤 다시 잼
    window.addEventListener("resize", measure)
    window.addEventListener("scroll", measure, true)
    return () => { clearTimeout(t); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true) }
  }, [step, measure])

  useLayoutEffect(() => { if (cardRef.current) setCardH(cardRef.current.offsetHeight) }, [step, rect])
  useEffect(() => { cardRef.current?.focus() }, [step])

  const close = useCallback((forever: boolean) => {
    if (forever) { try { localStorage.setItem(HIDE_KEY, "1") } catch { /* 무시 */ } }
    setSteps(null)
  }, [])
  const next = useCallback(() => { if (!steps) return; if (i < steps.length - 1) setI(i + 1); else close(false) }, [i, steps, close])
  const prev = useCallback(() => setI((v) => Math.max(0, v - 1)), [])

  useEffect(() => {
    if (!steps) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false)
      else if (e.key === "ArrowRight" || e.key === "Enter") next()
      else if (e.key === "ArrowLeft") prev()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [steps, next, prev, close])

  if (!steps || !step) return null

  const vw = typeof window !== "undefined" ? window.innerWidth : 1200
  const vh = typeof window !== "undefined" ? window.innerHeight : 800
  const PAD = 8
  // 강조 상자: 화면 밖으로 넘치는 부분은 잘라서 보여 줌
  const hole = rect && {
    left: Math.max(4, rect.left - PAD),
    top: Math.max(4, rect.top - PAD),
    right: Math.min(vw - 4, rect.right + PAD),
    bottom: Math.min(vh - 4, rect.bottom + PAD),
  }
  const cardW = Math.min(360, vw - 32)
  let cardStyle: React.CSSProperties
  if (!hole) {
    cardStyle = { left: (vw - cardW) / 2, top: Math.max(16, (vh - cardH) / 2) }
  } else {
    const left = Math.min(Math.max(16, (hole.left + hole.right) / 2 - cardW / 2), vw - cardW - 16)
    if (hole.bottom + 12 + cardH < vh - 16) cardStyle = { left, top: hole.bottom + 12 }
    else if (hole.top - 12 - cardH > 16) cardStyle = { left, top: hole.top - 12 - cardH }
    else cardStyle = { left, top: vh - cardH - 16 } // 강조 칸이 화면을 거의 채우면 아래쪽에 겹쳐 띄움
  }

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-labelledby="shotform-tour-title">
      {/* 바깥을 눌러도 아래 화면이 눌리지 않게 막는 층 */}
      <div className="absolute inset-0" />
      {hole ? (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-[#fff] transition-all duration-300 motion-reduce:transition-none"
          style={{ left: hole.left, top: hole.top, width: hole.right - hole.left, height: hole.bottom - hole.top, boxShadow: "0 0 0 9999px rgba(15,23,42,0.58)" }}
        />
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-[rgba(15,23,42,0.58)]" />
      )}
      <div
        ref={cardRef}
        tabIndex={-1}
        className="absolute rounded-2xl border border-[#e5e9f0] bg-[#fff] p-5 text-[#111827] shadow-[0_18px_50px_rgba(15,23,42,0.25)] outline-none transition-[top,left] duration-300 motion-reduce:transition-none"
        style={{ width: cardW, ...cardStyle }}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-[12px] font-semibold tabular-nums text-[#2c5fd6]">{i + 1} / {steps.length}</p>
          <button type="button" onClick={() => close(false)} className="-m-1 rounded-md p-1 text-[#6b7280] hover:bg-[#f1f4f9] hover:text-[#111827]" aria-label="안내 닫기">
            <X className="h-4 w-4" />
          </button>
        </div>
        <h2 id="shotform-tour-title" className="mt-1 text-[17px] font-bold tracking-[-0.02em]">{step.title}</h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-[#4b5563]">{step.body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" onClick={() => close(true)} className="text-[13px] font-medium text-[#6b7280] underline-offset-2 hover:text-[#111827] hover:underline">
            다시 보지 않기
          </button>
          <div className="flex gap-2">
            {i > 0 && (
              <button type="button" onClick={prev} className="rounded-lg border border-[#e1e6ee] px-3 py-1.5 text-[13px] font-medium text-[#374151] hover:bg-[#f7f9fc]">
                이전
              </button>
            )}
            <button type="button" onClick={next} className="rounded-lg bg-[#14213d] px-3.5 py-1.5 text-[13px] font-semibold text-[#fff] hover:bg-[#1f2f55]">
              {i < steps.length - 1 ? "다음" : "시작하기"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
