'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/useAuth'
import ThemeToggle from './ThemeToggle'

export default function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading } = useAuth()

  // Sign out used to sit directly beside the home button, close enough that a
  // thumb aiming for home could end the session by mistake. It now lives
  // behind this menu, so leaving takes a second, deliberate tap.
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Participants taking a quiz are not trainers — keep their screen clean.
  const isParticipantView = pathname?.startsWith('/quiz')

  async function signOut() {
    setMenuOpen(false)
    await supabase.auth.signOut()
    router.replace('/login')
  }

  // Home means the dashboard for a signed-in trainer, otherwise the landing page.
  const home = user ? '/dashboard' : '/'
  const atHome = pathname === home

  // Close on a click anywhere else, and on Escape.
  useEffect(() => {
    if (!menuOpen) return
    function onPointerDown(e: PointerEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  // Never leave the menu hanging open over a page the trainer has moved to.
  useEffect(() => setMenuOpen(false), [pathname])

  // Administrators get an extra item in the menu. This asks the database what
  // role the signed-in person has; before the multi-property migrations are run
  // that function does not exist, so any failure just means "not an admin" and
  // the item stays hidden rather than the header breaking.
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    if (!user) {
      setIsAdmin(false)
      return
    }
    let cancelled = false
    supabase
      .rpc('current_role_name')
      .then(({ data, error }) => {
        if (cancelled || error) return
        setIsAdmin(data === 'super_admin' || data === 'org_admin')
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const initial = user?.email?.trim()?.[0]?.toUpperCase() || '?'

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

        <div className="flex items-center gap-2 shrink-0">
          {!isParticipantView && !loading && user && (
            <>
              <button
                onClick={() => router.push(home)}
                disabled={atHome}
                title="Home"
                aria-label="Home"
                // p-2 rather than px-1: a comfortable thumb target, and the
                // padding itself keeps a stray tap away from its neighbour.
                className="text-muted hover:text-ink disabled:opacity-40 disabled:hover:text-muted transition-colors p-2 -m-0.5"
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

              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  title="Account"
                  aria-label="Account"
                  className={`w-8 h-8 border text-xs uppercase tracking-wide transition-colors ${
                    menuOpen
                      ? 'border-ink bg-surface-subtle text-ink'
                      : 'border-line text-muted hover:border-ink hover:text-ink'
                  }`}
                >
                  {initial}
                </button>

                {menuOpen && (
                  <div
                    role="menu"
                    aria-label="Account"
                    className="absolute right-0 top-full mt-2 w-56 max-w-[calc(100vw-3rem)] border border-ink bg-surface z-20"
                  >
                    <div className="px-4 py-3 border-b border-line">
                      <p className="text-[10px] text-muted uppercase tracking-wide">
                        Signed in as
                      </p>
                      <p className="text-xs text-ink break-all mt-1">{user.email}</p>
                    </div>
                    {isAdmin && (
                      <button
                        role="menuitem"
                        onClick={() => router.push('/admin')}
                        className="w-full text-left px-4 py-3 text-xs uppercase tracking-wide text-ink hover:bg-surface-subtle transition-colors border-b border-line"
                      >
                        Administration
                      </button>
                    )}
                    <button
                      role="menuitem"
                      onClick={signOut}
                      className="w-full text-left px-4 py-3 text-xs uppercase tracking-wide text-ink hover:bg-surface-subtle transition-colors"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
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
