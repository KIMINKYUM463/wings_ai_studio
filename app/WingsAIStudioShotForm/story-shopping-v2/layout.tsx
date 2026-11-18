import type { ReactNode } from "react"

/** v1 스토리 쇼핑과 같은 밝은 셸 — wings-shopping-v2 테마 CSS는 씌우지 않음 */
export default function StoryShoppingV2Layout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[#f7f8fb] antialiased text-slate-900">{children}</div>
}
