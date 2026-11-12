"use client"

import { TypecastApiGuideHost } from "@/components/TypecastApiGuideHost"
import { LightRemapController } from "@/components/LightRemap"

export function AppClientHosts() {
  return (
    <>
      <TypecastApiGuideHost />
      <LightRemapController />
    </>
  )
}
