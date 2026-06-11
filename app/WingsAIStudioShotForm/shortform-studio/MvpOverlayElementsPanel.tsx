"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { MVP_OVERLAY_COLOR_PRESETS } from "@/lib/mvp-overlay-utils"
import {
  STUDIO_OVERLAY_CATALOG,
  STUDIO_OVERLAY_CATEGORIES,
  type PlacedStudioOverlay,
  type StudioOverlayCategory,
} from "@/lib/shotform-studio-overlay-catalog"
import { studio } from "../components/ShotFormStudioUI"
import { StudioOverlayCatalogThumb, StudioOverlayGraphic } from "../shoppingshotform/StudioOverlayGraphic"

type Props = {
  overlays: PlacedStudioOverlay[]
  selectedId: string | null
  onOverlaysChange: (next: PlacedStudioOverlay[]) => void
  onSelectId: (id: string | null) => void
}

export function MvpOverlayElementsPanel({ overlays, selectedId, onOverlaysChange, onSelectId }: Props) {
  const [overlayCategory, setOverlayCategory] = useState<StudioOverlayCategory>("shapes")
  const [overlayPickColor, setOverlayPickColor] = useState("#ffffff")
  const overlayIdRef = useRef(0)

  const filteredCatalog = useMemo(
    () => STUDIO_OVERLAY_CATALOG.filter((e) => e.category === overlayCategory),
    [overlayCategory]
  )

  const selectedOverlay = useMemo(
    () => overlays.find((o) => o.id === selectedId) ?? null,
    [overlays, selectedId]
  )

  const updateOverlayById = useCallback(
    (id: string, patch: Partial<PlacedStudioOverlay>) => {
      onOverlaysChange(overlays.map((o) => (o.id === id ? { ...o, ...patch } : o)))
    },
    [onOverlaysChange, overlays]
  )

  const updateSelectedOverlay = useCallback(
    (patch: Partial<PlacedStudioOverlay>) => {
      if (!selectedId) return
      updateOverlayById(selectedId, patch)
    },
    [selectedId, updateOverlayById]
  )

  const addOverlayFromCatalog = useCallback(
    (catalogId: string) => {
      let max = overlayIdRef.current
      for (const o of overlays) {
        const m = /^ov-(\d+)$/.exec(o.id)
        if (m) max = Math.max(max, Number(m[1]))
      }
      max += 1
      overlayIdRef.current = max
      const id = `ov-${max}`
      const next: PlacedStudioOverlay = {
        id,
        catalogId,
        x: 50,
        y: 42,
        size: 48,
        color: overlayPickColor,
        rotation: 0,
      }
      onOverlaysChange([...overlays, next])
      onSelectId(id)
    },
    [overlayPickColor, onOverlaysChange, onSelectId, overlays]
  )

  const removeSelectedOverlay = useCallback(() => {
    if (!selectedId) return
    onOverlaysChange(overlays.filter((o) => o.id !== selectedId))
    onSelectId(null)
  }, [onOverlaysChange, onSelectId, overlays, selectedId])

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-white">도형 · 화살표 · 아이콘</p>
        <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
          아이콘을 누르면 미리보기 중앙에 추가됩니다. 드래그로 이동, ↻ 핸들로 회전하세요.
        </p>
      </div>

      <div>
        <Label className="text-[10px] text-slate-400">추가할 색상</Label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {MVP_OVERLAY_COLOR_PRESETS.map((c) => (
            <button
              key={`ov-${c}`}
              type="button"
              title={c}
              className={cn(
                "h-7 w-7 rounded-full border-2 transition-transform",
                overlayPickColor.toLowerCase() === c.toLowerCase() ? "scale-110 border-white" : "border-white/20"
              )}
              style={{ backgroundColor: c }}
              onClick={() => setOverlayPickColor(c)}
            />
          ))}
          <input
            type="color"
            value={overlayPickColor}
            onChange={(e) => setOverlayPickColor(e.target.value)}
            className="h-7 w-9 cursor-pointer rounded border border-white/10 bg-black/50"
            title="색 직접 선택"
          />
        </div>
      </div>

      <div>
        <Label className="text-[10px] text-slate-400">요소 모음</Label>
        <div className="mt-2 flex flex-wrap gap-1">
          {STUDIO_OVERLAY_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setOverlayCategory(cat.id)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-[10px] font-medium transition-colors",
                overlayCategory === cat.id
                  ? cn(studio.btnSegmentActive, "rounded-md")
                  : "border-white/10 text-slate-400 hover:border-white/20"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {filteredCatalog.map((entry) => (
            <button
              key={entry.id}
              type="button"
              title={entry.label}
              onClick={() => addOverlayFromCatalog(entry.id)}
              className="flex flex-col items-center gap-1 rounded-lg border border-white/10 bg-black/30 px-1 py-2 transition-colors hover:border-cyan-400/35 hover:bg-cyan-500/10"
            >
              <StudioOverlayCatalogThumb entry={entry} color={overlayPickColor} />
              <span className="max-w-full truncate px-0.5 text-[9px] text-slate-500">{entry.label}</span>
            </button>
          ))}
        </div>
      </div>

      {selectedOverlay ? (
        <div className="space-y-3 rounded-lg border border-violet-500/35 bg-violet-950/15 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-violet-100">선택한 요소</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
              onClick={removeSelectedOverlay}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              삭제
            </Button>
          </div>
          <div className="flex justify-center py-1">
            <StudioOverlayGraphic
              catalogId={selectedOverlay.catalogId}
              color={selectedOverlay.color}
              size={Math.min(56, selectedOverlay.size)}
              filled={selectedOverlay.filled}
            />
          </div>
          <div>
            <Label className="text-[10px] text-slate-400">색상</Label>
            <input
              type="color"
              value={selectedOverlay.color}
              onChange={(e) => updateSelectedOverlay({ color: e.target.value })}
              className="mt-1.5 h-8 w-full cursor-pointer rounded border border-white/10 bg-black/50"
            />
          </div>
          <div>
            <Label className="text-[10px] text-slate-400">크기 {selectedOverlay.size}px</Label>
            <Slider
              className="mt-2"
              min={20}
              max={120}
              step={2}
              value={[selectedOverlay.size]}
              onValueChange={(v) => updateSelectedOverlay({ size: v[0] ?? 48 })}
            />
          </div>
          <div>
            <Label className="text-[10px] text-slate-400">회전 {selectedOverlay.rotation}°</Label>
            <Slider
              className="mt-2"
              min={-180}
              max={180}
              step={5}
              value={[selectedOverlay.rotation]}
              onValueChange={(v) => updateSelectedOverlay({ rotation: v[0] ?? 0 })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-slate-400">가로 {Math.round(selectedOverlay.x)}%</Label>
              <Slider
                className="mt-2"
                min={5}
                max={95}
                step={1}
                value={[selectedOverlay.x]}
                onValueChange={(v) => updateSelectedOverlay({ x: v[0] ?? 50 })}
              />
            </div>
            <div>
              <Label className="text-[10px] text-slate-400">세로 {Math.round(selectedOverlay.y)}%</Label>
              <Slider
                className="mt-2"
                min={5}
                max={95}
                step={1}
                value={[selectedOverlay.y]}
                onValueChange={(v) => updateSelectedOverlay({ y: v[0] ?? 50 })}
              />
            </div>
          </div>
        </div>
      ) : overlays.length > 0 ? (
        <p className="text-[10px] text-slate-500">미리보기의 요소를 눌러 편집하거나, 위 모음에서 추가하세요.</p>
      ) : null}
    </div>
  )
}
