import type { CSSProperties } from "react"
import { DEFAULT_SUBTITLE_Y_PERCENT, type MvpSubtitleStyle } from "@/lib/mvp-studio-types"

export const MVP_SUBTITLE_FONT_OPTIONS = [
  { value: "pretendard-bold", label: "프리텐다드 Bold" },
  { value: "pretendard", label: "프리텐다드 Regular" },
  { value: "noto-kr", label: "Noto Sans KR" },
  { value: "system", label: "시스템 기본" },
] as const

export type MvpSubtitleFontId = (typeof MVP_SUBTITLE_FONT_OPTIONS)[number]["value"]

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim())
  if (!m) return { r: 0, g: 0, b: 0 }
  return { r: parseInt(m[1]!, 16), g: parseInt(m[2]!, 16), b: parseInt(m[3]!, 16) }
}

export function resolveSubtitleFontFamily(fontId: string): string {
  if (fontId === "pretendard-bold" || fontId === "pretendard") {
    return '"Pretendard","Noto Sans KR",system-ui,sans-serif'
  }
  if (fontId === "noto-kr") return '"Noto Sans KR",sans-serif'
  return 'system-ui,-apple-system,"Segoe UI",sans-serif'
}

export function resolveSubtitleFontWeight(style: MvpSubtitleStyle): number {
  if (style.fontWeight === "extrabold") return 800
  if (style.fontWeight === "bold") return 700
  if (style.fontId === "pretendard-bold") return 700
  return 400
}

/** 영상 미리보기 자막 오버레이 CSS */
export function buildSubtitleOverlayStyle(style: MvpSubtitleStyle): CSSProperties {
  const x = style.x ?? 50
  const y = style.y ?? DEFAULT_SUBTITLE_Y_PERCENT
  const outlineW = style.outlineWidthPx ?? 1
  const bgOpacity = (style.bgOpacity ?? 55) / 100

  let backgroundColor: string | undefined
  if (style.bgOn) {
    const { r, g, b } = hexToRgb(style.bgColor ?? "#000000")
    backgroundColor = `rgba(${r},${g},${b},${bgOpacity})`
  }

  return {
    position: "absolute",
    left: `${x}%`,
    top: `${y}%`,
    transform: "translate(-50%, -50%)",
    width: "92%",
    maxWidth: "92%",
    minWidth: 0,
    textAlign: style.textAlign ?? "center",
    fontFamily: resolveSubtitleFontFamily(style.fontId ?? "pretendard-bold"),
    fontSize: style.sizePx,
    fontWeight: resolveSubtitleFontWeight(style),
    color: style.color,
    lineHeight: 1.35,
    whiteSpace: "nowrap",
    wordBreak: "keep-all",
    overflowWrap: "normal",
    WebkitTextStroke: style.outlineOn ? `${outlineW}px ${style.outlineColor ?? "#000000"}` : undefined,
    paintOrder: style.outlineOn ? "stroke fill" : undefined,
    textShadow: style.textShadow ? "2px 2px 6px rgba(0,0,0,0.85)" : undefined,
    backgroundColor,
    borderRadius: style.bgOn ? 6 : undefined,
    padding: style.bgOn ? "6px 10px" : undefined,
    pointerEvents: "none",
    zIndex: 10,
  }
}
