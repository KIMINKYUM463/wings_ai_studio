import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

// light-remap 이 팔레트 유틸(zinc/white/amber…)을 뒤집는 라우트라 hex 임의값만 사용
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f3beb] focus-visible:ring-offset-2"
const BTN = `rounded-[12px] font-semibold motion-safe:transition-colors disabled:opacity-100 ${FOCUS}`

export const P = {
  focus: FOCUS,
  card: "rounded-[20px] border border-[#e3e6ec] bg-[#ffffff] shadow-[0_1px_2px_rgba(14,16,22,0.04),0_18px_40px_-32px_rgba(14,16,22,0.22)]",
  soft: "rounded-[16px] border border-[#eceef3] bg-[#f8f9fb]",
  title: "text-[14px] font-bold text-[#0e1016]",
  label: "text-[12px] font-semibold text-[#5c6170]",
  muted: "text-[12px] leading-relaxed text-[#5c6170]",
  faint: "text-[12px] text-[#9aa0ad]",
  /** 영역당 하나뿐인 주 행동 */
  primary: `${BTN} bg-[#0e1016] text-[#ffffff] hover:bg-[#262a36] disabled:bg-[#c9cdd6] disabled:text-[#ffffff]`,
  accent: `${BTN} bg-[#2f3beb] text-[#ffffff] hover:bg-[#4350ff] disabled:bg-[#c9cdd6] disabled:text-[#ffffff]`,
  outline: `${BTN} border border-[#e3e6ec] bg-[#ffffff] text-[#0e1016] hover:bg-[#f5f6fa] hover:text-[#0e1016] disabled:bg-[#ffffff] disabled:text-[#b4b9c4]`,
  ghost: `${BTN} bg-transparent text-[#5c6170] hover:bg-[#f0f1f5] hover:text-[#0e1016] disabled:bg-transparent disabled:text-[#b4b9c4]`,
  danger: `${BTN} bg-transparent text-[#c62828] hover:bg-[#fff1f1] hover:text-[#b71c1c] disabled:bg-transparent disabled:text-[#d9a3a3]`,
  headerBack: `h-10 rounded-full border border-[#e3e6ec] bg-[#ffffff] px-4 text-[#0e1016] hover:bg-[#f5f6fa] hover:text-[#0e1016] ${FOCUS}`,
  headerNext: `h-10 rounded-full bg-[#0e1016] px-5 font-semibold text-[#ffffff] hover:bg-[#262a36] disabled:bg-[#c9cdd6] disabled:opacity-100 ${FOCUS}`,
  select: `h-10 rounded-[10px] border-[#e3e6ec] bg-[#ffffff] text-[14px] text-[#0e1016] ${FOCUS}`,
  input:
    "h-10 rounded-[10px] border-[#e3e6ec] bg-[#ffffff] text-[13px] !text-[#0e1016] placeholder:text-[#9aa0ad] focus-visible:border-[#2f3beb] focus-visible:ring-[#2f3beb]/20",
  /** 장면 칩/카드: 선택 시 액센트 링 */
  chip: (active: boolean) =>
    cn(
      "rounded-[16px] border bg-[#ffffff] text-left motion-safe:transition",
      FOCUS,
      active
        ? "border-[#2f3beb] ring-2 ring-[#2f3beb]/25"
        : "border-[#e3e6ec] hover:border-[#c9cdd6] hover:bg-[#fafbfc]"
    ),
  summary: `flex cursor-pointer list-none items-center justify-between gap-2 rounded-[12px] px-1 py-1 text-[13px] font-semibold text-[#0e1016] [&::-webkit-details-marker]:hidden ${FOCUS}`,
}

/** 9:16 휴대폰 프레임 (children 은 화면 안을 absolute 로 채움) */
export function PhoneFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "light-keep mx-auto w-full max-w-[260px] rounded-[2.6rem] bg-[#16181d] p-[10px] shadow-[0_2px_4px_rgba(14,16,22,0.12),0_30px_50px_-24px_rgba(14,16,22,0.5)]",
        className
      )}
    >
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[1.6rem] bg-[#0b0c10]">
        {children}
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-2 z-30 h-[18px] w-[70px] -translate-x-1/2 rounded-full bg-[#000000]"
        />
      </div>
    </div>
  )
}

/** 상태 점 + 문구 */
export function StatusDot({ tone, children }: { tone: "done" | "wait" | "busy" | "none"; children: ReactNode }) {
  const color = { done: "bg-[#12a26b]", wait: "bg-[#c9cdd6]", busy: "bg-[#2f3beb]", none: "bg-[#e3e6ec]" }[tone]
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-[#5c6170]">
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", color)} />
      {children}
    </span>
  )
}
