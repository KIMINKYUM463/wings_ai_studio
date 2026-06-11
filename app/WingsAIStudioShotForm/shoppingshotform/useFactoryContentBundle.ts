"use client"

import { useEffect, useMemo, useState } from "react"
import { factoryNarrationTotalSec } from "@/lib/shotform-factory-narration-script"
import {
  readProductInputUrlFromSession,
  SHOTFORM_SESSION_RESTORED_EVENT,
} from "@/lib/shotform-mix-source"
import { resolveShotformUrlContentBundle } from "@/lib/shotform-url-bundles"

export function useFactoryContentBundle() {
  const [productInputUrl, setProductInputUrl] = useState<string | null>(null)

  useEffect(() => {
    const sync = () => setProductInputUrl(readProductInputUrlFromSession())
    sync()
    window.addEventListener(SHOTFORM_SESSION_RESTORED_EVENT, sync)
    return () => window.removeEventListener(SHOTFORM_SESSION_RESTORED_EVENT, sync)
  }, [])

  const bundle = useMemo(() => resolveShotformUrlContentBundle(productInputUrl), [productInputUrl])
  const factoryNarSegments = bundle.narrationSegments
  const factoryNarTotal = factoryNarrationTotalSec(factoryNarSegments)
  const factoryPreviewVideoSrc = bundle.factoryPreviewVideoSrc

  return {
    productInputUrl,
    factoryNarSegments,
    factoryNarTotal,
    factoryPreviewVideoSrc,
  }
}
