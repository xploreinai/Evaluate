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
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <button
          onClick={() => router.push(user ? '/dashboard' : '/')}
          className="text-left"
        >
          <span className="text-lg font-bold text-gray-900 tracking-tight">E-valuate</span>
          <span className="ml-2 text-xs text-gray-400 font-medium uppercase tracking-wide">
            Training Intelligence
          </span>
        </button>

        {!isParticipantView && !loading && (
          <div className="flex items-center gap-4 shrink-0">
            {user ? (
              <>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="text-sm text-gray-600 hover:text-gray-900 font-medium hidden sm:block"
                >
                  My sessions
                </button>
                <button
                  onClick={signOut}
                  className="text-sm text-gray-600 hover:text-gray-900 font-medium"
                >
                  Sign out
                </button>
              </>
            ) : (
              pathname !== '/login' && (
                <button
                  onClick={() => router.push('/login')}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
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
