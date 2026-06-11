"use client"

import { ShotFormTrendResearchShell } from "../components/ShotFormTrendResearchShell"
import { ShoppingLinksView } from "./ShoppingLinksView"

export function ShoppingLinksShell() {
  return (
    <ShotFormTrendResearchShell activeRoute="shopping-links" hideSidebar appTitle="Wings AI ShotForm">
      <ShoppingLinksView />
    </ShotFormTrendResearchShell>
  )
}
