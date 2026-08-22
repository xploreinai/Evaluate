'use client'

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'evaluate-theme'

// Applied before paint by the inline script in layout.tsx, so the page never
// flashes light before switching to dark.
function apply(theme: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as 'light' | 'dark' | null
    const initial =
      stored ??
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    setTheme(initial)
    apply(initial)
  }, [])

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    apply(next)
    localStorage.setItem(STORAGE_KEY, next)
  }

  // Render nothing until the stored choice is known, so the switch cannot
  // appear in the wrong position for a frame.
  if (theme === null) return <div className="w-11 h-6" aria-hidden />

  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggle}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className="relative w-11 h-6 border border-line bg-surface-subtle transition-colors shrink-0"
    >
      <span
        className={`absolute top-0.5 h-4 w-4 bg-ink transition-transform duration-200 ${
          isDark ? 'translate-x-[22px]' : 'translate-x-1'
        }`}
      />
      <span className="sr-only">{isDark ? 'Dark mode on' : 'Light mode on'}</span>
    </button>
  )
}
