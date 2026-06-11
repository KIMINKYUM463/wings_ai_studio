import { Suspense } from "react"
import { ShoppingLinksShell } from "./ShoppingLinksShell"

export default function ShoppingLinksPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070b14] py-10">
          <div className="mx-auto h-40 max-w-5xl animate-pulse rounded-xl border border-slate-800 bg-slate-900/50" />
        </div>
      }
    >
      <ShoppingLinksShell />
    </Suspense>
  )
}
