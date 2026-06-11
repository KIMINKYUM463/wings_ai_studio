"use client"

import { useSearchParams } from "next/navigation"
import { ProductUrlSearchView } from "../components/ProductUrlSearchView"
import { ShotFormTrendResearchShell } from "../components/ShotFormTrendResearchShell"

export function ProductSearchShell() {
  const sp = useSearchParams()
  const from = sp.get("from")
  const backHref =
    from === "shorts"
      ? "/WingsAIStudioShotForm/shorts"
      : from === "shopping"
        ? "/WingsAIStudioShotForm/shopping"
        : "/WingsAIStudioShotForm"
  const backLabel =
    from === "shorts" ? "쇼츠 제작으로" : from === "shopping" ? "쇼핑 숏폼으로" : "ShotForm 홈으로"

  return (
    <ShotFormTrendResearchShell activeRoute="product-search" backHref={backHref} backLabel={backLabel}>
      <ProductUrlSearchView embedded />
    </ShotFormTrendResearchShell>
  )
}
