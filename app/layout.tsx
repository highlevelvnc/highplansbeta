import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HIGHPLANS — Sistema Operacional Comercial',
  description: 'CRM & Intelligence para agências de marketing',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" className="dark">
      <body className="bg-[#0B0B0D] text-[#F5F5F7] min-h-screen">
        {children}
      </body>
    </html>
  )
}
