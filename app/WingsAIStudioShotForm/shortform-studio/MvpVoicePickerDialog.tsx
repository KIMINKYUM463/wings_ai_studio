"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Check, Hash, Loader2, Play, RefreshCw, Search, UserRound, X } from "lucide-react"
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  DEFAULT_TTS_PROVIDER,
  TTS_PROVIDER_META,
  TTS_PROVIDER_ORDER,
  buildTtsVoiceKey,
  customTtsVoiceLabel,
  defaultStyleForTtsVoice,
  isCatalogVoice,
  labelTtsStyle,
  parseBareVoiceId,
  shouldAutoLoadVoiceCatalog,
  stylesForTtsVoice,
  ttsProviderFromVoiceId,
  type ShotformTtsVoice,
  type TtsProviderId,
} from "@/lib/shotform-tts-providers"
import { voicePersonaPhoto } from "@/components/wings-shopping-v2/VoiceFace"
import { SupertonicSetupBar } from "../components/SupertonicSetupBar"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialProvider?: TtsProviderId
  voiceCatalog: Record<TtsProviderId, ShotformTtsVoice[]>
  voicesLoading: Record<TtsProviderId, boolean>
  voiceLoadErrors?: Record<TtsProviderId, string | null>
  selectedVoiceId: string
  voiceStyle: string
  onVoiceIdChange: (id: string) => void
  onStyleChange: (style: string) => void
  onReloadVoices: (provider: TtsProviderId) => void
  onPreviewVoice: (voiceId: string, style: string) => void | Promise<void>
  previewingVoiceId: string | null
  /** 제미나이 탭 (썰·리믹스 v2): 목소리 목록·미리듣기 주소·적용 */
  geminiTab?: GeminiTab
}

export type GeminiTab = { voices: { id: string; name: string }[]; selectedId: string; startHere?: boolean; previewUrl: (id: string) => string; onApply: (id: string) => void }

function VoiceAvatar({ voice, size = "md", talking }: { voice: ShotformTtsVoice; size?: "sm" | "md" | "lg" | "xl"; talking?: boolean }) {
  const dim = size === "xl" ? "h-20 w-20" : size === "lg" ? "h-14 w-14" : size === "md" ? "h-11 w-11" : "h-9 w-9"
  const label = (voice.name || voice.name_en || voice.voice_id || "?").trim() || "?"
  // 플랫폼 사진이 있으면 그 사진, 없거나 못 받으면 성별에 맞는 인물 사진 (듣는 중에는 소리 물결 테두리)
  const fallback = voicePersonaPhoto(label, voice.gender)
  return (
    <span className="relative inline-block">
      <img src={voice.thumbnail_image_url || fallback} alt={label} className={cn(dim, "shrink-0 rounded-full bg-[#eef0f6] object-cover")}
        onError={(e) => { if (e.currentTarget.src.indexOf(fallback) < 0) e.currentTarget.src = fallback }} />
      {talking && <span className="absolute -inset-1 animate-ping rounded-full ring-2 ring-[#2f3beb]/60" aria-hidden />}
    </span>
  )
}

