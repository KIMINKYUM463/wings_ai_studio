import type { ReactNode } from "react"

/** Vercel 등에서 이미지 생성 Server Action이 중간에 끊기지 않도록 */
export const maxDuration = 300

export default function AnimalShoppingLayout({
  children,
}: {
  children: ReactNode
}) {
  return children
}
