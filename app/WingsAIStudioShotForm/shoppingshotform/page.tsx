import { Suspense } from "react"
import { ShoppingFactoryShell } from "./ShoppingFactoryShell"

export default function ShoppingFactoryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070b14] py-10">
          <div className="mx-auto h-40 max-w-5xl animate-pulse rounded-xl border border-slate-800 bg-slate-900/50 px-4 sm:px-6" />
        </div>
      }
    >
      <ShoppingFactoryShell />
    </Suspense>
  )
}
