import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import HqRecreateStudio from "./HqRecreateStudio"

export const maxDuration = 300

export default function HighQualityAiShoppingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0a0b0d] text-zinc-300">
          <Loader2 className="h-8 w-8 animate-spin text-lime-400" />
        </div>
      }
    >
      <HqRecreateStudio />
    </Suspense>
  )
}
