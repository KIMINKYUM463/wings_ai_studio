"use client"

import { useEffect, useState } from "react"
import {
  Check,
  FileText,
  Info,
  Image as ImageIcon,
  Settings2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  SHOTFORM_SCRIPT_TEMPLATES,
  type ShotformScriptTemplate,
} from "@/lib/shotform-script-templates"

type TabId = "overview" | "original" | "guidelines" | "examples"

const TABS: Array<{ id: TabId; label: string; icon: typeof Info }> = [
  { id: "overview", label: "개요", icon: Info },
  { id: "original", label: "원본 대본", icon: FileText },
  { id: "guidelines", label: "지침", icon: Settings2 },
  { id: "examples", label: "예시", icon: ImageIcon },
]

function DetailBlock({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0e1420] px-3.5 py-3 space-y-2">
      <p className="text-[12px] font-semibold text-sky-200/90">{title}</p>
      <div className="text-[13px] text-zinc-200 leading-relaxed whitespace-pre-wrap">
        {children}
      </div>
    </div>
  )
}

function GuidelineRow({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0e1420] px-3.5 py-3">
      <p className="text-[12px] font-bold text-amber-200/90 mb-1.5">{label}</p>
      <p className="text-[13px] text-zinc-200 leading-relaxed">{text}</p>
    </div>
  )
}

export function ScriptTemplateManagerDialog({
  open,
  onOpenChange,
  selectedId,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedId: string
  onSelect: (id: string) => void
}) {
  const [browseId, setBrowseId] = useState(selectedId)
  const [tab, setTab] = useState<TabId>("overview")

  useEffect(() => {
    if (open) {
      setBrowseId(selectedId)
      setTab("overview")
    }
  }, [open, selectedId])

  const tpl: ShotformScriptTemplate =
    SHOTFORM_SCRIPT_TEMPLATES.find((t) => t.id === browseId) ||
    SHOTFORM_SCRIPT_TEMPLATES[0]

  const apply = () => {
    onSelect(tpl.id)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[min(96vw,1480px)] sm:max-w-[min(96vw,1480px)] w-full h-[min(90vh,860px)] p-0 gap-0 border-white/10 bg-[#0b0f16] overflow-hidden flex flex-col"
      >
        <DialogTitle className="sr-only">템플릿 관리</DialogTitle>
        <DialogDescription className="sr-only">
          대본 템플릿을 고르고 개요·원본·지침·예시를 확인합니다.
        </DialogDescription>

        <div className="flex min-h-0 flex-1">
          {/* 좌측 리스트 */}
          <aside className="w-[320px] shrink-0 border-r border-white/10 bg-[#0a101a] flex flex-col">
            <div className="px-4 py-3.5 border-b border-white/[0.06]">
              <p className="text-sm font-semibold text-zinc-50">템플릿 리스트</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                {SHOTFORM_SCRIPT_TEMPLATES.length}개 · 클릭하면 내용 확인
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {SHOTFORM_SCRIPT_TEMPLATES.map((item) => {
                const browsing = item.id === browseId
                const applied = item.id === selectedId
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setBrowseId(item.id)
                      setTab("overview")
                    }}
                    className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                      browsing
                        ? "border-sky-400/40 bg-sky-500/10"
                        : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-zinc-100 leading-snug">
                          {item.name}
                        </p>
                        <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                          {item.blurb}
                        </p>
                        <p className="text-[10px] text-zinc-600 mt-0.5 capitalize">
                          {item.platform}
                        </p>
                      </div>
                      {applied ? (
                        <span className="shrink-0 rounded-full border border-emerald-400/35 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200">
                          적용됨
                        </span>
                      ) : null}
                    </div>
                  </button>
                )
              })}
            </div>
          </aside>

          {/* 우측 상세 */}
          <section className="min-w-0 flex-1 flex flex-col">
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-white/[0.06]">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Template Detail
                </p>
                <h2 className="text-lg font-bold text-zinc-50 mt-1 leading-snug">
                  {tpl.name}
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5 capitalize">{tpl.platform}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="shrink-0 border-white/20 bg-[#151b28] text-zinc-200 hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                닫기
              </Button>
            </div>

            <div className="px-5 pt-3">
              <div className="flex flex-wrap gap-1 rounded-lg border border-white/10 bg-black/30 p-1">
                {TABS.map((t) => {
                  const Icon = t.icon
                  const on = tab === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                        on
                          ? "bg-sky-500 text-white shadow"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {tab === "overview" ? (
                <>
                  <DetailBlock title="목적">{tpl.overview.purpose}</DetailBlock>
                  <DetailBlock title="지침 요약">
                    {tpl.overview.guidelineSummary}
                  </DetailBlock>
                  <DetailBlock title="톤 예시">
                    <ul className="space-y-1.5">
                      {tpl.overview.toneExamples.map((line, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-sky-400/70 shrink-0">·</span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </DetailBlock>
                </>
              ) : null}

              {tab === "original" ? (
                <>
                  <DetailBlock title="소스 정보">
                    <div className="space-y-2">
                      <p>
                        <span className="text-zinc-500">영상 제목: </span>
                        {tpl.originalScript.videoTitle}
                      </p>
                      <p>
                        <span className="text-zinc-500">근거: </span>
                        {tpl.originalScript.evidenceLength}
                      </p>
                    </div>
                  </DetailBlock>
                  <DetailBlock title="원본 대본">{tpl.originalScript.body}</DetailBlock>
                </>
              ) : null}

              {tab === "guidelines" ? (
                <>
                  <p className="text-[12px] font-semibold text-zinc-400">상세 지침</p>
                  <GuidelineRow label="훅" text={tpl.guidelines.hook} />
                  <GuidelineRow label="전개" text={tpl.guidelines.development} />
                  <GuidelineRow label="CTA" text={tpl.guidelines.cta} />
                  <GuidelineRow label="자막" text={tpl.guidelines.subtitle} />
                  <GuidelineRow label="강조" text={tpl.guidelines.emphasis} />
                </>
              ) : null}

              {tab === "examples" ? (
                <>
                  <div className="space-y-2">
                    <p className="text-[12px] font-semibold text-emerald-200/90">
                      좋은 예시
                    </p>
                    {tpl.examples.good.map((g, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-emerald-400/15 bg-emerald-500/[0.06] px-3 py-2.5 text-[13px] text-zinc-200 leading-relaxed"
                      >
                        {g}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2 pt-2">
                    <p className="text-[12px] font-semibold text-orange-200/90">
                      피해야 할 예시
                    </p>
                    {tpl.examples.avoid.map((g, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-orange-400/15 bg-orange-500/[0.06] px-3 py-2.5 text-[13px] text-zinc-200 leading-relaxed"
                      >
                        {g}
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            <div className="border-t border-white/[0.06] px-5 py-3 flex justify-end bg-[#0b0f16]">
              <Button
                type="button"
                onClick={apply}
                className="bg-sky-500 hover:bg-sky-400 text-white font-semibold"
              >
                <Check className="h-4 w-4 mr-1.5" />
                이 템플릿 선택
              </Button>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
