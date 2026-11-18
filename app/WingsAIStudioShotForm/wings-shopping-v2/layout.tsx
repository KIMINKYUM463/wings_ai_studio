import type { ReactNode } from "react"
import { Black_Han_Sans, IBM_Plex_Sans_KR } from "next/font/google"
import Sidebar from "@/components/wings-shopping-v2/Sidebar"
import "./wings-shopping-v2.css"

const display = Black_Han_Sans({ weight: "400", subsets: ["latin"], variable: "--font-display", preload: false })
const body = IBM_Plex_Sans_KR({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-body",
  preload: false,
})

export default function WingsShoppingV2Layout({ children }: { children: ReactNode }) {
  return (
    <div className={`${display.variable} ${body.variable} wings-shopping-v2 min-h-screen antialiased`}>
      <div className="flex min-h-screen flex-col md:flex-row">
        <Sidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
