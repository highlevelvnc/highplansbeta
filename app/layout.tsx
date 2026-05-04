import type { Metadata, Viewport } from 'next'
import SessionProvider from '@/components/SessionProvider'
import { ThemeScript } from '@/components/ThemeToggle'
import './globals.css'

export const metadata: Metadata = {
  title: 'HIGHPLANS — Sistema Operacional Comercial',
  description: 'CRM & Intelligence para agências de marketing',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'HIGHPLANS',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#09090B',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="bg-[#09090B] text-[#F0F0F3] min-h-screen">
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
