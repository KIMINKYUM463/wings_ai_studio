import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Analytics } from '@vercel/analytics/next'
import { AppClientHosts } from '@/components/AppClientHosts'
import { LIGHT_REMAP_BOOT_SCRIPT } from '@/lib/light-remap'
import './globals.css'
import './light-remap.css'

export const metadata: Metadata = {
  title: 'wings AI',
  description: '유튜브 전문 AI 콘텐츠 제작 프로그램',
  generator: 'wings AI',
  icons: {
    icon: '/icon.svg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: LIGHT_REMAP_BOOT_SCRIPT }} />
      </head>
      <body className={`font-sans antialiased ${GeistSans.variable} ${GeistMono.variable}`}>
        {children}
        <AppClientHosts />
        <Analytics />
      </body>
    </html>
  )
}
