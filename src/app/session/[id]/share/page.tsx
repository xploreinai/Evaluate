'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import QRCode from 'qrcode.react'
import type { Session } from '@/types'

export default function SharePage({
  params,
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    fetchSession()
  }, [params.id])

  async function fetchSession() {
    try {
      const { data, error: err } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', params.id)
        .single()

      if (err) throw err

      if (data.status !== 'published') {
        router.push(`/session/${params.id}/review`)
        return
      }

      setSession(data)
      setIsLoading(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch session'
      setError(message)
      setIsLoading(false)
    }
  }

  async function closeQuiz() {
    setIsClosing(true)
    try {
      const { error: err } = await supabase
        .from('sessions')
        .update({ status: 'closed' })
        .eq('id', params.id)

      if (err) throw err

      router.push(`/session/${params.id}/results`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to close quiz'
      setError(message)
      setIsClosing(false)
    }
  }

  function copyToClipboard() {
    const quizUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/quiz/${params.id}`
    navigator.clipboard.writeText(quizUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (error) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Error</h2>
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      </div>
    )
  }

  if (isLoading || !session) {
    return (
      <div className="text-center py-20">
        <div className="text-4xl mb-4">⏳</div>
        <h2 className="text-xl font-bold text-gray-900">Loading…</h2>
      </div>
    )
  }

  const quizUrl = typeof window !== 'undefined' ? `${window.location.origin}/quiz/${params.id}` : ''

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">
        Your quiz is live
      </h2>
      <p className="text-gray-500 mb-8">
        Share this QR code and link with staff to start the quiz.
      </p>

      {/* Session info */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-8">
        <p className="text-sm text-gray-500 mb-1">Session</p>
        <h3 className="text-lg font-semibold text-gray-900">{session.title}</h3>
        <p className="text-sm text-gray-600 mt-3">
          {new Date(session.session_date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* QR Code section */}
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center mb-8">
        <p className="text-sm font-medium text-gray-700 mb-6">Scan with a phone camera</p>
        <div className="flex justify-center mb-6">
          <QRCode
            value={quizUrl}
            size={240}
            level="H"
            includeMargin
            renderAs="canvas"
          />
        </div>
        <p className="text-sm text-gray-500 mb-6">Or share this link</p>

        {/* Copyable link */}
        <div className="flex items-center gap-2 mb-4">
          <input
            type="text"
            value={quizUrl}
            readOnly
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 bg-gray-50 cursor-text"
          />
          <button
            onClick={copyToClipboard}
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium rounded-lg transition-colors text-sm whitespace-nowrap"
          >
            {copied ? '✓ Copied' : 'Copy link'}
          </button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="space-y-3">
        <button
          onClick={() => router.push(`/session/${params.id}/results`)}
          className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl hover:bg-blue-700 transition-colors text-base"
        >
          View results →
        </button>
        <button
          onClick={closeQuiz}
          disabled={isClosing}
          className="w-full border border-gray-300 text-gray-700 font-semibold py-3.5 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-base"
        >
          {isClosing ? 'Closing…' : 'Close quiz'}
        </button>
      </div>
    </div>
  )
}
