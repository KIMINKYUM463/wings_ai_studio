"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type { BenchmarkTab } from "./lib/types"
import { BenchmarkHeader } from "./components/BenchmarkHeader"
import { TrendingTab } from "./components/TrendingTab"
import { InsightTab } from "./components/InsightTab"
import { GroupsTab } from "./components/GroupsTab"
import { VideoGroupsTab } from "./components/VideoGroupsTab"

const VALID: BenchmarkTab[] = ["trending", "insight", "groups", "video-groups", "my-channel"]

function ChannelBenchmarkInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab") as BenchmarkTab | null
  const initial =
    tabParam && VALID.includes(tabParam) && tabParam !== "my-channel" ? tabParam : "trending"
  const [tab, setTab] = useState<BenchmarkTab>(initial)

  // 급상승·성과 리포트·관심 채널/영상 탭 일시 숨김 → 허브 진입 시 내 채널 진단으로
  useEffect(() => {
    router.replace("/WingsAIStudioShotForm/channel-analysis/deep-dive")
  }, [router])

  useEffect(() => {
    if (tabParam === "my-channel") {
      router.replace("/WingsAIStudioShotForm/channel-analysis/deep-dive")
      return
    }
    if (tabParam && VALID.includes(tabParam) && tabParam !== "my-channel") {
      setTab(tabParam)
    }
  }, [tabParam, router])

  const handleTabChange = (next: BenchmarkTab) => {
    if (next === "my-channel") {
      router.push("/WingsAIStudioShotForm/channel-analysis/deep-dive")
      return
    }
    setTab(next)
    router.replace(`/WingsAIStudioShotForm/channel-analysis?tab=${next}`, { scroll: false })
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0c1214] text-zinc-100">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="absolute right-0 top-1/4 h-96 w-96 rounded-full bg-sky-500/8 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-emerald-500/8 blur-3xl" />
      </div>

      <BenchmarkHeader activeTab={tab} onTabChange={handleTabChange} />

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-8">
        {tab === "trending" && <TrendingTab />}
        {tab === "insight" && <InsightTab />}
        {tab === "groups" && <GroupsTab />}
        {tab === "video-groups" && <VideoGroupsTab />}
      </main>
    </div>
  )
}

export default function ChannelBenchmarkPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0c1214] text-zinc-400">
          불러오는 중…
        </div>
      }
    >
      <ChannelBenchmarkInner />
    </Suspense>
  )
}
