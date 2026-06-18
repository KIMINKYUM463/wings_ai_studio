"use client"

import type { ShoppingLinkPageData } from "@/lib/shotform-shopping-link-types"
import { ShoppingLinkLivePreview } from "@/app/WingsAIStudioShotForm/shopping-links/components/ShoppingLinkLivePreview"

type Props = {
  page: ShoppingLinkPageData
}

export function PublicShoppingLinkClient({ page }: Props) {
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
