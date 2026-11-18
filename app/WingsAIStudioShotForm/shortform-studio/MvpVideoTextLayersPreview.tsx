"use client"

import type { MvpScriptStyleState } from "@/lib/mvp-studio-types"
import {
  MVP_AD_LABEL_TEXT,
  adLabelStyle,
  headcopyBlockStyle,
  headcopyLineColor,
  normalizeVideoTextLayers,
  resolveHeadcopyLines,
  watermarkStyle,
} from "@/lib/mvp-video-text-layers"

type Props = {
  scriptStyle: MvpScriptStyleState
  stageScale: number
}

/** 미리보기 위 헤드카피·워터마크·[광고] — MP4 렌더는 `drawMvpVideoTextLayers` */
export function MvpVideoTextLayersPreview({ scriptStyle, stageScale }: Props) {
  const layers = normalizeVideoTextLayers(scriptStyle.videoText)
  const lines = resolveHeadcopyLines(scriptStyle)
  const watermark = layers.watermarkText.trim()
  return (
    <>
      {lines.length ? (
        <div style={headcopyBlockStyle(layers, stageScale)}>
          {lines.map((line, index) => (
            <div key={index} style={{ color: headcopyLineColor(layers, index) }}>
              {line}
            </div>
          ))}
        </div>
      ) : null}
      {watermark ? <div style={watermarkStyle(stageScale)}>{watermark}</div> : null}
      {layers.adLabelOn ? <div style={adLabelStyle(stageScale)}>{MVP_AD_LABEL_TEXT}</div> : null}
    </>
  )
}
