'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import jsPDF from 'jspdf'
import type { Session, QuizAttempt, Answer, Question } from '@/types'
import { RequireAuth } from '@/lib/useAuth'


function ResultsPageInner({
  params,
}: {
  params: { id: string }
}) {
  const [session, setSession] = useState<Session | null>(null)
  const [attempts, setAttempts] = useState<QuizAttempt[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    fetchData()
  }, [params.id])

  useEffect(() => {
    if (session?.status === 'published') {
      const interval = setInterval(() => {
        fetchAttempts()
      }, 10000)
      return () => clearInterval(interval)
    }
  }, [session])

  async function fetchData() {
    try {
      const [sessionRes, attemptsRes, questionsRes] = await Promise.all([
        supabase.from('sessions').select('*').eq('id', params.id).single(),
        supabase
          .from('quiz_attempts')
          .select('*')
          .eq('session_id', params.id)
          .order('created_at'),
        supabase
          .from('questions')
          .select('*')
          .eq('session_id', params.id)
          .is('deleted_at', null),
      ])

      if (sessionRes.error) throw sessionRes.error
      if (attemptsRes.error) throw attemptsRes.error
      if (questionsRes.error) throw questionsRes.error

      setSession(sessionRes.data)
      setAttempts(attemptsRes.data || [])
      setQuestions(questionsRes.data || [])
      setIsLoading(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load results'
      setError(message)
      setIsLoading(false)
    }
  }

  async function fetchAttempts() {
    try {
      const { data, error: err } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('session_id', params.id)
        .order('created_at')

      if (err) throw err
      setAttempts(data || [])
    } catch (err) {
      console.error('Failed to update attempts:', err)
    }
  }

  async function findWeakestQuestion() {
    if (!questions.length) return null

    try {
      const { data: answers, error: err } = await supabase
        .from('answers')
        .select('question_id')
        .in('attempt_id', attempts.map(a => a.id))
        .eq('is_correct', false)

      if (err) throw err

      const questionCounts: Record<string, number> = {}
      ;(answers || []).forEach(a => {
        questionCounts[a.question_id] = (questionCounts[a.question_id] || 0) + 1
      })

      const weakestId = Object.keys(questionCounts).sort(
        (a, b) => questionCounts[b] - questionCounts[a]
      )[0]

      return questions.find(q => q.id === weakestId)
    } catch (err) {
      console.error('Failed to find weakest question:', err)
      return null
    }
  }

  async function exportPDF() {
    if (!session || !attempts.length) return

    setIsExporting(true)
    try {
      const pdf = new jsPDF()
      let yPos = 20

      // Header
      pdf.setFontSize(16)
      pdf.text('E-valuate', 20, yPos)
      yPos += 8

      pdf.setFontSize(11)
      pdf.setTextColor(80, 80, 80)
      pdf.text(`Session: ${session.topic}`, 20, yPos)
      yPos += 5
      pdf.text(`Date: ${new Date(session.session_date).toLocaleDateString()}`, 20, yPos)
      yPos += 5
      pdf.text(`Pass threshold: ${session.pass_threshold}%`, 20, yPos)
      yPos += 10

      // Results summary
      const passCount = attempts.filter(a => a.passed).length
      const passRate = Math.round((passCount / attempts.length) * 100)
      pdf.setFontSize(10)
      pdf.text(`Overall: ${passCount} of ${attempts.length} passed (${passRate}%)`, 20, yPos)
      yPos += 10

      // Table
      pdf.setFontSize(10)
      const tableData = attempts.map(a => [
        a.participant_name,
        `${a.score} / 10`,
        a.passed ? '✓ Pass' : '✗ Fail',
      ])

      pdf.setTextColor(0, 0, 0)
      pdf.text('Name', 20, yPos)
      pdf.text('Score', 120, yPos)
      pdf.text('Result', 160, yPos)
      yPos += 5

      pdf.setDrawColor(200, 200, 200)
      pdf.line(20, yPos, 190, yPos)
      yPos += 5

      tableData.forEach(row => {
        if (yPos > 270) {
          pdf.addPage()
          yPos = 20
        }
        pdf.text(row[0], 20, yPos)
        pdf.text(row[1], 120, yPos)
        pdf.text(row[2], 160, yPos)
        yPos += 6
      })

      // Footer
      yPos += 10
      pdf.setFontSize(8)
      pdf.setTextColor(120, 120, 120)
      pdf.text(
        `Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
        20,
        yPos
      )

      pdf.save(`${session.topic}-results.pdf`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export PDF'
      setError(message)
    } finally {
      setIsExporting(false)
    }
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
        <h2 className="text-xl font-bold text-gray-900">Loading results…</h2>
      </div>
    )
  }

  const passCount = attempts.filter(a => a.passed).length
  const passRate = attempts.length ? Math.round((passCount / attempts.length) * 100) : 0

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">
        Results
      </h2>
      <p className="text-gray-500 mb-8">
        {session.topic} • {new Date(session.session_date).toLocaleDateString()}
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-sm text-gray-500 mb-1">Participants</p>
          <p className="text-3xl font-bold text-gray-900">{attempts.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-sm text-gray-500 mb-1">Passed</p>
          <p className="text-3xl font-bold text-green-600">{passCount}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-sm text-gray-500 mb-1">Pass rate</p>
          <p className="text-3xl font-bold text-gray-900">{passRate}%</p>
        </div>
      </div>

      {/* Results table */}
      {attempts.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">
                    Participant
                  </th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">
                    Score
                  </th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">
                    Result
                  </th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt) => (
                  <tr key={attempt.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm text-gray-900">{attempt.participant_name}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {attempt.score} / 10
                    </td>
                    <td className="px-6 py-3 text-sm">
                      {attempt.passed ? (
                        <span className="inline-flex items-center gap-2 text-green-600 font-medium">
                          ✓ Pass
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2 text-red-600 font-medium">
                          ✗ Fail
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center mb-8">
          <p className="text-gray-600">No submissions yet. Participants can scan the QR code to start the quiz.</p>
        </div>
      )}

      {/* Export button */}
      <button
        onClick={exportPDF}
        disabled={isExporting || attempts.length === 0}
        className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-base"
      >
        {isExporting ? 'Exporting…' : 'Export PDF report →'}
      </button>
    </div>
  )
}


export default function ResultsPage(props: { params: { id: string } }) {
  return (
    <RequireAuth>
      <ResultsPageInner {...props} />
    </RequireAuth>
  )
}
