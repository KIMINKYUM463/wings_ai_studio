"use client"

import type { InfoThemeId } from "./info-types"

export const INFO_THEME_ACCENT: Record<InfoThemeId, string> = {
  gray: "#3f3f46",
  blue: "#2563eb",
  news: "#ca8a04",
  mint: "#0d9488",
  coral: "#e11d48",
  cream: "#b45309",
  charcoal: "#a1a1aa",
  rose: "#db2777",
  lime: "#65a30d",
}

/** 바깥 배경(카드 뒤) — 테마별 강한 컬러로 카드뉴스 톤 */
export const INFO_THEME_BG: Record<InfoThemeId, string> = {
  gray: "linear-gradient(165deg,#e4e4e7 0%,#fafafa 55%,#d4d4d8 100%)",
  blue: "linear-gradient(165deg,#1d4ed8 0%,#3b82f6 45%,#93c5fd 100%)",
  news: "linear-gradient(165deg,#facc15 0%,#fde047 40%,#fef9c3 100%)",
  mint: "linear-gradient(165deg,#0f766e 0%,#2dd4bf 50%,#ccfbf1 100%)",
  coral: "linear-gradient(165deg,#e11d48 0%,#fb7185 45%,#ffe4e6 100%)",
  cream: "linear-gradient(165deg,#d6a45a 0%,#f5e6c8 50%,#fffbeb 100%)",
  charcoal: "linear-gradient(165deg,#18181b 0%,#3f3f46 50%,#71717a 100%)",
  rose: "linear-gradient(165deg,#be185d 0%,#f472b6 45%,#fce7f3 100%)",
  lime: "linear-gradient(165deg,#4d7c0f 0%,#a3e635 50%,#ecfccb 100%)",
}

/** 템플릿 선택용 미니 미리보기 — 실제 카드뉴스 구조 */
export function InfoThemePreview({
  themeId,
  compact = false,
}: {
  themeId: InfoThemeId
  compact?: boolean
}) {
  const accent = INFO_THEME_ACCENT[themeId] || INFO_THEME_ACCENT.news
  const bg = INFO_THEME_BG[themeId] || INFO_THEME_BG.news
  const darkCard = themeId === "charcoal"
  const cardBg = darkCard ? "#18181b" : "#fff"
  const titleColor = darkCard ? "#fafafa" : "#111"

  if (compact) {
    return (
      <div
        className="relative aspect-[9/16] w-full overflow-hidden rounded-lg border border-black/20 shadow-sm"
        style={{ background: bg }}
      >
        <div
          className="absolute inset-[7%] flex flex-col overflow-hidden rounded-md shadow-md"
          style={{ background: cardBg }}
        >
          <div className="h-[3px] w-full" style={{ background: accent }} />
          <div className="flex flex-1 flex-col px-1.5 py-1.5">
            <span
              className="mb-1 w-fit rounded-full px-1 py-0.5 text-[4px] font-black text-white"
              style={{ background: accent }}
            >
              TIP
            </span>
            <p className="text-[5px] font-black leading-tight" style={{ color: titleColor }}>
              욕실 정리 꿀팁
            </p>
            <div className="mt-1 space-y-0.5">
              <div className="flex items-center gap-0.5">
                <span
                  className="flex h-1.5 w-1.5 items-center justify-center rounded-full text-[3px] text-white"
                  style={{ background: accent }}
                >
                  1
                </span>
                <span className="text-[4px] font-bold text-zinc-600">자석으로 고정</span>
              </div>
              <div className="flex items-center gap-0.5">
                <span
                  className="flex h-1.5 w-1.5 items-center justify-center rounded-full text-[3px] text-white"
                  style={{ background: accent }}
                >
                  2
                </span>
                <span className="text-[4px] font-bold text-zinc-600">공간 절약</span>
              </div>
            </div>
            <div className="mt-auto h-[28%] rounded-sm bg-zinc-200" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative mx-auto aspect-[9/16] w-full max-w-[220px] overflow-hidden rounded-2xl border border-black/25 shadow-xl"
      style={{ background: bg }}
    >
      <div
        className="absolute inset-[5%] flex flex-col overflow-hidden rounded-xl shadow-lg"
        style={{ background: cardBg }}
      >
        <div className="h-1 w-full" style={{ background: accent }} />
        <div className="flex flex-1 flex-col px-3 py-3">
          <div className="mb-2">
            <p className="mb-1 text-[10px] font-extrabold text-pink-400">알고 사면</p>
            <p className="mb-2 text-sm font-black leading-snug" style={{ color: titleColor }}>
              욕실 정리에 딱!
              <br />
              초강력 마그네틱
            </p>
          </div>
          <div className="mb-2 space-y-1.5">
            {["자석으로 바로 고정", "공간 낭비 ZERO", "물기에도 끄떡없어요"].map((t, i) => (
              <div key={t} className="flex items-start gap-1.5">
                <span
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-black text-white"
                  style={{ background: accent }}
                >
                  {i + 1}
                </span>
                <span className="text-[11px] font-bold leading-snug text-zinc-700">{t}</span>
              </div>
            ))}
          </div>
          <div className="mx-auto mt-auto aspect-[3/4] h-[38%] overflow-hidden rounded-lg bg-gradient-to-br from-zinc-200 to-zinc-300">
            <div className="flex h-full items-center justify-center text-[10px] font-black text-zinc-500">
              제품 컷
            </div>
          </div>
        </div>
        <div className="mx-3 mb-2.5 h-1 overflow-hidden rounded-full bg-black/10">
          <div className="h-full w-1/4 rounded-full" style={{ background: accent }} />
        </div>
      </div>
    </div>
  )
}