export function MvpVoicePickerDialog({
  open,
  onOpenChange,
  initialProvider,
  voiceCatalog,
  voicesLoading,
  voiceLoadErrors,
  selectedVoiceId,
  voiceStyle,
  onVoiceIdChange,
  onStyleChange,
  onReloadVoices,
  onPreviewVoice,
  previewingVoiceId,
  geminiTab,
}: Props) {
  const [provider, setProvider] = useState<TtsProviderId>(DEFAULT_TTS_PROVIDER)
  const [tab, setTab] = useState<"gemini" | TtsProviderId>(DEFAULT_TTS_PROVIDER)
  const [query, setQuery] = useState("")
  const [draftVoiceId, setDraftVoiceId] = useState(selectedVoiceId)
  const [draftStyle, setDraftStyle] = useState(voiceStyle)
  const [customIdDraft, setCustomIdDraft] = useState("")

  const voices = voiceCatalog[provider] ?? []
  const loading = voicesLoading[provider]
  const providerError = voiceLoadErrors?.[provider] ?? null

  useEffect(() => {
    if (!open) return
    const p = initialProvider ?? ttsProviderFromVoiceId(selectedVoiceId) ?? DEFAULT_TTS_PROVIDER
    setProvider(p)
    setTab(p)
    setDraftVoiceId(selectedVoiceId)
    setDraftStyle(voiceStyle)
    setQuery("")
    const bare = parseBareVoiceId(selectedVoiceId)?.bareId ?? ""
    // voiceCatalog를 deps에 넣으면 목록 로드마다 탭이 초기 프로바이더로 되돌아가 탭 전환이 막힙니다.
    setCustomIdDraft(
      bare && selectedVoiceId && !isCatalogVoice(selectedVoiceId, voiceCatalog[p] ?? [], p) ? bare : ""
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open 시 한 번만 동기화
  }, [open, initialProvider, selectedVoiceId, voiceStyle])

  useEffect(() => {
    if (!open || loading) return
    // 이미 실패한 프로바이더는 재시도하지 않음 (빈 목록 + 자동로드 → 무한 루프 방지)
    if (providerError) return
    const list = voiceCatalog[provider] ?? []
    if (shouldAutoLoadVoiceCatalog(provider, list)) {
      onReloadVoices(provider)
    }
  }, [open, provider, loading, providerError, voiceCatalog, onReloadVoices])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return voices
    return voices.filter((v) => v.name.toLowerCase().includes(q) || v.voice_id.toLowerCase().includes(q))
  }, [voices, query])

  const draftVoice =
    voices.find((v) => buildTtsVoiceKey(provider, v.voice_id) === draftVoiceId) ?? null
  const draftIsCustom = Boolean(draftVoiceId) && ttsProviderFromVoiceId(draftVoiceId) === provider && !draftVoice
  const draftDisplayVoice: ShotformTtsVoice | null =
    draftVoice ?? (draftIsCustom ? customTtsVoiceLabel(provider, draftVoiceId) : null)
  const draftStyles = stylesForTtsVoice(provider, draftDisplayVoice)
  const meta = TTS_PROVIDER_META[provider]

  const switchProvider = (next: TtsProviderId) => {
    setProvider(next)
    setQuery("")
    setCustomIdDraft("")
    const parsed = parseBareVoiceId(draftVoiceId)
    if (parsed?.provider !== next) setDraftVoiceId("")
    if (voicesLoading[next]) return
    const list = voiceCatalog[next] ?? []
    // 수퍼토닉3: 내장 목록이 있어도 탭 진입 시 로컬 서버 목록을 한 번 갱신
    if (next === "supertonic") {
      onReloadVoices(next)
      return
    }
    if (shouldAutoLoadVoiceCatalog(next, list) && !voiceLoadErrors?.[next]) {
      onReloadVoices(next)
    }
  }

  const applyCustomId = () => {
    const id = customIdDraft.trim()
    if (!id) return
    const key = buildTtsVoiceKey(provider, id)
    setDraftVoiceId(key)
    setDraftStyle(defaultStyleForTtsVoice(provider, null))
  }

  const pickVoice = (voice: ShotformTtsVoice) => {
    const key = buildTtsVoiceKey(provider, voice.voice_id)
    setDraftVoiceId(key)
    setDraftStyle(defaultStyleForTtsVoice(provider, voice))
  }

  const apply = () => {
    const typed = customIdDraft.trim()
    const voiceId = typed ? buildTtsVoiceKey(provider, typed) : draftVoiceId
    if (voiceId) onVoiceIdChange(voiceId)
    if (draftStyle || provider === "elevenlabs") onStyleChange(draftStyle)
    onOpenChange(false)
  }

  // 제미나이 탭 (썰·리믹스 v2 에서만 넘겨줌): 제미나이 목소리는 프로젝트 기본 목소리로 저장된다
  const [geminiDraft, setGeminiDraft] = useState(geminiTab?.selectedId ?? "")
  const [geminiPlaying, setGeminiPlaying] = useState<string | null>(null)
  const geminiAudio = useRef<HTMLAudioElement | null>(null)
  useEffect(() => {
    if (open) setGeminiDraft(geminiTab?.selectedId ?? "")
    if (!open) geminiAudio.current?.pause()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  useEffect(() => {
    if (open && geminiTab?.startHere) setTab("gemini")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const playGemini = (id: string) => {
    if (!geminiTab) return
    geminiAudio.current?.pause()
    if (geminiPlaying === id) { setGeminiPlaying(null); return }
    const a = new Audio(geminiTab.previewUrl(id))
    geminiAudio.current = a
    setGeminiPlaying(id)
    a.onended = () => setGeminiPlaying(null)
    a.onerror = () => setGeminiPlaying(null)
    void a.play().catch(() => setGeminiPlaying(null))
  }
  const gemini = tab === "gemini"
  const tabs: Array<{ id: "gemini" | TtsProviderId; label: string }> = [
    ...(geminiTab ? [{ id: "gemini" as const, label: "제미나이" }] : []),
    ...TTS_PROVIDER_ORDER.map((id) => ({ id, label: TTS_PROVIDER_META[id].label })),
  ]
  const geminiFiltered = (geminiTab?.voices ?? []).filter((v) => !query.trim() || v.name.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 z-[180] bg-[#0b0d14]/70 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className="light-keep fixed left-1/2 top-1/2 z-[181] flex max-h-[min(92vh,820px)] w-[min(96vw,760px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] bg-white text-[#0e1016] shadow-[0_40px_100px_-30px_rgba(14,16,22,0.6)] outline-none"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogTitle className="sr-only">나레이션 목소리 선택</DialogTitle>

          {/* 머리: 지금 고른 목소리 */}
          <header className="relative overflow-hidden bg-gradient-to-br from-[#0e1016] via-[#1b1f3a] to-[#2f3beb] px-6 pb-5 pt-5 text-white">
            <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#6d5cff]/30 blur-3xl" />
            <div className="relative flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-white/60">나레이션 캐릭터</p>
                <p className="mt-0.5 text-xl font-bold tracking-[-0.02em]">영상을 읽어 줄 목소리를 골라 주세요</p>
              </div>
              <button type="button" aria-label="닫기" className="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white" onClick={() => onOpenChange(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            {(gemini ? geminiDraft : draftDisplayVoice) ? (
              <div className="relative mt-4 flex items-center gap-3 rounded-2xl bg-white/10 p-3 ring-1 ring-white/15 backdrop-blur">
                {gemini ? (
                  <img src={voicePersonaPhoto(geminiDraft.split(" (")[0]!, (geminiTab?.voices.find((v) => v.id === geminiDraft)?.name ?? ""))} alt="" className="h-14 w-14 rounded-full object-cover ring-2 ring-white/70" />
                ) : draftIsCustom ? (
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/15 ring-2 ring-white/40"><Hash className="h-6 w-6" /></span>
                ) : (
                  <VoiceAvatar voice={draftDisplayVoice!} size="lg" talking={previewingVoiceId === draftVoiceId} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold">
                    {gemini ? (geminiTab?.voices.find((v) => v.id === geminiDraft)?.name ?? geminiDraft) : draftDisplayVoice!.name}
                  </p>
                  <p className="text-xs text-white/60">{gemini ? "제미나이" : draftIsCustom ? `${meta.label} ID · ${parseBareVoiceId(draftVoiceId)?.bareId ?? ""}` : `${meta.label} · ${meta.subtitle}`}</p>
                  {!gemini && draftStyles.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {draftStyles.map((s) => (
                        <button key={s} type="button" onClick={() => setDraftStyle(s)}
                          className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition", draftStyle === s ? "bg-white text-[#0e1016]" : "bg-white/10 text-white/80 hover:bg-white/20")}>
                          {labelTtsStyle(provider, s)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <button type="button"
                  className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-bold text-[#0e1016] transition hover:bg-white/90 disabled:opacity-60"
                  disabled={!gemini && previewingVoiceId === draftVoiceId}
                  onClick={() => (gemini ? playGemini(geminiDraft) : void onPreviewVoice(draftVoiceId, draftStyle))}>
                  {(gemini ? geminiPlaying === geminiDraft : previewingVoiceId === draftVoiceId) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  미리듣기
                </button>
              </div>
            ) : null}
          </header>

          {/* 엔진 탭 */}
          <div className="flex gap-1 border-b border-[#eceef3] bg-white px-4 py-3">
            {tabs.map((t) => (
              <button key={t.id} type="button"
                className={cn("flex-1 rounded-full py-2 text-[13px] font-bold transition", tab === t.id ? "bg-[#0e1016] text-white shadow" : "text-[#6b7280] hover:bg-[#f3f4f8] hover:text-[#0e1016]")}
                onClick={() => (t.id === "gemini" ? (setTab("gemini"), setQuery("")) : (setTab(t.id), switchProvider(t.id)))}>
                {t.label}
              </button>
            ))}
          </div>

          {!gemini && provider === "supertonic" ? (
            <div className="border-b border-[#eceef3] px-4 py-2">
              <SupertonicSetupBar onReady={(info) => { if (info.online) onReloadVoices("supertonic") }} />
            </div>
          ) : null}

          {/* 검색 + 직접 입력 */}
          <div className="flex flex-wrap items-center gap-2 border-b border-[#eceef3] px-4 py-3">
            <div className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aa0ad]" />
              <input className="h-10 w-full rounded-full border border-[#e3e6ec] bg-[#f7f8fb] pl-9 pr-3 text-sm text-[#0e1016] placeholder:text-[#9aa0ad] focus:border-[#2f3beb] focus:bg-white focus:outline-none"
                placeholder="이름으로 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            {!gemini && (
              <>
                <div className="flex min-w-[14rem] flex-1 gap-1.5">
                  <input className="h-10 min-w-0 flex-1 rounded-full border border-[#e3e6ec] bg-[#f7f8fb] px-3.5 font-mono text-xs text-[#0e1016] placeholder:text-[#9aa0ad] focus:border-[#2f3beb] focus:bg-white focus:outline-none"
                    placeholder={`${meta.label} 음성 ID 직접 입력`} value={customIdDraft} onChange={(e) => setCustomIdDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") applyCustomId() }} />
                  <button type="button" className="h-10 shrink-0 rounded-full border border-[#e3e6ec] px-3.5 text-xs font-bold text-[#0e1016] hover:border-[#0e1016] disabled:opacity-40"
                    disabled={!customIdDraft.trim()} onClick={applyCustomId}>ID 사용</button>
                </div>
                <button type="button" aria-label="목록 새로고침" className="grid h-10 w-10 place-items-center rounded-full border border-[#e3e6ec] text-[#6b7280] hover:text-[#0e1016]"
                  disabled={loading} onClick={() => onReloadVoices(provider)}>
                  <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                </button>
              </>
            )}
          </div>

          {/* 목소리 카드 */}
          <div className="min-h-0 flex-1 overflow-y-auto bg-[#f7f8fb] p-4">
            {gemini ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {geminiFiltered.map((v) => {
                  const name = v.name.split(" (")[0]!
                  const desc = v.name.match(/\((.+)\)/)?.[1] ?? ""
                  const selected = geminiDraft === v.id
                  return (
                    <VoiceCard key={v.id} photo={voicePersonaPhoto(name, desc)} name={name} sub={desc} selected={selected}
                      playing={geminiPlaying === v.id} onPick={() => setGeminiDraft(v.id)} onPlay={() => { setGeminiDraft(v.id); playGemini(v.id) }} />
                  )
                })}
              </div>
            ) : loading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-[#6b7280]">
                <Loader2 className="h-6 w-6 animate-spin text-[#2f3beb]" />
                <p className="text-sm">{meta.label} 목소리 불러오는 중…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center text-[#6b7280]">
                <UserRound className="h-8 w-8 opacity-40" />
                <p className="text-sm leading-relaxed">{providerError ?? `${meta.label} 목록이 비어 있어요. 위에서 음성 ID를 직접 입력하거나 API 키를 확인해 주세요.`}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {filtered.map((voice) => {
                  const key = buildTtsVoiceKey(provider, voice.voice_id)
                  return (
                    <VoiceCard key={voice.voice_id} voice={voice} name={voice.name} sub={[voice.gender === "female" ? "여성" : voice.gender === "male" ? "남성" : "", voice.age ?? ""].filter(Boolean).join(" · ")}
                      selected={draftVoiceId === key} playing={previewingVoiceId === key}
                      onPick={() => pickVoice(voice)}
                      onPlay={() => { pickVoice(voice); void onPreviewVoice(key, draftVoiceId === key ? draftStyle : defaultStyleForTtsVoice(provider, voice)) }} />
                  )
                })}
              </div>
            )}
          </div>

          <footer className="flex items-center justify-end gap-2 border-t border-[#eceef3] bg-white px-5 py-4">
            <button type="button" className="h-10 rounded-full px-4 text-sm font-semibold text-[#6b7280] hover:text-[#0e1016]" onClick={() => onOpenChange(false)}>취소</button>
            <button type="button" className="flex h-10 items-center gap-1.5 rounded-full bg-[#2f3beb] px-6 text-sm font-bold text-white shadow-[0_12px_28px_-12px_rgba(47,59,235,0.8)] hover:bg-[#4350ff] disabled:opacity-40"
              disabled={gemini ? !geminiTab : !draftVoiceId && !customIdDraft.trim()}
              onClick={() => { if (gemini) { geminiTab?.onApply(geminiDraft); onOpenChange(false) } else apply() }}>
              <Check className="h-4 w-4" /> 이 목소리 적용
            </button>
          </footer>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}

/** 목소리 카드: 인물 사진 · 이름 · 듣기 (듣는 중에는 사진 둘레에 소리 물결) */
function VoiceCard({ voice, photo, name, sub, selected, playing, onPick, onPlay }: {
  voice?: ShotformTtsVoice; photo?: string; name: string; sub?: string; selected: boolean; playing: boolean; onPick: () => void; onPlay: () => void
}) {
  return (
    <div className={cn("group rounded-2xl border-2 bg-white p-3 transition duration-200", selected ? "border-[#2f3beb] shadow-[0_16px_34px_-20px_rgba(47,59,235,0.8)]" : "border-transparent hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-20px_rgba(14,16,22,0.4)]")}>
      <button type="button" onClick={onPick} className="flex w-full flex-col items-center gap-2 text-center">
        <span className="relative">
          {voice ? <VoiceAvatar voice={voice} size="xl" talking={playing} /> : (
            <span className="relative inline-block">
              <img src={photo} alt="" className="h-20 w-20 rounded-full object-cover" />
              {playing && <span className="absolute -inset-1 animate-ping rounded-full ring-2 ring-[#2f3beb]/60" aria-hidden />}
            </span>
          )}
          {selected && <span className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full bg-[#2f3beb] text-white ring-2 ring-white"><Check className="h-3.5 w-3.5" /></span>}
        </span>
        <span className="w-full">
          <span className="block truncate text-sm font-bold text-[#0e1016]">{name}</span>
          {sub ? <span className="block truncate text-[11px] text-[#6b7280]">{sub}</span> : <span className="block h-[16px]" />}
        </span>
      </button>
      <button type="button" onClick={(e) => { e.stopPropagation(); onPlay() }}
        className={cn("mt-2.5 flex h-8 w-full items-center justify-center gap-1.5 rounded-full text-xs font-bold transition", playing ? "bg-[#2f3beb] text-white" : "bg-[#f3f4f8] text-[#0e1016] hover:bg-[#e8eaf3]")}>
        {playing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
        {playing ? "듣는 중" : "듣기"}
      </button>
    </div>
  )
}
