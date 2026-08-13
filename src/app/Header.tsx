'use client'

import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/useAuth'

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

  return (
    <header className="bg-surface border-b border-line sticky top-0 z-10">
      <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <button
          onClick={() => router.push(user ? '/dashboard' : '/')}
          className="text-left"
        >
          {/* Serif wordmark over a spaced uppercase descriptor, echoing the
              lockup used across editionhotels.com */}
          <span className="font-display text-xl uppercase text-ink tracking-display">
            E-valuate
          </span>
          <span className="ml-3 text-[10px] text-muted uppercase tracking-wide">
            Training Intelligence
          </span>
        </button>

        {!isParticipantView && !loading && (
          <div className="flex items-center gap-4 shrink-0">
            {user ? (
              <>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="text-sm text-muted hover:text-ink font-medium hidden sm:block"
                >
                  My sessions
                </button>
                <button
                  onClick={signOut}
                  className="text-sm text-muted hover:text-ink font-medium"
                >
                  Sign out
                </button>
              </>
            ) : (
              pathname !== '/login' && (
                <button
                  onClick={() => router.push('/login')}
                  className="text-sm text-ink hover:text-sand-dark font-medium"
                >
                  Sign in
                </button>
              )
            )}
          </div>
        )}
      </div>
    </header>
  )
}
