"use client"

import Link from "next/link"
import { type ReactNode, useEffect, useState } from "react"
import {
  Factory,
  Film,
  FlaskConical,
  FolderOpen,
  KeyRound,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  SHOTFORM_API_KEYS_UPDATED_EVENT,
  ShotFormApiKeySettingsDialog,
} from "../components/ShotFormApiKeySettingsDialog"

/** 영상·URL 검색 — 크림/코랄 UI 토큰 */
export const pack = {
  page: "min-h-screen bg-[#f7f4ef] text-[#1c1917]",
  sidebar:
    "border-r border-[#1c1917]/[0.06] bg-[#faf8f5]/95 backdrop-blur-xl",
  hero:
    "relative overflow-hidden rounded-b-[2rem] bg-gradient-to-br from-[#ff4d3d] via-[#ff6b4a] to-[#ff8a65] shadow-[0_24px_60px_rgba(255,77,61,0.25)]",
  card: "rounded-[1.25rem] border border-[#1c1917]/[0.06] bg-white shadow-[0_8px_32px_rgba(28,25,23,0.06)]",
  input:
    "h-14 w-full rounded-2xl border border-[#1c1917]/10 bg-white pr-28 pl-5 text-base text-[#1c1917] shadow-[0_8px_24px_rgba(28,25,23,0.08)] placeholder:text-stone-400 focus:border-[#ff4d3d]/40 focus:outline-none focus:ring-4 focus:ring-[#ff4d3d]/15",
  label: "text-[10px] font-bold uppercase tracking-[0.16em] text-stone-400",
  chip: "rounded-full bg-[#faf8f5] px-2.5 py-1 text-[11px] font-medium text-stone-600 ring-1 ring-[#1c1917]/[0.06]",
  btnAccent:
    "rounded-xl bg-[#ff4d3d] px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_24px_rgba(255,77,61,0.35)] transition hover:bg-[#e84435]",
} as const

const STEPS = [
  { n: 1, label: "URL 입력" },
  { n: 2, label: "소스 수집" },
  { n: 3, label: "AI 쇼츠" },
] as const

type NavItem = {
  id: string
  label: string
  icon: typeof Search
  href: string
  nested?: boolean
  badge?: string
}

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "제품 검색",
    items: [
      {
        id: "product-search",
        label: "영상·URL 검색",
        icon: Search,
        href: "/WingsAIStudioShotForm/product-search",
      },
      {
        id: "shortform-studio",
        label: "숏폼 스튜디오",
        icon: FlaskConical,
        href: "/WingsAIStudioShotForm/shortform-studio",
        nested: true,
      },
    ],
  },
  {
    title: "숏폼 제작",
    items: [
      {
        id: "mix-source",
        label: "믹스 소스",
        icon: Film,
        href: "/WingsAIStudioShotForm/mix-source",
        nested: true,
      },
      {
        id: "shoppingshotform",
        label: "AI 쇼핑 숏폼",
        icon: Factory,
        href: "/WingsAIStudioShotForm/shoppingshotform",
        nested: true,
        badge: "Beta",
      },
    ],
  },
  {
    title: "추천 영상",
    items: [
      {
        id: "realtime-rank",
        label: "실시간 순위",
        icon: TrendingUp,
        href: "/WingsAIStudioShotForm/realtime-shopping-rank",
      },
      {
        id: "picked",
        label: "추천영상",
        icon: Star,
        href: "/WingsAIStudioShotForm/picked-videos",
      },
    ],
  },
]

export type ProductSearchLayoutProps = {
  children: ReactNode
  backHref?: string
  backLabel?: string
  activeStep?: number
}

function hasOpenAIKey(): boolean {
  if (typeof window === "undefined") return false
  return Boolean((localStorage.getItem("shotform_openai_api_key") || "").trim())
}

