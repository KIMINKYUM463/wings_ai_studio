"use client"

import type { InfoSlide, InfoThemeId } from "./info-types"
import { INFO_THEME_ACCENT, INFO_THEME_BG } from "./InfoThemePreview"

/** 화면 원형 번호와 겹치지 않게 텍스트 앞 숫자 제거 */
export function stripInfoLineNumber(text: string): string {
  return String(text || "")
    .replace(/^[0-9０-９❶❷❸❹❺①②③④⑤]+[.、.)）:\s]+/u, "")
    .replace(/^[0-9０-９]+번[.、.\s]*/u, "")
    .trim()
}

/** 재생 시 한 줄씩 쌓이는 본문(번호 팁) — 훅·제목은 항상 표시라 여기 포함 안 함 */
export function getInfoSlideDisplayLines(slide: InfoSlide): string[] {
  const lines = slide.lines
    .map((line) => stripInfoLineNumber(line.text || ""))
    .filter(Boolean)
  if (lines.length === 0 && slide.narration?.trim()) {
    return slide.narration
      .replace(/\s+/g, " ")
      .replace(/([.!?。！？])/g, "$1|||")
      .split("|||")
      .map((part) => stripInfoLineNumber(part))
      .filter(Boolean)
      .slice(0, 6)
  }
  return lines
}

function highlightText(text: string, highlights?: string[], accent = "#e879a9") {
  if (!highlights?.length) return text
  let remaining = text
  const parts: Array<{ text: string; highlight: boolean }> = []
  for (const highlight of highlights) {
    const index = remaining.indexOf(highlight)
    if (index < 0) continue
    if (index > 0) parts.push({ text: remaining.slice(0, index), highlight: false })
    parts.push({ text: highlight, highlight: true })
    remaining = remaining.slice(index + highlight.length)
  }
  if (remaining) parts.push({ text: remaining, highlight: false })
  if (!parts.length) return text
  return parts.map((part, index) =>
    part.highlight ? (
      <span key={`${part.text}-${index}`} style={{ color: accent }}>
        {part.text}
      </span>
    ) : (
      <span key={`${part.text}-${index}`}>{part.text}</span>
    )
  )
}

/**
 * TTS용 문장 — 본문만, 연결어미(~데/~고)는 마침표 없이 빠르게 이어지게
 */
export function getInfoSlideTtsLines(slide: InfoSlide): string[] {
  const body = slide.lines
    .map((l) => stripInfoLineNumber(l.text || ""))
    .filter(Boolean)
  if (body.length === 0 && slide.narration?.trim()) {
    return getInfoSlideDisplayLines(slide)
  }
  return body.map((clean, index) => {
    const isLast = index === body.length - 1
    // 연결형: 「어질러지는데 / 부족하고」→ 마침표 없이
    if (!isLast && /(?:는데|한데|하고|지만|며|서|고)$/.test(clean)) {
      return clean
    }
    if (isLast) {
      return /[.。?？!！]$/.test(clean) ? clean : `${clean}.`
    }
    // 중간 줄도 끊김을 줄이기 위해 가벼운 쉼
    return /[.。?？!！]$/.test(clean) ? clean.replace(/[.。]$/, ",") : `${clean},`
  })
}

/** 본문만 이어 붙인 나레이션 (TTS와 동일) */
export function buildInfoSlideNarration(slide: Pick<InfoSlide, "hook" | "title" | "lines">): string {
  return getInfoSlideTtsLines({
    id: "tmp",
    order: 0,
    type: "tip",
    title: slide.title || "",
    hook: slide.hook,
    lines: slide.lines,
    narration: "",
    durationSec: 4,
  }).join(" ")
}

/**
 * 팁 개수에 따른 제품 컷 높이(%) — 팁이 많을수록 이미지를 줄여 본문이 보이게
 * (가로는 세로 비율(3:4)로 맞춰서 가로 띠처럼 보이지 않게 함)
 */
export function infoCardImageHeightPct(tipCount: number): number {
  const n = Math.max(0, tipCount)
  if (n <= 1) return 52
  if (n === 2) return 48
  if (n === 3) return 44
  return 38
}

/** 제품 컷 가로:세로 — 숏폼용 세로(포트레이트) */
export function infoCardImageAspect(tipCount: number): number {
  // width / height — 팁 4개 이상이면 조금 더 넓게(4:5), 기본 3:4
  return tipCount >= 4 ? 4 / 5 : 3 / 4
}

/**
 * 정보형 카드뉴스 프레임
 * - 훅·제목은 항상 표시 (TTS 미포함)
 * - 본문만 TTS에 맞춰 한 줄씩 등장
 */
