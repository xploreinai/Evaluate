import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Header from './Header'

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

        <Header />

        {/* Page content */}
        <main className="max-w-2xl mx-auto px-6 py-10">
          {children}
        </main>

      </body>
    </html>
  )
}
