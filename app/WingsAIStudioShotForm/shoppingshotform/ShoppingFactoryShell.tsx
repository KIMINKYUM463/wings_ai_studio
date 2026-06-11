"use client"

import { useEffect, useState } from "react"
import { readFactoryBackLink } from "@/lib/shotform-mvp-factory-bridge"
import { SHOTFORM_SESSION_RESTORED_EVENT } from "@/lib/shotform-mix-source"
import { ShotFormTrendResearchShell } from "../components/ShotFormTrendResearchShell"
import { ShoppingFactoryView } from "./ShoppingFactoryView"

type Props = {
  backHref?: string
  backLabel?: string
}

export function ShoppingFactoryShell({ backHref, backLabel }: Props) {
  const [sessionBack, setSessionBack] = useState<{ href: string; label: string } | null>(null)

  useEffect(() => {
    const sync = () => setSessionBack(readFactoryBackLink())
    sync()
    window.addEventListener(SHOTFORM_SESSION_RESTORED_EVENT, sync)
    return () => window.removeEventListener(SHOTFORM_SESSION_RESTORED_EVENT, sync)
  }, [])

  return (
    <ShotFormTrendResearchShell
      activeRoute="shoppingshotform"
      backHref={backHref ?? sessionBack?.href ?? "/WingsAIStudioShotForm/product-search"}
      backLabel={backLabel ?? sessionBack?.label ?? "제품 검색으로"}
    >
      <ShoppingFactoryView />
    </ShotFormTrendResearchShell>
  )
}
