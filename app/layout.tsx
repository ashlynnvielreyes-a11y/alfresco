import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from '@/components/ui/toaster'
import { SyncErrorListener } from '@/components/sync-error-listener'
import { LowStockNotificationListener } from '@/components/low-stock-notification-listener'
import { OfflineSyncListener } from '@/components/offline-sync-listener'
import { SessionEnforcer } from '@/components/session-enforcer'
import { SourceProtection } from '@/components/source-protection'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Al Fresco POS',
  description: 'Point of Sale System for Al Fresco Cafe',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`bg-background ${inter.variable}`}>
      <body className="font-sans antialiased bg-background">
        <SourceProtection />
        <SessionEnforcer />
        {children}
        <SyncErrorListener />
        <OfflineSyncListener />
        <LowStockNotificationListener />
        <Toaster />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}

