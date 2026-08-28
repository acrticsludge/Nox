import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NOX — Neon Void',
  description: 'A chaotic local multiplayer arena where the floor is lava and the last one standing wins.',
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#07090b',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="bg-background">
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
