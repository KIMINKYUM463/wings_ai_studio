"use client"

import { useEffect, useMemo, useState } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Check, Hash, Loader2, Play, RefreshCw, Search, UserRound, Volume2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { voiceAvatarFallbackColor } from "@/lib/shotform-factory-tts"
import {
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
import { studio } from "../components/ShotFormStudioUI"
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
}

function VoiceAvatar({ voice, size = "md" }: { voice: ShotformTtsVoice; size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "h-16 w-16" : size === "md" ? "h-11 w-11" : "h-9 w-9"
  const text = size === "lg" ? "text-xl" : size === "md" ? "text-sm" : "text-xs"
  const label = (voice.name || voice.name_en || voice.voice_id || "?").trim() || "?"
  if (voice.thumbnail_image_url) {
    return (
      <img
        src={voice.thumbnail_image_url}
        alt={label}
        className={cn(dim, "shrink-0 rounded-full object-cover ring-2 ring-white/15")}
      />
    )
  }
  return (
    <span
      className={cn(
        dim,
        "flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-white/15",
        text
      )}
      style={{ background: voiceAvatarFallbackColor(label) }}
    >
      {label.slice(0, 1)}
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
}: Props) {
  const [provider, setProvider] = useState<TtsProviderId>("supertone")
  const [query, setQuery] = useState("")
  const [draftVoiceId, setDraftVoiceId] = useState(selectedVoiceId)
  const [draftStyle, setDraftStyle] = useState(voiceStyle)
  const [customIdDraft, setCustomIdDraft] = useState("")

  const voices = voiceCatalog[provider] ?? []
  const loading = voicesLoading[provider]
  const providerError = voiceLoadErrors?.[provider] ?? null

  useEffect(() => {
    if (!open) return
    const p = initialProvider ?? ttsProviderFromVoiceId(selectedVoiceId) ?? "supertone"
    setProvider(p)
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 z-[180] bg-black/85 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-[181] flex max-h-[min(90vh,720px)] w-[min(96vw,560px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c0f16] shadow-2xl outline-none"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogTitle className="sr-only">나레이션 목소리 선택</DialogTitle>

          <header className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-400/25">
                <Volume2 className="h-4 w-4 text-emerald-300" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">나레이션 캐릭터</p>
                <p className="text-[10px] text-slate-500">수퍼톤 · Supertonic 3 · ElevenLabs · 타입캐스트</p>
              </div>
            </div>
            <button
              type="button"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-300"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="flex gap-1 border-b border-white/[0.06] px-3 py-2">
            {TTS_PROVIDER_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                className={cn(
                  "flex-1 rounded-lg py-1.5 text-[11px] font-medium transition",
                  provider === id
                    ? "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/35"
                    : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
                )}
                onClick={() => switchProvider(id)}
              >
                {TTS_PROVIDER_META[id].label}
              </button>
            ))}
          </div>

          {provider === "supertonic" ? (
            <div className="border-b border-white/[0.06] px-3 py-2">
              <SupertonicSetupBar
                onReady={(info) => {
                  if (info.online) onReloadVoices("supertonic")
                }}
              />
            </div>
          ) : null}

          {draftDisplayVoice ? (
            <div className="border-b border-white/[0.06] bg-gradient-to-r from-emerald-500/[0.08] to-violet-500/[0.06] px-4 py-3">
              <div className="flex items-center gap-3">
                {draftIsCustom ? (
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-violet-500/20 ring-2 ring-violet-400/30">
                    <Hash className="h-7 w-7 text-violet-300" />
                  </span>
                ) : (
                  <VoiceAvatar voice={draftDisplayVoice} size="lg" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-white">{draftDisplayVoice.name}</p>
                  <p className="text-[10px] text-slate-500">
                    {draftIsCustom
                      ? `${meta.label} ID · ${parseBareVoiceId(draftVoiceId)?.bareId ?? ""}`
                      : `${meta.label} · ${meta.subtitle}`}
                  </p>
                  {draftStyles.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {draftStyles.map((s) => (
                        <button
                          key={s}
                          type="button"
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-[10px] transition",
                            draftStyle === s
                              ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-100"
                              : "border-white/10 bg-black/30 text-slate-400 hover:border-white/20 hover:text-slate-200"
                          )}
                          onClick={() => setDraftStyle(s)}
                        >
                          {labelTtsStyle(provider, s)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="h-9 shrink-0 border border-emerald-400/50 bg-emerald-600 text-xs font-medium text-white hover:bg-emerald-500"
                  disabled={previewingVoiceId === draftVoiceId}
                  onClick={() => void onPreviewVoice(draftVoiceId, draftStyle)}
                >
                  {previewingVoiceId === draftVoiceId ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  미리듣기
                </Button>
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <Input
                className="h-8 border-white/10 bg-black/40 pl-8 text-xs"
                placeholder="이름으로 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0 text-slate-400"
              disabled={loading}
              onClick={() => onReloadVoices(provider)}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </Button>
          </div>

          <div className="border-b border-white/[0.06] px-4 py-3">
            <p className="text-[10px] font-medium text-slate-400">또는 음성 ID 직접 입력</p>
            <p className="mt-0.5 text-[9px] leading-relaxed text-slate-600">
              {meta.label} 콘솔의 voice ID를 붙여넣으면 목록 없이도 TTS·미리듣기가 됩니다.
            </p>
            <div className="mt-2 flex gap-2">
              <Input
                className="h-9 flex-1 border-white/10 bg-black/40 font-mono text-xs"
                placeholder={meta.idPlaceholder}
                value={customIdDraft}
                onChange={(e) => setCustomIdDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyCustomId()
                }}
              />
              <Button
                type="button"
                size="sm"
                className="h-9 shrink-0 border border-violet-400/50 bg-violet-600/90 px-3 text-xs font-medium text-white shadow-sm hover:bg-violet-500 disabled:opacity-40"
                disabled={!customIdDraft.trim()}
                onClick={applyCustomId}
              >
                ID 사용
              </Button>
              <Button
                type="button"
                size="icon"
                className="h-9 w-9 shrink-0 border border-emerald-400/50 bg-emerald-600 text-white shadow-sm hover:bg-emerald-500 disabled:opacity-40"
                disabled={!customIdDraft.trim() || previewingVoiceId === buildTtsVoiceKey(provider, customIdDraft.trim())}
                onClick={() => {
                  const id = customIdDraft.trim()
                  if (!id) return
                  const key = buildTtsVoiceKey(provider, id)
                  setDraftVoiceId(key)
                  void onPreviewVoice(key, draftStyle)
                }}
              >
                {previewingVoiceId === buildTtsVoiceKey(provider, customIdDraft.trim()) ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-500">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-400/70" />
                <p className="text-xs">{meta.label} 목소리 불러오는 중…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center text-slate-500">
                <UserRound className="h-8 w-8 opacity-40" />
                {providerError ? (
                  <p className="text-xs leading-relaxed text-amber-200/90">{providerError}</p>
                ) : (
                  <p className="text-xs">
                    {meta.label} 목록이 비어 있습니다.
                    <br />
                    위에서 <strong className="text-slate-400">음성 ID 직접 입력</strong>을 사용하거나 API 키를 확인하세요.
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {filtered.map((voice) => {
                  const key = buildTtsVoiceKey(provider, voice.voice_id)
                  const selected = draftVoiceId === key
                  const previewing = previewingVoiceId === key
                  return (
                    <div
                      key={voice.voice_id}
                      className={cn(
                        "group relative rounded-xl border p-2.5 transition",
                        selected
                          ? "border-emerald-400/45 bg-emerald-500/10 ring-1 ring-emerald-400/25"
                          : "border-white/[0.08] bg-black/25 hover:border-white/15 hover:bg-white/[0.03]"
                      )}
                    >
                      <button
                        type="button"
                        className="flex w-full flex-col items-center gap-2 text-center"
                        onClick={() => pickVoice(voice)}
                      >
                        <div className="relative">
                          <VoiceAvatar voice={voice} size="md" />
                          {selected ? (
                            <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-[#0c0f16]">
                              <Check className="h-3 w-3" />
                            </span>
                          ) : null}
                        </div>
                        <p className="line-clamp-2 min-h-[2rem] text-[11px] font-medium leading-tight text-slate-200">
                          {voice.name}
                        </p>
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg border py-1.5 text-[10px] font-medium transition",
                          previewing
                            ? "border-emerald-400/45 bg-emerald-500/20 text-emerald-100"
                            : selected
                              ? "border-emerald-400/40 bg-emerald-500/12 text-emerald-100"
                              : "border-white/20 bg-white/[0.08] text-slate-200 hover:border-emerald-400/35 hover:bg-emerald-500/12 hover:text-emerald-100"
                        )}
                        disabled={previewing}
                        onClick={(e) => {
                          e.stopPropagation()
                          pickVoice(voice)
                          void onPreviewVoice(key, selected ? draftStyle : defaultStyleForTtsVoice(provider, voice))
                        }}
                      >
                        {previewing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                        듣기
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <footer className="flex items-center justify-end gap-2 border-t border-white/[0.08] bg-[#0a0d14] px-4 py-3">
            <Button type="button" variant="ghost" className="h-9 text-xs text-slate-400" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button
              type="button"
              className={cn("h-9 px-5 text-xs", studio.btnPrimary)}
              disabled={!draftVoiceId && !customIdDraft.trim()}
              onClick={apply}
            >
              <Check className="mr-1.5 h-3.5 w-3.5" />
              이 목소리 적용
            </Button>
          </footer>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
