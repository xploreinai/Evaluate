'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, supabaseConfigError } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Already signed in? Go straight to the dashboard.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/dashboard')
    })
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)

    if (supabaseConfigError) {
      setError(supabaseConfigError)
      return
    }
    if (!email.trim() || !password) {
      setError('Please enter your email and password.')
      return
    }
    if (mode === 'signup' && password.length < 6) {
      setError('Please choose a password of at least 6 characters.')
      return
    }

    setBusy(true)
    try {
      if (mode === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() || null } },
        })
        if (err) throw err

        // With email confirmation switched off, Supabase returns a session
        // immediately. If it is on, there is no session yet.
        if (!data.session) {
          setNotice('Account created. Check your email for a confirmation link, then sign in.')
          setMode('login')
          setBusy(false)
          return
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (err) throw err
      }

      router.replace('/dashboard')
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err)
      // Supabase's wording is terse; make the common cases understandable.
      let message = raw
      if (/invalid login credentials/i.test(raw)) {
        message = 'That email and password combination was not recognised.'
      } else if (/already registered|already been registered/i.test(raw)) {
        message = 'An account already exists for that email. Try signing in instead.'
      } else if (/email not confirmed/i.test(raw)) {
        message = 'This account still needs email confirmation. Check your inbox for the link.'
      }
      setError(message)
      setBusy(false)
    }
  }

  const inputClass =
    'w-full px-4 py-2.5 border border-line rounded-lg focus:ring-2 focus:ring-ink focus:border-transparent outline-none'

  return (
    <div className="max-w-md">
      <h1 className="text-3xl text-ink mb-2">
        {mode === 'login' ? 'Trainer sign in' : 'Create a trainer account'}
      </h1>
      <p className="text-muted mb-8">
        {mode === 'login'
          ? 'Sign in to record sessions and manage your quizzes.'
          : 'Set up an account to record sessions and build quizzes.'}
      </p>

      {error && (
        <div className="bg-surface-subtle border border-ink rounded-xl p-4 mb-6">
          <p className="text-sm text-ink">{error}</p>
        </div>
      )}
      {notice && (
        <div className="bg-surface-subtle border border-line rounded-xl p-4 mb-6">
          <p className="text-sm text-muted">{notice}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {mode === 'signup' && (
          <div>
            <label htmlFor="fullName" className="block text-sm font-semibold text-ink mb-2">
              Your name
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ram Prabhu"
              className={inputClass}
            />
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-ink mb-2">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-semibold text-ink mb-2">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
          {mode === 'signup' && (
            <p className="text-xs text-muted mt-1.5">At least 6 characters.</p>
          )}
        </div>

        <button
          type="submit"
          disabled={busy}
          className="btn-primary"
        >
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <p className="text-sm text-muted mt-6">
        {mode === 'login' ? "Don't have an account yet? " : 'Already have an account? '}
        <button
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login')
            setError(null)
            setNotice(null)
          }}
          className="text-ink hover:text-sand-dark font-medium"
        >
          {mode === 'login' ? 'Create one' : 'Sign in'}
        </button>
      </p>
    </div>
  )
}
