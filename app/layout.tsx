import type { Metadata } from 'next'
import { Lato, Playfair_Display, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const lato = Lato({
  subsets: ["latin"],
  variable: "--font-lato",
  weight: ["300", "400", "700", "900"],
})
const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  weight: ["600", "700"],
})
const _geistMono = Geist_Mono({ subsets: ["latin"] });

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
    <html lang="en" className="bg-background">
      <body className={`${lato.variable} ${playfairDisplay.variable} font-sans antialiased bg-background`}>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}

