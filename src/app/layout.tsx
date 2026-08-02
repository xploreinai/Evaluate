import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'E-valuate',
  description: 'AI Training Intelligence Platform for Hospitality',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>

        {/* Top navigation bar */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
            <div>
              <span className="text-lg font-bold text-gray-900 tracking-tight">E-valuate</span>
              <span className="ml-2 text-xs text-gray-400 font-medium uppercase tracking-wide">
                Training Intelligence
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="max-w-2xl mx-auto px-6 py-10">
          {children}
        </main>

      </body>
    </html>
  )
}
