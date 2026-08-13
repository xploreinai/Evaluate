import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Header from './Header'
import ServiceWorker from './ServiceWorker'

const inter = Inter({ subsets: ['latin'] })

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
  themeColor: '#2563eb',
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
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>

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
