'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

// Tracks the signed-in trainer. `loading` matters: until the session has been
// read from storage we cannot tell "signed out" from "not checked yet", and
// redirecting on that difference would bounce a signed-in user to the login page.
export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return { user, loading }
}

// Wrap any page that requires a signed-in trainer.
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  if (loading) {
    return <div className="text-center py-20 text-gray-500">Loading…</div>
  }
  if (!user) {
    return <div className="text-center py-20 text-gray-500">Redirecting to sign in…</div>
  }
  return <>{children}</>
}
