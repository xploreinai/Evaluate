'use client'

import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/useAuth'
import ThemeToggle from './ThemeToggle'

export default function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading } = useAuth()

  // Participants taking a quiz are not trainers — keep their screen clean.
  const isParticipantView = pathname?.startsWith('/quiz')

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  // Home means the dashboard for a signed-in trainer, otherwise the landing page.
  const home = user ? '/dashboard' : '/'
  const atHome = pathname === home

  return (
    <header className="bg-surface border-b border-line sticky top-0 z-10">
      <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
        <button onClick={() => router.push(home)} className="text-left min-w-0">
          {/* Serif wordmark over a spaced uppercase descriptor, echoing the
              lockup used across editionhotels.com */}
          <span className="font-display text-xl uppercase text-ink tracking-display">
            E-valuate
          </span>
          <span className="ml-3 text-[10px] text-muted uppercase tracking-wide hidden sm:inline">
            Training Intelligence
          </span>
        </button>

        <div className="flex items-center gap-3 shrink-0">
          {!isParticipantView && !loading && user && (
            <>
              <button
                onClick={() => router.push(home)}
                disabled={atHome}
                title="Home"
                aria-label="Home"
                className="text-muted hover:text-ink disabled:opacity-40 disabled:hover:text-muted transition-colors px-1"
              >
                {/* Simple house outline, drawn to sit with the hairline borders */}
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M3 10.5 12 3l9 7.5" />
                  <path d="M5.5 9.5V21h13V9.5" />
                  <path d="M9.75 21v-6h4.5v6" />
                </svg>
              </button>
              <button
                onClick={signOut}
                className="text-xs uppercase tracking-wide text-muted hover:text-ink transition-colors"
              >
                Sign out
              </button>
            </>
          )}

          {!isParticipantView && !loading && !user && pathname !== '/login' && (
            <button
              onClick={() => router.push('/login')}
              className="text-xs uppercase tracking-wide text-ink hover:text-sand-dark transition-colors"
            >
              Sign in
            </button>
          )}

          {/* Available to everyone, participants included */}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
