import type { Metadata, Viewport } from 'next'
import { Playfair_Display } from 'next/font/google'
import './globals.css'
import Header from './Header'
import ServiceWorker from './ServiceWorker'

// Apple devices have Didot, which is what editionhotels.com uses. Everywhere
// else falls back to this — the nearest freely available high-contrast serif —
// so headings keep the same character on Android and Windows.
const display = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-display',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'E-valuate',
  description: 'AI Training Intelligence Platform for Hospitality',
  manifest: '/manifest.json',
  applicationName: 'E-valuate',
  appleWebApp: {
    capable: true,
    title: 'E-valuate',
    // iOS shows the status bar over the page; this keeps it legible.
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#111111',
  width: 'device-width',
  initialScale: 1,
  // Installed apps should not zoom on input focus, but pinch-zoom must stay
  // available — quiz takers need to enlarge text.
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={display.variable}>
      <body className="font-sans bg-surface min-h-screen">

        <ServiceWorker />
        <Header />

        {/* Page content */}
        <main className="max-w-2xl mx-auto px-6 py-10">
          {children}
        </main>

      </body>
    </html>
  )
}
