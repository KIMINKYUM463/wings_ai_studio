"use client"

import { ShotFormTrendResearchShell } from "../components/ShotFormTrendResearchShell"
import { MvpProjectManager } from "./MvpProjectManager"

export function MvpTestShell() {
  return (
    <ShotFormTrendResearchShell activeRoute="shortform-studio" hideSidebar appTitle="Wings AI ShotForm">
      <MvpProjectManager />
    </ShotFormTrendResearchShell>
  )
}
