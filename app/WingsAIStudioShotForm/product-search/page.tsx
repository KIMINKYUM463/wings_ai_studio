import { Suspense } from "react"
import { ProductSearchShell } from "./ProductSearchShell"

export default function ProductSearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#060912] py-10">
          <div className="mx-auto h-40 max-w-5xl animate-pulse rounded-2xl border border-white/[0.06] bg-[#0d1322]/90 px-4 sm:px-6" />
        </div>
      }
    >
      <ProductSearchShell />
    </Suspense>
  )
}
