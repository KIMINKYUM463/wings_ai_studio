"use client"

import { useEffect, useState } from "react"
import type { ShoppingLinkPageData } from "@/lib/shotform-shopping-link-types"
import { fetchShoppingLinkPage } from "@/lib/shotform-shopping-link-store"
import { ShoppingLinkLivePreview } from "@/app/WingsAIStudioShotForm/shopping-links/components/ShoppingLinkLivePreview"

type Props = {
  slug: string
}

export function PublicShoppingLinkClient({ slug }: Props) {
  const [page, setPage] = useState<ShoppingLinkPageData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchShoppingLinkPage(slug)
        if (!cancelled) {
          if (!data) setError("페이지를 찾을 수 없습니다.")
          else setPage(data)
        }
      } catch {
        if (!cancelled) setError("페이지를 불러오지 못했습니다.")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <p className="text-slate-600">{error}</p>
      </div>
    )
  }

  if (!page) {
    return <div className="min-h-screen animate-pulse bg-slate-100" />
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center overflow-x-auto bg-gradient-to-b from-slate-200 to-slate-300 px-3 py-10 sm:px-6">
      <div className="origin-top scale-[1.45] sm:scale-[1.6] md:scale-[1.75]">
        <ShoppingLinkLivePreview
          profile={page.profile}
          blocks={page.blocks}
          design={page.design}
          interactive
          variant="standalone"
        />
      </div>
    </div>
  )
}
