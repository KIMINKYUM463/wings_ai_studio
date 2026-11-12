"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { LIGHT_REMAP_CLASS, isLightRemapPath } from "@/lib/light-remap"

/** 클라이언트 라우팅으로 경로가 바뀔 때 <html> 의 밝은 테마 클래스를 맞춘다. */
export function LightRemapController() {
  const pathname = usePathname()
  useEffect(() => {
    document.documentElement.classList.toggle(LIGHT_REMAP_CLASS, isLightRemapPath(pathname ?? ""))
  }, [pathname])
  return null
}
