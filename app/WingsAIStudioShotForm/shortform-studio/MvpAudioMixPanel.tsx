"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Music2, Pause, Play, Plus, Trash2, Upload, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MVP_AUDIO_CATALOG } from "@/lib/mvp-studio-audio-catalog"
import { mvpBgmGainFromPct, probeAudioDurationSec } from "@/lib/mvp-preview-audio-mix"
import { mvpAudioCatalogItem } from "@/lib/mvp-studio-audio-catalog"
import {
  canAddMvpBgmClip,
  MVP_MAX_BGM_CLIPS,
  newMvpBgmClipId,
  type MvpBgmClip,
} from "@/lib/mvp-studio-types"
import { cn } from "@/lib/utils"
import { studio } from "../components/ShotFormStudioUI"

type Props = {
  bgmClips: MvpBgmClip[]
  onBgmClipsChange: (next: MvpBgmClip[]) => void
  selectedBgmClipId: string | null
  onSelectBgmClipId: (id: string | null) => void
  pendingCatalogId: string
  onPendingCatalogIdChange: (id: string) => void
  durationSec: number
}

export function MvpAudioMixPanel({
  bgmClips,
  onBgmClipsChange,
  selectedBgmClipId,
  onSelectBgmClipId,
  pendingCatalogId,
  onPendingCatalogIdChange,
  durationSec,
}: Props) {
  const uploadRef = useRef<HTMLInputElement>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const [previewingKey, setPreviewingKey] = useState<string | null>(null)
  const atClipLimit = !canAddMvpBgmClip(bgmClips)

  const stopPreview = useCallback(() => {
    const el = previewAudioRef.current
    if (el) {
      el.pause()
      el.onended = null
      el.src = ""
    }
    previewAudioRef.current = null
    setPreviewingKey(null)
  }, [])

  useEffect(() => () => stopPreview(), [stopPreview])

  const playPreview = useCallback(
    async (opts: {
      key: string
      src: string
      volumePct: number
      loop: boolean
    }) => {
      if (previewingKey === opts.key) {
        stopPreview()
        return
      }
      stopPreview()
      const el = new Audio(opts.src)
      el.volume = mvpBgmGainFromPct(opts.volumePct)
      el.loop = opts.loop
      el.preload = "auto"
      previewAudioRef.current = el
      setPreviewingKey(opts.key)
      if (!opts.loop) {
        el.onended = () => stopPreview()
      }
      try {
        await el.play()
      } catch {
        stopPreview()
      }
    },
    [previewingKey, stopPreview]
  )

  const previewPendingCatalog = () => {
    const item = mvpAudioCatalogItem(pendingCatalogId)
    if (!item) return
    void playPreview({
      key: `catalog:${item.id}`,
      src: item.src,
      volumePct: 22,
      loop: true,
    })
  }

  const previewClip = (clip: MvpBgmClip) => {
    void playPreview({
      key: `clip:${clip.id}`,
      src: clip.src,
      volumePct: clip.volumePct,
      loop: true,
    })
  }

  const addClip = async (startSec: number) => {
    if (!canAddMvpBgmClip(bgmClips)) return
    const item = MVP_AUDIO_CATALOG.find((o) => o.id === pendingCatalogId)
    if (!item) return
    const sourceDurationSec = await probeAudioDurationSec(item.src)
    const start = Math.max(0, Math.min(durationSec - 0.35, startSec))
    const clip: MvpBgmClip = {
      id: newMvpBgmClipId(),
      catalogId: item.id,
      label: item.label,
      src: item.src,
      startSec: start,
      endSec: Math.max(start + 0.35, durationSec),
      volumePct: 22,
      sourceDurationSec,
    }
    onBgmClipsChange([...bgmClips, clip])
    onSelectBgmClipId(clip.id)
  }

  const handleUpload = async (file: File) => {
    if (!canAddMvpBgmClip(bgmClips)) return
    const src = URL.createObjectURL(file)
    const name = file.name.replace(/\.[^.]+$/, "") || "업로드"
    const sourceDurationSec = await probeAudioDurationSec(src)
    const start = Math.max(0, durationSec * 0.2)
    const clip: MvpBgmClip = {
      id: newMvpBgmClipId(),
      catalogId: "upload",
      label: name,
      src,
      startSec: start,
      endSec: Math.min(durationSec, start + sourceDurationSec),
      volumePct: 22,
      sourceDurationSec,
    }
    onBgmClipsChange([...bgmClips, clip])
    onSelectBgmClipId(clip.id)
  }

  const selectedClip = bgmClips.find((c) => c.id === selectedBgmClipId) ?? null
  return (
    <div className="space-y-4 rounded-lg border border-white/10 bg-[#141414] p-3">
      <div className="flex items-center gap-2">
        <Music2 className="h-4 w-4 text-sky-400" />
        <p className="text-xs font-medium text-white">배경음악</p>
      </div>

      <div className="space-y-2 rounded-md border border-white/5 bg-[#0f0f0f] p-3">
        <p className="text-[10px] font-medium text-slate-400">음원 추가</p>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={pendingCatalogId} onValueChange={onPendingCatalogIdChange}>
            <SelectTrigger className="h-8 w-[min(100%,180px)] border-white/10 bg-[#1a1a1a] text-xs">
              <SelectValue placeholder="음원 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>배경음악</SelectLabel>
                {MVP_AUDIO_CATALOG.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            className={cn(studio.btnGhost, "h-8 gap-1 px-2 text-xs")}
            onClick={previewPendingCatalog}
          >
            {previewingKey === `catalog:${pendingCatalogId}` ? (
              <Pause className="h-3 w-3" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            미리듣기
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={cn(studio.btnSecondary, "h-8 gap-1 px-2 text-xs")}
            disabled={atClipLimit}
            onClick={() => void addClip(0)}
          >
            <Plus className="h-3 w-3" />
            추가
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={cn(studio.btnGhost, "h-8 gap-1 px-2 text-xs")}
            disabled={atClipLimit}
            onClick={() => uploadRef.current?.click()}
          >
            <Upload className="h-3 w-3" />
            업로드
          </Button>
          <input
            ref={uploadRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleUpload(f)
              e.target.value = ""
            }}
          />
        </div>
        <p className="text-[9px] text-slate-600">
          {atClipLimit
            ? `배경음은 ${MVP_MAX_BGM_CLIPS}개만 추가할 수 있습니다. 삭제 후 다시 추가하세요.`
            : "타임라인 「배경음」 트랙을 클릭해 배치하거나, 클립 양쪽 핸들로 구간을 조절하세요. 선택 후 Delete 키로 삭제할 수 있습니다."}
        </p>

        {bgmClips.length ? (
          <ul className="mt-2 space-y-1">
            {bgmClips.map((clip) => (
              <li key={clip.id}>
                <div
                  className={cn(
                    "flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left text-[10px] transition",
                    selectedBgmClipId === clip.id
                      ? "border-sky-400/50 bg-sky-500/15 text-sky-100"
                      : "border-white/5 bg-[#1a1a1a] text-slate-300 hover:bg-[#222]"
                  )}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    onClick={() => onSelectBgmClipId(clip.id)}
                  >
                    <Music2 className="h-3 w-3 shrink-0 text-sky-400" />
                    <span className="min-w-0 flex-1 truncate">{clip.label}</span>
                    <span className="font-mono text-slate-500">
                      {clip.startSec.toFixed(1)}–{clip.endSec.toFixed(1)}초
                    </span>
                  </button>
                  <button
                    type="button"
                    title="미리듣기"
                    className="rounded p-0.5 text-slate-500 hover:bg-sky-500/20 hover:text-sky-300"
                    onClick={() => previewClip(clip)}
                  >
                    {previewingKey === `clip:${clip.id}` ? (
                      <Pause className="h-3 w-3" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="rounded p-0.5 text-slate-500 hover:bg-red-500/20 hover:text-red-300"
                    onClick={() => {
                      if (previewingKey === `clip:${clip.id}`) stopPreview()
                      onBgmClipsChange(bgmClips.filter((c) => c.id !== clip.id))
                      if (selectedBgmClipId === clip.id) onSelectBgmClipId(null)
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[10px] text-slate-600">배치된 배경음이 없습니다.</p>
        )}

        {selectedClip ? (
          <div className="mt-2 flex items-center gap-2 border-t border-white/5 pt-2">
            <Button
              type="button"
              variant="ghost"
              className={cn(studio.btnGhost, "h-7 gap-1 px-2 text-[10px]")}
              onClick={() => previewClip(selectedClip)}
            >
              {previewingKey === `clip:${selectedClip.id}` ? (
                <Pause className="h-3 w-3" />
              ) : (
                <Play className="h-3 w-3" />
              )}
              미리듣기
            </Button>
            <span className="text-[9px] text-slate-500">볼륨</span>
            <Volume2 className="h-3 w-3 text-slate-500" />
            <Slider
              value={[selectedClip.volumePct]}
              min={0}
              max={100}
              step={1}
              onValueChange={(v) => {
                const vol = Math.round(v[0] ?? 0)
                onBgmClipsChange(
                  bgmClips.map((c) => (c.id === selectedClip.id ? { ...c, volumePct: vol } : c))
                )
              }}
              className="flex-1"
            />
            <span className="w-8 text-right text-[10px] text-slate-500">
              {selectedClip.volumePct}%
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
