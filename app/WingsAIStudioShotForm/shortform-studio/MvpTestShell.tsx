"use client"

import { useState } from "react"
import { ShotFormTrendResearchShell } from "../components/ShotFormTrendResearchShell"
import { MvpProjectManager } from "./MvpProjectManager"

export function MvpTestShell() {
  const [projectListKey, setProjectListKey] = useState(0)

  return (
    <ShotFormTrendResearchShell
      activeRoute="shortform-studio"
      hideSidebar
      hideAppTitle
      showHomeButton
      logoHref="/WingsAIStudioShotForm/shortform-studio"
      onProjectListClick={() => setProjectListKey((k) => k + 1)}
    >
      <MvpProjectManager key={projectListKey} />
    </ShotFormTrendResearchShell>
  )
}