function StepBar({ activeStep }: { activeStep: number }) {
  return (
    <div className="border-b border-[#1c1917]/[0.06] bg-white/70 px-4 py-4 backdrop-blur-sm sm:px-6">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2">
        {STEPS.map((step, i) => {
          const done = activeStep > step.n
          const current = activeStep === step.n
          return (
            <div key={step.n} className="flex min-w-0 flex-1 items-center gap-2">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition",
                  done
                    ? "bg-[#ff4d3d] text-white"
                    : current
                      ? "bg-[#1c1917] text-white ring-4 ring-[#ff4d3d]/20"
                      : "bg-stone-200 text-stone-500"
                )}
              >
                {done ? "✓" : step.n}
              </span>
              <span
                className={cn(
                  "hidden truncate text-xs font-semibold sm:block",
                  current ? "text-[#1c1917]" : done ? "text-stone-600" : "text-stone-400"
                )}
              >
                {step.label}
              </span>
              {i < STEPS.length - 1 ? (
                <div
                  className={cn(
                    "mx-1 hidden h-0.5 flex-1 rounded-full sm:block",
                    done ? "bg-[#ff4d3d]/60" : "bg-stone-200"
                  )}
                />
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ProductSearchLayout({
  children,
  backHref = "/WingsAIStudioShotForm",
  backLabel = "ShotForm 홈",
  activeStep = 1,
}: ProductSearchLayoutProps) {
  const [apiKeyReady, setApiKeyReady] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    const refresh = () => setApiKeyReady(hasOpenAIKey())
    refresh()
    window.addEventListener("storage", refresh)
    window.addEventListener(SHOTFORM_API_KEYS_UPDATED_EVENT, refresh)
    return () => {
      window.removeEventListener("storage", refresh)
      window.removeEventListener(SHOTFORM_API_KEYS_UPDATED_EVENT, refresh)
    }
  }, [])

  return (
    <div className={cn("flex min-h-screen", pack.page)}>
      <aside className={cn("sticky top-0 z-20 flex h-screen w-[272px] shrink-0 flex-col", pack.sidebar)}>
        <div className="border-b border-[#1c1917]/[0.06] px-5 py-5">
          <Link href="/WingsAIStudioShotForm" className="group flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#ff4d3d] to-[#ff8a65] shadow-lg shadow-[#ff4d3d]/30">
              <Sparkles className="h-4 w-4 text-white" aria-hidden />
            </span>
            <span className="text-base font-bold tracking-tight text-[#1c1917]">
              Wings <span className="text-[#ff4d3d]">AI</span> Studio
            </span>
          </Link>
          {backHref ? (
            <Link
              href={backHref}
              className="mt-3 inline-flex text-xs font-medium text-stone-500 transition hover:text-[#ff4d3d]"
            >
              ← {backLabel}
            </Link>
          ) : null}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-6 flex gap-2 px-1">
            <Link
              href="/WingsAIStudioShotForm/shortform-studio"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white px-2.5 py-3 text-sm font-semibold text-stone-700 shadow-sm ring-1 ring-[#1c1917]/[0.08] transition hover:bg-[#fff0ec] hover:text-[#ff4d3d]"
            >
              <FolderOpen className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">프로젝트 목록</span>
            </Link>
            <Link
              href="/WingsAIStudioShotForm/shopping-links"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#ff4d3d] to-[#ff8a65] px-2.5 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-105"
            >
              <ShoppingBag className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">My 링크</span>
            </Link>
          </div>

          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="mb-6">
              <p className={cn("mb-2 px-3", pack.label)}>{group.title}</p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const active = item.id === "product-search"
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg py-2.5 text-left text-sm transition-colors",
                          item.nested ? "pl-7 pr-3" : "px-3",
                          active
                            ? "bg-[#fff0ec] font-medium text-[#ff4d3d] ring-1 ring-[#ff4d3d]/25"
                            : "text-stone-600 hover:bg-white/80 hover:text-[#1c1917]"
                        )}
                      >
                        <Icon
                          className={cn("h-4 w-4 shrink-0", active ? "text-[#ff4d3d]" : "text-stone-400")}
                          aria-hidden
                        />
                        <span className="flex-1">{item.label}</span>
                        {item.badge ? (
                          <span className="rounded-md bg-[#fff0ec] px-1.5 py-0.5 text-[10px] font-semibold text-[#ff4d3d]">
                            {item.badge}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-[#1c1917]/[0.06] px-4 py-4">
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-xs",
              apiKeyReady ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"
            )}
          >
            <KeyRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {apiKeyReady ? "OpenAI API 연결됨" : "설정에서 API 키 필요"}
          </div>
        </div>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-end gap-4 border-b border-[#1c1917]/[0.06] bg-[#faf8f5]/90 px-6 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-stone-500 transition hover:bg-white hover:text-[#1c1917]"
          >
            <Settings className="h-4 w-4" aria-hidden />
            설정
          </button>
          <div
            className="h-8 w-8 rounded-full bg-gradient-to-br from-stone-300 to-stone-400 ring-2 ring-white"
            title="프로필"
          />
        </header>

        <ShotFormApiKeySettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

        <StepBar activeStep={activeStep} />

        <main className="relative flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
