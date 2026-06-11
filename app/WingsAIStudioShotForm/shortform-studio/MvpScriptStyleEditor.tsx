"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { MvpScriptStyleState, MvpSubtitleStyle } from "@/lib/mvp-studio-types"
import { normalizeSubtitleStyle } from "@/lib/mvp-studio-types"
import { buildSubtitleOverlayStyle } from "@/lib/mvp-subtitle-style"
import { StudioPageCard, studio } from "../components/ShotFormStudioUI"
import { MvpSubtitleStylePanel } from "./MvpSubtitleStylePanel"

type Props = {
  value: MvpScriptStyleState
  onChange: (next: MvpScriptStyleState) => void
  subtitleStyle: MvpSubtitleStyle
  onSubtitleStyleChange: (patch: Partial<MvpSubtitleStyle>) => void
  onBack: () => void
  onNext: () => void
}

export function MvpScriptStyleEditor({
  value,
  onChange,
  subtitleStyle,
  onSubtitleStyleChange,
  onBack,
  onNext,
}: Props) {
  const patch = (partial: Partial<MvpScriptStyleState>) => onChange({ ...value, ...partial })
  const sub = normalizeSubtitleStyle(subtitleStyle)

  const updateHeadcopy = (idx: number, lineIdx: 0 | 1, text: string) => {
    const next = value.headcopies.map((row, i) => {
      if (i !== idx) return row
      const copy = [...row]
      copy[lineIdx] = text
      return copy
    })
    patch({ headcopies: next })
  }

  const addHeadcopy = () => {
    if (value.headcopies.length >= 5) return
    patch({ headcopies: [...value.headcopies, ["", ""]] })
  }

  const removeHeadcopy = (idx: number) => {
    if (value.headcopies.length <= 1) return
    patch({ headcopies: value.headcopies.filter((_, i) => i !== idx) })
  }

  return (
    <StudioPageCard className="border-violet-500/20 bg-violet-950/10">
      <p className={studio.label}>6. 자막·대본 스타일</p>
      <h3 className="mt-1 text-lg font-semibold text-white">자막 디자인 · 벤치마크 bundle</h3>
      <p className="mt-1 text-xs text-slate-400">
        자막 위치·글꼴·색상과 conversion/storytelling 대본·훅카피를 편집합니다. 영상 편집(5단계)의 「스타일」
        탭과 동일한 설정이 저장됩니다.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-black/50 p-3">
            <p className="text-xs font-medium text-white">자막 스타일 미리보기</p>
            <div className="relative mt-3 aspect-[9/16] max-h-[320px] w-full overflow-hidden rounded-lg bg-gradient-to-b from-slate-800 to-slate-950">
              <div
                style={buildSubtitleOverlayStyle(sub)}
                className="!w-[88%] !max-w-[88%]"
              >
                {value.conversionScript.split("\n").slice(0, 2).join("\n") || "자막 미리보기\n스타일을 조정해 보세요"}
              </div>
            </div>
          </div>
          <MvpSubtitleStylePanel value={sub} onChange={onSubtitleStyleChange} />
        </div>

        <div className="space-y-6">
        <div>
          <Label className="text-xs text-slate-400">댓글 키워드 (commentKeyword)</Label>
          <Input
            className="mt-1 border-white/10 bg-black/40"
            value={value.commentKeyword}
            onChange={(e) => patch({ commentKeyword: e.target.value })}
            placeholder="청소기"
          />
        </div>

        <div>
          <Label className="text-xs text-slate-400">conversion 대본 (전체 · Enter=자막 한 줄)</Label>
          <Textarea
            className="mt-1 min-h-[140px] border-white/10 bg-black/40 font-mono text-xs leading-relaxed"
            value={value.conversionScript}
            onChange={(e) => patch({ conversionScript: e.target.value })}
          />
        </div>

        <div>
          <Label className="text-xs text-slate-400">storytelling 대본</Label>
          <Textarea
            className="mt-1 min-h-[100px] border-white/10 bg-black/40 font-mono text-xs leading-relaxed"
            value={value.storytellingScript}
            onChange={(e) => patch({ storytellingScript: e.target.value })}
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="mt-1 h-7 text-[11px] text-violet-300"
            onClick={() => patch({ storytellingScript: value.conversionScript })}
          >
            conversion과 동일하게 복사
          </Button>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs text-slate-400">headcopies (썸네일·훅 2줄 세트)</Label>
            <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={addHeadcopy}>
              <Plus className="mr-1 h-3 w-3" />
              세트 추가
            </Button>
          </div>
          <ul className="mt-2 space-y-2">
            {value.headcopies.map((row, i) => (
              <li key={i} className="rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] text-violet-300">세트 {i + 1}</span>
                  {value.headcopies.length > 1 ? (
                    <button
                      type="button"
                      className="text-slate-500 hover:text-red-300"
                      onClick={() => removeHeadcopy(i)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    className="border-white/10 bg-black/40 text-sm"
                    value={row[0] ?? ""}
                    placeholder="첫 줄"
                    onChange={(e) => updateHeadcopy(i, 0, e.target.value)}
                  />
                  <Input
                    className="border-white/10 bg-black/40 text-sm"
                    value={row[1] ?? ""}
                    placeholder="둘째 줄"
                    onChange={(e) => updateHeadcopy(i, 1, e.target.value)}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="border-white/15" onClick={onBack}>
          ← 영상 편집
        </Button>
        <Button type="button" variant="ghost" className={studio.btnPrimary} onClick={onNext}>
          썸네일 →
        </Button>
      </div>
    </StudioPageCard>
  )
}
