"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  Home,
  TrendingUp,
  LineChart,
  Bookmark,
  Clapperboard,
  Radar,
  Compass,
} from "lucide-react"
import type { BenchmarkTab } from "../lib/types"

export const BENCHMARK_TABS: Array<{
  id: BenchmarkTab
  label: string
  icon: typeof TrendingUp
  href?: string
  /** true면 네비게이션에서 숨김 (기능은 코드에 유지) */
  hidden?: boolean
}> = [
  {
    id: "my-channel",
    label: "내 채널 진단",
    icon: Radar,
    href: "/WingsAIStudioShotForm/channel-analysis/deep-dive",
  },
  // 일시 숨김 — 다시 켤 때 hidden만 제거
  { id: "trending", label: "급상승", icon: TrendingUp, hidden: true },
  { id: "insight", label: "성과 리포트", icon: LineChart, hidden: true },
  { id: "groups", label: "관심 채널", icon: Bookmark, hidden: true },
  { id: "video-groups", label: "관심 영상", icon: Clapperboard, hidden: true },
]

const HUB = "/WingsAIStudioShotForm/channel-analysis"

export function BenchmarkHeader({
  activeTab,
  onTabChange,
}: {
  activeTab: BenchmarkTab
  /** 허브 페이지에서만 — deep-dive는 href로 이동 */
  onTabChange?: (tab: BenchmarkTab) => void
}) {
  const router = useRouter()

  const handleTab = (t: (typeof BENCHMARK_TABS)[number]) => {
    if (t.id === "my-channel" || t.href) {
      router.push(t.href || `${HUB}/deep-dive`)
      return
    }
    if (onTabChange) {
      onTabChange(t.id)
      return
    }
    router.push(`${HUB}?tab=${t.id}`)
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0c1214]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/10 hover:text-white"
            onClick={() => router.push("/WingsAIStudioShotForm")}
            title="뒤로"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/10 hover:text-white"
            onClick={() => router.push("/WingsAIStudioShotForm")}
            title="홈"
          >
            <Home className="h-4 w-4" />
          </Button>
          <div className="ml-1 hidden sm:block">
            <div className="inline-flex items-center gap-1.5 rounded-md border border-teal-400/30 bg-teal-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-teal-200">
              <Compass className="h-3 w-3" />
              Wings Scout
            </div>
            <h1 className="mt-1 text-lg font-bold tracking-tight text-zinc-50">채널 스카우트</h1>
          </div>
        </div>

        <nav className="flex max-w-[min(100%,48rem)] items-center gap-0.5 overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.03] p-1 scrollbar-none">
          {BENCHMARK_TABS.filter((t) => !t.hidden).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTab(t)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition sm:px-3 sm:text-sm ${
                activeTab === t.id
                  ? "bg-teal-500 text-teal-950 shadow-md shadow-teal-900/25"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              }`}
            >
              <t.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </nav>

        <div className="hidden w-[72px] md:block" aria-hidden />
      </div>
    </header>
  )
}
