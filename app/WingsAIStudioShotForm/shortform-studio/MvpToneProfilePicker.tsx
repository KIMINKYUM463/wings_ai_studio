"use client"

import { useEffect, useState } from "react"
import { Loader2, MessageSquareQuote, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { shotformOpenAiKey } from "@/lib/shotform-factory-seo"
import {
  deleteToneProfile,
  loadToneProfiles,
  saveToneProfile,
  type MvpToneProfile,
} from "@/lib/mvp-tone-profile"
import { insp } from "./mvpInspectorUi"

type Props = {
  value: MvpToneProfile | null | undefined
  onChange: (profile: MvpToneProfile | null) => void
  disabled?: boolean
}

/**
 * 대본 탭 상단 — 참고 대본으로 말투 프로필을 만들고, 대본 생성에 쓸 프로필을 고릅니다.
 */
export function MvpToneProfilePicker({ value, onChange, disabled }: Props) {
  const [profiles, setProfiles] = useState<MvpToneProfile[]>([])
  const [composing, setComposing] = useState(false)
  const [reference, setReference] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setProfiles(loadToneProfiles())
  }, [])

  const analyze = async () => {
    const openaiApiKey = shotformOpenAiKey()
    if (!openaiApiKey) {
      setError("설정에서 OpenAI API 키를 먼저 저장해 주세요.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/shotform/mvp-tone-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openaiApiKey, referenceScript: reference }),
      })
      const data = (await res.json().catch(() => ({}))) as { profile?: MvpToneProfile; error?: string }
      if (!res.ok || !data.profile) throw new Error(data.error || "말투 분석 실패")
      setProfiles(saveToneProfile(data.profile))
      onChange(data.profile)
      setReference("")
      setComposing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "말투 분석 실패")
    } finally {
      setBusy(false)
    }
  }

  const remove = (id: string) => {
    setProfiles(deleteToneProfile(id))
    if (value?.id === id) onChange(null)
  }

  const chip = (active: boolean) =>
    cn("rounded-full border px-2.5 py-1 text-[10px] font-medium transition", active ? insp.chipActive : insp.chipIdle)

  return (
    <div className={cn(insp.card, "space-y-2.5 p-3")}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <MessageSquareQuote className="h-3.5 w-3.5 text-slate-500" />
          <p className={insp.title}>말투</p>
        </div>
        {!composing ? (
          <button
            type="button"
            disabled={disabled}
            className="text-[10px] font-medium text-violet-600 hover:underline disabled:opacity-40"
            onClick={() => setComposing(true)}
          >
            + 참고 대본으로 만들기
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button type="button" disabled={disabled} className={chip(!value)} onClick={() => onChange(null)}>
          기본
        </button>
        {profiles.map((p) => (
          <span key={p.id} className="inline-flex items-center">
            <button
              type="button"
              disabled={disabled}
              className={chip(value?.id === p.id)}
              title={[p.persona, p.speechLevel, p.energy].filter(Boolean).join(" · ")}
              onClick={() => onChange(p)}
            >
              {p.name}
            </button>
            <button
              type="button"
              aria-label={`${p.name} 삭제`}
              className="ml-0.5 rounded p-0.5 text-slate-300 hover:text-rose-500"
              onClick={() => remove(p.id)}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      {value ? (
        <ul className="space-y-0.5 text-[10px] leading-relaxed text-slate-500">
          {value.opener ? <li>시작 · {value.opener}</li> : null}
          {value.flow.length ? <li>전개 · {value.flow.join(" → ")}</li> : null}
          {value.closer ? <li>마무리 · {value.closer}</li> : null}
        </ul>
      ) : (
        <p className="text-[10px] text-slate-400">기본 쇼핑 말투로 대본을 씁니다.</p>
      )}

      {composing ? (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 p-2.5">
          <div className="flex items-center justify-between">
            <p className={insp.label}>잘 된 영상의 대본을 붙여 넣으세요 (말투·흐름만 배우고 문장은 쓰지 않아요)</p>
            <button type="button" aria-label="닫기" onClick={() => setComposing(false)}>
              <X className="h-3.5 w-3.5 text-slate-400" />
            </button>
          </div>
          <textarea
            value={reference}
            rows={5}
            maxLength={4000}
            placeholder="예) 이거 진짜 사길 잘했어요. 책상 위에 선 정리가 안 돼서…"
            className={cn("w-full resize-y rounded-lg border px-2.5 py-2 text-[11px] leading-relaxed", insp.input)}
            onChange={(e) => setReference(e.target.value)}
          />
          {error ? <p className="text-[10px] text-rose-600">{error}</p> : null}
          <Button
            type="button"
            size="sm"
            disabled={busy || reference.trim().length < 40}
            className={cn("h-8 w-full gap-1.5 text-[11px] font-semibold", insp.primaryBtn)}
            onClick={analyze}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {reference.trim().length < 40 ? `40자 이상 넣어 주세요 (${reference.trim().length}자)` : "말투 분석해서 저장"}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
