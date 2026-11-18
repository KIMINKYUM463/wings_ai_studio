import type { ReactNode } from "react"
import { Black_Han_Sans, IBM_Plex_Sans_KR } from "next/font/google"
import "../wings-shopping-v2/wings-shopping-v2.css"

const display = Black_Han_Sans({ weight: "400", subsets: ["latin"], variable: "--font-display", preload: false })
const body = IBM_Plex_Sans_KR({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-body",
  preload: false,
})

export default function RemixShoppingV2Layout({ children }: { children: ReactNode }) {
  return (
    <div className={`${display.variable} ${body.variable} wings-shopping-v2 min-h-screen antialiased`}>
      {children}
    </div>
  )
}
