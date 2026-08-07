"use client"

import Link from "next/link"
import { type ReactNode, useEffect, useState } from "react"
import {
  Factory,
  Film,
  FlaskConical,
  FolderOpen,
  Home,
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
} from "./ShotFormApiKeySettingsDialog"
import { studio } from "./ShotFormStudioUI"

export type TrendResearchNavId =
  | "product-search"
  | "shortform-studio"
  | "mix-source"
  | "shoppingshotform"
  | "realtime-rank"
  | "picked"
  | "shopping-links"

type NavItem = {
  id: TrendResearchNavId
  label: string
  icon: typeof Search
  href?: string
  nested?: boolean
  badge?: string
}

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "제품 검색",
    items: [
      { id: "product-search", label: "영상·URL 검색", icon: Search, href: "/WingsAIStudioShotForm/product-search" },
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
      { id: "mix-source", label: "믹스 소스", icon: Film, href: "/WingsAIStudioShotForm/mix-source", nested: true },
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

export type ShotFormTrendResearchShellProps = {
  activeRoute: TrendResearchNavId
  children: ReactNode
  backHref?: string
  backLabel?: string
  /** 사이드바 없이 상단 헤더만 (메인 ShotForm 화면) */
  hideSidebar?: boolean
  appTitle?: string
  /** hideSidebar 헤더 로고 클릭 시 이동 경로 (기본: ShotForm 메인) */
  logoHref?: string
  /** 로고 클릭 시 추가 동작 (예: 프로젝트 목록으로 복귀) */
  onLogoClick?: () => void
  /** 프로젝트 목록 클릭 (숏폼 스튜디오 내 목록 복귀). 미설정 시 shortform-studio로 이동 */
  onProjectListClick?: () => void
  projectListHref?: string
  /** 사이드바 없는 헤더에 ShotForm 홈 버튼 표시 */
  showHomeButton?: boolean
  /** 좌측 상단 앱 타이틀/로고 숨김 */
  hideAppTitle?: boolean
}

function hasOpenAIKey(): boolean {
  if (typeof window === "undefined") return false
  return Boolean((localStorage.getItem("shotform_openai_api_key") || "").trim())
}

export function ShotFormTrendResearchShell({
  activeRoute,
  children,
  backHref = "/WingsAIStudioShotForm",
  backLabel = "ShotForm 홈",
  hideSidebar = false,
  appTitle = "Wings AI ShotForm",
  logoHref = "/WingsAIStudioShotForm",
  onLogoClick,
  onProjectListClick,
  projectListHref = "/WingsAIStudioShotForm/shortform-studio",
  showHomeButton = false,
  hideAppTitle = false,
}: ShotFormTrendResearchShellProps) {
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

  const projectListActive = activeRoute === "shortform-studio"
  const projectListSidebarCls = cn(
    "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2.5 py-3 text-sm font-semibold transition-all",
    projectListActive
      ? "bg-violet-500/20 text-violet-100 ring-1 ring-violet-400/35"
      : "bg-white/[0.06] text-slate-200 hover:bg-white/[0.1] hover:text-white"
  )
  const projectListHeaderCls = cn(
    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition",
    projectListActive
      ? cn(studio.btnSegmentActive, "rounded-lg")
      : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
  )

  const projectListSidebar = onProjectListClick ? (
    <button type="button" onClick={onProjectListClick} className={projectListSidebarCls}>
      <FolderOpen className="h-4 w-4 shrink-0" aria-hidden />
      <span className="truncate">프로젝트 목록</span>
    </button>
  ) : (
    <Link href={projectListHref} className={projectListSidebarCls}>
      <FolderOpen className="h-4 w-4 shrink-0" aria-hidden />
      <span className="truncate">프로젝트 목록</span>
    </Link>
  )

  const projectListHeader = onProjectListClick ? (
    <button type="button" onClick={onProjectListClick} className={projectListHeaderCls}>
      <FolderOpen className="h-4 w-4" aria-hidden />
      프로젝트 목록
    </button>
  ) : (
    <Link href={projectListHref} className={projectListHeaderCls}>
      <FolderOpen className="h-4 w-4" aria-hidden />
      프로젝트 목록
    </Link>
  )

  return (
    <div className={cn("flex min-h-screen", studio.page)}>
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(124,58,237,0.12),transparent)]"
        aria-hidden
      />

      {!hideSidebar ? (
      <aside className={cn("sticky top-0 z-20 flex h-screen w-[272px] shrink-0 flex-col", studio.sidebar)}>
        <div className="border-b border-white/[0.06] px-5 py-5">
          <Link href="/WingsAIStudioShotForm" className="group flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-900/40">
              <Sparkles className="h-4 w-4 text-white" aria-hidden />
            </span>
            <span className="text-base font-bold tracking-tight text-white">
              Wings <span className="text-violet-300">AI</span> Studio
            </span>
          </Link>
          {backHref ? (
            <Link
              href={backHref}
              className="mt-3 inline-flex text-xs font-medium text-slate-500 transition hover:text-violet-300"
            >
              ← {backLabel}
            </Link>
          ) : null}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-6 flex gap-2 px-1">
            {projectListSidebar}
            <Link
              href="/WingsAIStudioShotForm/shopping-links"
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2.5 py-3 text-sm font-semibold transition-all",
                activeRoute === "shopping-links"
                  ? "bg-gradient-to-r from-pink-500 to-violet-600 text-white shadow-lg shadow-violet-900/40 ring-2 ring-white/20"
                  : "bg-gradient-to-r from-pink-600/85 to-violet-700/85 text-white shadow-md hover:from-pink-500 hover:to-violet-600"
              )}
            >
              <ShoppingBag className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">My 링크</span>
            </Link>
          </div>

          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="mb-6">
              <p className={cn("mb-2 px-3", studio.label)}>{group.title}</p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const active = activeRoute === item.id
                  const cls = cn(
                    "flex w-full items-center gap-2.5 rounded-lg py-2.5 text-left text-sm transition-colors",
                    item.nested ? "pl-7 pr-3" : "px-3",
                    active ? studio.navActive : studio.navIdle
                  )
                  if (!item.href) {
                    return (
                      <li key={item.id}>
                        <button type="button" disabled className={cn(cls, "cursor-not-allowed opacity-40")} title="준비 중">
                          <Icon className="h-4 w-4 shrink-0 text-slate-600" aria-hidden />
                          {item.label}
                        </button>
                      </li>
                    )
                  }
                  return (
                    <li key={item.id}>
                      <Link href={item.href} className={cls}>
                        <Icon className={cn("h-4 w-4 shrink-0", active ? "text-violet-300" : "text-slate-500")} aria-hidden />
                        <span className="flex-1">{item.label}</span>
                        {item.badge ? (
                          <span className="rounded-md bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-violet-200">
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

        <div className="border-t border-white/[0.06] px-4 py-4">
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-xs",
              apiKeyReady ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-200"
            )}
          >
            <KeyRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {apiKeyReady ? "OpenAI API 연결됨" : "설정에서 API 키 필요"}
          </div>
        </div>
      </aside>
      ) : null}

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            "sticky top-0 z-10 flex h-14 shrink-0 items-center gap-4 px-6",
            hideSidebar && (!hideAppTitle || showHomeButton) ? "justify-between" : "justify-end",
            studio.header
          )}
        >
          {hideSidebar && !hideAppTitle ? (
            onLogoClick ? (
              <button
                type="button"
                onClick={onLogoClick}
                className="group flex items-center gap-2 text-left"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-900/40">
                  <Sparkles className="h-4 w-4 text-white" aria-hidden />
                </span>
                <span className="text-base font-bold tracking-tight text-white">
                  {appTitle.includes(" ") ? (
                    <>
                      {appTitle.split(" ")[0]}{" "}
                      <span className="text-violet-300">{appTitle.split(" ").slice(1).join(" ")}</span>
                    </>
                  ) : (
                    appTitle
                  )}
                </span>
              </button>
            ) : (
              <Link href={logoHref} className="group flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-900/40">
                  <Sparkles className="h-4 w-4 text-white" aria-hidden />
                </span>
                <span className="text-base font-bold tracking-tight text-white">
                  {appTitle.includes(" ") ? (
                    <>
                      {appTitle.split(" ")[0]}{" "}
                      <span className="text-violet-300">{appTitle.split(" ").slice(1).join(" ")}</span>
                    </>
                  ) : (
                    appTitle
                  )}
                </span>
              </Link>
            )
          ) : showHomeButton ? (
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-sm text-slate-300 transition hover:border-violet-400/30 hover:bg-violet-500/10 hover:text-white"
            >
              <Home className="h-4 w-4" aria-hidden />
              홈으로
            </Link>
          ) : null}
          <div className="flex items-center gap-2">
            {projectListHeader}
            <Link
              href="/WingsAIStudioShotForm/shopping-links"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition",
                activeRoute === "shopping-links"
                  ? cn(studio.btnSegmentActive, "rounded-lg")
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
              )}
            >
              <ShoppingBag className="h-4 w-4" aria-hidden />
              My 링크
            </Link>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-400 transition hover:bg-white/[0.04] hover:text-white"
            >
              <Settings className="h-4 w-4" aria-hidden />
              설정
            </button>
            <div
              className="h-8 w-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 ring-2 ring-white/10"
              title="프로필"
            />
          </div>
        </header>

        <ShotFormApiKeySettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

        <main className="relative flex-1 overflow-y-auto px-5 py-6 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
