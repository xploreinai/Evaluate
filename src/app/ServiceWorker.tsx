'use client'

import { useEffect } from 'react'

// Registers the service worker that makes the app installable. Renders nothing.
export default function ServiceWorker() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    // Wait for load so registration never competes with the first paint.
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        // Not fatal — the app works fine, it just will not offer "install".
        console.warn('Service worker registration failed:', err)
      })
    }

    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register)

    return () => window.removeEventListener('load', register)
  }, [])

  return null
}