export function InfoCardFrame({
  slide,
  themeId = "news",
  slideIndex = 0,
  slideCount = 1,
  revealLineCount = null,
  className = "max-w-[360px]",
  /** 내보내기 캡처용 — 켄번즈·라운드 제거해 미리보기와 동일 레이아웃을 고정 해상도로 찍음 */
  captureMode = false,
}: {
  slide: InfoSlide
  themeId?: InfoThemeId
  slideIndex?: number
  slideCount?: number
  revealLineCount?: number | null
  className?: string
  captureMode?: boolean
}) {
  const accent = INFO_THEME_ACCENT[themeId] || INFO_THEME_ACCENT.news
  const bg = INFO_THEME_BG[themeId] || INFO_THEME_BG.news
  const darkCard = themeId === "charcoal"
  const cardBg = darkCard ? "#18181b" : "#ffffff"
  const titleColor = darkCard ? "#fafafa" : "#111111"
  const bodyColor = darkCard ? "#e4e4e7" : "#27272a"
  const mutedColor = darkCard ? "#a1a1aa" : "#71717a"
  const highlightAccent = darkCard ? "#f9a8d4" : "#e879a9"

  const hook = slide.hook?.trim() || ""
  const title = slide.title?.trim() || ""
  const bodyLines = slide.lines.filter((l) => l.text?.trim())

  // revealLineCount = 본문만 (훅·제목은 항상 표시)
  const bodyVisible =
    revealLineCount == null ? bodyLines.length : Math.max(0, Math.min(bodyLines.length, revealLineCount))
  const visibleBody = bodyLines.slice(0, bodyVisible)

  const imageUrl = slide.imageUrl?.trim() || ""
  const progress = slideCount > 0 ? (slideIndex + 1) / slideCount : 0
  const tipCount = bodyLines.length
  const imageAspect = infoCardImageAspect(tipCount)
  const tipGap = tipCount >= 4 ? "1.4cqw" : tipCount >= 3 ? "1.8cqw" : "2.2cqw"
  const tipFont = tipCount >= 4 ? "3.2cqw" : "3.8cqw"
  const titleFont = tipCount >= 4 ? "4.8cqw" : "5.6cqw"

  return (
    <div
      className={`relative mx-auto aspect-[9/16] w-full overflow-hidden border border-black/20 shadow-2xl ${
        captureMode ? "rounded-none" : "rounded-2xl"
      } ${className}`}
      style={{ background: bg, containerType: "inline-size" }}
      data-info-card-capture={captureMode ? "1" : undefined}
    >
      {/* 장식 원 */}
      <div
        className="pointer-events-none absolute -right-[8%] -top-[4%] h-[28%] w-[40%] rounded-full opacity-40 blur-2xl"
        style={{ background: accent }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-[6%] -left-[10%] h-[24%] w-[36%] rounded-full opacity-30 blur-2xl"
        style={{ background: accent }}
        aria-hidden
      />

      {/* 종이 카드 */}
      <div
        className="absolute inset-[4.5%] flex flex-col overflow-hidden rounded-[4.2cqw] shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
        style={{ background: cardBg }}
      >
        {/* 상단 컬러 바 */}
        <div className="h-[1.1cqw] w-full shrink-0" style={{ background: accent }} />

        <div className="flex min-h-0 flex-1 flex-col px-[6.5%] pb-[4%] pt-[5%]">
          {/* 훅 · 제목 — 항상 표시, TTS 미포함 */}
          <div className="mb-[3%] min-h-0 space-y-[1.6cqw]">
            {hook ? (
              <p
                className="break-keep font-extrabold leading-snug"
                style={{ fontSize: "3.6cqw", color: highlightAccent }}
              >
                {hook}
              </p>
            ) : null}
            {title ? (
              <h3
                className="break-keep font-black leading-[1.28] tracking-tight"
                style={{ fontSize: titleFont, color: titleColor }}
              >
                {title}
              </h3>
            ) : null}
          </div>

          {/* 번호 리스트 — TTS에 맞춰 한 줄씩 */}
          <div
            className="mb-[2%] shrink-0 overflow-hidden"
            style={{ display: "flex", flexDirection: "column", gap: tipGap }}
          >
            {visibleBody.map((line, index) => (
              <div
                key={`${slide.id}-body-${index}`}
                className="flex items-start gap-[2.4cqw] transition-all duration-300"
              >
                <span
                  className="mt-[0.3cqw] flex h-[4.8cqw] w-[4.8cqw] shrink-0 items-center justify-center rounded-full font-black text-white"
                  style={{ fontSize: "2.4cqw", background: accent }}
                >
                  {index + 1}
                </span>
                <p
                  className="min-w-0 flex-1 break-keep font-bold leading-[1.35]"
                  style={{ fontSize: tipFont, color: bodyColor }}
                >
                  {highlightText(
                    stripInfoLineNumber(line.text),
                    line.highlights,
                    highlightAccent
                  )}
                </p>
              </div>
            ))}
          </div>

          {/* 제품 컷 — 남은 공간을 세로(3:4)로 채움 (가로 띠 방지) */}
          <div className="relative flex min-h-0 flex-1 items-end justify-center">
            <div
              className="relative h-full max-h-full overflow-hidden rounded-[3cqw] border"
              style={{
                aspectRatio: String(imageAspect),
                width: "auto",
                maxWidth: "100%",
                borderColor: darkCard ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
                background: darkCard ? "#27272a" : "#f4f4f5",
              }}
            >
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${slide.id}-${imageUrl}`}
                  src={imageUrl}
                  alt=""
                  crossOrigin={
                    captureMode && /^https?:\/\//i.test(imageUrl) ? "anonymous" : undefined
                  }
                  className={`h-full w-full object-cover object-center ${
                    captureMode ? "" : "info-card-kenburns"
                  }`}
                />
              ) : (
                <div
                  className="flex h-full flex-col items-center justify-center gap-1"
                  style={{ color: mutedColor }}
                >
                  <span className="font-black" style={{ fontSize: "4cqw" }}>
                    제품 컷
                  </span>
                  <span className="font-medium" style={{ fontSize: "2.4cqw" }}>
                    AI 생성 · 업로드
                  </span>
                </div>
              )}
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-t from-black/35 to-transparent"
                aria-hidden
              />
            </div>
          </div>
        </div>

        {/* 하단 진행 */}
        <div className="mx-[6.5%] mb-[3.5%] h-[0.9cqw] overflow-hidden rounded-full bg-black/10">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.max(10, progress * 100)}%`,
              background: accent,
            }}
          />
        </div>
      </div>
    </div>
  )
}
