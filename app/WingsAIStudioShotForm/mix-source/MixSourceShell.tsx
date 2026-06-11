"use client"

import { ShotFormTrendResearchShell } from "../components/ShotFormTrendResearchShell"
import { MixSourceView } from "./MixSourceView"

export function MixSourceShell() {
  return (
    <ShotFormTrendResearchShell
      activeRoute="mix-source"
      backHref="/WingsAIStudioShotForm/product-search"
      backLabel="제품 검색으로"
    >
      <MixSourceView />
    </ShotFormTrendResearchShell>
  )
}
