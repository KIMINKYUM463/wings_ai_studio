import type { CSSProperties } from "react"
import { DEFAULT_SUBTITLE_Y_PERCENT, type MvpSubtitleStyle } from "@/lib/mvp-studio-types"
import { MVP_PREVIEW_STAGE_WIDTH_PX } from "@/lib/mvp-mosaic-overlay-utils"

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

/**
 * 미리보기 자막 오버레이 CSS.
 * @param stageScale 미리보기 가로 / 설계 기준(280px). 렌더(1080)와 체감 크기를 맞춥니다.
 */
export function buildSubtitleOverlayStyle(
  style: MvpSubtitleStyle,
  stageScale = 1
): CSSProperties {
  const scale = Number.isFinite(stageScale) && stageScale > 0 ? stageScale : 1
  const x = style.x ?? 50
  const y = style.y ?? DEFAULT_SUBTITLE_Y_PERCENT
  const outlineW = (style.outlineWidthPx ?? 1) * scale
  const bgOpacity = (style.bgOpacity ?? 55) / 100
  const fontSize = style.sizePx * scale

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
    // 한 줄만 표시 — 의미 단위 큐로 짧게 쪼개고, FitOneLineSubtitle이 넘치면 scale로 맞춤
    width: "max-content",
    maxWidth: "92%",
    minWidth: 0,
    boxSizing: "border-box",
    textAlign: style.textAlign ?? "center",
    fontFamily: resolveSubtitleFontFamily(style.fontId ?? "pretendard-bold"),
    fontSize,
    fontWeight: resolveSubtitleFontWeight(style),
    color: style.color,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
    overflow: "visible",
    WebkitTextStroke: style.outlineOn ? `${outlineW}px ${style.outlineColor ?? "#000000"}` : undefined,
    paintOrder: style.outlineOn ? "stroke fill" : undefined,
    textShadow: style.textShadow
      ? `${2 * scale}px ${2 * scale}px ${6 * scale}px rgba(0,0,0,0.85)`
      : undefined,
    backgroundColor,
    borderRadius: style.bgOn ? 6 * scale : undefined,
    // 외곽선이 배경 밖으로 삐져나오지 않도록 패딩에 반영
    padding: style.bgOn
      ? `${6 * scale + outlineW}px ${12 * scale + outlineW * 2}px`
      : undefined,
    pointerEvents: "none",
    zIndex: 10,
  }
}

/** 미리보기 스테이지 가로 대비 설계 기준 스케일 */
export function subtitleStageScale(stageWidthPx: number): number {
  if (!Number.isFinite(stageWidthPx) || stageWidthPx <= 0) return 1
  return stageWidthPx / MVP_PREVIEW_STAGE_WIDTH_PX
}
